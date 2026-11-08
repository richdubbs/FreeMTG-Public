/**
 * Commander coordinator E, round edh-e-37 (graveyard 1/3): its cards played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's default compiler.
 * Alice (p1) is the active player of turn 1, Bob (p2) the other player. Each test is named after the rule it checks, with its negative case. CR cites are from memory (cloud session,
 * no rules/cr folder): unverified; rulings from Scryfall (fetched 2026-11-06).
 *
 *   CR 101.4, 608.2d, 110.2a, 202.3, 400.7   "When ~ enters, each player puts a creature card with mana value 3 or less from their graveyard onto the battlefield." (Crypt Champion; ruling 2006-05-01)
 *   CR 608.2d, 110.2, 108.3                  "Target opponent chooses an artifact card in their graveyard. Put that card onto the battlefield under your control." (Scrounge)
 *   CR 118.3, 118.12, 401.4, 400.3           "Sacrifice ~ unless you put a card (two cards) from your graveyard on the bottom of your library." (Anurid Scavenger, Gurzigost)
 *   CR 510.1b-c, 609.4, 611.2a               "You may have ~ assign its combat damage this turn as though it weren't blocked." (Gurzigost; ruling 2008-04-01)
 *   CR 608.2d, 608.2c, 400.3, 208.1          "Return to your hand the creature card in your graveyard with the greatest power. If two or more cards are tied for greatest power, you choose one of them."
 *                                            (Desecrator Hag; ruling 2008-08-01: a tie is broken as the ability resolves)
 *   CR 303.4f, 303.4g, 400.3, 603.10a        "When enchanted creature leaves the battlefield, that creature's controller returns this Aura from its owner's graveyard to the battlefield." (Traveling Plague;
 *                                            rulings 2005-08-01, 2004-10-04: the controller of the dead creature chooses the new creature)
 *   CR 118.3, 601.2b, 602.2b                 "Exile one or more creature cards from your graveyard: Create a tapped X/X ... where X is twice the number of cards exiled this way." (Corpseweft; rulings 2015-02-25)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId, PlayerId } from '../../../src/index';
import { activations, answer, card, drive, find, full, legal, passBoth, resolveAll, scenario } from '../r3-cost/support';
import { act } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers } from '../../m4/helpers';

const names = (s: GameState, zone: 'battlefield' | 'graveyard' | 'hand' | 'library', p: PlayerId): string[] =>
  (zone === 'battlefield' ? s.zones.battlefield.filter((id) => s.objects[id]!.controller === p) : s.zones[zone][p]!).map((id) => s.objects[id]!.defId);
const life = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;

// ---- Crypt Champion ------------------------------------------------------------------------------------------------------------------------------------------------
describe('Crypt Champion: each player puts a creature card with mana value 3 or less from their graveyard onto the battlefield (CR 101.4, 608.2d, 202.3)', () => {
  const WARDEN = card('Test Crypt Warden', 'Creature — Zombie', 'When this creature enters, each player puts a creature card with mana value 3 or less from their graveyard onto the battlefield.', '{0}', ['1', '1']);
  const A2 = card('Test Alice Two', 'Creature — Elf', '', '{1}{G}', ['2', '2']);
  const A5 = card('Test Alice Five', 'Creature — Giant', '', '{4}{G}', ['5', '5']);
  const B3 = card('Test Bob Three', 'Creature — Orc', '', '{2}{R}', ['3', '3']);
  const B4 = card('Test Bob Four', 'Creature — Ogre', '', '{3}{R}', ['4', '4']);
  const BX = card('Test Bob Relic', 'Artifact', '', '{1}');
  const defs = [WARDEN, A2, A5, B3, B4, BX];
  it('is automated', () => expect(full(WARDEN)).toBe(true));
  it('each player chooses their own card: only mana value 3 or less, from their own graveyard, and each enters under its owner\'s control', () => {
    const s0 = scenario([], { p1: { hand: ['Test Crypt Warden'], graveyard: ['Test Alice Two', 'Test Alice Five'] }, p2: { graveyard: ['Test Bob Three', 'Test Bob Four', 'Test Bob Relic'] }, defs });
    const s = resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Crypt Warden', 'hand', 'p1') })));
    expect(names(s, 'battlefield', 'p1').sort()).toEqual(['Test Alice Two', 'Test Crypt Warden']);
    expect(names(s, 'battlefield', 'p2')).toEqual(['Test Bob Three']);
    expect(names(s, 'graveyard', 'p1')).toEqual(['Test Alice Five']); // mana value 5: not a choice
    expect(names(s, 'graveyard', 'p2').sort()).toEqual(['Test Bob Four', 'Test Bob Relic']);
  });
  it('negative: a player with no creature card of mana value 3 or less does nothing (the ruling 2006-05-01), the other still puts one', () => {
    const s0 = scenario([], { p1: { hand: ['Test Crypt Warden'], graveyard: ['Test Alice Two'] }, p2: { graveyard: ['Test Bob Four', 'Test Bob Relic'] }, defs });
    const s = resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Crypt Warden', 'hand', 'p1') })));
    expect(names(s, 'battlefield', 'p1').sort()).toEqual(['Test Alice Two', 'Test Crypt Warden']);
    expect(names(s, 'battlefield', 'p2')).toEqual([]);
  });
});

// ---- Scrounge -------------------------------------------------------------------------------------------------------------------------------------------------------
describe('Scrounge: the opponent chooses an artifact card in their graveyard and you put it onto the battlefield under your control (CR 608.2d, 110.2)', () => {
  const SCROUNGE = card('Test Scrounger', 'Sorcery', 'Target opponent chooses an artifact card in their graveyard. Put that card onto the battlefield under your control.');
  const R1 = card('Test Cheap Relic', 'Artifact', '', '{1}');
  const R2 = card('Test Fine Relic', 'Artifact', '', '{5}');
  const CR = card('Test Plain Bear', 'Creature — Bear', '', '{1}{G}', ['2', '2']);
  const defs = [SCROUNGE, R1, R2, CR];
  it('is automated', () => expect(full(SCROUNGE)).toBe(true));
  it('Bob (not Alice) chooses among his own artifact cards only; the chosen card enters under Alice\'s control and the other stays', () => {
    const s0 = scenario([], { p1: { hand: ['Test Scrounger'], graveyard: ['Test Fine Relic'] }, p2: { graveyard: ['Test Cheap Relic', 'Test Fine Relic', 'Test Plain Bear'] }, defs });
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Scrounger', 'hand', 'p1') }), { targets: [[{ kind: 'player', id: 'p2' }]] });
    s = passBoth(s);
    expect(s.pending?.kind).toBe('chooseObjects');
    const p = s.pending as Extract<NonNullable<GameState['pending']>, { kind: 'chooseObjects' }>;
    expect(p.player).toBe('p2');
    expect(p.options.map((id) => s.objects[id]!.defId).sort()).toEqual(['Test Cheap Relic', 'Test Fine Relic']);
    expect(p.options.every((id) => s.objects[id]!.owner === 'p2')).toBe(true);
    const cheap = p.options.find((id) => s.objects[id]!.defId === 'Test Cheap Relic')!;
    s = resolveAll(answer(s, { kind: 'chooseObjects', ids: [cheap] }));
    expect(names(s, 'battlefield', 'p1')).toEqual(['Test Cheap Relic']);
    expect(s.objects[find(s, 'Test Cheap Relic', 'battlefield')]!.owner).toBe('p2');
    expect(names(s, 'graveyard', 'p2').sort()).toEqual(['Test Fine Relic', 'Test Plain Bear']);
    expect(names(s, 'graveyard', 'p1').sort()).toEqual(['Test Fine Relic', 'Test Scrounger']); // Alice's own graveyard is never looked at (the spell itself is there now)
  });
  it('negative: an opponent with no artifact card in their graveyard gives nothing', () => {
    const s0 = scenario([], { p1: { hand: ['Test Scrounger'], graveyard: ['Test Fine Relic'] }, p2: { graveyard: ['Test Plain Bear'] }, defs });
    const s = resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Scrounger', 'hand', 'p1') }), { targets: [[{ kind: 'player', id: 'p2' }]] }));
    expect(names(s, 'battlefield', 'p1')).toEqual([]);
  });
});

// ---- Anurid Scavenger and Gurzigost: sacrifice unless you put cards from your graveyard on the bottom of your library ---------------------------
describe('Sacrifice unless you put a card from your graveyard on the bottom of your library (CR 118.12, 118.3, 401.4)', () => {
  const ONE = card('Test Frog', 'Creature — Frog', '{0}: Sacrifice this creature unless you put a card from your graveyard on the bottom of your library.', '{0}', ['2', '2']);
  const TWO = card('Test Beast', 'Creature — Beast', '{0}: Sacrifice this creature unless you put two cards from your graveyard on the bottom of your library.', '{0}', ['2', '2']);
  const FOOD = card('Test Scrap', 'Sorcery', '');
  const FOOD2 = card('Test Scrap Two', 'Instant', '');
  const defs = [ONE, TWO, FOOD, FOOD2];
  const activate = (s: GameState, name: string, yes: boolean, objects: ObjectId[][] = []): GameState => {
    let r = drive(act(s, activations(s, name)[0]!.action), { yes: [yes], objects });
    r = resolveAll(r, { yes: [yes], objects });
    return r;
  };
  it('are automated', () => { expect(full(ONE)).toBe(true); expect(full(TWO)).toBe(true); });
  it('paying: the chosen card goes to the bottom of its owner\'s library, the creature stays', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Frog'], graveyard: ['Test Scrap', 'Test Scrap Two'] }, defs });
    const lib0 = [...s0.zones.library.p1!];
    const s = activate(s0, 'Test Frog', true);
    expect(names(s, 'battlefield', 'p1')).toEqual(['Test Frog']);
    expect(names(s, 'graveyard', 'p1').length).toBe(1);
    expect(s.zones.library.p1!.length).toBe(lib0.length + 1);
    const bottom = s.zones.library.p1![s.zones.library.p1!.length - 1]!;
    expect(['Test Scrap', 'Test Scrap Two']).toContain(s.objects[bottom]!.defId); // the card put there is on the bottom
    expect(s.zones.library.p1!.slice(0, lib0.length)).toEqual(lib0);
  });
  it('negative: declining sacrifices it and keeps the graveyard; an empty graveyard cannot pay', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Frog'], graveyard: ['Test Scrap'] }, defs });
    const s = activate(s0, 'Test Frog', false);
    expect(names(s, 'battlefield', 'p1')).toEqual([]);
    expect(names(s, 'graveyard', 'p1').sort()).toEqual(['Test Frog', 'Test Scrap']);
    const e0 = scenario([], { p1: { battlefield: ['Test Frog'] }, defs });
    const e = activate(e0, 'Test Frog', true);
    expect(names(e, 'battlefield', 'p1')).toEqual([]);
  });
  it('two cards: both go to the bottom; with only one card in the graveyard the cost cannot be paid and the creature is sacrificed', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Beast'], graveyard: ['Test Scrap', 'Test Scrap Two'] }, defs });
    const lib0 = s0.zones.library.p1!.length;
    const s = activate(s0, 'Test Beast', true);
    expect(names(s, 'battlefield', 'p1')).toEqual(['Test Beast']);
    expect(names(s, 'graveyard', 'p1')).toEqual([]);
    expect(s.zones.library.p1!.length).toBe(lib0 + 2);
    const one = scenario([], { p1: { battlefield: ['Test Beast'], graveyard: ['Test Scrap'] }, defs });
    const t = activate(one, 'Test Beast', true);
    expect(names(t, 'battlefield', 'p1')).toEqual([]);
    expect(names(t, 'graveyard', 'p1')).toContain('Test Scrap');
  });
});

// ---- Gurzigost: assign combat damage as though it weren't blocked this turn ------------------------------------------------------------------
describe('Gurzigost: "You may have ~ assign its combat damage this turn as though it weren\'t blocked." (CR 510.1b-c, 609.4, 611.2a)', () => {
  const BEAST = card('Test Gorger', 'Creature — Beast', '{0}: You may have this creature assign its combat damage this turn as though it weren\'t blocked.', '{0}', ['3', '3']);
  const WALL = card('Test Stone Wall', 'Creature — Wall', '', '{0}', ['0', '5']);
  const defs = [BEAST, WALL];
  it('is automated', () => expect(full(BEAST)).toBe(true));
  const setup = () => scenario([], { p1: { battlefield: ['Test Gorger'] }, p2: { battlefield: ['Test Stone Wall'] }, defs });
  const use = (s0: GameState, yes: boolean): GameState => {
    let s = act(s0, activations(s0, 'Test Gorger')[0]!.action);
    s = drive(s, { yes: [yes] });
    for (let i = 0; i < 6 && s.zones.stack.length > 0; i++) s = drive(passBoth(s), { yes: [yes] });
    return s;
  };
  const fight = (s0: GameState): GameState => {
    const gorger = find(s0, 'Test Gorger', 'battlefield');
    const wall = find(s0, 'Test Stone Wall', 'battlefield');
    let s = declareAttackers(toDeclareAttackers(s0), [[gorger]]);
    s = declareBlockers(passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers'), [[wall, gorger]]);
    return passUntil(s, (x) => x.turn.step === 'endCombat', 'end of combat');
  };
  it('using it as it resolves: all its damage goes to the player and the blocker takes none', () => {
    const s = fight(use(setup(), true));
    expect(life(s, 'p2')).toBe(17);
    expect(s.objects[find(s, 'Test Stone Wall', 'battlefield')]!.damage).toBe(0);
  });
  it('negative: declining leaves the damage with the blocker; and without the ability nothing changes', () => {
    const s = fight(use(setup(), false));
    expect(life(s, 'p2')).toBe(20);
    expect(s.objects[find(s, 'Test Stone Wall', 'battlefield')]!.damage).toBe(3);
    const t = fight(setup());
    expect(life(t, 'p2')).toBe(20);
  });
});

// ---- Desecrator Hag --------------------------------------------------------------------------------------------------------------------------------------------------
describe('Desecrator Hag: return the creature card in your graveyard with the greatest power; you choose among ties (CR 608.2d, 400.3, 208.1)', () => {
  const HAG = card('Test Gravehag', 'Creature — Hag', 'When this creature enters, return to your hand the creature card in your graveyard with the greatest power. If two or more cards are tied for greatest power, you choose one of them.', '{0}', ['2', '2']);
  const P2 = card('Test Small', 'Creature — Elf', '', '{1}', ['2', '2']);
  const P4a = card('Test Big A', 'Creature — Ogre', '', '{3}', ['4', '1']);
  const P4b = card('Test Big B', 'Creature — Troll', '', '{3}', ['4', '4']);
  const P1 = card('Test Tiny', 'Creature — Rat', '', '{1}', ['1', '1']);
  const ART = card('Test Heavy Relic', 'Artifact Creature — Golem', '', '{6}', ['9', '9']);
  const SPELL = card('Test Plain Sorcery', 'Sorcery', '');
  const defs = [HAG, P2, P4a, P4b, P1, ART, SPELL];
  const castHag = (s0: GameState, objects: ObjectId[][] = []): GameState => resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Gravehag', 'hand', 'p1') }), { objects }), { objects });
  it('is automated', () => expect(full(HAG)).toBe(true));
  it('a single greatest creature card returns to hand without a choice; the others stay', () => {
    const s = castHag(scenario([], { p1: { hand: ['Test Gravehag'], graveyard: ['Test Small', 'Test Big A', 'Test Tiny', 'Test Plain Sorcery'] }, defs }));
    expect(s.pending?.kind).not.toBe('chooseObjects');
    expect(names(s, 'hand', 'p1')).toContain('Test Big A');
    expect(names(s, 'graveyard', 'p1').sort()).toEqual(['Test Plain Sorcery', 'Test Small', 'Test Tiny']);
  });
  it('a tie: you choose between exactly the tied cards (the lesser one is not offered), and only the chosen one returns', () => {
    const s0 = scenario([], { p1: { hand: ['Test Gravehag'], graveyard: ['Test Small', 'Test Big A', 'Test Big B'] }, defs });
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Gravehag', 'hand', 'p1') }));
    for (let i = 0; i < 4 && s.pending?.kind !== 'chooseObjects'; i++) s = passBoth(s);
    expect(s.pending?.kind).toBe('chooseObjects');
    const p = s.pending as Extract<NonNullable<GameState['pending']>, { kind: 'chooseObjects' }>;
    expect(p.player).toBe('p1');
    expect(p.options.map((id) => s.objects[id]!.defId).sort()).toEqual(['Test Big A', 'Test Big B']);
    const b = p.options.find((id) => s.objects[id]!.defId === 'Test Big B')!;
    s = resolveAll(answer(s, { kind: 'chooseObjects', ids: [b] }));
    expect(names(s, 'hand', 'p1')).toContain('Test Big B');
    expect(names(s, 'graveyard', 'p1').sort()).toEqual(['Test Big A', 'Test Small']);
  });
  it('negative: a noncreature card with the greatest power elsewhere is ignored (an artifact creature card counts as a creature card), and an empty graveyard returns nothing', () => {
    const none = castHag(scenario([], { p1: { hand: ['Test Gravehag'], graveyard: ['Test Plain Sorcery'] }, defs }));
    expect(names(none, 'hand', 'p1')).toEqual([]);
    const art = castHag(scenario([], { p1: { hand: ['Test Gravehag'], graveyard: ['Test Heavy Relic', 'Test Big A'] }, defs }));
    expect(names(art, 'hand', 'p1')).toEqual(['Test Heavy Relic']);
    const theirs = castHag(scenario([], { p1: { hand: ['Test Gravehag'], graveyard: ['Test Small'] }, p2: { graveyard: ['Test Heavy Relic'] }, defs }));
    expect(names(theirs, 'hand', 'p1')).toEqual(['Test Small']);
  });
});

// ---- Traveling Plague ------------------------------------------------------------------------------------------------------------------------------------------------
describe('Traveling Plague: when the enchanted creature leaves, its controller returns the Aura from the graveyard (CR 303.4f-g, 400.3, 603.10a)', () => {
  const PLAGUE = card('Test Wasting Aura', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets -1/-1.\nWhen enchanted creature leaves the battlefield, that creature\'s controller returns this Aura from its owner\'s graveyard to the battlefield.', '{0}');
  const BEAR = card('Test Plain Bear', 'Creature — Bear', '', '{0}', ['3', '3']);
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['3', '3']);
  const KILL = card('Test Smite', 'Instant', 'Destroy target creature.');
  const defs = [PLAGUE, BEAR, OX, KILL];
  it('is automated', () => expect(full(PLAGUE)).toBe(true));
  /** Alice casts the Aura on Bob's Ox (it resolves), then returns control to her main phase. */
  const enchanted = (): GameState => {
    const s0 = scenario([], { p1: { hand: ['Test Wasting Aura', 'Test Smite'], battlefield: ['Test Plain Bear'] }, p2: { battlefield: ['Test Ox'] }, defs });
    const ox = find(s0, 'Test Ox', 'battlefield', 'p2');
    return resolveAll(drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Wasting Aura', 'hand', 'p1') }), { targets: [[{ kind: 'object', id: ox }]] }));
  };
  it("Alice's Aura on Bob's creature: when it dies, Bob (its controller) gets the Aura and chooses a creature to enchant (rulings 2004-10-04, 2005-08-01)", () => {
    const s0 = enchanted();
    const ox = find(s0, 'Test Ox', 'battlefield', 'p2');
    expect(s0.objects[find(s0, 'Test Wasting Aura', 'battlefield', 'p1')]!.attachedTo).toBe(ox);
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Smite', 'hand', 'p1') }), { targets: [[{ kind: 'object', id: ox }]] });
    for (let i = 0; i < 10 && s.pending?.kind === 'priority' && s.zones.stack.length > 0; i++) s = passBoth(s);
    // the trigger resolves; Bob is the one who chooses what the returned Aura enchants (Bob has no creature left; Alice's Bear is the only legal choice)
    for (let i = 0; i < 6 && s.pending && s.pending.kind !== 'priority'; i++) {
      expect(s.pending.player).toBe('p2');
      s = drive(s);
    }
    s = resolveAll(s);
    const aura = find(s, 'Test Wasting Aura', 'battlefield');
    expect(s.objects[aura]!.controller).toBe('p2');
    expect(s.objects[aura]!.owner).toBe('p1');
    expect(s.objects[aura]!.attachedTo).toBe(find(s, 'Test Plain Bear', 'battlefield', 'p1'));
  });
  it('negative: while the enchanted creature stays, the Aura stays attached and nothing returns', () => {
    const s = enchanted();
    expect(names(s, 'battlefield', 'p1').sort()).toEqual(['Test Plain Bear', 'Test Wasting Aura']);
    expect(names(s, 'graveyard', 'p1')).toEqual([]);
  });
});

// ---- Corpseweft ------------------------------------------------------------------------------------------------------------------------------------------------------
describe('Corpseweft: exile one or more creature cards from your graveyard; the token is twice as big as the number exiled (CR 118.3, 601.2b, 602.2b)', () => {
  const LOOM = card('Test Bone Loom', 'Enchantment', '{0}, Exile one or more creature cards from your graveyard: Create a tapped X/X black Zombie Horror creature token, where X is twice the number of cards exiled this way.');
  const C1 = card('Test Husk One', 'Creature — Zombie', '', '{1}', ['1', '1']);
  const C2 = card('Test Husk Two', 'Creature — Zombie', '', '{1}', ['1', '1']);
  const C3 = card('Test Husk Three', 'Creature — Zombie', '', '{1}', ['1', '1']);
  const NC = card('Test Wreck', 'Artifact', '', '{1}');
  const defs = [LOOM, C1, C2, C3, NC];
  it('is automated', () => expect(full(LOOM)).toBe(true));
  const tokens = (s: GameState): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.kind === 'token');
  it('exiling two creature cards makes a tapped 4/4; the noncreature card and the third creature card stay', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bone Loom'], graveyard: ['Test Husk One', 'Test Husk Two', 'Test Husk Three', 'Test Wreck'] }, defs });
    let s = act(s0, activations(s0, 'Test Bone Loom')[0]!.action);
    expect(s.pending?.kind).toBe('chooseNumber');
    s = answer(s, { kind: 'chooseNumber', n: 2 });
    s = drive(s);
    s = resolveAll(s);
    const t = tokens(s);
    expect(t.length).toBe(1);
    expect(s.objects[t[0]!]!.tapped).toBe(true);
    expect(`${String(getPower(s, t[0]!))}`).toBe('4');
    expect(names(s, 'graveyard', 'p1').length).toBe(2);
    expect(names(s, 'graveyard', 'p1')).toContain('Test Wreck');
  });
  it('negative: with no creature card in the graveyard the ability cannot be activated (one or more, never zero)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bone Loom'], graveyard: ['Test Wreck'] }, defs });
    expect(activations(s0, 'Test Bone Loom').length).toBe(0);
  });
});
import { getChars } from '../../../src/index';
const getPower = (s: GameState, id: ObjectId): number | string => getChars(s, id).power ?? 0;
