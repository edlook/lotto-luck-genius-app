/**
 * Joins class names, skipping falsy values: cx("a", cond && "b", undefined) → "a b".
 * No tailwind-merge: components put `className` last, so callers should add classes,
 * not fight existing ones (e.g. pass `block` instead of overriding width).
 */
export type ClassValue = string | false | null | undefined | 0;

export function cx(...values: ClassValue[]): string {
  let out = "";
  for (const v of values) if (v) out = out ? `${out} ${v}` : v;
  return out;
}
