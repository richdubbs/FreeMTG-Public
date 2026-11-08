/**
 * edh-e-41 (Commander coordinator E, group library 2/3): the folds of its templates (parser/templates/zz-cloud/edh-e-41.json), called from render/fold.ts#foldAt.
 *
 * `revealXFromHand` (CR 107.3, 701.20a, 402.3, 608.2d, 608.2h; Nightshade Assassin): "you may reveal X black cards in your hand" (inside the `may`): your choice of any number (none
 * included) of the cards of a description in your hand and their reveal, named `revealedX`: the X of the later sentences is its count (parser/lower/edhd90.ts#bindSacrificedX
 * rewrites them to `resultCount`, which render/qty.ts says "x"). Only that exact shape.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { bind } from './steps-util';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function revealXFromHand(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  if (a?.op !== 'chooseObjects' || b?.op !== 'reveal' || a.as === undefined || b.as !== 'revealedX') return null;
  if (a.guard !== undefined || a.random !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined) return null;
  if (!same(a.who, { ref: 'you' }) || a.min !== 0 || a.max !== 'any' || a.from.ref !== 'each' || !('filter' in a.from)) return null;
  const f = a.from.filter;
  if (f.zone !== 'hand' || f.owner !== 'you' || f.anyOf?.length !== 1 || Object.keys(f).some((k) => k !== 'zone' && k !== 'owner' && k !== 'anyOf')) return null;
  if (b.guard !== undefined || b.to !== undefined || !same(b.who, { ref: 'you' }) || !same(b.what, { ref: 'bound', name: a.as }) || Object.keys(b).some((k) => !['op', 'who', 'what', 'as'].includes(k))) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null; // only the reveal's own name is read afterwards
  const cards = K.np({ ...f.anyOf[0]!, zone: 'hand' }, st, { det: 'none', plural: true, noZone: true });
  st.info.set(`r:${b.as}`, { nouns: ['card'], plural: true, thisWay: 'revealed this way', xWord: true });
  bind(st, b.as, { nouns: ['card'], plural: true, hand: true });
  return { clauses: [plain(`reveal x ${cards} in your hand`, { standalone: true })], consumed: 2 };
}

export function foldEdhE41(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return revealXFromHand(list, i, st);
}
