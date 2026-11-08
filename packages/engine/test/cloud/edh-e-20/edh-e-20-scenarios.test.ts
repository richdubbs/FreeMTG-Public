/**
 * Commander coordinator E, round edh-e-20 (group combat 2/2): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's default
 * compiler. Each group has its negative cases. CR cites are from the Comprehensive Rules text of 2026-09-25 (media.wizards.com); cites not checked against the text are listed in the record.
 *
 *   CR 509.1g-h, 506.4, 700.4     "all creatures that blocked ~ this turn" / "destroy it and all creatures it blocked this turn" / "creature that blocked or was blocked by a legendary creature this turn"
 *   CR 510.1, 603.10a, 700.4       "it deals 6 damage to each creature it blocked this combat"
 *   CR 400.3, 603.7, 511.1         "return it and this Aura to their owners' hands at end of combat"
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { advanceTo, answer, find, findAll, pass, scenario } from '../../m3/scenario';
import { tweak } from '../../m4/helpers';
import { attackWith, card, cast, full, resolveAll, settle } from '../cmd3/helpers';

const BEAR = card('Test Combat Bear', 'Creature — Bear', '', ['1', '4']); // survives combat damage, so only the ability under test can remove it
const LEGEND = card('Test Legend Bear', 'Legendary Creature — Bear', '', ['1', '4']);
const alive = (s: GameState, id: ObjectId): boolean => s.zones.battlefield.includes(id);
const onField = (s: GameState, name: string, p: string): number => findAll(s, name, 'battlefield', p).length;

/** Declare `blocks` (blocker, attacker) when asked and play the combat to its end (the end of combat step's triggers are put on the stack and resolved). */
function combat(s0: GameState, attackers: ObjectId[], blocks: { blocker: ObjectId; attacker: ObjectId }[]): GameState {
  let s = attackWith(s0, attackers);
  for (let guard = 0; guard < 60 && s.turn.step !== 'main2' && !(s.turn.step === 'endCombat' && s.zones.stack.length === 0 && s.pending?.kind === 'priority'); guard++) {
    if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks });
    else if (s.pending?.kind === 'assignDamage' || s.pending?.kind === 'chooseObjects' || s.pending?.kind === 'order') s = settle(s);
    else s = pass(s);
  }
  return s;
}
const finish = (s0: GameState): GameState => {
  let s = s0;
  for (let guard = 0; guard < 40 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); guard++) s = s.pending && s.pending.kind !== 'priority' ? settle(s) : pass(s);
  return s;
};

describe('CR 509.1g-h, 506.4: "At end of combat, tap all creatures that blocked this creature this turn. They don\'t untap during their controller\'s next untap step."', () => {
  const FERRET = card('Test Ferret Tapper', 'Creature — Ferret', "At end of combat, tap all creatures that blocked this creature this turn. They don't untap during their controller's next untap step.", ['1', '4']);
  const start = (): GameState => scenario([], { defs: [FERRET, BEAR], p1: { battlefield: ['Test Ferret Tapper', 'Test Combat Bear'] }, p2: { battlefield: ['Test Combat Bear', 'Test Combat Bear'] } });
  it('is full', () => expect(full(FERRET)).toBe(true));
  it('taps only the creature that blocked it, and that creature skips its controller\'s next untap step', () => {
    const s0 = start();
    const [ferret] = findAll(s0, 'Test Ferret Tapper', 'battlefield', 'p1');
    const [bear] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const [a, b] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p2');
    let s = finish(combat(s0, [ferret!, bear!], [{ blocker: a!, attacker: ferret! }, { blocker: b!, attacker: bear! }]));
    expect(s.objects[a!]!.tapped).toBe(true); // it blocked the ferret
    expect(s.objects[b!]!.tapped).toBe(false); // it blocked another creature
    s = advanceTo(s, 2, 'upkeep'); // the untap step of the blocker's controller has passed
    expect(s.objects[a!]!.tapped).toBe(true);
    s = advanceTo(s, 4, 'upkeep');
    expect(s.objects[a!]!.tapped).toBe(false);
  });
  it('negative: with no block nothing is tapped', () => {
    const s0 = start();
    const [ferret] = findAll(s0, 'Test Ferret Tapper', 'battlefield', 'p1');
    const s = finish(combat(s0, [ferret!], []));
    for (const id of findAll(s, 'Test Combat Bear', 'battlefield', 'p2')) expect(s.objects[id]!.tapped).toBe(false);
  });
});

describe('CR 509.1g-h, 506.4: "When this creature blocks, at end of combat, destroy it and all creatures it blocked this turn."', () => {
  const GUARD = card('Test Vanguard Wall', 'Creature — Wall', 'When this creature blocks, at end of combat, destroy it and all creatures it blocked this turn.', ['1', '4']);
  const start = (): GameState => scenario([], { defs: [GUARD, BEAR], p1: { battlefield: ['Test Combat Bear', 'Test Combat Bear'] }, p2: { battlefield: ['Test Vanguard Wall', 'Test Combat Bear'] } });
  it('is full', () => expect(full(GUARD)).toBe(true));
  it('destroys itself and the creature it blocked, not the other attacker or the other blocker', () => {
    const s0 = start();
    const [x, y] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const [wall] = findAll(s0, 'Test Vanguard Wall', 'battlefield', 'p2');
    const [c] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p2');
    const s = finish(combat(s0, [x!, y!], [{ blocker: wall!, attacker: x! }, { blocker: c!, attacker: y! }]));
    expect(onField(s, 'Test Vanguard Wall', 'p2')).toBe(0);
    expect(alive(s, x!)).toBe(false); // the one it blocked
    expect(alive(s, y!)).toBe(true); // blocked by another creature
    expect(alive(s, c!)).toBe(true);
  });
  it('CR 608.2h: when the Vanguard itself is destroyed in combat, the creature it blocked is still destroyed at end of combat', () => {
    const FRAIL = card('Test Frail Vanguard', 'Creature — Wall', 'When this creature blocks, at end of combat, destroy it and all creatures it blocked this turn.', ['1', '1']);
    const s0 = scenario([], { defs: [FRAIL, BEAR], p1: { battlefield: ['Test Combat Bear'] }, p2: { battlefield: ['Test Frail Vanguard'] } });
    const [x] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const [wall] = findAll(s0, 'Test Frail Vanguard', 'battlefield', 'p2');
    const s = finish(combat(s0, [x!], [{ blocker: wall!, attacker: x! }]));
    expect(onField(s, 'Test Frail Vanguard', 'p2')).toBe(0);
    expect(alive(s, x!)).toBe(false);
  });
  it('negative: when it does not block, nothing happens (the trigger needs a block)', () => {
    const s0 = start();
    const [x] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const s = finish(combat(s0, [x!], []));
    expect(onField(s, 'Test Vanguard Wall', 'p2')).toBe(1);
    expect(alive(s, x!)).toBe(true);
  });
});

describe('CR 509.1h, 506.4: "Destroy target creature that blocked or was blocked by a legendary creature this turn."', () => {
  const PATH = card('Test Narrow Path', 'Instant', 'Destroy target creature that blocked or was blocked by a legendary creature this turn.');
  const start = (): GameState => scenario([], { defs: [PATH, BEAR, LEGEND], p1: { battlefield: ['Test Legend Bear', 'Test Combat Bear'], hand: ['Test Narrow Path'] }, p2: { battlefield: ['Test Combat Bear', 'Test Combat Bear'] } });
  function played(): { s: GameState; legend: ObjectId; bear: ObjectId; x: ObjectId; y: ObjectId } {
    const s0 = start();
    const [legend] = findAll(s0, 'Test Legend Bear', 'battlefield', 'p1');
    const [bear] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const [x, y] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p2');
    const s = finish(combat(s0, [legend!, bear!], [{ blocker: x!, attacker: legend! }, { blocker: y!, attacker: bear! }]));
    return { s, legend: legend!, bear: bear!, x: x!, y: y! };
  }
  it('is full', () => expect(full(PATH)).toBe(true));
  it('destroys the creature that blocked the legendary creature', () => {
    const { s, x } = played();
    const t = resolveAll(cast(s, 'Test Narrow Path', { targets: [{ kind: 'object', id: x }] }), { targets: [{ kind: 'object', id: x }] });
    expect(alive(t, x)).toBe(false);
  });
  it('ruling 2023-06-16: the legendary creature only had to be legendary when it blocked or was blocked; once it has left the battlefield the other creature is still a legal target', () => {
    const { s, legend, x } = played();
    const gone = tweak(s, (t) => { t.zones.battlefield = t.zones.battlefield.filter((i) => i !== legend); delete t.objects[legend]; });
    const t = resolveAll(cast(gone, 'Test Narrow Path', { targets: [{ kind: 'object', id: x }] }), { targets: [{ kind: 'object', id: x }] });
    expect(alive(t, x)).toBe(false);
  });
  it('negative: a creature that blocked a non-legendary creature is not a legal target, and neither is the legendary creature blocked by a non-legendary one', () => {
    const { s, y, legend } = played();
    for (const bad of [y, legend]) {
      let threw = false;
      let t = s;
      try { t = resolveAll(cast(s, 'Test Narrow Path', { targets: [{ kind: 'object', id: bad }] }), { targets: [{ kind: 'object', id: bad }] }); } catch { threw = true; }
      expect(threw || alive(t, bad)).toBe(true);
    }
  });
});

describe('CR 510.1, 603.10a: "When this creature dies during combat, it deals 6 damage to each creature it blocked this combat."', () => {
  const WALL = card('Test Falling Wall', 'Creature — Wall', 'When this creature dies during combat, it deals 6 damage to each creature it blocked this combat.', ['1', '1']);
  const BIG = card('Test Big Bear', 'Creature — Bear', '', ['3', '6']);
  const start = (): GameState => scenario([], { defs: [WALL, BIG], p1: { battlefield: ['Test Big Bear', 'Test Big Bear'] }, p2: { battlefield: ['Test Falling Wall'] } });
  it('is full', () => expect(full(WALL)).toBe(true));
  it('deals 6 damage to the creature it blocked after it died, not to the unblocked attacker', () => {
    const s0 = start();
    const [x, y] = findAll(s0, 'Test Big Bear', 'battlefield', 'p1');
    const [wall] = findAll(s0, 'Test Falling Wall', 'battlefield', 'p2');
    const s = finish(combat(s0, [x!, y!], [{ blocker: wall!, attacker: x! }]));
    expect(onField(s, 'Test Falling Wall', 'p2')).toBe(0);
    expect(alive(s, x!)).toBe(false); // 1 combat damage + 6 from the trigger on 6 toughness
    expect(alive(s, y!)).toBe(true);
  });
});

describe('CR 400.3, 603.7: "Whenever equipped creature attacks, return it and this Equipment to their owners\' hands at end of combat." (the union of two objects)', () => {
  const GEAR = card('Test Fleeting Gear', 'Artifact — Equipment', "Whenever equipped creature attacks, return it and this Equipment to their owners' hands at end of combat.");
  const start = (): GameState => {
    const s = scenario([], { defs: [GEAR, BEAR], p1: { battlefield: ['Test Fleeting Gear', 'Test Combat Bear', 'Test Combat Bear'] }, p2: { battlefield: [] } });
    return tweak(s, (x) => { x.objects[find(x, 'Test Fleeting Gear', 'battlefield', 'p1')]!.attachedTo = findAll(x, 'Test Combat Bear', 'battlefield', 'p1')[0]!; });
  };
  it('is full', () => expect(full(GEAR)).toBe(true));
  it('returns the equipped creature and the Equipment at end of combat, not the other attacker', () => {
    const s0 = start();
    const [equipped, other] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const s = finish(combat(s0, [equipped!, other!], []));
    expect(onField(s, 'Test Fleeting Gear', 'p1')).toBe(0);
    expect(findAll(s, 'Test Fleeting Gear', 'hand', 'p1').length).toBe(1);
    expect(findAll(s, 'Test Combat Bear', 'hand', 'p1').length).toBe(1);
    expect(alive(s, other!)).toBe(true);
  });
  it('negative: the unequipped creature attacking alone triggers nothing', () => {
    const s0 = start();
    const [, other] = findAll(s0, 'Test Combat Bear', 'battlefield', 'p1');
    const s = finish(combat(s0, [other!], []));
    expect(onField(s, 'Test Fleeting Gear', 'p1')).toBe(1);
    expect(onField(s, 'Test Combat Bear', 'p1')).toBe(2);
  });
});
