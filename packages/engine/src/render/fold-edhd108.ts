/**
 * edh-d-108 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups graveyard 3/3, vote-secret, dice-random): the folds of its templates
 * (parser/templates/zz-cloud/edh-d-108.json), called from render/fold.ts#foldAt. Each applies only when every part is exactly what the idiom says.
 */
import type { EffectStep } from '../types/ability';
import { acting, plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { groupPool, restOfGroup } from './refs';
import type { RenderState } from './state';
import { bind } from './steps-util';
import { numWord } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * `exileNOfThemAtRandomRestTop` (CR 608.2d, 401.4, 406.1; Orcish Librarian, eff.edhd108.exileNOfSeen.atRandom.restTopAnyOrder): after a look at the top cards of your library,
 * "Exile four of them at random, then put the rest on top of your library in any order.": exactly N cards of the group looked at are picked at random (no player chooses, CR 608.2d)
 * and exiled; the others go back on top of that library in an order you choose. Only those three steps, with nothing after them reading the pick or the group.
 */
function exileNOfThemAtRandomRestTop(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, m1, m2] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'chooseObjects' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.random !== true || typeof a.min !== 'number' || a.min < 1 || a.max !== a.min) return null;
  if (a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined || a.eachCardType !== undefined || a.link !== undefined) return null;
  if (m1?.op !== 'move' || m1.guard !== undefined || m1.as !== undefined || m1.until !== undefined || m1.link !== undefined || m1.remember !== undefined || !same(m1.what, { ref: 'bound', name: a.as }) || !same(m1.to, { zone: 'exile' })) return null;
  if (m2?.op !== 'move' || m2.guard !== undefined || m2.as !== undefined || m2.until !== undefined || m2.link !== undefined || m2.remember !== undefined || !same(m2.to, { zone: 'library', position: 'top', order: 'chosen' })) return null;
  const pool = groupPool(a.from);
  if (pool === null || pool.desc !== null || pool.group.ref !== 'bound') return null;
  // the group is the cards a look at the top of YOUR library saw (the rest goes back on top of that library)
  const look = list.slice(0, i).reverse().find((s) => s.op === 'look' && s.as === (pool.group as { name: string }).name);
  if (look?.op !== 'look' || look.at.ref !== 'topCards' || !same(look.at.player, { ref: 'you' }) || typeof look.at.count !== 'number' || look.at.count <= a.min) return null;
  if (m2.what.ref !== 'each') return null;
  const rest = restOfGroup(m2.what.filter);
  if (rest === null || rest.chosen !== a.as || rest.group !== pool.group.name) return null;
  const gname = pool.group.name;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`) || JSON.stringify(x).includes(`"name":"${gname}"`))) return null;
  const them = K.obj(pool.group, st, 'object');
  if (!them.plural) return null;
  const text = `exile ${numWord(a.min)} of ${them.text} at random, then put the rest on top of your library in any order`;
  bind(st, a.as, { nouns: ['card'], plural: a.min !== 1 });
  return { clauses: [acting('you', text, `you ${text}`, { closesScope: true })], consumed: 3 };
}

/**
 * `eachOpponentKeepsNExilesRest` (CR 608.2c-d, 101.4, 404.1, 406.1; Watchers of the Dead, eff.edhd108.eachOpponent.chooseNInGraveyard.exileRest): "Each opponent chooses two cards in their
 * graveyard and exiles the rest.": each opponent in turn order chooses that many cards of their own graveyard (all of them when they have no more, CR 608.2d), then every other card of
 * every opponent's graveyard is exiled. Exactly the two steps of the template, with nothing after them reading the choice.
 */
function eachOpponentKeepsNExilesRest(list: EffectStep[], i: number): Folded | null {
  const [a, m] = [list[i], list[i + 1]];
  if (a?.op !== 'chooseObjects' || a.as === undefined || !same(a.who, { ref: 'iterating' }) || !same(a.perPlayer, { ref: 'each', who: 'opponent' }) || a.random === true || typeof a.min !== 'number' || a.min < 1 || a.max !== a.min) return null;
  if (a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.startingWith !== undefined || a.eachCardType !== undefined || a.link !== undefined) return null;
  if (!same(a.from, { ref: 'each', filter: { zone: 'graveyard', owner: { ref: 'iterating' }, isCard: true } })) return null;
  if (m?.op !== 'move' || m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || m.remember !== undefined || !same(m.to, { zone: 'exile' })) return null;
  if (!same(m.what, { ref: 'each', filter: { zone: 'graveyard', owner: 'opponent', isCard: true, not: { is: { ref: 'bound', name: a.as } } } })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null;
  const text = `each opponent chooses ${a.min === 1 ? 'a card' : `${numWord(a.min)} cards`} in their graveyard and exiles the rest`;
  return { clauses: [acting('x', text, text, { standalone: true, closesScope: true })], consumed: 2 };
}

/**
 * `eachRevealsTopMayPutRevealedIntoGraveyards` (CR 701.20a, 400.3, 608.2c-d; Dakra Mystic, eff.edhd108.may.putRevealedTopCards.ownersGraveyards): "Each player reveals the top card of their
 * library. You may put the revealed cards into their owners' graveyards.": every player reveals the top card of their own library, then you choose whether ALL of those cards go to their
 * owners' graveyards (one choice, CR 608.2d); a following "If you don't, ..." reads that choice. Exactly those two steps: the reveal of one card of each player's library, then your `may`
 * whose only instruction moves the same cards (still the top card of each library) to the graveyard.
 */
function eachRevealsTopMayPutRevealedIntoGraveyards(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [r, m] = [list[i], list[i + 1]];
  const top = { ref: 'topCards', player: { ref: 'each', who: 'player' }, count: 1 };
  if (r?.op !== 'reveal' || r.guard !== undefined || r.as !== undefined || !same(r.who, { ref: 'each', who: 'player' }) || !same(r.what, top) || Object.keys(r).some((k) => !['op', 'who', 'what'].includes(k))) return null;
  if (m?.op !== 'may' || m.guard !== undefined || !same(m.who, { ref: 'you' }) || m.do.length !== 1 || m.anyOne === true) return null;
  const mv = m.do[0]!;
  if (mv.op !== 'move' || !same(mv, { op: 'move', what: top, to: { zone: 'graveyard' } })) return null;
  const text = "each player reveals the top card of their library. you may put the revealed cards into their owners' graveyards";
  // "If you don't, each player draws a card.": the instructions done when you decline (the `may`'s otherwise, CR 608.2c)
  // a later "If you don't, ..." reads whether you did it (the binding the `may` render makes, render/steps-flow.ts)
  bind(st, m.as, { nouns: [], plural: false, actor: 'you', optional: true });
  const otherwise = m.otherwise !== undefined && m.otherwise.length > 0 ? `. if you don't, ${K.steps(m.otherwise, st)}` : '';
  return { clauses: [plain(`${text}${otherwise.replace(/\.$/, '')}`, { standalone: true })], consumed: 2 };
}

/**
 * `choosesPermanentPerGraveyardCardUntaps` (CR 608.2c-d, 701.26b, 404.1; Mist of Stagnation, eff.edhd108.player.choosesPermanentPerGraveyardCard.untapsThem): "that player chooses a permanent
 * for each card in their graveyard, then untaps those permanents": one player chooses as many permanents (any player's, CR 110.1) as there are cards in their own graveyard (all of them when
 * there are fewer permanents, CR 608.2d), then those permanents untap. Exactly the two steps of the template, with nothing after them reading the choice.
 */
function choosesPermanentPerGraveyardCardUntaps(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, u] = [list[i], list[i + 1]];
  if (a?.op !== 'chooseObjects' || a.as === undefined || a.random === true || a.perPlayer !== undefined || a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.startingWith !== undefined || a.eachCardType !== undefined || a.link !== undefined) return null;
  const count = { q: 'zoneSize', zone: 'graveyard', of: a.who };
  if (!same(a.from, { ref: 'each', filter: {} }) || !same(a.min, count) || !same(a.max, count) || a.who.ref === 'each') return null;
  if (u?.op !== 'untap' || u.guard !== undefined || !same(u, { op: 'untap', what: { ref: 'bound', name: a.as } })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null;
  const who = K.player(a.who, st, 'subject').text;
  const text = `${who} chooses a permanent for each card in their graveyard, then untaps those permanents`;
  return { clauses: [acting('x', text, text, { standalone: true, closesScope: true })], consumed: 2 };
}

/**
 * `revealsNAtRandomDiscardsNonland` (CR 701.20a, 608.2d, 701.9a, 402.1; Fall (Rise // Fall), eff.edhd108.player.revealsNAtRandom.discardsNonlandRevealed): "Target player reveals two cards at
 * random from their hand, then discards each nonland card revealed this way.": that many cards of that player's hand are picked at random (no player chooses, CR 608.2d; all of them when the
 * hand has fewer), revealed, and that player discards the nonland ones among them. Exactly the three steps of the template, with nothing after them reading the pick.
 */
function revealsNAtRandomDiscardsNonland(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, r, dc] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'chooseObjects' || a.as === undefined || a.random !== true || typeof a.min !== 'number' || a.min < 2 || a.max !== a.min || a.who.ref === 'each' || a.perPlayer !== undefined || a.guard !== undefined) return null;
  if (a.distinct !== undefined || a.groupLimit !== undefined || a.startingWith !== undefined || a.eachCardType !== undefined || a.link !== undefined) return null;
  if (!same(a.from, { ref: 'each', filter: { zone: 'hand', owner: a.who } })) return null;
  if (r?.op !== 'reveal' || !same(r, { op: 'reveal', who: a.who, what: { ref: 'bound', name: a.as } })) return null;
  if (dc?.op !== 'discard' || !same(dc, { op: 'discard', who: a.who, count: 'hand', filter: { is: { ref: 'bound', name: a.as }, notTypes: ['Land'] } })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null;
  const who = K.player(a.who, st, 'subject').text;
  const text = `${who} reveals ${numWord(a.min)} cards at random from their hand, then discards each nonland card revealed this way`;
  return { clauses: [acting('x', text, text, { standalone: true, closesScope: true })], consumed: 3 };
}

/**
 * `searchThreeDifferentNamesRandomToHand` (CR 701.23a-b, 701.20a, 608.2d, 201.2; Signal the Clans, eff.edhd108.search.threeReveal.differentNames.randomToHand.shuffleRest; parser/lower/join-edhd108.ts):
 * "Search your library for three creature cards and reveal them. If you reveal three cards with different names, choose one of them at random and put that card into your hand. Shuffle the
 * rest into your library.": you may find fewer (CR 701.23b); only when three cards with three different names were revealed is one of them picked at random (no player chooses) and put
 * into your hand; then your library is shuffled, the other found cards in it (they never left it; ruling 2013-01-24). Exactly the three steps of the template.
 */
function searchThreeDifferentNamesRandomToHand(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, c, sh] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'search' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.zone !== 'library' || a.min !== 0 || a.max !== 3 || a.reveal !== true || a.filter === undefined) return null;
  if (Object.keys(a).some((k) => !['op', 'who', 'zone', 'filter', 'min', 'max', 'reveal', 'as'].includes(k))) return null;
  const f = a.filter as { types?: string[] };
  if (Object.keys(f).length !== 1 || f.types?.length !== 1) return null;
  if (c?.op !== 'if' || c.else !== undefined || c.guard !== undefined || !same(c.cond, { cond: 'compare', left: { q: 'distinct', what: 'names', among: { ref: 'bound', name: a.as } }, op: '>=', right: 3 }) || c.then.length !== 2) return null;
  const [pick, mv] = c.then;
  if (pick?.op !== 'chooseObjects' || pick.as === undefined || !same(pick, { op: 'chooseObjects', who: { ref: 'you' }, from: { ref: 'each', filter: { is: { ref: 'bound', name: a.as }, zone: 'library' } }, min: 1, max: 1, random: true, as: pick.as })) return null;
  if (mv?.op !== 'move' || !same(mv, { op: 'move', what: { ref: 'bound', name: pick.as }, to: { zone: 'hand' } })) return null;
  if (sh?.op !== 'shuffle' || !same(sh, { op: 'shuffle', who: { ref: 'you' } })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`) || JSON.stringify(x).includes(`"name":"${pick.as}"`))) return null;
  const kind = K.np({ types: f.types } as never, st, { det: 'none', plural: true });
  const text = `search your library for three ${kind.endsWith(' cards') ? kind : `${kind.replace(/s$/, '')} cards`} and reveal them. if you reveal three cards with different names, choose one of them at random and put that card into your hand. shuffle the rest into your library`;
  return { clauses: [plain(text, { standalone: true })], consumed: 3 };
}

/** The folds of edh-d-108 (render/fold.ts#foldAt). */
export function foldEdhD108(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return exileNOfThemAtRandomRestTop(list, i, st) ?? eachOpponentKeepsNExilesRest(list, i) ?? eachRevealsTopMayPutRevealedIntoGraveyards(list, i, st) ?? choosesPermanentPerGraveyardCardUntaps(list, i, st)
    ?? revealsNAtRandomDiscardsNonland(list, i, st) ?? searchThreeDifferentNamesRandomToHand(list, i, st);
}
