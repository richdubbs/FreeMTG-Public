/**
 * edh-e-14 (Commander coordinator E, group counters 2/3): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented
 * names and wordings, design 6.10). Each test is named after the rule it checks, with its negative case. CR cites are from the Comprehensive Rules 2026-09-25; the cites of this round
 * were checked against the real text by grep where the session could fetch it, the rest are listed as unverified in the record.
 *
 *   CR 702.33d, 702.33e, 614.1c  "~ enters with a +1/+1 counter on ~ for each time ~ was kicked."
 *   CR 604.1, 613.4c, 122.1      "All creatures get +1/+0 for each time counter on ~."
 *   CR 701.6a, 113.7a, 602.5     "Counter target activated ability from an artifact, creature, enchantment, or land. That permanent's activated abilities can't be activated this turn."
 *   CR 508.1, 509.1, 506.1       "At end of combat, if ~ attacked or blocked this combat, put a velocity counter on it."
 *   CR 122.1, 608.2d             "Put up to X +1/+0 counters on ~. This ability can't cause the total number of +1/+0 counters on ~ to be greater than four."
 *   CR 119.4, 118.3, 602.2b      "Pay 3 life for each velocity counter on ~"
 */
import { describe, expect, it } from 'vitest';
import { applyAction, compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type TargetChoice } from '../../../src/index';
import { act, find, scenario } from '../../m3/scenario';
import { answer } from '../../m12/rules/helpers';
import { declareAttackers, declareBlockers, toDeclareAttackers, toDeclareBlockers, toStep } from '../../m4/helpers';
import { counters, full, named, pt, resolveAll, settle, type Picks } from '../cmd3/helpers';

const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
const player = (id: string): TargetChoice => ({ kind: 'player', id });
function mk(name: string, type: string, text: string, p?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], ...(p ? { power: p[0], toughness: p[1] } : {}) } as OracleCard);
}
const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;

const KICKER = mk('Test Kicker', 'Creature — Soldier', 'Multikicker {B}\nTest Kicker enters with a +1/+1 counter on Test Kicker for each time Test Kicker was kicked.', ['1', '1'], '{B}');
const HOURGLASS = mk('Test Hourglass', 'Artifact', 'All creatures get +1/+0 for each time counter on Test Hourglass.');
const BEAR = mk('Test Bear', 'Creature — Bear', '', ['2', '2']);
const PINGER = mk('Test Pinger', 'Creature — Wizard', '{0}: Test Pinger deals 1 damage to target player.', ['1', '1']);
const STIFLE = mk('Test Stifle', 'Instant', "Counter target activated ability from an artifact, creature, enchantment, or land. That permanent's activated abilities can't be activated this turn.");
const WALKER = mk('Test Walker', 'Artifact Creature — Construct', 'At end of combat, if Test Walker attacked or blocked this combat, put a velocity counter on it.', ['1', '3']);
const CLOCK = mk('Test Clock', 'Artifact Creature — Construct', '{X}, {T}: Put up to X +1/+0 counters on Test Clock. This ability can\'t cause the total number of +1/+0 counters on Test Clock to be greater than four.', ['0', '4']);
const WHIRL = mk('Test Whirl', 'Enchantment', '{0}, Pay 3 life for each velocity counter on Test Whirl: Draw a card and put a velocity counter on Test Whirl.');
const DOUBLER = mk('Test Doubler', 'Enchantment', 'If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.');
const CYCLER = mk('Test Cycler', 'Creature — Bear', 'Cycling {0}', ['2', '2']);
const DEFS: CardDef[] = [DOUBLER, CYCLER, KICKER, HOURGLASS, BEAR, PINGER, STIFLE, WALKER, CLOCK, WHIRL];

describe('the synthetic cards are automated', () => {
  it('every synthetic card plays fully', () => {
    for (const d of DEFS) expect(full(d), `${d.name}: ${JSON.stringify(d.automation)}`).toBe(true);
  });
});

describe('CR 702.33d, 702.33e: "~ enters with a +1/+1 counter on ~ for each time ~ was kicked."', () => {
  function play(kicks: number): GameState {
    let s = scenario(['Swamp'], { p1: { hand: ['Test Kicker'], battlefield: ['Swamp', 'Swamp', 'Swamp'] }, defs: DEFS });
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Kicker', 'hand') });
    for (let g = 0; g < 12 && s.pending && s.pending.kind !== 'priority'; g++) {
      const d = s.pending;
      if (d.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: kicks });
      else s = settle(s);
    }
    return resolveAll(s);
  }
  it('kicked twice: it enters with two +1/+1 counters', () => {
    const s = play(2);
    expect(counters(s, named(s, 'Test Kicker')[0]!, '+1/+1')).toBe(2);
  });
  it('not kicked (negative): it enters with none', () => {
    const s = play(0);
    expect(counters(s, named(s, 'Test Kicker')[0]!, '+1/+1')).toBe(0);
  });
});

describe('CR 604.1, 613.4c, 122.1: "All creatures get +1/+0 for each time counter on ~."', () => {
  const play = (n: number): GameState => scenario([], { p1: { battlefield: [{ name: 'Test Hourglass', counters: { time: n } }, 'Test Bear'] }, p2: { battlefield: ['Test Bear'] }, defs: DEFS });
  it('three time counters: every creature, whoever controls it, gets +3/+0', () => {
    const s = play(3);
    for (const id of named(s, 'Test Bear')) expect(pt(s, id)).toBe('5/2');
  });
  it('no counters (negative): no change', () => {
    const s = play(0);
    for (const id of named(s, 'Test Bear')) expect(pt(s, id)).toBe('2/2');
  });
  it('a counter of another kind (negative) does not count', () => {
    const s = scenario([], { p1: { battlefield: [{ name: 'Test Hourglass', counters: { charge: 3 } }, 'Test Bear'] }, defs: DEFS });
    expect(pt(s, named(s, 'Test Bear')[0]!)).toBe('2/2');
  });
});

describe('CR 701.6a, 113.7a, 602.5: "Counter target activated ability from an artifact, creature, enchantment, or land. That permanent\'s activated abilities can\'t be activated this turn."', () => {
  function respond(counter: boolean): GameState {
    let s = scenario([], { p1: { hand: ['Test Stifle'], battlefield: ['Test Pinger'] }, defs: DEFS });
    const pinger = named(s, 'Test Pinger')[0]!;
    s = act(s, { type: 'activate', player: 'p1', source: pinger, ability: 'p:0:0' });
    if (s.pending?.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [player('p2')] });
    if (counter) {
      const ability = s.zones.stack.find((id) => s.objects[id]!.kind === 'ability')!;
      s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Stifle', 'hand') });
      if (s.pending?.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [obj(ability)] });
    }
    return resolveAll(s);
  }
  it('the ability is countered (p2 keeps their life) and the creature cannot activate again this turn', () => {
    const s = respond(true);
    expect(life(s, 'p2')).toBe(20);
    const pinger = named(s, 'Test Pinger')[0]!;
    const r = applyAction(s, { type: 'activate', player: 'p1', source: pinger, ability: 'p:0:0' });
    expect(r.error, 'activating again is refused').toBeDefined();
  });
  it('negative: without the counterspell the ability resolves (1 damage) and can be activated again', () => {
    const s = respond(false);
    expect(life(s, 'p2')).toBe(19);
    const pinger = named(s, 'Test Pinger')[0]!;
    expect(applyAction(s, { type: 'activate', player: 'p1', source: pinger, ability: 'p:0:0' }).error).toBeUndefined();
  });
});

describe('CR 508.1, 509.1, 506.1: "At end of combat, if ~ attacked or blocked this combat, put a velocity counter on it."', () => {
  it('an attacker gets a velocity counter at end of combat', () => {
    let s = scenario([], { p1: { battlefield: ['Test Walker'] }, defs: DEFS });
    const id = named(s, 'Test Walker')[0]!;
    s = toDeclareAttackers(s);
    s = declareAttackers(s, [[id]]);
    s = toStep(s, 'endCombat');
    s = resolveAll(s);
    expect(counters(s, id, 'velocity')).toBe(1);
  });
  it('a blocker gets one too', () => {
    let s = scenario([], { p1: { battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Walker'] }, defs: DEFS });
    const bear = named(s, 'Test Bear')[0]!;
    const walker = named(s, 'Test Walker')[0]!;
    s = toDeclareAttackers(s);
    s = declareAttackers(s, [[bear]]);
    s = toDeclareBlockers(s);
    s = declareBlockers(s, [[walker, bear]]);
    s = toStep(s, 'endCombat');
    s = resolveAll(s);
    expect(counters(s, walker, 'velocity')).toBe(1);
  });
  it('negative: a creature that neither attacked nor blocked gets none', () => {
    let s = scenario([], { p1: { battlefield: ['Test Walker', 'Test Bear'] }, defs: DEFS });
    const walker = named(s, 'Test Walker')[0]!;
    const bear = named(s, 'Test Bear')[0]!;
    s = toDeclareAttackers(s);
    s = declareAttackers(s, [[bear]]);
    s = toStep(s, 'endCombat');
    s = resolveAll(s);
    expect(counters(s, walker, 'velocity')).toBe(0);
  });
});

describe('CR 122.1, 608.2d: "Put up to X +1/+0 counters on ~. This ability can\'t cause the total number of +1/+0 counters on ~ to be greater than four."', () => {
  function activate(have: number, x: number, pick: number): GameState {
    let s = scenario([], { p1: { battlefield: [{ name: 'Test Clock', counters: { '+1/+0': have }, since: 0 }, 'Plains', 'Plains', 'Plains', 'Plains'] }, defs: DEFS });
    const clock = named(s, 'Test Clock')[0]!;
    s = act(s, { type: 'activate', player: 'p1', source: clock, ability: 'p:0:0' });
    for (let g = 0; g < 40; g++) {
      const d = s.pending;
      if (d === undefined || d === null) break;
      if (d.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: /Put how many/.test(d.prompt) ? Math.min(pick, d.max) : x });
      else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (d.kind === 'priority' && s.zones.stack.length > 0) s = act(s, { type: 'pass', player: d.player });
      else if (d.kind === 'priority') break;
      else s = settle(s);
    }
    return s;
  }
  it('three on it, X = 3, choosing all: only one fits, so the total is four', () => {
    const s = activate(3, 3, 3);
    expect(counters(s, named(s, 'Test Clock')[0]!, '+1/+0')).toBe(4);
  });
  it('none on it, X = 2: two are put (the cap is not reached)', () => {
    const s = activate(0, 2, 2);
    expect(counters(s, named(s, 'Test Clock')[0]!, '+1/+0')).toBe(2);
  });
  it('negative: four on it already: none are put and it stays at four', () => {
    const s = activate(4, 2, 2);
    expect(counters(s, named(s, 'Test Clock')[0]!, '+1/+0')).toBe(4);
  });
});

describe('CR 122.1, 614.1 (Clockwork Avian ruling 2004-10-04): the limit holds after a replacement doubles the counters', () => {
  it('three on it, X = 1, with a doubling effect: still at most four', () => {
    let s = scenario([], { p1: { battlefield: [{ name: 'Test Clock', counters: { '+1/+0': 3 }, since: 0 }, 'Test Doubler', 'Plains', 'Plains'] }, defs: DEFS });
    s = act(s, { type: 'activate', player: 'p1', source: named(s, 'Test Clock')[0]!, ability: 'p:0:0' });
    for (let g = 0; g < 40; g++) {
      const d = s.pending;
      if (d === undefined || d === null) break;
      if (d.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: /Put how many/.test(d.prompt) ? d.max : 1 });
      else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (d.kind === 'priority' && s.zones.stack.length > 0) s = act(s, { type: 'pass', player: d.player });
      else if (d.kind === 'priority') break;
      else s = settle(s);
    }
    expect(counters(s, named(s, 'Test Clock')[0]!, '+1/+0')).toBeLessThanOrEqual(4);
  });
});

describe('CR 109.2, 701.6a: Interdict names permanents, not cards in hand', () => {
  it('negative: a cycling ability (its source is a card in a hand) is no legal target', () => {
    let s = scenario([], { p1: { hand: ['Test Cycler', 'Test Stifle'] }, defs: DEFS });
    s = act(s, { type: 'activate', player: 'p1', source: find(s, 'Test Cycler', 'hand'), ability: 'k:0:0:0' });
    const r = applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Stifle', 'hand') });
    const ability = s.zones.stack.find((id) => s.objects[id]!.kind === 'ability');
    let legal = false;
    if (!r.error && r.state.pending?.kind === 'chooseTargets') legal = JSON.stringify(r.state.pending).includes(String(ability));
    expect(legal).toBe(false);
  });
});

describe('CR 119.4, 118.3, 602.2b: "Pay 3 life for each velocity counter on ~"', () => {
  function run(have: number): GameState {
    let s = scenario([], { p1: { battlefield: [{ name: 'Test Whirl', counters: { velocity: have } }] }, defs: DEFS });
    const whirl = named(s, 'Test Whirl')[0]!;
    s = act(s, { type: 'activate', player: 'p1', source: whirl, ability: 'p:0:0' });
    return resolveAll(s);
  }
  it('two counters: six life are paid, and a third counter is put', () => {
    const s = run(2);
    expect(life(s, 'p1')).toBe(14);
    expect(counters(s, named(s, 'Test Whirl')[0]!, 'velocity')).toBe(3);
  });
  it('no counters (negative): no life is paid', () => {
    const s = run(0);
    expect(life(s, 'p1')).toBe(20);
    expect(counters(s, named(s, 'Test Whirl')[0]!, 'velocity')).toBe(1);
  });
  it('not enough life (negative): with 5 life and two counters (six needed) the activation is refused', () => {
    let s = scenario([], { p1: { battlefield: [{ name: 'Test Whirl', counters: { velocity: 2 } }] }, defs: DEFS, life: 5 });
    const whirl = named(s, 'Test Whirl')[0]!;
    const r = applyAction(s, { type: 'activate', player: 'p1', source: whirl, ability: 'p:0:0' });
    expect(r.error).toBeDefined();
    s = r.state;
  });
});
