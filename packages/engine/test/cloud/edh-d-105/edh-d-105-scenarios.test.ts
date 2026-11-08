/**
 * Commander coordinator D, round edh-d-105 (EDHREC top 30,000, groups copy and type-change): each new reading played through the engine with synthetic cards (invented names,
 * design 6.10), compiled by the game's default compiler. Alice (p1) is the active player of turn 1; Bob (p2) is the opponent. Each test is named after the rule it checks, with its
 * negative case. CR cites checked against the Comprehensive Rules of 2026-09-25 (MagicCompRules 20260925.txt).
 */
import { describe, expect, it } from 'vitest';
import { getChars, hasKeyword } from '../../../src/rules/characteristics';
import type { GameState, ObjectId } from '../../../src/index';
import { act, activations, advanceTo, card, cast, drive, full, lifeOf, obj, resolveAll, scenario, type Script } from '../r3-cost/support';
import { answer, find } from '../../m3/scenario';

const ch = (s: GameState, id: ObjectId) => { const c = getChars(s, id); return { ...c, power: Number(c.power), toughness: Number(c.toughness) }; };
const isToken = (s: GameState, id: ObjectId): boolean => s.objects[id]!.kind === 'token';
/** Activate the one non-mana ability of p1's permanent, answering the script, and resolve the stack. */
const activate = (s: GameState, name: string, script: Script = {}, k = 0): GameState => resolveAll(drive(act(s, activations(s, name)[k]!.action), script), script);
/** The option ids of the pending option choice, by their label. */
const optionId = (s: GameState, label: string): string => {
  const p = s.pending;
  if (p?.kind !== 'chooseOption') throw new Error(`no option choice pending (${p?.kind})`);
  const o = p.options.find((x) => x.label === label || x.id === label);
  if (o === undefined) throw new Error(`no option ${label}: ${JSON.stringify(p.options)}`);
  return o.id;
};
/** Activate, then answer the option choice by its label, then resolve. */
const activateChoosing = (s0: GameState, name: string, label: string, pre: Script = {}): GameState => {
  let s = drive(act(s0, activations(s0, name)[0]!.action), pre);
  for (let i = 0; i < 6 && s.pending?.kind === 'priority'; i++) s = act(s, { type: 'pass', player: s.pending.player });
  if (s.pending?.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
  s = answer(s, { kind: 'chooseOption', ids: [optionId(s, label)] });
  return resolveAll(s);
};

describe('"{X}: ~ becomes an X/X Wall creature with defender in addition to its other types until end of turn." (CR 107.3a, 602.2b, 205.1b, 613.4b, 611.2c; Testament of Faith)', () => {
  const WALL = card('Test Hallowed Oath', 'Enchantment', '{X}: ~ becomes an X/X Wall creature with defender in addition to its other types until end of turn.');
  const LAND = card('Test Wide Field', 'Land', '{T}: Add {W}.');
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Hallowed Oath', 'Test Wide Field', 'Test Wide Field', 'Test Wide Field'] }, defs: [WALL, LAND] });
  it('has no manual part', () => expect(full(WALL)).toBe(true));
  it('with X = 3 it is a 3/3 Wall creature with defender that is still an enchantment', () => {
    const s = activate(start(), 'Test Hallowed Oath', { x: [3] });
    const c = ch(s, find(s, 'Test Hallowed Oath', 'battlefield', 'p1'));
    expect(c.types).toEqual(expect.arrayContaining(['Enchantment', 'Creature']));
    expect(c.subtypes).toContain('Wall');
    expect([c.power, c.toughness]).toEqual([3, 3]);
    expect(hasKeyword(getChars(s, find(s, 'Test Hallowed Oath', 'battlefield', 'p1')), 'defender')).toBe(true);
  });
  it('the negative case: the effect ends with the turn (CR 514.2): on the next turn it is an enchantment only', () => {
    const s = advanceTo(activate(start(), 'Test Hallowed Oath', { x: [2] }), 2, 'upkeep');
    const c = ch(s, find(s, 'Test Hallowed Oath', 'battlefield', 'p1'));
    expect(c.types).not.toContain('Creature');
  });
});

describe('"{T}: Target land you control becomes an X/X Elemental creature until end of turn, where X is the number of Allies you control. It\'s still a land." (CR 107.3, 608.2h, 205.1b, 613.4b; Vastwood Animist)', () => {
  const ANIMIST = card('Test Grove Caller', 'Creature — Elf Ally', '{T}: Target land you control becomes an X/X Elemental creature until end of turn, where X is the number of Allies you control. It\'s still a land.', '{0}', ['1', '1']);
  const ALLY = card('Test Trail Friend', 'Creature — Human Ally', '', '{0}', ['1', '1']);
  const LAND = card('Test Moss Field', 'Land', '{T}: Add {G}.');
  const start = (allies: number): GameState => scenario([], { p1: { battlefield: ['Test Grove Caller', ...Array(allies).fill('Test Trail Friend'), 'Test Moss Field'], hand: ['Test Trail Friend'] }, defs: [ANIMIST, ALLY, LAND] });
  it('has no manual part', () => expect(full(ANIMIST)).toBe(true));
  it('with three Allies (the Animist counted) the land is a 3/3 Elemental creature land', () => {
    const s0 = start(2);
    const land = find(s0, 'Test Moss Field', 'battlefield', 'p1');
    const s = activate(s0, 'Test Grove Caller', { targets: [[obj(land)]] });
    const c = ch(s, land);
    expect(c.types).toEqual(expect.arrayContaining(['Land', 'Creature']));
    expect(c.subtypes).toContain('Elemental');
    expect([c.power, c.toughness]).toEqual([3, 3]);
  });
  it('the negative case: X is counted once, as the ability resolves (CR 608.2h): an Ally entering afterwards does not change the size', () => {
    const s0 = start(1);
    const land = find(s0, 'Test Moss Field', 'battlefield', 'p1');
    const s1 = activate(s0, 'Test Grove Caller', { targets: [[obj(land)]] });
    expect([ch(s1, land).power, ch(s1, land).toughness]).toEqual([2, 2]);
    const s2 = resolveAll(cast(s1, 'Test Trail Friend'));
    expect([ch(s2, land).power, ch(s2, land).toughness]).toEqual([2, 2]);
  });
});

describe('"{2}: Until end of turn, target nonartifact creature gets +1/+0 and becomes an artifact in addition to its other types." (CR 611.2c, 205.1b, 613.1d, 613.4c; Thran Forge)', () => {
  const FORGE = card('Test Ember Anvil', 'Artifact', '{0}: Until end of turn, target nonartifact creature gets +1/+0 and becomes an artifact in addition to its other types.');
  const BEAR = card('Test Cave Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Ember Anvil', 'Test Cave Bear'] }, defs: [FORGE, BEAR] });
  it('has no manual part', () => expect(full(FORGE)).toBe(true));
  it('the creature is a 3/2 artifact creature Bear until end of turn', () => {
    const s0 = start();
    const bear = find(s0, 'Test Cave Bear', 'battlefield', 'p1');
    const s = activate(s0, 'Test Ember Anvil', { targets: [[obj(bear)]] });
    const c = ch(s, bear);
    expect(c.types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    expect(c.subtypes).toContain('Bear');
    expect([c.power, c.toughness]).toEqual([3, 2]);
  });
  it('the negative case: on the next turn it is a 2/2 creature that is not an artifact', () => {
    const s0 = start();
    const bear = find(s0, 'Test Cave Bear', 'battlefield', 'p1');
    const s = advanceTo(activate(s0, 'Test Ember Anvil', { targets: [[obj(bear)]] }), 2, 'upkeep');
    expect(ch(s, bear).types).not.toContain('Artifact');
    expect([ch(s, bear).power, ch(s, bear).toughness]).toEqual([2, 2]);
  });
});

describe('"{T}: Target land becomes a Forest or a Mountain until end of turn." (CR 608.2d, 305.7, 613.1d; Tundra Kavu)', () => {
  const KAVU = card('Test Frost Digger', 'Artifact', '{0}: Target land becomes a Forest or a Mountain until end of turn.');
  const LAND = card('Test Salt Flat', 'Land — Island', '');
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Frost Digger'] }, p2: { battlefield: ['Test Salt Flat'] }, defs: [KAVU, LAND] });
  it('has no manual part', () => expect(full(KAVU)).toBe(true));
  it('the controller chooses Mountain as the ability resolves: the land is a Mountain and no longer an Island (setting a basic land type replaces the old ones, CR 305.7)', () => {
    const s0 = start();
    const land = find(s0, 'Test Salt Flat', 'battlefield', 'p2');
    const s = activateChoosing(s0, 'Test Frost Digger', 'Mountain', { targets: [[obj(land)]] });
    expect(ch(s, land).subtypes).toEqual(['Mountain']);
  });
  it('the negative case: choosing Forest makes it a Forest, not a Mountain', () => {
    const s0 = start();
    const land = find(s0, 'Test Salt Flat', 'battlefield', 'p2');
    const s = activateChoosing(s0, 'Test Frost Digger', 'Forest', { targets: [[obj(land)]] });
    expect(ch(s, land).subtypes).toEqual(['Forest']);
  });
});

describe('"{1}: You may have target creature\'s base power and toughness become 3/1 or 1/3 until end of turn." (CR 608.2d, 613.4b; Master of Winds)', () => {
  const WINDS = card('Test Gale Shaper', 'Artifact', '{0}: You may have target creature\'s base power and toughness become 3/1 or 1/3 until end of turn.');
  const BEAR = card('Test Cave Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Gale Shaper', 'Test Cave Bear'] }, defs: [WINDS, BEAR] });
  it('has no manual part', () => expect(full(WINDS)).toBe(true));
  it('you choose 1/3: the creature is 1/3', () => {
    const s0 = start();
    const bear = find(s0, 'Test Cave Bear', 'battlefield', 'p1');
    const s = activateChoosing(s0, 'Test Gale Shaper', '1/3', { targets: [[obj(bear)]] });
    expect([ch(s, bear).power, ch(s, bear).toughness]).toEqual([1, 3]);
  });
  it('the negative case: you decline ("you may"): it stays 2/2', () => {
    const s0 = start();
    const bear = find(s0, 'Test Cave Bear', 'battlefield', 'p1');
    const s = activate(s0, 'Test Gale Shaper', { targets: [[obj(bear)]], yes: [false] });
    expect([ch(s, bear).power, ch(s, bear).toughness]).toEqual([2, 2]);
  });
});

describe('"{T}: Until end of turn, target creature has base power 1 or base toughness 1." (CR 608.2d, 613.4b; Vhati il-Dal)', () => {
  const VHATI = card('Test Venom Steward', 'Artifact', '{0}: Until end of turn, target creature has base power 1 or base toughness 1.');
  const GIANT = card('Test Hill Giant', 'Creature — Giant', '', '{0}', ['4', '5']);
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Venom Steward'] }, p2: { battlefield: ['Test Hill Giant'] }, defs: [VHATI, GIANT] });
  it('has no manual part', () => expect(full(VHATI)).toBe(true));
  it('choosing power sets only the base power: the creature is 1/5', () => {
    const s0 = start();
    const giant = find(s0, 'Test Hill Giant', 'battlefield', 'p2');
    const s = activateChoosing(s0, 'Test Venom Steward', 'power', { targets: [[obj(giant)]] });
    expect([ch(s, giant).power, ch(s, giant).toughness]).toEqual([1, 5]);
  });
  it('the negative case: choosing toughness sets only the base toughness: the creature is 4/1', () => {
    const s0 = start();
    const giant = find(s0, 'Test Hill Giant', 'battlefield', 'p2');
    const s = activateChoosing(s0, 'Test Venom Steward', 'toughness', { targets: [[obj(giant)]] });
    expect([ch(s, giant).power, ch(s, giant).toughness]).toEqual([4, 1]);
  });
});

describe('"Whenever ~ attacks, populate. The token enters tapped and attacking." (CR 701.36a, 508.4, 110.5b; Ghired, Conclave Exile)', () => {
  const GHIRED = card('Test Herd Warden', 'Creature — Human Shaman', 'Haste\nWhenever ~ attacks, populate. The token enters tapped and attacking.', '{0}', ['2', '5']);
  const MAKER = card('Test Rhino Call', 'Sorcery', 'Create a 4/4 green Rhino creature token with trample.');
  const start = (withToken: boolean): GameState => {
    const s = scenario([], { p1: { battlefield: ['Test Herd Warden'], hand: ['Test Rhino Call'] }, defs: [GHIRED, MAKER] });
    return withToken ? resolveAll(cast(s, 'Test Rhino Call')) : s;
  };
  const attack = (s0: GameState): GameState => {
    let s = advanceTo(s0, 1, 'declareAttackers');
    const warden = find(s, 'Test Herd Warden', 'battlefield', 'p1');
    if (s.pending?.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [{ attacker: warden, defender: 'p2' }] } as never);
    return resolveAll(drive(s));
  };
  const rhinos = (s: GameState): ObjectId[] => s.zones.battlefield.filter((id) => ch(s, id).subtypes.includes('Rhino'));
  it('has no manual part', () => expect(full(GHIRED)).toBe(true));
  it('the copy of the Rhino token enters tapped and attacking (it was never declared as an attacker, CR 508.4)', () => {
    const s = attack(start(true));
    const rs = rhinos(s);
    expect(rs).toHaveLength(2);
    const copy = rs.find((id) => s.objects[id]!.tapped === true)!;
    expect(copy).toBeDefined();
    expect(s.combat?.attackers.some((a) => a.id === copy || (a as { attacker?: string }).attacker === copy)).toBe(true);
  });
  it('the negative case: with no creature token, populate does nothing (CR 701.36b)', () => {
    const s = attack(start(false));
    expect(rhinos(s)).toHaveLength(0);
  });
});

describe('"Whenever a player casts a sorcery spell, each other player may copy that spell and may choose new targets for the copy they control." (CR 707.10, 707.10c, 101.4, 102.1; Curse of Echoes, ruling 2011-01-22)', () => {
  const ECHO = card('Test Echo Shrine', 'Enchantment', 'Whenever a player casts a sorcery spell, each other player may copy that spell and may choose new targets for the copy they control.');
  const GIFT = card('Test Small Gift', 'Sorcery', 'You gain 3 life.');
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Echo Shrine'], hand: ['Test Small Gift'] }, defs: [ECHO, GIFT] });
  it('has no manual part', () => expect(full(ECHO)).toBe(true));
  it('the other player copies the spell and controls the copy: Bob gains 3 life from his copy, Alice 3 from her spell; Alice is not offered a copy of her own spell', () => {
    let s = cast(start(), 'Test Small Gift');
    const asked: string[] = [];
    for (let i = 0; i < 40 && (s.zones.stack.length > 0 || s.pending?.kind !== 'priority'); i++) {
      if (s.pending?.kind === 'yesNo') { asked.push(s.pending.player); s = answer(s, { kind: 'yesNo', yes: true }); continue; }
      if (s.pending?.kind !== 'priority') { s = drive(s); continue; }
      s = act(s, { type: 'pass', player: s.pending.player });
    }
    expect(asked).toEqual(['p2']);
    expect(lifeOf(s, 'p1')).toBe(23);
    expect(lifeOf(s, 'p2')).toBe(23);
  });
  it('the negative case: Bob declines, nobody copies it', () => {
    const s = resolveAll(cast(start(), 'Test Small Gift'), { yes: [false] });
    expect(lifeOf(s, 'p1')).toBe(23);
    expect(lifeOf(s, 'p2')).toBe(20);
  });
});

describe('"{0}: Create a token that\'s a copy of target artifact you control, except its name is Test Warform and it\'s a 4/4 Construct artifact creature in addition to its other types." (CR 707.9b, 201.2, 205.1b, 613.4b; Mishra, Eminent One)', () => {
  const MISHRA = card('Test Forge Master', 'Artifact', '{0}: Create a token that\'s a copy of target artifact you control, except its name is Test Warform and it\'s a 4/4 Construct artifact creature in addition to its other types.');
  const ORB = card('Test Brass Orb', 'Artifact', '');
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Forge Master', 'Test Brass Orb'] }, defs: [MISHRA, ORB] });
  it('has no manual part', () => expect(full(MISHRA)).toBe(true));
  it('the token is named Test Warform, a 4/4 Construct artifact creature (a copiable value, CR 707.9b)', () => {
    const s0 = start();
    const orb = find(s0, 'Test Brass Orb', 'battlefield', 'p1');
    const s = activate(s0, 'Test Forge Master', { targets: [[obj(orb)]] });
    const tok = s.zones.battlefield.find((id) => isToken(s, id))!;
    expect(tok).toBeDefined();
    const c = ch(s, tok);
    expect(c.name).toBe('Test Warform');
    expect(c.types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    expect(c.subtypes).toContain('Construct');
    expect([c.power, c.toughness]).toEqual([4, 4]);
  });
  it('the negative case: the original keeps its own name and is no creature', () => {
    const s0 = start();
    const orb = find(s0, 'Test Brass Orb', 'battlefield', 'p1');
    const s = activate(s0, 'Test Forge Master', { targets: [[obj(orb)]] });
    expect(ch(s, orb).name).toBe('Test Brass Orb');
    expect(ch(s, orb).types).not.toContain('Creature');
  });
});

describe('"{0}: Create a token that\'s a copy of target creature, except it\'s a legendary Alien named Test Prisoner." (CR 707.9b, 205.1a, 205.4a, 201.2; The Eleventh Hour, ruling 2023-10-13)', () => {
  const HOUR = card('Test Last Minute', 'Artifact', '{0}: Create a token that\'s a copy of target creature, except it\'s a legendary Alien named Test Prisoner.');
  const SOLDIER = card('Test Gate Soldier', 'Artifact Creature — Human Soldier', '', '{0}', ['2', '3']);
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Last Minute', 'Test Gate Soldier'] }, defs: [HOUR, SOLDIER] });
  it('has no manual part', () => expect(full(HOUR)).toBe(true));
  it('the token is a legendary artifact creature Alien named Test Prisoner: its other subtypes are gone, its card types and size kept', () => {
    const s0 = start();
    const soldier = find(s0, 'Test Gate Soldier', 'battlefield', 'p1');
    const s = activate(s0, 'Test Last Minute', { targets: [[obj(soldier)]] });
    const tok = s.zones.battlefield.find((id) => isToken(s, id))!;
    const c = ch(s, tok);
    expect(c.name).toBe('Test Prisoner');
    expect(c.supertypes).toContain('Legendary');
    expect(c.subtypes).toEqual(['Alien']);
    expect(c.types).toEqual(expect.arrayContaining(['Artifact', 'Creature']));
    expect([c.power, c.toughness]).toEqual([2, 3]);
  });
  it('review (ruling 2023-10-13: "it will lose any non-Alien subtypes it has"): a copy of an Equipment Cat artifact creature is an Alien only, the Equipment subtype gone too', () => {
    const CAT = card('Test Blade Cat', 'Artifact Creature — Equipment Cat', '', '{0}', ['1', '1']);
    const s0 = scenario([], { p1: { battlefield: ['Test Last Minute', 'Test Blade Cat'] }, defs: [HOUR, CAT] });
    const cat = find(s0, 'Test Blade Cat', 'battlefield', 'p1');
    const s = activate(s0, 'Test Last Minute', { targets: [[obj(cat)]] });
    const tok = s.zones.battlefield.find((id) => isToken(s, id))!;
    expect(ch(s, tok).subtypes).toEqual(['Alien']);
    expect(ch(s, cat).subtypes).toEqual(['Equipment', 'Cat']);
  });
  it('the negative case: the original is unchanged', () => {
    const s0 = start();
    const soldier = find(s0, 'Test Gate Soldier', 'battlefield', 'p1');
    const s = activate(s0, 'Test Last Minute', { targets: [[obj(soldier)]] });
    expect(ch(s, soldier).subtypes).toEqual(['Human', 'Soldier']);
    expect(ch(s, soldier).supertypes).not.toContain('Legendary');
  });
});

describe('"{0}: Target land becomes a Swamp until its controller\'s next untap step." (CR 502.1, 611.2a, 305.7; Orcish Farmer)', () => {
  const FARMER = card('Test Bog Tiller', 'Artifact', '{0}: Target land becomes a Swamp until its controller\'s next untap step.');
  const LAND = card('Test Hill Pasture', 'Land — Plains', '');
  const start = (): GameState => scenario([], { p1: { battlefield: ['Test Bog Tiller', 'Test Hill Pasture'] }, p2: { battlefield: ['Test Hill Pasture'] }, defs: [FARMER, LAND] });
  it('has no manual part', () => expect(full(FARMER)).toBe(true));
  it('your own land stays a Swamp through the opponent\'s turn and is a Plains again in your next upkeep (your untap step began)', () => {
    const s0 = start();
    const land = find(s0, 'Test Hill Pasture', 'battlefield', 'p1');
    const s1 = activate(s0, 'Test Bog Tiller', { targets: [[obj(land)]] });
    expect(ch(s1, land).subtypes).toEqual(['Swamp']);
    const s2 = advanceTo(s1, 2, 'upkeep');
    expect(ch(s2, land).subtypes).toEqual(['Swamp']);
    const s3 = advanceTo(s2, 3, 'upkeep');
    expect(ch(s3, land).subtypes).toEqual(['Plains']);
  });
  it('the negative case: the opponent\'s land is a Plains again in the opponent\'s next upkeep (its controller\'s untap step, not yours)', () => {
    const s0 = start();
    const land = find(s0, 'Test Hill Pasture', 'battlefield', 'p2');
    const s1 = activate(s0, 'Test Bog Tiller', { targets: [[obj(land)]] });
    expect(ch(s1, land).subtypes).toEqual(['Swamp']);
    const s2 = advanceTo(s1, 2, 'upkeep');
    expect(ch(s2, land).subtypes).toEqual(['Plains']);
  });
});
