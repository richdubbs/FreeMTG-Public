/**
 * Commander coordinator E, round edh-e-27 (group sacrifice-destroy): the round's parser, filter and engine changes played through the engine with synthetic cards (invented names,
 * design 6.10), compiled by the game's default compiler. CR cites from memory unless noted (the CR text of 2026-09-25 was not read in this round).
 *
 *   CR 700.4, 701.8a, 608.2c, 608.2h   "Destroy target creature. If a white creature dies this way, ~ deals damage to that creature's controller equal to the creature's power."
 *                                       (the one destroyed target died AND was white as it last existed; its power is last known information)
 *   CR 400.7, 500.1                    "Destroy target nonblack creature that entered since your last turn ended." (history scope sinceYourLastTurn: the entries after the end of your
 *                                       most recent turn that ended; an object that changed zones is a new object)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type Color, type GameState, type ObjectId, type TargetChoice } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, answer, find, life, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, opts: { pt?: [string, string]; cost?: string; colors?: Color[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const automated = (d: CardDef): boolean => d.automation.level === 'full';
const target = (id: ObjectId): TargetChoice => ({ kind: 'object', id });

/** Answer every decision until a player has priority: targets in order from `targets`, mana automatically. */
function drive(s0: GameState, targets: TargetChoice[][] = []): GameState {
  let s = s0;
  const tq = [...targets];
  for (let guard = 0; guard < 60 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending as unknown as { kind: string };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: tq.shift() ?? [] });
    else throw new Error(`unexpected decision ${JSON.stringify(s.pending)}`);
  }
  return s;
}
function castAndResolve(s0: GameState, name: string, targets: TargetChoice[][], mana: string[]): GameState {
  for (const m of mana) s0.players[0]!.manaPool.push({ type: m } as never);
  let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') }), targets);
  for (let guard = 0; guard < 40 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); guard++) s = s.pending?.kind === 'priority' ? pass(s) : drive(s, targets);
  return s;
}
const onBf = (s: GameState, name: string): ObjectId[] => s.zones.battlefield.filter((id) => getChars(s, id).name === name);

describe('CR 700.4, 701.8a, 608.2c, 608.2h: "Destroy target creature. If a white creature dies this way, ~ deals damage to that creature\'s controller equal to the creature\'s power."', () => {
  const CLOUD = card('Test Cloud', 'Instant', "Destroy target creature. If a white creature dies this way, ~ deals damage to that creature's controller equal to the creature's power.", { cost: '{1}{R}', colors: ['R'] });
  const KNIGHT = card('Test Knight', 'Creature — Human Knight', '', { pt: ['4', '4'], colors: ['W'] });
  const GROVE = card('Test Grovekeeper', 'Creature — Elf', '', { pt: ['3', '3'], colors: ['G'] });
  const PALADIN = card('Test Paladin', 'Creature — Human Knight', 'Indestructible', { pt: ['5', '5'], colors: ['W'] });
  const defs = [CLOUD, KNIGHT, GROVE, PALADIN];
  const setup = (): GameState => scenario([], { p1: { hand: ['Test Cloud'] }, p2: { battlefield: ['Test Knight', 'Test Grovekeeper', 'Test Paladin'] }, defs });
  const mana = ['R', 'C'];

  it('is automated (the reading is general, but this card is the only one the round opens)', () => {
    expect(automated(CLOUD)).toBe(true);
  });
  it('a white creature destroyed this way: its controller is dealt damage equal to its power (last known information), the damage comes from the spell', () => {
    const s0 = setup();
    const r = castAndResolve(s0, 'Test Cloud', [[target(find(s0, 'Test Knight', 'battlefield', 'p2'))]], mana);
    expect(onBf(r, 'Test Knight')).toHaveLength(0);
    expect(life(r, 'p2')).toBe(life(s0, 'p2') - 4);
    expect(life(r, 'p1')).toBe(life(s0, 'p1'));
  });
  it('NEGATIVE: a creature that is not white dies and its controller takes no damage', () => {
    const s0 = setup();
    const r = castAndResolve(s0, 'Test Cloud', [[target(find(s0, 'Test Grovekeeper', 'battlefield', 'p2'))]], mana);
    expect(onBf(r, 'Test Grovekeeper')).toHaveLength(0);
    expect(life(r, 'p2')).toBe(life(s0, 'p2'));
  });
  it('NEGATIVE: a white creature that does not die (indestructible, CR 702.12b) is not "a white creature dies this way": no damage', () => {
    const s0 = setup();
    const r = castAndResolve(s0, 'Test Cloud', [[target(find(s0, 'Test Paladin', 'battlefield', 'p2'))]], mana);
    expect(onBf(r, 'Test Paladin')).toHaveLength(1);
    expect(life(r, 'p2')).toBe(life(s0, 'p2'));
  });
  it('near misses stay manual: "a creature dies this way" for a bare type, and a destroy of a group', () => {
    expect(automated(card('Test Near A', 'Instant', 'Destroy target creature. If a creature dies this way, ~ deals 2 damage to you.', { cost: '{1}' }))).toBe(false);
    expect(automated(card('Test Near B', 'Sorcery', 'Destroy all creatures. If a white creature dies this way, you gain 1 life.', { cost: '{1}' }))).toBe(false);
  });
});

describe('CR 400.7, 500.1: "Destroy target nonblack creature that entered since your last turn ended."', () => {
  const BURIAL = card('Test Burial', 'Instant', 'Destroy target nonblack creature that entered since your last turn ended.', { cost: '{1}' });
  const defs = [
    BURIAL,
    card('Test Old Elf', 'Creature — Elf', '', { pt: ['1', '1'], colors: ['G'] }),
    card('Test Night Bear', 'Creature — Bear', '', { pt: ['2', '2'], colors: ['G'] }),
    card('Test Day Wolf', 'Creature — Wolf', '', { pt: ['2', '2'], colors: ['G'] }),
    card('Test Never Ghoul', 'Creature — Zombie', '', { pt: ['2', '2'], colors: ['B'] }),
    card('Test Quiet Imp', 'Creature — Imp', '', { pt: ['1', '1'], colors: ['R'] }),
  ];
  /** Turn 33 is p1's, its previous turn was 31: "your last turn ended" is the end of turn 31 (turn 32 was an opponent's). */
  function setup(): { s: GameState; id: Record<string, ObjectId> } {
    const s = scenario([], { p1: { hand: ['Test Burial'] }, p2: { battlefield: ['Test Old Elf', 'Test Night Bear', 'Test Day Wolf', 'Test Never Ghoul', 'Test Quiet Imp'] }, defs });
    const id = Object.fromEntries(['Test Old Elf', 'Test Night Bear', 'Test Day Wolf', 'Test Never Ghoul', 'Test Quiet Imp'].map((n) => [n, find(s, n, 'battlefield', 'p2')]));
    s.turn.number = 33;
    const p1 = s.players[0]!;
    p1.lastTurnStarted = 33;
    p1.previousTurnStarted = 31;
    const entered = (turn: number, who: string): void => { s.history.push({ turn, combat: 0, ev: 'zoneChange', subject: id[who], facts: { to: 'battlefield' } } as never); };
    entered(31, 'Test Old Elf'); // entered during my last turn: before it ended
    entered(32, 'Test Night Bear'); // entered during an opponent's turn, after my last turn ended
    entered(33, 'Test Day Wolf'); // entered this turn
    entered(32, 'Test Never Ghoul'); // black: never a legal target
    return { s, id };
  }
  const legalTargets = (s0: GameState): ObjectId[] => {
    s0.players[0]!.manaPool.push({ type: 'C' } as never);
    const s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Burial', 'hand', 'p1') });
    return [...(s.pending as unknown as { objects: ObjectId[] }).objects].sort();
  };

  it('is automated', () => {
    expect(automated(BURIAL)).toBe(true);
  });
  it('only creatures that entered after the end of my last turn that ended are legal: the opponent-turn entry and this turn\'s; not the one that entered during my last turn, not a creature with no entry, not a black one', () => {
    const { s, id } = setup();
    expect(legalTargets(s)).toEqual([id['Test Night Bear']!, id['Test Day Wolf']!].sort());
  });
  it('destroys the chosen creature that entered since then, and only that one', () => {
    const { s, id } = setup();
    const r = castAndResolve(s, 'Test Burial', [[target(id['Test Night Bear']!)]], ['C']);
    expect(onBf(r, 'Test Night Bear')).toHaveLength(0);
    expect(onBf(r, 'Test Day Wolf')).toHaveLength(1);
    expect(onBf(r, 'Test Old Elf')).toHaveLength(1);
  });
  it('before my first turn has ended the whole game counts: a creature with an entry at any turn is legal, one with none is not', () => {
    const { s, id } = setup();
    const p1 = s.players[0]!;
    p1.lastTurnStarted = 1;
    delete p1.previousTurnStarted;
    s.turn.activePlayer = 'p2'; // an opponent's turn: my last turn is the one that began last (turn 1), entries after the end of turn 1 count
    expect(legalTargets(s)).toEqual([id['Test Night Bear']!, id['Test Day Wolf']!, id['Test Old Elf']!].sort());
  });
});
