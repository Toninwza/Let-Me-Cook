import type { ProductHit } from "./api";

/** Up to n in-stock products, taking one category at a time so a showcase is not all chairs. */
export function pickVaried(products: ProductHit[], n: number): ProductHit[] {
  const byCategory = new Map<string, ProductHit[]>();
  for (const p of products) {
    if (p.stock <= 0) continue;
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }
  const queues = [...byCategory.values()];
  const out: ProductHit[] = [];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && out.length < n) out.push(next);
    }
  }
  return out;
}
