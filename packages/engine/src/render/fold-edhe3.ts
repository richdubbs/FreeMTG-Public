/**
 * edh-e-3 (Commander coordinator E, dice-random): the folds of its templates (parser/templates/zz-cloud/edh-e-3.json), called from render/fold.ts#foldAt.
 *
 * `chooseNameRevealRandom` (CR 701.20a, 608.2d, 201.2; Cursed Scroll, Magus of the Scroll): "Choose a card name, then reveal a card at random from your hand." The player chooses a
 * card name (linked for "the chosen name"), then the game picks one card of their hand at random and they reveal it. Exactly the three steps of template eff.edhe3.chooseName.revealRandomHand.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import type { RenderState } from './state';
import { bind } from './steps-util';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function chooseNameRevealRandom(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  const b = list[i + 1];
  const c = list[i + 2];
  if (a?.op !== 'chooseValue' || a.what !== 'cardName' || a.who.ref !== 'you' || a.guard !== undefined || a.random !== undefined || a.secret !== undefined || a.link === undefined || a.as === undefined) return null;
  if (b?.op !== 'chooseObjects' || b.random !== true || b.guard !== undefined || b.as === undefined || b.min !== 1 || b.max !== 1 || b.who.ref !== 'you' || b.link !== undefined
    || !same(b.from, { ref: 'each', filter: { zone: 'hand', owner: { ref: 'you' } } })) return null;
  if (c?.op !== 'reveal' || c.guard !== undefined || c.who.ref !== 'you' || !same(c.what, { ref: 'bound', name: b.as })) return null;
  bind(st, a.as, { nouns: ['name'], plural: false });
  bind(st, b.as, { nouns: ['card'], plural: false });
  return { clauses: [plain('choose a card name, then reveal a card at random from your hand', { standalone: true })], consumed: 3 };
}

export function foldEdhE3(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return chooseNameRevealRandom(list, i, st);
}
