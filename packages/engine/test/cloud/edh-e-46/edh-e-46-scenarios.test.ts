/**
 * edh-e-46 (Commander coordinator E, second batch, group cost): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented
 * names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites are from memory of the 2026-09-25 text unless
 * the record says it checked them.
 *
 *   CR 601.2c, 601.2f, 119.4          "~ costs 3 life more to cast for each target." (Phyrexian Purge)
 *   CR 303.4, 115.1, 601.2f           "Spells you cast that target enchanted player cost {1} less to cast." (Infectious Curse, the back of Accursed Witch)
 *   CR 615.1a, 510.1, 118.8, 601.2b   "As an additional cost to cast ~, you may pay {2}{R}. Prevent all combat damage that would be dealt this turn. If ~'s additional cost was paid, this effect doesn't affect combat damage dealt by red creatures." (Undergrowth)
 *   CR 702.29a, 118.9, 602.2b, 611.3a "As long as you have seven or more cards in hand, you may pay {0} rather than pay cycling costs." (New Perspectives)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId, TargetChoice } from '../../../src/index';
import { act, answer, attackWith, find, legal } from '../r4-cost/support';
import { card, drive, full, resolveAll } from '../r3-cost/support';
import { mpScenario } from '../../m12/rules/helpers';

const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const obj = (id: string): TargetChoice => ({ kind: 'object', id });
const ply = (id: PlayerId): TargetChoice => ({ kind: 'player', id });
const zoneOf = (s: GameState, name: string): string => s.objects[Object.keys(s.objects).find((id) => s.objects[id]!.defId === name)!]!.zone;
const manaLeft = (s: GameState, p: PlayerId): number => s.zones.battlefield.filter((id) => s.objects[id]!.controller === p && ['Plains', 'Mountain'].includes(s.objects[id]!.defId) && !s.objects[id]!.tapped).length;

// ---- Phyrexian Purge -----------------------------------------------------------------------------------------------------------------------------------
describe('CR 601.2c, 601.2f, 119.4: "~ costs 3 life more to cast for each target."', () => {
  const PURGE = card('Test Purge', 'Sorcery', '~ costs 3 life more to cast for each target.\nDestroy any number of target creatures.', '{0}', undefined, ['B']);
  const OGRE = card('Test Ogre', 'Creature — Ogre', '', '{0}', ['2', '2']);
  const defs = [PURGE, OGRE];
  const setup = (life?: number): GameState => mpScenario({ defs, ...(life !== undefined ? { life } : {}), zones: { p1: { hand: ['Test Purge'] }, p2: { battlefield: ['Test Ogre', 'Test Ogre'] }, p3: { battlefield: ['Test Ogre'] } } });
  const ogres = (s: GameState): string[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Ogre');
  const castAt = (s: GameState, n: number): GameState => {
    const hand = find(s, 'Test Purge', 'hand', 'p1');
    return drive(act(s, { type: 'cast', player: 'p1', card: hand }), { targets: [ogres(s).slice(0, n).map(obj)] });
  };
  it('is full', () => expect(full(PURGE), JSON.stringify(PURGE.automation)).toBe(true));
  it('each target costs 3 life: two targets cost 6 life and both are destroyed, with the other creature untouched', () => {
    const s0 = setup();
    const s = resolveAll(castAt(s0, 2));
    expect(lifeOf(s, 'p1')).toBe(14);
    expect(ogres(s)).toHaveLength(1);
  });
  it('three targets cost 9 life; no targets cost no life (the multiple is the number of targets)', () => {
    const s3 = resolveAll(castAt(setup(), 3));
    expect(lifeOf(s3, 'p1')).toBe(11);
    expect(ogres(s3)).toHaveLength(0);
    const s0 = resolveAll(castAt(setup(), 0));
    expect(lifeOf(s0, 'p1')).toBe(20);
    expect(zoneOf(s0, 'Test Purge')).toBe('graveyard');
  });
  it('CR 119.4, 601.2h: with 5 life the player can pay for one target (3 life) but not for two (6 life), so that cast is refused', () => {
    const low = setup(5);
    const hand = find(low, 'Test Purge', 'hand', 'p1');
    const one = resolveAll(castAt(low, 1));
    expect(lifeOf(one, 'p1')).toBe(2);
    const s1 = act(low, { type: 'cast', player: 'p1', card: hand });
    expect(s1.pending?.kind).toBe('chooseTargets');
    expect(() => answer(s1, { kind: 'chooseTargets', targets: ogres(low).slice(0, 2).map(obj) })).toThrow(/life/i);
  });
  it('negative: a spell without the ability costs no life for its targets', () => {
    const PLAIN = card('Test Plain Purge', 'Sorcery', 'Destroy any number of target creatures.', '{0}');
    const s0 = mpScenario({ defs: [PLAIN, OGRE], zones: { p1: { hand: ['Test Plain Purge'] }, p2: { battlefield: ['Test Ogre', 'Test Ogre'] } } });
    const targets = s0.zones.battlefield.filter((id) => s0.objects[id]!.defId === 'Test Ogre');
    const s = resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Plain Purge', 'hand', 'p1') }), { targets: [targets.map(obj)] }));
    expect(lifeOf(s, 'p1')).toBe(20);
  });
});

// ---- Infectious Curse ----------------------------------------------------------------------------------------------------------------------------------
describe('CR 303.4, 115.1, 601.2f: "Spells you cast that target enchanted player cost {1} less to cast."', () => {
  const CURSE = card('Test Curse', 'Enchantment — Aura Curse', 'Enchant player\nSpells you cast that target enchanted player cost {1} less to cast.');
  const HEX = card('Test Hex', 'Instant', 'Test Hex deals 1 damage to target player.', '{2}');
  const defs = [CURSE, HEX];
  const setup = (cursed: PlayerId = 'p2'): GameState => mpScenario({
    defs, zones: { p1: { hand: ['Test Hex'], battlefield: ['Plains', 'Plains'] }, p3: { battlefield: ['Test Curse'] } },
    setup: (s) => { const c = s.zones.battlefield.find((id) => s.objects[id]!.defId === 'Test Curse')!; s.objects[c]!.attachedTo = cursed; s.objects[c]!.controller = 'p1'; },
  });
  const hexAt = (s: GameState, who: PlayerId): GameState => resolveAll(drive(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Hex', 'hand', 'p1') }), { targets: [[ply(who)]] }));
  it('is full', () => expect(full(CURSE), JSON.stringify(CURSE.automation)).toBe(true));
  it('a spell you cast that targets the enchanted player costs {1} less (one of the two lands is left untapped); the damage is dealt', () => {
    const s = hexAt(setup(), 'p2');
    expect(lifeOf(s, 'p2')).toBe(19);
    expect(manaLeft(s, 'p1')).toBe(1);
  });
  it('negative: a spell that targets another player costs its full {2}', () => {
    const s = hexAt(setup(), 'p3');
    expect(lifeOf(s, 'p3')).toBe(19);
    expect(manaLeft(s, 'p1')).toBe(0);
  });
  it('negative: only the Aura\'s controller gets the reduction: a spell another player casts at the enchanted player is not cheaper', () => {
    const s0 = mpScenario({
      defs, zones: { p2: { hand: ['Test Hex'], battlefield: ['Plains', 'Plains'] }, p3: { battlefield: ['Test Curse'] } },
      setup: (s) => { const c = s.zones.battlefield.find((id) => s.objects[id]!.defId === 'Test Curse')!; s.objects[c]!.attachedTo = 'p4'; s.objects[c]!.controller = 'p1'; },
    });
    const passed = act(s0, { type: 'pass', player: 'p1' });
    const s = resolveAll(drive(act(passed, { type: 'cast', player: 'p2', card: find(passed, 'Test Hex', 'hand', 'p2') }), { targets: [[ply('p4')]] }));
    expect(lifeOf(s, 'p4')).toBe(19);
    expect(manaLeft(s, 'p2')).toBe(0);
  });
});

// ---- New Perspectives ----------------------------------------------------------------------------------------------------------------------------------
describe('CR 702.29a, 118.9, 602.2b, 611.3a: "As long as you have seven or more cards in hand, you may pay {0} rather than pay cycling costs."', () => {
  const NEW = card('Test Perspectives', 'Enchantment', 'As long as you have seven or more cards in hand, you may pay {0} rather than pay cycling costs.');
  const CYC = card('Test Cycler', 'Sorcery', 'Cycling {3}\nYou gain 1 life.', '{5}');
  const FEE = card('Test Life Cycler', 'Sorcery', 'Cycling—Pay 2 life.\nYou gain 1 life.', '{5}');
  const FILL = card('Test Filler', 'Sorcery', 'You gain 1 life.', '{5}');
  const defs = [NEW, CYC, FEE, FILL];
  const offers = (s: GameState, name: string, p: PlayerId = 'p1'): number => legal(s, p, 'activate').filter((x) => x.object === find(s, name, 'hand', p)).length;
  // (the scenario's first player has drawn a Plains by the first main phase: p1 holds `fill` + 2 cards, p2 `fill` + 1)
  const hand = (cycler: string, fill: number): string[] => [cycler, ...Array(fill).fill('Test Filler') as string[]];
  it('is full', () => expect(full(NEW), JSON.stringify(NEW.automation)).toBe(true));
  it('with seven cards in hand (the cycled card counts) cycling costs nothing, with no mana at all; the card is cycled', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: hand('Test Cycler', 5), battlefield: ['Test Perspectives'] } } });
    expect(s0.zones.hand.p1!.length).toBe(7);
    expect(offers(s0, 'Test Cycler')).toBe(1);
    const a = legal(s0, 'p1', 'activate').find((x) => x.object === find(s0, 'Test Cycler', 'hand', 'p1'))!;
    const s1 = resolveAll(drive(act(s0, a.action)));
    expect(zoneOf(s1, 'Test Cycler')).toBe('graveyard');
    expect(s1.zones.hand.p1!.length).toBe(7); // 7 - the cycled card + the card it drew
  });
  it('negative: with six cards in hand the condition is not met and cycling still costs {3}', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: hand('Test Cycler', 4), battlefield: ['Test Perspectives'] } } });
    expect(s0.zones.hand.p1!.length).toBe(6);
    expect(offers(s0, 'Test Cycler')).toBe(0);
  });
  it('negative: without the enchantment seven cards in hand change nothing', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: hand('Test Cycler', 5) } } });
    expect(offers(s0, 'Test Cycler')).toBe(0);
  });
  it('negative: it is "you": another player with the enchantment out and seven cards in hand gets no free cycling', () => {
    const s0 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Perspectives'] }, p2: { hand: hand('Test Cycler', 6) } } });
    expect(s0.zones.hand.p2!.length).toBe(7);
    const pass = act(s0, { type: 'pass', player: 'p1' });
    expect(offers(pass, 'Test Cycler', 'p2')).toBe(0);
  });
  it('a cycling cost that is not mana (pay life) is not changed by the option (the option is not taken for a cost it does not replace in this engine)', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: hand('Test Life Cycler', 5), battlefield: ['Test Perspectives'] } } });
    const a = legal(s0, 'p1', 'activate').find((x) => x.object === find(s0, 'Test Life Cycler', 'hand', 'p1'));
    expect(a).toBeDefined(); // payable with life as it prints
    const s1 = resolveAll(drive(act(s0, a!.action)));
    expect(lifeOf(s1, 'p1')).toBe(18); // the printed cost was paid (2 life)
  });
});

// ---- Undergrowth ---------------------------------------------------------------------------------------------------------------------------------------
describe('CR 615.1a, 510.1, 118.8, 601.2b: "As an additional cost to cast ~, you may pay {2}{R}. Prevent all combat damage that would be dealt this turn. If ~\'s additional cost was paid, this effect doesn\'t affect combat damage that would be dealt by red creatures."', () => {
  const FOG = card('Test Undergrowth', 'Instant', "As an additional cost to cast this spell, you may pay {2}{R}.\nPrevent all combat damage that would be dealt this turn. If this spell's additional cost was paid, this effect doesn't affect combat damage that would be dealt by red creatures.", '{0}', undefined, ['G']);
  const RED = card('Test Red Bear', 'Creature — Bear', '', '{0}', ['2', '2'], ['R']);
  const GREEN = card('Test Green Bear', 'Creature — Bear', '', '{0}', ['3', '3'], ['G']);
  const defs = [FOG, RED, GREEN];
  const setup = (lands: number): GameState => mpScenario({ defs, cards: ['Mountain'], zones: { p1: { hand: ['Test Undergrowth'], battlefield: ['Test Red Bear', 'Test Green Bear', ...Array(lands).fill('Mountain') as string[]] } } });
  /** Cast the spell in the first main phase (paying the additional cost or not), then attack p2 with both bears. */
  const play = (s0: GameState, pay: boolean): GameState => {
    const s1 = resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Undergrowth', 'hand', 'p1') }), { yes: [pay] }));
    const bears = s1.zones.battlefield.filter((id) => s1.objects[id]!.defId.endsWith('Bear'));
    return attackWith(s1, bears, 'p2');
  };
  it('is full', () => expect(full(FOG), JSON.stringify(FOG.automation)).toBe(true));
  it('unpaid: all combat damage this turn is prevented (neither bear hurts the player)', () => {
    expect(lifeOf(play(setup(3), false), 'p2')).toBe(20);
  });
  it('paid: combat damage dealt by red creatures is not prevented, any other is (2 from the red bear, none from the green one)', () => {
    const s = play(setup(3), true);
    expect(lifeOf(s, 'p2')).toBe(18);
    expect(manaLeft(s, 'p1')).toBe(0); // the three lands were tapped for {2}{R}
  });
  it('negative: without the mana for the additional cost it can\'t be paid (the spell is still cast, unpaid)', () => {
    expect(lifeOf(play(setup(0), true), 'p2')).toBe(20);
  });
});
void obj; void ply;

// ---- review finding: an alternative cycling cost still takes cost increases ----------------------------------------------------------------------------------
describe('CR 118.9, 601.2f, 602.2b: the {0} of New Perspectives is the cycling cost; an increase of activation costs still applies to it', () => {
  const NEW = card('Test Perspectives', 'Enchantment', 'As long as you have seven or more cards in hand, you may pay {0} rather than pay cycling costs.');
  const TAX = card('Test Tax', 'Enchantment', "Activated abilities cost {2} more to activate unless they're mana abilities.");
  const CYC = card('Test Cycler', 'Sorcery', 'Cycling {3}\nYou gain 1 life.', '{5}');
  const FILL = card('Test Filler', 'Sorcery', 'You gain 1 life.', '{5}');
  const defs = [NEW, TAX, CYC, FILL];
  const offers = (s: GameState): number => legal(s, 'p1', 'activate').filter((x) => x.object === find(s, 'Test Cycler', 'hand', 'p1')).length;
  const hand = ['Test Cycler', ...Array(5).fill('Test Filler') as string[]];
  it('with the tax and no mana the free cycling is not offered; with {2} it is (and costs exactly {2}, not {3}+{2})', () => {
    const none = mpScenario({ defs, zones: { p1: { hand, battlefield: ['Test Perspectives', 'Test Tax'] } } });
    expect(none.zones.hand.p1!.length).toBe(7);
    expect(offers(none)).toBe(0);
    const two = mpScenario({ defs, zones: { p1: { hand, battlefield: ['Test Perspectives', 'Test Tax', 'Plains', 'Plains'] } } });
    expect(offers(two)).toBe(1);
  });
});
