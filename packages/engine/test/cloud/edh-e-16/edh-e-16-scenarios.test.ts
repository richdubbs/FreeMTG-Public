/**
 * Commander lane edh-e, round edh-e-16: the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's default compiler.
 * Each test is named after the rule it checks and has its negative case. CR cites are from memory (no rules/cr in a cloud session): unverified.
 *
 *   CR 118.9, 603.4, 102.3       "If an opponent had an artifact enter the battlefield under their control this turn, you may pay {1}{G} rather than pay this spell's mana cost."
 *   CR 118.9, 120.1, 400.7       "If you've been dealt damage by two or more creatures this turn, you may pay {R} rather than pay this spell's mana cost."
 *   CR 506.3, 508.1, 601.2f      "This spell costs {1} less to cast for each opponent you're attacking."
 *   CR 118.1, 118.9, 119.3       "If you control a Goblin, rather than pay this spell's mana cost, you may have each other player gain 6 life."
 *   CR 601.2f, 118.7             "This spell costs {U} less to cast for each instant and sorcery spell you've cast this turn." (Demilich; its graveyard cast is played in edh-next-68)
 *   CR 702.109a, 601.2f, 118.9   "Dash costs you pay cost {2} less." (Warbringer)
 */
import { describe, expect, it } from 'vitest';
import { applyAction, compileCard, type CardDef, type DecisionAnswer, type GameState, type ObjectId, type OracleCard, type TargetChoice } from '../../../src/index';
import { act, answer, find, findAll, passBoth, scenario } from '../../m3/scenario';
import { mpScenario, passUntil, drive as mpDrive } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, cost = '{0}', pt?: [string, string], colors: string[] = []): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors, keywords: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));

function drive(s0: GameState, targets: TargetChoice[][] = []): GameState {
  let s = s0;
  const q = [...targets];
  for (let guard = 0; guard < 60 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: q.shift() ?? [] });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: p.options.slice(0, p.min) } as DecisionAnswer);
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else if (p.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
}
function resolveAll(s0: GameState, targets: TargetChoice[][] = []): GameState {
  let s = drive(s0, targets);
  for (let i = 0; i < 12 && s.zones.stack.length > 0; i++) s = drive(passBoth(s), targets);
  return s;
}
const castBy = (s: GameState, name: string, player: string, targets: TargetChoice[][] = [], method?: string): GameState =>
  drive(act(s, { type: 'cast', player, card: find(s, name, 'hand', player), ...(method ? { method } : {}) } as never), targets);
const altOk = (s: GameState, name: string, player = 'p1'): boolean => applyAction(s, { type: 'cast', player, card: find(s, name, 'hand', player), method: 'alternative' } as never).error === undefined;
const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
/** p2 casts `name` while p1 holds priority in p1's main phase (p1 passes first), and it resolves; p1 has priority again. */
function opponentCasts(s0: GameState, name: string, targets: TargetChoice[][] = []): GameState {
  const s1 = drive(act(s0, { type: 'pass', player: s0.pending!.player }));
  return resolveAll(castBy(s1, name, 'p2', targets), targets);
}

describe('CR 118.9, 603.4, 102.3: "If an opponent had an artifact enter the battlefield under their control this turn, you may pay {1}{G} rather than pay this spell\'s mana cost." (Baloth Cage Trap)', () => {
  const TRAP = card('Test Cage Trap', 'Instant', "If an opponent had an artifact enter the battlefield under their control this turn, you may pay {0} rather than pay this spell's mana cost.\nYou gain 4 life.", '{3}{G}{G}');
  const GADGET = card('Test Gadget', 'Artifact', 'Flash');
  const IDOL = card('Test Idol', 'Enchantment', 'Flash');
  const defs = [TRAP, GADGET, IDOL];
  const board = (): GameState => scenario([], { defs, p1: { hand: ['Test Cage Trap', 'Test Gadget'] }, p2: { hand: ['Test Gadget', 'Test Idol'] } });
  it('is automated', () => { expect(full(TRAP)).toBe(true); });
  it('offered after an opponent put an artifact onto the battlefield', () => {
    let s = board();
    expect(altOk(s, 'Test Cage Trap')).toBe(false);
    s = opponentCasts(s, 'Test Gadget');
    expect(altOk(s, 'Test Cage Trap')).toBe(true);
  });
  it('negative: the caster\'s own artifact and an opponent\'s non-artifact do not count', () => {
    let s = board();
    s = resolveAll(castBy(s, 'Test Gadget', 'p1'));
    expect(altOk(s, 'Test Cage Trap')).toBe(false);
    s = opponentCasts(s, 'Test Idol');
    expect(altOk(s, 'Test Cage Trap')).toBe(false);
  });
});

describe('CR 118.9, 120.1, 400.7: "If you\'ve been dealt damage by two or more creatures this turn, you may pay {R} rather than pay this spell\'s mana cost." (Inferno Trap)', () => {
  const TRAP = card('Test Blaze Trap', 'Instant', "If you've been dealt damage by two or more creatures this turn, you may pay {0} rather than pay this spell's mana cost.\nYou gain 4 life.", '{3}{R}{R}');
  const PYRO = card('Test Pyro', 'Creature — Elemental', 'Flash\nWhen ~ enters, it deals 1 damage to target player.', '{0}', ['1', '1']);
  const BOLT = card('Test Spark', 'Instant', '~ deals 1 damage to target player.');
  const defs = [TRAP, PYRO, BOLT];
  const toP1: TargetChoice[][] = [[{ kind: 'player', id: 'p1' }]];
  const board = (): GameState => scenario([], { defs, p1: { hand: ['Test Blaze Trap'] }, p2: { hand: ['Test Pyro', 'Test Pyro', 'Test Spark', 'Test Spark'] } });
  const twice = (s: GameState, name: string): GameState => opponentCasts({ ...s }, name, toP1);
  it('is automated', () => { expect(full(TRAP)).toBe(true); });
  it('offered once two different creatures dealt damage to you this turn, not before', () => {
    let s = board();
    expect(altOk(s, 'Test Blaze Trap')).toBe(false);
    s = opponentCasts(s, 'Test Pyro', toP1);
    expect(life(s, 'p1')).toBe(19);
    expect(altOk(s, 'Test Blaze Trap')).toBe(false);
    s = drive(act(s, { type: 'pass', player: s.pending!.player }));
    s = resolveAll(castBy(s, 'Test Pyro', 'p2', toP1), toP1);
    expect(life(s, 'p1')).toBe(18);
    expect(altOk(s, 'Test Blaze Trap')).toBe(true);
  });
  it('negative: damage from spells that are not creatures does not count', () => {
    let s = board();
    s = opponentCasts(s, 'Test Spark', toP1);
    s = drive(act(s, { type: 'pass', player: s.pending!.player }));
    s = resolveAll(castBy(s, 'Test Spark', 'p2', toP1), toP1);
    expect(life(s, 'p1')).toBe(18);
    expect(altOk(s, 'Test Blaze Trap')).toBe(false);
    void twice;
  });
});

describe('CR 506.3, 508.1, 601.2f: "This spell costs {1} less to cast for each opponent you\'re attacking." (Astral Confrontation)', () => {
  const SPELL = card('Test Confront', 'Instant', "This spell costs {1} less to cast for each opponent you're attacking.\nYou gain 3 life.", '{2}');
  const SCOUT = card('Test Scout', 'Creature — Human Scout', '', '{0}', ['1', '1']);
  const defs = [SPELL, SCOUT];
  const attackWith = (defenders: string[]): GameState => {
    const s0 = mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Confront'], battlefield: ['Test Scout', 'Test Scout'] } } });
    const s1 = passUntil(s0, (t) => t.pending?.kind === 'declareAttackers' && t.pending.player === 'p1', 'the attack of p1');
    const scouts = findAll(s1, 'Test Scout', 'battlefield');
    return mpDrive(answer(s1, { kind: 'declareAttackers', attacks: scouts.map((id, i) => ({ attacker: id, defender: defenders[i]! })) }));
  };
  const castable = (s: GameState): boolean => applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Confront', 'hand', 'p1') } as never).error === undefined;
  it('is automated', () => { expect(full(SPELL)).toBe(true); });
  it('attacking two opponents makes the {2} spell free', () => { expect(castable(attackWith(['p2', 'p3']))).toBe(true); });
  it('negative: attacking one opponent with both creatures leaves it costing {1}, which cannot be paid with no lands', () => { expect(castable(attackWith(['p2', 'p2']))).toBe(false); });
  it('negative: outside combat the reduction is nothing', () => {
    const s0 = mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Confront'], battlefield: ['Test Scout'] } } });
    expect(castable(s0)).toBe(false);
  });
});

describe('CR 118.1, 118.9, 119.3: "If you control a Goblin, rather than pay this spell\'s mana cost, you may have each other player gain 6 life." (Reverent Silence, Skyshroud Cutter)', () => {
  const GIFT = card('Test Gift Pact', 'Instant', "If you control a Goblin, rather than pay this spell's mana cost, you may have each other player gain 6 life.\nYou gain 1 life.", '{3}{G}{G}');
  const IMP = card('Test Imp', 'Creature — Goblin', '', '{0}', ['1', '1']);
  const defs = [GIFT, IMP];
  const board = (goblin: boolean): GameState => mpScenario({ players: 3, defs, zones: { p1: { hand: ['Test Gift Pact'], battlefield: goblin ? ['Test Imp'] : [] } } });
  const lifeOf = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
  it('is automated', () => { expect(full(GIFT)).toBe(true); });
  it('with a Goblin the alternative cost is paid: every other player gains 6, the caster gains nothing from the cost', () => {
    const s0 = board(true);
    expect(altOk(s0, 'Test Gift Pact')).toBe(true);
    const s = resolveAll(castBy(s0, 'Test Gift Pact', 'p1', [], 'alternative'));
    expect(lifeOf(s, 'p2')).toBe(26);
    expect(lifeOf(s, 'p3')).toBe(26);
    expect(lifeOf(s, 'p1')).toBe(21);
  });
  it('negative: without a Goblin the alternative cost is not offered, and the normal cost is unaffordable with no lands', () => {
    const s0 = board(false);
    expect(altOk(s0, 'Test Gift Pact')).toBe(false);
    expect(applyAction(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Gift Pact', 'hand', 'p1') } as never).error).toBeDefined();
  });
});

describe('CR 119.7, 118.3: a cost that has each other player gain life can\'t be paid when one of them can\'t gain life', () => {
  const GIFT = card('Test Gift Pact', 'Instant', "If you control a Goblin, rather than pay this spell's mana cost, you may have each other player gain 6 life.\nYou gain 1 life.", '{3}{G}{G}');
  const IMP = card('Test Imp', 'Creature — Goblin', '', '{0}', ['1', '1']);
  const VOW = card('Test Frost Vow', 'Enchantment', "Your opponents can't gain life.");
  const defs = [GIFT, IMP, VOW];
  it('negative: with a permanent that stops an opponent gaining life the alternative cost is refused; without it, allowed', () => {
    const base = { players: 3, defs } as const;
    const ok = mpScenario({ ...base, zones: { p1: { hand: ['Test Gift Pact'], battlefield: ['Test Imp'] } } });
    const blocked = mpScenario({ ...base, zones: { p1: { hand: ['Test Gift Pact'], battlefield: ['Test Imp', 'Test Frost Vow'] } } });
    expect(altOk(ok, 'Test Gift Pact')).toBe(true);
    expect(altOk(blocked, 'Test Gift Pact')).toBe(false);
  });
});

describe('CR 601.2f, 118.7: "This spell costs {U} less to cast for each instant and sorcery spell you\'ve cast this turn." (Demilich)', () => {
  const LICH = card('Test Spell Wraith', 'Creature — Spirit', "This spell costs {U} less to cast for each instant and sorcery spell you've cast this turn.", '{U}{U}', ['2', '2'], ['U']);
  const FREE = card('Test Free Charm', 'Instant', 'You gain 1 life.');
  const FREE2 = card('Test Free Rite', 'Sorcery', 'You gain 1 life.');
  const BEAST = card('Test Free Beast', 'Creature — Beast', '', '{0}', ['1', '1']);
  const defs = [LICH, FREE, FREE2, BEAST];
  const board = (): GameState => scenario(['Island'], { defs, p1: { hand: ['Test Spell Wraith', 'Test Free Charm', 'Test Free Rite', 'Test Free Beast'], battlefield: ['Island'] } });
  const castable = (s: GameState): boolean => applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Spell Wraith', 'hand', 'p1') } as never).error === undefined;
  it('is automated', () => { expect(full(LICH)).toBe(true); });
  it('one Island pays {U}{U} only after an instant or sorcery has been cast this turn (one blue mana less)', () => {
    let s = board();
    expect(castable(s)).toBe(false);
    s = resolveAll(castBy(s, 'Test Free Charm', 'p1'));
    expect(castable(s)).toBe(true);
  });
  it('negative: a creature spell does not count, and no mana is saved without a cast', () => {
    let s = board();
    s = resolveAll(castBy(s, 'Test Free Beast', 'p1'));
    expect(castable(s)).toBe(false);
  });
  it('two casts make it free', () => {
    let s = scenario([], { defs, p1: { hand: ['Test Spell Wraith', 'Test Free Charm', 'Test Free Rite'] } });
    expect(castable(s)).toBe(false);
    s = resolveAll(castBy(s, 'Test Free Charm', 'p1'));
    expect(castable(s)).toBe(false);
    s = resolveAll(castBy(s, 'Test Free Rite', 'p1'));
    expect(castable(s)).toBe(true);
  });
});

describe('CR 702.109a, 601.2f, 118.9: "Dash costs you pay cost {2} less." (Warbringer)', () => {
  const FORGE = card('Test Dash Forge', 'Enchantment', 'Dash costs you pay cost {2} less.');
  const RAIDER = card('Test Dash Raider', 'Creature — Human Berserker', 'Dash {2}{R}', '{4}{R}', ['3', '1'], ['R']);
  const defs = [FORGE, RAIDER];
  const dashable = (s: GameState): boolean => applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Dash Raider', 'hand', 'p1'), method: 'dash' } as never).error === undefined;
  const normalOk = (s: GameState): boolean => applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Dash Raider', 'hand', 'p1') } as never).error === undefined;
  it('is automated', () => { expect(full(FORGE)).toBe(true); });
  it('with the Forge, one Mountain pays the dash cost {2}{R} less {2}', () => {
    const s = scenario(['Mountain'], { defs, p1: { hand: ['Test Dash Raider'], battlefield: ['Test Dash Forge', 'Mountain'] } });
    expect(dashable(s)).toBe(true);
  });
  it('negative: without the Forge one Mountain cannot pay the dash cost, and the normal mana cost gets no reduction', () => {
    const s = scenario(['Mountain'], { defs, p1: { hand: ['Test Dash Raider'], battlefield: ['Mountain'] } });
    expect(dashable(s)).toBe(false);
    const t = scenario(['Mountain'], { defs, p1: { hand: ['Test Dash Raider'], battlefield: ['Test Dash Forge', 'Mountain', 'Mountain', 'Mountain'] } });
    expect(normalOk(t)).toBe(false); // {4}{R} with three Mountains: the Forge reduces only the dash cost
  });
});
