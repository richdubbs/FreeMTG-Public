/**
 * edh-d-110 (Commander round of coordinator D): small lowering helpers of its readings.
 * CR cites checked against MagicCompRules 20260925 where the record says so.
 */
import { clone, isRec } from './util';
import type { Rec } from './types';

const STEP_LISTS: ReadonlySet<string> = new Set(['then', 'else', 'do', 'otherwise', 'onWin', 'onLose']);

const isLifeLostMarker = (n: unknown): n is Rec => isRec(n) && n['q'] === 'lifeLost' && n['$step'] !== undefined;

/**
 * The step right before the one holding a node at `parts`, in the DEEPEST step list that holds it, or null when the node is in no step list or its step is the
 * first of its list.
 */
function stepBefore(top: unknown, parts: readonly string[]): Rec | null {
  let last = -1;
  parts.forEach((x, k) => { if (STEP_LISTS.has(x) && /^\d+$/.test(parts[k + 1] ?? '')) last = k; });
  if (last < 0) return null;
  const at = Number(parts[last + 1]);
  if (at < 1) return null;
  let cur: unknown = top;
  for (const x of parts.slice(0, last + 1)) {
    if (Array.isArray(cur)) cur = cur[Number(x)];
    else if (isRec(cur)) cur = cur[x];
    else return null;
  }
  if (!Array.isArray(cur)) return null;
  const prev = cur[at - 1];
  return isRec(prev) ? prev : null;
}

/**
 * CR 119.3, 608.2c, 603.7a (Chancellor of the Dross): "You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep, each opponent
 * loses 3 life, then you gain life equal to the life lost this way.": a static ability is not lowered as a program (lower/ability.ts#staticAbilityBase), so the marker
 * of "the life lost this way" (holes/qty.ts, `{q:'lifeLost', step:'', $step:'previous'}`) in the body of the delayed trigger is left. It names the `loseLife` step RIGHT
 * BEFORE its own step in the same step list (one plain loss of life: no `may`, no guard); the step gets an `as` name and the quantity names it, as
 * lower/conditions.ts#resolveLifeLost does for an ability's sentences. Every marker must be resolved this way; anything else is null (the ability stays manual).
 */
export function resolveStaticLifeLost(value: unknown): unknown | null {
  const out = clone(value) as unknown;
  let ok = true;
  let found = false;
  let n = 0;
  const walk = (v: unknown, parts: string[]): void => {
    if (!ok) return;
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...parts, String(i)])); return; }
    if (!isRec(v)) return;
    if (isLifeLostMarker(v)) {
      found = true;
      const prev = stepBefore(out, parts);
      if (prev === null || prev['op'] !== 'loseLife' || prev['guard'] !== undefined || v['who'] !== undefined) { ok = false; return; }
      if (typeof prev['as'] !== 'string') prev['as'] = `lost110_${n++}`;
      for (const k of Object.keys(v)) delete v[k];
      v['q'] = 'lifeLost';
      v['step'] = prev['as'];
      return;
    }
    for (const [k, x] of Object.entries(v)) walk(x, [...parts, k]);
  };
  walk(out, []);
  return ok && found ? out : null;
}
