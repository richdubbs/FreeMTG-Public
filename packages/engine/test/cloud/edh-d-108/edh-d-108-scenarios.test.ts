/**
 * Commander coordinator D, round edh-d-108 (EDHREC ranks 10,001-30,000, groups graveyard 3/3, vote-secret, dice-random): each new reading played through the engine with synthetic
 * cards (invented names, design 6.10) that print the cards' wordings, compiled by the game's default compiler. Alice (p1) is the active player of turn 1; Bob (p2) is the opponent.
 * Each test is named after the rule it checks, with its negative case and the Scryfall rulings of the card it stands for. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId, PlayerId } from '../../../src/index';
import { charsOfObject, legalActions } from '../../../src/index';
import { act, activations, advanceTo, answer, card, cast, drive, full, lifeOf, obj, resolveAll, scenario } from '../r3-cost/support';
import { find, findAll, pass } from '../../m3/scenario';

const lib = (s: GameState, p: PlayerId = 'p1'): ObjectId[] => s.zones.library[p]!;
const gy = (s: GameState, p: PlayerId = 'p1'): ObjectId[] => s.zones.graveyard[p]!;
const hand = (s: GameState, p: PlayerId = 'p1'): ObjectId[] => s.zones.hand[p]!;
const names = (s: GameState, ids: ObjectId[]): string[] => ids.map((id) => s.objects[id]!.defId);
/** Pass priority until a decision other than priority comes up, or the stack is empty. */
const toDecision = (s0: GameState): GameState => {
  let s = s0;
  for (let k = 0; k < 12 && s.pending?.kind === 'priority' && s.zones.stack.length > 0; k++) s = pass(s);
  return s;
};

const BEAR = card('Test Bear', 'Creature — Bear', '', '{1}{G}', ['2', '2']);
const SPRITE = card('Test Sprite', 'Creature — Faerie', '', '{1}{U}', ['1', '1']);
const ROCK = card('Test Rock', 'Artifact', '', '{1}');
const SPELLCARD = card('Test Ponder Card', 'Sorcery', 'Draw a card.', '{0}');

describe('"Target player discards two cards at random unless that player has ~ deal 4 damage to them." (CR 118.12a, 120.3, 701.9b, 608.2d; Skullscorch)', () => {
  const SPELL = card('Test Skull Flare', 'Sorcery', 'Target player discards two cards at random unless that player has ~ deal 4 damage to them.');
  const defs = [SPELL, BEAR, ROCK, SPRITE];
  const start = (): GameState => scenario([], { p1: { hand: ['Test Skull Flare'] }, p2: { hand: ['Test Bear', 'Test Rock', 'Test Sprite'] }, defs });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('the TARGET player decides (not the caster): taking the damage, they lose 4 life and keep their hand', () => {
    const s1 = toDecision(cast(start(), 'Test Skull Flare', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(s1.pending?.kind).toBe('yesNo');
    expect(s1.pending?.player).toBe('p2');
    const s = resolveAll(drive(s1, { yes: [true] }));
    expect(lifeOf(s, 'p2')).toBe(16);
    expect(hand(s, 'p2').length).toBe(3);
  });
  it('the negative case: declining, they discard exactly two cards at random and take no damage', () => {
    const s1 = toDecision(cast(start(), 'Test Skull Flare', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    const s = resolveAll(drive(s1, { yes: [false] }));
    expect(lifeOf(s, 'p2')).toBe(20);
    expect(hand(s, 'p2').length).toBe(1);
    expect(gy(s, 'p2').length).toBe(2);
  });
});

describe('"... you may pay {2}{B}. If you do, return a creature card at random from your graveyard to the battlefield. It gains flying, trample, and haste. Exile that card at the beginning of your next end step. If it would leave the battlefield, exile it instead of putting it anywhere else." (CR 608.2d, 603.7, 614.1a, 400.7; Kheru Lich Lord, rulings 2014-09-20)', () => {
  const LORD = card('Test Lich Warden', 'Creature — Zombie Wizard', 'At the beginning of your upkeep, you may pay {2}{B}. If you do, return a creature card at random from your graveyard to the battlefield. It gains flying, trample, and haste. Exile that card at the beginning of your next end step. If it would leave the battlefield, exile it instead of putting it anywhere else.', '{3}{B}', ['4', '4']);
  const defs = [LORD, BEAR, ROCK];
  const start = (): GameState => scenario(['Swamp'], { p1: { battlefield: ['Test Lich Warden', 'Swamp', 'Swamp', 'Swamp'], graveyard: ['Test Bear', 'Test Rock'] }, defs });
  const atUpkeep = (yes: boolean): GameState => {
    let s = advanceTo(start(), 3, 'upkeep');
    s = drive(toDecision(s), { yes: [yes] });
    return resolveAll(s, { yes: [yes] });
  };
  it('has no manual part', () => expect(full(LORD)).toBe(true));
  it('paying, the one creature card of the graveyard returns (the artifact card is never picked) with flying, trample and haste', () => {
    const s = atUpkeep(true);
    const bear = s.zones.battlefield.find((id) => s.objects[id]!.defId === 'Test Bear');
    expect(bear).toBeDefined();
    const kws = [...charsOfObject(s, s.objects[bear!]!).keywords].map((k) => (typeof k === 'string' ? k : (k as { keyword: string }).keyword));
    for (const k of ['flying', 'trample', 'haste']) expect(kws, k).toContain(k);
    expect(gy(s).some((id) => s.objects[id]!.defId === 'Test Rock')).toBe(true);
  });
  it('the creature is exiled at the beginning of your NEXT end step (the delayed trigger), not put anywhere else', () => {
    let s = atUpkeep(true);
    s = advanceTo(s, 3, 'end');
    s = resolveAll(s);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(false);
    expect(s.zones.exile.some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(true);
    expect(gy(s).some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(false);
  });
  it('the negative case: declining the payment returns nothing', () => {
    const s = atUpkeep(false);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(false);
    expect(gy(s).some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(true);
  });
});

describe('"{R}, {T}: Look at the top eight cards of your library. Exile four of them at random, then put the rest on top of your library in any order." (CR 608.2d, 401.4, 406.1, 400.7; Orcish Librarian, ruling 2004-10-04)', () => {
  const LIB = card('Test Ork Archivist', 'Creature — Orc', '{R}, {T}: Look at the top eight cards of your library. Exile four of them at random, then put the rest on top of your library in any order.', '{1}{R}', ['1', '1']);
  const EIGHT = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((x) => card(`Test Page ${x}`, 'Artifact', '', '{1}'));
  const defs = [LIB, ...EIGHT];
  const run = (seed: string): GameState => {
    const s0 = scenario(['Mountain'], { seed, p1: { battlefield: ['Test Ork Archivist', 'Mountain'], library: EIGHT.map((d) => d.name) }, defs });
    const [a] = activations(s0, 'Test Ork Archivist');
    return resolveAll(drive(act(s0, a!.action)));
  };
  const exiled = (s: GameState): string[] => names(s, s.zones.exile).sort();
  it('has no manual part', () => expect(full(LIB)).toBe(true));
  it('exactly four of the eight are exiled, the other four go back on top of the library (in an order you choose), and the ninth card is untouched', () => {
    const s = run('lib-a');
    const ex = exiled(s);
    expect(ex.length).toBe(4);
    const top4 = names(s, lib(s).slice(0, 4)).sort();
    expect([...ex, ...top4].sort()).toEqual(EIGHT.map((d) => d.name).sort());
    expect(s.objects[lib(s)[4]!]!.defId).toBe('Plains');
  });
  it('the pick is random, not the controller\'s: different seeds exile different cards', () => {
    const sets = new Set(['lib-a', 'lib-b', 'lib-c', 'lib-d'].map((x) => exiled(run(x)).join()));
    expect(sets.size).toBeGreaterThan(1);
  });
});

describe('"Enchanted creature gets -2/-0. It gets -6/-0 instead as long as its controller has seven or more cards in their graveyard." (CR 611.3a, 613.4c, 404.1; So Tiny, ruling 2019-10-04)', () => {
  const TINY = card('Test Shrink Charm', 'Enchantment — Aura', 'Flash\nEnchant creature\nEnchanted creature gets -2/-0. It gets -6/-0 instead as long as its controller has seven or more cards in their graveyard.', '{0}');
  const OGRE = card('Test Ogre', 'Creature — Ogre', '', '{4}', ['7', '7']);
  const defs = [TINY, OGRE, ROCK];
  const powerAfter = (theirGy: number, myGy: number): number => {
    const s0 = scenario([], { p1: { hand: ['Test Shrink Charm'], graveyard: Array(myGy).fill('Test Rock') }, p2: { battlefield: ['Test Ogre'], graveyard: Array(theirGy).fill('Test Rock') }, defs });
    const ogre = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s = resolveAll(cast(s0, 'Test Shrink Charm', { targets: [[obj(ogre)]] }));
    return Number(charsOfObject(s, s.objects[ogre]!).power);
  };
  it('has no manual part', () => expect(full(TINY)).toBe(true));
  it('the enchanted creature\'s controller has six cards in their graveyard: -2/-0', () => expect(powerAfter(6, 0)).toBe(5));
  it('... seven cards: -6/-0 instead (not -8/-0)', () => expect(powerAfter(7, 0)).toBe(1));
  it('the negative case: the AURA\'s controller\'s graveyard does not count (seven cards in yours, six in theirs: -2/-0)', () => expect(powerAfter(6, 9)).toBe(5));
});

describe('"Exile ~: Each opponent chooses two cards in their graveyard and exiles the rest." (CR 608.2c-d, 101.4, 406.1; Watchers of the Dead, rulings 2017-04-18)', () => {
  const WATCH = card('Test Grave Wardens', 'Creature — Spirit', 'Exile ~: Each opponent chooses two cards in their graveyard and exiles the rest.', '{3}', ['2', '2']);
  const defs = [WATCH, BEAR, ROCK, SPRITE];
  const activate = (s0: GameState): GameState => {
    const [a] = activations(s0, 'Test Grave Wardens');
    return toDecision(drive(act(s0, a!.action)));
  };
  it('has no manual part', () => expect(full(WATCH)).toBe(true));
  it('the opponent chooses the two cards they keep; every other card of their graveyard is exiled; your own graveyard is untouched', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Grave Wardens'], graveyard: ['Test Rock', 'Test Rock', 'Test Rock'] }, p2: { graveyard: ['Test Bear', 'Test Rock', 'Test Sprite', 'Test Rock'] }, defs });
    let s = activate(s0);
    expect(s.pending?.kind).toBe('chooseObjects');
    expect(s.pending?.player).toBe('p2');
    const keep = [find(s0, 'Test Bear', 'graveyard', 'p2'), find(s0, 'Test Sprite', 'graveyard', 'p2')];
    s = resolveAll(drive(s, { objects: [keep] }));
    expect(new Set(gy(s, 'p2'))).toEqual(new Set(keep));
    expect(gy(s, 'p1').length).toBe(3);
  });
  it('the negative case: an opponent with two or fewer cards in their graveyard exiles nothing (ruling 2017-04-18)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Grave Wardens'] }, p2: { graveyard: ['Test Bear', 'Test Rock'] }, defs });
    const s = resolveAll(activate(s0));
    expect(gy(s, 'p2').length).toBe(2);
  });
});

describe('"{U}, {T}: Each player reveals the top card of their library. You may put the revealed cards into their owners\' graveyards. If you don\'t, each player draws a card." (CR 701.20a, 608.2c-d; Dakra Mystic, ruling 2014-04-26)', () => {
  const MYSTIC = card('Test Tide Seer', 'Creature — Merfolk Wizard', '{U}, {T}: Each player reveals the top card of their library. You may put the revealed cards into their owners\' graveyards. If you don\'t, each player draws a card.', '{U}', ['1', '1']);
  const defs = [MYSTIC, BEAR, ROCK];
  const start = (): GameState => scenario(['Island'], { p1: { battlefield: ['Test Tide Seer', 'Island'], library: ['Test Bear'] }, p2: { library: ['Test Rock'] }, defs });
  const run = (yes: boolean): GameState => {
    const s0 = start();
    const [a] = activations(s0, 'Test Tide Seer');
    return resolveAll(drive(act(s0, a!.action)), { yes: [yes] });
  };
  it('has no manual part', () => expect(full(MYSTIC)).toBe(true));
  it('you put them: BOTH revealed cards go to their owners\' graveyards, nobody draws', () => {
    const s = run(true);
    expect(names(s, gy(s, 'p1'))).toEqual(['Test Bear']);
    expect(names(s, gy(s, 'p2'))).toEqual(['Test Rock']);
    expect(hand(s, 'p1').length).toBe(0);
  });
  it('the negative case: you don\'t: each player draws a card, the revealed card (ruling 2014-04-26)', () => {
    const s = run(false);
    expect(names(s, hand(s, 'p1'))).toEqual(['Test Bear']);
    expect(names(s, hand(s, 'p2'))).toEqual(['Test Rock']);
    expect(gy(s, 'p1').length + gy(s, 'p2').length).toBe(0);
  });
});

describe('"Threshold -- Put three cards from your graveyard on the bottom of your library: ~ gets +3/+3 until end of turn. Activate only once each turn and only if there are seven or more cards in your graveyard." (CR 118.3, 401.4, 602.5b; Battlefield Scrounger)', () => {
  const SCROUNGER = card('Test Field Picker', 'Creature — Centaur', 'Threshold — Put three cards from your graveyard on the bottom of your library: ~ gets +3/+3 until end of turn. Activate only once each turn and only if there are seven or more cards in your graveyard.', '{3}{G}{G}', ['3', '3']);
  const defs = [SCROUNGER, ROCK];
  const start = (n: number): GameState => scenario([], { p1: { battlefield: ['Test Field Picker'], graveyard: Array(n).fill('Test Rock') }, defs });
  it('has no manual part', () => expect(full(SCROUNGER)).toBe(true));
  it('with seven cards in your graveyard: three of them go to the bottom of your library as the cost, and it gets +3/+3; not again this turn', () => {
    const s0 = start(7);
    const [a] = activations(s0, 'Test Field Picker');
    expect(a).toBeDefined();
    const picked = gy(s0).slice(0, 3);
    let s = drive(act(s0, a!.action), { objects: [picked] });
    s = resolveAll(s);
    expect(gy(s).length).toBe(4);
    expect(lib(s).slice(-3).map((id) => s.objects[id]!.defId)).toEqual(['Test Rock', 'Test Rock', 'Test Rock']);
    const me = find(s, 'Test Field Picker', 'battlefield', 'p1');
    expect(Number(charsOfObject(s, s.objects[me]!).power)).toBe(6);
    expect(activations(s, 'Test Field Picker').length).toBe(0); // once each turn (and four cards left)
  });
  it('the negative case: with six cards in your graveyard it can\'t be activated', () => expect(activations(start(6), 'Test Field Picker').length).toBe(0));
});

describe('"Permanents don\'t untap during their controllers\' untap steps. At the beginning of each player\'s upkeep, that player chooses a permanent for each card in their graveyard, then untaps those permanents." (CR 502.3, 608.2c-d, 701.26b; Mist of Stagnation)', () => {
  const MIST = card('Test Still Fog', 'Enchantment', 'Permanents don\'t untap during their controllers\' untap steps.\nAt the beginning of each player\'s upkeep, that player chooses a permanent for each card in their graveyard, then untaps those permanents.', '{3}{U}{U}');
  const defs = [MIST, ROCK, BEAR];
  it('has no manual part', () => expect(full(MIST)).toBe(true));
  it('in Bob\'s upkeep, Bob (the upkeep\'s player) chooses one permanent for his one graveyard card and untaps it; his other tapped permanent stays tapped', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Still Fog'] }, p2: { battlefield: [{ name: 'Test Rock', tapped: true }, { name: 'Test Bear', tapped: true }], graveyard: ['Test Rock'] }, defs });
    let s = toDecision(advanceTo(s0, 2, 'upkeep'));
    expect(s.pending?.kind).toBe('chooseObjects');
    expect(s.pending?.player).toBe('p2');
    expect((s.pending as { min: number }).min).toBe(1);
    const rock = find(s, 'Test Rock', 'battlefield', 'p2');
    s = resolveAll(drive(s, { objects: [[rock]] }));
    expect(s.objects[rock]!.tapped).toBe(false);
    expect(s.objects[find(s, 'Test Bear', 'battlefield', 'p2')]!.tapped).toBe(true);
  });
  it('the negative case: with an empty graveyard nothing untaps (the untap step untapped nothing either)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Still Fog'] }, p2: { battlefield: [{ name: 'Test Rock', tapped: true }] }, defs });
    const s = resolveAll(advanceTo(s0, 2, 'upkeep'));
    expect(s.objects[find(s, 'Test Rock', 'battlefield', 'p2')]!.tapped).toBe(true);
  });
});

describe('"At the beginning of each end step, draw a card if you\'ve cast a spell from a graveyard or activated an ability of a card in a graveyard this turn." (CR 601.2, 602.2, 404.1, 608.2c; Laboratory Drudge, rulings 2020-11-10)', () => {
  const DRUDGE = card('Test Lab Shambler', 'Creature — Zombie Wizard', 'At the beginning of each end step, draw a card if you\'ve cast a spell from a graveyard or activated an ability of a card in a graveyard this turn.', '{1}{U}', ['1', '3']);
  const FLASHBACKER = card('Test Flashbacker', 'Sorcery', 'You gain 1 life.\nFlashback {0}');
  const RETURNER = card('Test Returner', 'Creature — Zombie', '{0}: Return Test Returner from your graveyard to your hand.', '{1}{B}', ['1', '1']);
  const GAINER = card('Test Gainer', 'Creature — Cleric', '{0}: You gain 1 life.', '{1}', ['1', '1']);
  const defs = [DRUDGE, FLASHBACKER, RETURNER, GAINER, SPELLCARD];
  const atEnd = (s0: GameState): number => {
    const before = hand(s0).length;
    const s = resolveAll(advanceTo(s0, 1, 'end'));
    return hand(s).length - before;
  };
  it('has no manual part', () => expect(full(DRUDGE)).toBe(true));
  it('after a flashback cast from your graveyard this turn, you draw at the end step', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Lab Shambler'], graveyard: ['Test Flashbacker'] }, defs });
    const fb = find(s0, 'Test Flashbacker', 'graveyard', 'p1');
    const l = legalActions(s0, 'p1').find((x) => x.kind === 'cast' && x.object === fb);
    expect(l).toBeDefined();
    const s = resolveAll(drive(act(s0, l!.action)));
    expect(lifeOf(s)).toBe(21);
    expect(atEnd(s)).toBe(1);
  });
  it('after activating an ability of a card in your graveyard this turn, you draw at the end step', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Lab Shambler'], graveyard: ['Test Returner'] }, defs });
    const r = find(s0, 'Test Returner', 'graveyard', 'p1');
    const a = activationsAnywhere(s0, r);
    expect(a).toBeDefined();
    const s = resolveAll(drive(act(s0, a!)));
    expect(atEnd(s)).toBe(1);
  });
  it('the negative case: a spell cast from your hand and an ability of a permanent on the battlefield: no draw', () => {
    const s0 = scenario(['Island'], { p1: { battlefield: ['Test Lab Shambler', 'Test Gainer', 'Island'], hand: ['Test Ponder Card'] }, defs });
    let s = resolveAll(cast(s0, 'Test Ponder Card'));
    const [g] = activations(s, 'Test Gainer');
    s = resolveAll(drive(act(s, g!.action)));
    expect(atEnd(s)).toBe(0);
  });
});

/** The action that activates the one activated ability of an object in any zone that p1 may activate now. */
function activationsAnywhere(s: GameState, id: ObjectId) {
  return legalActions(s, 'p1').find((x) => x.kind === 'activate' && x.object === id)?.action;
}

describe('Rise // Fall: "Return target creature card from a graveyard and target creature on the battlefield to their owners\' hands." / "Target player reveals two cards at random from their hand, then discards each nonland card revealed this way." (CR 115.1, 400.3, 701.20a, 608.2d, 701.9a)', () => {
  const RISE = card('Test Ascent', 'Sorcery', 'Return target creature card from a graveyard and target creature on the battlefield to their owners\' hands.', '{0}');
  const FALL = card('Test Descent', 'Sorcery', 'Target player reveals two cards at random from their hand, then discards each nonland card revealed this way.', '{0}');
  const defs = [RISE, FALL, BEAR, ROCK, SPRITE];
  it('both halves have no manual part', () => { expect(full(RISE)).toBe(true); expect(full(FALL)).toBe(true); });
  it('Rise: a creature card from any graveyard and a creature on the battlefield go to their owners\' hands', () => {
    const s0 = scenario([], { p1: { hand: ['Test Ascent'] }, p2: { graveyard: ['Test Bear'], battlefield: ['Test Sprite'] }, defs });
    const card0 = find(s0, 'Test Bear', 'graveyard', 'p2');
    const crit = find(s0, 'Test Sprite', 'battlefield', 'p2');
    const s = resolveAll(cast(s0, 'Test Ascent', { targets: [[obj(card0)], [obj(crit)]] }));
    expect(names(s, hand(s, 'p2')).sort()).toEqual(['Test Bear', 'Test Sprite']);
  });
  it('Fall: with exactly two cards in hand both are revealed; the nonland one is discarded, the land stays (the negative case)', () => {
    const s0 = scenario([], { p1: { hand: ['Test Descent'] }, p2: { hand: ['Test Bear', 'Plains'] }, defs });
    const s = resolveAll(cast(s0, 'Test Descent', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(names(s, gy(s, 'p2'))).toEqual(['Test Bear']);
    expect(names(s, hand(s, 'p2'))).toEqual(['Plains']);
  });
  it('Fall: of three nonland cards only the two picked at random are discarded (no player chooses)', () => {
    const s0 = scenario([], { p1: { hand: ['Test Descent'] }, p2: { hand: ['Test Bear', 'Test Rock', 'Test Sprite'] }, defs });
    const s1 = toDecision(cast(s0, 'Test Descent', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(s1.pending?.kind === 'chooseObjects').toBe(false);
    const s = resolveAll(s1);
    expect(gy(s, 'p2').length).toBe(2);
    expect(hand(s, 'p2').length).toBe(1);
  });
});

describe('"Search your library for three creature cards and reveal them. If you reveal three cards with different names, choose one of them at random and put that card into your hand. Shuffle the rest into your library." (CR 701.23a-b, 701.20a, 608.2d, 201.2; Signal the Clans, rulings 2013-01-24)', () => {
  const CLANS = card('Test Clan Beacon', 'Instant', 'Search your library for three creature cards and reveal them. If you reveal three cards with different names, choose one of them at random and put that card into your hand. Shuffle the rest into your library.', '{0}');
  const defs = [CLANS, BEAR, SPRITE, ROCK, card('Test Wolf', 'Creature — Wolf', '', '{1}{G}', ['2', '2'])];
  const start = (): GameState => scenario([], { p1: { hand: ['Test Clan Beacon'], library: ['Test Bear', 'Test Sprite', 'Test Wolf', 'Test Bear', 'Test Rock'] }, defs });
  it('has no manual part', () => expect(full(CLANS)).toBe(true));
  it('three creature cards with different names found: exactly one of them goes to your hand, picked at random (no further choice), the other two stay in the library', () => {
    const s0 = start();
    const three = ['Test Bear', 'Test Sprite', 'Test Wolf'].map((n) => find(s0, n, 'library', 'p1'));
    const s = resolveAll(cast(s0, 'Test Clan Beacon'), { objects: [three] });
    expect(hand(s).length).toBe(1);
    const got = names(s, hand(s))[0]!;
    expect(['Test Bear', 'Test Sprite', 'Test Wolf']).toContain(got);
    // the other two found cards are in the library again (shuffled: new objects, CR 400.7), the library one card smaller
    expect(lib(s).length).toBe(lib(s0).length - 1);
    for (const n of ['Test Bear', 'Test Sprite', 'Test Wolf'].filter((x) => x !== got)) expect(names(s, lib(s))).toContain(n);
  });
  it('the negative case: two of the three share a name: nothing goes to your hand, the library is shuffled with all of them (ruling 2013-01-24)', () => {
    const s0 = start();
    const bears = findAll(s0, 'Test Bear', 'library', 'p1');
    const picked = [bears[0]!, bears[1]!, find(s0, 'Test Wolf', 'library', 'p1')];
    const s = resolveAll(cast(s0, 'Test Clan Beacon'), { objects: [picked] });
    expect(hand(s).length).toBe(0);
    expect(lib(s).length).toBe(lib(s0).length);
    expect(names(s, lib(s)).filter((n) => n === 'Test Bear').length).toBe(2);
  });
  it('the negative case: finding only two cards (allowed, CR 701.23b) puts nothing into your hand', () => {
    const s0 = start();
    const two = ['Test Bear', 'Test Sprite'].map((n) => find(s0, n, 'library', 'p1'));
    const s = resolveAll(cast(s0, 'Test Clan Beacon'), { objects: [two] });
    expect(hand(s).length).toBe(0);
  });
});
