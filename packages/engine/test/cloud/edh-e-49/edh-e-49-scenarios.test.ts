/**
 * Commander coordinator E, round edh-e-49 (group combat 1/2, second batch): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (wordings invented, design 6.10), each with its negative case.
 *
 *   CR 508.1h-j, 118.3   "Green creatures can't attack unless their controller sacrifices a land of their choice for each green creature they control that's attacking." (sta.edhe49.attackTax.sacrificeLand)
 *   CR 506.2, 510.2      "Whenever enchanted creature deals combat damage to defending player, you may destroy target artifact that player controls." (toDefendingPlayer)
 *   CR 508.1d, 303.4     "All creatures attack enchanted creature's controller each combat if able." (sta.edhe49.aura.allAttackControllerOfEnchanted)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { act, answer, put, scenario } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { card, full, resolveAll, settle } from '../cmd3/helpers';
import { declareAttackers, toDeclareAttackers, tweak } from '../../m4/helpers';

const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const on = (s: GameState, name: string): ObjectId => s.zones.battlefield.find((id) => nameOf(s, id) === name)!;
const onAll = (s: GameState, name: string): ObjectId[] => s.zones.battlefield.filter((id) => nameOf(s, id) === name);
const colored = (name: string, type: string, text: string, color: string, pt: [string, string] = ['2', '2']): CardDef =>
  compileCard({ name, layout: 'normal', mana_cost: `{1}{${color}}`, type_line: type, oracle_text: text, colors: [color], power: pt[0], toughness: pt[1] } as OracleCard);
const FOREST = card('Forest', 'Basic Land — Forest', '{T}: Add {G}.');

describe('CR 508.1h-j, 118.3: "Green creatures can\'t attack unless their controller sacrifices a land of their choice for each green creature they control that\'s attacking." (Flooded Woodlands, Reclamation)', () => {
  const TAX = card('Test Woodlands', 'Enchantment', "Green creatures can't attack unless their controller sacrifices a land of their choice for each green creature they control that's attacking.");
  const BEAR = colored('Test Green Bear', 'Creature — Bear', '', 'G');
  const BEAR2 = colored('Test Green Bear Two', 'Creature — Bear', '', 'G');
  const RED = colored('Test Red Goblin', 'Creature — Goblin', '', 'R');
  const D = [TAX, BEAR, BEAR2, RED, FOREST];
  const board = (): GameState => scenario([], { defs: D, p1: { battlefield: ['Test Green Bear', 'Test Green Bear Two', 'Test Red Goblin', 'Forest', 'Forest', 'Forest'] }, p2: { battlefield: ['Test Woodlands'] } });
  const forests = (s: GameState): number => onAll(s, 'Forest').length;

  it('is full', () => expect(full(TAX)).toBe(true));
  it('one green attacker costs one land: the controller pays it, sacrificing a land of their choice, and the creature attacks', () => {
    let s = toDeclareAttackers(board());
    s = declareAttackers(s, [[on(s, 'Test Green Bear')]]);
    s = settle(s);
    expect(forests(s)).toBe(2);
    expect(s.combat?.attackers.map((a) => a.id)).toContain(on(s, 'Test Green Bear'));
  });
  it('two green attackers cost two lands (one for each)', () => {
    let s = toDeclareAttackers(board());
    s = declareAttackers(s, [[on(s, 'Test Green Bear')], [on(s, 'Test Green Bear Two')]]);
    s = settle(s);
    expect(forests(s)).toBe(1);
    expect(s.combat?.attackers.length).toBe(2);
  });
  it('negative: a creature that is not green attacks for free', () => {
    let s = toDeclareAttackers(board());
    s = declareAttackers(s, [[on(s, 'Test Red Goblin')]]);
    s = settle(s);
    expect(forests(s)).toBe(3);
    expect(s.combat?.attackers.length).toBe(1);
  });
  it('negative: with fewer lands than green attackers the declaration is refused (the cost can not be paid, CR 118.3)', () => {
    let s = scenario([], { defs: D, p1: { battlefield: ['Test Green Bear', 'Test Green Bear Two', 'Forest'] }, p2: { battlefield: ['Test Woodlands'] } });
    s = toDeclareAttackers(s);
    expect(() => declareAttackers(s, [[on(s, 'Test Green Bear')], [on(s, 'Test Green Bear Two')]])).toThrow();
  });
  it('negative: the player may decline to pay: no land is sacrificed and nobody attacks', () => {
    let s = toDeclareAttackers(board());
    s = declareAttackers(s, [[on(s, 'Test Green Bear')]]);
    s = settle(s, { yes: false });
    expect(forests(s)).toBe(3);
  });
});

describe('CR 506.2, 510.2: "Whenever enchanted creature deals combat damage to defending player, you may destroy target artifact that player controls." (Latulla\'s Orders)', () => {
  const AURA = card('Test Orders', 'Enchantment — Aura', 'Enchant creature\nWhenever enchanted creature deals combat damage to defending player, you may destroy target artifact that player controls.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const WALL = card('Test Wall', 'Creature — Wall', '', ['0', '4']);
  const ROCK = card('Test Rock', 'Artifact', '');
  const D = [AURA, BEAR, WALL, ROCK];
  const start = (): GameState => {
    const s0 = scenario([], { defs: D, p1: { battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Rock', 'Test Wall'] } });
    return tweak(s0, (t) => { t.objects[put(t, 'p1', 'battlefield', 'Test Orders')]!.attachedTo = on(s0, 'Test Bear'); });
  };
  const attack = (s0: GameState, block: boolean): GameState => {
    let s = declareAttackers(toDeclareAttackers(s0), [[on(s0, 'Test Bear')]]);
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareBlockers' && s.turn.step !== 'combatDamage'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: block ? [{ blocker: on(s, 'Test Wall'), attacker: on(s, 'Test Bear') }] : [] });
    for (let i = 0; i < 40 && s.turn.step !== 'combatDamage'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    return s;
  };
  const finish = (s0: GameState): GameState => {
    let s = s0;
    const rock = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Rock');
    for (let i = 0; i < 20 && s.turn.step === 'combatDamage' && s.pending !== null; i++) {
      const d = s.pending;
      if (d.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: rock ? [{ kind: 'object', id: rock }] : [] });
      else if (d.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
      else if (d.kind === 'priority') s = act(s, { type: 'pass', player: d.player });
      else break;
    }
    return s;
  };
  it('is full', () => expect(full(AURA)).toBe(true));
  it('unblocked: the Aura\'s controller may destroy an artifact the defending player controls', () => {
    const s = finish(attack(start(), false));
    expect(onAll(s, 'Test Rock').length).toBe(0);
  });
  it('negative: blocked, the creature deals its combat damage to the blocker and not to the player: no trigger, the artifact stays', () => {
    const s = finish(attack(start(), true));
    expect(onAll(s, 'Test Rock').length).toBe(1);
  });
});

describe('CR 508.1d, 303.4: "All creatures attack enchanted creature\'s controller each combat if able." (Public Enemy)', () => {
  const AURA = card('Test Enemy', 'Enchantment — Aura', "Enchant creature\nAll creatures attack enchanted creature's controller each combat if able.");
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const start = (): GameState => mpScenario({
    defs: [AURA, BEAR], players: 3,
    zones: { p1: { battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Bear'] }, p3: { battlefield: ['Test Bear'] } },
  });
  const withAura = (s0: GameState): GameState => tweak(s0, (t) => { t.objects[put(t, 'p3', 'battlefield', 'Test Enemy')]!.attachedTo = s0.zones.battlefield.find((id) => s0.objects[id]!.controller === 'p2' && nameOf(s0, id) === 'Test Bear')!; });
  const own = (s: GameState, p: string): ObjectId => s.zones.battlefield.find((id) => s.objects[id]!.controller === p && nameOf(s, id) === 'Test Bear')!;
  const tryAttack = (s0: GameState, attacks: { attacker: ObjectId; defender: string }[]): string | undefined => {
    let s = s0;
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareAttackers'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    try { answer(s, { kind: 'declareAttackers', attacks }); return undefined; } catch (e) { return (e as Error).message; }
  };
  it('is full', () => expect(full(AURA)).toBe(true));
  it('p1\'s creature must attack p2 (the enchanted creature\'s controller): attacking nobody or p3 is refused, attacking p2 is accepted', () => {
    const s = withAura(start());
    expect(tryAttack(s, [])).toMatch(/attack/i);
    expect(tryAttack(s, [{ attacker: own(s, 'p1'), defender: 'p3' }])).toMatch(/attack/i);
    expect(tryAttack(s, [{ attacker: own(s, 'p1'), defender: 'p2' }])).toBeUndefined();
  });
  it('negative: without the Aura nothing is required', () => {
    const s = start();
    expect(tryAttack(s, [])).toBeUndefined();
  });
});

describe('CR 609.4, 702.28b: "This creature can block creatures with shadow as though it had shadow." (Wall of Diffusion)', () => {
  const WALL = card('Test Diffuse Wall', 'Creature — Wall', 'Defender\nThis creature can block creatures with shadow as though it had shadow.', ['0', '5']);
  const PLAIN = card('Test Plain Wall', 'Creature — Wall', 'Defender', ['0', '5']);
  const SHADE = card('Test Shade', 'Creature — Spirit', 'Shadow', ['2', '2']);
  const run = (blocker: string): string | undefined => {
    let s = scenario([], { defs: [WALL, PLAIN, SHADE], p1: { battlefield: ['Test Shade'] }, p2: { battlefield: [blocker] } });
    s = declareAttackers(toDeclareAttackers(s), [[on(s, 'Test Shade')]]);
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareBlockers' && s.turn.step !== 'combatDamage'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    if (s.pending?.kind !== 'declareBlockers') return 'no creature may block (shadow)';
    try { answer(s, { kind: 'declareBlockers', blocks: [{ blocker: on(s, blocker), attacker: on(s, 'Test Shade') }] }); return undefined; } catch (e) { return (e as Error).message; }
  };
  it('is full', () => expect(full(WALL)).toBe(true));
  it('the Wall may block a creature with shadow', () => expect(run('Test Diffuse Wall')).toBeUndefined());
  it('negative: a creature without the ability may not block a creature with shadow (CR 702.28b)', () => expect(run('Test Plain Wall')).toMatch(/shadow/i));
});
