/**
 * Commander coordinator E, round edh-e-5 (group exile-play): each new reading played through the engine with synthetic cards (invented names, design 6.10), compiled
 * by the game's default compiler. Alice (p1) is the active player of turn 1; Bob (p2) is the opponent. Each test is named after the rule it checks, with its negative case.
 * CR cites are from memory of the Comprehensive Rules of 2026-09-25 (no rules/cr folder in this session): unverified.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { getChars, legalActions } from '../../../src/index';
import { advanceTo, find, scenario } from '../../m3/scenario';
import { card, cast, full, obj, resolveAll, drive, act, lifeOf } from '../r4-cost/support';

const inExile = (s: GameState, name: string): ObjectId[] => s.zones.exile.filter((id) => s.objects[id]!.defId === name);
const inHand = (s: GameState, name: string, p = 'p1'): ObjectId[] => (s.zones.hand[p] ?? []).filter((id) => s.objects[id]!.defId === name);
const onBf = (s: GameState, name: string): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === name);
const exileCasts = (s: GameState): ObjectId[] => legalActions(s, 'p1').filter((a) => a.kind === 'cast').map((a) => (a.action as { card: ObjectId }).card).filter((id) => s.objects[id]!.zone === 'exile');
const SMASH = card('Test Smash', 'Instant', 'Destroy target creature or artifact.');
const castOn = (s: GameState, name: string, target: ObjectId): GameState => resolveAll(cast(s, name, { targets: [[obj(target)]] }));

// ---- Idol of Endurance: "Until end of turn, you may cast a creature spell from among cards exiled with ~ without paying its mana cost." --------------------------
const IDOL = card('Test Idol', 'Artifact', 'Whenever a creature or artifact you control dies, exile it.\n{T}: Until end of turn, you may cast a creature spell from among cards exiled with this artifact without paying its mana cost.');
const BRUTE = card('Test Brute', 'Creature — Ogre', '', '{5}', ['5', '5']);
const BRUTE2 = card('Test Giant', 'Creature — Giant', '', '{6}', ['6', '6']);
const TRINKET = card('Test Trinket', 'Artifact', '', '{4}');
describe('CR 607.2a, 601.3, 118.9, 611.2a: "Until end of turn, you may cast a creature spell from among cards exiled with ~ without paying its mana cost."', () => {
  const DEFS = [IDOL, BRUTE, BRUTE2, TRINKET, SMASH];
  const start = (): GameState => {
    let s = scenario([], { defs: DEFS, p1: { battlefield: ['Test Idol', 'Test Brute', 'Test Giant', 'Test Trinket'], hand: ['Test Smash', 'Test Smash', 'Test Smash'] } });
    for (const n of ['Test Brute', 'Test Giant', 'Test Trinket']) s = castOn(s, 'Test Smash', find(s, n, 'battlefield'));
    return s;
  };
  const activate = (s: GameState): GameState => {
    const la = legalActions(s, 'p1').find((a) => a.kind === 'activate' && !a.isMana && a.object === find(s, 'Test Idol', 'battlefield'));
    if (!la) throw new Error('no activation of the idol');
    return drive(act(s, la.action));
  };
  it('has no manual part', () => expect(full(IDOL)).toBe(true));
  it('casts ONE exiled creature card with no mana paid (it costs {5} and nothing is in the pool); the artifact card and a second creature are not offered after', () => {
    let s = start();
    expect(inExile(s, 'Test Brute').length + inExile(s, 'Test Giant').length + inExile(s, 'Test Trinket').length).toBe(3);
    expect(exileCasts(s).length).toBe(0); // before the ability resolves nothing is castable (their costs cannot be paid)
    s = resolveAll(activate(s));
    const castable = exileCasts(s).map((id) => s.objects[id]!.defId).sort();
    expect(castable).toEqual(['Test Brute', 'Test Giant']); // negative: the artifact card is no creature spell
    const giant = find(s, 'Test Giant', 'exile');
    const ways = legalActions(s, 'p1').filter((a) => a.kind === 'cast' && (a.action as { card: ObjectId }).card === giant);
    expect(ways.length).toBe(1); // only the free way: the {6} cost cannot be paid
    s = resolveAll(drive(act(s, ways[0]!.action)));
    expect(onBf(s, 'Test Giant').length).toBe(1);
    expect(exileCasts(s).length).toBe(0); // "a creature spell": one only
  });
  it('negative: the opponent is offered nothing from your exile, and a creature is not castable at the beginning of combat (normal timing, CR 601.3)', () => {
    let s = resolveAll(activate(start()));
    expect(legalActions(s, 'p2').filter((a) => a.kind === 'cast' && s.objects[(a.action as { card: ObjectId }).card]!.zone === 'exile').length).toBe(0);
    s = advanceTo(s, 1, 'beginCombat');
    expect(exileCasts(s).length).toBe(0); // sorcery timing: the creature cards are not offered outside your main phase with an empty stack
  });
  it('negative: the permission ends with the turn', () => {
    let s = resolveAll(activate(start()));
    expect(exileCasts(s).length).toBe(2);
    s = advanceTo(s, 3, 'main1');
    expect(exileCasts(s).length).toBe(0);
  });
});

// ---- Bottled Cloister: "return all cards you own exiled with ~ to your hand, then draw a card." -----------------------------------------------------------------
const CLOISTER = card('Test Cloister', 'Artifact', "At the beginning of each opponent's upkeep, exile all cards from your hand face down.\nAt the beginning of your upkeep, return all cards you own exiled with this artifact to your hand, then draw a card.");
const FILLER = card('Test Filler', 'Sorcery', '');
describe('CR 607.2a, 400.3, 108.3: "At the beginning of your upkeep, return all cards you own exiled with this artifact to your hand, then draw a card."', () => {
  it('has no manual part', () => expect(full(CLOISTER)).toBe(true));
  it('the cards exiled on the opponent\'s upkeep come back to your hand on your upkeep and you draw one more', () => {
    let s = scenario([], { defs: [CLOISTER, FILLER], p1: { battlefield: ['Test Cloister'], hand: ['Test Filler', 'Test Filler'] } });
    s = advanceTo(s, 2, 'upkeep'); // the opponent's turn: its upkeep exiles Alice's hand
    s = resolveAll(s);
    expect(inExile(s, 'Test Filler').length).toBe(2);
    expect((s.zones.hand['p1'] ?? []).length).toBe(0);
    s = advanceTo(s, 3, 'upkeep');
    s = resolveAll(s);
    expect(inHand(s, 'Test Filler').length).toBe(2);
    expect(inExile(s, 'Test Filler').length).toBe(0);
    expect((s.zones.hand['p1'] ?? []).length).toBe(3); // the two cards and the one drawn (a draw step card is drawn after upkeep)
  });
});

// ---- Hideaway conditions: "a library has twenty or fewer cards in it", "each player has no cards in hand" ---------------------------------------------------------
const LIBCOND = card('Test Gauge', 'Artifact', '{T}: If a library has 20 or fewer cards in it, you gain 5 life.');
const HANDCOND = card('Test Hollow', 'Artifact', '{T}: If each player has no cards in hand, you gain 5 life.');
describe('CR 401.1, 402.1, 102.3: the conditions "a library has N or fewer cards in it" and "each player has no cards in hand"', () => {
  const tap = (s: GameState, name: string): GameState => {
    const la = legalActions(s, 'p1').find((a) => a.kind === 'activate' && !a.isMana && a.object === find(s, name, 'battlefield'));
    if (!la) throw new Error('no activation');
    return resolveAll(drive(act(s, la.action)));
  };
  it('are automated', () => { expect(full(LIBCOND)).toBe(true); expect(full(HANDCOND)).toBe(true); });
  it('a library of exactly N cards counts, whichever player owns it; when every library holds more it does not', () => {
    // (every scenario library holds 20 Plains besides the cards given)
    const both20 = scenario([], { defs: [LIBCOND, FILLER], p1: { battlefield: ['Test Gauge'] } });
    expect(lifeOf(tap(both20, 'Test Gauge'))).toBe(lifeOf(both20) + 5);
    const oppSmall = scenario([], { defs: [LIBCOND, FILLER], p1: { battlefield: ['Test Gauge'], library: ['Test Filler'] } });
    expect(lifeOf(tap(oppSmall, 'Test Gauge'))).toBe(lifeOf(oppSmall) + 5); // your library holds 21, the opponent's holds 20
    const none = scenario([], { defs: [LIBCOND, FILLER], p1: { battlefield: ['Test Gauge'], library: ['Test Filler'] }, p2: { library: ['Test Filler'] } });
    expect(lifeOf(tap(none, 'Test Gauge'))).toBe(lifeOf(none)); // negative: 21 and 21
  });
  it('every hand must be empty, yours included; one card in any hand fails it', () => {
    const empty = scenario([], { defs: [HANDCOND, FILLER], p1: { battlefield: ['Test Hollow'], hand: [] }, p2: { hand: [] } });
    expect(lifeOf(tap(empty, 'Test Hollow'))).toBe(lifeOf(empty) + 5);
    const oppHas = scenario([], { defs: [HANDCOND, FILLER], p1: { battlefield: ['Test Hollow'], hand: [] }, p2: { hand: ['Test Filler'] } });
    expect(lifeOf(tap(oppHas, 'Test Hollow'))).toBe(lifeOf(oppHas)); // negative: Bob has a card
    const youHave = scenario([], { defs: [HANDCOND, FILLER], p1: { battlefield: ['Test Hollow'], hand: ['Test Filler'] }, p2: { hand: [] } });
    expect(lifeOf(tap(youHave, 'Test Hollow'))).toBe(lifeOf(youHave)); // negative: Alice has a card
  });
});

// ---- a static ability reading the same condition (Isleback Spawn: "gets +4/+8 as long as a library has twenty or fewer cards in it") ----------------------------------
const SPAWN = card('Test Spawn', 'Creature — Beast', 'Shroud\nThis creature gets +4/+8 as long as a library has twenty or fewer cards in it.', '{0}', ['4', '4']);
describe('CR 401.1, 613.4c, 611.3a: "as long as a library has twenty or fewer cards in it"', () => {
  it('has no manual part', () => expect(full(SPAWN)).toBe(true));
  it('is +4/+8 while a library holds 20 or fewer cards and plain while every library holds more', () => {
    const small = scenario([], { defs: [SPAWN, FILLER], p1: { battlefield: ['Test Spawn'], library: ['Test Filler'] } }); // yours 21, Bob's 20
    expect(getChars(small, find(small, 'Test Spawn', 'battlefield'))!.toughness).toBe('12');
    const big = scenario([], { defs: [SPAWN, FILLER], p1: { battlefield: ['Test Spawn'], library: ['Test Filler'] }, p2: { library: ['Test Filler'] } });
    expect(getChars(big, find(big, 'Test Spawn', 'battlefield'))!.toughness).toBe('4'); // negative: 21 and 21
  });
});
