import { z } from 'zod';

export const RecipientLineSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  sharePercent: z
    .number()
    .min(0, 'Share percentage must be >= 0')
    .max(100, 'Share percentage must be <= 100'),
  taxRatePercent: z
    .number()
    .min(0, 'Tax rate must be >= 0')
    .max(100, 'Tax rate must be <= 100'),
  fixedFeeXLM: z.number().min(0, 'Fixed fee must be >= 0'),
});

export type RecipientLineInput = z.infer<typeof RecipientLineSchema>;

export const InstallmentMilestoneSchema = z.object({
  id: z.string().min(1, "Milestone ID is required"),
  amount: z.number().min(0, "Amount must be >= 0"),
  dueDate: z.number().min(0, "Due date must be a valid unix timestamp"),
  status: z.enum(["upcoming", "overdue", "paid"]),
  txHash: z.string().optional(),
});

export type InstallmentMilestoneInput = z.infer<typeof InstallmentMilestoneSchema>;

export const SplitMetaSchema = z
  .object({
    totalAmount: z.number().min(0, "Total amount must be >= 0"),
    assetCode: z.enum(["XLM", "USDC"]),
    recipients: z.array(RecipientLineSchema),
    installments: z.array(InstallmentMilestoneSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const shareSum = data.recipients.reduce(
      (s, r) => s + r.sharePercent,
      0
    );
    const delta = Math.abs(100 - shareSum);
    if (data.recipients.length > 0 && delta >= 0.0001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Share percentages must sum to 100% (current: ${shareSum.toFixed(4)}%)`,
        path: ["recipients"],
      });
    }
    if (data.installments && data.installments.length > 0) {
      const installmentSum = data.installments.reduce((s, m) => s + m.amount, 0);
      if (Math.abs(installmentSum - data.totalAmount) >= 0.0001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Installment amounts must sum to invoice total (current sum: ${installmentSum.toFixed(7)}, total: ${data.totalAmount.toFixed(7)})`,
          path: ["installments"],
        });
      }
    }
  });

export type SplitMetaInput = z.infer<typeof SplitMetaSchema>;

export function parseSplitMeta(raw: unknown): SplitMetaInput | null {
  try {
    return SplitMetaSchema.parse(raw);
  } catch {
    return null;
  }
}

export function safeParseSplitMeta(raw: unknown): {
  success: boolean;
  data?: SplitMetaInput;
  error?: z.ZodError;
} {
  const result = SplitMetaSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
