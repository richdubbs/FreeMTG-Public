/**
 * Commander coordinator D, round edh-d-106 (EDHREC ranks 10,001-30,000, groups tokens and control): each new reading played through the engine with synthetic cards
 * (invented names, design 6.10), compiled by the game's default compiler. Alice (p1) is the active player of turn 1; Bob (p2), and Carol (p3) in the multiplayer
 * games, are her opponents. Each test is named after the rule it checks, with its negative case. CR cites checked against the Comprehensive Rules of 2026-09-25
 * (MagicCompRules 20260925.txt); the Scryfall rulings of each card are cited where a test plays them.
 */
import { describe, expect, it } from 'vitest';
import { applyAction, type GameState, type ObjectId } from '../../../src/index';
import { act, activations, answer, card, cast, drive, find, full, lifeOf, obj, resolveAll, scenario } from '../r3-cost/support';
import { mpScenario, pass, resolveStack } from '../../m12/rules/helpers';

const onField = (s: GameState, name: string, controller?: string): ObjectId[] => s.zones.battlefield.filter((id) => s.defs[s.objects[id]!.defId]!.name === name && (controller === undefined || s.objects[id]!.controller === controller));
const tokens = (s: GameState, controller = 'p1'): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.kind === 'token' && s.objects[id]!.controller === controller);
const counters = (s: GameState, id: ObjectId, kind: string): number => (s.objects[id]!.counters as Record<string, number> | undefined)?.[kind] ?? 0;

describe('"{X}, {T}: Choose one -- • ... X can\'t be 0. • ... X can\'t be 0." (CR 107.3a, 602.2b, 700.2; Marath, Will of the Wild)', () => {
  const RELIC = card('Test Wild Totem', 'Artifact', "{X}, {T}: Choose one --\n• You gain X life. X can't be 0.\n• Target player mills X cards. X can't be 0.");
  const HALF = card('Test Half Totem', 'Artifact', "{X}, {T}: Choose one --\n• You gain X life. X can't be 0.\n• Target player mills X cards.");
  const defs = [RELIC, HALF];
  it('has no manual part, and the ability\'s least X is 1 whatever mode is chosen', () => {
    expect(full(RELIC)).toBe(true);
    const a = RELIC.faces[0]!.abilities.find((x) => x.kind === 'activated') as { xMin?: number };
    expect(a.xMin).toBe(1);
  });
  it('X = 2 for the first mode gains 2 life', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Wild Totem', 'Plains', 'Plains'] }, defs });
    const s = resolveAll(drive(act(s0, activations(s0, 'Test Wild Totem')[0]!.action), { options: [['0']], x: [2] }));
    expect(lifeOf(s)).toBe(22);
  });
  it('the negative case: X = 0 can\'t be announced (CR 107.3a: only X of 1 or more is offered)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Wild Totem', 'Plains', 'Plains'] }, defs });
    const s = act(s0, activations(s0, 'Test Wild Totem')[0]!.action);
    const kinds: string[] = [];
    let t = s;
    for (let i = 0; i < 6 && t.pending?.kind === 'chooseOption'; i++) { const p = t.pending; kinds.push(p.kind); t = answer(t, { kind: 'chooseOption', ids: [p.options[0]!.id] }); }
    expect(t.pending?.kind, kinds.join(',')).toBe('chooseNumber');
    expect((t.pending as { min: number }).min).toBe(1);
  });
  it('the negative case: when one mode lacks "X can\'t be 0." the sentences stay unread (not this reading)', () => {
    expect(full(HALF)).toBe(false);
  });
});

describe('"Whenever ..., choose one that hasn\'t been chosen this turn. Create a creature token with those characteristics. • 2/2 white Fox ... • 1/2 blue Moonfolk ..." (CR 700.2, 111.1, 603.3c; Genku, Future Shaper, rulings 2024-06-07)', () => {
  const SHAPER = card('Test Dream Shaper', 'Creature — Moonfolk', 'Whenever another nontoken permanent you control leaves the battlefield, choose one that hasn\'t been chosen this turn. Create a creature token with those characteristics.\n• 2/2 white Fox with vigilance.\n• 1/2 blue Moonfolk with flying.', '{0}', ['2', '2']);
  const ROCK = card('Test Pebble', 'Artifact', '{T}, Sacrifice this artifact: You gain 1 life.');
  const defs = [SHAPER, ROCK];
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Dream Shaper', 'Test Pebble', 'Test Pebble', 'Test Pebble'] }, defs });
  const sac = (s: GameState, mode: string): GameState => {
    const a = activations(s, 'Test Pebble')[0]!.action;
    return resolveAll(drive(act(s, a), { options: [[mode]] }), { options: [[mode]] });
  };
  it('has no manual part', () => expect(full(SHAPER)).toBe(true));
  it('the chosen mode makes that token: a white 2/2 Fox with vigilance', () => {
    const s = sac(start(), '0');
    const t = tokens(s);
    expect(t).toHaveLength(1);
    const o = s.objects[t[0]!]!;
    expect(JSON.stringify(o)).toContain('Fox');
  });
  it('the negative case: a mode chosen this turn can\'t be chosen again; with both used, the third trigger does nothing (ruling 2024-06-07)', () => {
    let s = sac(start(), '0');
    s = sac(s, '1');
    expect(tokens(s)).toHaveLength(2);
    const kinds = tokens(s).map((id) => JSON.stringify(s.objects[id]!)).join(' ');
    expect(kinds).toContain('Fox');
    expect(kinds).toContain('Moonfolk');
    s = sac(s, '0');
    expect(tokens(s)).toHaveLength(2);
  });
});

describe('"For each opponent, choose up to one target creature that player controls. ~ deals X damage to each of those creatures. You create a Mutagen token for each creature dealt damage this way." (CR 115.1, 601.2c, 120.3; Shellshock)', () => {
  const SHOCK = card('Test Shell Burst', 'Instant', 'For each opponent, choose up to one target creature that player controls. Test Shell Burst deals 2 damage to each of those creatures. You create a Treasure token for each creature dealt damage this way.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['4', '4']);
  const defs = [SHOCK, BEAR, OX];
  it('has no manual part', () => expect(full(SHOCK)).toBe(true));
  it('one creature of each opponent: both are dealt the damage, and a token for each creature dealt damage', () => {
    const s0 = mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Shell Burst'] }, p2: { battlefield: ['Test Bear'] }, p3: { battlefield: ['Test Ox'] } } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p2');
    const ox = find(s0, 'Test Ox', 'battlefield', 'p3');
    const s = resolveStack(cast(s0, 'Test Shell Burst', { targets: [[obj(bear), obj(ox)]] }));
    expect(s.zones.battlefield.includes(bear)).toBe(false);
    expect(s.objects[ox]!.damage).toBe(2);
    expect(tokens(s)).toHaveLength(2);
  });
  it('the negative case: two creatures of ONE opponent can\'t be chosen (one target for each opponent, CR 601.2c)', () => {
    const s0 = mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Shell Burst'] }, p2: { battlefield: ['Test Bear', 'Test Ox'] } } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p2');
    const ox = find(s0, 'Test Ox', 'battlefield', 'p2');
    expect(() => cast(s0, 'Test Shell Burst', { targets: [[obj(bear), obj(ox)]] })).toThrow();
  });
  it('the negative case: with no target chosen, no damage and no token', () => {
    const s0 = mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Shell Burst'] }, p2: { battlefield: ['Test Bear'] } } });
    const s = resolveStack(cast(s0, 'Test Shell Burst', { targets: [[]] }));
    expect(tokens(s)).toHaveLength(0);
  });
});

describe('"If this spell was kicked, create a 6/6 Dragon. For each opponent, choose up to one target creature that player controls. ~ deals damage equal to the greatest power among creatures you control to each of the chosen creatures." (CR 115.1, 601.2c, 608.2h; Mega Flare, ruling 2025-10-02)', () => {
  const FLARE = card('Test Sky Flare', 'Sorcery', 'Kicker {2}\nIf this spell was kicked, create a 6/6 red Dragon creature token with flying.\nFor each opponent, choose up to one target creature that player controls. Test Sky Flare deals damage equal to the greatest power among creatures you control to each of the chosen creatures.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const WALL = card('Test Tall Wall', 'Creature — Wall', '', '{0}', ['0', '5']);
  const defs = [FLARE, BEAR, WALL];
  const start = (): GameState => scenario([], { p1: { hand: ['Test Sky Flare'], battlefield: ['Test Bear', 'Plains', 'Plains'] }, p2: { battlefield: ['Test Tall Wall'] }, defs });
  it('has no manual part', () => expect(full(FLARE)).toBe(true));
  it('not kicked: the damage is the greatest power as it resolves (2), the wall survives', () => {
    const s0 = start();
    const wall = find(s0, 'Test Tall Wall', 'battlefield', 'p2');
    const s = resolveAll(cast(s0, 'Test Sky Flare', { yes: [false], targets: [[obj(wall)]] }));
    expect(s.objects[wall]!.damage).toBe(2);
    expect(tokens(s)).toHaveLength(0);
  });
  it('kicked: the Dragon is created first and counted, 6 damage destroys the wall (ruling 2025-10-02: the power as the spell resolves)', () => {
    const s0 = start();
    const wall = find(s0, 'Test Tall Wall', 'battlefield', 'p2');
    const s = resolveAll(cast(s0, 'Test Sky Flare', { yes: [true], targets: [[obj(wall)]] }));
    expect(s.zones.battlefield.includes(wall)).toBe(false);
    expect(tokens(s)).toHaveLength(1);
  });
});

describe('"For each opponent, create two 3/3 ... tokens with flying that attack that opponent this turn if able. They gain haste until end of turn." (CR 508.1d, 611.2a, 702.10a; Furygale Flocking, rulings 2026-03-20)', () => {
  const FLOCK = card('Test Gale Flock', 'Sorcery', 'For each opponent, create two 1/1 white Bird creature tokens with flying that attack that opponent this turn if able. They gain haste until end of turn.');
  const ONE = card('Test Lone Gale', 'Sorcery', 'For each opponent, create a 1/1 white Bird creature token with flying that attacks that opponent this turn if able. It gains haste until end of turn.');
  const defs = [FLOCK, ONE];
  const declare = (s: GameState, attacks: { attacker: ObjectId; defender: string }[]) => applyAction(s, { type: 'answer', player: s.pending!.player, decisionId: s.pending!.id, answer: { kind: 'declareAttackers', attacks } } as never);
  const toAttacks = (s0: GameState): GameState => { let t = s0; for (let i = 0; i < 100 && t.pending?.kind !== 'declareAttackers'; i++) t = pass(t); return t; };
  const start = (name = 'Test Gale Flock'): GameState => resolveStack(cast(mpScenario({ players: 3, defs, zones: { p1: { hand: [name] } } }), name));
  it('has no manual part', () => { expect(full(FLOCK)).toBe(true); expect(full(ONE)).toBe(true); });
  it('two tokens for each opponent (four), with haste: each must attack the opponent it was created for (ruling: that player, not a planeswalker)', () => {
    const s = toAttacks(start());
    const t = tokens(s);
    expect(t).toHaveLength(4);
    expect(s.pending).toMatchObject({ kind: 'declareAttackers', player: 'p1' });
    expect((s.pending as { mustObey?: number }).mustObey).toBe(4);
    expect(declare(s, []).error?.rules).toContain('CR 508.1d');
  });
  it('the negative case: a token sent at the other opponent breaks its requirement; the right split is legal', () => {
    const s = toAttacks(start());
    const t = tokens(s);
    const forP2 = t.filter((id) => JSON.stringify(s).includes(id)).slice(0, 4);
    const all = (pairs: string[]) => forP2.map((id, i) => ({ attacker: id, defender: pairs[i]! }));
    const ok = [all(['p2', 'p2', 'p3', 'p3']), all(['p3', 'p3', 'p2', 'p2'])].filter((a) => declare(s, a).error === undefined);
    expect(ok).toHaveLength(1);
    expect(declare(s, all(['p2', 'p2', 'p2', 'p2'])).error?.rules).toContain('CR 508.1d');
  });
  it('the singular wording ("a token that attacks ... It gains haste") makes one token for each opponent', () => {
    expect(tokens(start('Test Lone Gale'))).toHaveLength(2);
  });
});

/** Through combat of turn 1 to Alice's second main phase: `attacks` are declared (each attacker at the player or object named), no blocks. */
function combatThenMain2(s0: GameState, attacks: { attacker: ObjectId; defender: string }[]): GameState {
  let t = s0;
  for (let i = 0; i < 200; i++) {
    if (t.turn.step === 'main2' && t.pending?.kind === 'priority' && t.pending.player === 'p1') return t;
    if (t.pending?.kind === 'declareAttackers') { t = answer(t, { kind: 'declareAttackers', attacks } as never); continue; }
    if (t.pending?.kind === 'declareBlockers') { t = answer(t, { kind: 'declareBlockers', blocks: [] } as never); continue; }
    t = pass(t);
  }
  throw new Error('never reached the second main phase');
}

describe('"Create a Treasure token for each creature you controlled that dealt combat damage to a player this turn." (CR 120.1, 510.2, 400.7, 608.2h; Excess, ruling 2022-04-29)', () => {
  const EXCESS = card('Test Spoils', 'Sorcery', 'Create a Treasure token for each creature you controlled that dealt combat damage to a player this turn.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const SAC = card('Test Fodder Pit', 'Artifact', 'Sacrifice a creature: You gain 1 life.');
  const defs = [EXCESS, BEAR, SAC];
  const start = (): GameState => scenario([], { p1: { hand: ['Test Spoils'], battlefield: ['Test Bear', 'Test Bear', 'Test Bear', 'Test Fodder Pit'] }, defs });
  it('has no manual part', () => expect(full(EXCESS)).toBe(true));
  it('two of three creatures dealt combat damage to the opponent: two Treasures', () => {
    const s0 = start();
    const [a, b] = onField(s0, 'Test Bear', 'p1');
    const s1 = combatThenMain2(s0, [{ attacker: a!, defender: 'p2' }, { attacker: b!, defender: 'p2' }]);
    expect(lifeOf(s1, 'p2')).toBe(16);
    const s = resolveAll(cast(s1, 'Test Spoils'));
    expect(tokens(s)).toHaveLength(2);
  });
  it('a creature that dealt the damage and then left the battlefield still counts (ruling 2022-04-29)', () => {
    const s0 = start();
    const [a, b] = onField(s0, 'Test Bear', 'p1');
    let s1 = combatThenMain2(s0, [{ attacker: a!, defender: 'p2' }, { attacker: b!, defender: 'p2' }]);
    s1 = resolveAll(drive(act(s1, activations(s1, 'Test Fodder Pit')[0]!.action), { objects: [[a!]] }));
    expect(s1.zones.battlefield.includes(a!)).toBe(false);
    const s = resolveAll(cast(s1, 'Test Spoils'));
    expect(tokens(s)).toHaveLength(2);
  });
  it('the negative case: no combat damage dealt this turn, no Treasure', () => {
    const s = resolveAll(cast(start(), 'Test Spoils'));
    expect(tokens(s)).toHaveLength(0);
  });
});

describe('"When ~ enter and whenever you cast a spell with power, toughness, or mana value 4, choose one that hasn\'t been chosen this turn." (CR 603.2, 201.5, 202.3, 208.1, 700.2; The Fantastic Four)', () => {
  const FOUR = card('Test Four Friends', 'Creature — Human Hero', 'When Test Four Friends enter and whenever you cast a spell with power, toughness, or mana value 4, choose one that hasn\'t been chosen this turn.\n• You gain 3 life.\n• Draw a card.', '{0}', ['4', '4']);
  const TALL = card('Test Tall Wall', 'Creature — Wall', '', '{0}', ['0', '4']);
  const SMALL = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const CANTRIP = card('Test Four Thought', 'Sorcery', 'You gain 1 life.', '{4}');
  const defs = [FOUR, TALL, SMALL, CANTRIP];
  it('has no manual part, and the spell filter is any of the three statistics', () => {
    expect(full(FOUR)).toBe(true);
    expect(JSON.stringify(FOUR.faces[0]!.abilities[0])).toContain('"anyOf":[{"power":{"op":"==","value":4}},{"toughness":{"op":"==","value":4}},{"manaValue":{"op":"==","value":4}}]');
  });
  it('it triggers as it enters, and for a spell with toughness 4 (a 0/4) or mana value 4; each mode once a turn', () => {
    const s0 = scenario([], { p1: { hand: ['Test Four Friends', 'Test Tall Wall', 'Test Four Thought'], battlefield: ['Plains', 'Plains', 'Plains', 'Plains'] }, defs });
    let s = resolveAll(cast(s0, 'Test Four Friends'), { options: [['0']] });
    expect(lifeOf(s)).toBe(23);
    s = resolveAll(cast(s, 'Test Tall Wall', { options: [['1']] }));
    expect(s.zones.hand.p1!.length).toBe(2); // drew a card (the Four Thought is still in hand)
    s = resolveAll(cast(s, 'Test Four Thought'));
    expect(lifeOf(s)).toBe(24); // both modes used this turn: the third trigger does nothing; the spell itself gains 1
  });
  it('the negative case: a 2/2 creature spell with mana value 0 does not trigger it', () => {
    const s0 = scenario([], { p1: { hand: ['Test Bear'], battlefield: ['Test Four Friends'] }, defs });
    const s1 = cast(s0, 'Test Bear');
    expect(s1.zones.stack).toHaveLength(1);
  });
});

describe('"Create two 4/5 green Spirit creature tokens. For each of them, put your choice of a reach counter, a vigilance counter, or a trample counter on it." (CR 111.1, 122.1b, 608.2c; Invoke the Ancients, rulings 2022-02-18)', () => {
  const INVOKE = card('Test Old Calling', 'Sorcery', 'Create two 2/2 green Spirit creature tokens. For each of them, put your choice of a reach counter, a vigilance counter, or a trample counter on it.');
  const defs = [INVOKE];
  it('has no manual part', () => expect(full(INVOKE)).toBe(true));
  it('each token gets the counter chosen for it, separately (ruling 2022-02-18)', () => {
    const s0 = scenario([], { p1: { hand: ['Test Old Calling'] }, defs });
    let s = cast(s0, 'Test Old Calling');
    const wants = ['reach', 'trample'];
    for (let i = 0; i < 20 && (s.zones.stack.length > 0 || s.pending?.kind !== 'priority'); i++) {
      if (s.pending?.kind === 'order') s = answer(s, { kind: 'order', ids: s.pending.items.map((x) => x.id) });
      else if (s.pending?.kind === 'chooseOption') { const w = wants.shift()!; s = answer(s, { kind: 'chooseOption', ids: [s.pending.options.find((o) => o.label.toLowerCase().includes(w))!.id] }); }
      else s = pass(s);
    }
    expect(wants).toEqual([]);
    const t = tokens(s);
    expect(t).toHaveLength(2);
    const got = t.map((id) => ['reach', 'vigilance', 'trample'].filter((k) => counters(s, id, k) === 1).join('')).sort();
    expect(got).toEqual(['reach', 'trample']);
    expect(t.every((id) => ['reach', 'vigilance', 'trample'].reduce((n, k) => n + counters(s, id, k), 0) === 1)).toBe(true); // the negative case: one counter each, not one of each
  });
});

describe('"As this creature enters, choose Believe or Doubt. • Believe -- Whenever a nontoken creature you control dies, create a 2/2 Horror token. • Doubt -- ..." (CR 614.12a, 607.2d, 603.2; Phenomenon Investigators, ruling 2024-09-20)', () => {
  const INV = card('Test Ghost Hunters', 'Creature — Human Detective', 'As this creature enters, choose Believe or Doubt.\n• Believe -- Whenever a nontoken creature you control dies, create a 2/2 black Horror enchantment creature token.\n• Doubt -- At the beginning of your end step, you may return a nonland permanent you own to your hand. If you do, draw a card.', '{0}', ['3', '4']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const SAC = card('Test Fodder Pit', 'Artifact', 'Sacrifice a creature: You gain 1 life.');
  const defs = [INV, BEAR, SAC];
  const withChoice = (word: string): GameState => {
    const s0 = scenario([], { p1: { hand: ['Test Ghost Hunters'], battlefield: ['Test Bear', 'Test Fodder Pit'] }, defs });
    let s = cast(s0, 'Test Ghost Hunters');
    for (let i = 0; i < 10 && (s.zones.stack.length > 0 || s.pending?.kind !== 'priority'); i++) {
      if (s.pending?.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [s.pending.options.find((o) => o.label.includes(word))!.id] });
      else s = pass(s);
    }
    return s;
  };
  const sacBear = (s: GameState): GameState => resolveAll(drive(act(s, activations(s, 'Test Fodder Pit')[0]!.action), { objects: [[onField(s, 'Test Bear', 'p1')[0]!]] }));
  it('has no manual part', () => expect(full(INV)).toBe(true));
  it('Believe chosen: a nontoken creature of yours dying makes a 2/2 Horror token', () => {
    const s = sacBear(withChoice('Believe'));
    expect(tokens(s)).toHaveLength(1);
  });
  it('the negative case: Doubt chosen, no token when it dies (it has only the Doubt ability)', () => {
    const s = sacBear(withChoice('Doubt'));
    expect(tokens(s)).toHaveLength(0);
  });
});

describe('"Create a 5/5 black and red Elemental. Target opponent sacrifices a creature of their choice for each black creature you control, then sacrifices a land of their choice for each red creature you control." (CR 701.21a, 608.2c; Din of the Fireherd, rulings 2008-05-01)', () => {
  const DIN = card('Test Ember Din', 'Sorcery', 'Create a 5/5 black and red Elemental creature token. Target opponent sacrifices a creature of their choice for each black creature you control, then sacrifices a land of their choice for each red creature you control.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const RAT = card('Test Black Rat', 'Creature — Rat', '', '{0}', ['1', '1'], ['B']);
  const defs = [DIN, BEAR, RAT];
  it('has no manual part', () => expect(full(DIN)).toBe(true));
  it('the token is counted (ruling 2008-05-01): with one other black creature, two creatures and one land are sacrificed by the opponent', () => {
    const s0 = scenario([], { p1: { hand: ['Test Ember Din'], battlefield: ['Test Black Rat'] }, p2: { battlefield: ['Test Bear', 'Test Bear', 'Test Bear', 'Plains', 'Plains'] }, defs });
    const s = resolveAll(cast(s0, 'Test Ember Din', { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(onField(s, 'Test Bear', 'p2')).toHaveLength(1);
    expect(onField(s, 'Plains', 'p2')).toHaveLength(1);
  });
  it('the negative case: your own permanents are not sacrificed, and the opponent chooses (their choice)', () => {
    const s0 = scenario([], { p1: { hand: ['Test Ember Din'], battlefield: ['Test Black Rat', 'Plains'] }, p2: { battlefield: ['Test Bear', 'Test Bear', 'Test Bear', 'Plains'] }, defs });
    let s = cast(s0, 'Test Ember Din', { targets: [[{ kind: 'player', id: 'p2' }]] });
    for (let i = 0; i < 6 && s.pending?.kind === 'priority' && s.zones.stack.length > 0; i++) s = pass(s);
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p2' }); // two of three creatures: the opponent chooses
    s = resolveAll(drive(s));
    expect(onField(s, 'Test Bear', 'p2')).toHaveLength(1);
    expect(onField(s, 'Test Black Rat', 'p1')).toHaveLength(1);
    expect(onField(s, 'Plains', 'p1')).toHaveLength(1);
  });
});
