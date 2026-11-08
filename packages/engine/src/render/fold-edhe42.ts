/**
 * edh-e-42 (Commander coordinator E, library 3/3): the folds of its templates (parser/templates/zz-cloud/edh-e-42.json), called from render/fold.ts#foldAt. Each applies only
 * when every part is exactly what the idiom says.
 */
import type { EffectStep } from '../types/ability';
import { acting } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { bind, handChoiceFromIt } from './steps-util';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const plainMove = (s: EffectStep | undefined): s is Extract<EffectStep, { op: 'move' }> =>
  s?.op === 'move' && s.guard === undefined && s.as === undefined && s.until === undefined && s.link === undefined && s.remember === undefined;

/**
 * `mayPutHandCardBfYours` (CR 701.20a, 701.20e, 608.2d, 110.2; Treacherous Urge, eff.edhe42.hand.mayPutChosen.bfYourControl): after a revealed hand, "You may put a creature card from it onto
 * the battlefield under your control.": you choose at most one card of that hand and it enters under YOUR control; later "That creature" names it.
 */
function mayPutHandCardBfYours(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  if (a?.op !== 'chooseObjects' || !plainMove(b) || a.guard !== undefined || typeof a.as !== 'string') return null;
  if (!same(a.who, { ref: 'you' }) || a.min !== 0 || a.max !== 1 || a.random === true || !same(b.what, { ref: 'bound', name: a.as })) return null;
  if (!same(b.to, { zone: 'battlefield', controller: { ref: 'you' } })) return null;
  const inHand = handChoiceFromIt(a, st);
  if (inHand === null) return null;
  const desc = (a.from as { filter: { anyOf?: Parameters<typeof K.nounsOf>[0][] } }).filter.anyOf?.[0];
  bind(st, a.as, { nouns: [...new Set([...(desc === undefined ? [] : K.nounsOf(desc)), 'permanent'])], plural: false, optional: true });
  const text = `you may put ${inHand} onto the battlefield under your control`;
  return { clauses: [acting('you', text, text, { closesScope: true })], consumed: 2 };
}

export function foldEdhE42(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return mayPutHandCardBfYours(list, i, st);
}
