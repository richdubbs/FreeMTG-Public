/**
 * edh-e-32 scenarios (Commander coordinator E, group copy): each new reading played through the engine with synthetic cards (invented names, design 6.10), with its negative case.
 * Rules (Comprehensive Rules 2026-09-25; cites from memory, listed as unverified in the record):
 *   CR 707.2, 111.1, 608.2c     "For each creature token on the battlefield, its controller creates a token that's a copy of that creature." (Parallel Evolution)
 *   CR 113.6k, 601.2i, 707.10   "When you cast this spell, copy it for each other instant and sorcery spell you've cast this turn." (Show of Confidence)
 *   CR 601.2a, 603.4, 707.10    "When you cast this spell from your hand, copy it if you control an artifact, then copy it if you control an enchantment." (Banish into Fable)
 *   CR 601.2i, 707.10           "Whenever you cast your first instant or sorcery spell from your graveyard each turn, copy that spell." (Sevinne, the Chronoclasm)
 *   CR 707.12, 707.10a, 608.2g  "Copy the exiled card. You may cast the copy without paying its mana cost." (Elite Arcanist)
 *   CR 115.9c, 707.10c          "if that spell targets only ~, copy the spell for each other creature that spell could target" (Ink-Treader Nephilim)
 */
import { describe, expect, it } from 'vitest';
import { act, card, drive, find, full, lifeOf, obj, resolveAll, scenario } from '../r3-cost/support';
import { legalActions, type GameState } from '../../../src/index';
import { tweak } from '../../m4/helpers';
const tweakNoSick = (s: GameState, id: string): GameState => tweak(s, (x) => { x.objects[id]!.controlledSinceTurn = -1; });
const legalActionsOf = (s: GameState) => legalActions(s, 'p1');

const P2 = { kind: 'player' as const, id: 'p2' };
const cast = (s: GameState, name: string, zone: 'hand' | 'graveyard', script: Parameters<typeof drive>[1] = {}, method?: string): GameState =>
  drive(act(s, { type: 'cast', player: 'p1', card: find(s, name, zone, 'p1'), ...(method !== undefined ? { method } : {}) }), script);
const tokens = (s: GameState, p: string): number => s.zones.battlefield.filter((id) => s.objects[id]!.controller === p).length; // (no other permanent is on the battlefield in these scenarios)

describe('CR 707.2, 111.1: "For each creature token on the battlefield, its controller creates a token that\'s a copy of that creature."', () => {
  const SPAWN = card('Test Spawner', 'Sorcery', 'Each player creates a 1/1 green Elf creature token.');
  const TWIN = card('Test Twin Wave', 'Sorcery', "For each creature token on the battlefield, its controller creates a token that's a copy of that creature.");
  const setup = () => scenario([], { defs: [SPAWN, TWIN], p1: { hand: ['Test Spawner', 'Test Twin Wave'] } });
  it('is automated', () => { expect(full(TWIN)).toBe(true); });
  it('one token each becomes two each, each player getting the copy of their own token (the new copies are not copied again)', () => {
    let s = resolveAll(cast(setup(), 'Test Spawner', 'hand'));
    expect(s.zones.battlefield.length).toBe(2);
    s = resolveAll(cast(s, 'Test Twin Wave', 'hand'));
    expect([tokens(s, 'p1'), tokens(s, 'p2')]).toEqual([2, 2]);
  });
  it('with no creature token on the battlefield nothing is created', () => {
    const s = resolveAll(cast(setup(), 'Test Twin Wave', 'hand'));
    expect(s.zones.battlefield.length).toBe(0);
  });
});

describe('CR 113.6k, 601.2i, 707.10: "When you cast this spell, copy it for each other instant and sorcery spell you\'ve cast this turn."', () => {
  const BOLT = card('Test Pebble', 'Instant', 'Test Pebble deals 1 damage to target player.');
  const ECHO = card('Test Echo Burst', 'Instant', 'When you cast this spell, copy it for each other instant and sorcery spell you\'ve cast this turn. You may choose new targets for the copies.\nTest Echo Burst deals 1 damage to target player.');
  const setup = () => scenario([], { defs: [BOLT, ECHO], p1: { hand: ['Test Pebble', 'Test Pebble', 'Test Echo Burst'] } });
  const tgt = { targets: [[P2]], yes: [false, false, false] };
  it('is automated', () => { expect(full(ECHO)).toBe(true); });
  it('after two other instants this turn: the spell and two copies each deal 1 (5 damage with the two earlier bolts)', () => {
    let s = resolveAll(cast(setup(), 'Test Pebble', 'hand', { targets: [[P2]] }));
    s = resolveAll(cast(s, 'Test Pebble', 'hand', { targets: [[P2]] }));
    expect(lifeOf(s, 'p2')).toBe(18);
    s = resolveAll(cast(s, 'Test Echo Burst', 'hand', { targets: [[P2], [P2], [P2]], yes: [false, false, false] }));
    expect(lifeOf(s, 'p2')).toBe(15);
  });
  it('cast alone it counts no other spell: no copy, 1 damage', () => {
    const s = resolveAll(cast(setup(), 'Test Echo Burst', 'hand', tgt));
    expect(lifeOf(s, 'p2')).toBe(19);
  });
});

describe('CR 601.2a, 603.4, 707.10: "When you cast this spell from your hand, copy it if you control an artifact, then copy it if you control an enchantment."', () => {
  const FABLE = card('Test Fable Pulse', 'Instant', 'When you cast this spell from your hand, copy it if you control an artifact, then copy it if you control an enchantment. You may choose new targets for the copies.\nTest Fable Pulse deals 1 damage to target player.');
  const ART = card('Test Trinket', 'Artifact', 'Flying');
  const ENC = card('Test Aura Wall', 'Enchantment', 'Flying');
  const run = (bf: string[]) => {
    const s0 = scenario([], { defs: [FABLE, ART, ENC], p1: { hand: ['Test Fable Pulse'], battlefield: bf } });
    return lifeOf(resolveAll(cast(s0, 'Test Fable Pulse', 'hand', { targets: [[P2], [P2], [P2]], yes: [false, false] })), 'p2');
  };
  it('is automated', () => { expect(full(FABLE)).toBe(true); });
  it('no artifact or enchantment: 1 damage; one of them: 2; both: 3', () => {
    expect(run([])).toBe(19);
    expect(run(['Test Trinket'])).toBe(18);
    expect(run(['Test Aura Wall'])).toBe(18);
    expect(run(['Test Trinket', 'Test Aura Wall'])).toBe(17);
  });
  it('cast from the graveyard (flashback) the trigger does not happen: 1 damage even with both', () => {
    const FB = card('Test Fable Echo', 'Instant', 'When you cast this spell from your hand, copy it if you control an artifact, then copy it if you control an enchantment.\nTest Fable Echo deals 1 damage to target player.\nFlashback {0}');
    const s0 = scenario([], { defs: [FB, ART, ENC], p1: { graveyard: ['Test Fable Echo'], battlefield: ['Test Trinket', 'Test Aura Wall'] } });
    const s = resolveAll(cast(s0, 'Test Fable Echo', 'graveyard', { targets: [[P2], [P2], [P2]], yes: [false, false] }, 'flashback'));
    expect(lifeOf(s, 'p2')).toBe(19);
  });
});

describe('CR 601.2i, 707.10: "Whenever you cast your first instant or sorcery spell from your graveyard each turn, copy that spell."', () => {
  const FLASH = card('Test Ember', 'Instant', 'Test Ember deals 1 damage to target player.\nFlashback {0}');
  const HAND = card('Test Spark', 'Instant', 'Test Spark deals 1 damage to target player.');
  const CHRON = card('Test Chrono', 'Enchantment', 'Whenever you cast your first instant or sorcery spell from your graveyard each turn, copy that spell. You may choose new targets for the copy.');
  const setup = () => scenario([], { defs: [FLASH, HAND, CHRON], p1: { battlefield: ['Test Chrono'], graveyard: ['Test Ember', 'Test Ember'], hand: ['Test Spark'] } });
  it('is automated', () => { expect(full(CHRON)).toBe(true); });
  it('the first graveyard cast of the turn is copied (2 damage), the second is not (1 more)', () => {
    let s = resolveAll(cast(setup(), 'Test Ember', 'graveyard', { targets: [[P2], [P2]], yes: [false] }, 'flashback'));
    expect(lifeOf(s, 'p2')).toBe(18);
    s = resolveAll(cast(s, 'Test Ember', 'graveyard', { targets: [[P2], [P2]], yes: [false] }, 'flashback'));
    expect(lifeOf(s, 'p2')).toBe(17);
  });
  it('a spell cast from the hand is not copied, and does not use up the graveyard "first"', () => {
    let s = resolveAll(cast(setup(), 'Test Spark', 'hand', { targets: [[P2]], yes: [false] }));
    expect(lifeOf(s, 'p2')).toBe(19);
    s = resolveAll(cast(s, 'Test Ember', 'graveyard', { targets: [[P2], [P2]], yes: [false] }, 'flashback'));
    expect(lifeOf(s, 'p2')).toBe(17);
  });
});

describe('review: Sevinne counts only casts from YOUR graveyard (CR 601.2a, 404.1)', () => {
  it('the cast pattern names the owner', () => {
    const CHRON = card('Test Chrono2', 'Enchantment', 'Whenever you cast your first instant or sorcery spell from your graveyard each turn, copy that spell. You may choose new targets for the copy.');
    expect(JSON.stringify(CHRON.faces)).toContain('"owner":"you"');
  });
});

describe('CR 707.12, 707.10a, 608.2g: "Copy the exiled card. You may cast the copy without paying its mana cost." (imprint)', () => {
  const BOLT = card('Test Imprint Bolt', 'Instant', 'Test Imprint Bolt deals 2 damage to target player.');
  const ARC = card('Test Arc Twin', 'Creature — Wizard', 'Imprint — When ~ enters, you may exile an instant card from your hand.\n{X}, {T}: Copy the exiled card. You may cast the copy without paying its mana cost. X is the mana value of the exiled card.', '{0}', ['1', '1']);
  const setup = () => scenario([], { defs: [BOLT, ARC], p1: { hand: ['Test Arc Twin', 'Test Imprint Bolt'] } });
  const onField = (s: GameState) => resolveAll(cast(s, 'Test Arc Twin', 'hand'), { yes: [true] });
  it('is automated', () => { expect(full(ARC)).toBe(true); });
  it('imprint the bolt, then each activation copies it and casts the copy free (the card stays exiled): 2 damage per activation', () => {
    let s = onField(setup());
    expect(s.zones.exile.some((id) => s.objects[id]!.defId === 'Test Imprint Bolt')).toBe(true);
    const arc = find(s, 'Test Arc Twin', 'battlefield', 'p1');
    s = tweakNoSick(s, arc);
    const opts = legalActionsOf(s).filter((a) => a.kind === 'activate');
    expect(opts.length).toBeGreaterThan(0);
    s = resolveAll(drive(act(s, opts[0]!.action)), { yes: [true], targets: [[P2]] });
    expect(lifeOf(s, 'p2')).toBe(18);
    expect(s.zones.exile.some((id) => s.objects[id]!.defId === 'Test Imprint Bolt')).toBe(true);
  });
  it('declining the cast: no damage', () => {
    let s = onField(setup());
    s = tweakNoSick(s, find(s, 'Test Arc Twin', 'battlefield', 'p1'));
    const opts = legalActionsOf(s).filter((a) => a.kind === 'activate');
    s = resolveAll(drive(act(s, opts[0]!.action)), { yes: [false] });
    expect(lifeOf(s, 'p2')).toBe(20);
  });
});

describe('CR 115.9c, 707.10c: "if that spell targets only ~, copy the spell for each other creature that spell could target" (Ink-Treader Nephilim)', () => {
  const NEPH = card('Test Mirror Beast', 'Creature — Beast', 'Whenever a player casts an instant or sorcery spell, if that spell targets only ~, copy the spell for each other creature that spell could target. Each copy targets a different one of those creatures.', '{0}', ['5', '5']);
  const BEAR = card('Test Bear', 'Creature — Bear', 'Flying', '{0}', ['5', '5']);
  const NIP = card('Test Nip', 'Instant', 'Test Nip deals 1 damage to target creature.');
  const dmg = (s: GameState, name: string, p: string): number => s.objects[find(s, name, 'battlefield', p)]!.damage;
  const setup = () => scenario([], { defs: [NEPH, BEAR, NIP], p1: { battlefield: ['Test Mirror Beast', 'Test Bear'], hand: ['Test Nip'] }, p2: { battlefield: ['Test Bear'] } });
  it('is automated', () => { expect(full(NEPH)).toBe(true); });
  it('a spell targeting only the beast is copied for each other creature (3 creatures take 1 each)', () => {
    const s0 = setup();
    const s = resolveAll(cast(s0, 'Test Nip', 'hand', { targets: [[obj(find(s0, 'Test Mirror Beast', 'battlefield', 'p1'))]] }));
    expect([dmg(s, 'Test Mirror Beast', 'p1'), dmg(s, 'Test Bear', 'p1'), dmg(s, 'Test Bear', 'p2')]).toEqual([1, 1, 1]);
  });
  it('review: the copies are judged by who CAST the spell: an opponent\'s spell gets no copy for my hexproof creature (it could not target it) but one for the opponent\'s own creature', () => {
    const HEX = card('Test Hexbear', 'Creature — Bear', 'Hexproof', '{0}', ['5', '5']);
    const s0 = scenario([], { defs: [NEPH, BEAR, HEX, NIP], p1: { battlefield: ['Test Mirror Beast', 'Test Hexbear'] }, p2: { battlefield: ['Test Bear'], hand: ['Test Nip'] } });
    let s = s0;
    s = act(s, { type: 'pass', player: 'p1' });
    s = drive(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Nip', 'hand', 'p2'), ...{} }), { targets: [[obj(find(s, 'Test Mirror Beast', 'battlefield', 'p1'))]] });
    s = resolveAll(s);
    expect([dmg(s, 'Test Mirror Beast', 'p1'), dmg(s, 'Test Hexbear', 'p1'), dmg(s, 'Test Bear', 'p2')]).toEqual([1, 0, 1]);
  });
  it('a spell targeting another creature is not copied', () => {
    const s0 = setup();
    const s = resolveAll(cast(s0, 'Test Nip', 'hand', { targets: [[obj(find(s0, 'Test Bear', 'battlefield', 'p2'))]] }));
    expect([dmg(s, 'Test Mirror Beast', 'p1'), dmg(s, 'Test Bear', 'p1'), dmg(s, 'Test Bear', 'p2')]).toEqual([0, 0, 1]);
  });
});
