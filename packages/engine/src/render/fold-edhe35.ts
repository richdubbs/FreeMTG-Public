/**
 * Round edh-e-35 (coordinator E, group vote-secret): the folds of the steps its templates build (render/fold.ts#foldAt tries `foldEdhE35` after the other slices' own folds). A fold
 * applies only when every part is exactly what the idiom says. This file imports no value from render/fold.ts (an import cycle); it takes the types only.
 *
 * `youAndObjProtectionFromChosenPlayer` (CR 702.16a, 702.16k, 702.16b-e, 607.2d, 611.2a; Guardian Archon, template eff.edhe35.youAndObj.eachGainProtectionFromChosenPlayer): "You and target
 * permanent you control each gain protection from the chosen player until end of turn." Protection from a player (CR 702.16k): that player's sources can't target, enchant, equip
 * or damage the protected player or permanent, and that player's creatures can't block the permanent.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { cloneState } from './state';

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

const CHOSEN = { ref: 'linked', link: 'opponent' };

/** The effects protection from the chosen player is, for `you` and for the one object `of` names. */
export function chosenPlayerProtection(of: unknown): unknown[] {
  const you = { ref: 'you' };
  const obj = { ref: 'each', filter: { is: of } };
  const ban = (subject: unknown, action: string): unknown => ({ s: 'restrict', subject, mode: 'cant', action, other: { controller: CHOSEN } });
  const prevent = (recipient: unknown): unknown => ({ s: 'replace', replaces: { ev: 'damage', recipient, source: { controller: CHOSEN } }, body: { b: 'prevent', amount: 'all' } });
  return [
    ban(you, 'beTargeted'), ban(you, 'beEnchanted'), prevent({ player: 'you' }),
    ban(obj, 'beTargeted'), ban(obj, 'beEnchanted'), ban(obj, 'beEquipped'), ban(obj, 'beBlockedBy'), prevent({ object: { is: of } }),
  ];
}

function youAndObjProtectionFromChosenPlayer(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const e = list[i];
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || Object.keys(e).some((k) => !['op', 'duration', 'effects'].includes(k)) || e.effects.length !== 8) return null;
  const subject = (e.effects[3] as { subject?: { filter?: { is?: unknown } } }).subject;
  const of = subject?.filter?.is;
  if (of === undefined || !same(e.effects, chosenPlayerProtection(of))) return null;
  const dur = K.dur(e.duration, cloneState(st));
  if (!dur) return null;
  const obj = K.obj(of as never, st, 'subject').text;
  return { clauses: [plain(`you and ${obj} each gain protection from the chosen player ${dur}`, { standalone: true })], consumed: 1 };
}

/**
 * `chooseNewTargetsIfChosenPlayerTargetsYours` (CR 115.7, 115.7d, 607.2d, 608.2c; Emissary of Grudges, template eff.edhe35.chooseNewTargets.ifChosenPlayerControlsAndTargetsYouOrYours): "Choose new
 * targets for target spell or ability if it's controlled by the chosen player and if it targets you or a permanent you control." Exactly that one conditional step.
 */
function chooseNewTargetsIfChosenPlayerTargetsYours(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const s = list[i];
  if (s?.op !== 'if' || s.guard !== undefined || s.as !== undefined || Object.keys(s).some((k) => !['op', 'cond', 'then'].includes(k)) || s.then.length !== 1) return null;
  const c = s.cond as { cond?: string; of?: { ref?: string; filter?: { is?: unknown } } };
  const of = c.of?.filter?.is;
  if (c.cond !== 'exists' || of === undefined) return null;
  const want = { cond: 'exists', of: { ref: 'each', filter: { is: of, zone: 'stack', controller: CHOSEN, anyOf: [{ zone: 'stack', targets: { ref: 'you' } }, { zone: 'stack', targets: { ref: 'each', filter: { controller: 'you' } } }] } } };
  if (!same(s.cond, want) || !same(s.then[0], { op: 'chooseNewTargets', who: { ref: 'you' }, what: of })) return null;
  const obj = K.obj(of as never, st, 'subject').text;
  return { clauses: [plain(`choose new targets for ${obj} if it's controlled by the chosen player and if it targets you or a permanent you control`, { standalone: true })], consumed: 1 };
}

const VOTES = (q: unknown): string | null => {
  const v = q as { q?: string; step?: unknown; choice?: unknown } | undefined;
  return v?.q === 'votes' && typeof v.step === 'string' && typeof v.choice === 'string' && /^[a-z ]+$/.test(v.choice) && same(q, { q: 'votes', step: v.step, choice: v.choice }) ? v.choice : null;
};

/**
 * `millForEachVoteThenDamage` (CR 701.38a, 701.17a, 120.3, 202.3, 608.2h; Fateful Tempest, template eff.edhe35.mill.forEachVote.thenDamageTotalManaValue): "You mill a card for each past vote, then
 * ~ deals damage to each opponent equal to the total mana value of cards milled this way." Exactly the mill (one card per vote, naming the cards) and the damage to each opponent.
 */
function millForEachVoteThenDamage(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [m, d] = [list[i], list[i + 1]];
  if (m?.op !== 'mill' || d?.op !== 'damage' || m.guard !== undefined || d.guard !== undefined || m.as !== 'milled' || d.as !== undefined) return null;
  if (Object.keys(m).some((k) => !['op', 'who', 'count', 'as'].includes(k)) || Object.keys(d).some((k) => !['op', 'source', 'to', 'amount'].includes(k))) return null;
  const choice = VOTES(m.count);
  if (choice === null || !same(m.who, { ref: 'you' })) return null;
  if (!same(d.to, { ref: 'each', who: 'opponent' }) || !same(d.amount, { q: 'stat', stat: 'manaValue', of: { ref: 'bound', name: 'milled' }, sum: true })) return null;
  const src = K.obj(d.source, cloneState(st), 'subject').text;
  return { clauses: [plain(`you mill a card for each ${choice} vote, then ${src} deals damage to each opponent equal to the total mana value of cards milled this way`, { standalone: true })], consumed: 2 };
}

/**
 * `exileTopForEachVotePlay` (CR 701.38a, 406.3, 611.2a, 305.1; Fateful Tempest, template eff.edhe35.exileTop.forEachVote): "Exile the top card of your library for each present vote." and, when the
 * next step is the permission to play exactly those cards until the end of your next turn, "Until the end of your next turn, you may play the exiled cards."
 */
function exileTopForEachVotePlay(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const m = list[i];
  if (m?.op !== 'move' || m.guard !== undefined || m.as !== 'them' || Object.keys(m).some((k) => !['op', 'what', 'to', 'as'].includes(k)) || !same(m.to, { zone: 'exile' })) return null;
  const w = m.what as { ref?: string; player?: unknown; count?: unknown };
  const choice = VOTES(w.count);
  if (w.ref !== 'topCards' || choice === null || !same(w.player, { ref: 'you' }) || Object.keys(w).length !== 3) return null;
  const first = plain(`exile the top card of your library for each ${choice} vote`, { standalone: true });
  const p = list[i + 1];
  if (p?.op === 'effect' && p.guard === undefined && p.as === undefined && Object.keys(p).every((k) => ['op', 'duration', 'effects'].includes(k))
    && same(p.effects, [{ s: 'permit', who: { ref: 'you' }, action: 'play', of: { is: { ref: 'bound', name: 'them' } } }])) {
    const dur = K.dur(p.duration, cloneState(st));
    if (dur === 'until the end of your next turn') return { clauses: [first, plain(`${dur}, you may play the exiled cards`, { standalone: true })], consumed: 2 };
  }
  return { clauses: [first], consumed: 1 };
}

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const bound = (name: string | undefined): unknown => ({ ref: 'bound', name });

/**
 * `facePilesChooseLookCastRest` (CR 700.3, 700.3a, 406.3, 701.20e, 601.2, 118.9, 608.2c; Abstract Performance, templates eff.edhe35.exileTop.faceDownPileThenFaceUpPile, rid.r5dig.opponentChoosesPile,
 * eff.edhe35.putThatPile.graveyard, eff.edhe35.look.otherPile, eff.edhe35.castOneFree.fromLookedPile): "Exile the top four cards of your library in a face-down pile, then exile the top four cards of
 * your library in a face-up pile. An opponent chooses one of those piles. Put that pile into your graveyard. Look at the cards in the other pile. You may cast a spell from among them without paying
 * its mana cost. Put the rest into your hand." Exactly those eight steps, with nothing after reading the piles.
 */
function facePilesChooseLookCastRest(list: EffectStep[], i: number): Folded | null {
  const [e1, e2, p, put, look, pick, cast, rest] = list.slice(i, i + 8);
  if (e1?.op !== 'move' || e2?.op !== 'move' || p?.op !== 'piles' || put?.op !== 'move' || look?.op !== 'look' || pick?.op !== 'chooseObjects' || cast?.op !== 'cast' || rest?.op !== 'move') return null;
  if ([e1, e2, p, put, look, pick, cast, rest].some((x) => x.guard !== undefined)) return null;
  const top = (m: typeof e1, faceDown: boolean): number | null => {
    const w = m.what as { ref?: string; player?: unknown; count?: unknown };
    if (w.ref !== 'topCards' || !same(w.player, { ref: 'you' }) || typeof w.count !== 'number' || w.count < 1 || w.count > 10 || Object.keys(w).length !== 3) return null;
    if (!same(m.to, faceDown ? { zone: 'exile', faceDown: true } : { zone: 'exile' }) || m.as === undefined || Object.keys(m).some((k) => !['op', 'what', 'to', 'as'].includes(k))) return null;
    return w.count;
  };
  const [n1, n2] = [top(e1, true), top(e2, false)];
  if (n1 === null || n2 === null || e1.as === e2.as) return null;
  if (!same(p, { op: 'piles', cards: bound(e1.as), second: bound(e2.as), separator: { ref: 'you' }, chooser: { ref: 'anOpponent' }, chosen: p.chosen, other: p.other })) return null;
  if (!same(put, { op: 'move', what: bound(p.chosen), to: { zone: 'graveyard' } }) || !same(look, { op: 'look', who: { ref: 'you' }, at: bound(p.other), as: look.as }) || look.as === undefined) return null;
  if (pick.as === undefined || !same(pick, { op: 'chooseObjects', who: { ref: 'you' }, from: { ref: 'each', filter: { notTypes: ['Land'], is: bound(look.as), zone: 'exile' } }, min: 0, max: 1, as: pick.as })) return null;
  if (!same(cast, { op: 'cast', who: { ref: 'you' }, what: bound(pick.as), free: true })) return null;
  if (!same(rest, { op: 'move', what: { ref: 'each', filter: { is: bound(look.as), not: { is: bound(pick.as) }, zone: 'exile' } }, to: { zone: 'hand' } })) return null;
  if (list.slice(i + 8).some((x) => [e1.as, e2.as, p.chosen, p.other, look.as, pick.as].some((n) => JSON.stringify(x).includes(`"${n}"`)))) return null;
  const text = `exile the top ${NUM[n1]} cards of your library in a face-down pile, then exile the top ${NUM[n2]} cards of your library in a face-up pile. an opponent chooses one of those piles. put that pile into your graveyard. look at the cards in the other pile. you may cast a spell from among them without paying its mana cost. put the rest into your hand`;
  return { clauses: [plain(text, { standalone: true })], consumed: 8 };
}

const DEF_EACH_OPP = { ref: 'each', who: 'opponent' };

/**
 * `separateThenOnlyPileCan` (CR 700.3, 700.3a, 608.2d, 508.1c, 509.1c, 101.2, 611.2a; Fight or Flight, Stand or Fall, templates eff.edhe35.separateCreatures.thatPlayer,
 * eff.edhe35.onlyCreaturesInPileOfTheirChoice.canAttack, eff.edhe35.forEachDefending.separateCreatures.thatPlayerChooses, eff.edhe35.onlyCreaturesInChosenPiles.canBlock): "Separate all creatures that
 * player controls into two piles. Only creatures in the pile of their choice can attack this turn." and "For each defending player, separate all creatures that player controls into two piles
 * and that player chooses one. Only creatures in the chosen piles can block this turn." Exactly the separation and the one lasting restriction on every creature not in the chosen pile(s).
 */
function separateThenOnlyPileCan(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, e] = [list[i], list[i + 1]];
  if (e?.op !== 'effect' || a === undefined || a.guard !== undefined || e.guard !== undefined || e.as !== undefined || Object.keys(e).some((k) => !['op', 'duration', 'effects'].includes(k))) return null;
  const restrict = (action: string): unknown => [{ s: 'restrict', subject: { ref: 'each', filter: { types: ['Creature'], not: { is: bound('chosenPile') } } }, mode: 'cant', action }];
  const dur = K.dur(e.duration, cloneState(st));
  if (!dur) return null;
  if (a.op === 'piles') {
    if (!same(a, { op: 'piles', cards: { ref: 'each', filter: { types: ['Creature'], controller: { ref: 'active' } } }, separator: { ref: 'you' }, chooser: { ref: 'active' }, chosen: 'chosenPile', other: 'otherPile' }) || !same(e.effects, restrict('attack'))) return null;
    return { clauses: [plain('separate all creatures that player controls into two piles', { standalone: true }), plain(`only creatures in the pile of their choice can attack ${dur}`, { standalone: true })], consumed: 2 };
  }
  if (a.op === 'forEach') {
    const want = { op: 'forEach', over: DEF_EACH_OPP, as: 'opp', gather: 'chosenPile', do: [{ op: 'piles', cards: { ref: 'each', filter: { types: ['Creature'], controller: { ref: 'iterating' } } }, separator: { ref: 'you' }, chooser: { ref: 'iterating' }, chosen: 'chosenPile', other: 'otherPile' }] };
    if (!same(a, want) || !same(e.effects, restrict('block'))) return null;
    return { clauses: [plain('for each defending player, separate all creatures that player controls into two piles and that player chooses one', { standalone: true }), plain(`only creatures in the chosen piles can block ${dur}`, { standalone: true })], consumed: 2 };
  }
  return null;
}

/** The folds of edh-e-35 (render/fold.ts#foldAt). */
export function foldEdhE35(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return youAndObjProtectionFromChosenPlayer(list, i, st) ?? chooseNewTargetsIfChosenPlayerTargetsYours(list, i, st) ?? millForEachVoteThenDamage(list, i, st) ?? exileTopForEachVotePlay(list, i, st) ?? facePilesChooseLookCastRest(list, i) ?? separateThenOnlyPileCan(list, i, st);
}
