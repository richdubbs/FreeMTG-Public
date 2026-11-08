/**
 * Commander coordinator E, round edh-e-66 (groups library; tokens; counters): its cards played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler. Each test is named after the rule it checks, with its negative case. CR cites are from memory (cloud sessions have no rules/cr folder) unless the record says verified.
 *
 *   CR 111.4, 201.5a, 400.7, 604.3, 122.1   "Whenever a nontoken creature you control dies, put a slime counter on ~, then create a green Ooze creature token with "This token's power and toughness
 *                                      are each equal to the number of slime counters on <this enchantment>."" (Gutter Grime; Saproling Burst)
 *   CR 614.12a, 122.1, 614.1c, 122.6   "As ~ enters, remove all counters from all permanents. ~ enters with a +1/+1 counter on it for each counter removed this way." (Thief of Blood;
 *                                      rulings 2015-11-04: loyalty counters are removed from planeswalkers, experience counters are not removed from players)
 *   CR 107.3m, 614.1c, 614.12   "~ enters with X +1/+1 counters on it. If X is 5 or more, it enters with an additional X +1/+1 counters on it." (Apocalypse Hydra; rulings 2009-02-01:
 *                                      the check reads the X chosen, not the mana spent)
 *   CR 603.2, 104.3, 303.4, 800.4a   "When enchanted player loses the game, you gain X life and draw X cards, where X is the number of spite counters on ~." (Curse of Vengeance)
 */
import { describe, expect, it } from 'vitest';
import { getChars, type GameState, type ObjectId } from '../../../src/index';
import { card, cast, full, resolveAll, scenario } from '../r3-cost/support';
import type { PlayerId } from '../../../src/index';
import { find } from '../../m3/scenario';
import { basicLand } from '../../helpers';
import { mpScenario } from '../../m12/rules/helpers';

const pt = (s: GameState, id: ObjectId): string => `${String(getChars(s, id).power)}/${String(getChars(s, id).toughness)}`;
/** The tokens on the battlefield with the given name. */
const tokens = (s: GameState, name: string): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.kind === 'token' && s.defs[s.objects[id]!.defId]!.name === name);
const counters = (s: GameState, id: ObjectId, kind: string): number => (s.objects[id]!.counters as Record<string, number> | undefined)?.[kind] ?? 0;

describe('a token whose ability counts counters on the permanent that made it (CR 111.4, 201.5a, 400.7, 604.3; Gutter Grime)', () => {
  const PIT = card('Test Slime Pit', 'Enchantment', 'Whenever a nontoken creature you control dies, put a slime counter on ~, then create a green Ooze creature token with "This token\'s power and toughness are each equal to the number of slime counters on Test Slime Pit."');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const KILL = card('Test Kill', 'Sorcery', 'Destroy target creature.');
  const SPIRIT = card('Test Spirit', 'Creature — Spirit', '', '{0}', ['1', '1']);
  const defs = [PIT, BEAR, KILL, SPIRIT];
  it('has no manual part', () => expect(full(PIT)).toBe(true));
  const board = (): GameState => scenario([], { p1: { battlefield: ['Test Slime Pit', 'Test Bear', 'Test Bear'], hand: ['Test Kill', 'Test Kill', 'Test Kill'] }, defs } as never);
  const killBear = (s0: GameState): GameState => {
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    return resolveAll(cast(s0, 'Test Kill', { targets: [[{ kind: 'object', id: bear }]] }));
  };
  it('each nontoken creature that dies adds a counter and makes an Ooze whose power and toughness equal the counters on the enchantment', () => {
    const s1 = killBear(board());
    const pit = find(s1, 'Test Slime Pit', 'battlefield', 'p1');
    expect(counters(s1, pit, 'slime')).toBe(1);
    const oozes = tokens(s1, 'Ooze Token');
    expect(oozes.length).toBe(1);
    expect(pt(s1, oozes[0]!)).toBe('1/1');
    // a second death: two counters, both Oozes are 2/2 (the first one counts the counters on the enchantment now, CR 604.3)
    const s2 = killBear(s1);
    const oozes2 = tokens(s2, 'Ooze Token');
    expect(counters(s2, pit, 'slime')).toBe(2);
    expect(oozes2.map((o) => pt(s2, o))).toEqual(['2/2', '2/2']);
  });
  it('a token dying adds nothing (the trigger is for nontoken creatures)', () => {
    const s1 = killBear(board());
    const ooze = tokens(s1, 'Ooze Token')[0]!;
    const s2 = resolveAll(cast(s1, 'Test Kill', { targets: [[{ kind: 'object', id: ooze }]] }));
    expect(counters(s2, find(s2, 'Test Slime Pit', 'battlefield', 'p1'), 'slime')).toBe(1);
  });
});

describe('the permanent that made a token leaves (CR 400.7, 604.3; Gutter Grime rulings 2011-09-22)', () => {
  const PIT = card('Test Slime Pit', 'Enchantment', 'Whenever a nontoken creature you control dies, put a slime counter on ~, then create a green Ooze creature token with "This token\'s power and toughness are each equal to the number of slime counters on Test Slime Pit."');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const KILL = card('Test Kill', 'Sorcery', 'Destroy target creature.');
  const NUKE = card('Test Purge', 'Sorcery', 'Destroy target enchantment.');
  const defs = [PIT, BEAR, KILL, NUKE];
  it('each token remembers which of two copies made it, and a token whose maker left has power and toughness 0 and dies', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Slime Pit', 'Test Slime Pit', 'Test Bear', 'Test Bear'], hand: ['Test Kill', 'Test Purge'] }, defs } as never);
    const pits = s0.zones.battlefield.filter((id) => s0.defs[s0.objects[id]!.defId]!.name === 'Test Slime Pit');
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    // both pits trigger for the one death (order: the engine asks nothing here); each puts a counter on itself and makes its own Ooze
    const s1 = resolveAll(cast(s0, 'Test Kill', { targets: [[{ kind: 'object', id: bear }]] }));
    expect(pits.map((p) => counters(s1, p, 'slime'))).toEqual([1, 1]);
    expect(tokens(s1, 'Ooze Token').map((o) => pt(s1, o))).toEqual(['1/1', '1/1']);
    // destroying one pit: its Ooze becomes 0/0 and dies, the other stays 1/1
    const s2 = resolveAll(cast(s1, 'Test Purge', { targets: [[{ kind: 'object', id: pits[0]! }]] }));
    const left = tokens(s2, 'Ooze Token');
    expect(left.map((o) => pt(s2, o))).toEqual(['1/1']);
    expect(s2.zones.battlefield.includes(pits[1]!)).toBe(true);
  });
});

describe('remove all counters from all permanents as a creature enters (CR 614.12a, 122.1; Thief of Blood)', () => {
  const THIEF = card('Test Counter Thief', 'Creature — Vampire', 'As ~ enters, remove all counters from all permanents. ~ enters with a +1/+1 counter on it for each counter removed this way.', '{0}', ['0', '0']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const SHRINE = card('Test Shrine', 'Enchantment', '');
  const defs = [THIEF, BEAR, SHRINE];
  it('has no manual part', () => expect(full(THIEF)).toBe(true));
  const withCounters = (): GameState => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear', 'Test Shrine'], hand: ['Test Counter Thief'] }, p2: { battlefield: ['Test Bear'] }, defs } as never);
    s0.objects[find(s0, 'Test Bear', 'battlefield', 'p1')]!.counters = { '+1/+1': 2, shield: 1 } as never;
    s0.objects[find(s0, 'Test Shrine', 'battlefield', 'p1')]!.counters = { time: 3 } as never;
    s0.objects[find(s0, 'Test Bear', 'battlefield', 'p2')]!.counters = { '-1/-1': 1 } as never;
    return s0;
  };
  it('every counter of every kind on every permanent (any controller) is removed, and it enters with one +1/+1 counter for each', () => {
    const s1 = resolveAll(cast(withCounters(), 'Test Counter Thief'));
    const total = (id: ObjectId): number => Object.values(s1.objects[id]!.counters as Record<string, number>).reduce((n, c) => n + c, 0);
    expect(total(find(s1, 'Test Bear', 'battlefield', 'p1'))).toBe(0);
    expect(total(find(s1, 'Test Shrine', 'battlefield', 'p1'))).toBe(0);
    expect(total(find(s1, 'Test Bear', 'battlefield', 'p2'))).toBe(0);
    const thief = find(s1, 'Test Counter Thief', 'battlefield', 'p1');
    expect(counters(s1, thief, '+1/+1')).toBe(7);
    expect(pt(s1, thief)).toBe('7/7');
  });
  it('with no counters anywhere it enters with none (a 0/0 that dies)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear'], hand: ['Test Counter Thief'] }, defs } as never);
    const s1 = resolveAll(cast(s0, 'Test Counter Thief'));
    expect(s1.zones.battlefield.some((id) => s1.defs[s1.objects[id]!.defId]!.name === 'Test Counter Thief')).toBe(false);
  });
});

describe('an additional X counters when X is high enough (CR 107.3m, 614.1c; Apocalypse Hydra)', () => {
  const HYDRA = card('Test X Hydra', 'Creature — Hydra', '~ enters with X +1/+1 counters on it. If X is 3 or more, it enters with an additional X +1/+1 counters on it.', '{X}{G}', ['0', '0'], ['G']);
  it('has no manual part', () => expect(full(HYDRA)).toBe(true));
  const play = (x: number): GameState => {
    const lands = Array(x + 1).fill('Forest') as string[];
    const s0 = scenario([], { p1: { battlefield: lands, hand: ['Test X Hydra'] }, defs: [HYDRA, basicLand('Forest', 'Forest')] } as never);
    return resolveAll(cast(s0, 'Test X Hydra', { x: [x] }));
  };
  it('X = 3 (the threshold) enters with 6 counters, X = 2 with 2 (the first sentence only), X = 5 with 10', () => {
    const s3 = play(3);
    expect(counters(s3, find(s3, 'Test X Hydra', 'battlefield', 'p1'), '+1/+1')).toBe(6);
    const s2 = play(2);
    expect(counters(s2, find(s2, 'Test X Hydra', 'battlefield', 'p1'), '+1/+1')).toBe(2);
    const s5 = play(5);
    expect(counters(s5, find(s5, 'Test X Hydra', 'battlefield', 'p1'), '+1/+1')).toBe(10);
  });
});

describe('when enchanted player loses the game (CR 603.2, 104.3b, 303.4, 800.4a; Curse of Vengeance)', () => {
  const CURSE = card('Test Spite Curse', 'Enchantment — Aura Curse', 'Enchant player\nWhen enchanted player loses the game, you gain X life and draw X cards, where X is the number of spite counters on ~.');
  const DOOM = card('Test Ruin Word', 'Sorcery', 'Target player loses 20 life.');
  it('has no manual part', () => expect(full(CURSE)).toBe(true));
  const game = (enchanted: PlayerId): GameState => mpScenario({
    defs: [CURSE, DOOM], zones: { p1: { battlefield: ['Test Spite Curse'], hand: ['Test Ruin Word'] } },
    setup: (x) => { const c = find(x, 'Test Spite Curse', 'battlefield', 'p1'); x.objects[c]!.attachedTo = enchanted; x.objects[c]!.counters = { spite: 3 } as never; },
  });
  it('the Curse controller gains X life and draws X cards when the enchanted player loses', () => {
    const s0 = game('p2');
    const hand0 = s0.zones.hand.p1!.length;
    const life0 = s0.players.find((p) => p.id === 'p1')!.life;
    const s1 = resolveAll(cast(s0, 'Test Ruin Word', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(s1.players.find((p) => p.id === 'p2')!.life).toBeLessThanOrEqual(0);
    expect(s1.players.find((p) => p.id === 'p1')!.life).toBe(life0 + 3);
    expect(s1.zones.hand.p1!.length).toBe(hand0 - 1 + 3); // the sorcery left the hand, three cards drawn
  });
  it('another player losing does nothing', () => {
    const s0 = game('p2');
    const life0 = s0.players.find((p) => p.id === 'p1')!.life;
    const s1 = resolveAll(cast(s0, 'Test Ruin Word', { targets: [[{ kind: 'player', id: 'p3' }]] }));
    expect(s1.players.find((p) => p.id === 'p1')!.life).toBe(life0);
  });
});
