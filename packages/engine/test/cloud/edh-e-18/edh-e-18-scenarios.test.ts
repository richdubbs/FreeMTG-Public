/**
 * edh-e-18 (Commander coordinator E, group replace-prevent): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented
 * names and wordings, design 6.10). Alice (p1) casts or controls the card under test, Bob (p2) is the opponent. Each group has its negative cases. CR cites: Comprehensive Rules
 * of 2026-09-25 unless the record lists them as unverified.
 *
 *   CR 609.7a, 615.1, 615.7   "Prevent the next 3 damage that would be dealt to any target this turn by a source of your choice." (Healing Grace)
 *   CR 615.5, 119.3           "Prevent the next 3 damage that would be dealt to any target this turn. You gain life equal to the damage prevented this way." (Candles' Glow)
 *   CR 614.9, 609.7a          "All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead." (Kor Chant)
 *   CR 614.9, 615.7           "The next 2 damage that a source of your choice would deal to you and/or permanents you control this turn is dealt to any target instead." (Harm's Way)
 *   CR 615.5, 608.2h          "Prevent the next 3 damage that a source of your choice would deal to you and/or permanents you control this turn. If damage is prevented this way, ~ deals that much damage to any target." (Refraction Trap)
 *   CR 615.1a, 109.4          "Prevent all damage that black sources and red sources would deal this turn." / "... to target creature this turn by colorless sources." (Luminesce, Lithomancer's Focus)
 *   CR 614.15, 702.33d        "When ~ enters, destroy all other creatures you control. If it was kicked, destroy all other creatures instead." (Desolation Giant)
 *   CR 614.9, 506.4           "As long as ~ is untapped, all (combat) damage that would be dealt to you by unblocked creatures is dealt to ~ instead." (Veteran Bodyguard, Weathered Bodyguards, Kjeldoran Royal Guard)
 */
import { describe, expect, it } from 'vitest';
import { activatedAbilities, compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type TargetChoice } from '../../../src/index';
import { act, find, life, scenario } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers } from '../../m4/helpers';
import { card, cast, full, named, resolveAll } from '../cmd3/helpers';
import { cast as castS, resolveAll as resolveAllS } from '../r3-cost/support';
import { answer, pass } from '../../m3/scenario';

const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
const plr = (id: string): TargetChoice => ({ kind: 'player', id });
const dmg = (s: GameState, id: ObjectId): number => s.objects[id]?.damage ?? 0;
const top = (s: GameState): ObjectId => s.zones.stack[s.zones.stack.length - 1]!;
const colored = (name: string, type: string, text: string, colors: string[], ptv?: [string, string]): CardDef =>
  compileCard({ name, layout: 'normal', mana_cost: '{0}', type_line: type, oracle_text: text, colors, ...(ptv ? { power: ptv[0], toughness: ptv[1] } : {}) } as OracleCard);

const BOLT = colored('Test Bolt', 'Instant', 'Test Bolt deals 3 damage to any target.', ['R']);
const BOLT2 = colored('Test Bolt Two', 'Instant', 'Test Bolt Two deals 2 damage to any target.', ['G']);
const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '5']);
const OTHER = card('Test Other Bear', 'Creature — Bear', '', ['2', '5']);
const OPP = card('Test Opp Bear', 'Creature — Bear', '', ['2', '5']);
const CHOOSE = (what: string) => ({ objects: [what as ObjectId] });
void CHOOSE;

/** Alice casts the burn spell at `at`, then (the burn spell still on the stack) the card under test with `picks`, and everything resolves; `chosen` is the burn spell. */
function burnThen(s0: GameState, burn: string, at: TargetChoice, play: string, playPicks: object = {}): GameState {
  let s = cast(s0, burn, { targets: [at] });
  const spell = top(s);
  s = cast(s, play, playPicks);
  return resolveAll(s, { objects: [spell], ...('targets' in playPicks ? {} : {}) });
}

describe('CR 609.7a, 615.1, 615.7: "Prevent the next 3 damage that would be dealt to any target this turn by a source of your choice. You gain 3 life."', () => {
  const GRACE = card('Test Grace', 'Instant', 'Prevent the next 3 damage that would be dealt to any target this turn by a source of your choice. You gain 3 life.');
  const game = (): GameState => scenario([], { defs: [GRACE, BOLT, BOLT2], p1: { hand: ['Test Grace', 'Test Bolt', 'Test Bolt Two'] } });
  it('is full', () => expect(full(GRACE)).toBe(true));
  it('the chosen source\'s damage to the target is prevented up to 3; you gain 3', () => {
    const s0 = game();
    let s = cast(s0, 'Test Bolt', { targets: [plr('p2')] });
    const bolt = top(s);
    s = cast(s, 'Test Grace', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [bolt] });
    expect(life(s, 'p2')).toBe(20); // 3 damage, 3 prevented
    expect(life(s, 'p1')).toBe(23);
  });
  it('negative: damage from a source that was not chosen is dealt, and only the chosen source\'s damage to another recipient is not prevented', () => {
    const s0 = game();
    let s = cast(s0, 'Test Bolt', { targets: [plr('p2')] });
    const bolt = top(s);
    s = cast(s, 'Test Bolt Two', { targets: [plr('p2')] });
    const bolt2 = top(s);
    s = cast(s, 'Test Grace', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [bolt] });
    expect(bolt2).not.toBe(bolt);
    expect(life(s, 'p2')).toBe(18); // the unchosen 2 damage is dealt; the chosen 3 is prevented
  });
  it('negative: the shield stops at 3 (a 4th point from the chosen source is dealt) and the other target is not protected', () => {
    const BIG = colored('Test Big Bolt', 'Instant', 'Test Big Bolt deals 5 damage to any target.', ['R']);
    const s0 = scenario([], { defs: [GRACE, BIG], p1: { hand: ['Test Grace', 'Test Big Bolt'] } });
    let s = cast(s0, 'Test Big Bolt', { targets: [plr('p2')] });
    const big = top(s);
    s = cast(s, 'Test Grace', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [big] });
    expect(life(s, 'p2')).toBe(18);
    const s1 = scenario([], { defs: [GRACE, BIG], p1: { hand: ['Test Grace', 'Test Big Bolt'] } });
    let t = cast(s1, 'Test Big Bolt', { targets: [plr('p2')] });
    const big1 = top(t);
    t = cast(t, 'Test Grace', { targets: [plr('p1')] }); // protects Alice, not Bob
    t = resolveAll(t, { objects: [big1] });
    expect(life(t, 'p2')).toBe(15);
  });
});

describe('CR 615.5, 119.3: "Prevent the next 3 damage that would be dealt to any target this turn. You gain life equal to the damage prevented this way."', () => {
  const GLOW = card('Test Glow', 'Instant', 'Prevent the next 3 damage that would be dealt to any target this turn. You gain life equal to the damage prevented this way.');
  const game = (): GameState => scenario([], { defs: [GLOW, BOLT, BOLT2], p1: { hand: ['Test Glow', 'Test Bolt', 'Test Bolt Two'] } });
  it('is full', () => expect(full(GLOW)).toBe(true));
  it('2 damage to the target is prevented (gain 2); the shield then has 1 left, so 3 more damage is dealt as 2 and 1 is prevented (gain 1)', () => {
    let s = cast(game(), 'Test Glow', { targets: [plr('p2')] });
    s = resolveAll(s);
    s = resolveAll(cast(s, 'Test Bolt Two', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(20);
    expect(life(s, 'p1')).toBe(22);
    s = resolveAll(cast(s, 'Test Bolt', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(18);
    expect(life(s, 'p1')).toBe(23);
  });
  it('negative: damage to another recipient is not prevented and gives no life', () => {
    let s = resolveAll(cast(game(), 'Test Glow', { targets: [plr('p2')] }));
    s = resolveAll(cast(s, 'Test Bolt Two', { targets: [plr('p1')] }));
    expect(life(s, 'p1')).toBe(18);
    expect(life(s, 'p2')).toBe(20);
  });
});

describe('CR 614.9, 609.7a: "All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead."', () => {
  const CHANT = card('Test Chant', 'Instant', 'All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead.');
  const game = (): GameState => scenario([], { defs: [CHANT, BOLT, BOLT2, BEAR, OPP, OTHER], p1: { hand: ['Test Chant', 'Test Bolt', 'Test Bolt Two'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(CHANT)).toBe(true));
  it('every point of damage the chosen source deals to the first creature is dealt to the other creature instead (not just the next time)', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const opp = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = castS(s0, 'Test Bolt', { targets: [[obj(bear)]] });
    const bolt = top(s);
    s = castS(s, 'Test Chant', { targets: [[obj(bear)], [obj(opp)]] });
    s = resolveAllS(s, { objects: [[bolt]] });
    expect(dmg(s, bear)).toBe(0);
    expect(dmg(s, opp)).toBe(3);
  });
  it('negative: damage from a source that was not chosen, and damage to a creature that was not the target, is dealt as usual', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const opp = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = castS(s0, 'Test Bolt', { targets: [[obj(bear)]] });
    const bolt = top(s);
    s = castS(s, 'Test Bolt Two', { targets: [[obj(bear)]] });
    s = castS(s, 'Test Chant', { targets: [[obj(bear)], [obj(opp)]] });
    s = resolveAllS(s, { objects: [[bolt]] });
    expect(dmg(s, bear)).toBe(2); // Bolt Two was not chosen
    expect(dmg(s, opp)).toBe(3);
    // and the redirected-to creature's own damage from the chosen source is its own
    let t = castS(game(), 'Test Bolt', { targets: [[obj(opp)]] });
    const bolt1 = top(t);
    t = castS(t, 'Test Chant', { targets: [[obj(bear)], [obj(opp)]] });
    t = resolveAllS(t, { objects: [[bolt1]] });
    expect(dmg(t, opp)).toBe(3);
    expect(dmg(t, bear)).toBe(0);
  });
});

describe('CR 614.9, 615.7: "The next 2 damage that a source of your choice would deal to you and/or permanents you control this turn is dealt to any target instead."', () => {
  const WAY = card('Test Way', 'Instant', 'The next 2 damage that a source of your choice would deal to you and/or permanents you control this turn is dealt to any target instead.');
  const game = (): GameState => scenario([], { defs: [WAY, BOLT, BEAR, OPP], p1: { hand: ['Test Way', 'Test Bolt'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(WAY)).toBe(true));
  it('2 of the 3 damage the chosen source would deal to you goes to the target instead; the 3rd point is dealt to you', () => {
    const s0 = game();
    const opp = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = cast(s0, 'Test Bolt', { targets: [plr('p1')] });
    const bolt = top(s);
    s = cast(s, 'Test Way', { targets: [obj(opp)] });
    s = resolveAll(s, { objects: [bolt] });
    expect(life(s, 'p1')).toBe(19);
    expect(dmg(s, opp)).toBe(2);
  });
  it('negative: damage to an opponent\'s permanent from the chosen source is not redirected', () => {
    const s0 = game();
    const opp = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = cast(s0, 'Test Bolt', { targets: [obj(opp)] });
    const bolt = top(s);
    s = cast(s, 'Test Way', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [bolt] });
    expect(dmg(s, opp)).toBe(3);
    expect(life(s, 'p2')).toBe(20);
  });
});

describe('CR 615.5, 608.2h: "Prevent the next 3 damage that a source of your choice would deal to you and/or permanents you control this turn. If damage is prevented this way, ~ deals that much damage to any target."', () => {
  const TRAP = card('Test Trap', 'Instant', 'Prevent the next 3 damage that a source of your choice would deal to you and/or permanents you control this turn. If damage is prevented this way, ~ deals that much damage to any target.');
  const game = (): GameState => scenario([], { defs: [TRAP, BOLT, BOLT2, BEAR, OPP], p1: { hand: ['Test Trap', 'Test Bolt', 'Test Bolt Two'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(TRAP)).toBe(true));
  it('the chosen source\'s damage to you is prevented and the same amount is dealt to the target', () => {
    const s0 = game();
    let s = cast(s0, 'Test Bolt', { targets: [plr('p1')] });
    const bolt = top(s);
    s = cast(s, 'Test Trap', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [bolt] });
    expect(life(s, 'p1')).toBe(20);
    expect(life(s, 'p2')).toBe(17);
  });
  it('negative: damage from an unchosen source is dealt to you and nothing is dealt back', () => {
    const s0 = game();
    let s = cast(s0, 'Test Bolt', { targets: [plr('p1')] });
    const bolt = top(s);
    s = cast(s, 'Test Bolt Two', { targets: [plr('p1')] });
    s = cast(s, 'Test Trap', { targets: [plr('p2')] });
    s = resolveAll(s, { objects: [bolt] });
    expect(life(s, 'p1')).toBe(18);
    expect(life(s, 'p2')).toBe(17);
  });
});

describe('CR 615.1a: "Prevent all damage that black sources and red sources would deal this turn."', () => {
  const LUM = card('Test Lum', 'Instant', 'Prevent all damage that black sources and red sources would deal this turn.');
  const BLACK = colored('Test Black Bolt', 'Instant', 'Test Black Bolt deals 3 damage to any target.', ['B']);
  const game = (): GameState => scenario([], { defs: [LUM, BOLT, BLACK, BOLT2], p1: { hand: ['Test Lum', 'Test Bolt', 'Test Black Bolt', 'Test Bolt Two'] } });
  it('is full', () => expect(full(LUM)).toBe(true));
  it('red and black sources deal no damage this turn; a green source still does', () => {
    let s = resolveAll(cast(game(), 'Test Lum'));
    s = resolveAll(cast(s, 'Test Bolt', { targets: [plr('p2')] }));
    s = resolveAll(cast(s, 'Test Black Bolt', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(20);
    s = resolveAll(cast(s, 'Test Bolt Two', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(18);
  });
  it('negative: without it the red source deals its damage', () => {
    const s = resolveAll(cast(game(), 'Test Bolt', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(17);
  });
});

describe('CR 615.1a, 109.4: "Target creature gets +2/+2 until end of turn. Prevent all damage that would be dealt to that creature this turn by colorless sources."', () => {
  const FOCUS = card('Test Focus', 'Instant', 'Target creature gets +2/+2 until end of turn. Prevent all damage that would be dealt to that creature this turn by colorless sources.');
  const ART = card('Test Colorless Bolt', 'Artifact', '', undefined);
  void ART;
  const CBOLT = card('Test Colorless Bolt', 'Instant', 'Test Colorless Bolt deals 4 damage to any target.');
  const game = (): GameState => scenario([], { defs: [FOCUS, CBOLT, BOLT, BEAR], p1: { hand: ['Test Focus', 'Test Colorless Bolt', 'Test Bolt'], battlefield: ['Test Bear'] } });
  it('is full', () => expect(full(FOCUS)).toBe(true));
  it('damage from a colorless source to that creature is prevented; damage from a red source is not', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = resolveAll(cast(s0, 'Test Focus', { targets: [obj(bear)] }));
    s = resolveAll(cast(s, 'Test Colorless Bolt', { targets: [obj(bear)] }));
    expect(dmg(s, bear)).toBe(0);
    s = resolveAll(cast(s, 'Test Bolt', { targets: [obj(bear)] }));
    expect(dmg(s, bear)).toBe(3);
  });
  it('negative: another creature is not protected', () => {
    const s0 = game();
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = resolveAll(cast(s0, 'Test Focus', { targets: [obj(bear)] }));
    s = resolveAll(cast(s, 'Test Colorless Bolt', { targets: [plr('p2')] }));
    expect(life(s, 'p2')).toBe(16);
  });
});

describe('CR 614.15, 702.33d: "When ~ enters, destroy all other creatures you control. If it was kicked, destroy all other creatures instead."', () => {
  const GIANT = card('Test Giant', 'Creature — Giant', 'Kicker {W}{W}\nWhen this creature enters, destroy all other creatures you control. If it was kicked, destroy all other creatures instead.', ['4', '4']);
  const game = (): GameState => scenario([], { defs: [GIANT, BEAR, OPP], p1: { hand: ['Test Giant'], battlefield: ['Test Bear', 'Plains', 'Plains'] }, p2: { battlefield: ['Test Opp Bear'] } });
  it('is full', () => expect(full(GIANT)).toBe(true));
  it('not kicked: only your other creatures are destroyed', () => {
    const s = resolveAllS(castS(game(), 'Test Giant', { yes: [false] }));
    expect(named(s, 'Test Bear').length).toBe(0);
    expect(named(s, 'Test Opp Bear').length).toBe(1);
    expect(named(s, 'Test Giant').length).toBe(1);
  });
  it('kicked: every other creature is destroyed, the Giant stays', () => {
    const s = resolveAllS(castS(game(), 'Test Giant', { yes: [true] }));
    expect(named(s, 'Test Bear').length).toBe(0);
    expect(named(s, 'Test Opp Bear').length).toBe(0);
    expect(named(s, 'Test Giant').length).toBe(1);
  });
});

describe('CR 614.9, 506.4: "As long as ~ is untapped, all damage that would be dealt to you by unblocked creatures is dealt to ~ instead."', () => {
  const GUARD = card('Test Guard', 'Creature — Soldier', 'As long as this creature is untapped, all damage that would be dealt to you by unblocked creatures is dealt to this creature instead.', ['1', '9']);
  const CGUARD = card('Test Combat Guard', 'Creature — Soldier', 'As long as this creature is untapped, all combat damage that would be dealt to you by unblocked creatures is dealt to this creature instead.', ['1', '9']);
  const RAIDER = card('Test Raider', 'Creature — Orc', '', ['3', '3']);
  const SHIELD = card('Test Wall', 'Creature — Wall', '', ['0', '9']);
  const game = (g: string): GameState => scenario([], { defs: [GUARD, CGUARD, RAIDER, SHIELD], p1: { battlefield: [g] }, p2: { battlefield: ['Test Raider'] } });
  /** Pass to Bob's turn, attack Alice with the Raider; `blocker` blocks it (or nobody does). */
  const raid = (s0: GameState, blocker?: string): GameState => {
    let s = s0;
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
    }
    s = declareAttackers(s, [[named(s, 'Test Raider')[0]!, 'p1']]);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers', 80);
    if (s.pending?.kind === 'declareBlockers') s = declareBlockers(s, blocker === undefined ? [] : [[named(s, blocker)[0]!, named(s, 'Test Raider')[0]!]]);
    return passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
  };
  void toDeclareAttackers;
  for (const g of ['Test Guard', 'Test Combat Guard']) {
    it(`${g} is full`, () => expect(full(g === 'Test Guard' ? GUARD : CGUARD)).toBe(true));
    it(`${g}: unblocked, the Raider's damage to you is dealt to the untapped guard instead`, () => {
      const s = raid(game(g));
      expect(life(s, 'p1')).toBe(20);
      expect(dmg(s, named(s, g)[0]!)).toBe(3);
    });
  }
  it('negative: blocked by another creature, the Raider\'s damage goes to the blocker and not to the guard or you', () => {
    const s0 = scenario([], { defs: [GUARD, RAIDER, SHIELD], p1: { battlefield: ['Test Guard', 'Test Wall'] }, p2: { battlefield: ['Test Raider'] } });
    const s = raid(s0, 'Test Wall');
    expect(life(s, 'p1')).toBe(20);
    expect(dmg(s, named(s, 'Test Guard')[0]!)).toBe(0);
    expect(dmg(s, named(s, 'Test Wall')[0]!)).toBe(3);
  });
  it('negative: a tapped guard redirects nothing', () => {
    const s0 = game('Test Guard');
    const g = named(s0, 'Test Guard')[0]!;
    s0.objects[g]!.tapped = true;
    const s = raid(s0);
    expect(life(s, 'p1')).toBe(17);
  });
});

describe('CR 614.9, 506.4, 611.2a: "{T}: All combat damage that would be dealt to you by unblocked creatures this turn is dealt to this creature instead." (Kjeldoran Royal Guard)', () => {
  const ROYAL = card('Test Royal Guard', 'Creature — Soldier', '{T}: All combat damage that would be dealt to you by unblocked creatures this turn is dealt to this creature instead.', ['1', '9']);
  const RAIDER = card('Test Raider', 'Creature — Orc', '', ['3', '3']);
  const SLAY = card('Test Slay', 'Instant', 'Destroy target creature.');
  const game = (): GameState => scenario([], { defs: [ROYAL, RAIDER, SLAY], p1: { battlefield: ['Test Royal Guard'], hand: ['Test Slay'] }, p2: { battlefield: ['Test Raider'] } });
  const activate = (s: GameState): GameState => {
    const g = find(s, 'Test Royal Guard', 'battlefield', 'p1');
    return act(s, { type: 'activate', player: 'p1', source: g, ability: activatedAbilities(s, s.objects[g]!)[0]!.key });
  };
  const raid = (s0: GameState): GameState => {
    let s = s0;
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
    }
    s = declareAttackers(s, [[named(s, 'Test Raider')[0]!, 'p1']]);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers', 80);
    if (s.pending?.kind === 'declareBlockers') s = declareBlockers(s, []);
    return passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
  };
  it('is full', () => expect(full(ROYAL)).toBe(true));
  it('activated on Alice\'s turn, it takes the Raider\'s combat damage on Bob\'s turn? No: the effect ends with the turn it was activated in (negative)', () => {
    const s = raid(resolveAll(activate(game())));
    expect(life(s, 'p1')).toBe(17); // "this turn" was Alice's turn: nothing is redirected on Bob's turn
  });
  it('activated during Bob\'s turn (after attackers are declared), the unblocked Raider\'s damage goes to the Guard', () => {
    let s = game();
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
    }
    s = declareAttackers(s, [[named(s, 'Test Raider')[0]!, 'p1']]);
    s = activate(pass(s)); // Bob passes priority in the declare attackers step, then Alice activates
    s = resolveAll(s);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers', 80);
    if (s.pending?.kind === 'declareBlockers') s = declareBlockers(s, []);
    s = passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
    expect(life(s, 'p1')).toBe(20);
    expect(dmg(s, named(s, 'Test Royal Guard')[0]!)).toBe(3);
  });
  it('negative: if the Guard leaves the battlefield before combat damage, the damage is dealt to you as normal (ruling 2004-10-04)', () => {
    let s = game();
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
    }
    s = declareAttackers(s, [[named(s, 'Test Raider')[0]!, 'p1']]);
    s = resolveAll(activate(pass(s)));
    s = resolveAll(cast(pass(s), 'Test Slay', { targets: [obj(find(s, 'Test Royal Guard', 'battlefield', 'p1'))] }));
    expect(named(s, 'Test Royal Guard').length).toBe(0);
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers', 80);
    if (s.pending?.kind === 'declareBlockers') s = declareBlockers(s, []);
    s = passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
    expect(life(s, 'p1')).toBe(17);
  });
});

describe('CR 614.9, 608.2b: Kor Chant, the second creature gone: the damage is not redirected (ruling 2021-03-19)', () => {
  const CHANT = card('Test Chant', 'Instant', 'All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead.');
  const SLAY = card('Test Slay', 'Instant', 'Destroy target creature.');
  it('the redirect target destroyed before the damage: the first creature takes the damage', () => {
    const s0 = scenario([], { defs: [CHANT, BOLT, SLAY, BEAR, OPP], p1: { hand: ['Test Chant', 'Test Bolt', 'Test Slay'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Opp Bear'] } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const opp = find(s0, 'Test Opp Bear', 'battlefield', 'p2');
    let s = castS(s0, 'Test Bolt', { targets: [[obj(bear)]] });
    const bolt = top(s);
    s = castS(s, 'Test Slay', { targets: [[obj(opp)]] });
    const slay = top(s);
    s = castS(s, 'Test Chant', { targets: [[obj(bear)], [obj(opp)]] });
    void slay;
    s = resolveAllS(s, { objects: [[bolt]] });
    expect(named(s, 'Test Opp Bear').length).toBe(0); // the stack resolves Chant first, then Slay (the redirect creature dies), then Bolt
    expect(dmg(s, bear)).toBe(3);
  });
});

describe('CR 615.1a, 607.2d: "As this Aura enters, choose a color. Prevent all damage that would be dealt to enchanted creature by sources of the chosen color." (Prismatic Ward)', () => {
  const WARD = card('Test Ward', 'Enchantment — Aura', 'Enchant creature\nAs this Aura enters, choose a color.\nPrevent all damage that would be dealt to enchanted creature by sources of the chosen color.');
  const GBOLT = colored('Test Green Bolt', 'Instant', 'Test Green Bolt deals 2 damage to any target.', ['G']);
  it('is full', () => expect(full(WARD)).toBe(true));
  it('prevents damage to the enchanted creature from red sources when red was chosen; a green source still deals damage', () => {
    const s0 = scenario([], { defs: [WARD, BOLT, GBOLT, BEAR], p1: { hand: ['Test Ward', 'Test Bolt', 'Test Green Bolt'], battlefield: ['Test Bear'] } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    let s = resolveAllS(castS(s0, 'Test Ward', { targets: [[obj(bear)]], colors: ['R'] }));
    s = resolveAllS(castS(s, 'Test Bolt', { targets: [[obj(bear)]] }));
    expect(dmg(s, bear)).toBe(0);
    s = resolveAllS(castS(s, 'Test Green Bolt', { targets: [[obj(bear)]] }));
    expect(dmg(s, bear)).toBe(2);
  });
  it('negative: another creature is not protected', () => {
    const s0 = scenario([], { defs: [WARD, BOLT, BEAR, OTHER], p1: { hand: ['Test Ward', 'Test Bolt'], battlefield: ['Test Bear', 'Test Other Bear'] } });
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const other = find(s0, 'Test Other Bear', 'battlefield', 'p1');
    let s = resolveAllS(castS(s0, 'Test Ward', { targets: [[obj(bear)]], colors: ['R'] }));
    s = resolveAllS(castS(s, 'Test Bolt', { targets: [[obj(other)]] }));
    expect(dmg(s, other)).toBe(3);
  });
});

describe('CR 614.9: Reverberation, an opponent\'s sorcery (ruling 2004-10-04: its controller takes the damage)', () => {
  const REV = card('Test Reverb', 'Instant', 'All damage that would be dealt this turn by target sorcery spell is dealt to that spell\'s controller instead.');
  const BURST = card('Test Burst', 'Sorcery', 'Test Burst deals 2 damage to each creature and each player.');
  it('is full', () => expect(full(REV)).toBe(true));
  it('Bob casts the sorcery, Alice redirects it: Bob takes all of it (2 + 2 per creature), Alice, her creature and Bob\'s creature take none', () => {
    let s = scenario([], { defs: [REV, BURST, BEAR, OPP], p1: { hand: ['Test Reverb'], battlefield: ['Test Bear'] }, p2: { hand: ['Test Burst'], battlefield: ['Test Opp Bear'] } });
    for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.turn.step === 'main1' && s.pending?.kind === 'priority'); i++) {
      s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
    }
    s = cast(s, 'Test Burst', {}, 'p2');
    const burst = top(s);
    s = cast(pass(s), 'Test Reverb', { targets: [obj(burst)] });
    s = resolveAll(s);
    expect(life(s, 'p1')).toBe(20);
    expect(life(s, 'p2')).toBe(12); // the sum: 2 to each of the two players and two creatures
    expect(dmg(s, find(s, 'Test Bear', 'battlefield', 'p1'))).toBe(0);
  });
});

describe('CR 506.4, 510.1c, 120.2: the guards redirect only combat damage (Weathered Bodyguards) from unblocked creatures, not a blocked trampler\'s excess (ruling 2004-10-04)', () => {
  const GUARD = card('Test Guard', 'Creature — Soldier', 'As long as this creature is untapped, all damage that would be dealt to you by unblocked creatures is dealt to this creature instead.', ['1', '9']);
  const CGUARD = card('Test Combat Guard', 'Creature — Soldier', 'As long as this creature is untapped, all combat damage that would be dealt to you by unblocked creatures is dealt to this creature instead.', ['1', '9']);
  const TRAMPLER = card('Test Trampler', 'Creature — Rhino', 'Trample', ['5', '5']);
  const SMALL = card('Test Small Wall', 'Creature — Wall', '', ['0', '1']);
  for (const g of ['Test Guard', 'Test Combat Guard']) {
    it(`${g}: a blocked trampler's excess damage is dealt to you, not to the guard`, () => {
      let s = scenario([], { defs: [GUARD, CGUARD, TRAMPLER, SMALL], p1: { battlefield: [g, 'Test Small Wall'] }, p2: { battlefield: ['Test Trampler'] } });
      for (let i = 0; i < 400 && !(s.turn.activePlayer === 'p2' && s.pending?.kind === 'declareAttackers'); i++) {
        s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : pass(s);
      }
      s = declareAttackers(s, [[named(s, 'Test Trampler')[0]!, 'p1']]);
      s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'blockers', 80);
      s = declareBlockers(s, [[named(s, 'Test Small Wall')[0]!, named(s, 'Test Trampler')[0]!]]);
      s = passUntil(s, (x) => x.pending?.kind === 'assignDamage' || x.turn.step === 'main2' || x.turn.step === 'endCombat', 'damage', 80);
      if (s.pending?.kind === 'assignDamage') {
        const a = s.pending as { amount: number; recipients: { id: string }[] };
        s = answer(s, { kind: 'assignDamage', amounts: a.recipients.map((r, i) => ({ id: r.id, amount: i === 0 ? 1 : 0 })).map((x, i, all) => (i === all.length - 1 ? { ...x, amount: a.amount - 1 } : x)) } as never);
      }
      s = passUntil(s, (x) => x.turn.step === 'main2' || x.turn.step === 'endCombat', 'after damage', 80);
      expect(dmg(s, named(s, g)[0]!)).toBe(0);
    });
  }
});
