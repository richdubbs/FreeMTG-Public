/**
 * Commander round edh-d-110: the folds of the steps its templates build (render/fold.ts#foldAt tries `foldEdhD110` with the other rounds' own-shape folds). A fold applies only
 * when every part is exactly what the idiom says.
 *
 * `revealUntilLandDamageDoubleIfMountain` (CR 701.20a, 701.20b, 120.3, 608.2c, 608.2h, 401.4; Goblin Charbelcher, eff.edhd110.revealUntilLand.damageNonland.doubleIfMountain.bottomAnyOrder):
 * "Reveal cards from the top of your library until you reveal a land card. ~ deals damage equal to the number of nonland cards revealed this way to any target. If the revealed land
 * card was a Mountain, ~ deals double that damage instead. Put the revealed cards on the bottom of your library in any order.": the reveal, then the damage to the one target, twice as
 * much when the card it stopped at is a Mountain, then every card revealed on the bottom in an order you choose.
 */
import type { EffectStep, ObjRef } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const keys = (o: object, allowed: readonly string[]): boolean => Object.keys(o).every((k) => allowed.includes(k));

function revealUntilLandDamageDoubleIfMountain(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b, c] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'revealUntil' || b?.op !== 'if' || c?.op !== 'move') return null;
  if (!keys(a, ['op', 'who', 'filter', 'as', 'revealed']) || !same(a.who, { ref: 'you' }) || !same(a.filter, { types: ['Land'] }) || typeof a.as !== 'string' || typeof a.revealed !== 'string') return null;
  if (!keys(b, ['op', 'cond', 'then', 'else']) || !same(b.cond, { cond: 'matches', object: { ref: 'bound', name: a.as }, filter: { subtypes: ['Mountain'], isCard: true } })) return null;
  const count = { q: 'count', of: { ref: 'each', filter: { notTypes: ['Land'], is: { ref: 'bound', name: a.revealed }, zone: 'library' } } };
  const [d2, d1] = [b.then[0], b.else?.[0]];
  if (b.then.length !== 1 || b.else?.length !== 1 || d2?.op !== 'damage' || d1?.op !== 'damage') return null;
  if (!keys(d1, ['op', 'source', 'to', 'amount']) || !keys(d2, ['op', 'source', 'to', 'amount']) || !same(d1.source, { ref: 'self' }) || !same(d2.source, { ref: 'self' })) return null;
  if (!same(d1.amount, count) || !same(d2.amount, { q: 'math', op: '*', args: [2, count] }) || !same(d1.to, d2.to) || (d1.to as { ref?: string }).ref !== 'target') return null;
  if (!keys(c, ['op', 'what', 'to']) || !same(c.what, { ref: 'each', filter: { is: { ref: 'bound', name: a.revealed }, zone: 'library' } }) || !same(c.to, { zone: 'library', position: 'bottom', order: 'chosen' })) return null;
  const target = K.obj(d1.to as ObjRef, st, 'object').text;
  if (target !== 'any target') return null;
  return {
    clauses: [plain(`reveal cards from the top of your library until you reveal a land card. ~ deals damage equal to the number of nonland cards revealed this way to any target. if the revealed land card was a mountain, ~ deals double that damage instead. put the revealed cards on the bottom of your library in any order`, { standalone: true })],
    consumed: 3,
  };
}

/** The folds of edh-d-110 (render/fold.ts#foldAt). */
export function foldEdhD110(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return revealUntilLandDamageDoubleIfMountain(list, i, st);
}
