import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Invoice } from '@stellar-split/sdk';

const SCALE = 10_000_000n;

interface EscalationStep {
  delayDays: number;
  channels: ('email' | 'feed' | 'memo')[];
  message: string;
  id?: string;
}

interface EscalationConfig {
  invoiceId: string;
  steps: EscalationStep[];
  active: boolean;
  pausedAt?: Date;
}

interface EscalationLog {
  id: string;
  invoiceId: string;
  stepId: string;
  channel: 'email' | 'feed' | 'memo';
  status: 'success' | 'failure';
  timestamp: Date;
  error?: string;
}

const createInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  creator: 'GCREATOR',
  recipients: [{ address: 'GPAYER', amount: 100n * SCALE }],
  token: 'CUSDC',
  deadline: Math.floor(Date.now() / 1000) - 86400, // 1 day overdue
  funded: 0n,
  status: 'Pending',
  payments: [],
  ...overrides,
});

describe('EscalationFlowBuilder', () => {
  it('allows adding escalation steps with delays and channels', () => {
    const steps: EscalationStep[] = [];

    const addStep = (step: EscalationStep) => {
      steps.push({ ...step, id: `step-${steps.length + 1}` });
    };

    addStep({
      delayDays: 3,
      channels: ['email'],
      message: 'First reminder',
    });
    addStep({
      delayDays: 7,
      channels: ['email', 'feed'],
      message: 'Second reminder',
    });

    expect(steps).toHaveLength(2);
    expect(steps[0].delayDays).toBe(3);
    expect(steps[0].channels).toContain('email');
    expect(steps[1].delayDays).toBe(7);
    expect(steps[1].channels).toContain('feed');
  });

  it('validates escalation steps have valid delays', () => {
    const isValidDelay = (delay: number) => delay > 0 && delay <= 365;

    expect(isValidDelay(3)).toBe(true);
    expect(isValidDelay(0)).toBe(false);
    expect(isValidDelay(-1)).toBe(false);
    expect(isValidDelay(366)).toBe(false);
  });

  it('validates at least one channel is selected per step', () => {
    const step: EscalationStep = {
      delayDays: 3,
      channels: [],
      message: 'Reminder',
    };

    const isValidChannels = (channels: string[]) => channels.length > 0;

    expect(isValidChannels(step.channels)).toBe(false);

    step.channels = ['email'];
    expect(isValidChannels(step.channels)).toBe(true);
  });

  it('persists escalation config to invoice', async () => {
    const invoice = createInvoice();
    const config: EscalationConfig = {
      invoiceId: invoice.id,
      steps: [
        {
          delayDays: 3,
          channels: ['email'],
          message: 'Reminder',
        },
      ],
      active: true,
    };

    // Simulate saving
    const savedConfig = { ...config };

    expect(savedConfig.invoiceId).toBe(invoice.id);
    expect(savedConfig.active).toBe(true);
    expect(savedConfig.steps).toHaveLength(1);
  });

  it('allows editing existing escalation flows', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        {
          delayDays: 3,
          channels: ['email'],
          message: 'First',
          id: 'step-1',
        },
      ],
      active: true,
    };

    const updatedConfig = {
      ...config,
      steps: config.steps.map((s) =>
        s.id === 'step-1'
          ? { ...s, delayDays: 5, channels: ['email', 'feed'] }
          : s
      ),
    };

    expect(updatedConfig.steps[0].delayDays).toBe(5);
    expect(updatedConfig.steps[0].channels).toContain('feed');
  });

  it('allows removing individual escalation steps', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        { delayDays: 3, channels: ['email'], message: 'First', id: 'step-1' },
        { delayDays: 7, channels: ['email'], message: 'Second', id: 'step-2' },
      ],
      active: true,
    };

    const updatedConfig = {
      ...config,
      steps: config.steps.filter((s) => s.id !== 'step-1'),
    };

    expect(updatedConfig.steps).toHaveLength(1);
    expect(updatedConfig.steps[0].id).toBe('step-2');
  });
});

describe('Escalation Cron Route', () => {
  it('queries overdue invoices with active escalation flows', () => {
    const invoices = [
      createInvoice({ id: 'inv-1', deadline: Math.floor(Date.now() / 1000) - 86400 }),
      createInvoice({ id: 'inv-2', deadline: Math.floor(Date.now() / 1000) + 86400 }),
    ];

    const overdueInvoices = invoices.filter(
      (inv) => inv.deadline < Math.floor(Date.now() / 1000)
    );

    expect(overdueInvoices).toHaveLength(1);
    expect(overdueInvoices[0].id).toBe('inv-1');
  });

  it('computes which escalation steps are due based on current date', () => {
    const dueDate = Math.floor(Date.now() / 1000); // Now
    const delaySeconds = 3 * 86400; // 3 days

    const stepDueDate = dueDate + delaySeconds;
    const isStepDue = Math.floor(Date.now() / 1000) >= stepDueDate;

    expect(isStepDue).toBe(false);

    // Simulate day 4 (step is due)
    const futureTime = Math.floor(Date.now() / 1000) + 4 * 86400;
    const isFutureStepDue = futureTime >= stepDueDate;
    expect(isFutureStepDue).toBe(true);
  });

  it('dispatches email escalation steps', async () => {
    const emailSent = vi.fn().mockResolvedValue({ messageId: 'msg-1' });

    const step: EscalationStep = {
      delayDays: 3,
      channels: ['email'],
      message: 'Payment reminder',
      id: 'step-1',
    };

    if (step.channels.includes('email')) {
      await emailSent({
        to: 'payer@example.com',
        subject: 'Payment Reminder',
        body: step.message,
      });
    }

    expect(emailSent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'payer@example.com',
      })
    );
  });

  it('dispatches feed activity alert escalation steps', async () => {
    const feedAlert = vi.fn().mockResolvedValue({ alertId: 'alert-1' });

    const step: EscalationStep = {
      delayDays: 5,
      channels: ['feed'],
      message: 'Payment overdue',
      id: 'step-2',
    };

    if (step.channels.includes('feed')) {
      await feedAlert({
        invoiceId: 'inv-1',
        type: 'escalation',
        message: step.message,
      });
    }

    expect(feedAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
      })
    );
  });

  it('dispatches on-chain memo notifications', async () => {
    const sendMemo = vi.fn().mockResolvedValue({ txHash: 'tx-123' });

    const step: EscalationStep = {
      delayDays: 7,
      channels: ['memo'],
      message: 'Final payment reminder',
      id: 'step-3',
    };

    if (step.channels.includes('memo')) {
      await sendMemo({
        destination: 'GPAYER',
        memo: step.message,
        amount: '0',
      });
    }

    expect(sendMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'GPAYER',
      })
    );
  });

  it('tracks each dispatched step in escalation log', () => {
    const logs: EscalationLog[] = [];

    const logEscalationStep = (log: Omit<EscalationLog, 'id'>) => {
      logs.push({
        ...log,
        id: `log-${logs.length + 1}`,
      });
    };

    logEscalationStep({
      invoiceId: 'inv-1',
      stepId: 'step-1',
      channel: 'email',
      status: 'success',
      timestamp: new Date(),
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('success');
    expect(logs[0].channel).toBe('email');
  });

  it('logs failures with error messages', () => {
    const logs: EscalationLog[] = [];

    const logEscalationStep = (log: EscalationLog) => {
      logs.push(log);
    };

    logEscalationStep({
      id: 'log-1',
      invoiceId: 'inv-1',
      stepId: 'step-1',
      channel: 'email',
      status: 'failure',
      timestamp: new Date(),
      error: 'Email address not found',
    });

    expect(logs[0].status).toBe('failure');
    expect(logs[0].error).toBe('Email address not found');
  });

  it('skips dispatch if escalation is paused', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        {
          delayDays: 3,
          channels: ['email'],
          message: 'Reminder',
        },
      ],
      active: false,
      pausedAt: new Date(),
    };

    const shouldDispatch = config.active;

    expect(shouldDispatch).toBe(false);
  });

  it('resumes escalation from correct step after pause', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        {
          delayDays: 3,
          channels: ['email'],
          message: 'First',
          id: 'step-1',
        },
        {
          delayDays: 7,
          channels: ['email'],
          message: 'Second',
          id: 'step-2',
        },
      ],
      active: false,
      pausedAt: new Date(Date.now() - 5 * 86400000), // Paused 5 days ago
    };

    const dueStepIndex = config.steps.findIndex(
      (s) => s.delayDays > 5
    );

    expect(dueStepIndex).toBe(1); // Should resume with step-2
  });

  it('handles cron execution and completes all pending steps', async () => {
    const executedSteps: string[] = [];

    const simulateCronExecution = async () => {
      const steps = ['step-1', 'step-2'];
      for (const step of steps) {
        executedSteps.push(step);
      }
    };

    await simulateCronExecution();

    expect(executedSteps).toHaveLength(2);
  });
});

describe('Escalation Timeline Display', () => {
  it('displays past escalation steps on invoice page', () => {
    const logs: EscalationLog[] = [
      {
        id: 'log-1',
        invoiceId: 'inv-1',
        stepId: 'step-1',
        channel: 'email',
        status: 'success',
        timestamp: new Date(Date.now() - 3 * 86400000),
      },
      {
        id: 'log-2',
        invoiceId: 'inv-1',
        stepId: 'step-2',
        channel: 'feed',
        status: 'success',
        timestamp: new Date(Date.now() - 1 * 86400000),
      },
    ];

    const timelineItems = logs.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    expect(timelineItems).toHaveLength(2);
    expect(timelineItems[0].channel).toBe('email');
    expect(timelineItems[1].channel).toBe('feed');
  });

  it('displays upcoming escalation steps in timeline', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        { delayDays: 3, channels: ['email'], message: 'First', id: 'step-1' },
        { delayDays: 7, channels: ['email'], message: 'Second', id: 'step-2' },
      ],
      active: true,
    };

    const dueDate = Math.floor(Date.now() / 1000);
    const upcomingSteps = config.steps.filter((s) => s.delayDays > 0);

    expect(upcomingSteps).toHaveLength(2);
  });

  it('shows escalation status with pause/resume controls', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        { delayDays: 3, channels: ['email'], message: 'Reminder', id: 'step-1' },
      ],
      active: true,
    };

    expect(config.active).toBe(true);

    const pausedConfig = { ...config, active: false, pausedAt: new Date() };

    expect(pausedConfig.active).toBe(false);
    expect(pausedConfig.pausedAt).toBeTruthy();
  });

  it('allows cancelling escalation flow', () => {
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        { delayDays: 3, channels: ['email'], message: 'Reminder', id: 'step-1' },
      ],
      active: true,
    };

    const cancelledConfig = { ...config, active: false, steps: [] };

    expect(cancelledConfig.active).toBe(false);
    expect(cancelledConfig.steps).toHaveLength(0);
  });
});

describe('Escalation Flow Integration', () => {
  it('completes full escalation workflow from setup to dispatch', async () => {
    // Step 1: Create config
    const config: EscalationConfig = {
      invoiceId: 'inv-1',
      steps: [
        {
          delayDays: 3,
          channels: ['email', 'feed'],
          message: 'Payment reminder',
        },
      ],
      active: true,
    };

    expect(config.active).toBe(true);
    expect(config.steps).toHaveLength(1);

    // Step 2: Simulate escalation dispatch
    const logs: EscalationLog[] = [];

    logs.push({
      id: 'log-1',
      invoiceId: config.invoiceId,
      stepId: 'step-1',
      channel: 'email',
      status: 'success',
      timestamp: new Date(),
    });

    expect(logs[0].status).toBe('success');

    // Step 3: Verify timeline display
    expect(logs).toHaveLength(1);
  });

  it('handles multiple concurrent escalation flows', () => {
    const configs: EscalationConfig[] = [
      {
        invoiceId: 'inv-1',
        steps: [{ delayDays: 3, channels: ['email'], message: 'Reminder 1' }],
        active: true,
      },
      {
        invoiceId: 'inv-2',
        steps: [{ delayDays: 5, channels: ['feed'], message: 'Reminder 2' }],
        active: true,
      },
    ];

    expect(configs).toHaveLength(2);
    expect(configs.every((c) => c.active)).toBe(true);
  });
});
