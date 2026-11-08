/**
 * Commander coordinator E, round edh-e-7 (graveyard 2/3): graveyard-position conditions played through the engine with synthetic cards (invented names, design 6.10), compiled by the
 * game's default compiler. Alice (p1) is the active player of turn 1; the checks run in her upkeep of turn 3. CR cites are from memory of the Comprehensive Rules (404.2 not checked
 * against the 2026-09-25 text: unverified).
 *
 *   CR 404.1, 404.2, 113.6m, 603.4   "At the beginning of your upkeep, if ~ is the only creature card in your graveyard, you may return ~ to the battlefield." (Nether Spirit)
 *   CR 404.2, 113.6m, 603.4          "At the beginning of your upkeep, if ~ is in your graveyard with a creature card directly above it, you may return ~ to your hand." (Krovikan Horror)
 *   CR 404.2, 113.6m, 603.4          "..., if ~ is in your graveyard with a creature card directly above it, you may pay {1}. If you do, return ~ to your hand." (Death Spark)
 *   CR 404.2, 118.3, 602.2b          "Exile the top creature card of your graveyard: ~ gets +2/+2 until end of turn." (Necratog; the top card among creature cards, nothing chosen)
 *   CR 404.2, 118.12, 603.4          "At the beginning of your upkeep, sacrifice ~ unless you exile the top creature card of your graveyard." (Barrow Ghoul)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type OracleCard } from '../../../src/index';
import { act, advanceTo, answer, find, findAll, legal, scenario, put, pass } from '../../m3/scenario';
import { getChars } from '../../../src/index';

function card(name: string, type: string, text: string, pt?: [string, string]): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: '{0}', type_line: type, oracle_text: text, colors: [], keywords: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));

/** Set up Alice's graveyard (bottom first) and let her upkeep trigger resolve, answering "yes" to every question. */
function upkeep(defs: CardDef[], gy: string[]): GameState {
  const s0 = scenario([], { defs, p1: {} } as never);
  const ids = gy.map((n) => put(s0, 'p1', 'graveyard', n));
  s0.zones.graveyard['p1'] = ids; // last = top
  let s = advanceTo(s0, 3, 'upkeep');
  for (let guard = 0; guard < 40 && (s.pending?.kind !== 'priority' || s.zones.stack.length > 0); guard++) {
    const p = s.pending!;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else s = pass(s);
  }
  return s;
}
const inZone = (s: GameState, name: string, zone: 'battlefield' | 'graveyard' | 'hand'): number => findAll(s, name, zone, 'p1').length;

describe('CR 404.2, 113.6m, 603.4: "~ is the only creature card in your graveyard"', () => {
  const SPIRIT = card('Test Lone Spirit', 'Creature — Spirit', 'At the beginning of your upkeep, if ~ is the only creature card in your graveyard, you may return ~ to the battlefield.', ['1', '1']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const BOLT = card('Test Bolt', 'Instant', '~ deals 1 damage to any target.');
  const defs = [SPIRIT, BEAR, BOLT];
  it('is automated', () => expect(full(SPIRIT)).toBe(true));
  it('alone among creature cards (a noncreature card beside it does not matter): it returns', () => {
    expect(inZone(upkeep(defs, ['Test Lone Spirit']), 'Test Lone Spirit', 'battlefield')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Bolt', 'Test Lone Spirit']), 'Test Lone Spirit', 'battlefield')).toBe(1);
  });
  it('another creature card in the graveyard, above or below it: it stays', () => {
    expect(inZone(upkeep(defs, ['Test Lone Spirit', 'Test Bear']), 'Test Lone Spirit', 'graveyard')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Bear', 'Test Lone Spirit']), 'Test Lone Spirit', 'graveyard')).toBe(1);
  });
});

describe('CR 404.2, 113.6m, 603.4: "~ is in your graveyard with a creature card directly above it"', () => {
  const HORROR = card('Test Grave Horror', 'Creature — Horror', 'At the beginning of your upkeep, if ~ is in your graveyard with a creature card directly above it, you may return ~ to your hand.', ['1', '1']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const BOLT = card('Test Bolt', 'Instant', '~ deals 1 damage to any target.');
  const defs = [HORROR, BEAR, BOLT];
  it('is automated', () => expect(full(HORROR)).toBe(true));
  it('a creature card right on top of it: it returns to hand', () => {
    expect(inZone(upkeep(defs, ['Test Grave Horror', 'Test Bear']), 'Test Grave Horror', 'hand')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Bolt', 'Test Grave Horror', 'Test Bear']), 'Test Grave Horror', 'hand')).toBe(1);
  });
  it('a noncreature card on top, a creature card only further up or below it, or nothing above it: it stays', () => {
    expect(inZone(upkeep(defs, ['Test Grave Horror', 'Test Bolt']), 'Test Grave Horror', 'graveyard')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Grave Horror', 'Test Bolt', 'Test Bear']), 'Test Grave Horror', 'graveyard')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Bear', 'Test Grave Horror']), 'Test Grave Horror', 'graveyard')).toBe(1);
  });
});

describe('CR 404.2, 113.6m, 603.4, 118.12: "..., if ~ is in your graveyard with a creature card directly above it, you may pay {1}. If you do, return ~ to your hand."', () => {
  const SPARK = card('Test Grave Spark', 'Instant', '~ deals 1 damage to any target.\nAt the beginning of your upkeep, if ~ is in your graveyard with a creature card directly above it, you may pay {1}. If you do, return ~ to your hand.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  it('is automated', () => expect(full(SPARK)).toBe(true));
  it('with a creature card directly above it the trigger happens (paying {1} needs mana: none here, so it stays); with a noncreature on top there is no trigger at all', () => {
    const withCreature = upkeep([SPARK, BEAR], ['Test Grave Spark', 'Test Bear']);
    expect(inZone(withCreature, 'Test Grave Spark', 'hand')).toBe(0);
    expect(find(withCreature, 'Test Grave Spark', 'graveyard', 'p1')).toBeDefined();
  });
});

describe('CR 404.2: "with three or more creature cards above it" (the position count)', () => {
  const SHADOW = card('Test Deep Shade', 'Creature — Shade', 'At the beginning of your upkeep, if ~ is in your graveyard with three or more creature cards above it, you may return ~ to your hand.', ['1', '1']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const BOLT = card('Test Bolt', 'Instant', '~ deals 1 damage to any target.');
  const defs = [SHADOW, BEAR, BOLT];
  it('is automated', () => expect(full(SHADOW)).toBe(true));
  it('three creature cards above it (noncreature cards between do not count): it returns; two, or three below it: it stays', () => {
    expect(inZone(upkeep(defs, ['Test Deep Shade', 'Test Bear', 'Test Bolt', 'Test Bear', 'Test Bear']), 'Test Deep Shade', 'hand')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Deep Shade', 'Test Bear', 'Test Bolt', 'Test Bear']), 'Test Deep Shade', 'graveyard')).toBe(1);
    expect(inZone(upkeep(defs, ['Test Bear', 'Test Bear', 'Test Bear', 'Test Deep Shade']), 'Test Deep Shade', 'graveyard')).toBe(1);
  });
});

describe('CR 404.2, 118.3, 602.2b: "Exile the top creature card of your graveyard: ~ gets +2/+2 until end of turn."', () => {
  const TOG = card('Test Grave Tog', 'Creature — Atog', 'Exile the top creature card of your graveyard: ~ gets +2/+2 until end of turn.', ['1', '2']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const OGRE = card('Test Ogre', 'Creature — Ogre', '', ['3', '3']);
  const BOLT = card('Test Bolt', 'Instant', '~ deals 1 damage to any target.');
  const defs = [TOG, BEAR, OGRE, BOLT];
  const start = (gy: string[]): GameState => {
    const s = scenario([], { defs, p1: { battlefield: ['Test Grave Tog'] } } as never);
    s.zones.graveyard['p1'] = gy.map((n) => put(s, 'p1', 'graveyard', n));
    return s;
  };
  const power = (s: GameState): number => Number(getChars(s, find(s, 'Test Grave Tog', 'battlefield', 'p1')).power);
  const activate = (s0: GameState): GameState => {
    const hit = legal(s0, 'p1', 'activate').find((a) => a.object === find(s0, 'Test Grave Tog', 'battlefield', 'p1'));
    expect(hit).toBeDefined();
    let s = act(s0, hit!.action as never);
    for (let g = 0; g < 20 && (s.pending?.kind !== 'priority' || s.zones.stack.length > 0); g++) s = s.pending?.kind === 'payCost' ? answer(s, { kind: 'payCost', auto: true }) : pass(s);
    return s;
  };
  it('is automated', () => expect(full(TOG)).toBe(true));
  it('exiles the topmost creature card (a noncreature card above it stays); the next one after that is not touched', () => {
    const s = activate(start(['Test Ogre', 'Test Bear', 'Test Bolt']));
    expect(power(s)).toBe(3);
    expect(findAll(s, 'Test Bear', 'exile', 'p1')).toHaveLength(1);
    expect(findAll(s, 'Test Ogre', 'graveyard', 'p1')).toHaveLength(1);
    expect(findAll(s, 'Test Bolt', 'graveyard', 'p1')).toHaveLength(1);
  });
  it('no creature card in the graveyard: it cannot be activated', () => {
    expect(legal(start(['Test Bolt']), 'p1', 'activate').some((a) => a.object === find(start(['Test Bolt']), 'Test Grave Tog', 'battlefield', 'p1'))).toBe(false);
  });
});

describe('CR 404.2, 118.12, 603.4: "At the beginning of your upkeep, sacrifice ~ unless you exile the top creature card of your graveyard."', () => {
  const GHOUL = card('Test Barrow Ghoul', 'Creature — Zombie', 'At the beginning of your upkeep, sacrifice ~ unless you exile the top creature card of your graveyard.', ['4', '4']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const run = (gy: string[], yes: boolean): GameState => {
    const s0 = scenario([], { defs: [GHOUL, BEAR], p1: { battlefield: ['Test Barrow Ghoul'] } } as never);
    s0.zones.graveyard['p1'] = gy.map((n) => put(s0, 'p1', 'graveyard', n));
    let s = advanceTo(s0, 3, 'upkeep');
    for (let g = 0; g < 40 && (s.pending?.kind !== 'priority' || s.zones.stack.length > 0); g++) {
      const p = s.pending!;
      s = p.kind === 'yesNo' ? answer(s, { kind: 'yesNo', yes }) : p.kind === 'payCost' ? answer(s, { kind: 'payCost', auto: true }) : pass(s);
    }
    return s;
  };
  it('is automated', () => expect(full(GHOUL)).toBe(true));
  it('paying: the top creature card is exiled and the Ghoul stays; declining or having none: it is sacrificed', () => {
    const paid = run(['Test Bear'], true);
    expect(findAll(paid, 'Test Bear', 'exile', 'p1')).toHaveLength(1);
    expect(findAll(paid, 'Test Barrow Ghoul', 'battlefield', 'p1')).toHaveLength(1);
    expect(findAll(run(['Test Bear'], false), 'Test Barrow Ghoul', 'graveyard', 'p1')).toHaveLength(1);
    expect(findAll(run([], true), 'Test Barrow Ghoul', 'graveyard', 'p1')).toHaveLength(1);
  });
});
