export type AttributionModel = "first-touch" | "last-touch" | "linear" | "position-based" | "time-decay";
export type TouchpointType = "visit" | "payment-method";

export interface PaymentTouchpoint {
  id: string;
  invoiceId: string;
  timestamp: number;
  channel: string;
  source?: string;
  medium?: string;
  campaign?: string;
  type: TouchpointType;
}

export interface PaymentConversion {
  id: string;
  invoiceId: string;
  timestamp: number;
  amount: number;
  currency: string;
  channel: string;
  txHash?: string;
}

export interface ChannelAttribution {
  channel: string;
  attributedConversions: number;
  attributedRevenue: number;
  share: number;
}

export interface AttributionSummary {
  model: AttributionModel;
  totalConversions: number;
  totalRevenue: number;
  channels: ChannelAttribution[];
}

const TOUCHPOINTS_KEY = "stellarsplit_payment_touchpoints_v1";
const CONVERSIONS_KEY = "stellarsplit_payment_conversions_v1";

function readStored<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeStored<T>(key: string, values: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("payment-attribution-updated"));
  } catch {
    // Attribution is best-effort and must not affect payment completion.
  }
}

function normalizeSource(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
}

export function classifyAttributionChannel(input: {
  source?: string;
  medium?: string;
  referrer?: string;
}): string {
  const source = normalizeSource(input.source ?? "");
  const medium = normalizeSource(input.medium ?? "");
  const referrer = input.referrer ?? "";
  if (source) {
    if (/^(cpc|ppc|paid|display|paid-social)$/.test(medium)) return "paid";
    if (/^(email|newsletter)$/.test(medium)) return "email";
    if (/^(social|social-media)$/.test(medium)) return "social";
    return source;
  }
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (/google\.|bing\.|duckduckgo\./.test(host)) return "organic-search";
    if (/facebook\.|instagram\.|linkedin\.|t\.co$|twitter\./.test(host)) return "social";
    return host.replace(/^www\./, "");
  } catch {
    return "referral";
  }
}

export function getPaymentTouchpoints(): PaymentTouchpoint[] {
  return readStored<PaymentTouchpoint>(TOUCHPOINTS_KEY);
}

export function getPaymentConversions(): PaymentConversion[] {
  return readStored<PaymentConversion>(CONVERSIONS_KEY);
}

export function recordPaymentTouchpoint(
  input: Omit<PaymentTouchpoint, "id">,
): PaymentTouchpoint {
  const touchpoint: PaymentTouchpoint = {
    ...input,
    id: `${input.invoiceId}-${input.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const touchpoints = getPaymentTouchpoints();
  writeStored(TOUCHPOINTS_KEY, [...touchpoints, touchpoint].slice(-5000));
  return touchpoint;
}

export function captureInvoiceTouchpoint(
  invoiceId: string,
  href: string,
  referrer = "",
  timestamp = Date.now(),
): PaymentTouchpoint {
  const url = new URL(href);
  const source = url.searchParams.get("utm_source") ?? undefined;
  const medium = url.searchParams.get("utm_medium") ?? undefined;
  const campaign = url.searchParams.get("utm_campaign") ?? undefined;
  return recordPaymentTouchpoint({
    invoiceId,
    timestamp,
    channel: classifyAttributionChannel({ source, medium, referrer }),
    source,
    medium,
    campaign,
    type: "visit",
  });
}

export function recordPaymentConversion(input: Omit<PaymentConversion, "id">): PaymentConversion {
  const conversions = getPaymentConversions();
  const existing = conversions.find((conversion) =>
    input.txHash ? conversion.txHash === input.txHash : conversion.invoiceId === input.invoiceId && conversion.timestamp === input.timestamp,
  );
  if (existing) return existing;
  const conversion: PaymentConversion = {
    ...input,
    id: input.txHash ?? `${input.invoiceId}-${input.timestamp}`,
  };
  writeStored(CONVERSIONS_KEY, [...conversions, conversion].slice(-5000));
  return conversion;
}

function weightsForTouchpoints(touchpoints: PaymentTouchpoint[], model: AttributionModel, timestamp: number): number[] {
  if (touchpoints.length === 0) return [];
  if (model === "first-touch") return touchpoints.map((_, index) => Number(index === 0));
  if (model === "last-touch") return touchpoints.map((_, index) => Number(index === touchpoints.length - 1));
  if (model === "position-based") {
    if (touchpoints.length === 1) return [1];
    if (touchpoints.length === 2) return [0.5, 0.5];
    return touchpoints.map((_, index) =>
      index === 0 || index === touchpoints.length - 1 ? 0.4 : 0.2 / (touchpoints.length - 2),
    );
  }
  if (model === "time-decay") {
    const rawWeights = touchpoints.map((touchpoint) =>
      Math.pow(2, -Math.max(0, timestamp - touchpoint.timestamp) / (7 * 24 * 60 * 60 * 1000)),
    );
    const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
    return rawWeights.map((weight) => weight / total);
  }
  return touchpoints.map(() => 1 / touchpoints.length);
}

export function summarizeAttribution(
  conversions: PaymentConversion[],
  allTouchpoints: PaymentTouchpoint[],
  model: AttributionModel,
): AttributionSummary {
  const channelTotals = new Map<string, { conversions: number; revenue: number }>();
  let totalRevenue = 0;

  conversions.forEach((conversion) => {
    const touchpoints = allTouchpoints
      .filter((touchpoint) => touchpoint.invoiceId === conversion.invoiceId && touchpoint.timestamp <= conversion.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);
    const eligible = touchpoints.length > 0 ? touchpoints : [{
      id: `fallback-${conversion.id}`,
      invoiceId: conversion.invoiceId,
      timestamp: conversion.timestamp,
      channel: conversion.channel || "unattributed",
      type: "payment-method" as const,
    }];
    const weights = weightsForTouchpoints(eligible, model, conversion.timestamp);
    totalRevenue += conversion.amount;
    eligible.forEach((touchpoint, index) => {
      const current = channelTotals.get(touchpoint.channel) ?? { conversions: 0, revenue: 0 };
      const weight = weights[index];
      current.conversions += weight;
      current.revenue += conversion.amount * weight;
      channelTotals.set(touchpoint.channel, current);
    });
  });

  const channels = Array.from(channelTotals.entries())
    .map(([channel, totals]) => ({
      channel,
      attributedConversions: totals.conversions,
      attributedRevenue: totals.revenue,
      share: totalRevenue > 0 ? (totals.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  return { model, totalConversions: conversions.length, totalRevenue, channels };
}

export function compareAttributionModels(
  conversions: PaymentConversion[],
  touchpoints: PaymentTouchpoint[],
): AttributionSummary[] {
  const models: AttributionModel[] = ["first-touch", "last-touch", "linear", "position-based", "time-decay"];
  return models.map((model) => summarizeAttribution(conversions, touchpoints, model));
}