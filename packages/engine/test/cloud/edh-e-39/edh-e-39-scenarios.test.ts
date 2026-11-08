/**
 * Commander effort, coordinator E, round edh-e-39: the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's default
 * compiler. Each test is named after the rule it checks and has its negative case. CR cites are from memory (no rules/cr in a cloud session) and listed as unverified in the record.
 *
 *   CR 608.2c, 400.3, 101.4    "When ~ dies, exile it and each player returns all creature cards from their graveyard to their hand."
 *   CR 401.2, 404.1, 608.2c    "{T}: Target player puts the bottom card of their library into their graveyard. If it's a creature card, you create a 2/2 black Zombie creature token."
 *   CR 201.2, 400.3, 110.2a    "At the beginning of your upkeep, each player returns all cards named ~ from their graveyard to the battlefield."
 *   CR 608.2c, 608.2h          "Exile target card from a graveyard. If it was a creature card, ... If it was a land card, ... Otherwise, ..." (neither of them)
 *   CR 603.4, 603.10a, 303.4   "Whenever a creature dies, if an Aura you controlled was attached to it, return target creature card with mana value 2 or less from your graveyard to your hand."
 *   CR 702.141a, 118.9, 613.1f "Each artifact creature card in your graveyard has encore. Its encore cost is equal to its mana cost."
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type PlayerId } from '../../../src/index';
import { act, find, life, findAll, legal, pass, put, scenario } from '../../m3/scenario';
import { cast, resolveAll, settle } from '../cmd3/helpers';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string } = {}): CardDef {
  return compileCard({
    name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [],
    ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}),
  } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const names = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId): string[] => (s.zones[zone][p] ?? []).map((id) => nameOf(s, id));
const tgt = (id: PlayerId | ObjectId, kind: 'player' | 'object' = 'player') => ({ kind, id }) as never;

describe('CR 608.2c, 400.3, 101.4: "When ~ dies, exile it and each player returns all creature cards from their graveyard to their hand."', () => {
  const HOUND = card('Test Gate Hound', 'Creature — Dog', 'When ~ dies, exile it and each player returns all creature cards from their graveyard to their hand.', { pt: ['2', '2'] });
  const SLAY = card('Test Gate Slay', 'Instant', 'Destroy target creature.');
  const OGRE = card('Test Gate Ogre', 'Creature — Ogre', '', { pt: ['2', '2'] });
  const RELIC = card('Test Gate Relic', 'Artifact', '');
  const defs = [HOUND, SLAY, OGRE, RELIC];
  it('is automated', () => { expect(full(HOUND)).toBe(true); });
  it('the dog is exiled (not in a graveyard) and every player gets the creature cards of their own graveyard in their own hand; the noncreature card stays', () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Gate Slay'], battlefield: ['Test Gate Hound'], graveyard: ['Test Gate Ogre', 'Test Gate Relic'] }, p2: { graveyard: ['Test Gate Ogre'] } });
    const hound = find(s0, 'Test Gate Hound', 'battlefield', 'p1');
    const s = resolveAll(cast(s0, 'Test Gate Slay', { targets: [tgt(hound, 'object')] }), { targets: [tgt(hound, 'object')] });
    expect(s.zones.exile.map((id) => nameOf(s, id))).toContain('Test Gate Hound');
    expect(names(s, 'graveyard', 'p1')).not.toContain('Test Gate Hound');
    expect(names(s, 'hand', 'p1')).toContain('Test Gate Ogre');
    expect(names(s, 'hand', 'p2')).toEqual(['Test Gate Ogre']);
    expect(names(s, 'graveyard', 'p1')).toContain('Test Gate Relic');
    expect(names(s, 'graveyard', 'p2')).toEqual([]);
  });
  it('negative: with no creature card in any other graveyard only the exile happens (nothing moves to a hand)', () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Gate Slay'], battlefield: ['Test Gate Hound'], graveyard: ['Test Gate Relic'] } });
    const handsBefore = [s0.zones.hand.p1!.length - 1, s0.zones.hand.p2!.length];
    const hound = find(s0, 'Test Gate Hound', 'battlefield', 'p1');
    const s = resolveAll(cast(s0, 'Test Gate Slay', { targets: [tgt(hound, 'object')] }), { targets: [tgt(hound, 'object')] });
    expect(s.zones.exile.map((id) => nameOf(s, id))).toContain('Test Gate Hound');
    expect([s.zones.hand.p1!.length, s.zones.hand.p2!.length]).toEqual(handsBefore);
  });
});

describe('CR 401.2, 404.1, 608.2c: "{T}: Target player puts the bottom card of their library into their graveyard. If it\'s a creature card, you create a 2/2 black Zombie creature token."', () => {
  const DOOR = card('Test Low Door', 'Artifact', '{T}: Target player puts the bottom card of their library into their graveyard. If it\'s a creature card, you create a 2/2 black Zombie creature token.');
  const OGRE = card('Test Door Ogre', 'Creature — Ogre', '', { pt: ['2', '2'] });
  const RELIC = card('Test Door Relic', 'Artifact', '');
  const defs = [DOOR, OGRE, RELIC];
  const zombies = (s: GameState): number => s.zones.battlefield.filter((id) => nameOf(s, id) === 'Zombie Token' && s.objects[id]!.controller === 'p1').length;
  const bottom = (s: GameState, p: PlayerId): ObjectId => s.zones.library[p]![s.zones.library[p]!.length - 1]!;
  const activate = (s0: GameState, target: PlayerId): GameState => resolveAll(settle(act(s0, legal(s0, 'p1', 'activate')[0]!.action), { targets: [tgt(target)] }), { targets: [tgt(target)] });
  it('is automated', () => { expect(full(DOOR)).toBe(true); });
  it('a creature card on the bottom of the opponent\'s library goes to THEIR graveyard and you get a Zombie', () => {
    const s0 = scenario([], { defs, p1: { battlefield: ['Test Low Door'] } });
    put(s0, 'p2', 'library', 'Test Door Ogre'); // appended last: the bottom card
    const s = activate(s0, 'p2');
    expect(names(s, 'graveyard', 'p2')).toContain('Test Door Ogre');
    expect(names(s, 'graveyard', 'p1')).not.toContain('Test Door Ogre');
    expect(zombies(s)).toBe(1);
  });
  it('negative: a noncreature card on the bottom goes to the graveyard and no Zombie is made; only the bottom card moves (the library shrinks by one)', () => {
    const s0 = scenario([], { defs, p1: { battlefield: ['Test Low Door'] } });
    put(s0, 'p2', 'library', 'Test Door Relic');
    const lib = s0.zones.library.p2!.length;
    const s = activate(s0, 'p2');
    expect(names(s, 'graveyard', 'p2')).toContain('Test Door Relic');
    expect(s.zones.library.p2!.length).toBe(lib - 1);
    expect(zombies(s)).toBe(0);
    expect(bottom(s, 'p2')).not.toBe(bottom(s0, 'p2'));
  });
});

describe('CR 201.2, 400.3, 110.2a: "Each player returns all cards named <name> from their graveyard to the battlefield."', () => {
  const RITE = card('Test Twin Rite', 'Sorcery', 'Each player returns all cards named Test Twin Servitor from their graveyard to the battlefield.');
  const SERVITOR = card('Test Twin Servitor', 'Artifact Creature — Myr', '', { pt: ['1', '1'] });
  const OTHER = card('Test Twin Other', 'Artifact Creature — Myr', '', { pt: ['1', '1'] });
  const defs = [RITE, SERVITOR, OTHER];
  const field = (s: GameState, name: string, p: PlayerId): number => s.zones.battlefield.filter((id) => nameOf(s, id) === name && s.objects[id]!.controller === p).length;
  it('is automated', () => { expect(full(RITE)).toBe(true); });
  it('every card with that name in every graveyard enters under its OWNER\'s control; a card with another name stays', () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Twin Rite'], graveyard: ['Test Twin Servitor', 'Test Twin Other'] }, p2: { graveyard: ['Test Twin Servitor', 'Test Twin Servitor'] } });
    const s = resolveAll(cast(s0, 'Test Twin Rite'));
    expect(field(s, 'Test Twin Servitor', 'p1')).toBe(1);
    expect(field(s, 'Test Twin Servitor', 'p2')).toBe(2);
    expect(names(s, 'graveyard', 'p1')).toContain('Test Twin Other');
    expect(names(s, 'graveyard', 'p2')).not.toContain('Test Twin Servitor');
  });
  it('negative: with no card of that name in a graveyard nothing enters', () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Twin Rite'], graveyard: ['Test Twin Other'] } });
    const s = resolveAll(cast(s0, 'Test Twin Rite'));
    expect(field(s, 'Test Twin Servitor', 'p1') + field(s, 'Test Twin Servitor', 'p2')).toBe(0);
  });
  it('negative: "each opponent" or a return to hand is not this reading', () => {
    for (const text of [
      'Each opponent returns all cards named Test Twin Servitor from their graveyard to the battlefield.',
      'Each player returns all cards named Test Twin Servitor from their graveyard to their hand.',
    ]) expect(full(card('Test Twin Neg', 'Sorcery', text)), text).toBe(false);
  });
  void findAll;
});

describe('CR 702.141a, 118.9, 604.1, 613.1f: "Each artifact creature card in your graveyard has encore. Its encore cost is equal to its mana cost."', () => {
  const SURGEON = card('Test Wire Mender', 'Creature — Human', 'Each artifact creature card in your graveyard has encore. Its encore cost is equal to its mana cost.', { pt: ['1', '1'] });
  const GOLEM = card('Test Wire Golem', 'Artifact Creature — Golem', '', { pt: ['2', '2'], cost: '{2}' });
  const OGRE = card('Test Wire Ogre', 'Creature — Ogre', '', { pt: ['2', '2'], cost: '{2}' });
  const defs = [SURGEON, GOLEM, OGRE];
  it('is automated', () => { expect(full(SURGEON)).toBe(true); });
  const offered = (s: GameState, id: ObjectId): boolean => legal(s, 'p1', 'activate').some((a) => (a.action as { source?: ObjectId }).source === id);
  it('the artifact creature card in your graveyard gets an encore ability that costs its mana cost {2}: offered with two lands, not with one; the nonartifact creature card never has one', () => {
    const two = scenario([], { defs, p1: { battlefield: ['Test Wire Mender', 'Plains', 'Plains'], graveyard: ['Test Wire Golem', 'Test Wire Ogre'] } });
    expect(offered(two, find(two, 'Test Wire Golem', 'graveyard', 'p1'))).toBe(true);
    expect(offered(two, find(two, 'Test Wire Ogre', 'graveyard', 'p1'))).toBe(false);
    const one = scenario([], { defs, p1: { battlefield: ['Test Wire Mender', 'Plains'], graveyard: ['Test Wire Golem'] } });
    expect(offered(one, find(one, 'Test Wire Golem', 'graveyard', 'p1'))).toBe(false);
  });
  it('negative: without the Mender on the battlefield no card of the graveyard has encore', () => {
    const s = scenario([], { defs, p1: { battlefield: ['Plains', 'Plains'], graveyard: ['Test Wire Golem'] } });
    expect(offered(s, find(s, 'Test Wire Golem', 'graveyard', 'p1'))).toBe(false);
  });
});

describe('CR 608.2c, 608.2h: "Exile target card from a graveyard. If it was a creature card, create a 2/2 black Rogue creature token. If it was a land card, create a Treasure token. Otherwise, you gain 3 life."', () => {
  const SEER = card('Test Fate Seer', 'Sorcery', 'Exile target card from a graveyard. If it was a creature card, create a 2/2 black Rogue creature token. If it was a land card, create a Treasure token. Otherwise, you gain 3 life.');
  const OGRE = card('Test Fate Ogre', 'Creature — Ogre', '', { pt: ['2', '2'] });
  const ARBOR = card('Test Fate Arbor', 'Land Creature — Dryad', '', { pt: ['1', '1'] });
  const FIELD = card('Test Fate Field', 'Land', '');
  const RELIC = card('Test Fate Relic', 'Artifact', '');
  const defs = [SEER, OGRE, ARBOR, FIELD, RELIC];
  const play = (victim: string): GameState => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Fate Seer'] }, p2: { graveyard: [victim] } });
    const id = find(s0, victim, 'graveyard', 'p2');
    return resolveAll(cast(s0, 'Test Fate Seer', { targets: [tgt(id, 'object')] }), { targets: [tgt(id, 'object')] });
  };
  const made = (s: GameState, n: string): number => s.zones.battlefield.filter((id) => nameOf(s, id) === n && s.objects[id]!.controller === 'p1').length;
  it('is automated', () => { expect(full(SEER)).toBe(true); });
  it('a creature card: a Rogue, no Treasure, no life', () => {
    const s = play('Test Fate Ogre');
    expect([made(s, 'Rogue Token'), made(s, 'Treasure Token')]).toEqual([1, 0]);
    expect(life(s, 'p1')).toBe(20);
  });
  it('a land card: a Treasure, no Rogue, no life', () => {
    const s = play('Test Fate Field');
    expect([made(s, 'Rogue Token'), made(s, 'Treasure Token')]).toEqual([0, 1]);
    expect(life(s, 'p1')).toBe(20);
  });
  it('a card that is both a creature and a land gets BOTH tokens and no life (ruling 2022-04-29)', () => {
    const s = play('Test Fate Arbor');
    expect([made(s, 'Rogue Token'), made(s, 'Treasure Token')]).toEqual([1, 1]);
    expect(life(s, 'p1')).toBe(20);
  });
  it('negative: neither (an artifact card): 3 life and no token', () => {
    const s = play('Test Fate Relic');
    expect([made(s, 'Rogue Token'), made(s, 'Treasure Token')]).toEqual([0, 0]);
    expect(life(s, 'p1')).toBe(23);
  });
});

describe('CR 603.4, 603.10a, 303.4: "Whenever a creature dies, if an Aura you controlled was attached to it, return target creature card with mana value 2 or less from your graveyard to your hand."', () => {
  const EVANGEL = card('Test Dawn Priest', 'Creature — Human Cleric', 'Whenever a creature dies, if an Aura you controlled was attached to it, return target creature card with mana value 2 or less from your graveyard to your hand.', { pt: ['1', '1'] });
  const AURA = card('Test Dawn Aura', 'Enchantment — Aura', 'Enchant creature');
  const BEAR = card('Test Dawn Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
  const CHEAP = card('Test Dawn Cheap', 'Creature — Elf', '', { pt: ['1', '1'], cost: '{1}' });
  const BIG = card('Test Dawn Big', 'Creature — Giant', '', { pt: ['5', '5'], cost: '{5}' });
  const SLAY = card('Test Dawn Slay', 'Instant', 'Destroy target creature.');
  const defs = [EVANGEL, AURA, BEAR, CHEAP, BIG, SLAY];
  const kill = (aura: 'p1' | 'p2' | null): GameState => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Dawn Slay'], battlefield: ['Test Dawn Priest', 'Test Dawn Bear'], graveyard: ['Test Dawn Cheap', 'Test Dawn Big'] } });
    const bear = find(s0, 'Test Dawn Bear', 'battlefield', 'p1');
    if (aura !== null) s0.objects[put(s0, aura, 'battlefield', 'Test Dawn Aura')]!.attachedTo = bear;
    const cheap = find(s0, 'Test Dawn Cheap', 'graveyard', 'p1');
    const picks = { targets: [tgt(bear, 'object')], objects: [cheap] };
    let s = cast(s0, 'Test Dawn Slay', picks);
    for (let i = 0; i < 10 && (s.zones.stack.length > 0 || (s.pending !== null && s.pending.kind !== 'priority')); i++) s = settle(s.pending?.kind === 'priority' ? pass(s) : s, { targets: [tgt(cheap, 'object')], objects: [cheap] });
    return s;
  };
  it('is automated', () => { expect(full(EVANGEL)).toBe(true); });
  it('the creature had an Aura you controlled: the cheap creature card returns to your hand (the big one stays: mana value 5)', () => {
    const s = kill('p1');
    expect(names(s, 'hand', 'p1')).toContain('Test Dawn Cheap');
    expect(names(s, 'graveyard', 'p1')).toContain('Test Dawn Big');
  });
  it('negative: no Aura at all, or an Aura an opponent controlled: nothing returns', () => {
    for (const aura of [null, 'p2'] as const) {
      const s = kill(aura);
      expect(names(s, 'hand', 'p1'), String(aura)).not.toContain('Test Dawn Cheap');
      expect(names(s, 'graveyard', 'p1'), String(aura)).toContain('Test Dawn Cheap');
    }
  });
});
