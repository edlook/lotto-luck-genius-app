/** Text entry of numbers for grids and manual draw entry. */
export type ParseError = { key: string; params: Record<string, string | number> };

/** Parses "3 14, 22.31" into numbers; reports the first problem. */
export function parseNumberList(text: string, pool: number, required: number): { numbers: number[]; error: ParseError | null } {
  const parts = text.split(/[\s,.;]+/).filter(Boolean);
  const numbers: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,2}$/.test(p)) return { numbers, error: { key: "evaluate.error.notNumber", params: { value: p } } };
    const n = Number(p);
    if (n < 1 || n > pool) return { numbers, error: { key: "evaluate.error.range", params: { n, min: 1, max: pool } } };
    if (numbers.includes(n)) return { numbers, error: { key: "evaluate.error.duplicate", params: { n } } };
    numbers.push(n);
  }
  if (numbers.length > required) return { numbers, error: { key: "evaluate.error.tooMany", params: { required } } };
  return { numbers, error: null };
}
