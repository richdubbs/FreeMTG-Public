/**
 * Commander coordinator E, round edh-e-64 (groups graveyard): the folds of the steps its templates build (render/fold.ts#foldAtPlain tries `foldEdhE64`). A fold applies only when
 * every part is exactly what the idiom says. This file imports no value from render/fold.ts (an import cycle); it takes the types only.
 *
 * `loseGainForEachLead` (CR 119.3, 608.2h; Suffer the Past; family lose-gain-for-each-lead): a player loses and you gain the SAME amount, once for each of a group:
 * "For each card exiled this way, that player loses 1 life and you gain 1 life." is also "That player loses life equal to the number of cards exiled this way and you gain life
 * equal to the number of cards exiled this way". Exactly a `loseLife` and a `gainLife` of the controller that count the same group, one after the other.
 */
import type { EffectStep } from '../types/ability';
import { acting, fragment, plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { countParts } from './qty';
import { playerKey, withVariants, type RenderState } from './state';
import { alt } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function loseGainForEachLead(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  if (a?.op !== 'loseLife' || b?.op !== 'gainLife' || a.guard !== undefined || b.guard !== undefined || a.as !== undefined || b.as !== undefined || b.who.ref !== 'you') return null;
  if (Object.keys(a).some((k) => !['op', 'who', 'amount'].includes(k)) || Object.keys(b).some((k) => !['op', 'who', 'amount'].includes(k))) return null;
  const q = a.amount;
  if (typeof q !== 'object' || q.q !== 'count' || !same(q, b.amount) || q.of.ref !== 'each' || (q.of.filter.is as { ref?: string } | undefined)?.ref !== 'bound') return null; // the group an earlier instruction bound only (the "where X is" drains are render/steps-life.ts's)
  const [generic, lead] = withVariants(st, [
    (v) => `${fragment(K.clause(a, v))} and ${fragment(K.clause(b, v))}`,
    (v) => {
      const parts = countParts(q, v);
      if (parts === null) return null;
      return `for each ${parts.singular}, ${fragment(K.clause({ ...a, amount: 1 }, v))} and ${fragment(K.clause({ ...b, amount: 1 }, v))}`;
    },
  ]);
  if (lead === null || lead === undefined) return null;
  return { clauses: [plain(alt(generic!, lead), { standalone: true })], consumed: 2 };
}

/**
 * `revealHandExileSameNameHandGraveyard` (CR 701.20a, 701.23b, 201.2, 608.2h; Legion's End; family player-reveals-hand-exiles-same-name): a player reveals their hand and exiles all
 * cards with the name of an object named before from their hand and graveyard, "Then that player reveals their hand and exiles all cards with that name from their hand and graveyard."
 * Exactly a reveal of the whole hand of the player and the exile of every card of their hand and graveyard sharing the name (no search: the hand was revealed and the graveyard is public).
 */
function revealHandExileSameNameHandGraveyard(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [r, m] = [list[i], list[i + 1]];
  if (r?.op !== 'reveal' || m?.op !== 'move' || r.guard !== undefined || m.guard !== undefined || r.as !== undefined || m.as !== undefined || m.until !== undefined) return null;
  if (r.to !== undefined || r.anyNumber !== undefined || r.what.ref !== 'each' || !same(r.what.filter, { zone: 'hand', owner: r.who })) return null;
  if (m.what.ref !== 'each' || !same(m.to, { zone: 'exile' })) return null;
  const { sharesWith: sw, ...rest } = m.what.filter;
  if (!same(rest, { zone: ['hand', 'graveyard'], owner: r.who, isCard: true }) || sw?.quality !== 'name' || (sw.with.ref !== 'target' && sw.with.ref !== 'bound')) return null;
  const key = playerKey(r.who);
  if (key === null) return null;
  const p = K.player(r.who, st, 'subject');
  const text = `reveals their hand and exiles all cards with that name from their hand and graveyard`;
  return { clauses: [acting(key, `${p.text} ${text}`, `${p.text} ${text}`, { leadThen: true })], consumed: 2 };
}

/**
 * `chooseHandCardOrGraveyardCard` (CR 701.20a, 701.20e, 608.2d, 404.1; Agonizing Remorse; family choose-from-hand-or-graveyard): after a hand was revealed, "You choose a nonland card from it or a
 * card from their graveyard." One choice (exactly one card) among the cards of that hand that fit a description and the cards of the graveyard of the same player. The first half is said as
 * the choice from the hand alone is; the second half is any card of that graveyard.
 */
function chooseHandCardOrGraveyardCard(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [r, c] = [list[i - 1], list[i]];
  if (r?.op !== 'reveal' || c?.op !== 'chooseObjects' || r.as === undefined || c.guard !== undefined || c.who.ref !== 'you' || c.min !== 1 || c.max !== 1 || c.as === undefined || c.random === true || c.groupLimit !== undefined) return null;
  const from = c.from;
  if (from.ref !== 'union' || from.of.length !== 2) return null;
  const [h, g] = from.of;
  if (h?.ref !== 'each' || g?.ref !== 'each' || !same(h.filter.is, { ref: 'bound', name: r.as })) return null;
  if (!same(g.filter, { zone: 'graveyard', isCard: true, owner: r.who })) return null;
  const hand = K.clause({ ...c, from: h }, st);
  if (hand.empty === true || hand.actor !== 'you') return null;
  return { clauses: [plain(`${hand.sub} or a card from ${K.player(r.who, st, 'possessive').text} graveyard`)], consumed: 1 };
}

export function foldEdhE64(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return loseGainForEachLead(list, i, st) ?? revealHandExileSameNameHandGraveyard(list, i, st) ?? chooseHandCardOrGraveyardCard(list, i, st);
}
