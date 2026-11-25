# Feature Flags

This document describes how feature flags are used in this project to control feature rollout, testing, and experimentation. It covers the flag lifecycle, naming conventions, rollout percentages, A/B testing, analytics, and cleanup.

## Overview

Feature flags (also called feature toggles) let us ship code without immediately exposing it to all users. They allow us to:

- Roll out features gradually to a percentage of users
- Test features with internal users before public release
- Run A/B tests to measure the impact of changes
- Disable a feature quickly if something goes wrong, without a redeploy

## Feature Flag Service

We use a hosted feature flag service that provides:

- A dashboard UI for creating and toggling flags
- Server-side and client-side SDKs for flag evaluation
- Targeting rules (by user ID, percentage, attributes)
- Built-in analytics and experiment support

Flag evaluation is cached locally by the SDK, so evaluating a flag has negligible performance impact. Flags are evaluated once per request/session where possible and results are memoized.

## Flag Lifecycle

Every flag moves through the following stages:

1. **Proposed** — A flag is requested in the issue tracker with a name, owner, and purpose.
2. **Created** — The flag is created in the flag service dashboard, defaulting to `off` in production.
3. **Development** — The flag is enabled for internal/test users only while the feature is built.
4. **Rollout** — The flag is enabled for a growing percentage of users (see [Rollout Percentages](#rollout-percentages)).
5. **Full rollout** — The flag is enabled for 100% of users.
6. **Cleanup** — The flag and its dead code paths are removed (see [Cleanup](#cleanup)).

Each flag must have an **owner** and a **target cleanup date** recorded in the flag service description.

## Naming Conventions

Flag names must be lowercase, hyphen-separated, and follow this pattern:

```
<area>-<feature>-<variant>
```

Examples:

- `checkout-one-click-payment`
- `search-vector-ranking`
- `profile-avatar-upload`

Rules:

- Use a stable, descriptive name — never rename a flag after it has shipped; create a new one instead.
- Prefix experimental flags with `exp-` (e.g. `exp-onboarding-tour`).
- Prefix kill-switch flags with `kill-` (e.g. `kill-recommendations`).
- Keep names short but unambiguous; avoid abbreviations that are not widely understood.

## Rollout Percentages

Gradual rollout uses percentage-based targeting. Recommended progression:

| Stage | Audience | Duration (guideline) |
|-------|----------|----------------------|
| Internal | Team members only | Until feature is stable |
| Canary | 1% of users | 1–2 days |
| Early | 5% of users | 2–3 days |
| Growing | 25% of users | 3–5 days |
| Majority | 50% of users | 3–5 days |
| Full | 100% of users | — |

Guidelines:

- Percentage targeting must be **sticky** — a given user should consistently fall into the same bucket. Use a stable bucketing key (e.g. user ID) rather than random sampling per request.
- Monitor error rates, latency, and key business metrics at each stage before increasing the percentage.
- If metrics regress, roll back to the previous percentage immediately.
- Never jump directly from 0% to 100% for user-facing features unless the change is trivial.

## A/B Testing

A/B tests use the same flag infrastructure with experiment support:

1. Define the experiment in the flag service with named variants (e.g. `control`, `treatment`).
2. Assign a stable bucketing key so users see a consistent variant.
3. Expose the variant to the application via flag evaluation.
4. Track exposure and conversion events through the analytics integration (see [Analytics](#analytics)).
5. Run the experiment for a pre-determined duration and sample size; do not peek and stop early.
6. Record the result and decision in the experiment description, then clean up.

Experiments must have a hypothesis, a primary metric, and a defined success threshold before launch.

## Analytics

Flag evaluations and experiment exposures are tracked automatically:

- **Exposure events** are emitted when a user is evaluated for an experiment flag, including the flag key and variant.
- **Conversion events** are emitted by application code at the relevant action points.
- Events are sent to our analytics pipeline and are available in the flag service dashboard.

Do not emit exposure events for simple on/off rollout flags unless you need to measure adoption. Avoid logging personally identifiable information in flag events.

## Cleanup

Flags are temporary. To keep the codebase healthy:

- Every flag must have a target cleanup date when created.
- Once a flag is at 100% (or an experiment has concluded), open a cleanup task to:
  1. Remove the flag from the flag service.
  2. Remove the flag evaluation code and any dead branches.
  3. Remove associated tests that only exist for the flag.
  4. Update this document if the flag was referenced.
- Flags older than their cleanup date are reported in the weekly engineering review.

## Performance

Flag evaluation is designed to have no measurable performance impact:

- The SDK caches flag configurations locally and refreshes them in the background.
- Evaluations are in-memory lookups.
- Results are memoized per request where appropriate.

If you suspect a flag is causing a performance issue, check the SDK's diagnostics and report it to the platform team.

## Related Documentation

- [User Guide](USER_GUIDE.md) — end-user documentation, including how to manage feature flags in the UI.
- [Contributing Guide](../CONTRIBUTING.md) — development workflow and flag-related contribution guidelines.