/**
 * Commander coordinator E, round edh-e-12 (group tokens): the round's readings played through the engine with synthetic cards (invented names, design 6.10).
 * Alice (p1) is the active player of turn 1. CR cites not checked against the rules text in this session unless the record says so.
 *
 *   CR 701.3a, 303.4, 603.2      "Whenever an Aura becomes attached to this creature, create a 1/1 ... token." (Brood Keeper, Bramble Elemental)
 *   CR 614.12, 607.2d, 111.1     "As this enters, choose a color and a creature type." + "Create a 2/2 creature token of the chosen color and type." (Volrath's Laboratory, Riptide Replicator)
 */
import { describe, expect, it } from 'vitest';
import { getChars, type GameState, type PlayerId } from '../../../src/index';
import { answer } from '../../m3/scenario';
import { act, activations, card, cast, drive, find, full, resolveAll, scenario, passBoth, obj } from '../r3-cost/support';

/** Answers a color and a creature-type name when asked, then the rest by the default script. */
function settle(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 30 && s.pending && s.pending.kind !== 'priority'; i++) {
    const p = s.pending;
    if (p.kind === 'chooseName') s = answer(s, { kind: 'chooseName', name: 'Goblin' });
    else if (p.kind === 'chooseColor') s = answer(s, { kind: 'chooseColor', color: 'U' });
    else s = drive(s);
  }
  return s;
}
function settleAll(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 12 && s.zones.stack.length > 0; i++) s = settle(passBoth(s));
  return s;
}
const bf = (s: GameState, p: PlayerId): string[] => s.zones.battlefield.filter((id) => s.objects[id]!.controller === p).map((id) => getChars(s, id).name).sort();

describe('"Whenever an Aura becomes attached to this creature, create a 1/1 green Saproling creature token." (CR 701.3a, 603.2)', () => {
  const KEEPER = card('Test Keeper', 'Creature — Elf', 'Whenever an Aura becomes attached to this creature, create a 1/1 green Saproling creature token.', '{0}', ['2', '2']);
  const OTHER = card('Test Other', 'Creature — Elf', '', '{0}', ['1', '1']);
  const AURA = card('Test Aura', 'Enchantment — Aura', 'Enchant creature', '{0}');
  const defs = [KEEPER, OTHER, AURA];
  const start = () => scenario([], { p1: { hand: ['Test Aura'], battlefield: ['Test Keeper', 'Test Other'] }, p2: {}, defs });
  it('has no manual part', () => expect(full(KEEPER)).toBe(true));
  it('an Aura put onto the Keeper makes the token', () => {
    const s0 = start();
    const keeper = find(s0, 'Test Keeper', 'battlefield', 'p1');
    const s = resolveAll(cast(s0, 'Test Aura', { targets: [[obj(keeper)]] }));
    expect(bf(s, 'p1').filter((n) => n.includes('Saproling'))).toHaveLength(1);
  });
  it('the negative case: an Aura put onto another creature makes nothing', () => {
    const s0 = start();
    const other = find(s0, 'Test Other', 'battlefield', 'p1');
    const s = resolveAll(cast(s0, 'Test Aura', { targets: [[obj(other)]] }));
    expect(bf(s, 'p1').filter((n) => n.includes('Saproling'))).toHaveLength(0);
  });
});

describe('"As this enters, choose a color and a creature type." / "Create a 2/2 creature token of the chosen color and type." (CR 614.12, 607.2d)', () => {
  const LAB = card('Test Lab', 'Artifact', 'As this artifact enters, choose a color and a creature type.\n{0}, {T}: Create a 2/2 creature token of the chosen color and type.');
  const defs = [LAB];
  it('has no manual part', () => expect(full(LAB)).toBe(true));
  it('the token has the chosen color and type', () => {
    let s = scenario([], { p1: { hand: ['Test Lab'] }, p2: {}, defs });
    s = settle(cast(s, 'Test Lab'));
    s = settleAll(s);
        s = settle(act(s, activations(s, 'Test Lab')[0]!.action));
    s = settleAll(s);
    const tok = s.zones.battlefield.find((id) => s.objects[id]!.kind === 'token')!;
    const c = getChars(s, tok);
    expect(c.colors).toEqual(['U']);
    expect(c.types).toContain('Creature');
    expect(c.power).toBe('2');
    expect(c.subtypes).toEqual(['Goblin']);
  });
});

describe('a token of the chosen color and type when nothing was chosen (review: Sarpadian Empires, a copy)', () => {
  const SARP = card('Test Sarp', 'Artifact', 'As this artifact enters, choose white Citizen, blue Camarid, or black Thrull.\n{0}, {T}: Create a 1/1 creature token of the chosen color and type.');
  it('the ability is not silently nothing: it is settled by hand, so the card is not fully automated', () => {
    expect(full(SARP)).toBe(false);
  });
});
