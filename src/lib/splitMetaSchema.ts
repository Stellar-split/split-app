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

export const SplitMetaSchema = z
  .object({
    totalAmount: z.number().min(0, 'Total amount must be >= 0'),
    assetCode: z.enum(['XLM', 'USDC']),
    recipients: z.array(RecipientLineSchema),
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
        path: ['recipients'],
      });
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
