/**
 * edh-d-112 (Commander coordinator D, groups counters 1/3 and 2/3): the folds of its templates (parser/templates/zz-cloud/edh-d-112.json), called from render/fold.ts#foldAt. As every
 * fold, one applies only when every part is exactly what the idiom says. No value import of render/fold.ts (an import cycle).
 */
import type { EffectStep, ObjectFilter } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { numWord } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Storyweave (CR 614.1c, 614.12, 122.6; template eff.edhd112.nextTime.enter.additionalCounters): "The next time one or more enchantment creatures you control enter this turn, each enters
 * with two additional +1/+1 counters on it.": one `effect` step of exactly one batch shield that lasts this turn, a group of entering permanents, a fixed number of counters of one kind.
 */
function nextEnterWithCounters(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const e = list[i];
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || !same(e.duration, { d: 'endOfTurn' })) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined || !same(r.shield, { uses: 1, batch: true })) return null;
  const rep = r.replaces;
  if (rep.ev !== 'zoneChange' || rep.to !== 'battlefield' || Object.keys(rep).length !== 3 || rep.subject === undefined || (rep.subject as { self?: unknown }).self !== undefined) return null;
  const b = r.body;
  if (b.b !== 'enters' || Object.keys(b).length !== 2 || b.counters?.length !== 1) return null;
  const c = b.counters[0]!;
  if (typeof c.count !== 'number' || c.count < 1 || Object.keys(c).length !== 2) return null;
  const group = K.np(rep.subject as ObjectFilter, st, { det: 'none', plural: true });
  const n = c.count === 1 ? 'an' : numWord(c.count);
  return { clauses: [plain(`the next time one or more ${group} enter this turn, each enters with ${n} additional ${c.kind} counter${c.count === 1 ? '' : 's'} on it`)], consumed: 1 };
}

/** The folds of edh-d-112 (render/fold.ts#foldAt). */
export function foldEdhD112(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return nextEnterWithCounters(list, i, st);
}
