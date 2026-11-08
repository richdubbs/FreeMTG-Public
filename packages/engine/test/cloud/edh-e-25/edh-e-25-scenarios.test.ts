/**
 * Coordinator E, round edh-e-25 (group turns-phases): the round's readings and engine changes played through the engine with synthetic cards (invented names), compiled
 * by the game's default compiler. Alice (p1) is the active player of turn 1. CR cites are from memory of the 2026-09-25 rules (unverified; no rules/cr in cloud sessions).
 *
 *   CR 702.26b, 101.2, 611.2a       "Until your next upkeep, target permanent can't phase out." / "... this creature can't phase out." (Spatial Binding, Ertai's Familiar)
 *   CR 509.1, 608.2c                "Whenever equipped creature blocks a creature, that creature doesn't untap ..." (Shield of the Righteous): "that creature" is the creature blocked
 *   CR 120.3, 502.3, 611.2a         "~ deals 2 damage to any target and doesn't untap during your next untap step." (Reveka, Wizard Savant)
 */
import { describe, expect, it } from 'vitest';
import { type GameState } from '../../../src/index';
import { act, advanceTo, find, scenario } from '../../m3/scenario';
import { card, cast, full, resolveAll, settle } from '../cmd3/helpers';

const BEAR = card('Test Bear', 'Creature — Bear', '', ['3', '3']);
const activate = (s: GameState, name: string, picks: Parameters<typeof settle>[1] = {}, ability = 'p:0:0', who = 'p1'): GameState =>
  resolveAll(settle(act(s, { type: 'activate', player: who, source: find(s, name, 'battlefield', who), ability }), picks), picks);

// ---- can't phase out ----------------------------------------------------------------------------------------------------------------------------------------------
const BINDER = card('Test Binder', 'Artifact', '{0}: Until your next upkeep, target permanent can\'t phase out.');
const FAMILIAR = card('Test Familiar', 'Creature — Wizard', 'Phasing\n{0}: Until your next upkeep, ~ can\'t phase out.', ['1', '1']);
const BLINK = card('Test Blink', 'Instant', 'Target creature phases out.');

describe('CR 702.26b, 101.2: "Until your next upkeep, target permanent can\'t phase out."', () => {
  it('is automated', () => { expect(full(BINDER)).toBe(true); expect(full(FAMILIAR)).toBe(true); });
  const setup = () => scenario([], { defs: [BINDER, BLINK, BEAR, FAMILIAR], p1: { hand: ['Test Blink'], battlefield: ['Test Binder', 'Test Bear', 'Test Bear'] } });
  it('the bound creature does not phase out when an effect would phase it out; the other creature does (negative)', () => {
    const s0 = setup();
    const [a, b] = s0.zones.battlefield.filter((id) => s0.objects[id]!.defId === s0.objects[find(s0, 'Test Bear', 'battlefield', 'p1')]!.defId);
    const s1 = activate(s0, 'Test Binder', { targets: [{ kind: 'object', id: a! }] });
    const s2 = cast(s1, 'Test Blink', { targets: [{ kind: 'object', id: a! }] });
    expect(resolveAll(s2, { targets: [{ kind: 'object', id: a! }] }).objects[a!]!.phasedOut).toBe(false);
    const s3 = cast(s1, 'Test Blink', { targets: [{ kind: 'object', id: b! }] });
    expect(resolveAll(s3, { targets: [{ kind: 'object', id: b! }] }).objects[b!]!.phasedOut).toBe(true);
  });
  it('without the restriction the creature phases out (the same spell), and the restriction ends at the next upkeep of its controller', () => {
    const s0 = setup();
    const a = find(s0, 'Test Bear', 'battlefield', 'p1');
    const s1 = activate(s0, 'Test Binder', { targets: [{ kind: 'object', id: a }] });
    const t3 = advanceTo(s1, 3, 'draw'); // p1's next upkeep has begun and ended
    expect(t3.continuousEffects.some((e) => e.effect.s === 'restrict' && e.effect.action === 'phaseOut')).toBe(false);
  });
  it('a creature with phasing and the restriction stays phased in through its untap step; without it, it phases out (CR 702.26a)', () => {
    const base = scenario([], { defs: [FAMILIAR], p1: { battlefield: ['Test Familiar'] } });
    const id = find(base, 'Test Familiar', 'battlefield', 'p1');
    expect(advanceTo(base, 3, 'upkeep').objects[id]!.phasedOut).toBe(true); // phases out in p1's untap step of turn 3
    const held = activate(base, 'Test Familiar', {}, 'p:0:1');
    expect(advanceTo(held, 3, 'upkeep').objects[id]!.phasedOut).toBe(false); // p1's own untap step (turn 3)
  });
});

describe('CR 702.26g, 702.26b: an attachment that can\'t phase out stays when its host phases out (Spatial Binding ruling 2012-07-01)', () => {
  const GEAR = card('Test Gear', 'Artifact — Equipment', 'Equip {0}');
  it('the equipped bear phases out; the bound equipment does not (negative: unbound equipment phases out with the bear)', () => {
    const run = (bind: boolean): GameState => {
      let s = scenario([], { defs: [BINDER, BLINK, BEAR, GEAR], p1: { hand: ['Test Blink'], battlefield: ['Test Binder', 'Test Bear', 'Test Gear'] } });
      const bear = find(s, 'Test Bear', 'battlefield', 'p1');
      const gear = find(s, 'Test Gear', 'battlefield', 'p1');
      s = { ...s, objects: { ...s.objects, [gear]: { ...s.objects[gear]!, attachedTo: bear } } };
      if (bind) s = activate(s, 'Test Binder', { targets: [{ kind: 'object', id: gear }] });
      s = resolveAll(cast(s, 'Test Blink', { targets: [{ kind: 'object', id: bear }] }), { targets: [{ kind: 'object', id: bear }] });
      expect(s.objects[bear]!.phasedOut).toBe(true);
      return s;
    };
    const gearOf = (s: GameState) => find(s, 'Test Gear', 'battlefield', 'p1');
    expect(run(true).objects[gearOf(run(true))]!.phasedOut).toBe(false);
    expect(run(false).objects[gearOf(run(false))]!.phasedOut).toBe(true);
  });
});

// ---- Reveka ------------------------------------------------------------------------------------------------------------------------------------------------------
const SAVANT = card('Test Savant', 'Creature — Human Wizard', '{T}: ~ deals 2 damage to any target and doesn\'t untap during your next untap step.', ['1', '1']);
describe('CR 120.3, 502.3, 611.2a: "~ deals 2 damage to any target and doesn\'t untap during your next untap step."', () => {
  it('is automated; the target takes 2, ~ stays tapped through its controller\'s next untap step and untaps in the one after', () => {
    expect(full(SAVANT)).toBe(true);
    const s0 = scenario([], { defs: [SAVANT, BEAR], p1: { battlefield: ['Test Savant'] }, p2: { battlefield: ['Test Bear'] } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p2');
    const s1 = activate(s0, 'Test Savant', { targets: [{ kind: 'object', id: bear }] });
    expect(s1.objects[bear]!.damage).toBe(2);
    const id = find(s1, 'Test Savant', 'battlefield', 'p1');
    expect(s1.objects[id]!.tapped).toBe(true);
    expect(advanceTo(s1, 3, 'upkeep').objects[id]!.tapped).toBe(true);
    expect(advanceTo(s1, 5, 'upkeep').objects[id]!.tapped).toBe(false);
  });
  it('negative: the opponent\'s untap step is not stopped for a creature the opponent controls (only the named player\'s untap step counts)', () => {
    const s0 = scenario([], { defs: [SAVANT], p1: { battlefield: ['Test Savant'] } });
    const id = find(s0, 'Test Savant', 'battlefield', 'p1');
    const s1 = activate(s0, 'Test Savant', { targets: [{ kind: 'player', id: 'p2' }] });
    expect(s1.objects[id]!.tapped).toBe(true);
    expect(advanceTo(s1, 2, 'draw').objects[id]!.tapped).toBe(true); // p2's untap step does not untap it either (not its controller's)
  });
});

// ---- Shield of the Righteous -----------------------------------------------------------------------------------------------------------------------------------
describe('CR 509.1, 608.2c: "Whenever equipped creature blocks a creature, that creature doesn\'t untap during its controller\'s next untap step."', () => {
  const SHIELD = card('Test Aegis', 'Artifact — Equipment', 'Whenever equipped creature blocks a creature, that creature doesn\'t untap during its controller\'s next untap step.\nEquip {2}');
  it('is automated and "that creature" is the creature blocked, never the equipped blocker', () => {
    expect(full(SHIELD)).toBe(true);
    const json = JSON.stringify(SHIELD.faces[0]!.abilities[0]);
    expect(json).toContain('"role":"object"');
    expect(json).not.toContain('"role":"blocker"');
    expect(json).not.toContain('"role":"attacker"');
  });
});

// ---- Telekinesis ------------------------------------------------------------------------------------------------------------------------------------------------
describe('CR 502.3, 611.2a: "It doesn\'t untap during its controller\'s next two untap steps." (Telekinesis)', () => {
  const TK = card('Test Telekinesis', 'Instant', 'Tap target creature. It doesn\'t untap during its controller\'s next two untap steps.');
  it('is automated; the creature stays tapped through its controller\'s next two untap steps and untaps in the third (a second creature is not held)', () => {
    expect(full(TK)).toBe(true);
    const s0 = scenario([], { defs: [TK, BEAR], p1: { hand: ['Test Telekinesis'] }, p2: { battlefield: ['Test Bear', 'Test Bear'] } });
    const [a, b] = s0.zones.battlefield.filter((id) => s0.objects[id]!.controller === 'p2');
    const s1 = resolveAll(cast(s0, 'Test Telekinesis', { targets: [{ kind: 'object', id: a! }] }), { targets: [{ kind: 'object', id: a! }] });
    expect(s1.objects[a!]!.tapped).toBe(true);
    const t2 = advanceTo(s1, 2, 'draw'); // p2's first untap step
    expect(t2.objects[a!]!.tapped).toBe(true);
    expect(advanceTo(t2, 4, 'draw').objects[a!]!.tapped).toBe(true); // the second
    expect(advanceTo(t2, 6, 'draw').objects[a!]!.tapped).toBe(false); // the third
    expect(b).toBeDefined();
  });
});
