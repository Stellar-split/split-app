export interface RateCardItem {
  id: string;
  service: string;
  rate: number;
  unit: "hour" | "day" | "project" | "item";
  quantity: number;
}

export function lineTotal(item: RateCardItem): number {
  return Math.max(0, item.rate) * Math.max(0, item.quantity);
}

export function rateCardTotal(items: RateCardItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function isValidItem(item: RateCardItem): boolean {
  return item.service.trim().length > 0 && item.rate > 0 && item.quantity > 0;
}

export function toLineItems(items: RateCardItem[]) {
  return items.filter(isValidItem).map((item) => ({
    description: `${item.service} (${item.quantity} ${item.unit}${item.quantity === 1 ? "" : "s"})`,
    amount: lineTotal(item),
  }));
}
