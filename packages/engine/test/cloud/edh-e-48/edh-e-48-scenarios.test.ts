/**
 * Round edh-e-48 (coordinator E, group replace-prevent): the behaviour it added, played through the engine with synthetic cards (invented names, design 6.10).
 *
 *   CR 614.1a, 121.2, 504.1   "The first time you would draw a card each turn except the first card you draw during each of your draw steps, you draw four cards instead." (Reed Richards,
 *                             Smartest Man): the first draw of the turn that is not the draw step's own card; the replacement's own draws are not replaced again
 *   CR 106.12, 614.1a, 106.1b "If tapped for mana, Plains produce {R}, Islands produce {G}, ... instead of any other type." (Naked Singularity, Reality Twist): per land subtype, every player's lands
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/index';
import { activatedAbilities, getChars, type ObjectId } from '../../../src/index';
import { act, advanceTo, answer, find, legal, pool, scenario } from '../../m3/scenario';
import { card, full, settle } from '../cmd3/helpers';

const handSize = (s: GameState, p = 'p1'): number => (s.zones.hand[p] ?? []).length;

const REED = card('Test Brain Trust', 'Creature — Human Scientist', 'The first time you would draw a card each turn except the first card you draw during each of your draw steps, you draw four cards instead.', ['1', '1']);
const DRAW2 = card('Test Two Thoughts', 'Instant', 'Draw two cards.');
const DRAW1 = card('Test One Thought', 'Instant', 'Draw a card.');

describe('CR 614.1a, 121.2, 504.1: first draw each turn except the draw step card -> draw four (Reed Richards)', () => {
  it('the card is fully automated', () => {
    expect(full(REED), JSON.stringify(REED.automation)).toBe(true);
  });
  const lib = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
  const cast = (s0: GameState, name: string): GameState => {
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand') }));
    for (let i = 0; i < 8 && s.zones.stack.length > 0; i++) s = settle(act(s, { type: 'pass', player: s.pending!.player }));
    return s;
  };
  const board = (withReed: boolean): GameState => scenario(['Plains'], { defs: [REED, DRAW2, DRAW1], p1: { battlefield: withReed ? ['Test Brain Trust'] : [], hand: ['Test Two Thoughts', 'Test One Thought'], library: lib } });
  it('a main-phase draw of two: the first is replaced by four, the second is ordinary (five cards for the spell, which left the hand)', () => {
    const s = cast(board(true), 'Test Two Thoughts');
    expect(handSize(s)).toBe(1 + 4 + 1);
  });
  it('negative: without the permanent the same spell draws two', () => {
    const s = cast(board(false), 'Test Two Thoughts');
    expect(handSize(s)).toBe(1 + 2);
  });
  it('the replacement applies once a turn: a second spell draws one card as usual', () => {
    let s = cast(board(true), 'Test One Thought');
    s = cast(s, 'Test Two Thoughts');
    expect(handSize(s)).toBe(1 + 4 + 2 - 1); // 2 in hand -> cast one (+4) = 5 -> cast the other (+2) = 6
  });
  it('the draw step card of the next own turn is not replaced; a draw after it in that turn is', () => {
    let s = board(true);
    s = advanceTo(s, 3, 'main1'); // p2's turn 2 passed; p1's turn 3: draw step drew one card
    expect(handSize(s)).toBe(2 + 1);
    s = cast(s, 'Test One Thought');
    expect(handSize(s)).toBe(3 - 1 + 4); // the spell left, four cards were drawn instead of its one
  });
});

describe('CR 106.12, 614.1a, 106.1b: "If tapped for mana, Plains produce {R}, Islands produce {G}, Swamps produce {W}, Mountains produce {U}, and Forests produce {B} instead of any other type." (Naked Singularity)', () => {
  const SING = card('Test Warped Field', 'Enchantment', 'If tapped for mana, Plains produce {R}, Islands produce {G}, Swamps produce {W}, Mountains produce {U}, and Forests produce {B} instead of any other type.');
  const TWIST = card('Test Twisted Field', 'Enchantment', 'If tapped for mana, Plains produce {R}, Swamps produce {G}, Mountains produce {W}, and Forests produce {B} instead of any other type.');
  const lands = [
    card('Test Plains', 'Basic Land — Plains', '{T}: Add {W}.'), card('Test Island', 'Basic Land — Island', '{T}: Add {U}.'), card('Test Swamp', 'Basic Land — Swamp', '{T}: Add {B}.'),
    card('Test Mountain', 'Basic Land — Mountain', '{T}: Add {R}.'), card('Test Forest', 'Basic Land — Forest', '{T}: Add {G}.'), card('Test Wastes', 'Land', '{T}: Add {C}.'),
    card('Test Twin Plains', 'Land — Plains', '{T}: Add {W}{W}.'),
  ];
  const tap = (s: GameState, name: string, who = 'p1'): GameState => {
    const src: ObjectId = find(s, name, 'battlefield', who);
    return settle(act(s, { type: 'activate', player: who, source: src, ability: activatedAbilities(s, s.objects[src]!)[0]!.key } as never));
  };
  const names = lands.map((l) => l.name);
  const game = (field: string, opp = false): GameState => scenario([], { defs: [SING, TWIST, ...lands], p1: { battlefield: opp ? names : [field, ...names] }, p2: { battlefield: opp ? [field] : [] } });
  it('both cards are fully automated', () => { expect(full(SING), JSON.stringify(SING.automation)).toBe(true); expect(full(TWIST), JSON.stringify(TWIST.automation)).toBe(true); });
  it('Naked Singularity: each basic type produces the next color; Wastes (no basic type) is unchanged; the amount of a Plains that adds two stays two', () => {
    const s = game('Test Warped Field');
    expect(pool(tap(s, 'Test Plains'), 'p1')).toBe('R');
    expect(pool(tap(s, 'Test Island'), 'p1')).toBe('G');
    expect(pool(tap(s, 'Test Swamp'), 'p1')).toBe('W');
    expect(pool(tap(s, 'Test Mountain'), 'p1')).toBe('U');
    expect(pool(tap(s, 'Test Forest'), 'p1')).toBe('B');
    expect(pool(tap(s, 'Test Wastes'), 'p1')).toBe('C');
    expect(pool(tap(s, 'Test Twin Plains'), 'p1')).toBe('RR');
  });
  it('Reality Twist: Islands are not changed (it names four types)', () => {
    const s = game('Test Twisted Field');
    expect(pool(tap(s, 'Test Island'), 'p1')).toBe('U');
    expect(pool(tap(s, 'Test Plains'), 'p1')).toBe('R');
    expect(pool(tap(s, 'Test Swamp'), 'p1')).toBe('G');
    expect(pool(tap(s, 'Test Mountain'), 'p1')).toBe('W');
    expect(pool(tap(s, 'Test Forest'), 'p1')).toBe('B');
  });
  it("it changes an opponent's lands too", () => {
    expect(pool(tap(game('Test Warped Field', true), 'Test Plains'), 'p1')).toBe('R');
  });
  it('negative: without the enchantment a Plains adds {W}', () => {
    expect(pool(tap(scenario([], { defs: lands, p1: { battlefield: names } }), 'Test Plains'), 'p1')).toBe('W');
  });
  it('the payment planner agrees: with Naked Singularity a Plains pays {R}, not {W}', () => {
    const RED = card('Test Red Spell', 'Sorcery', 'You gain 1 life.', undefined, '{R}');
    const WHITE = card('Test White Spell', 'Sorcery', 'You gain 1 life.', undefined, '{W}');
    const s = scenario([], { defs: [SING, RED, WHITE, lands[0]!], p1: { hand: ['Test Red Spell', 'Test White Spell'], battlefield: ['Test Warped Field', 'Test Plains'] } });
    const castable = legal(s, 'p1', 'cast').map((a) => s.objects[(a as { object: ObjectId }).object]!.defId);
    expect(castable).toContain('Test Red Spell');
    expect(castable).not.toContain('Test White Spell');
  });
});

describe('CR 614.1a, 120.3, 701.21a: "If damage would be dealt to ~, sacrifice that many permanents instead." (Dralnu, Lich Lord)', () => {
  const LICH = card('Test Bone Lord', 'Legendary Creature — Zombie Wizard', 'If damage would be dealt to ~, sacrifice that many permanents instead.', ['3', '3']);
  const BOLT = card('Test Spark Bolt', 'Instant', 'Test Spark Bolt deals 2 damage to target creature.', undefined, '{0}');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const targetOf = (s: GameState, n: string): ObjectId => find(s, n, 'battlefield', 'p1');
  const burn = (name: string): GameState => {
    const s0 = scenario([], { defs: [LICH, BOLT, BEAR], p1: { hand: ['Test Spark Bolt'], battlefield: ['Test Bone Lord', 'Test Bear', 'Test Bear', 'Test Bear'] } });
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Spark Bolt', 'hand') });
    s = settle(s, { targets: [{ kind: 'object', id: targetOf(s0, name) } as never] });
    return s;
  };
  const perm = (s: GameState): number => s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p1').length;
  it('the card is fully automated', () => { expect(full(LICH), JSON.stringify(LICH.automation)).toBe(true); });
  /** Both pass; the bolt resolves and Bone Lord's replacement asks its controller to choose the permanents to sacrifice. */
  const toChoice = (s0: GameState): GameState => { let s = s0; for (let i = 0; i < 4 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player }); return s; };
  it('2 damage to it: no damage is dealt; its controller chooses and sacrifices two permanents, here two Bears', () => {
    let s = toChoice(burn('Test Bone Lord'));
    expect(s.pending?.kind).toBe('chooseObjects');
    const p = s.pending as unknown as { options: ObjectId[]; min: number; max: number; player: string };
    expect(p.player).toBe('p1');
    expect([p.min, p.max]).toEqual([2, 2]);
    expect(p.options).toHaveLength(4); // any permanent they control, itself included
    const bears = p.options.filter((id) => s.objects[id]!.defId === 'Test Bear').slice(0, 2);
    s = answer(s, { kind: 'chooseObjects', ids: bears });
    expect(perm(s)).toBe(2);
    expect(s.objects[targetOf(s, 'Test Bone Lord')]!.damage ?? 0).toBe(0);
  });
  it('ruling 2021-03-19: more damage than the permanents you control: you sacrifice all of them (5 damage, 4 permanents: all 4)', () => {
    const BIGBOLT = card('Test Big Spark', 'Instant', 'Test Big Spark deals 5 damage to target creature.', undefined, '{0}');
    const s0 = scenario([], { defs: [LICH, BIGBOLT, BEAR], p1: { hand: ['Test Big Spark'], battlefield: ['Test Bone Lord', 'Test Bear', 'Test Bear', 'Test Bear'] } });
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Big Spark', 'hand') });
    s = settle(s, { targets: [{ kind: 'object', id: targetOf(s0, 'Test Bone Lord') } as never] });
    s = toChoice(s);
    // with at least as much damage as permanents there is nothing to choose: all of them are sacrificed (the engine may still ask; if it does, answer with every option)
    if (s.pending?.kind === 'chooseObjects') { const p = s.pending as unknown as { options: ObjectId[]; max: number }; s = answer(s, { kind: 'chooseObjects', ids: p.options.slice(0, p.max) }); }
    expect(perm(s)).toBe(0);
  });
  it('negative: 2 damage to a Bear is dealt as usual and nothing is sacrificed', () => {
    const s0 = burn('Test Bear');
    let s = s0;
    for (let i = 0; i < 4 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
    expect(s.pending?.kind).not.toBe('chooseObjects');
    expect(perm(s)).toBe(3); // the damaged Bear (2/2) died
  });
});

describe('CR 614.1a, 614.6, 121.2: "Until end of turn, if target player would draw a card, instead that player skips that draw and you draw a card." (Plagiarize)', () => {
  const PLAG = card('Test Copycat', 'Instant', 'Until end of turn, if target player would draw a card, instead that player skips that draw and you draw a card.');
  const GIFT = card('Test Gift of Cards', 'Sorcery', 'Target player draws two cards.');
  const SELF = card('Test Own Thought', 'Sorcery', 'Draw a card.');
  const lib = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
  const base = (): GameState => scenario([], { defs: [PLAG, GIFT, SELF], p1: { hand: ['Test Copycat', 'Test Gift of Cards', 'Test Own Thought'], library: lib }, p2: { library: lib } });
  const castAt = (s0: GameState, name: string, target?: 'p1' | 'p2'): GameState => {
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand') });
    s = settle(s, target === undefined ? {} : { targets: [{ kind: 'player', id: target } as never] });
    for (let i = 0; i < 6 && s.zones.stack.length > 0 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
    return s;
  };
  it('the card is fully automated', () => { expect(full(PLAG), JSON.stringify(PLAG.automation)).toBe(true); });
  it('after it, a spell that makes the target player draw two: they draw nothing and you draw two', () => {
    let s = castAt(base(), 'Test Copycat', 'p2');
    expect(handSize(s, 'p2')).toBe(0);
    const before = handSize(s);
    s = castAt(s, 'Test Gift of Cards', 'p2');
    expect(handSize(s, 'p2')).toBe(0);
    expect(handSize(s)).toBe(before - 1 + 2);
  });
  it("negative: your own draw is not skipped (the target was the other player); and without it the target draws", () => {
    let s = castAt(base(), 'Test Copycat', 'p2');
    const before = handSize(s);
    s = castAt(s, 'Test Own Thought');
    expect(handSize(s)).toBe(before - 1 + 1);
    const t = castAt(base(), 'Test Gift of Cards', 'p2');
    expect(handSize(t, 'p2')).toBe(2);
  });
  it('ruling 2004-10-04: targeting yourself has no useful effect (a replacement applies once to an event): you draw the cards you were going to draw', () => {
    let s = castAt(base(), 'Test Copycat', 'p1');
    const before = handSize(s);
    s = castAt(s, 'Test Gift of Cards', 'p1');
    expect(handSize(s)).toBe(before - 1 + 2);
  });
  it('ruling 2007-07-15: the target has an empty library: their draw is replaced, so they do not lose and you draw', () => {
    const s0 = scenario([], { defs: [PLAG, GIFT, SELF], p1: { hand: ['Test Copycat', 'Test Gift of Cards'], library: lib }, p2: { library: [] } });
    let s = castAt(s0, 'Test Copycat', 'p2');
    s = castAt(s, 'Test Gift of Cards', 'p2');
    expect(s.result).toBeFalsy();
    expect(handSize(s)).toBe(2);
  });
  it('negative: it ends with the turn: on the target player\'s own next turn the draw step draws normally', () => {
    let s = castAt(base(), 'Test Copycat', 'p2');
    const before = handSize(s, 'p1');
    s = advanceTo(s, 2, 'main1');
    expect(handSize(s, 'p2')).toBe(1);
    expect(handSize(s, 'p1')).toBe(before);
  });
});

describe('CR 614.1a, 614.6, 504.1, 701.9a: Chains of Mephistopheles', () => {
  const CHAINS = card('Test Iron Chains', 'Enchantment', "If a player would draw a card except the first one they draw in each of their draw steps, that player discards a card instead. If the player discards a card this way, they draw a card. If the player doesn't discard a card this way, they mill a card.");
  const DRAW1b = card('Test Quick Thought', 'Instant', 'Draw a card.');
  const lib = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
  const board = (hand: string[]): GameState => scenario([], { defs: [CHAINS, DRAW1b, ...lands()], p1: { hand, battlefield: ['Test Iron Chains'], library: lib } });
  function lands() { return [card('Test Filler', 'Sorcery', 'You gain 1 life.')]; }
  const gy = (s: GameState, p = 'p1'): number => (s.zones.graveyard[p] ?? []).length;
  const lib1 = (s: GameState, p = 'p1'): number => (s.zones.library[p] ?? []).length;
  const run = (s0: GameState): GameState => {
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Quick Thought', 'hand') }));
    for (let i = 0; i < 8 && (s.zones.stack.length > 0 || s.pending?.kind === 'chooseObjects'); i++) {
      if (s.pending?.kind === 'chooseObjects') { const p = s.pending as unknown as { options: ObjectId[]; min: number }; s = answer(s, { kind: 'chooseObjects', ids: p.options.slice(0, p.min) }); }
      else s = act(s, { type: 'pass', player: s.pending!.player });
    }
    return s;
  };
  it('the card is fully automated', () => { expect(full(CHAINS), JSON.stringify(CHAINS.automation)).toBe(true); });
  it('a draw outside the draw step with a card in hand: that player discards a card instead, then draws a card (hand size unchanged, the spell left, one card in the graveyard besides it)', () => {
    const s0 = board(['Test Quick Thought', 'Test Filler']);
    const l0 = lib1(s0);
    const s = run(s0);
    expect(gy(s)).toBe(2); // the spell and the discarded card
    expect(handSize(s)).toBe(1); // discarded Filler, drew a card
    expect(lib1(s)).toBe(l0 - 1);
  });
  it('with no card to discard: they mill a card instead and do not draw', () => {
    const s0 = board(['Test Quick Thought']);
    const l0 = lib1(s0);
    const s = run(s0);
    expect(handSize(s)).toBe(0);
    expect(lib1(s)).toBe(l0 - 1);
    expect(gy(s)).toBe(2); // the spell and the milled card
  });
  it('negative: the draw step card of its own turn is drawn normally', () => {
    const s = advanceTo(board(['Test Filler']), 3, 'main1');
    expect(handSize(s)).toBe(2);
    expect(gy(s)).toBe(0);
  });
});

describe('CR 702.103b, 614.15, 608.2c: "~ gets +1/+0 until end of turn. If it\'s an Aura, enchanted creature gets +1/+0 until end of turn instead." (Everflame Eidolon, Erebos\'s Emissary)', () => {
  const EIDOLON = card('Test Spark Spirit', 'Enchantment Creature — Spirit', 'Bestow {0}\n{0}: This creature gets +1/+0 until end of turn. If it\'s an Aura, enchanted creature gets +1/+0 until end of turn instead.\nEnchanted creature gets +1/+1.', ['2', '2']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const powerOf = (s: GameState, id: ObjectId): number => Number(getChars(s, id)!.power);
  const pumpIt = (s0: GameState, spirit: ObjectId): GameState => {
    const ab = activatedAbilities(s0, s0.objects[spirit]!)[0]!;
    let s = settle(act(s0, { type: 'activate', player: 'p1', source: spirit, ability: ab.key } as never));
    for (let i = 0; i < 4 && s.zones.stack.length > 0; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    return s;
  };
  it('the card is fully automated', () => { expect(full(EIDOLON), JSON.stringify(EIDOLON.automation)).toBe(true); });
  it('as a creature it pumps itself', () => {
    const s0 = scenario([], { defs: [EIDOLON, BEAR], p1: { battlefield: ['Test Spark Spirit', 'Test Bear'] } });
    const spirit = find(s0, 'Test Spark Spirit', 'battlefield', 'p1');
    const s = pumpIt(s0, spirit);
    expect(powerOf(s, spirit)).toBe(3);
    expect(powerOf(s, find(s, 'Test Bear', 'battlefield', 'p1'))).toBe(2);
  });
  it('bestowed on a Bear (an Aura) it pumps the enchanted Bear instead, not itself (it is no creature then)', () => {
    let s = scenario([], { defs: [EIDOLON, BEAR], p1: { hand: ['Test Spark Spirit'], battlefield: ['Test Bear'] } });
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Spark Spirit', 'hand', 'p1'), method: 'bestow' });
    for (let g = 0; s.pending && s.pending.kind !== 'priority' && g < 20; g++) s = s.pending.kind === 'chooseTargets' ? answer(s, { kind: 'chooseTargets', targets: [{ kind: 'object', id: bear }] as never }) : answer(s, { kind: 'payCost', auto: true });
    s = act(s, { type: 'pass', player: s.pending!.player }); s = act(s, { type: 'pass', player: s.pending!.player });
    const spirit = find(s, 'Test Spark Spirit', 'battlefield', 'p1');
    expect(s.objects[spirit]!.attachedTo).toBe(bear);
    expect(powerOf(s, bear)).toBe(3); // +1/+1 from the Aura
    s = pumpIt(s, spirit);
    expect(powerOf(s, bear)).toBe(4);
  });
});

describe('CR 613.1f, 113.10, 615: "{2}: Until end of turn, ~ loses \\"Prevent all damage that would be dealt to ~.\\" Any player may activate this ability." (Glittering Lynx)', () => {
  const LYNX = card('Test Glitter Cat', 'Creature — Cat', 'Prevent all damage that would be dealt to this creature.\n{0}: Until end of turn, this creature loses "Prevent all damage that would be dealt to this creature." Any player may activate this ability.', ['2', '2']);
  const BOLT = card('Test Spark Bolt', 'Instant', 'Test Spark Bolt deals 2 damage to target creature.', undefined, '{0}');
  const dmg = (s: GameState, id: ObjectId): number => s.objects[id]!.damage ?? 0;
  const FILLER = card('Test Filler', 'Instant', 'You gain 1 life.');
  const base = (): GameState => scenario([], { defs: [LYNX, BOLT, FILLER], p1: { battlefield: ['Test Glitter Cat'], hand: ['Test Spark Bolt', 'Test Filler'] }, p2: { hand: [] } });
  const bolt = (s0: GameState): GameState => {
    const cat = find(s0, 'Test Glitter Cat', 'battlefield', 'p1');
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Spark Bolt', 'hand') });
    s = settle(s, { targets: [{ kind: 'object', id: cat } as never] });
    for (let i = 0; i < 4 && s.zones.stack.length > 0 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
    return s;
  };
  const lose = (s00: GameState, who: 'p1' | 'p2'): GameState => {
    let s0 = s00;
    if (who === 'p2') { // the opponent needs priority: Alice casts a spell and passes
      s0 = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Filler', 'hand') }));
      s0 = act(s0, { type: 'pass', player: 'p1' });
      expect(s0.pending?.player).toBe('p2');
    }
    const cat = find(s0, 'Test Glitter Cat', 'battlefield', 'p1');
    const ab = activatedAbilities(s0, s0.objects[cat]!)[0]!;
    let s = settle(act(s0, { type: 'activate', player: who, source: cat, ability: ab.key } as never));
    for (let i = 0; i < 4 && s.zones.stack.length > 0 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
    return s;
  };
  it('the card is fully automated', () => { expect(full(LYNX), JSON.stringify(LYNX.automation)).toBe(true); });
  it('negative: with its ability, 2 damage from a spell is prevented', () => {
    const s = bolt(base());
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Glitter Cat')).toBe(true);
    expect(dmg(s, find(s, 'Test Glitter Cat', 'battlefield', 'p1'))).toBe(0);
  });
  it("after an opponent activates it ('any player may'), the same damage is dealt and the 2/2 dies", () => {
    const s = bolt(lose(base(), 'p2'));
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Glitter Cat')).toBe(false);
  });
  it('the loss ends with the turn: on the next turn the creature prevents damage again', () => {
    let s = lose(base(), 'p1');
    s = advanceTo(s, 3, 'main1');
    const cat = find(s, 'Test Glitter Cat', 'battlefield', 'p1');
    expect(getChars(s, cat)!.abilities.some((a) => a.def.kind === 'static')).toBe(true);
  });
});

describe('CR 106.12, 614.1a: "Until end of turn, if a player taps a nonbasic land for mana, it produces colorless mana instead of any other type." (Pale Moon)', () => {
  const MOON = card('Test Pale Disc', 'Instant', 'Until end of turn, if a player taps a nonbasic land for mana, it produces colorless mana instead of any other type.');
  const FOREST = card('Test Forest', 'Basic Land — Forest', '{T}: Add {G}.');
  const CITY = card('Test Dual City', 'Land', '{T}: Add {R}{R}.');
  const tap = (s: GameState, name: string, who = 'p1'): GameState => {
    const src: ObjectId = find(s, name, 'battlefield', who);
    return settle(act(s, { type: 'activate', player: who, source: src, ability: activatedAbilities(s, s.objects[src]!)[0]!.key } as never));
  };
  const withMoon = (): GameState => {
    const s0 = scenario([], { defs: [MOON, FOREST, CITY], p1: { hand: ['Test Pale Disc'], battlefield: ['Test Forest', 'Test Dual City'] }, p2: { battlefield: ['Test Dual City'] } });
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Pale Disc', 'hand') }));
    for (let i = 0; i < 4 && s.zones.stack.length > 0 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
    return s;
  };
  it('the card is fully automated', () => { expect(full(MOON), JSON.stringify(MOON.automation)).toBe(true); });
  it('a nonbasic land adds colorless (the same amount); a basic land is unchanged', () => {
    const s = withMoon();
    expect(pool(tap(s, 'Test Dual City'), 'p1')).toBe('CC');
    expect(pool(tap(s, 'Test Forest'), 'p1')).toBe('G');
  });
  it("any player's nonbasic lands are changed, not only yours (Bob taps his City while Alice's spell is on the stack)", () => {
    const FILL = card('Test Filler Gain', 'Instant', 'You gain 1 life.');
    const s0 = scenario([], { defs: [MOON, FOREST, CITY, FILL], p1: { hand: ['Test Pale Disc', 'Test Filler Gain'], battlefield: ['Test Dual City'] }, p2: { battlefield: ['Test Dual City'] } });
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Pale Disc', 'hand') }));
    while (s.zones.stack.length > 0) s = act(s, { type: 'pass', player: s.pending!.player });
    s = settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Filler Gain', 'hand') }));
    s = act(s, { type: 'pass', player: 'p1' });
    expect(s.pending?.player).toBe('p2');
    expect(pool(tap(s, 'Test Dual City', 'p2'), 'p2')).toBe('CC');
  });
  it('negative: before it is cast the nonbasic land adds its own mana; and the effect ends at end of turn', () => {
    const s0 = scenario([], { defs: [MOON, FOREST, CITY], p1: { hand: ['Test Pale Disc'], battlefield: ['Test Dual City'] } });
    expect(pool(tap(s0, 'Test Dual City'), 'p1')).toBe('RR');
    const s = advanceTo(withMoon(), 3, 'main1');
    expect(pool(tap(s, 'Test Dual City'), 'p1')).toBe('RR');
  });
});
