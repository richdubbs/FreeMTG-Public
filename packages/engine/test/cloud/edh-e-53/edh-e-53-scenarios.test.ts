/**
 * Coordinator E, round edh-e-53 (second batch, group attach): the round's readings and engine changes played through the engine with synthetic cards (invented names and wordings,
 * design 6.10), compiled by the game's default compiler. Alice (p1) is the active player of turn 1. Each test names the rule it checks, with its negative case.
 * CR cites checked against the Comprehensive Rules of 2026-09-25.
 *
 *   CR 303.4, 701.13a, 608.2c        "Exile any number of target creatures and all Auras attached to them." (Silence the Believers)
 *   CR 701.21a, 118.3, 303.4         "Sacrifice enchanted creature: ..." as an Aura's cost, "the sacrificed creature's power" (Betrothed of Fire, Bloodfire Infusion)
 *   CR 303.4e, 109.5, 611.3a         "Enchanted creature has <ability> as long as its controller controls no other creatures." (Predator's Gambit)
 *   CR 701.3a-b, 303.4a, 608.2d      "Attach target Aura attached to a creature to another creature." (Crown of the Ages, Kitsune Mystic)
 *   CR 400.3, 303.4                  "Return all Auras attached to target permanent you own to their owners' hands." (Scarab of the Unseen)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type OracleCard } from '../../../src/index';
import { charsOfObject, hasKeyword } from '../../../src/rules/characteristics';
import { act, answer, castAuto, find, findAll, legal, pass, put, scenario } from '../../m3/scenario';
import { inGraveyard, onBattlefield, tweak } from '../../m4/helpers';

function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');

const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const ELF = card('Test Elf', 'Creature — Elf', '', ['1', '1']);
const GIANT = card('Test Giant', 'Creature — Giant', '', ['5', '5']);
const HALO = card('Test Halo', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+1.');
const HALO_MINE = card('Test Halo Mine', 'Enchantment — Aura', 'Enchant creature you control\nEnchanted creature gets +1/+1.');

/** Attach `aura` to `host` in the state (test setup only: the objects are already on the battlefield). */
const attach = (s: GameState, aura: string, host: string): void => { s.objects[aura]!.attachedTo = host; };
const namesIn = (s: GameState, zone: 'exile' | 'battlefield'): string[] => s.zones[zone].map((id) => s.defs[s.objects[id]!.defId]!.name).sort();
const handNames = (s: GameState, p: 'p1' | 'p2'): string[] => s.zones.hand[p]!.map((id) => s.defs[s.objects[id]!.defId]!.name);
const settle = (s: GameState): GameState => tweak(s, (g) => { for (const id of g.zones.battlefield) g.objects[id]!.controlledSinceTurn = -1; });

// ---- Silence the Believers ------------------------------------------------------------------------------------------------------------------------------------------
const CLEANSE = card('Test Cleanse', 'Instant', 'Exile any number of target creatures and all Auras attached to them.');
describe('CR 303.4, 608.2c: "Exile any number of target creatures and all Auras attached to them." (Silence the Believers)', () => {
  it('is automated', () => { expect(full(CLEANSE)).toBe(true); });
  const setup = (): { s: GameState; bear: string; elf: string; giant: string; haloBear: string; haloElf: string; haloGiant: string } => {
    const s0 = scenario([], { p1: { hand: ['Test Cleanse'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Elf', 'Test Giant'] }, defs: [CLEANSE, BEAR, ELF, GIANT, HALO] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const elf = find(s0, 'Test Elf', 'battlefield');
    const giant = find(s0, 'Test Giant', 'battlefield');
    let ids: string[] = [];
    const s = tweak(s0, (g) => { ids = [put(g, 'p1', 'battlefield', 'Test Halo'), put(g, 'p2', 'battlefield', 'Test Halo'), put(g, 'p2', 'battlefield', 'Test Halo')]; attach(g, ids[0]!, bear); attach(g, ids[1]!, elf); attach(g, ids[2]!, giant); });
    return { s, bear, elf, giant, haloBear: ids[0]!, haloElf: ids[1]!, haloGiant: ids[2]! };
  };
  const cast = (s: GameState, targets: string[]): GameState => {
    const t = castAuto(s, 'Test Cleanse', { answers: [{ kind: 'chooseTargets', targets: targets.map((id) => ({ kind: 'object', id })) } as never] });
    return pass(pass(t)); // both pass: the spell resolves
  };
  it('exiles each targeted creature and every Aura attached to any of them (an Aura of another player too), and leaves the Aura on a creature that was not targeted', () => {
    const { s, bear, elf } = setup();
    const t = cast(s, [bear, elf]);
    expect(namesIn(t, 'exile'), 'both targets and the Auras attached to them (the Aura of another player too) are exiled').toEqual(['Test Bear', 'Test Elf', 'Test Halo', 'Test Halo']);
    expect(namesIn(t, 'battlefield'), 'the creature that was not targeted stays, with the Aura attached to it').toEqual(['Test Giant', 'Test Halo']);
    expect(t.objects[t.zones.battlefield.find((id) => t.defs[t.objects[id]!.defId]!.name === 'Test Halo')!]!.attachedTo).toBe(t.zones.battlefield.find((id) => t.defs[t.objects[id]!.defId]!.name === 'Test Giant'));
  });
  it('negative: with no target nothing is exiled (any number includes none), and an Aura attached to something else is never exiled', () => {
    const { s } = setup();
    const t = cast(s, []);
    expect(namesIn(t, 'exile')).toEqual([]);
    expect(namesIn(t, 'battlefield').length).toBe(6);
  });
});

// ---- Betrothed of Fire / Bloodfire Infusion --------------------------------------------------------------------------------------------------------------------------
const FRENZY = card('Test Frenzy', 'Enchantment — Aura', 'Enchant creature\nSacrifice enchanted creature: Creatures you control get +2/+0 until end of turn.');
const PYRE = card('Test Pyre', 'Enchantment — Aura', "Enchant creature you control\nSacrifice enchanted creature: ~ deals damage equal to the sacrificed creature's power to each creature.");
/** Put the Aura `aura` of `owner` on the battlefield attached to `host`. */
const withAura = (s: GameState, owner: 'p1' | 'p2', aura: string, host: string): { s: GameState; id: string } => {
  let id = '';
  const t = tweak(s, (g) => { id = put(g, owner, 'battlefield', aura); attach(g, id, host); });
  return { s: t, id };
};
/** Activate the first ability of the permanent `source` for `player`, pay what it asks automatically, and let it resolve. */
function activate(s: GameState, player: 'p1' | 'p2', source: string): GameState {
  const a = legal(s, player, 'activate').find((l) => l.action.type === 'activate' && l.action.source === source);
  expect(a, 'the activation is offered').toBeDefined();
  let t = act(s, a!.action);
  for (let i = 0; i < 6 && t.pending && t.pending.kind !== 'priority'; i++) t = t.pending.kind === 'payCost' ? answer(t, { kind: 'payCost', auto: true }) : answer(t, { kind: t.pending.kind, auto: true } as never);
  return pass(pass(t));
}
describe('CR 701.21a, 118.3, 303.4: "Sacrifice enchanted creature: ..." (Betrothed of Fire, Bloodfire Infusion)', () => {
  it('are automated', () => { expect(full(FRENZY)).toBe(true); expect(full(PYRE)).toBe(true); });
  it('the cost sacrifices the creature the Aura is attached to: "the sacrificed creature\'s power" is its power as it last existed (5), dealt to each creature (not to the sacrificed one, which is gone)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Giant', 'Test Elf'] }, p2: { battlefield: ['Test Bear'] }, defs: [BEAR, ELF, GIANT, PYRE] });
    const { s, id } = withAura(settle(s0), 'p1', 'Test Pyre', find(s0, 'Test Giant', 'battlefield'));
    const t = activate(s, 'p1', id);
    expect(inGraveyard(t, 'Test Giant', 'p1'), 'the enchanted creature was sacrificed').toBe(true);
    expect(inGraveyard(t, 'Test Elf', 'p1') && inGraveyard(t, 'Test Bear', 'p2'), 'each other creature took 5 damage').toBe(true);
    expect(inGraveyard(t, 'Test Pyre', 'p1'), 'the Aura went to the graveyard with its creature').toBe(true);
  });
  it('sacrificing the enchanted creature as the cost gives your remaining creatures +2/+0 until end of turn (the Elf is 3/1)', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear', 'Test Elf'] }, defs: [BEAR, ELF, FRENZY] });
    const { s, id } = withAura(settle(s0), 'p1', 'Test Frenzy', find(s0, 'Test Bear', 'battlefield'));
    const t = activate(s, 'p1', id);
    expect(inGraveyard(t, 'Test Bear', 'p1')).toBe(true);
    expect(charsOfObject(t, t.objects[find(t, 'Test Elf', 'battlefield')]!).power).toBe('3');
  });
  it('negative: an Aura on a creature its controller does not control cannot be activated (a player sacrifices only a permanent they control, CR 701.21a)', () => {
    const s0 = scenario([], { p2: { battlefield: ['Test Bear'] }, p1: { battlefield: ['Test Elf'] }, defs: [BEAR, ELF, FRENZY] });
    const { s, id } = withAura(settle(s0), 'p1', 'Test Frenzy', find(s0, 'Test Bear', 'battlefield'));
    expect(legal(s, 'p1', 'activate').some((l) => l.action.type === 'activate' && l.action.source === id), 'p1 cannot pay: the Bear is p2\'s').toBe(false);
    expect(legal(s, 'p2', 'activate').some((l) => l.action.type === 'activate' && l.action.source === id), 'p2 does not control the Aura').toBe(false);
    expect(onBattlefield(s, 'Test Bear', 'p2')).toBe(true);
  });
});

// ---- Predator's Gambit -----------------------------------------------------------------------------------------------------------------------------------------------
const GAMBIT = card('Test Gambit', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +2/+1.\nEnchanted creature has shroud as long as its controller controls no other creatures.');
describe('CR 303.4e, 109.5, 611.3a: "Enchanted creature has <ability> as long as its controller controls no other creatures." (Predator\'s Gambit)', () => {
  it('is automated', () => { expect(full(GAMBIT)).toBe(true); });
  const shroud = (s: GameState, id: string): boolean => hasKeyword(charsOfObject(s, s.objects[id]!), 'shroud');
  it('the enchanted creature has the ability while its controller controls no other creature, and loses it when another creature of that controller arrives', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear'] }, defs: [BEAR, ELF, GAMBIT] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const { s } = withAura(settle(s0), 'p1', 'Test Gambit', bear);
    expect(shroud(s, bear), 'alone').toBe(true);
    const t = tweak(s, (g) => { put(g, 'p1', 'battlefield', 'Test Elf'); });
    expect(shroud(t, bear), 'with another creature of its controller').toBe(false);
  });
  it('negative: the condition is about the controller of the ENCHANTED creature: an Aura of yours on an opponent\'s lone creature gives it the ability, and your own creatures do not count', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Elf'] }, p2: { battlefield: ['Test Bear'] }, defs: [BEAR, ELF, GIANT, GAMBIT] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const { s } = withAura(settle(s0), 'p1', 'Test Gambit', bear);
    expect(shroud(s, bear), 'p2 controls no other creature: p1\'s Elf does not count').toBe(true);
    const t = tweak(s, (g) => { put(g, 'p2', 'battlefield', 'Test Giant'); });
    expect(shroud(t, bear), 'p2 controls another creature').toBe(false);
  });
  it('negative: the Aura itself is not a creature and the enchanted creature is not "another" creature', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear'] }, defs: [BEAR, GAMBIT] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const { s } = withAura(settle(s0), 'p1', 'Test Gambit', bear);
    expect(charsOfObject(s, s.objects[bear]!).power).toBe('4');
    expect(shroud(s, bear)).toBe(true);
  });
});

// ---- Crown of the Ages / Kitsune Mystic -----------------------------------------------------------------------------------------------------------------------------
const CROWN = card('Test Circlet', 'Artifact', '{T}: Attach target Aura attached to a creature to another creature.');
describe('CR 701.3a-b, 303.4a, 608.2d: "Attach target Aura attached to a creature to another creature." (Crown of the Ages, Kitsune Mystic)', () => {
  it('is automated', () => { expect(full(CROWN)).toBe(true); });
  /** Activate the Circlet targeting `aura`; stop at the choice of the creature (returned with its options) or at the end if the engine asks for none. */
  function start(s: GameState, aura: string): { t: GameState; options: string[] | null } {
    const circlet = find(s, 'Test Circlet', 'battlefield');
    const a = legal(s, 'p1', 'activate').find((l) => l.action.type === 'activate' && l.action.source === circlet);
    expect(a, 'the activation is offered').toBeDefined();
    let t = act(s, a!.action);
    expect(t.pending?.kind).toBe('chooseTargets');
    t = answer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: aura }] } as never);
    for (let i = 0; i < 4 && t.pending && t.pending.kind === 'payCost'; i++) t = answer(t, { kind: 'payCost', auto: true });
    t = pass(pass(t));
    const p = t.pending;
    return { t, options: p && p.kind === 'chooseObjects' ? [...(p as unknown as { options: string[] }).options] : null };
  }
  const setup = (opts: { aura?: string; p2?: string[] } = {}): { s: GameState; bear: string; elf: string; aura: string } => {
    const s0 = scenario([], { p1: { battlefield: ['Test Circlet', 'Test Bear', 'Test Elf'] }, p2: { battlefield: opts.p2 ?? ['Test Giant'] }, defs: [CROWN, BEAR, ELF, GIANT, HALO, HALO_MINE] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const { s, id } = withAura(settle(s0), 'p1', opts.aura ?? 'Test Halo', bear);
    return { s, bear, elf: find(s0, 'Test Elf', 'battlefield'), aura: id };
  };
  it('the Aura is the only target; as the ability resolves its controller chooses among the creatures OTHER than the one it is attached to, and the Aura moves there', () => {
    const { s, bear, elf, aura } = setup();
    const { t, options } = start(s, aura);
    expect(options, 'a choice is offered').not.toBeNull();
    expect(options!.includes(bear), 'the creature it is attached to is not "another creature"').toBe(false);
    expect(options!.includes(elf) && options!.length === 2, 'the Elf and the opponent\'s Giant (the Aura could enchant it; it is not targeted)').toBe(true);
    const u = answer(t, { kind: 'chooseObjects', ids: [elf] });
    expect(u.objects[aura]!.attachedTo).toBe(elf);
    expect(onBattlefield(u, 'Test Halo', 'p1')).toBe(true);
  });
  it('negative: an Aura that can enchant only a creature you control is never moved to an opponent\'s creature (the engine offers only creatures it could enchant)', () => {
    const { s, elf, aura } = setup({ aura: 'Test Halo Mine' });
    const { t, options } = start(s, aura);
    expect(options, 'a single candidate (the Elf) is no choice: the Giant is not a creature this Aura could enchant, the Bear is where it is').toBeNull();
    expect(t.objects[aura]!.attachedTo).toBe(elf);
  });
  it('negative: with no other creature the Aura could enchant nothing is chosen and it stays where it is', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Circlet', 'Test Bear'] }, defs: [CROWN, BEAR, HALO] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const { s, id } = withAura(settle(s0), 'p1', 'Test Halo', bear);
    const { t, options } = start(s, id);
    expect(options === null || options.length === 0).toBe(true);
    expect(t.objects[id]!.attachedTo).toBe(bear);
  });
  it('negative: only an Aura attached to a creature is a legal target (an Aura on nothing, an Equipment, a creature are not)', () => {
    const { s, elf, bear } = setup();
    const circlet = find(s, 'Test Circlet', 'battlefield');
    const a = legal(s, 'p1', 'activate').find((l) => l.action.type === 'activate' && l.action.source === circlet);
    const t = act(s, a!.action);
    const objects = (t.pending as unknown as { objects: string[] }).objects;
    expect(objects.includes(elf) || objects.includes(bear), 'no creature is a target').toBe(false);
    expect(objects.length).toBe(1);
  });
});

// ---- Scarab of the Unseen -------------------------------------------------------------------------------------------------------------------------------------------
const SCARAB = card('Test Scarab', 'Artifact', "{T}, Sacrifice ~: Return all Auras attached to target permanent you own to their owners' hands.");
describe('CR 400.3, 303.4, 608.2c: "Return all Auras attached to target permanent you own to their owners\' hands." (Scarab of the Unseen)', () => {
  it('is automated', () => { expect(full(SCARAB)).toBe(true); });
  it('every Aura attached to the permanent, whoever controls it, goes to its owner\'s hand; an Aura attached to another permanent stays', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Scarab', 'Test Bear', 'Test Elf'] }, p2: { battlefield: [] }, defs: [SCARAB, BEAR, ELF, HALO] });
    const bear = find(s0, 'Test Bear', 'battlefield');
    const elf = find(s0, 'Test Elf', 'battlefield');
    let a1 = '', a2 = '', a3 = '';
    const s = tweak(settle(s0), (g) => { a1 = put(g, 'p1', 'battlefield', 'Test Halo'); a2 = put(g, 'p2', 'battlefield', 'Test Halo'); a3 = put(g, 'p1', 'battlefield', 'Test Halo'); attach(g, a1, bear); attach(g, a2, bear); attach(g, a3, elf); });
    const scarab = find(s, 'Test Scarab', 'battlefield');
    const a = legal(s, 'p1', 'activate').find((l) => l.action.type === 'activate' && l.action.source === scarab);
    let t = act(s, a!.action);
    t = answer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: bear }] } as never);
    for (let i = 0; i < 4 && t.pending && t.pending.kind === 'payCost'; i++) t = answer(t, { kind: 'payCost', auto: true });
    t = pass(pass(t));
    expect(handNames(t, 'p1').filter((n) => n === 'Test Halo').length, 'p1\'s Aura is back in p1\'s hand').toBe(1);
    expect(handNames(t, 'p2').filter((n) => n === 'Test Halo').length, 'p2\'s Aura is back in p2\'s hand').toBe(1);
    expect(namesIn(t, 'battlefield'), 'the Aura on the Elf stays').toEqual(['Test Bear', 'Test Elf', 'Test Halo']);
    expect(t.objects[t.zones.battlefield.find((id) => t.defs[t.objects[id]!.defId]!.name === 'Test Halo')!]!.attachedTo).toBe(elf);
  });
});
