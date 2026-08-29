"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getFreighterPublicKey } from "@/lib/freighter";
import {
  ALLOWED_LOGO_MIME_TYPES,
  brandSettingsSchema,
  DEFAULT_ACCENT_COLOR,
  isAllowedLogoMimeType,
  isLogoSizeOk,
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  MAX_LOGO_BYTES,
  MAX_TAGLINE_LENGTH,
  type BrandSettingsInput,
  type BrandSettingsOutput,
} from "@/lib/brandSettings";
import { checkContrast, isValidHexColor } from "@/lib/contrast";
import {
  clearBrandSettingsRemote,
  fetchBrandSettings,
  saveBrandSettingsRemote,
  uploadBrandLogo,
} from "@/lib/branding";

const EMPTY_VALUES = { logoUrl: "", accentColor: "", tagline: "" } as const;

const MAX_LOGO_MB = MAX_LOGO_BYTES / (1024 * 1024);

/**
 * Account branding editor for /settings/branding.
 *
 * - react-hook-form + zod (brandSettingsSchema) validated on change
 * - logo uploads are pre-validated for MIME type and the 2 MB cap BEFORE any
 *   request is made, so the server is only ever called with acceptable files
 * - accent color previews in real time and flags colors that fail WCAG AA
 *   contrast against white both as an inline warning and as a submit blocker
 */
export default function BrandingForm() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoWarning, setLogoWarning] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandSettingsInput, unknown, BrandSettingsOutput>({
    resolver: zodResolver(brandSettingsSchema),
    mode: "onChange",
    defaultValues: { ...EMPTY_VALUES },
  });

  useEffect(() => {
    let cancelled = false;
    getFreighterPublicKey()
      .then(async (key) => {
        if (cancelled) return;
        setAddress(key);
        const settings = await fetchBrandSettings(key);
        if (cancelled) return;
        reset({
          logoUrl: settings.logoUrl ?? "",
          accentColor: settings.accentColor ?? "",
          tagline: settings.tagline ?? "",
        });
      })
      .catch(() => {
        // wallet not connected — the form stays disabled with guidance
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const logoUrl = watch("logoUrl") ?? "";
  const accentColor = watch("accentColor") ?? "";
  const tagline = watch("tagline") ?? "";

  // Real-time contrast feedback: warn inline as soon as the typed/picked
  // color fails WCAG AA against white — before the user even hits save.
  const liveContrast =
    accentColor && isValidHexColor(accentColor) ? checkContrast(accentColor, "#ffffff") : null;
  const previewAccent =
    accentColor && isValidHexColor(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR;

  const handleLogoSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input so re-selecting the same file re-triggers onChange.
      event.target.value = "";
      if (!file || !address) return;

      setLogoError(null);
      setLogoWarning(null);
      setFeedback(null);

      // Client-side pre-validation with specific messages — invalid files are
      // rejected here and never reach the network.
      if (!isAllowedLogoMimeType(file.type)) {
        setLogoError(LOGO_TYPE_ERROR);
        return;
      }
      if (!isLogoSizeOk(file.size)) {
        setLogoError(LOGO_SIZE_ERROR);
        return;
      }

      setLogoUploading(true);
      try {
        const result = await uploadBrandLogo(address, file);
        setValue("logoUrl", result.logoUrl, { shouldDirty: true, shouldValidate: true });
        setLogoWarning(result.warning);
      } catch (err) {
        setLogoError(err instanceof Error ? err.message : "Logo upload failed");
      } finally {
        setLogoUploading(false);
      }
    },
    [address, setValue],
  );

  const onSubmit = handleSubmit(async (data: BrandSettingsOutput) => {
    if (!address) return;
    setFeedback(null);
    try {
      const saved = await saveBrandSettingsRemote(address, {
        logoUrl: data.logoUrl ?? null,
        accentColor: data.accentColor ?? null,
        tagline: data.tagline ?? null,
      });
      reset({
        logoUrl: saved.logoUrl ?? "",
        accentColor: saved.accentColor ?? "",
        tagline: saved.tagline ?? "",
      });
      setFeedback({ kind: "success", text: "Branding saved — it now applies to all of your invoices." });
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Could not save branding" });
    }
  });

  const handleRemoveBranding = useCallback(async () => {
    if (!address) return;
    setRemoving(true);
    setFeedback(null);
    try {
      await clearBrandSettingsRemote(address);
      reset({ ...EMPTY_VALUES });
      setLogoError(null);
      setLogoWarning(null);
      setFeedback({ kind: "success", text: "Branding removed — invoices revert to platform-default styling." });
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Could not remove branding" });
    } finally {
      setRemoving(false);
    }
  }, [address, reset]);

  if (loading) {
    return (
      <p className="text-sm text-gray-400" role="status">
        Loading your branding settings…
      </p>
    );
  }

  if (!address) {
    return (
      <p className="rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm text-gray-300" role="alert">
        Connect your Freighter wallet to manage the branding for your account.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="branding-logo-heading">
        <h2 id="branding-logo-heading" className="text-lg font-semibold mb-1">
          Company logo
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Shown on your invoice page and PDF export. PNG, JPEG, or WebP up to {MAX_LOGO_MB} MB —
          at least 600 px wide for sharp 300&nbsp;dpi print.
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          {logoUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-white/95 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied CDN URL */}
              <img src={logoUrl} alt="Your logo" className="h-10 w-auto max-w-[160px] object-contain" />
            </div>
          ) : (
            <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-gray-600 text-xs text-gray-500">
              No logo
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="branding-logo-input"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-gray-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500"
            >
              {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </label>
            <input
              id="branding-logo-input"
              type="file"
              accept={ALLOWED_LOGO_MIME_TYPES.join(",")}
              disabled={logoUploading}
              onChange={handleLogoSelected}
              className="sr-only"
              aria-describedby="branding-logo-hint branding-logo-error"
            />
            <p id="branding-logo-hint" className="text-xs text-gray-500">
              Files are checked for type and size before uploading.
            </p>
          </div>

          {logoUrl && (
            <button
              type="button"
              onClick={() => setValue("logoUrl", "", { shouldDirty: true, shouldValidate: true })}
              className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-300"
            >
              Remove logo
            </button>
          )}
        </div>

        {logoError && (
          <p id="branding-logo-error" role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {logoError}
          </p>
        )}
        {logoWarning && !logoError && (
          <p role="status" className="mt-3 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
            {logoWarning}
          </p>
        )}
        {errors.logoUrl && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {errors.logoUrl.message}
          </p>
        )}
      </section>

      {/* ── Accent color ─────────────────────────────────────────────────── */}
      <section aria-labelledby="branding-accent-heading">
        <h2 id="branding-accent-heading" className="text-lg font-semibold mb-1">
          Accent color
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Used for your invoice heading and table headers. Must meet WCAG AA contrast (4.5:1) against white so it stays readable on invoices.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick accent color"
            value={isValidHexColor(accentColor) && accentColor.length === 7 ? accentColor : DEFAULT_ACCENT_COLOR}
            onChange={(e) => setValue("accentColor", e.target.value, { shouldDirty: true, shouldValidate: true })}
            className="h-11 w-14 cursor-pointer rounded-lg border border-gray-700 bg-gray-800 p-1"
          />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={DEFAULT_ACCENT_COLOR}
            aria-label="Accent color hex value"
            aria-invalid={Boolean(errors.accentColor)}
            className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            {...register("accentColor")}
          />
          {accentColor && (
            <button
              type="button"
              onClick={() => setValue("accentColor", "", { shouldDirty: true, shouldValidate: true })}
              className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-300"
            >
              Use platform default
            </button>
          )}
        </div>

        {liveContrast && !liveContrast.passes && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
            ⚠ This color fails WCAG AA contrast against white ({liveContrast.ratio.toFixed(2)}:1 — needs 4.5:1).
            It will be hard to read on invoices.
          </p>
        )}
        {errors.accentColor && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {errors.accentColor.message}
          </p>
        )}
      </section>

      {/* ── Tagline ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="branding-tagline-heading">
        <h2 id="branding-tagline-heading" className="text-lg font-semibold mb-1">
          Tagline
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          A short line shown under your invoice header.
        </p>
        <input
          type="text"
          maxLength={MAX_TAGLINE_LENGTH}
          placeholder="e.g. Fast, fair splits for every project"
          aria-label="Invoice tagline"
          aria-invalid={Boolean(errors.tagline)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          {...register("tagline")}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.tagline ? (
            <p role="alert" className="text-sm text-red-400">
              {errors.tagline.message}
            </p>
          ) : (
            <span />
          )}
          <p className="text-xs text-gray-500" aria-live="polite">
            {tagline.length}/{MAX_TAGLINE_LENGTH}
          </p>
        </div>
      </section>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <section aria-labelledby="branding-preview-heading" aria-live="polite">
        <h2 id="branding-preview-heading" className="text-lg font-semibold mb-3">
          Invoice preview
        </h2>
        <div className="rounded-xl bg-white p-5 text-gray-900 shadow-lg">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-supplied CDN URL
              <img src={logoUrl} alt="Logo preview" className="h-10 w-auto max-w-[140px] object-contain" />
            ) : (
              <span aria-hidden="true" className="text-2xl" style={{ color: previewAccent }}>
                ✦
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight" style={{ color: previewAccent }}>
                Invoice
              </p>
              {tagline ? (
                <p className="truncate text-sm text-gray-600">{tagline}</p>
              ) : (
                <p className="text-sm italic text-gray-400">Your tagline appears here</p>
              )}
            </div>
          </div>
          <div
            className="mt-4 flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: previewAccent }}
          >
            <span>Recipient</span>
            <span>Amount</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 text-xs text-gray-700">
            <span>GABC…XYZ</span>
            <span>1,250.00 USDC</span>
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Preview updates in real time as you edit.
          </p>
        </div>
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === "error"
              ? "border-red-800 bg-red-950/40 text-red-400"
              : "border-green-800 bg-green-950/40 text-green-400"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save branding"}
        </button>
        <button
          type="button"
          onClick={handleRemoveBranding}
          disabled={removing || isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove branding"}
        </button>
        <p className="text-xs text-gray-500">
          Branding applies to every invoice created by {address.slice(0, 6)}…{address.slice(-4)}.
        </p>
      </div>
    </form>
  );
}
