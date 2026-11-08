/**
 * edh-e-26 (Commander coordinator E, hand and draw wordings): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites are from memory unless the
 * record lists them as checked against the 2026-09-25 Comprehensive Rules.
 *
 *   CR 400.3, 608.2c, 701.8? no: 400.3   "Return any number of <lands> you control to their owner's hand. ... for each <land> returned this way" (Barrel Down Sokenzan family)
 *   CR 701.9a, 121.2, 608.2c           "Draw a card and reveal it. If it isn't a land card, discard it." (Fa'adiyah Seer, Sindbad)
 *   CR 107.3, 701.20e, 701.9a, 609.3   "Look at target player's hand and choose X cards from it. That player discards those cards." (Mind Warp, Abandon Hope)
 *   CR 701.50a, 603.12                 "it connives. When it connives this way, ..." (Psychic Pickpocket, Obscura Interceptor)
 *   CR 701.17a, 608.2c                 "mill N cards, then you may put a <card> from among the milled cards into your hand" (T'Chaka, Venerable King)
 */
import { describe, expect, it } from 'vitest';
import { type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { answer, passBoth } from '../r3-cost/support';
import { activations, card, cast, full, lifeOf, named, obj, resolveAll } from '../r4-cost/support';

const zoneOf = (s: GameState, p: PlayerId, z: 'hand' | 'graveyard' | 'battlefield' | 'library'): string[] => (z === 'battlefield' ? s.zones.battlefield.filter((id) => s.objects[id]!.controller === p) : s.zones[z][p]!).map((id) => s.objects[id]!.defId);
const count = (xs: string[], n: string): number => xs.filter((x) => x === n).length;
const BEAR = card('Test Bear', 'Creature — Bear', '', '{1}', ['4', '4']);
const RELIC = card('Test Relic', 'Artifact', '');
const SWAMP = card('Test Fen', 'Basic Land — Swamp', '');

describe('CR 400.3, 608.2c: "for each X returned this way" counts the permanents the return moved', () => {
  const SEAR = card('Test Sear', 'Instant', "Return any number of Swamps you control to their owner's hand. Test Sear deals damage to target creature equal to twice the number of Swamps returned this way.");
  const PINCH = card('Test Pinch', 'Sorcery', "Return any number of Swamps you control to their owner's hand. Target player discards a card for each Swamp returned this way.");
  const board = (): GameState => mpScenario({ defs: [SEAR, PINCH, BEAR, SWAMP], zones: { p1: { hand: ['Test Sear', 'Test Pinch'], battlefield: ['Test Fen', 'Test Fen', 'Test Fen'] }, p2: { battlefield: ['Test Bear'], hand: ['Plains', 'Plains', 'Plains'] } } });
  it('are full', () => { expect(full(SEAR)).toBe(true); expect(full(PINCH)).toBe(true); });
  it('two Swamps returned: 4 damage to the target creature', () => {
    let s = board();
    const fens = named(s, 'Test Fen');
    s = cast(s, 'Test Sear', { objects: [[fens[0]!, fens[1]!]], targets: [[obj(named(s, 'Test Bear')[0]!)]] });
    s = resolveAll(s, { objects: [[fens[0]!, fens[1]!]] });
    expect(count(zoneOf(s, 'p1', 'hand'), 'Test Fen')).toBe(2);
    expect(named(s, 'Test Bear')).toHaveLength(0);
  });
  it('negative: none returned means 0 damage and nothing moves', () => {
    let s = board();
    s = cast(s, 'Test Sear', { objects: [[]], targets: [[obj(named(s, 'Test Bear')[0]!)]] });
    s = resolveAll(s, { objects: [[]] });
    expect(named(s, 'Test Bear')).toHaveLength(1);
    expect(count(zoneOf(s, 'p1', 'hand'), 'Test Fen')).toBe(0);
  });
  it('a card is discarded for each Swamp returned (the target player discards that many)', () => {
    let s = board();
    const fens = named(s, 'Test Fen');
    s = cast(s, 'Test Pinch', { objects: [[fens[0]!, fens[1]!]], targets: [[{ kind: 'player', id: 'p2' }]] });
    s = resolveAll(s, { objects: [[fens[0]!, fens[1]!]] });
    expect(zoneOf(s, 'p2', 'hand')).toHaveLength(1);
    expect(zoneOf(s, 'p2', 'graveyard')).toHaveLength(2);
  });
});

describe('CR 701.9a, 121.2, 608.2c: "Draw a card and reveal it. If it isn\'t an artifact card, discard it."', () => {
  const SIFT = card('Test Sift', 'Artifact', "{T}: Draw a card and reveal it. If it isn't an artifact card, discard it.");
  const TRINKET = card('Test Trinket', 'Artifact', '');
  const board = (top: string): GameState => mpScenario({ defs: [SIFT, TRINKET], zones: { p1: { battlefield: ['Test Sift'], library: ['Plains', top] } } });
  it('is full', () => expect(full(SIFT)).toBe(true));
  it('the drawn non-artifact card is discarded (it, not another card of the hand)', () => {
    let s = board('Plains');
    const handBefore = zoneOf(s, 'p1', 'hand').length;
    s = resolveAll(act(s, activations(s, 'Test Sift')[0]!.action));
    expect(zoneOf(s, 'p1', 'hand')).toHaveLength(handBefore);
    expect(count(zoneOf(s, 'p1', 'graveyard'), 'Plains')).toBe(1);
  });
  it('negative: the drawn artifact card stays in the hand', () => {
    let s = board('Test Trinket');
    const handBefore = zoneOf(s, 'p1', 'hand').length;
    s = resolveAll(act(s, activations(s, 'Test Sift')[0]!.action));
    expect(zoneOf(s, 'p1', 'hand')).toHaveLength(handBefore + 1);
    expect(zoneOf(s, 'p1', 'graveyard')).toHaveLength(0);
  });
});

describe('CR 107.3, 701.20e, 701.9a, 609.3: "Look at target opponent\'s hand and choose X nonland cards from it. That player discards those cards."', () => {
  const PROBE = card('Test Probe', 'Sorcery', "Look at target opponent's hand and choose X nonland cards from it. That player discards those cards.", '{X}');

  const board = (): GameState => mpScenario({ defs: [PROBE, RELIC], zones: { p1: { hand: ['Test Probe'], battlefield: ['Plains', 'Plains', 'Plains', 'Plains'] }, p2: { hand: ['Test Relic', 'Test Relic', 'Test Relic', 'Plains'] } } });
  it('is full', () => expect(full(PROBE)).toBe(true));
  it('X = 2: you choose two nonland cards of their hand and exactly those are discarded', () => {
    let s = board();
    const relics = s.zones.hand.p2!.filter((id) => s.objects[id]!.defId === 'Test Relic');
    s = cast(s, 'Test Probe', { x: [2], targets: [[{ kind: 'player', id: 'p2' }]] });
    s = resolveAll(s, { objects: [[relics[0]!, relics[2]!]] });
    expect(zoneOf(s, 'p2', 'graveyard').sort()).toEqual(['Test Relic', 'Test Relic']);
    expect(s.zones.hand.p2).toContain(relics[1]);
    expect(count(zoneOf(s, 'p2', 'hand'), 'Plains')).toBe(1);
  });
  it('negative: X = 0 discards nothing', () => {
    let s = board();
    s = cast(s, 'Test Probe', { x: [0], targets: [[{ kind: 'player', id: 'p2' }]] });
    s = resolveAll(s);
    expect(zoneOf(s, 'p2', 'graveyard')).toHaveLength(0);
    expect(zoneOf(s, 'p2', 'hand')).toHaveLength(4);
  });
  it('X larger than the nonland cards they have: they discard the cards that match (CR 609.3), never the land', () => {
    let s = board();
    s = cast(s, 'Test Probe', { x: [4], targets: [[{ kind: 'player', id: 'p2' }]] });
    s = resolveAll(s);
    expect(count(zoneOf(s, 'p2', 'graveyard'), 'Test Relic')).toBe(3);
    expect(count(zoneOf(s, 'p2', 'hand'), 'Plains')).toBe(1);
  });
});

describe('CR 701.50a, 603.12: "it connives. When it connives this way, ..."', () => {
  const SNEAK = card('Test Sneak', 'Creature — Rogue', "When Test Sneak enters, it connives. When it connives this way, you gain 3 life.", '{0}', ['1', '1']);
  it('is full', () => expect(full(SNEAK)).toBe(true));
  it('the reflexive trigger resolves after the connive (draw, discard, counter if nonland): 3 life', () => {
    let s = mpScenario({ defs: [SNEAK], zones: { p1: { hand: ['Test Sneak'] } } });
    const before = lifeOf(s, 'p1');
    s = resolveAll(cast(s, 'Test Sneak'));
    expect(lifeOf(s, 'p1')).toBe(before + 3);
    expect(named(s, 'Test Sneak')).toHaveLength(1);
    expect(zoneOf(s, 'p1', 'graveyard')).toHaveLength(1);
  });
});

describe('CR 701.17a, 608.2c: "Mill N cards, then you may put a <description> card from among the milled cards into your hand."', () => {
  const GRIST = card('Test Grist', 'Creature — Elf', 'When Test Grist enters, mill three cards, then you may put a land card from among the milled cards into your hand.', '{0}', ['1', '1']);
  it('is full', () => expect(full(GRIST)).toBe(true));
  it('one matching card of the milled ones goes to the hand; the others stay in the graveyard', () => {
    let s = mpScenario({ defs: [GRIST, RELIC], zones: { p1: { hand: ['Test Grist'], library: ['Plains', 'Test Relic', 'Test Relic', 'Plains'] } } });
    s = cast(s, 'Test Grist');
    for (let i = 0; i < 12 && s.pending?.kind !== 'chooseObjects'; i++) s = passBoth(s); // the enters trigger resolves: mill three, then the choice among the milled cards
    expect(s.pending?.kind).toBe('chooseObjects');
    const land = (s.pending as { options: ObjectId[] }).options.filter((id) => s.objects[id]!.defId === 'Plains');
    expect((s.pending as { options: ObjectId[] }).options).toHaveLength(1); // only the land card of the three milled is a choice
    s = resolveAll(answer(s, { kind: 'chooseObjects', ids: land }));
    expect(zoneOf(s, 'p1', 'graveyard').sort()).toEqual(['Test Relic', 'Test Relic']);
    expect(count(zoneOf(s, 'p1', 'hand'), 'Plains')).toBe(2); // the one drawn in the draw step and the milled one
  });
  it('negative: declining (the choice is optional) puts all three milled cards in the graveyard', () => {
    let s = mpScenario({ defs: [GRIST, RELIC], zones: { p1: { hand: ['Test Grist'], library: ['Plains', 'Test Relic', 'Test Relic', 'Plains'] } } });
    s = resolveAll(cast(s, 'Test Grist'), { objects: [[]] });
    expect(zoneOf(s, 'p1', 'graveyard')).toHaveLength(3);
    expect(count(zoneOf(s, 'p1', 'hand'), 'Plains')).toBe(1);
  });
});
