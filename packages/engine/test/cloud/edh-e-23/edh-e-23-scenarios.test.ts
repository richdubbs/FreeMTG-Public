/**
 * edh-e-23 (Commander coordinator E, group attach): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented names and
 * wordings, design 6.10). CR numbers are checked against the Comprehensive Rules of 2026-09-25 where the session could fetch them; the rest are listed in the round record as unverified.
 *
 *   CR 303.4, 205.3m, 611.2a, 613.1f   "Sacrifice this Aura: Enchanted creature and other creatures that share a creature type with it get +1/+0 and gain first strike until end of turn."
 *   CR 702.16c, 613.1f                 "Enchanted creature gets +1/+1 and has protection from enchantments. This effect doesn't remove this Aura."
 *   CR 303.4, 301.5, 613.2           "Enchant Equipment ... You control enchanted Equipment."
 *   CR 614.12, 614.12a                 "As this enchantment enters, discard your hand." / "As this enchantment enters, sacrifice all lands you control."
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act, answer, castAuto, find, findAll, pass } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { controllerOf, getChars, hasKeyword } from '../../../src/rules/characteristics';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as unknown as Parameters<typeof compileCard>[0]);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));

function settle(s0: GameState): GameState {
  let s = s0;
  for (let guard = 0; guard < 60 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: false });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) {
    s = pass(s);
    for (let g2 = 0; g2 < 20 && s.pending && s.pending.kind !== 'priority'; g2++) s = answer(s, { kind: 'order', ids: (s.pending as { items: { id: string }[] }).items.map((i) => i.id) } as never);
  }
  return s;
}
const pt = (s: GameState, id: ObjectId): string => { const c = getChars(s, id); return `${c.power}/${c.toughness}`; };

// ---- the Crown family ---------------------------------------------------------------------------------------------------------------------------------------------
const CROWN = card('Test Crown', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+0 and has first strike.\nSacrifice this Aura: Enchanted creature and other creatures that share a creature type with it get +1/+0 and gain first strike until end of turn.');
const GOBLIN = card('Test Goblin', 'Creature — Goblin Warrior', '', { pt: ['2', '2'] });
const GOBLIN_B = card('Test Goblin B', 'Creature — Goblin', '', { pt: ['2', '2'] });
const WARRIOR = card('Test Warrior', 'Creature — Human Warrior', '', { pt: ['2', '2'] });
const ELF = card('Test Elf', 'Creature — Elf', '', { pt: ['2', '2'] });

describe('CR 303.4, 205.3m, 611.2a: the Crown family, "Enchanted creature and other creatures that share a creature type with it"', () => {
  const setup = (): { s: GameState; crown: ObjectId } => {
    const s = mpScenario({ players: 3, defs: [CROWN, GOBLIN, GOBLIN_B, WARRIOR, ELF], zones: { p1: { battlefield: ['Test Crown', 'Test Goblin', 'Test Elf'] }, p2: { battlefield: ['Test Goblin B', 'Test Warrior'] } },
      setup: (st) => { st.objects[find(st, 'Test Crown', 'battlefield', 'p1')]!.attachedTo = find(st, 'Test Goblin', 'battlefield', 'p1'); } });
    return { s, crown: find(s, 'Test Crown', 'battlefield', 'p1') };
  };
  it('is automated', () => expect(full(CROWN)).toBe(true));
  it('the enchanted creature and every creature that shares a creature type with it, whoever controls it, get the bonus; one that shares none does not (the negative case)', () => {
    const { s: s0, crown } = setup();
    const s = settle(act(s0, { type: 'activate', player: 'p1', source: crown, ability: 'p:0:2' }));
    expect(s.objects[crown]?.zone === 'battlefield').toBe(false); // sacrificed as the cost
    const id = (n: string, o: PlayerId): ObjectId => find(s, n, 'battlefield', o);
    // Test Goblin (enchanted, +1/+0 from the Aura gone with it), Goblin B (shares Goblin), Warrior (shares Warrior with the enchanted creature), Elf (shares nothing)
    expect([pt(s, id('Test Goblin', 'p1')), pt(s, id('Test Goblin B', 'p2')), pt(s, id('Test Warrior', 'p2')), pt(s, id('Test Elf', 'p1'))]).toEqual(['3/2', '3/2', '3/2', '2/2']);
    expect([id('Test Goblin', 'p1'), id('Test Goblin B', 'p2'), id('Test Warrior', 'p2'), id('Test Elf', 'p1')].map((x) => hasKeyword(getChars(s, x), 'first strike'))).toEqual([true, true, true, false]);
  });
  it('the enchanted creature dying in response: the others that shared a creature type with it as it last existed still get the bonus (CR 608.2h)', () => {
    const { s: s0, crown } = setup();
    const goblin = find(s0, 'Test Goblin', 'battlefield', 'p1');
    let s = act(s0, { type: 'activate', player: 'p1', source: crown, ability: 'p:0:2' });
    s.objects[goblin]!.damage = 99; // dies to state-based actions with the ability on the stack
    s = settle(s);
    expect(pt(s, find(s, 'Test Goblin B', 'battlefield', 'p2'))).toBe('3/2');
    expect(pt(s, find(s, 'Test Elf', 'battlefield', 'p1'))).toBe('2/2');
  });
  it('the effect lasts until end of turn only', () => {
    const { s: s0, crown } = setup();
    let s = settle(act(s0, { type: 'activate', player: 'p1', source: crown, ability: 'p:0:2' }));
    for (let guard = 0; guard < 400 && s.turn.number === s0.turn.number; guard++) {
      s = s.pending?.kind === 'priority' ? pass(s) : s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : settle(s);
    }
    expect(pt(s, find(s, 'Test Goblin B', 'battlefield', 'p2'))).toBe('2/2');
  });
});

// ---- Tattoo Ward ---------------------------------------------------------------------------------------------------------------------------------------------------
const WARD = card('Test Ward', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+1 and has protection from enchantments. This effect doesn\'t remove this Aura.');
describe('CR 702.16c, 613.1f: "Enchanted creature gets +1/+1 and has protection from enchantments. This effect doesn\'t remove this Aura."', () => {
  it('is automated', () => expect(full(WARD)).toBe(true));
  it('the Aura stays on the creature it gives protection from enchantments', () => {
    const s = mpScenario({ players: 3, defs: [WARD, ELF], zones: { p1: { battlefield: ['Test Ward', 'Test Elf'] } },
      setup: (st) => { st.objects[find(st, 'Test Ward', 'battlefield', 'p1')]!.attachedTo = find(st, 'Test Elf', 'battlefield', 'p1'); } });
    const ward = find(s, 'Test Ward', 'battlefield', 'p1');
    const elf = find(s, 'Test Elf', 'battlefield', 'p1');
    const t = settle(s);
    expect(t.objects[ward]!.zone).toBe('battlefield');
    expect(pt(t, elf)).toBe('3/3');
    expect(hasKeyword(getChars(t, elf), 'protection')).toBe(true);
  });
});

// ---- As ~ enters, <instruction> ------------------------------------------------------------------------------------------------------------------------------------
const AWARE = card('Test Awareness', 'Enchantment', 'As this enchantment enters, discard your hand.');
const TERRAIN = card('Test Terrain', 'Enchantment', 'As this enchantment enters, sacrifice all lands you control.');
const FOREST = card('Test Forest', 'Basic Land — Forest', '');
describe('CR 614.12, 614.12a: "As this enchantment enters, discard your hand."', () => {
  it('is automated', () => expect([full(AWARE), full(TERRAIN)]).toEqual([true, true]));
  it('its controller discards their hand; an opponent keeps theirs (the negative case)', () => {
    const s0 = mpScenario({ players: 3, defs: [AWARE, ELF, GOBLIN], zones: { p1: { hand: ['Test Awareness', 'Test Elf', 'Test Elf'] }, p2: { hand: ['Test Goblin', 'Test Goblin'] } } });
    const s = settle(castAuto(s0, 'Test Awareness'));
    expect(find(s, 'Test Awareness', 'battlefield', 'p1')).toBeDefined();
    expect(s.zones.hand['p1']!.length).toBe(0);
    expect(findAll(s, 'Test Elf', 'graveyard', 'p1').length).toBe(2);
    expect(s.zones.hand['p2']!.length).toBe(2);
  });
});
describe('CR 614.12, 614.12a: "As this enchantment enters, sacrifice all lands you control."', () => {
  it('sacrifices every land its controller has; an opponent\'s lands and their own other permanents stay (the negative case)', () => {
    const s0 = mpScenario({ players: 3, defs: [TERRAIN, FOREST, ELF], zones: { p1: { hand: ['Test Terrain'], battlefield: ['Test Forest', 'Test Forest', 'Test Elf'] }, p2: { battlefield: ['Test Forest'] } } });
    const s = settle(castAuto(s0, 'Test Terrain'));
    expect(findAll(s, 'Test Forest', 'battlefield', 'p1').length).toBe(0);
    expect(findAll(s, 'Test Forest', 'graveyard', 'p1').length).toBe(2);
    expect(findAll(s, 'Test Forest', 'battlefield', 'p2').length).toBe(1);
    expect(find(s, 'Test Elf', 'battlefield', 'p1')).toBeDefined();
    expect(find(s, 'Test Terrain', 'battlefield', 'p1')).toBeDefined();
  });
});

// ---- Carry Away ----------------------------------------------------------------------------------------------------------------------------------------------------
const CARRY = card('Test Carry', 'Enchantment — Aura', 'Enchant Equipment\nYou control enchanted Equipment.');
const BLADE = card('Test Blade', 'Artifact — Equipment', 'Equipped creature gets +1/+1.\nEquip {1}');
describe('CR 303.4, 301.5, 613.1b: "Enchant Equipment. You control enchanted Equipment."', () => {
  it('is automated', () => expect(full(CARRY)).toBe(true));
  it('its controller controls the enchanted Equipment; one it does not enchant stays with its controller (the negative case)', () => {
    const s = mpScenario({ players: 3, defs: [CARRY, BLADE], zones: { p1: { battlefield: ['Test Carry'] }, p2: { battlefield: ['Test Blade', 'Test Blade'] } },
      setup: (st) => { st.objects[find(st, 'Test Carry', 'battlefield', 'p1')]!.attachedTo = findAll(st, 'Test Blade', 'battlefield', 'p2')[0]!; } });
    const [a, b] = findAll(s, 'Test Blade', 'battlefield', 'p2');
    expect([controllerOf(s, a!), controllerOf(s, b!)]).toEqual(['p1', 'p2']);
  });
});
