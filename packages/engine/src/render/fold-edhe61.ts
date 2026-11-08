/**
 * edh-e-61 render folds: shapes only this round's templates build (parser/templates/zz-cloud/edh-e-61.json). Each returns null for any other shape, so the general renderers then say it
 * or refuse. No value is imported from render/fold.ts (it imports this file).
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const LINK = { ref: 'linked', link: 'exiled' };

/**
 * edh-e-61 (CR 406.3, 607.2a, 701.40a, 110.2a, 400.7; Clone Shell, Summoner's Egg, eff.edhe61.linked.turnFaceUp.ifTypePutOntoBattlefield): "Turn the exiled card face up. If it's a creature
 * card, put it onto the battlefield under your control.": the card exiled face down with the source is turned face up in exile, then, when it is a card of that type, it is put onto the
 * battlefield under your control (it is a new object, so a card that is not a permanent card never enters). Only that exact shape: one card type word, the test of the cards exiled with the source.
 */
function linkedTurnFaceUpIfTypePut(list: EffectStep[], i: number, _st: RenderState): Folded | null {
  const [up, cond] = [list[i], list[i + 1]];
  if (!same(up, { op: 'changeFace', what: LINK, to: 'faceUp', inExile: true }) || cond?.op !== 'if') return null;
  const types = (cond.cond as { left?: { of?: { filter?: { types?: unknown } } } }).left?.of?.filter?.types;
  if (!Array.isArray(types) || types.length !== 1 || typeof types[0] !== 'string') return null;
  const test = { cond: 'compare', left: { q: 'count', of: { ref: 'each', filter: { zone: 'exile', is: LINK, types } } }, op: '>=', right: 1 };
  if (!same(cond, { op: 'if', cond: test, then: [{ op: 'move', what: LINK, to: { zone: 'battlefield', controller: { ref: 'you' } } }] })) return null;
  const w = types[0].toLowerCase();
  return { clauses: [plain(`turn the exiled card face up. if it's ${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w} card, put it onto the battlefield under your control`, { standalone: true })], consumed: 2 };
}

export function foldEdhE61(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return linkedTurnFaceUpIfTypePut(list, i, st);
}
