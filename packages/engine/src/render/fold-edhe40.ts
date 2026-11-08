/**
 * edh-e-40 (Commander coordinator E, library 1/3): the folds of its templates (parser/templates/zz-cloud/edh-e-40.json), called from render/fold.ts#foldAt. Each applies only when
 * every part is exactly what the idiom says. A new fold file never imports a value from render/fold.ts (an import cycle).
 *
 * `lookExileOneRestBackTop` (CR 701.20e, 401.4, 406.1, 608.2c-d; Sealed Fate, eff.edhe40.look.exileOne.restBackTop): "Look at the top X cards of target opponent's library. Exile one of those
 * cards and put the rest back on top of that player's library in any order.": you look at the top cards of a player's library, choose exactly one of them and exile it, and every other
 * one of the cards you looked at goes back on top of that library in an order YOU choose (`arrangedBy` you: the player who looked, CR 401.4 "unless the effect says otherwise").
 */
import type { EffectStep } from '../types/ability';
import { numWord } from './text';
import { acting, plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const onlyKeys = (s: object, keys: string[]): boolean => Object.keys(s).every((k) => keys.includes(k) || (s as Record<string, unknown>)[k] === undefined);

function lookExileOneRestBackTop(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, c, m1, m2] = [list[i], list[i + 1], list[i + 2], list[i + 3]];
  if (a?.op !== 'look' || c?.op !== 'chooseObjects' || m1?.op !== 'move' || m2?.op !== 'move' || a.as === undefined || c.as === undefined) return null;
  if (a.guard !== undefined || !same(a.who, { ref: 'you' }) || a.at.ref !== 'topCards' || same(a.at.player, { ref: 'you' }) || !onlyKeys(a, ['op', 'who', 'at', 'as'])) return null;
  const seen = { ref: 'bound', name: a.as };
  const picked = { ref: 'bound', name: c.as };
  if (c.guard !== undefined || !same(c.who, { ref: 'you' }) || c.min !== 1 || c.max !== 1 || c.random === true || c.groupLimit !== undefined || c.perPlayer !== undefined || c.distinct !== undefined || c.startingWith !== undefined) return null;
  if (!same(c.from, { ref: 'each', filter: { is: seen, zone: 'library' } })) return null;
  if (m1.guard !== undefined || !same(m1.what, picked) || !same(m1.to, { zone: 'exile' }) || !onlyKeys(m1, ['op', 'what', 'to'])) return null;
  if (m2.guard !== undefined || !same(m2.what, { ref: 'each', filter: { is: seen, not: { is: picked }, zone: 'library' } })) return null;
  if (!same(m2.to, { zone: 'library', position: 'top', order: 'chosen', arrangedBy: { ref: 'you' } }) || !onlyKeys(m2, ['op', 'what', 'to'])) return null;
  if (list.slice(i + 4).some((x) => JSON.stringify(x).includes(`"${a.as}"`) || JSON.stringify(x).includes(`"${c.as}"`))) return null;
  const look = K.steps([a], st);
  const them = K.player(a.at.player, st, 'possessive').text;
  return { clauses: [plain(look, { standalone: true }), plain(`exile one of those cards and put the rest back on top of ${them} library in any order`, { standalone: true })], consumed: 4 };
}

/**
 * `mayLookThatLibraryExileOneRestTop` (CR 701.20e, 401.4, 406.1, 608.2c-d, 701.24; Psychic Surgery, eff.edhe40.look.thatLibrary.mayExileOne.restTop): after "Whenever an opponent shuffles
 * their library,": "you may look at the top two cards of that library. You may exile one of those cards. Then put the rest on top of that library in any order.": your option (one `may`)
 * to look at the top cards of the library of the player who shuffled, then your choice of up to one of those cards to exile, and every other card you looked at goes back on top
 * of that library in an order YOU choose (CR 401.4). Declining the look declines all of it: you see nothing, exile nothing and the library stays as it is.
 */
function mayLookThatLibraryExileOneRestTop(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const w = list[i];
  if (w?.op !== 'may' || w.guard !== undefined || w.as !== undefined || w.otherwise !== undefined || w.anyOne !== undefined || w.villainous !== undefined || w.gather !== undefined || !same(w.who, { ref: 'you' }) || w.do.length !== 4) return null;
  const [a, c, m1, m2] = w.do;
  if (a?.op !== 'look' || c?.op !== 'chooseObjects' || m1?.op !== 'move' || m2?.op !== 'move' || a.as === undefined || c.as === undefined) return null;
  if (a.guard !== undefined || !same(a.who, { ref: 'you' }) || a.at.ref !== 'topCards' || !same(a.at.player, { ref: 'event', role: 'player' }) || typeof a.at.count !== 'number' || !onlyKeys(a, ['op', 'who', 'at', 'as']) || !onlyKeys(a.at, ['ref', 'player', 'count'])) return null;
  const seen = { ref: 'bound', name: a.as };
  const picked = { ref: 'bound', name: c.as };
  if (c.guard !== undefined || !same(c.who, { ref: 'you' }) || c.min !== 0 || c.max !== 1 || c.random === true || c.groupLimit !== undefined || c.perPlayer !== undefined || c.distinct !== undefined || c.startingWith !== undefined) return null;
  if (!same(c.from, { ref: 'each', filter: { is: seen, zone: 'library' } })) return null;
  if (m1.guard !== undefined || !same(m1.what, picked) || !same(m1.to, { zone: 'exile' }) || !onlyKeys(m1, ['op', 'what', 'to'])) return null;
  if (m2.guard !== undefined || !same(m2.what, { ref: 'each', filter: { is: seen, not: { is: picked }, zone: 'library' } })) return null;
  if (!same(m2.to, { zone: 'library', position: 'top', order: 'chosen', arrangedBy: { ref: 'you' } }) || !onlyKeys(m2, ['op', 'what', 'to'])) return null;
  if (list.slice(i + 1).some((x) => JSON.stringify(x).includes(`"${a.as}"`) || JSON.stringify(x).includes(`"${c.as}"`))) return null;
  return {
    clauses: [
      plain(`you may look at the top ${numWord(a.at.count)} cards of that library`, { standalone: true }),
      plain('you may exile one of those cards', { standalone: true }),
      plain('then put the rest on top of that library in any order', { standalone: true }),
    ],
    consumed: 1,
  };
}

/**
 * `playerLooksPutsOneBackExilesRest` (CR 701.20e, 401.4, 406.1, 608.2c-d, 109.5; Ashnod's Cylix, eff.edhe40.player.looksTop.putsOneBack.exilesRest): "Target player looks at the top three
 * cards of their library, puts one of them back on top of their library, then exiles the rest.": that player looks at their own top cards, chooses one of them (they choose, not you)
 * which goes back on top, and every other one of the cards they looked at is exiled.
 */
function playerLooksPutsOneBackExilesRest(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, c, m1, m2] = [list[i], list[i + 1], list[i + 2], list[i + 3]];
  if (a?.op !== 'look' || c?.op !== 'chooseObjects' || m1?.op !== 'move' || m2?.op !== 'move' || a.as === undefined || c.as === undefined) return null;
  if (a.guard !== undefined || a.at.ref !== 'topCards' || a.who.ref === 'you' || !same(a.who, a.at.player) || typeof a.at.count !== 'number' || !onlyKeys(a, ['op', 'who', 'at', 'as']) || !onlyKeys(a.at, ['ref', 'player', 'count'])) return null;
  const seen = { ref: 'bound', name: a.as };
  const kept = { ref: 'bound', name: c.as };
  if (c.guard !== undefined || !same(c.who, a.who) || c.min !== 1 || c.max !== 1 || c.random === true || c.groupLimit !== undefined || c.perPlayer !== undefined || c.distinct !== undefined || c.startingWith !== undefined) return null;
  if (!same(c.from, { ref: 'each', filter: { is: seen, zone: 'library' } })) return null;
  if (m1.guard !== undefined || !same(m1.what, kept) || !same(m1.to, { zone: 'library', position: 'top' }) || !onlyKeys(m1, ['op', 'what', 'to'])) return null;
  if (m2.guard !== undefined || !same(m2.what, { ref: 'each', filter: { is: seen, not: { is: kept }, zone: 'library' } }) || !same(m2.to, { zone: 'exile' }) || !onlyKeys(m2, ['op', 'what', 'to'])) return null;
  if (list.slice(i + 4).some((x) => JSON.stringify(x).includes(`"${a.as}"`) || JSON.stringify(x).includes(`"${c.as}"`))) return null;
  const who = K.player(a.who, st, 'subject').text;
  const text = `${who} looks at the top ${numWord(a.at.count)} cards of their library, puts one of them back on top of their library, then exiles the rest`;
  return { clauses: [plain(text, { standalone: true })], consumed: 4 };
}

const BOUND_HAND = { ref: 'bound', name: 'revealedHand' };
const handOf = (who: unknown): unknown => ({ ref: 'each', filter: { zone: 'hand', owner: who } });

/**
 * `chooseTypeRevealHandDamage` (CR 608.2d, 607.2d, 205.2a, 701.20a, 402.3, 120.3, 608.2h; Blood Oath, eff.edhe40.chooseType.revealHand.damagePerChosen): "Choose a card type. Target opponent
 * reveals their hand. ~ deals 3 damage to that player for each card of the chosen type revealed this way.": you choose a card type, the target player reveals their hand, and the source
 * deals N times the number of cards of that type among the revealed cards as ONE damage event to that player. Only those three steps.
 */
function chooseTypeRevealHandDamage(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [c, r, d] = [list[i], list[i + 1], list[i + 2]];
  if (c?.op !== 'chooseValue' || r?.op !== 'reveal' || d?.op !== 'damage') return null;
  if (c.guard !== undefined || !same(c.who, { ref: 'you' }) || c.what !== 'cardType' || c.as !== 'chosenCardType' || c.link !== 'cardType' || !onlyKeys(c, ['op', 'who', 'what', 'as', 'link'])) return null;
  if (r.guard !== undefined || r.who.ref !== 'target' || r.as !== 'revealedHand' || !same(r.what, handOf(r.who)) || !onlyKeys(r, ['op', 'who', 'what', 'as'])) return null;
  if (d.guard !== undefined || !same(d.source, { ref: 'self' }) || !same(d.to, r.who) || !onlyKeys(d, ['op', 'source', 'to', 'amount'])) return null;
  const amount = d.amount as { q?: string; op?: string; args?: unknown[] };
  if (amount.q !== 'math' || amount.op !== '*' || amount.args?.length !== 2 || typeof amount.args[0] !== 'number' || amount.args[0] < 1) return null;
  if (!same(amount.args[1], { q: 'count', of: { ref: 'each', filter: { is: BOUND_HAND, zone: 'hand', chosen: { link: 'cardType', quality: 'cardType' } } } })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes('"revealedHand"') || JSON.stringify(x).includes('"chosenCardType"'))) return null;
  const reveal = K.clause(r, st);
  return { clauses: [plain('choose a card type', { standalone: true }), reveal, plain(`~ deals ${amount.args[0]} damage to that player for each card of the chosen type revealed this way`, { standalone: true })], consumed: 3 };
}

/**
 * `chooseColorRevealHandDamage` (CR 608.2d, 105.1, 607.2d, 701.20a, 402.3, 120.3, 608.2h; Darigaaz, the Igniter, eff.edhe40.chooseColor.thatPlayerRevealsHand.damageEqualColored): in a combat
 * damage trigger, "choose a color, then that player reveals their hand and ~ deals damage to the player equal to the number of cards of that color revealed this way": you choose a color,
 * the player who was dealt the damage reveals their hand, and the source deals damage equal to the number of cards of that color among them as one damage event to that player.
 */
function chooseColorRevealHandDamage(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [c, r, d] = [list[i], list[i + 1], list[i + 2]];
  const who = { ref: 'event', role: 'recipient' };
  if (c?.op !== 'chooseValue' || r?.op !== 'reveal' || d?.op !== 'damage') return null;
  if (c.guard !== undefined || !same(c.who, { ref: 'you' }) || c.what !== 'color' || c.as !== 'chosenColor' || c.link !== 'color' || !onlyKeys(c, ['op', 'who', 'what', 'as', 'link'])) return null;
  if (r.guard !== undefined || !same(r.who, who) || r.as !== 'revealedHand' || !same(r.what, handOf(who)) || !onlyKeys(r, ['op', 'who', 'what', 'as'])) return null;
  if (d.guard !== undefined || !same(d.source, { ref: 'self' }) || !same(d.to, who) || !onlyKeys(d, ['op', 'source', 'to', 'amount'])) return null;
  if (!same(d.amount, { q: 'count', of: { ref: 'each', filter: { is: BOUND_HAND, zone: 'hand', chosen: { link: 'color', quality: 'color' } } } })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes('"revealedHand"') || JSON.stringify(x).includes('"chosenColor"'))) return null;
  const text = 'choose a color, then that player reveals their hand and ~ deals damage to the player equal to the number of cards of that color revealed this way';
  return { clauses: [acting('you', text, `you ${text}`)], consumed: 3 };
}

export function foldEdhE40(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return lookExileOneRestBackTop(list, i, st) ?? mayLookThatLibraryExileOneRestTop(list, i, st) ?? playerLooksPutsOneBackExilesRest(list, i, st) ?? chooseTypeRevealHandDamage(list, i, st) ?? chooseColorRevealHandDamage(list, i, st);
}
