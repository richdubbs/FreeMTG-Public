/**
 * Commander coordinator E, round edh-e-19 (group combat 1/2): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (wordings invented, design 6.10), each with its negative case.
 *
 *   CR 509.3c, 509.3d, 603.2c  "Whenever ~ blocks or becomes blocked by one or more Orcs, ~ gets +0/+2 until end of turn." (parser/holes/event.ts, render/evt.ts)
 *   CR 508.1c, 509.1b, 611.2a  "{X}, {T}: Each creature with mana value X can't attack or block this turn." (eff.edhe19.objs.cantAttackOrBlock)
 */
import { describe, expect, it } from 'vitest';
import { legalActions, type GameState, type ObjectId } from '../../../src/index';
import { act, answer, scenario } from '../../m3/scenario';
import { card, full, pt, resolveAll, settle } from '../cmd3/helpers';

const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const on = (s: GameState, name: string): ObjectId => s.zones.battlefield.find((id) => nameOf(s, id) === name)!;

describe('CR 509.3c, 603.2c: "Whenever ~ blocks or becomes blocked by one or more Orcs, ~ gets +0/+2 until end of turn." (Dwarven Soldier)', () => {
  const DWARF = card('Test Dwarf', 'Creature — Dwarf', 'Whenever Test Dwarf blocks or becomes blocked by one or more Orcs, Test Dwarf gets +0/+2 until end of turn.', ['2', '1']);
  const ORC = card('Test Orc', 'Creature — Orc', '', ['1', '1']);
  const ORC2 = card('Test Orc Two', 'Creature — Orc', '', ['1', '1']);
  const ELF = card('Test Elf', 'Creature — Elf', '', ['1', '1']);
  const D = [DWARF, ORC, ORC2, ELF];
  const toBlock = (s0: GameState, attackers: string[]): GameState => {
    let s = s0;
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareAttackers'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    s = resolveAll(answer(s, { kind: 'declareAttackers', attacks: attackers.map((n) => ({ attacker: on(s, n), defender: 'p2' })) }));
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareBlockers'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    return s;
  };
  it('is full', () => expect(full(DWARF)).toBe(true));
  it('blocked by two Orcs it triggers ONCE (one declaration): +0/+2, not +0/+4', () => {
    let s = toBlock(scenario([], { defs: D, p1: { battlefield: ['Test Dwarf'] }, p2: { battlefield: ['Test Orc', 'Test Orc Two'] } }), ['Test Dwarf']);
    s = settle(answer(s, { kind: 'declareBlockers', blocks: [{ blocker: on(s, 'Test Orc'), attacker: on(s, 'Test Dwarf') }, { blocker: on(s, 'Test Orc Two'), attacker: on(s, 'Test Dwarf') }] }));
    expect(s.zones.stack.length).toBe(1);
    s = resolveAll(s);
    expect(pt(s, on(s, 'Test Dwarf'))).toBe('2/3');
  });
  it('when it blocks an attacking Orc it triggers too', () => {
    let s = toBlock(scenario([], { defs: D, p1: { battlefield: ['Test Orc'] }, p2: { battlefield: ['Test Dwarf'] } }), ['Test Orc']);
    s = settle(answer(s, { kind: 'declareBlockers', blocks: [{ blocker: on(s, 'Test Dwarf'), attacker: on(s, 'Test Orc') }] }));
    expect(s.zones.stack.length).toBe(1);
    expect(pt(resolveAll(s), on(s, 'Test Dwarf'))).toBe('2/3');
  });
  it('negative: blocked by a creature that is not an Orc, or blocking one, never triggers', () => {
    let s = toBlock(scenario([], { defs: D, p1: { battlefield: ['Test Dwarf'] }, p2: { battlefield: ['Test Elf'] } }), ['Test Dwarf']);
    s = settle(answer(s, { kind: 'declareBlockers', blocks: [{ blocker: on(s, 'Test Elf'), attacker: on(s, 'Test Dwarf') }] }));
    expect(s.zones.stack.length).toBe(0);
    let t = toBlock(scenario([], { defs: D, p1: { battlefield: ['Test Elf'] }, p2: { battlefield: ['Test Dwarf'] } }), ['Test Elf']);
    t = settle(answer(t, { kind: 'declareBlockers', blocks: [{ blocker: on(t, 'Test Dwarf'), attacker: on(t, 'Test Elf') }] }));
    expect(t.zones.stack.length).toBe(0);
  });
});

describe('CR 508.1c, 509.1b, 611.2a: "{X}, {T}: Each creature with mana value X can\'t attack or block this turn." (Droning Bureaucrats)', () => {
  const CLERK = card('Test Clerk', 'Creature — Human Advisor', '{X}, {T}: Each creature with mana value X can\'t attack or block this turn.', ['1', '1']);
  const TWO = card('Test Two Drop', 'Creature — Bear', '', ['2', '2'], '{1}{G}');
  const THREE = card('Test Three Drop', 'Creature — Bear', '', ['3', '3'], '{2}{G}');
  const FOREST = card('Forest', 'Basic Land — Forest', '{T}: Add {G}.');
  it('is full', () => expect(full(CLERK)).toBe(true));
  it('X=2 stops the two-drop from attacking this turn, not the three-drop (and a creature that is not restricted attacks normally)', () => {
    const run = (attacker: string): { error?: string } => {
      let s = scenario([], { defs: [CLERK, TWO, THREE, FOREST], p1: { battlefield: ['Test Clerk', 'Test Two Drop', 'Test Three Drop', 'Forest', 'Forest'] } });
      const a = legalActions(s, 'p1').find((x) => x.kind === 'activate' && x.object !== undefined && nameOf(s, x.object) === 'Test Clerk')!.action;
      s = act(s, a);
      if (s.pending?.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: 2 });
      s = resolveAll(settle(s));
      for (let i = 0; i < 40 && s.pending?.kind !== 'declareAttackers'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
      try { answer(s, { kind: 'declareAttackers', attacks: [{ attacker: on(s, attacker), defender: 'p2' }] }); return {}; } catch (e) { return { error: (e as Error).message }; }
    };
    expect(run('Test Two Drop').error).toMatch(/attack/i);
    expect(run('Test Three Drop').error).toBeUndefined();
  });
});

describe('CR 508.1d, 508.1b, 500.1: "During target player\'s next turn, creatures that player controls attack you if able." (Taunt)', () => {
  const TAUNT = card('Test Taunt', 'Sorcery', "During target player's next turn, creatures that player controls attack you if able.");
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const toTheirAttack = (): GameState => {
    let s = scenario([], { defs: [TAUNT, BEAR], p1: { hand: ['Test Taunt'] }, p2: { battlefield: ['Test Bear'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: s.zones.hand.p1!.find((id) => nameOf(s, id) === 'Test Taunt')! }), { targets: [{ kind: 'player', id: 'p2' }] }), { targets: [{ kind: 'player', id: 'p2' }] });
    for (let i = 0; i < 80 && !(s.pending?.kind === 'declareAttackers' && s.pending.player === 'p2'); i++) s = s.pending?.kind === 'priority' ? act(s, { type: 'pass', player: s.pending.player }) : settle(s);
    return s;
  };
  it('is full', () => expect(full(TAUNT)).toBe(true));
  it('on the target player\'s next turn, not attacking is refused and attacking the caster is accepted (the effect ends after that turn)', () => {
    const s = toTheirAttack();
    expect(s.pending?.kind).toBe('declareAttackers');
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [] })).toThrow();
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [{ attacker: on(s, 'Test Bear'), defender: 'p1' }] })).not.toThrow();
  });
  it('negative: the caster\'s own creatures are not forced to attack on the caster\'s turn', () => {
    let s = scenario([], { defs: [TAUNT, BEAR], p1: { hand: ['Test Taunt'], battlefield: ['Test Bear'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: s.zones.hand.p1!.find((id) => nameOf(s, id) === 'Test Taunt')! }), { targets: [{ kind: 'player', id: 'p2' }] }), { targets: [{ kind: 'player', id: 'p2' }] });
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareAttackers'; i++) s = s.pending?.kind === 'priority' ? act(s, { type: 'pass', player: s.pending.player }) : settle(s);
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [] })).not.toThrow();
  });
});
