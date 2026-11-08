/**
 * edh-e-10 (Commander coordinator E, library 2/3): the folds of its readings, called from render/fold.ts#foldAtPlain.
 *
 * `putRevealedBottom` (CR 701.20a, 401.4, 608.2c; Calibrated Blast, Erratic Explosion, Erratic Mutation; parser/lower/mentions.ts#revealedAllOf): after YOUR "reveal cards from the top of
 * your library until you reveal <a card>", "Put the revealed cards on the bottom of your library in a random order / in any order.": the move of every card that reveal revealed
 * (the card it stopped at included), still in the library, to the bottom of your library. Read at the move, whatever steps lie between it and the reveal. Only that move, in the
 * library, with the reveal's own `revealed` name, a random or a chosen order.
 */
import type { EffectStep } from '../types/ability';
import { acting, plain } from './clause';
import { K } from './kernel';
import type { Folded } from './fold';
import { alt } from './text';
import type { RenderState } from './state';

const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);

function putRevealedBottom(list: EffectStep[], i: number, _st: RenderState): Folded | null {
  const m = list[i];
  if (m?.op !== 'move' || m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || m.remember !== undefined) return null;
  if (m.what.ref !== 'each') return null;
  const to = JSON.stringify(m.to);
  const order = to === JSON.stringify({ zone: 'library', position: 'bottom', order: 'random' }) ? 'in a random order'
    : to === JSON.stringify({ zone: 'library', position: 'bottom', order: 'chosen' }) ? 'in any order' : null;
  if (order === null) return null;
  const f = m.what.filter;
  if (f.is?.ref !== 'bound' || JSON.stringify(f) !== JSON.stringify({ is: { ref: 'bound', name: f.is.name }, zone: 'library' })) return null;
  const group = f.is.name;
  const rv = list.slice(0, i).find((s) => s.op === 'revealUntil' && s.revealed === group);
  if (rv?.op !== 'revealUntil' || rv.who.ref !== 'you' || rv.guard !== undefined) return null;
  const text = `put ${alt('the revealed cards', 'all cards revealed this way')} on the bottom of your library ${order}`;
  return { clauses: [acting('you', text, `you ${text}`, { standalone: true })], consumed: 1 };
}

/**
 * `putNonlandHandRestBottom` (CR 701.20a, 401.4, 608.2c, 205.2a; Fathom Trawl, eff.edhe10.putNonlandRevealedHand.restBottomAny): after your reveal until N nonland cards, "Put the nonland cards
 * revealed this way into your hand, then put the rest of the revealed cards on the bottom of your library in any order.": the cards it stopped at into your hand, every other revealed
 * card, still in the library, to the bottom in the order you choose. Only those two moves, the first with nothing but the reveal's `hit` name.
 */
function putNonlandHandRestBottom(list: EffectStep[], i: number): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  const plain = (s: EffectStep | undefined): boolean => s?.op === 'move' && s.guard === undefined && s.as === undefined && s.until === undefined && s.link === undefined && s.remember === undefined;
  if (a?.op !== 'move' || b?.op !== 'move' || !plain(a) || !plain(b) || a.what.ref !== 'bound' || JSON.stringify(a.to) !== JSON.stringify({ zone: 'hand' })) return null;
  if (b.what.ref !== 'each' || JSON.stringify(b.to) !== JSON.stringify({ zone: 'library', position: 'bottom', order: 'chosen' })) return null;
  const hit = a.what.name;
  const rv = list.slice(0, i).find((s) => s.op === 'revealUntil' && s.as === hit);
  if (rv?.op !== 'revealUntil' || rv.who.ref !== 'you' || rv.guard !== undefined || rv.count === undefined || rv.revealed === undefined || JSON.stringify(rv.filter) !== JSON.stringify({ notTypes: ['Land'] })) return null;
  if (JSON.stringify(b.what.filter) !== JSON.stringify({ is: { ref: 'bound', name: rv.revealed }, not: { is: { ref: 'bound', name: hit } }, zone: 'library' })) return null;
  const text = 'put the nonland cards revealed this way into your hand, then put the rest of the revealed cards on the bottom of your library in any order';
  return { clauses: [acting('you', text, `you ${text}`, { standalone: true })], consumed: 2 };
}

/**
 * `revealUntilBottomWhenRevealedDamage` (CR 701.20a, 603.12, 202.3, 120.3; Calibrated Blast, eff.edhe10.whenRevealNonlandThisWay.damageMv): "Reveal cards from the top of your library until you
 * reveal a nonland card. Put the revealed cards on the bottom of your library in a random order. When you reveal a nonland card this way, ~ deals damage equal to that card's mana value to
 * any target.": the reveal, the move of every revealed card to the bottom, and the reflexive ability that waits for the reveal to have found its card and deals damage equal to that card's
 * mana value to the target it chooses.
 */
function revealUntilBottomWhenRevealedDamage(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b, r] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'revealUntil' || b?.op !== 'move' || r?.op !== 'reflexive') return null;
  if (a.guard !== undefined || a.who.ref !== 'you' || a.count !== undefined || a.as === undefined || a.revealed === undefined || !same(a.filter, { notTypes: ['Land'] })) return null;
  if (b.guard !== undefined || b.as !== undefined || b.until !== undefined || b.link !== undefined || b.remember !== undefined) return null;
  if (!same(b.what, { ref: 'each', filter: { is: { ref: 'bound', name: a.revealed }, zone: 'library' } }) || !same(b.to, { zone: 'library', position: 'bottom', order: 'random' })) return null;
  if (r.modes !== undefined || !same(r.when.if, { cond: 'compare', left: { q: 'count', of: { ref: 'bound', name: a.as } }, op: '>=', right: 1 }) || r.when.did !== a.as || r.targets.length !== 1 || r.do.length !== 1) return null;
  const d = r.do[0]!;
  const spec = r.targets[0]!;
  if (d.op !== 'damage' || d.guard !== undefined || !same(d.amount, { q: 'stat', stat: 'manaValue', of: { ref: 'bound', name: a.as } }) || !same(d.to, { ref: 'target', id: spec.id }) || !same(d.source, { ref: 'self' })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`) || JSON.stringify(x).includes(`"name":"${a.revealed}"`))) return null;
  const target = K.specPhrase(spec, st);
  const text = `reveal cards from the top of your library until you reveal a nonland card. put the revealed cards on the bottom of your library in a random order. when you reveal a nonland card this way, ~ deals damage equal to that card's mana value to ${target}`;
  return { clauses: [plain(text, { standalone: true })], consumed: 3 };
}

export function foldEdhE10(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return revealUntilBottomWhenRevealedDamage(list, i, st) ?? putNonlandHandRestBottom(list, i) ?? putRevealedBottom(list, i, st);
}
