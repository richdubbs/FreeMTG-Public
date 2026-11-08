/**
 * edh-e-11 (Commander coordinator E, group library 3/3, code edhe11): the folds of its templates (parser/templates/zz-cloud/edh-e-11.json), called from render/fold.ts#foldAt.
 *
 * `returnMayPutTopInstead` (CR 614.15, 608.2c, 608.2d, 401.4; Expel from Orazca, Sweep Away, Ether Well): "Return target nonland permanent to its owner's hand. If you have the city's blessing, you may put that
 * permanent on top of its owner's library instead." The parser's rider rid.edhe11.instead.mayPutTop.if puts "you may put the target on top of its owner's library" (guarded by C, recording
 * whether it was done) right before the move of the same object to its owner's hand, which then runs only if that was not done (riders.ts, `@before` with `@guardPrevious`). Only that exact shape.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { alt } from './text';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function returnMayPutTopInstead(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [may, hand] = [list[i], list[i + 1]];
  if (may?.op !== 'may' || may.guard === undefined || may.as === undefined || !same(may.who, { ref: 'you' }) || may.do.length !== 1 || may.otherwise !== undefined || may.anyOne !== undefined || may.villainous !== undefined || may.gather !== undefined) return null;
  const top = may.do[0]!;
  if (top.op !== 'move' || top.what.ref !== 'target' || top.as !== undefined || top.guard !== undefined || top.until !== undefined || top.link !== undefined || top.remember !== undefined) return null;
  // the object is returned to its owner's hand and may go on top of the library instead, or is put on top of the library and may go to the bottom instead
  const place = same(top.to, { zone: 'library', position: 'top' }) ? 'on top' : same(top.to, { zone: 'library', position: 'bottom' }) ? 'on the bottom' : null;
  if (place === null) return null;
  if (hand?.op !== 'move' || !same(hand.what, top.what) || hand.as !== undefined || !same(hand.guard, { cond: 'did', step: may.as, not: true }) || hand.until !== undefined || hand.link !== undefined || hand.remember !== undefined) return null;
  if (!same(hand.to, place === 'on top' ? { zone: 'hand' } : { zone: 'library', position: 'top' })) return null;
  const head = K.steps([{ ...hand, guard: undefined }], st);
  const cond = K.cond(may.guard, st);
  const that = K.obj(top.what, st, 'object').text;
  return { clauses: [plain(`${head}. if ${cond}, you may put ${alt(that, 'it')} ${place} of its owner's library instead`, { standalone: true })], consumed: 2 };
}

/**
 * `revealThenDrawForEachLandAndColor` (CR 701.20a, 402.3, 121.1, 608.2c; Baleful Stare, Withering Gaze): "Target opponent reveals their hand. You draw a card for each Mountain and red card
 * in it." The reveal of a player's hand and your draw of one card for each card of that hand that is of the land subtype OR of the color (a card of both counts once). Only that exact shape.
 */
function revealThenDrawForEachLandAndColor(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [rev, draw] = [list[i], list[i + 1]];
  if (rev?.op !== 'reveal' || rev.guard !== undefined || rev.as !== undefined || rev.what.ref !== 'each' || rev.to !== undefined || rev.anyNumber !== undefined) return null;
  if (draw?.op !== 'draw' || draw.guard !== undefined || draw.as !== undefined || !same(draw.who, { ref: 'you' }) || draw.count === undefined || typeof draw.count !== 'object' || draw.count.q !== 'count') return null;
  const of = draw.count.of as any;
  const f = of?.filter;
  if (of?.ref !== 'each' || f === undefined || Object.keys(f).sort().join() !== 'anyOf,isCard,owner,zone' || f.zone !== 'hand' || f.isCard !== true || !same(f.owner, (rev.what as any).filter?.owner) || !same(f.owner, rev.who) || (rev.who as { ref: string }).ref !== 'target') return null;
  const any = f.anyOf as any[];
  if (!Array.isArray(any) || any.length !== 2 || Object.keys(any[0]).join() !== 'subtypes' || Object.keys(any[1]).join() !== 'colors' || any[0].subtypes.length !== 1 || any[1].colors.length !== 1) return null;
  const color = ({ R: 'red', G: 'green' } as Record<string, string>)[any[1].colors[0]];
  const land = any[0].subtypes[0] as string;
  if (color === undefined || !((land === 'Mountain' && color === 'red') || (land === 'Forest' && color === 'green'))) return null;
  const head = K.steps([rev], st);
  return { clauses: [plain(`${head}. you draw 1 card for each ${land.toLowerCase()} and ${color} card in it`, { standalone: true })], consumed: 2 };
}

export function foldEdhE11(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return returnMayPutTopInstead(list, i, st) ?? revealThenDrawForEachLandAndColor(list, i, st);
}
