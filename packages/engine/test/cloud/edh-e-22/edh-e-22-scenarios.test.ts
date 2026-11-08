/**
 * edh-e-22 (Commander coordinator E, group type-change): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites are from memory in the
 * cloud session (no rules/cr folder) and are listed as unverified in the record unless noted.
 *
 *   CR 205.1b, 205.3m, 613.1d-f, 613.4b, 611.2a   "becomes a Golem with base power and toughness 4/4, flying, and haste" (Bogardan Dragonheart)
 *   CR 613.1d-f, 613.4b, 611.2a                   "becomes a blue and red Dragon with base power and toughness 4/4, loses all abilities, and gains flying" (Dragonshift, Dance of the Skywise)
 *   CR 205.1a, 613.1d, 613.4b                     "becomes a 4/4 Angel artifact creature and gains flying" (Majestic Metamorphosis); "becomes a 4/4 green Bear artifact creature" (Stuffed Bear)
 *   CR 205.1b, 611.2a                             "Target land becomes a 3/3 artifact creature that's still a land." (Mishra's Groundbreaker); "becomes a 3/1 creature. It's still a land." (Siege of Towers)
 *   CR 205.3g, 205.1b, 613.1d                     "becomes a 4/4 Spirit artifact creature that's no longer an Equipment" (Haunted Plate Mail)
 *   CR 608.2h, 611.2c, 613.4b                     "~'s base power and toughness become equal to that creature's power and toughness until end of turn" (Shape Stealer)
 *   CR 205.3m, 613.1d, 613.1f, 611.2a             "it becomes a Bird Giant, and it loses defender" (Ageless Sentinels)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { getChars, hasKeyword as hasKw } from '../../../src/rules/characteristics';
import { act, answer, pass } from '../../m3/scenario';
import { find, mpScenario } from '../../m12/rules/helpers';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers } from '../../m4/helpers';
import { activations, card, cast, drive, full, named, obj, resolveAll } from '../r4-cost/support';

const ch = (s: GameState, id: ObjectId) => getChars(s, id)!;
const hasKeyword = (s: GameState, id: ObjectId, k: string): boolean => hasKw(ch(s, id), k);
const pt = (s: GameState, id: ObjectId): [number, number] => [Number(ch(s, id).power), Number(ch(s, id).toughness)];
/** Pass (declaring no attackers and no blockers) until `done`. */
function skipUntil(s0: GameState, done: (s: GameState) => boolean, what: string, max = 800): GameState {
  let s = s0;
  for (let i = 0; i < max; i++) {
    if (done(s)) return s;
    if (s.result) throw new Error(`The game ended while waiting for ${what}`);
    if (s.pending?.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
    else if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else if (s.pending?.kind === 'priority') s = pass(s);
    else throw new Error(`Waiting for ${what} but a ${s.pending?.kind} decision is pending`);
  }
  throw new Error(`Never reached ${what}`);
}
const nextTurn = (s: GameState): GameState => { const n = s.turn.number; return skipUntil(s, (x) => x.turn.number > n && x.turn.step === 'upkeep', 'the next turn'); };
const activate = (s: GameState, name: string, targets: ObjectId[][] = []): GameState =>
  resolveAll(drive(act(s, activations(s, name)[0]!.action), { targets: targets.map((t) => t.map((id) => obj(id))) }));

const BEAR = card('Test Bear', 'Creature — Bear', 'Trample', '{2}', ['2', '2']);
const OTHER = card('Test Wolf', 'Creature — Wolf', '', '{2}', ['3', '1']);
const idOf = (s: GameState, name: string, owner: 'p1' | 'p2' = 'p1') => find(s, name, 'battlefield', owner);

// ---- Bogardan Dragonheart ----------------------------------------------------------------------------------------------------------------------------------------------
const HEART = card('Test Heart', 'Creature — Human Shaman', '{0}: Until end of turn, ~ becomes a Golem with base power and toughness 4/4, flying, and haste.', '{1}', ['1', '1']);
describe('CR 205.3m, 613.1d, 613.1f, 613.4b, 611.2a: "~ becomes a Golem with base power and toughness 4/4, flying, and haste" until end of turn', () => {
  const board = () => mpScenario({ defs: [HEART, OTHER], zones: { p1: { battlefield: ['Test Heart', 'Test Wolf'] } } });
  it('is full', () => expect(full(HEART)).toBe(true));
  it('it is a 4/4 Golem (its other creature types replaced) with flying and haste until end of turn, and the other creature is unchanged', () => {
    let s = activate(board(), 'Test Heart');
    const h = idOf(s, 'Test Heart');
    expect(pt(s, h)).toEqual([4, 4]);
    expect(ch(s, h).subtypes).toEqual(['Golem']);
    expect(hasKeyword(s, h, 'flying') && hasKeyword(s, h, 'haste')).toBe(true);
    expect(pt(s, idOf(s, 'Test Wolf'))).toEqual([3, 1]);
    expect(hasKeyword(s, idOf(s, 'Test Wolf'), 'flying')).toBe(false);
  });
  it('negative: at the next turn it is a 1/1 Human Shaman without flying again', () => {
    const s = nextTurn(activate(board(), 'Test Heart'));
    const h = idOf(s, 'Test Heart');
    expect(pt(s, h)).toEqual([1, 1]);
    expect(ch(s, h).subtypes).toEqual(['Human', 'Shaman']);
    expect(hasKeyword(s, h, 'flying')).toBe(false);
  });
});

// ---- Dragonshift / Dance of the Skywise ---------------------------------------------------------------------------------------------------------------------------------
const SHIFT = card('Test Shift', 'Instant', 'Until end of turn, target creature you control becomes a blue and red Dragon with base power and toughness 4/4, loses all abilities, and gains flying.');
describe('CR 613.1d-f, 613.4b, 611.2a: "becomes a blue and red Dragon with base power and toughness 4/4, loses all abilities, and gains flying" until end of turn', () => {
  const board = () => mpScenario({ defs: [SHIFT, BEAR, OTHER], zones: { p1: { hand: ['Test Shift'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Wolf'] } } });
  const play = (s: GameState) => resolveAll(cast(s, 'Test Shift', { targets: [[obj(idOf(s, 'Test Bear'))]] }));
  it('is full', () => expect(full(SHIFT)).toBe(true));
  it('the Bear is a blue and red 4/4 Dragon that lost trample and gained flying (the loss comes first, the gain stays)', () => {
    const s = play(board());
    const b = idOf(s, 'Test Bear');
    expect(pt(s, b)).toEqual([4, 4]);
    expect(ch(s, b).subtypes).toEqual(['Dragon']);
    expect([...ch(s, b).colors].sort()).toEqual(['R', 'U']);
    expect(hasKeyword(s, b, 'flying')).toBe(true);
    expect(hasKeyword(s, b, 'trample')).toBe(false);
  });
  it('negative: it is only a target of the caster\'s creature (the opponent\'s Wolf is not a legal target) and the Bear is itself again next turn', () => {
    const s0 = board();
    const wolf = idOf(s0, 'Test Wolf', 'p2');
    expect(() => cast(s0, 'Test Shift', { targets: [[obj(wolf)]] })).toThrow();
    const s = nextTurn(play(s0));
    const b = idOf(s, 'Test Bear');
    expect(pt(s, b)).toEqual([2, 2]);
    expect(hasKeyword(s, b, 'trample')).toBe(true);
    expect(hasKeyword(s, b, 'flying')).toBe(false);
  });
});

// ---- Majestic Metamorphosis ---------------------------------------------------------------------------------------------------------------------------------------------
const META = card('Test Meta', 'Instant', 'Until end of turn, target artifact or creature becomes a 4/4 Angel artifact creature and gains flying. Draw a card.');
const TRINKET = card('Test Trinket', 'Artifact', '', '{1}');
describe('CR 205.1a, 613.1d, 613.4b: "target artifact or creature becomes a 4/4 Angel artifact creature and gains flying"', () => {
  const board = () => mpScenario({ defs: [META, TRINKET, BEAR], zones: { p1: { hand: ['Test Meta'], battlefield: ['Test Trinket', 'Test Bear'] } } });
  it('is full', () => expect(full(META)).toBe(true));
  it('an artifact becomes a 4/4 Angel artifact creature with flying, and its controller draws a card', () => {
    let s0 = board();
    const hand = s0.zones.hand.p1!.length;
    const s = resolveAll(cast(s0, 'Test Meta', { targets: [[obj(idOf(s0, 'Test Trinket'))]] }));
    const t = idOf(s, 'Test Trinket');
    expect(pt(s, t)).toEqual([4, 4]);
    expect(ch(s, t).types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    expect(ch(s, t).subtypes).toEqual(['Angel']);
    expect(hasKeyword(s, t, 'flying')).toBe(true);
    expect(s.zones.hand.p1!.length).toBe(hand - 1 + 1);
  });
  it('a creature keeps its abilities (trample) and gains flying; negative: next turn the artifact is not a creature', () => {
    const s0 = board();
    const s = resolveAll(cast(s0, 'Test Meta', { targets: [[obj(idOf(s0, 'Test Bear'))]] }));
    const b = idOf(s, 'Test Bear');
    expect(hasKeyword(s, b, 'trample') && hasKeyword(s, b, 'flying')).toBe(true);
    expect(pt(s, b)).toEqual([4, 4]);
    const s2 = nextTurn(resolveAll(cast(s0, 'Test Meta', { targets: [[obj(idOf(s0, 'Test Trinket'))]] })));
    expect(ch(s2, idOf(s2, 'Test Trinket')).types).not.toContain('Creature');
  });
});

// ---- Stuffed Bear ---------------------------------------------------------------------------------------------------------------------------------------------------------
const STUFF = card('Test Stuffed', 'Artifact', '{0}: ~ becomes a 4/4 green Bear artifact creature until end of turn.', '{4}');
describe('CR 205.1a, 613.1d-e, 613.4b: "~ becomes a 4/4 green Bear artifact creature until end of turn"', () => {
  const board = () => mpScenario({ defs: [STUFF], zones: { p1: { battlefield: ['Test Stuffed'] } } });
  it('is full', () => expect(full(STUFF)).toBe(true));
  it('it is a green 4/4 Bear artifact creature until end of turn and an artifact only afterwards', () => {
    const s = activate(board(), 'Test Stuffed');
    const t = idOf(s, 'Test Stuffed');
    expect(pt(s, t)).toEqual([4, 4]);
    expect(ch(s, t).colors).toEqual(['G']);
    expect(ch(s, t).subtypes).toEqual(['Bear']);
    expect(ch(s, t).types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    const n = nextTurn(s);
    expect(ch(n, idOf(n, 'Test Stuffed')).types).toEqual(['Artifact']);
  });
});

// ---- Mishra's Groundbreaker / Siege of Towers ---------------------------------------------------------------------------------------------------------------------------
const BREAKER = card('Test Breaker', 'Artifact', '{0}, Sacrifice ~: Target land becomes a 3/3 artifact creature that\'s still a land.', '{3}');
const HILL = card('Test Hill', 'Land — Mountain', '');
const SIEGE = card('Test Siege', 'Sorcery', 'Target Mountain becomes a 3/1 creature. It\'s still a land.');
describe('CR 205.1b, 611.2a: a land that becomes a creature stays a land, for good', () => {
  it('both are full', () => { expect(full(BREAKER)).toBe(true); expect(full(SIEGE)).toBe(true); });
  it('Groundbreaker-like: the land is a 3/3 artifact creature land with no duration (still so next turn); the Breaker is sacrificed', () => {
    const s0 = mpScenario({ defs: [BREAKER, HILL], zones: { p1: { battlefield: ['Test Breaker', 'Test Hill'] } } });
    const s = nextTurn(activate(s0, 'Test Breaker', [[idOf(s0, 'Test Hill')]]));
    const l = idOf(s, 'Test Hill');
    expect(ch(s, l).types).toEqual(expect.arrayContaining(['Artifact', 'Creature', 'Land']));
    expect(pt(s, l)).toEqual([3, 3]);
    expect(named(s, 'Test Breaker')).toEqual([]);
  });
  it('Siege-like: a Mountain becomes a 3/1 creature and is still a land; negative: a Forest is not a legal target', () => {
    const FOREST = card('Test Glade', 'Land — Forest', '');
    const s0 = mpScenario({ defs: [SIEGE, HILL, FOREST], zones: { p1: { hand: ['Test Siege'], battlefield: ['Test Hill', 'Test Glade'] } } });
    expect(() => cast(s0, 'Test Siege', { targets: [[obj(idOf(s0, 'Test Glade'))]] })).toThrow();
    const s = nextTurn(resolveAll(cast(s0, 'Test Siege', { targets: [[obj(idOf(s0, 'Test Hill'))]] })));
    const l = idOf(s, 'Test Hill');
    expect(ch(s, l).types).toEqual(expect.arrayContaining(['Creature', 'Land']));
    expect(pt(s, l)).toEqual([3, 1]);
  });
});

// ---- Haunted Plate Mail ---------------------------------------------------------------------------------------------------------------------------------------------------
const MAIL = card('Test Plate', 'Artifact — Equipment', '{0}: Until end of turn, ~ becomes a 4/4 Spirit artifact creature that\'s no longer an Equipment.', '{4}');
describe('CR 205.3g, 205.1b, 613.1d: "becomes a 4/4 Spirit artifact creature that\'s no longer an Equipment" until end of turn', () => {
  const board = () => mpScenario({ defs: [MAIL], zones: { p1: { battlefield: ['Test Plate'] } } });
  it('is full', () => expect(full(MAIL)).toBe(true));
  it('it is a Spirit artifact creature, not an Equipment, until end of turn; an Equipment again afterwards', () => {
    const s = activate(board(), 'Test Plate');
    const m = idOf(s, 'Test Plate');
    expect(ch(s, m).subtypes).toEqual(['Spirit']);
    expect(pt(s, m)).toEqual([4, 4]);
    expect(ch(s, m).types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    const n = nextTurn(s);
    expect(ch(n, idOf(n, 'Test Plate')).subtypes).toEqual(['Equipment']);
    expect(ch(n, idOf(n, 'Test Plate')).types).not.toContain('Creature');
  });
});

// ---- Shape Stealer --------------------------------------------------------------------------------------------------------------------------------------------------------
const STEALER = card('Test Stealer', 'Creature — Shapeshifter', 'Whenever ~ blocks or becomes blocked by a creature, ~\'s base power and toughness become equal to that creature\'s power and toughness until end of turn.', '{2}', ['1', '1']);
const GIANT = card('Test Giant', 'Creature — Giant', '', '{4}', ['5', '6']);
describe('CR 608.2h, 611.2c, 613.4b: "~\'s base power and toughness become equal to that creature\'s power and toughness until end of turn"', () => {
  it('is full', () => expect(full(STEALER)).toBe(true));
  it('blocking a 5/6, it becomes 5/6 as the trigger resolves (determined then); negative: it stays 1/1 when it is not blocking', () => {
    const s0 = mpScenario({ defs: [STEALER, GIANT], zones: { p1: { battlefield: ['Test Giant'] }, p2: { battlefield: ['Test Stealer'] } } });
    expect(pt(s0, idOf(s0, 'Test Stealer', 'p2'))).toEqual([1, 1]);
    let s = declareAttackers(toDeclareAttackers(s0), [[idOf(s0, 'Test Giant'), 'p2']]);
    s = resolveAll(s);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 40);
    s = declareBlockers(s, [[idOf(s, 'Test Stealer', 'p2'), idOf(s, 'Test Giant')]]);
    s = resolveAll(s);
    expect(pt(s, idOf(s, 'Test Stealer', 'p2'))).toEqual([5, 6]);
  });
});

describe('CR 608.2h, 611.2c: Shape Stealer-like: later changes to the other creature do not affect it', () => {
  it('after the trigger resolved the blocked Giant is pumped; the Stealer stays 5/6', () => {
    const s0 = mpScenario({ defs: [STEALER, GIANT], zones: { p1: { battlefield: ['Test Giant'] }, p2: { battlefield: ['Test Stealer'] } } });
    let s = declareAttackers(toDeclareAttackers(s0), [[idOf(s0, 'Test Giant'), 'p2']]);
    s = resolveAll(s);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 40);
    s = declareBlockers(s, [[idOf(s, 'Test Stealer', 'p2'), idOf(s, 'Test Giant')]]);
    s = resolveAll(s);
    const g = idOf(s, 'Test Giant');
    s.objects[g]!.counters = { ...(s.objects[g]!.counters ?? {}), '+1/+1': 2 };
    expect(pt(s, g)).toEqual([7, 8]);
    expect(pt(s, idOf(s, 'Test Stealer', 'p2'))).toEqual([5, 6]);
  });
});
describe('CR 509.1, 603.2, 608.2h: Shape Stealer-like, attacking: "becomes blocked by a creature" uses the blocker\'s power and toughness', () => {
  it('blocked by a 5/6 Giant, the 1/1 attacker becomes 5/6; negative: unblocked, it stays 1/1', () => {
    const s0 = mpScenario({ defs: [STEALER, GIANT], zones: { p1: { battlefield: ['Test Stealer'] }, p2: { battlefield: ['Test Giant'] } } });
    let s = declareAttackers(toDeclareAttackers(s0), [[idOf(s0, 'Test Stealer'), 'p2']]);
    s = resolveAll(s);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 40);
    s = declareBlockers(s, [[idOf(s, 'Test Giant', 'p2'), idOf(s, 'Test Stealer')]]);
    s = resolveAll(s);
    expect(pt(s, idOf(s, 'Test Stealer'))).toEqual([5, 6]);
    let u = declareAttackers(toDeclareAttackers(s0), [[idOf(s0, 'Test Stealer'), 'p2']]);
    u = resolveAll(u);
    u = passUntil(u, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 40);
    u = declareBlockers(u, []);
    u = resolveAll(u);
    expect(pt(u, idOf(u, 'Test Stealer'))).toEqual([1, 1]);
  });
});

// ---- Ageless Sentinels ----------------------------------------------------------------------------------------------------------------------------------------------------
const SENTRY = card('Test Sentry', 'Creature — Wall', 'Defender\nFlying\nWhen ~ blocks, it becomes a Bird Giant, and it loses defender.', '{3}', ['4', '4']);
describe('CR 205.3m, 613.1d, 613.1f, 611.2a: "it becomes a Bird Giant, and it loses defender" (no duration)', () => {
  it('is full', () => expect(full(SENTRY)).toBe(true));
  it('after blocking it is a Bird Giant without defender, still next turn, and keeps flying; negative: before blocking it is a Wall with defender', () => {
    const s0 = mpScenario({ defs: [SENTRY, GIANT], zones: { p1: { battlefield: ['Test Giant'] }, p2: { battlefield: ['Test Sentry'] } } });
    const sen0 = idOf(s0, 'Test Sentry', 'p2');
    expect(ch(s0, sen0).subtypes).toEqual(['Wall']);
    expect(hasKeyword(s0, sen0, 'defender')).toBe(true);
    let s = declareAttackers(toDeclareAttackers(s0), [[idOf(s0, 'Test Giant'), 'p2']]);
    s = resolveAll(s);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 40);
    s = declareBlockers(s, [[idOf(s, 'Test Sentry', 'p2'), idOf(s, 'Test Giant')]]);
    s = resolveAll(s);
    const sen = idOf(s, 'Test Sentry', 'p2');
    expect([...ch(s, sen).subtypes].sort()).toEqual(['Bird', 'Giant']);
    expect(hasKeyword(s, sen, 'defender')).toBe(false);
    expect(hasKeyword(s, sen, 'flying')).toBe(true);
  });
});
