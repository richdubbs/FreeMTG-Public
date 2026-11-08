/**
 * Commander coordinator E, round edh-e-33 (group "control"): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the
 * game's default compiler. Alice (p1) is the active player of turn 1, Bob (p2) the opponent. CR cites are from memory (no rules/cr folder in cloud sessions): unverified.
 *
 *   CR 109.4, 611.2b, 613.1b   "{T}: Gain control of target creature whose controller controls an Island for as long as you control this creature and this creature remains tapped." (Seasinger)
 *   CR 603.10a, 608.2h, 611.2c "Destroy target nonblack creature. It can't be regenerated. You gain control of all Equipment that were attached to it." (Murderous Spoils)
 *   CR 701.12a, 108.4, 115.1   "When this creature enters, you may exchange control of target creature you control and target creature with power less than or equal to that creature's power an opponent controls." (Spawnbroker)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type TargetChoice } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, advanceTo, answer, find, pass, put, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, pt?: [string, string], colors: string[] = []): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: '{0}', type_line: type, oracle_text: text, colors, keywords: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');
const obj = (id: string): TargetChoice => ({ kind: 'object', id });

interface Drive { targets?: TargetChoice[]; yes?: boolean }
function settle(s0: GameState, d: Drive = {}): GameState {
  let s = s0;
  let asked = 0;
  for (let g = 0; g < 60; g++) {
    const p = s.pending;
    if (p === undefined || p === null) break;
    if (p.kind === 'priority') {
      if (s.zones.stack.length === 0) break;
      s = pass(s);
    } else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: (d.targets ?? []).slice(asked, asked + 1) /* one target per decision */ }), asked++;
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: d.yes ?? true });
    else throw new Error(`unexpected decision ${p.kind}: ${p.prompt}`);
  }
  return s;
}
const castSpell = (s: GameState, name: string, d: Drive = {}): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, name, 'hand', 'p1') }), d);
const ctl = (s: GameState, id: ObjectId): string => getChars(s, id)!.controller;

const SIREN = card('Test Siren', 'Creature — Merfolk', '{T}: Gain control of target creature whose controller controls an Island for as long as you control this creature and this creature remains tapped.', ['1', '1']);
const ISLE = card('Test Isle', 'Basic Land — Island', '');
const MARSH = card('Test Marsh', 'Basic Land — Swamp', '');
const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const OGRE = card('Test Ogre', 'Creature — Ogre', '', ['5', '5']);
const SPOILS = card('Test Spoils', 'Instant', 'Destroy target nonblack creature. It can\'t be regenerated. You gain control of all Equipment that were attached to it.');
const BLADE = card('Test Blade', 'Artifact — Equipment', 'Equipped creature gets +1/+1.\nEquip {1}');
const BROKER = card('Test Broker', 'Creature — Human', 'When this creature enters, you may exchange control of target creature you control and target creature with power less than or equal to that creature\'s power an opponent controls.', ['1', '1']);
const DJINN = card('Test Djinn', 'Creature — Djinn', 'Flying\nAt the beginning of each player\'s upkeep, that player may pay {R}{R} or 2 life. If the player does, they gain control of this creature.', ['4', '4']);
const MOUNTAIN = card('Test Peak', 'Basic Land — Mountain', '{T}: Add {R}.');
const TANK = card('Test Tank', 'Creature — Golem', 'Indestructible', ['3', '3']);
const DEFS = [DJINN, MOUNTAIN, SIREN, ISLE, MARSH, BEAR, OGRE, SPOILS, BLADE, BROKER];

describe('design 6.9: the round\'s test cards compile fully', () => {
  it('every card with a rules text is fully automated', () => {
    for (const d of [SIREN, SPOILS, BROKER, DJINN]) expect(full(d), `${d.name}: ${JSON.stringify(d.automation)}`).toBe(true);
  });
});

describe('CR 109.4, 611.2b, 613.1b: "Gain control of target creature whose controller controls an Island for as long as you control this creature and this creature remains tapped." (Seasinger)', () => {
  const setup = (p2: string[]): GameState => scenario([], { p1: { battlefield: ['Test Siren'] }, p2: { battlefield: p2 }, defs: DEFS });
  const steal = (s0: GameState, target: ObjectId): GameState => settle(act(s0, { type: 'activate', player: 'p1', source: find(s0, 'Test Siren', 'battlefield'), ability: 'p:0:0' }), { targets: [obj(target)] });
  it('steals a creature of a player who controls an Island, while the Siren stays tapped', () => {
    const s0 = setup(['Test Bear', 'Test Isle']);
    const bear = find(s0, 'Test Bear', 'battlefield');
    const s = steal(s0, bear);
    expect(ctl(s, bear)).toBe('p1');
  });
  it('negative: a creature of a player with no Island can\'t be targeted', () => {
    const s0 = setup(['Test Bear', 'Test Marsh']);
    const bear = find(s0, 'Test Bear', 'battlefield');
    expect(() => steal(s0, bear)).toThrow();
    expect(ctl(s0, bear)).toBe('p2');
  });
  it('the creature goes back when the Siren untaps', () => {
    const s0 = setup(['Test Bear', 'Test Isle']);
    const bear = find(s0, 'Test Bear', 'battlefield');
    let s = steal(s0, bear);
    s = tweakUntap(s, find(s, 'Test Siren', 'battlefield'));
    expect(ctl(s, bear)).toBe('p2');
  });
});
function tweakUntap(s: GameState, id: ObjectId): GameState {
  const c = structuredClone(s) as GameState;
  c.objects[id]!.tapped = false;
  return c;
}

describe('CR 603.10a, 608.2h, 611.2c: "You gain control of all Equipment that were attached to it." (Murderous Spoils)', () => {
  const setup = (): GameState => scenario([], { p1: { hand: ['Test Spoils'], battlefield: [] }, p2: { battlefield: ['Test Bear', 'Test Ogre'] }, defs: DEFS });
  const attach = (s: GameState, owner: 'p1' | 'p2', host: ObjectId): ObjectId => { const e = put(s, owner, 'battlefield', 'Test Blade'); s.objects[e]!.attachedTo = host; return e; };
  it('takes every Equipment that was attached to the destroyed creature, whoever controlled it, and keeps it', () => {
    const s0 = setup();
    const bear = find(s0, 'Test Bear', 'battlefield');
    const e1 = attach(s0, 'p2', bear);
    const e2 = attach(s0, 'p1', bear);
    let s = castSpell(s0, 'Test Spoils', { targets: [obj(bear)] });
    expect(s.zones.battlefield.some((id) => id === bear)).toBe(false);
    expect(ctl(s, e1)).toBe('p1');
    expect(ctl(s, e2)).toBe('p1');
    s = advanceTo(s, 3, 'main1'); // the effect has no duration: it is still there on a later turn (CR 611.2a)
    expect(ctl(s, e1)).toBe('p1');
  });
  it('an indestructible creature survives, and its Equipment is still taken (the Equipment is attached as the spell resolves)', () => {
    const s0 = scenario([], { p1: { hand: ['Test Spoils'], battlefield: [] }, p2: { battlefield: ['Test Tank'] }, defs: [...DEFS, TANK] });
    const tank = find(s0, 'Test Tank', 'battlefield');
    const e = put(s0, 'p2', 'battlefield', 'Test Blade');
    s0.objects[e]!.attachedTo = tank;
    const s = castSpell(s0, 'Test Spoils', { targets: [obj(tank)] });
    expect(s.zones.battlefield.includes(tank)).toBe(true);
    expect(ctl(s, e)).toBe('p1');
  });
  it('negative: Equipment attached to another creature stays where it was', () => {
    const s0 = setup();
    const bear = find(s0, 'Test Bear', 'battlefield');
    const other = attach(s0, 'p2', find(s0, 'Test Ogre', 'battlefield'));
    const s = castSpell(s0, 'Test Spoils', { targets: [obj(bear)] });
    expect(ctl(s, other)).toBe('p2');
  });
});

describe('CR 701.12a, 108.4, 115.1: "exchange control of target creature you control and target creature with power less than or equal to that creature\'s power an opponent controls." (Spawnbroker)', () => {
  const setup = (): GameState => scenario([], { p1: { hand: ['Test Broker'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Ogre', 'Test Bear'] }, defs: DEFS });
  it('exchanges your Bear for an opponent\'s creature with power 2 or less', () => {
    const s0 = setup();
    const mine = find(s0, 'Test Bear', 'battlefield', 'p1');
    const theirs = find(s0, 'Test Bear', 'battlefield', 'p2');
    const s = castSpell(s0, 'Test Broker', { targets: [obj(mine), obj(theirs)] });
    expect(ctl(s, mine)).toBe('p2');
    expect(ctl(s, theirs)).toBe('p1');
  });
  it('negative: a creature with greater power than yours can\'t be the second target', () => {
    const s0 = setup();
    const mine = find(s0, 'Test Bear', 'battlefield', 'p1');
    const ogre = find(s0, 'Test Ogre', 'battlefield', 'p2');
    expect(() => castSpell(s0, 'Test Broker', { targets: [obj(mine), obj(ogre)] })).toThrow(/not a legal target/);
    expect(ctl(s0, mine)).toBe('p1');
  });
});

describe('CR 118.1, 118.12, 119.4, 611.2a: "At the beginning of each player\'s upkeep, that player may pay {R}{R} or 2 life. If the player does, they gain control of this creature." (Emberwilde Djinn)', () => {
  const setup = (): GameState => scenario([], { p1: { battlefield: ['Test Djinn'] }, p2: { battlefield: ['Test Peak', 'Test Peak'] }, defs: DEFS });
  /** Pass to p2's upkeep trigger, then answer the payment (`mana`: pay {R}{R}; else pay life) or decline. */
  function toUpkeep(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 80 && !(s.turn.number === 2 && s.zones.stack.length > 0); i++) {
      if (s.pending?.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
      else s = pass(s);
    }
    return s;
  }
  /** Run p2's upkeep trigger: `yes` answers "may pay", `option` picks the cost (0 = {R}{R}, 1 = 2 life). */
  function upkeep(yes: boolean, option: number): GameState {
    let s = toUpkeep(setup());
    for (let i = 0; i < 12 && s.zones.stack.length > 0; i++) {
      const p = s.pending;
      if (p?.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes });
      else if (p?.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [p.options[option]!.id] });
      else if (p?.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else s = pass(s);
    }
    return s;
  }
  const lifeOf = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
  it('the opponent pays 2 life and gains control of the Djinn', () => {
    const before = lifeOf(toUpkeep(setup()), 'p2');
    const s = upkeep(true, 1);
    expect(ctl(s, find(s, 'Test Djinn', 'battlefield'))).toBe('p2');
    expect(lifeOf(s, 'p2')).toBe(before - 2);
  });
  it('the opponent pays {R}{R} instead: no life lost, the Djinn is theirs', () => {
    const before = lifeOf(toUpkeep(setup()), 'p2');
    const s = upkeep(true, 0);
    expect(ctl(s, find(s, 'Test Djinn', 'battlefield'))).toBe('p2');
    expect(lifeOf(s, 'p2')).toBe(before);
  });
  it('negative: the opponent declines and the Djinn stays with its controller', () => {
    const before = lifeOf(toUpkeep(setup()), 'p2');
    const s = upkeep(false, 1);
    expect(ctl(s, find(s, 'Test Djinn', 'battlefield'))).toBe('p1');
    expect(lifeOf(s, 'p2')).toBe(before);
  });
});
