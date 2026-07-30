/**
 * A saved combination of invoice dashboard filters + sort order.
 * `filters` mirrors the dashboard's URL query params (preset/status/sort/
 * from/to/tag) verbatim so applying a preset is just writing it back to the
 * URL — no separate serialization format to keep in sync.
 */
export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

export const FILTER_PRESET_NAME_MAX_LENGTH = 40;
