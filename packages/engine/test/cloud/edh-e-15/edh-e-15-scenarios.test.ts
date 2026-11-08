/**
 * edh-e-15 (Commander coordinator E, counters 3/3): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites are from memory
 * (no rules/cr in the cloud session) and are listed as unverified in the record.
 *
 *   CR 701.6a, 608.2c        "Counter all other spells. Draw a card for each spell countered this way." (Swift Silence)
 *   CR 122.1, 608.2c         "remove all <kind> counters from ~. If no counters were removed this way, ..." (Bounty of the Luxa)
 *   CR 122.1, 107.3, 608.2h  "Remove X counters from target permanent, where X is the number of Elves you control." (Thornmantle Striker)
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/index';
import { mpScenario } from '../../m12/rules/helpers';
import { pass } from '../../m3/scenario';
import { answer, card, cast, full, lifeOf, named, obj, resolveAll } from '../r4-cost/support';

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
const handOf = (s: GameState, p: string): number => s.zones.hand[p]!.length;
const countersOn = (s: GameState, name: string, kind: string): number => s.objects[named(s, name)[0]!]!.counters[kind] ?? 0;

// ---- Swift Silence ------------------------------------------------------------------------------------------------------------------------------------------------------

const HUSH = card('Test Hush', 'Instant', 'Counter all other spells. Draw a card for each spell countered this way.');
const ZAP = card('Test Zap', 'Instant', 'You gain 3 life.');
describe('CR 701.6a, 608.2c: "Counter all other spells. Draw a card for each spell countered this way."', () => {
  const board = (): GameState => mpScenario({ defs: [HUSH, ZAP], zones: { p1: { hand: ['Test Zap', 'Test Zap', 'Test Hush'], library: ['Plains', 'Plains', 'Plains', 'Plains'] } } });
  it('is full', () => expect(full(HUSH)).toBe(true));
  it('two other spells on the stack are countered (no life gained) and two cards are drawn; the spell itself is not counted', () => {
    let s = board();
    const before = handOf(s, 'p1');
    s = cast(s, 'Test Zap');
    s = cast(s, 'Test Zap');
    s = resolveAll(cast(s, 'Test Hush'));
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(handOf(s, 'p1')).toBe(before - 3 + 2); // three spells cast, two cards drawn
  });
  it('negative: no other spell on the stack: it draws nothing', () => {
    const s0 = board();
    const s = resolveAll(cast(s0, 'Test Hush'));
    expect(handOf(s, 'p1')).toBe(handOf(s0, 'p1') - 1); // only the Hush left the hand; nothing drawn
  });
});

// ---- Thornmantle Striker ----------------------------------------------------------------------------------------------------------------------------------------------

const CULL = card('Test Cull', 'Sorcery', 'Remove X counters from target permanent, where X is the number of Elves you control.');
const ELF = card('Test Elf', 'Creature — Elf', '', '{0}', ['1', '1']);
const RELIC = card('Test Relic', 'Artifact', '');
describe('CR 122.1, 107.3, 608.2h: "Remove X counters from target permanent, where X is the number of Elves you control."', () => {
  const board = (elves: number): GameState => mpScenario({ defs: [CULL, ELF, RELIC], zones: { p1: { hand: ['Test Cull'], battlefield: [...Array(elves).fill('Test Elf'), { name: 'Test Relic', counters: { charge: 5 } }] } } });
  it('is full', () => expect(full(CULL)).toBe(true));
  it('with two Elves it removes two counters from the target permanent', () => {
    const s0 = board(2);
    const s = resolveAll(cast(s0, 'Test Cull', { targets: [[obj(named(s0, 'Test Relic')[0]!)]] }));
    expect(countersOn(s, 'Test Relic', 'charge')).toBe(3);
  });
  it('negative: with no Elves it removes none', () => {
    const s0 = board(0);
    const s = resolveAll(cast(s0, 'Test Cull', { targets: [[obj(named(s0, 'Test Relic')[0]!)]] }));
    expect(countersOn(s, 'Test Relic', 'charge')).toBe(5);
  });
});

// ---- Bounty of the Luxa -----------------------------------------------------------------------------------------------------------------------------------------------

const LUXA = card('Test Luxa', 'Enchantment', 'At the beginning of your first main phase, remove all flood counters from this enchantment. If no counters were removed this way, put a flood counter on this enchantment and draw a card. Otherwise, add {C}{G}{U}.');
describe('CR 122.1, 608.2c: "remove all flood counters from ~. If no counters were removed this way, put a flood counter on ~ and draw a card. Otherwise, add {C}{G}{U}."', () => {
  const board = (counters: Record<string, number>): GameState => mpScenario({ defs: [LUXA], zones: { p1: { battlefield: [{ name: 'Test Luxa', counters }] } } });
  // the permanent is on the battlefield as the first main phase of turn 1 begins: its trigger is on the stack
  const fire = (s0: GameState): GameState => { expect(s0.zones.stack.length).toBeGreaterThan(0); return resolveAll(s0); };
  it('is full', () => expect(full(LUXA)).toBe(true));
  it('no flood counter on it: none are removed, so it gets one and you draw a card (and adds no mana)', () => {
    const s0 = board({});
    const s = fire(s0);
    expect(countersOn(s, 'Test Luxa', 'flood')).toBe(1);
    expect(handOf(s, 'p1')).toBe(handOf(s0, 'p1') + 1);
    expect(s.players.find((p) => p.id === 'p1')!.manaPool.length).toBe(0);
  });
  it('negative: a flood counter on it: all are removed, nothing is put back, no card is drawn and the mana is added instead', () => {
    const s0 = board({ flood: 2 });
    const s = fire(s0);
    expect(countersOn(s, 'Test Luxa', 'flood')).toBe(0);
    expect(handOf(s, 'p1')).toBe(handOf(s0, 'p1'));
    expect(s.players.find((p) => p.id === 'p1')!.manaPool.length).toBe(3);
  });
});
