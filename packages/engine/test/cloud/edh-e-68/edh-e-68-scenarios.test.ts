/**
 * edh-e-68 (Commander coordinator E, groups counters/cost/replace-prevent/combat): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10). Alice (p1) casts or controls the card under test, Bob (p2) is the opponent. Each group has its negative cases. CR cites: Comprehensive Rules of
 * 2026-09-25 unless the record lists them as unverified.
 *
 *   CR 601.2d, 615.7          "Prevent the next 4 damage that would be dealt this turn to any number of targets, divided as you choose." (Embolden, Remedy, Angel of Salvation)
 *   CR 601.2b, 601.2d, 702.33a "... If ~ was kicked, prevent the next 6 damage this way instead." (Pollen Remedy)
 *   CR 614.9, 615.7           "The next time damage would be dealt to ~ and/or you this turn, that damage is dealt to any target instead." (Glarecaster)
 *   CR 614.9                  "All damage that would be dealt to ~ this turn is dealt to target creature instead." (Karona's Zealot)
 *   CR 614.9, 510.2           "The next time ~ would deal combat damage to an opponent this turn, it deals that damage to target creature instead." (Soltari Guerrillas)
 *   CR 614.9, 510.2, 115.1    "The next time target attacking creature would deal combat damage to ~ this turn, that creature deals that damage to itself instead." (Shield Dancer)
 *   CR 609.7a, 614.9          "The next time a source of your choice would deal damage this turn, that damage is dealt to that source's controller instead." (Reflect Damage)
 *   CR 614.9, 615.7, 115.3    "The next X damage that would be dealt to target creature, planeswalker, or player this turn is dealt to another target creature, planeswalker, or player instead." (Captain's Maneuver)
 */
import { describe, expect, it } from 'vitest';
import { activatedAbilities, type DecisionAnswer, type GameState, type ObjectId, type TargetChoice } from '../../../src/index';
import { act, answer, card, find, full, lifeOf, named, obj, passBoth, scenario } from '../r3-cost/support';
import { pass } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers } from '../../m4/helpers';

const plr = (id: string): TargetChoice => ({ kind: 'player', id });
const dmg = (s: GameState, id: ObjectId): number => s.objects[id]?.damage ?? 0;

interface Script { targets?: TargetChoice[][]; division?: number[][]; yes?: boolean[]; x?: number[]; objects?: ObjectId[][] }
/** Answer the decisions of a cast or an activation in order; `chooseDivision` is answered from `division`. Stops at the next priority decision. */
function go(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  const q = { objects: [...(script.objects ?? [])], targets: [...(script.targets ?? [])], division: [...(script.division ?? [])], yes: [...(script.yes ?? [])], x: [...(script.x ?? [])] };
  for (let guard = 0; guard < 40 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: q.targets.shift() ?? [] });
    else if (p.kind === 'chooseDivision') { if (q.division.length === 0) return s; s = answer(s, { kind: 'chooseDivision', amounts: q.division.shift()! } as DecisionAnswer); } // none given: stop here for the test to look at it
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: q.yes.shift() ?? false });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: q.x.shift() ?? p.min });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: q.objects.shift() ?? p.options.slice(0, p.min) });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, player = 'p1'): GameState => go(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), script);
const resolve = (s0: GameState, script: Script = {}): GameState => {
  let s = s0;
  for (let i = 0; i < 12 && s.zones.stack.length > 0; i++) s = go(passBoth(s), script);
  return s;
};
const activate = (s: GameState, name: string, script: Script = {}): GameState => {
  const g = find(s, name, 'battlefield', 'p1');
  return go(act(s, { type: 'activate', player: 'p1', source: g, ability: activatedAbilities(s, s.objects[g]!)[0]!.key }), script);
};

const BURN5 = card('Test Burn', 'Instant', 'Test Burn deals 5 damage to any target.');
const BURN3 = card('Test Burn Three', 'Instant', 'Test Burn Three deals 3 damage to any target.');
const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '9']);
const BEAR2 = card('Test Other Bear', 'Creature — Bear', '', '{0}', ['2', '9']);
const OPP = card('Test Opp Bear', 'Creature — Bear', '', '{0}', ['2', '9']);

describe('CR 601.2d, 615.7: "Prevent the next 4 damage that would be dealt this turn to any number of targets, divided as you choose."', () => {
  const WARD = card('Test Ward', 'Instant', 'Prevent the next 4 damage that would be dealt this turn to any number of targets, divided as you choose.');
  const game = (): GameState => scenario([], { defs: [WARD, BURN5, BURN3, BEAR, OPP], p1: { hand: ['Test Ward', 'Test Burn', 'Test Burn Three'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(WARD)).toBe(true));
  it('the division is asked for the targets (a total of 4); each target gets a shield of exactly its share', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Ward', 'hand', 'p1') });
    s = go(s, { targets: [[plr('p1'), obj(bear)]] }); // stops at the division
    expect(s.pending?.kind).toBe('chooseDivision');
    expect((s.pending as unknown as { total: number }).total).toBe(4);
    s = resolve(go(s, { division: [[3, 1]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] })); // 5 damage to Alice: 3 prevented
    expect(lifeOf(s, 'p1')).toBe(18);
    s = resolve(cast(s, 'Test Burn Three', { targets: [[obj(bear)]] })); // 3 damage to the Bear: 1 prevented
    expect(dmg(s, bear)).toBe(2);
  });
  it('negative: a division that does not add up to 4 is refused, and a target left out of the division is not protected', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = go(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Ward', 'hand', 'p1') }), { targets: [[plr('p1'), obj(bear)]] });
    expect(() => answer(s, { kind: 'chooseDivision', amounts: [3, 2] } as DecisionAnswer)).toThrow();
    s = resolve(go(s, { division: [[2, 2]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p2')]] })); // Bob was not a target
    expect(lifeOf(s, 'p2')).toBe(15);
  });
  it('negative: the shield of a share stops at the share (a 5-damage burn at a target with a share of 1 is dealt 4)', () => {
    const s0 = game();
    let s = go(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Ward', 'hand', 'p1') }), { targets: [[plr('p1'), plr('p2')]] });
    s = resolve(go(s, { division: [[1, 3]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(16);
    s = resolve(cast(s, 'Test Burn Three', { targets: [[plr('p1')]] })); // the share of 1 is used up: nothing is prevented now
    expect(lifeOf(s, 'p1')).toBe(13);
  });
  it('one target gets all 4 (no division asked); no target at all prevents nothing', () => {
    const s0 = game();
    let s = resolve(cast(s0, 'Test Ward', { targets: [[plr('p1')]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(19);
    const t = resolve(cast(game(), 'Test Ward', { targets: [[]] }));
    const u = resolve(cast(t, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(u, 'p1')).toBe(15);
  });
  it('a target that is gone when the spell resolves loses its share (CR 608.2b); the other target keeps its own', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = go(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Ward', 'hand', 'p1') }), { targets: [[plr('p1'), obj(bear)]] });
    s = go(s, { division: [[1, 3]] });
    s = { ...s, objects: { ...s.objects, [bear]: { ...s.objects[bear]!, zone: 'graveyard' } }, zones: { ...s.zones, battlefield: s.zones.battlefield.filter((id) => id !== bear) } } as GameState;
    s = resolve(s);
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(16); // Alice's own share of 1 only
  });
  it('the shields end with the turn', () => {
    let s = resolve(cast(game(), 'Test Ward', { targets: [[plr('p1')]] }));
    for (let i = 0; i < 400 && !(s.turn.number >= 2 && s.turn.activePlayer === 'p2' && s.turn.step === 'main1' && s.pending?.kind === 'priority'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : passBoth(s);
    }
    expect(s.continuousEffects.filter((r) => r.effect.s === 'replace').length).toBe(0);
  });
});

describe('CR 601.2b, 601.2d, 702.33a: "... divided as you choose. If this spell was kicked, prevent the next 6 damage this way instead." (Pollen Remedy)', () => {
  const POLLEN = card('Test Pollen', 'Instant', 'Kicker {1}\nPrevent the next 3 damage that would be dealt this turn to any number of targets, divided as you choose. If this spell was kicked, prevent the next 6 damage this way instead.', '{0}');
  const game = (): GameState => scenario([], { defs: [POLLEN, BURN5, BEAR, OPP], p1: { hand: ['Test Pollen', 'Test Burn'], battlefield: ['Test Bear', 'Plains'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(POLLEN)).toBe(true));
  const start = (kick: boolean): GameState => {
    const s0 = game();
    return go(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Pollen', 'hand', 'p1') }), { yes: [kick], targets: [[plr('p1'), plr('p2')]] });
  };
  it('not kicked: the division asked is of 3', () => {
    const s = start(false);
    expect(s.pending?.kind).toBe('chooseDivision');
    expect((s.pending as unknown as { total: number }).total).toBe(3);
  });
  it('kicked: the division asked is of 6, and the shields prevent 6', () => {
    let s = start(true);
    expect(s.pending?.kind).toBe('chooseDivision');
    expect((s.pending as unknown as { total: number }).total).toBe(6);
    s = resolve(go(s, { division: [[5, 1]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(20);
  });
});

describe('CR 614.9, 615.7: "The next time damage would be dealt to ~ and/or you this turn, that damage is dealt to any target instead." (Glarecaster)', () => {
  const GLARE = card('Test Glare', 'Creature — Cleric', '{0}: The next time damage would be dealt to this creature and/or you this turn, that damage is dealt to any target instead.', '{0}', ['1', '9']);
  const game = (): GameState => scenario([], { defs: [GLARE, BURN5, BURN3, BEAR, OPP], p1: { hand: ['Test Burn', 'Test Burn Three'], battlefield: ['Test Glare'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(GLARE)).toBe(true));
  it('damage dealt to you is dealt to the target instead, once', () => {
    const s0 = game();
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = resolve(activate(s0, 'Test Glare', { targets: [[obj(oppBear)]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(dmg(s, oppBear)).toBe(5);
    s = resolve(cast(s, 'Test Burn Three', { targets: [[plr('p1')]] })); // the next time only
    expect(lifeOf(s, 'p1')).toBe(17);
    expect(dmg(s, oppBear)).toBe(5);
  });
  it('damage dealt to the creature itself is redirected too; damage to another permanent is not', () => {
    const s0 = game();
    const glare = find(s0, 'Test Glare', 'battlefield', 'p1');
    let s = resolve(activate(s0, 'Test Glare', { targets: [[plr('p2')]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[obj(glare)]] }));
    expect(dmg(s, glare)).toBe(0);
    expect(lifeOf(s, 'p2')).toBe(15);
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let t = resolve(activate(s0, 'Test Glare', { targets: [[plr('p2')]] }));
    t = resolve(cast(t, 'Test Burn', { targets: [[obj(oppBear)]] }));
    expect(dmg(t, oppBear)).toBe(5);
    expect(lifeOf(t, 'p2')).toBe(20);
  });
});

describe('CR 614.9, 614.5, 615.7: the "next time" redirect is used up by one time, damage dealt to both at once is all redirected (Glarecaster, ruling 2004-10-04)', () => {
  const GLARE = card('Test Glare', 'Creature — Cleric', '{0}: The next time damage would be dealt to this creature and/or you this turn, that damage is dealt to any target instead.', '{0}', ['1', '9']);
  const SWEEP = card('Test Sweep', 'Sorcery', 'Test Sweep deals 2 damage to each creature and each player.');
  const game = (): GameState => scenario([], { defs: [GLARE, SWEEP, OPP, BURN3], p1: { hand: ['Test Sweep', 'Test Burn Three'], battlefield: ['Test Glare'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('a sweeper that hits the creature and its controller at once: both chunks go to the target; the shield is used up afterwards', () => {
    const s0 = game();
    const glare = find(s0, 'Test Glare', 'battlefield', 'p1');
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = resolve(activate(s0, 'Test Glare', { targets: [[obj(oppBear)]] }));
    s = resolve(cast(s, 'Test Sweep'));
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(dmg(s, glare)).toBe(0);
    expect(dmg(s, oppBear)).toBe(2 + 2 + 2); // its own 2 and both redirected chunks
    expect(lifeOf(s, 'p2')).toBe(18);
    s = resolve(cast(s, 'Test Burn Three', { targets: [[plr('p1')]] })); // a later event is dealt as usual
    expect(lifeOf(s, 'p1')).toBe(17);
  });
});

describe('CR 614.9: "All damage that would be dealt to ~ this turn is dealt to target creature instead." (Karona\'s Zealot)', () => {
  const ZEAL = card('Test Zealot', 'Creature — Cleric', '{0}: All damage that would be dealt to this creature this turn is dealt to target creature instead.', '{0}', ['1', '9']);
  const game = (): GameState => scenario([], { defs: [ZEAL, BURN5, BURN3, OPP], p1: { hand: ['Test Burn', 'Test Burn Three'], battlefield: ['Test Zealot'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(ZEAL)).toBe(true));
  it('every damage dealt to it this turn goes to the target creature; damage to its controller does not', () => {
    const s0 = game();
    const zeal = find(s0, 'Test Zealot', 'battlefield', 'p1');
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = resolve(activate(s0, 'Test Zealot', { targets: [[obj(oppBear)]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[obj(zeal)]] }));
    s = resolve(cast(s, 'Test Burn Three', { targets: [[obj(zeal)]] }));
    expect(dmg(s, zeal)).toBe(0);
    expect(dmg(s, oppBear)).toBe(8);
    const t = resolve(cast(resolve(activate(s0, 'Test Zealot', { targets: [[obj(oppBear)]] })), 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(t, 'p1')).toBe(15);
  });
});

describe('CR 614.9, 510.2: "The next time ~ would deal combat damage to an opponent this turn, it deals that damage to target creature instead." (Soltari Guerrillas)', () => {
  const GUER = card('Test Guerrilla', 'Creature — Soldier', '{0}: The next time this creature would deal combat damage to an opponent this turn, it deals that damage to target creature instead.', '{0}', ['3', '3']);
  const game = (): GameState => scenario([], { defs: [GUER, OPP], p1: { battlefield: ['Test Guerrilla'] }, p2: { battlefield: ['Test Opp Bear'] } });
  const attack = (s0: GameState): GameState => {
    let s = toDeclareAttackers(s0);
    s = declareAttackers(s, [[named(s, 'Test Guerrilla')[0]!, 'p2']]);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers', 80);
    if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    return passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
  };
  it('is full', () => expect(full(GUER)).toBe(true));
  it('the unblocked combat damage to the opponent is dealt to the target creature instead', () => {
    const s0 = game();
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    const s = attack(resolve(activate(s0, 'Test Guerrilla', { targets: [[obj(oppBear)]] })));
    expect(lifeOf(s, 'p2')).toBe(20);
    expect(dmg(s, oppBear)).toBe(3);
  });
  it('negative: without the activation the opponent is dealt the damage', () => {
    const s = attack(game());
    expect(lifeOf(s, 'p2')).toBe(17);
  });
});

describe('CR 614.9, 615.7, 115.3: "The next X damage that would be dealt to target creature, planeswalker, or player this turn is dealt to another target creature, planeswalker, or player instead." (Captain\'s Maneuver)', () => {
  const MAN = card('Test Maneuver', 'Instant', 'The next X damage that would be dealt to target creature, planeswalker, or player this turn is dealt to another target creature, planeswalker, or player instead.', '{X}');
  const game = (): GameState => scenario([], { defs: [MAN, BURN5, BEAR, OPP], p1: { hand: ['Test Maneuver', 'Test Burn'], battlefield: ['Test Bear', 'Plains', 'Plains', 'Plains'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(MAN)).toBe(true));
  it('X = 3: the next 3 damage to the first target is dealt to the second target, the rest to the first', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = resolve(cast(s0, 'Test Maneuver', { x: [3], targets: [[plr('p1')], [obj(oppBear)]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[plr('p1')]] }));
    expect(lifeOf(s, 'p1')).toBe(18);
    expect(dmg(s, oppBear)).toBe(3);
    void bear;
  });
  it('negative: damage to a permanent that is not the first target is not redirected', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const oppBear = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = resolve(cast(s0, 'Test Maneuver', { x: [3], targets: [[plr('p1')], [obj(oppBear)]] }));
    s = resolve(cast(s, 'Test Burn', { targets: [[obj(bear)]] }));
    expect(dmg(s, bear)).toBe(5);
    expect(dmg(s, oppBear)).toBe(0);
  });
});

describe('CR 614.9, 510.2, 115.1: "The next time target attacking creature would deal combat damage to ~ this turn, that creature deals that damage to itself instead." (Shield Dancer)', () => {
  const DANCER = card('Test Dancer', 'Creature — Soldier', '{0}: The next time target attacking creature would deal combat damage to this creature this turn, that creature deals that damage to itself instead.', '{0}', ['1', '9']);
  const RAIDER = card('Test Raider', 'Creature — Orc', '', '{0}', ['3', '9']);
  const game = (): GameState => scenario([], { defs: [DANCER, RAIDER], p1: { battlefield: ['Test Dancer'] }, p2: { battlefield: ['Test Raider'] } });
  /** Bob attacks Alice with the Raider and the Dancer blocks it; `shield`: Alice activates the Dancer's ability (targeting the Raider) after blockers. */
  const clash = (shield: boolean): { s: GameState; dancer: ObjectId; raider: ObjectId } => {
    let s = game();
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : passBoth(s);
    }
    const raider = named(s, 'Test Raider')[0]!;
    const dancer = named(s, 'Test Dancer')[0]!;
    s = declareAttackers(s, [[raider, 'p1']]);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 80);
    s = declareBlockers(s, [[dancer, raider]]);
    s = passUntil(s, (x) => x.pending?.kind === 'priority', 'priority after blocks', 20);
    if (shield) {
      if (s.priority.player !== 'p1') s = pass(s); // Bob, the active player, passes first
      s = resolve(activate(s, 'Test Dancer', { targets: [[obj(raider)]] }));
    }
    s = passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
    return { s, dancer, raider };
  };
  it('is full', () => expect(full(DANCER)).toBe(true));
  it('the Raider\'s combat damage to the Dancer is dealt to the Raider itself', () => {
    const { s, dancer, raider } = clash(true);
    expect(dmg(s, dancer)).toBe(0);
    expect(dmg(s, raider)).toBe(4); // its own 3, and the Dancer\'s 1
  });
  it('negative: without the ability the Dancer is dealt the damage', () => {
    const { s, dancer, raider } = clash(false);
    expect(dmg(s, dancer)).toBe(3);
    expect(dmg(s, raider)).toBe(1);
  });
});

describe('CR 609.7a, 614.9: "The next time a source of your choice would deal damage this turn, that damage is dealt to that source\'s controller instead." (Reflect Damage)', () => {
  const REFLECT = card('Test Reflect', 'Instant', 'The next time a source of your choice would deal damage this turn, that damage is dealt to that source\'s controller instead.');
  const game = (): GameState => scenario([], { defs: [REFLECT, BURN5, BURN3, OPP], p1: { hand: ['Test Reflect', 'Test Burn', 'Test Burn Three'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(REFLECT)).toBe(true));
  it('the chosen burn spell\'s damage is dealt to its controller instead; another source\'s damage is dealt as usual', () => {
    let s = cast(game(), 'Test Burn', { targets: [[plr('p2')]] });
    const burn = s.zones.stack[s.zones.stack.length - 1]!;
    s = cast(s, 'Test Burn Three', { targets: [[plr('p2')]] });
    s = cast(s, 'Test Reflect');
    s = resolve(s, { objects: [[burn]] });
    expect(lifeOf(s, 'p1')).toBe(15); // the chosen 5 damage came back to Alice
    expect(lifeOf(s, 'p2')).toBe(17); // the other burn (3) was dealt to Bob as usual
  });
  it('negative: only the next time (damage from the same source after the first event is dealt as usual)', () => {
    let s = cast(game(), 'Test Burn', { targets: [[plr('p2')]] });
    const burn = s.zones.stack[s.zones.stack.length - 1]!;
    s = resolve(cast(s, 'Test Reflect'), { objects: [[burn]] });
    expect(lifeOf(s, 'p1')).toBe(15);
    s = resolve(cast(s, 'Test Burn Three', { targets: [[plr('p2')]] }));
    expect(lifeOf(s, 'p2')).toBe(17);
  });
});
