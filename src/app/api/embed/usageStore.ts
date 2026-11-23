export interface EmbedUsageEvent {
  creator: string;
  tokenId: string;
  timestamp: number;
}

const usageEvents: EmbedUsageEvent[] = [];

export function recordEmbedUsage(event: EmbedUsageEvent): void {
  usageEvents.push(event);
  if (usageEvents.length > 10_000) usageEvents.splice(0, usageEvents.length - 10_000);
}

export function getEmbedUsage(creator: string): EmbedUsageEvent[] {
  return usageEvents.filter((event) => event.creator === creator);
}