/**
 * Coordinator E, round edh-e-50 (second batch, group combat 2/2): the round's readings and engine changes played through the engine with synthetic cards (invented names and
 * wordings, design 6.10), compiled by the game's default compiler. Alice (p1) is the active player of turn 1. Each test names the rule it checks, with its negative case.
 * CR cites are from memory, not checked against the Comprehensive Rules text (cloud session; listed as unverified in the record).
 *
 *   CR 302.6, 400.7, 508.1d, 603.7  "Choose target non-Wall creature the active player has controlled continuously since the beginning of the turn ... Activate only during an opponent's turn, before attackers are declared." (Nettling Imp, Norritt)
 *   CR 120.1, 510.2, 608.2c         "If it was dealt noncombat damage this turn, ~ deals 3 damage to it and you gain 3 life. Otherwise, ..." (Grisly Sigil)
 *   CR 302.6, 508.1, 603.4          "At the beginning of your end step, if ~ didn't attack or come under your control this turn, sacrifice it." (Mad Dog)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type OracleCard } from '../../../src/index';
import { requirementsFor } from '../../../src/rules/requirements';
import { act, answer, castAuto, find, findAll, legal, life, pass, put, scenario } from '../../m3/scenario';
import { clone } from '../../../src/util/clone';
import { declareAttackers, inGraveyard, onBattlefield, passUntil, runCombat, toDeclareAttackers, toStep, tweak } from '../../m4/helpers';

function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');

const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const GOBLIN = card('Test Goblin', 'Creature — Goblin', '', ['1', '1']);
const ELF = card('Test Elf', 'Creature — Elf', '', ['1', '1']);
const WALL = card('Test Wall', 'Creature — Wall', '', ['0', '4']);
const GIANT = card('Test Giant', 'Creature — Giant', '', ['5', '5']);

/**
 * Pass priority to the end step of the turn (no attack unless `attackers` names creatures that attack, no blocks), then let what the end step put on the stack resolve. Stops early if `stop` holds.
 */
function toEndStep(s0: GameState, attackers: string[] = []): GameState {
  let s = s0;
  for (let i = 0; i < 120; i++) {
    const d = s.pending;
    if (!d || s.result) return s;
    if (s.turn.step === 'end' && d.kind === 'priority' && s.zones.stack.length === 0) return s;
    if (d.kind === 'declareAttackers') s = declareAttackers(s, attackers.map((a) => [a] as [string]));
    else if (d.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else s = pass(s);
  }
  throw new Error('Never reached the end step');
}

/** Everything on the battlefield has been there since before turn 1 began (no summoning sickness, controlled since turn 0), except the objects `fresh` names (they came under control this turn). */
const settle = (s: GameState, fresh: string[] = []): GameState => tweak(s, (g) => { for (const id of g.zones.battlefield) g.objects[id]!.controlledSinceTurn = fresh.includes(id) ? g.turn.number : -1; });

// ---- Nettling Imp / Norritt ------------------------------------------------------------------------------------------------------------------------------------------
const IMP_TEXT = "{T}: Choose target non-Wall creature the active player has controlled continuously since the beginning of the turn. That creature attacks this turn if able. Destroy it at the beginning of the next end step if it didn't attack this turn. Activate only during an opponent's turn, before attackers are declared.";
const IMP = card('Test Imp', 'Creature — Imp', IMP_TEXT, ['1', '1']);
const NORRITT = card('Test Norritt', 'Creature — Imp', "{T}: Choose target non-Wall creature the active player has controlled continuously since the beginning of the turn. That creature attacks this turn if able. Destroy it at the beginning of the next end step if it didn't attack this turn. Activate only before attackers are declared.", ['1', '1']);
describe('CR 302.6, 508.1d, 603.7: "Choose target non-Wall creature the active player has controlled continuously since the beginning of the turn ..." (Nettling Imp, Norritt)', () => {
  it('are automated', () => { expect(full(IMP)).toBe(true); expect(full(NORRITT)).toBe(true); });
  // p1 is the active player at turn 1; p2 holds the Imp. The Goblin came under p1's control this turn.
  const setup = (imp: CardDef = IMP): GameState => {
    const s0 = scenario([], { p1: { battlefield: ['Test Bear', 'Test Goblin', 'Test Wall'] }, p2: { battlefield: [imp.faces[0]!.name, 'Test Elf'] }, defs: [BEAR, GOBLIN, ELF, WALL, imp] });
    return settle(s0, [find(s0, 'Test Goblin', 'battlefield')]);
  };
  const targets = (s: GameState, player: 'p1' | 'p2', imp: string): { names: string[]; state: GameState } => {
    const a = legal(s, player, 'activate').find((l) => l.action.type === 'activate' && l.action.source === find(s, imp, 'battlefield'));
    expect(a, 'the activation is offered').toBeDefined();
    const t = act(s, a!.action);
    expect(t.pending?.kind).toBe('chooseTargets');
    const objects = (t.pending as unknown as { objects: string[] }).objects;
    return { names: objects.map((o) => t.defs[t.objects[o]!.defId]!.name).sort(), state: t };
  };
  it('only a non-Wall creature of the active player that was under their control before the turn began is a legal target: not the Goblin that arrived this turn, not the Wall, not the Imp\'s own side', () => {
    const s = pass(setup()); // p1 passes in the precombat main phase: Bob has priority
    expect(targets(s, 'p2', 'Test Imp').names).toEqual(['Test Bear']);
  });
  it('negative: a creature whose control changed this turn is not a target either (control began this turn)', () => {
    const s0 = setup();
    const s1 = tweak(s0, (g) => { g.objects[find(s0, 'Test Bear', 'battlefield')]!.controlledSinceTurn = g.turn.number; });
    const s = pass(s1);
    expect(legal(s, 'p2', 'activate').length, 'no legal target: the ability cannot be activated').toBe(0);
  });
  it('the chosen creature attacks if able; if it attacked it survives the end step, if it could not it is destroyed', () => {
    const s0 = pass(setup());
    const { state } = targets(s0, 'p2', 'Test Imp');
    let t = answer(state, { kind: 'chooseTargets', targets: [{ kind: 'object', id: find(s0, 'Test Bear', 'battlefield') }] } as never);
    t = pass(pass(t)); // both pass: the Imp's ability resolves
    const bear = find(t, 'Test Bear', 'battlefield');
    expect(requirementsFor(t, 'attack', 'p1').map((r) => r.creature)).toEqual([bear]);
    // it could not attack: tapped (so the requirement is void), the delayed trigger destroys it at the next end step
    const tapped = tweak(t, (g) => { g.objects[bear]!.tapped = true; });
    const after = toEndStep(tapped);
    expect(inGraveyard(after, 'Test Bear', 'p1')).toBe(true);
  });
  it('negative: when the chosen creature attacks it is not destroyed', () => {
    const s0 = pass(setup());
    const { state } = targets(s0, 'p2', 'Test Imp');
    let t = answer(state, { kind: 'chooseTargets', targets: [{ kind: 'object', id: find(s0, 'Test Bear', 'battlefield') }] } as never);
    t = pass(pass(t));
    const bear = find(t, 'Test Bear', 'battlefield');
    const end = toEndStep(t, [bear]);
    expect(end.turn.step).toBe('end');
    expect(onBattlefield(end, 'Test Bear', 'p1')).toBe(true);
    expect(inGraveyard(end, 'Test Bear', 'p1')).toBe(false);
  });
  it('"Activate only during an opponent\'s turn": the controller cannot activate it on their own turn', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Imp', 'Test Bear'] }, p2: { battlefield: ['Test Bear'] }, defs: [BEAR, IMP] });
    const s = settle(s0);
    expect(legal(s, 'p1', 'activate').length).toBe(0);
  });
  it('"before attackers are declared": offered in the beginning of combat step, not once attackers are declared (the Imp is Bob\'s, the turn Alice\'s)', () => {
    const s0 = setup();
    const bc = toStep(s0, 'beginCombat');
    const b = pass(bc); // Alice passes, Bob has priority in the beginning of combat step
    expect(b.pending?.player).toBe('p2');
    expect(legal(b, 'p2', 'activate').length).toBeGreaterThan(0);
    const bear = find(s0, 'Test Bear', 'battlefield');
    const atk = declareAttackers(toDeclareAttackers(s0), [[bear]]);
    const after = passUntil(atk, (x) => x.turn.step === 'declareAttackers' && x.pending?.player === 'p2', 'Bob\'s priority in the declare attackers step', 20);
    expect(legal(after, 'p2', 'activate').length, 'no activation once attackers are declared').toBe(0);
  });
  it('Norritt: "Activate only before attackers are declared" (any turn): offered to Bob in Alice\'s turn and to Alice in her own', () => {
    const s0 = scenario([], { p1: { battlefield: ['Test Norritt', 'Test Bear'] }, p2: { battlefield: ['Test Norritt'] }, defs: [BEAR, NORRITT] });
    const s = settle(s0);
    expect(legal(s, 'p1', 'activate').length, 'Alice, active, before attackers').toBeGreaterThan(0);
  });
});

// ---- Grisly Sigil -----------------------------------------------------------------------------------------------------------------------------------------------------
const SIGIL = card('Test Sigil', 'Sorcery', 'Choose target creature or planeswalker. If it was dealt noncombat damage this turn, ~ deals 3 damage to it and you gain 3 life. Otherwise, ~ deals 1 damage to it and you gain 1 life.');
const PING = card('Test Ping', 'Instant', '~ deals 1 damage to target creature.');
describe('CR 120.1, 510.2, 608.2c: "If it was dealt noncombat damage this turn, ~ deals 3 damage to it and you gain 3 life. Otherwise, ..." (Grisly Sigil)', () => {
  it('is automated', () => { expect(full(SIGIL)).toBe(true); });
  const setup = (): GameState => settle(scenario([], { p1: { hand: ['Test Sigil', 'Test Ping'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Giant'] }, defs: [BEAR, GIANT, SIGIL, PING] }));
  const cast = (s: GameState, name: string, target: string): GameState => {
    let t = castAuto(s, name);
    if (t.pending?.kind === 'chooseTargets') t = answer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: target }] } as never);
    while (t.pending && t.pending.kind === 'payCost') t = answer(t, { kind: 'payCost', auto: true });
    t = pass(pass(t)); // both pass: it resolves
    return t;
  };
  const damageOf = (s: GameState, id: string): number => s.objects[id]!.damage;
  it('after a noncombat 1 damage this turn, the Sigil deals 3 more and you gain 3', () => {
    const s0 = setup();
    const giant = find(s0, 'Test Giant', 'battlefield');
    const s1 = cast(s0, 'Test Ping', giant);
    expect(damageOf(s1, giant)).toBe(1);
    const before = life(s1, 'p1');
    const s2 = cast(s1, 'Test Sigil', giant);
    expect(damageOf(s2, giant)).toBe(4);
    expect(life(s2, 'p1')).toBe(before + 3);
  });
  it('negative: with no damage this turn the Sigil deals only 1 and you gain only 1', () => {
    const s0 = setup();
    const giant = find(s0, 'Test Giant', 'battlefield');
    const before = life(s0, 'p1');
    const s = cast(s0, 'Test Sigil', giant);
    expect(damageOf(s, giant)).toBe(1);
    expect(life(s, 'p1')).toBe(before + 1);
  });
  it('negative: combat damage alone is not noncombat damage: the creature that was dealt combat damage this turn takes 1 and you gain 1', () => {
    const s0 = setup();
    const bear = find(s0, 'Test Bear', 'battlefield');
    const giant = find(s0, 'Test Giant', 'battlefield');
    // the Bear attacks, the Giant blocks: the Giant is dealt 2 combat damage
    let t = runCombat(s0, { attack: [[bear]], block: [[giant, bear]] });
    t = passUntil(t, (x) => x.turn.step === 'main2' && x.pending?.kind === 'priority', 'the second main phase', 20);
    const dmg = damageOf(t, giant);
    expect(dmg).toBe(2);
    const before = life(t, 'p1');
    const u = cast(t, 'Test Sigil', giant);
    expect(damageOf(u, giant)).toBe(dmg + 1);
    expect(life(u, 'p1')).toBe(before + 1);
  });
});

// ---- Mad Dog ----------------------------------------------------------------------------------------------------------------------------------------------------------
const DOG = card('Test Dog', 'Creature — Dog', "At the beginning of your end step, if this creature didn't attack or come under your control this turn, sacrifice it.", ['3', '1']);
describe('CR 302.6, 508.1, 603.4: "At the beginning of your end step, if ~ didn\'t attack or come under your control this turn, sacrifice it." (Mad Dog)', () => {
  it('is automated', () => { expect(full(DOG)).toBe(true); });
  const setup = (fresh: boolean): GameState => {
    const s0 = scenario([], { p1: { battlefield: ['Test Dog'] }, p2: { battlefield: ['Test Wall'] }, defs: [DOG, WALL] });
    return settle(s0, fresh ? [find(s0, 'Test Dog', 'battlefield')] : []);
  };
  const endStep = (s: GameState): GameState => toEndStep(s);
  it('a Dog that has been yours since before the turn and did not attack is sacrificed at your end step', () => {
    const s = endStep(setup(false));
    expect(inGraveyard(s, 'Test Dog', 'p1')).toBe(true);
  });
  it('negative: a Dog that attacked this turn is kept', () => {
    const s0 = setup(false);
    const dog = find(s0, 'Test Dog', 'battlefield');
    const t = toEndStep(s0, [dog]);
    expect(t.turn.step).toBe('end');
    expect(onBattlefield(t, 'Test Dog', 'p1')).toBe(true);
  });
  it('negative: a Dog that came under your control this turn is kept (it is not sacrificed even though it did not attack)', () => {
    const s = endStep(setup(true));
    expect(onBattlefield(s, 'Test Dog', 'p1')).toBe(true);
    expect(inGraveyard(s, 'Test Dog', 'p1')).toBe(false);
  });
});

void findAll;
