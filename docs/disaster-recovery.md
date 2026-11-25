# Disaster Recovery Runbook

This document describes the backup, restoration, and disaster recovery (DR) procedures for the application. It is the authoritative runbook for on-call engineers and must be kept in sync with the implementation in `config.ts` and the backup automation.

## Objectives

| Metric | Target | Notes |
| --- | --- | --- |
| **RTO** (Recovery Time Objective) | **< 1 hour** | Time from declared incident to restored service. |
| **RPO** (Recovery Point Objective) | **< 1 hour** | Maximum acceptable data loss window. |
| Backup frequency | Every 30 minutes (incremental), daily (full) | Ensures RPO < 1 hour. |
| Backup retention | 35 days | Daily fulls retained 35 days; incrementals 7 days. |

## Configuration

All backup and DR behavior is driven by environment variables defined in `config.ts`. Do not hardcode values elsewhere.

| Variable | Purpose | Example |
| --- | --- | --- |
| `BACKUP_ENABLED` | Master switch for automated backups. | `true` |
| `BACKUP_SCHEDULE_CRON` | Cron expression for incremental backups. | `*/30 * * * *` |
| `BACKUP_FULL_SCHEDULE_CRON` | Cron expression for full backups. | `0 2 * * *` |
| `BACKUP_RETENTION_DAYS` | Retention window for full backups. | `35` |
| `BACKUP_STORAGE_BUCKET` | Primary (regional) backup bucket. | `app-backups-primary` |
| `BACKUP_REPLICA_BUCKET` | Geo-redundant replica bucket in the secondary region. | `app-backups-replica` |
| `BACKUP_PRIMARY_REGION` | Primary region for backups. | `us-east-1` |
| `BACKUP_REPLICA_REGION` | Secondary region for geo-redundancy. | `us-west-2` |
| `BACKUP_ENCRYPTION_KEY_ID` | KMS key used to encrypt backups at rest. | `arn:aws:kms:...` |
| `BACKUP_ALERT_WEBHOOK_URL` | Webhook (Slack/PagerDuty) for backup failure alerts. | `https://hooks...` |
| `BACKUP_ALERT_EMAIL` | Email distribution list for backup alerts. | `oncall@example.com` |
| `BACKUP_VERIFY_SCHEDULE_CRON` | Cron for automated restore verification. | `0 4 * * *` |
| `DR_DRILL_SCHEDULE_CRON` | Cron for scheduling DR drills. | `0 9 1 * *` |

> If any of these variables are missing or invalid, the application should fail fast at startup (validation lives in `config.ts`).

## Automated Backups

1. **Incremental backups** run every 30 minutes per `BACKUP_SCHEDULE_CRON`. They capture changed data since the last backup and are written to `BACKUP_STORAGE_BUCKET` in `BACKUP_PRIMARY_REGION`.
2. **Full backups** run daily at 02:00 UTC per `BACKUP_FULL_SCHEDULE_CRON`. Fulls are retained for `BACKUP_RETENTION_DAYS`.
3. All backups are **encrypted at rest** using `BACKUP_ENCRYPTION_KEY_ID` and encrypted in transit (TLS).
4. Each backup writes a **manifest** (checksum, timestamp, size, schema version) alongside the data. Restoration refuses to proceed if the manifest checksum does not match.
5. Backups are **immutable** for the retention window (object lock) to protect against accidental deletion or ransomware.

### Geo-Redundancy

- After a backup lands in `BACKUP_STORAGE_BUCKET` (`BACKUP_PRIMARY_REGION`), it is **replicated asynchronously** to `BACKUP_REPLICA_BUCKET` in `BACKUP_REPLICA_REGION`.
- Replication is expected to complete within 15 minutes. Replication lag is monitored; if lag exceeds 30 minutes an alert fires.
- The replica region is a **separate failure domain** (different region, separate credentials scope). Restoration can be performed entirely from the replica if the primary region is unavailable.
- Replication status is recorded per object; the verification job (below) checks that the latest backup exists in both buckets.

## Failure Alerting

- Any backup job that fails, times out, or produces a manifest with a checksum mismatch triggers an alert to `BACKUP_ALERT_WEBHOOK_URL` and `BACKUP_ALERT_EMAIL`.
- Alerts include: job type, timestamp, error, and a link to the job logs.
- **Missing backup detection:** a watchdog checks that a backup landed within the last 60 minutes. If not, it fires a high-severity alert (this protects the RPO).
- **Replication lag alert:** fires if replica lag exceeds 30 minutes.
- **Verification failure alert:** fires if the automated restore verification (`BACKUP_VERIFY_SCHEDULE_CRON`) fails.
- Alerts page the on-call engineer. Acknowledged alerts must be triaged within 15 minutes.

## Restoration Procedure

> **Goal: complete restoration in under 1 hour (RTO).** Follow the steps in order. Record timestamps at each step for the post-incident review.

### 0. Declare and assess (target: 5 min)

1. Declare an incident in the incident channel and assign an Incident Commander.
2. Determine the scope: which data, which environment, and whether the primary region is available.
3. Decide the source: **primary bucket** if healthy, otherwise the **replica bucket** (`BACKUP_REPLICA_BUCKET` in `BACKUP_REPLICA_REGION`).

### 1. Identify the target backup (target: 5 min)

1. List available backups and their manifests.
2. Select the most recent backup whose manifest checksum validates. Prefer the latest backup that satisfies the RPO (< 1 hour old).
3. Record the chosen backup ID and timestamp.

### 2. Prepare the restore target (target: 10 min)

1. Provision or identify the target database/storage for restoration.
2. Confirm the KMS key (`BACKUP_ENCRYPTION_KEY_ID`) is accessible from the restore environment.
3. Ensure the application is in maintenance mode / traffic is drained to avoid writes during restore.

### 3. Restore data (target: 20 min)

1. Download the selected backup (and any required incrementals) from the chosen bucket.
2. Verify the manifest checksum **before** applying.
3. Apply the full backup, then replay incrementals in timestamp order.
4. Monitor restore logs for errors; abort and escalate on checksum or schema-version mismatch.

### 4. Validate (target: 10 min)

1. Run integrity checks (row counts, key table checksums, referential integrity).
2. Run the smoke-test suite against the restored data.
3. Confirm the restored data timestamp is within the RPO window.

### 5. Cut over (target: 10 min)

1. Point the application at the restored data store.
2. Exit maintenance mode and re-enable traffic.
3. Monitor error rates and latency for 15 minutes.
4. Announce recovery and close the incident; schedule the post-incident review.

### Tested Steps

The restoration procedure above is exercised by the **automated restore verification** job (`BACKUP_VERIFY_SCHEDULE_CRON`), which restores the latest backup into an isolated environment, runs the integrity checks and smoke tests, and reports success/failure. A failure raises an alert. Manual drills (below) additionally validate the full cut-over path.

## DR Drills

DR drills are scheduled per `DR_DRILL_SCHEDULE_CRON` (monthly) and are mandatory. Each drill must be recorded with a report linked from the incident tracker.

### Drill Checklist

- [ ] Announce the drill window to stakeholders; confirm no conflicting changes are scheduled.
- [ ] Simulate a failure scenario (e.g., primary region unavailable, corrupted primary backup).
- [ ] Perform the full **Restoration Procedure** from the replica region.
- [ ] Measure and record **RTO** (must be < 1 hour) and **RPO** (must be < 1 hour).
- [ ] Verify alerts fired as expected (backup failure, replication lag, verification failure).
- [ ] Confirm the restored environment passes integrity checks and smoke tests.
- [ ] Tear down drill resources and confirm no impact to production.
- [ ] File a drill report: timestamps, metrics, issues found, and action items.
- [ ] Track action items to completion; update this runbook if procedures changed.

### Team Training

- All on-call engineers must complete a walkthrough of this runbook and participate in at least one drill before being added to the on-call rotation.
- Training records are maintained by the team lead. Re-training is required whenever this runbook changes materially.

## Roles and Responsibilities

| Role | Responsibility |
| --- | --- |
| Incident Commander | Declares incident, coordinates restoration, owns RTO. |
| Restore Operator | Executes restoration steps and records timestamps. |
| Communications Lead | Updates stakeholders and status page. |
| Backup Owner | Maintains backup automation, alerts, and this runbook. |

## Post-Incident Review

Within 5 business days of any restoration or failed drill, hold a post-incident review covering: timeline vs. RTO/RPO, root cause, alert effectiveness, and concrete action items with owners and due dates. Update this runbook and `config.ts` as needed.