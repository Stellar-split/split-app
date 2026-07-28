/**
 * reorder — pure array-move helper shared by drag-and-drop and keyboard reordering.
 */

/**
 * Move the item at `from` to index `to`, returning a new array.
 *
 * Out-of-range indices are treated as no-ops so callers (drag handlers,
 * arrow-key handlers at the list edges) don't have to guard first. The item
 * objects themselves are never cloned or mutated, which is what keeps
 * reordering from disturbing per-recipient values such as share percentages.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items.slice();
  }

  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
