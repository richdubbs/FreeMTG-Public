/**
 * edh-e-67 (Commander coordinator E, counters/groups): the round's reading played through the engine with synthetic cards (invented names, design 6.10), four players.
 *   CR 701.26a, 502.3, 611.2a, 608.2c  "Tap target creature you don't control, and that creature doesn't untap during its controller's next untap step", after an earlier
 *                                      sentence that named another target: "that creature" is the creature just tapped (the target of the same sentence)
 *   CR 122.1, 122.6                    "For each kind of counter on target permanent, put another counter of that kind on it or remove one from it": the controller picks add or remove per kind,
 *                                      all picks first; a kind with one counter can be emptied; no counters, nothing to choose
 * CR cites from memory (cloud session), unverified.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type TargetChoice } from '../../../src/index';
import { act, advanceTo, answer, find, pass, scenario } from '../../m3/scenario';
import { getChars } from '../../../src/rules/characteristics';

function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full';
const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
/** One list of choices per target spec, in order (each spec is asked on its own). */
function settle(s0: GameState, targets: TargetChoice[][]): GameState {
  let s = s0;
  const queue = [...targets];
  for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 20; guard++) {
    if (s.pending.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (s.pending.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: queue.shift() ?? [] });
    else if (s.pending.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else break;
  }
  return s;
}
function cast(s0: GameState, name: string, targets: TargetChoice[][]): GameState {
  let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') }), targets);
  for (let guard = 0; s.zones.stack.length > 0 && guard < 30; guard++) s = settle(s.pending?.kind === 'priority' ? pass(s) : s, targets);
  return s;
}

const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const OGRE = card('Test Ogre', 'Creature — Ogre', '', ['3', '3']);
const BLESS = card('Test Winter Boon', 'Sorcery', "Put two +1/+1 counters on target creature you control. Tap target creature you don't control, and that creature doesn't untap during its controller's next untap step.");
const BLESS_UPTO = card('Test Winter Gift', 'Sorcery', "Put a +1/+1 counter on up to one target creature you control. Tap up to one target creature you don't control, and that creature doesn't untap during its controller's next untap step.");

describe('the synthetic cards are automated', () => {
  for (const d of [BLESS, BLESS_UPTO]) it(d.name, () => expect(full(d), JSON.stringify(d.automation)).toBe(true));
  it('fail closed: "that artifact" after a tapped creature is not read as the tapped creature', () => {
    expect(full(card('Test Odd Boon', 'Sorcery', "Put two +1/+1 counters on target creature you control. Tap target creature you don't control, and that artifact doesn't untap during its controller's next untap step."))).toBe(false);
  });
});

describe('CR 701.26a, 502.3, 611.2a, 608.2c: tap the second target and keep it tapped, and only that one', () => {
  it('my creature gets the counters and stays untapped; the opponent\'s creature is tapped and stays tapped through its controller\'s next untap step', () => {
    const s0 = scenario([], { p1: { hand: ['Test Winter Boon'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Ogre'] }, defs: [BLESS, BEAR, OGRE] });
    const mine = find(s0, 'Test Bear', 'battlefield', 'p1');
    const theirs = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s1 = cast(s0, 'Test Winter Boon', [[obj(mine)], [obj(theirs)]]);
    expect(s1.objects[mine]!.counters['+1/+1']).toBe(2);
    expect(s1.objects[mine]!.tapped).toBe(false);
    expect(String(getChars(s1, mine)!.power)).toBe('4');
    expect(s1.objects[theirs]!.tapped).toBe(true);
    expect(s1.objects[theirs]!.counters['+1/+1'] ?? 0).toBe(0);
    const t2 = advanceTo(s1, 2, 'upkeep'); // p2's turn: its untap step kept the ogre tapped
    expect(t2.turn.activePlayer).toBe('p2');
    expect(t2.objects[theirs]!.tapped).toBe(true);
    const t4 = advanceTo(t2, 4, 'upkeep'); // p2's next turn: it untaps as usual
    expect(t4.objects[theirs]!.tapped).toBe(false);
  });
  it('negative: the creature that got the counters is never kept from untapping', () => {
    const s0 = scenario([], { p1: { hand: ['Test Winter Boon'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Ogre'] }, defs: [BLESS, BEAR, OGRE] });
    const mine = find(s0, 'Test Bear', 'battlefield', 'p1');
    const theirs = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s1 = cast(s0, 'Test Winter Boon', [[obj(mine)], [obj(theirs)]]);
    const restricted = s1.continuousEffects.filter((e) => e.duration.d === 'throughNextUntap');
    expect(restricted.length).toBe(1);
    expect(JSON.stringify(restricted[0])).toContain(theirs);
    expect(JSON.stringify(restricted[0])).not.toContain(mine);
  });
  it('"up to one": with no second target chosen, the first target still gets its counter and nothing is tapped', () => {
    const s0 = scenario([], { p1: { hand: ['Test Winter Gift'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Ogre'] }, defs: [BLESS_UPTO, BEAR, OGRE] });
    const mine = find(s0, 'Test Bear', 'battlefield', 'p1');
    const theirs = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s1 = cast(s0, 'Test Winter Gift', [[obj(mine)], []]);
    expect(s1.objects[mine]!.counters['+1/+1']).toBe(1);
    expect(s1.objects[theirs]!.tapped).toBe(false);
    expect(s1.continuousEffects.some((e) => e.duration.d === 'throughNextUntap')).toBe(false);
  });
});

/** Like settle, and answers each add-or-remove question from `picks` in order (the kinds are asked in the order the holder has them). */
function castWithPicks(s0: GameState, name: string, target: ObjectId, picks: string[]): GameState {
  const queue = [...picks];
  const go = (s1: GameState): GameState => {
    let s = s1;
    for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 30; guard++) {
      if (s.pending.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (s.pending.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [obj(target)] });
      else if (s.pending.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [queue.shift() ?? 'add'] });
      else break;
    }
    return s;
  };
  let s = go(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') }));
  for (let guard = 0; s.zones.stack.length > 0 && guard < 30; guard++) s = go(s.pending?.kind === 'priority' ? pass(s) : s);
  return s;
}
const TWEAK = card('Test Tinker Rite', 'Sorcery', 'For each kind of counter on target permanent, put another counter of that kind on it or remove one from it.');
const withCounters = (s: GameState, id: ObjectId, c: Record<string, number>): GameState => ({ ...s, objects: { ...s.objects, [id]: { ...s.objects[id]!, counters: c } } });

describe('CR 122.1, 122.6: for each kind of counter, put another or remove one', () => {
  it('is automated', () => expect(full(TWEAK), JSON.stringify(TWEAK.automation)).toBe(true));
  it('one pick per kind: add to the first kind, remove from the second; a kind with one counter is emptied; other kinds are untouched', () => {
    const s0 = scenario([], { p1: { hand: ['Test Tinker Rite'] }, p2: { battlefield: ['Test Ogre'] }, defs: [TWEAK, OGRE] });
    const ogre = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s1 = withCounters(s0, ogre, { '+1/+1': 2, shield: 1 });
    const kinds = Object.keys(s1.objects[ogre]!.counters);
    const picks = kinds.map((k) => (k === '+1/+1' ? 'add' : 'remove'));
    const s2 = castWithPicks(s1, 'Test Tinker Rite', ogre, picks);
    expect(s2.objects[ogre]!.counters['+1/+1']).toBe(3);
    expect(s2.objects[ogre]!.counters['shield'] ?? 0).toBe(0);
  });
  it('negative: all picks "add" puts exactly one more of every kind, never two', () => {
    const s0 = scenario([], { p1: { hand: ['Test Tinker Rite'] }, p2: { battlefield: ['Test Ogre'] }, defs: [TWEAK, OGRE] });
    const ogre = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s2 = castWithPicks(withCounters(s0, ogre, { '+1/+1': 1, shield: 2 }), 'Test Tinker Rite', ogre, ['add', 'add']);
    expect(s2.objects[ogre]!.counters['+1/+1']).toBe(2);
    expect(s2.objects[ogre]!.counters['shield']).toBe(3);
  });
  it('a permanent with no counters gets nothing and nothing is asked', () => {
    const s0 = scenario([], { p1: { hand: ['Test Tinker Rite'] }, p2: { battlefield: ['Test Ogre'] }, defs: [TWEAK, OGRE] });
    const ogre = find(s0, 'Test Ogre', 'battlefield', 'p2');
    const s2 = castWithPicks(s0, 'Test Tinker Rite', ogre, []);
    expect(Object.values(s2.objects[ogre]!.counters).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
