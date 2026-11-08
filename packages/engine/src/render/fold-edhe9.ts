/**
 * edh-e-9 (Commander effort, coordinator E, group library 1/3): the folds of its templates (parser/templates/zz-cloud/edh-e-9.json), called from render/fold.ts#foldAt.
 * Each applies only when every part is exactly what the idiom says.
 *
 * `putOneIfSameNameAsPermanent` (CR 701.20e, 608.2c-d, 201.2, 110.1; Mitotic Manipulation, eff.edhe9.dig.mayPutOne.battlefield.ifSameNameAsPermanent): "You may put one of those
 * cards onto the battlefield if it has the same name as a permanent.": you choose at most one card of the group looked at whose name is the name of a permanent on the
 * battlefield, and put it onto the battlefield under your control. Only that exact shape; the rest of the group is the next sentence.
 */
import type { EffectStep } from '../types/ability';
import { acting } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { restOfGroup } from './refs';
import type { RenderState } from './state';
import { bind } from './steps-util';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function putOneIfSameNameAsPermanent(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, m] = [list[i], list[i + 1]];
  if (a?.op !== 'chooseObjects' || m?.op !== 'move' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.min !== 0 || a.max !== 1) return null;
  if (a.random === true || a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined) return null;
  if (m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || m.remember !== undefined || !same(m.what, { ref: 'bound', name: a.as }) || !same(m.to, { zone: 'battlefield', controller: { ref: 'you' } })) return null;
  if (a.from.ref !== 'each') return null;
  const f = a.from.filter;
  if (f.is?.ref !== 'bound' || !same({ ...f, is: undefined }, { zone: 'library', sharesWith: { with: { ref: 'each', filter: { zone: 'battlefield' } }, quality: 'name' } })) return null;
  // nothing after reads the choice but the move of "the rest" of the group
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`) && !(x.op === 'move' && x.what.ref === 'each' && (restOfGroup(x.what.filter)?.chosen === a.as || same(x.what.filter.not, { is: { ref: 'bound', name: a.as } }))))) return null;
  const them = K.obj(f.is, st, 'object');
  if (!them.plural) return null;
  const text = `you may put one of ${them.text} onto the battlefield if it has the same name as a permanent`;
  bind(st, a.as, { nouns: ['card'], plural: false });
  return { clauses: [acting('you', text.replace(/^you /, ''), text, { closesScope: true })], consumed: 2 };
}

/**
 * `revealThenPutIfSameName` (CR 701.20a, 201.2, 110.1, 608.2c; Retraced Image, eff.edhe9.reveal.cardInHand.thenPutBf.ifSameNameAsPermanent): "Reveal a card in your hand, then put that
 * card onto the battlefield if it has the same name as a permanent.": you choose one card of your hand and reveal it; the card goes onto the battlefield under your control only if
 * a permanent has its name. Only that exact shape, with nothing after it reading the card.
 */
function revealThenPutIfSameName(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, r, m] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'chooseObjects' || r?.op !== 'reveal' || m?.op !== 'move' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.min !== 1 || a.max !== 1) return null;
  if (a.random === true || a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined) return null;
  if (!same(a.from, { ref: 'each', filter: { zone: 'hand', owner: { ref: 'you' } } })) return null;
  if (r.guard !== undefined || r.as !== undefined || r.to !== undefined || !same(r.who, { ref: 'you' }) || !same(r.what, { ref: 'bound', name: a.as })) return null;
  if (m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || m.remember !== undefined || !same(m.to, { zone: 'battlefield', controller: { ref: 'you' } })) return null;
  if (!same(m.what, { ref: 'each', filter: { is: { ref: 'bound', name: a.as }, zone: 'hand', sharesWith: { with: { ref: 'each', filter: { zone: 'battlefield' } }, quality: 'name' } } })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null;
  bind(st, a.as, { nouns: ['card'], plural: false });
  return { clauses: [acting('you', 'reveal a card in your hand, then put that card onto the battlefield if it has the same name as a permanent', 'you reveal a card in your hand, then put that card onto the battlefield if it has the same name as a permanent', { closesScope: true })], consumed: 3 };
}

export function foldEdhE9(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return putOneIfSameNameAsPermanent(list, i, st) ?? revealThenPutIfSameName(list, i, st);
}
