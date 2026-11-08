/**
 * edh-e-58 (Commander coordinator E, second batch, group enters-leaves): the folds of its templates (parser/templates/zz-cloud/edh-e-58.json), called from render/fold.ts#foldAtPlain.
 * Each applies only when every part is exactly what the idiom says.
 *
 * `opponentChoosesYourOneAndExiles` (CR 608.2d, 701.13a, 101.4, 607.2a; Wormfang Crab): "An opponent chooses a permanent you control other than ~ and exiles it.": an opponent of the
 * ability's controller picks one permanent of the description among the controller's other permanents and exiles it. The exile may carry the link "exiled" (the face pass adds it).
 */
import type { EffectStep, ObjectFilter } from '../types/ability';
import type { Folded } from './fold';
import { plain } from './clause';
import { K } from './kernel';
import type { RenderState } from './state';

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v);
/** Whole-value equality, key order aside. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function opponentChoosesYourOneAndExiles(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const c = list[i];
  const m = list[i + 1];
  if (c?.op !== 'chooseObjects' || m?.op !== 'move' || c.as === undefined || c.guard !== undefined || m.guard !== undefined || c.from.ref !== 'each' || !('filter' in c.from)) return null;
  const f = c.from.filter as ObjectFilter & { anyOf?: ObjectFilter[] };
  if (f.anyOf?.length !== 1 || !same(Object.keys(f).sort(), ['anyOf', 'controller', 'other']) || !same(f.controller, { ref: 'you' }) || f.other !== true) return null;
  if (!same(c, { op: 'chooseObjects', who: { ref: 'anOpponent' }, from: { ref: 'each', filter: f }, min: 1, max: 1, as: c.as })) return null;
  const { link, ...rest } = m as EffectStep & { link?: string };
  if (link !== undefined && link !== 'exiled') return null;
  if (!same(rest, { op: 'move', what: { ref: 'bound', name: c.as }, to: { zone: 'exile' } })) return null;
  if (JSON.stringify(list.slice(i + 2)).includes(`"name":"${c.as}"`)) return null;
  return { clauses: [plain(`an opponent chooses ${K.np(f.anyOf[0]!, st, { det: 'a' })} you control other than ~ and exiles it`, { standalone: true })], consumed: 2 };
}

export function foldEdhE58(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return opponentChoosesYourOneAndExiles(list, i, st);
}
