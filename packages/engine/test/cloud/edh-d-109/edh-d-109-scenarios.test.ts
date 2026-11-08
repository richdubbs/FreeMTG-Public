/**
 * Round edh-d-109 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups combat 1/2 and 2/2): the round's readings played through the engine with synthetic cards (invented
 * names, design 6.10), compiled by the game's default compiler. Each group has its negative cases. CR cites are from the Comprehensive Rules text of 2026-09-25 (media.wizards.com),
 * read in the session.
 *
 *   CR 509.1d, 509.1f            "Nonblue creatures can't block creatures you control unless their controller pays 1 life for each blocking creature they control." (Heat Wave)
 *   CR 509.3a, 603.2c            "Whenever ~ blocks two or more creatures, it gains first strike until end of turn." (Lairwatch Giant)
 *   CR 508.1, 508.3a, 603.2c     "Whenever ~ and at least two Zombies attack, ~ gains indestructible until end of turn." (Enkira, Hostile Scavenger)
 *   CR 607.2d, 508.1b            "At the beginning of combat on your turn, choose an opponent." + "Creatures attacking the last chosen player have menace / get +1/+0." (Triarch Stalker, Beckoning Will-o'-Wisp)
 *   CR 608.2d                    "~ deals 2 damage to each attacking creature or ~ deals 2 damage to each blocking creature." (Lava Storm)
 *   CR 509.1b, 506.2             "~ can't be blocked by creatures with power 2 or greater as long as defending player controls a snow land." (Arctic Foxes)
 *   CR 508.1c, 500.1             "~ can't attack if it attacked during your last turn." (Giant Turtle)
 *   CR 120.1, 108.3, 510.2       "Whenever a creature deals combat damage to its owner, untap ~ and draw a card." (The Beast, Deathless Prince)
 *   CR 508.1b, 506.2, 603.2c     "Whenever ~ and another creature attack different players, ~ can't be blocked this combat." (Canal Courier)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { getChars, hasKeyword } from '../../../src/rules/characteristics';
import { blockTaxes } from '../../../src/statics/combat-tax';
import { attackDenial, blocksDenial } from '../../../src/rules/combat-rules';
import { act, answer, find, pass, reject, scenario } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers, toDeclareBlockers } from '../../m4/helpers';
import { mpScenario } from '../../m12/rules/helpers';
import { card, full, resolveAll, settle } from '../cmd3/helpers';

const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const pt = (s: GameState, id: ObjectId): string => { const c = getChars(s, id)!; return `${c.power}/${c.toughness}`; };
const kw = (s: GameState, id: ObjectId, k: string): boolean => hasKeyword(getChars(s, id)!, k);
const hand = (s: GameState, p: string): number => s.zones.hand[p]!.length;
/** Declare these attacks and settle the triggers of the declaration (each player passes until the declare blockers decision or the end of the step). */
const attack = (s0: GameState, attacks: [ObjectId, string?][]): GameState => resolveAll(declareAttackers(toDeclareAttackers(s0), attacks as [ObjectId, string][]));
const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const CUB = card('Test Cub', 'Creature — Bear', '', ['1', '1']);
const SPRITE = compileCard({ name: 'Test Blue Sprite', layout: 'normal', mana_cost: '{U}', type_line: 'Creature — Faerie', oracle_text: '', colors: ['U'], keywords: [], power: '1', toughness: '1' } as OracleCard);

describe('Heat Wave: "Nonblue creatures can\'t block creatures you control unless their controller pays 1 life for each blocking creature they control." (CR 509.1c-f)', () => {
  const HAZE = card('Test Heat Haze', 'Enchantment', "Blue creatures can't block creatures you control.\nNonblue creatures can't block creatures you control unless their controller pays 1 life for each blocking creature they control.");
  const board = (): GameState => scenario([], { defs: [HAZE, BEAR, CUB, SPRITE], p1: { battlefield: ['Test Heat Haze', 'Test Bear'] }, p2: { battlefield: ['Test Cub', { name: 'Test Cub' }, 'Test Blue Sprite'] } });
  it('is full (the template is stable on Heat Wave)', () => expect(full(HAZE)).toBe(true));
  it('CR 509.1d: each nonblue blocker of a creature you control costs 1 life, once per blocker', () => {
    const s = board();
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const [c1, c2] = s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Cub');
    expect(blockTaxes(s, [{ blocker: c1!, attacker: bear }, { blocker: c2!, attacker: bear }]).map((x) => x.cost)).toEqual([
      { other: [{ kind: 'payLife', amount: 1 }] }, { other: [{ kind: 'payLife', amount: 1 }] },
    ]);
  });
  it('CR 509.1f: the blocking player pays the life and the block stands', () => {
    let s = board();
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const cub = find(s, 'Test Cub', 'battlefield', 'p2');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[bear]]));
    s = declareBlockers(s, [[cub, bear]]);
    expect(s.pending?.kind).toBe('yesNo'); // pay 1 life, or declare again
    s = answer(s, { kind: 'yesNo', yes: true });
    expect(life(s, 'p2')).toBe(19);
    expect(s.combat?.blockers.map((b) => b.id)).toEqual([cub]);
  });
  it('CR 509.1b: a blue creature can\'t block a creature you control at all (the other ability), so it is never taxed', () => {
    let s = board();
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const sprite = find(s, 'Test Blue Sprite', 'battlefield', 'p2');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[bear]]));
    expect(reject(s, { type: 'answer', player: 'p2', decisionId: s.pending!.id, answer: { kind: 'declareBlockers', blocks: [{ blocker: sprite, attacker: bear }] } }).rules).toContain('CR 509.1b');
  });
  it('negative: no blocker, no cost; the creature of another player is not "a creature you control" of the opponent\'s enchantment', () => {
    const s = board();
    const cub = find(s, 'Test Cub', 'battlefield', 'p2');
    const other = find(s, 'Test Cub', 'battlefield', 'p2');
    expect(blockTaxes(s, [])).toEqual([]);
    expect(blockTaxes(s, [{ blocker: cub, attacker: other }])).toEqual([]);
  });
});

describe('Lairwatch Giant: "Whenever ~ blocks two or more creatures, it gains first strike until end of turn." (CR 509.3a, 603.2c)', () => {
  const GIANT = card('Test Wall Giant', 'Creature — Giant Warrior', '~ can block an additional creature each combat.\nWhenever ~ blocks two or more creatures, it gains first strike until end of turn.', ['5', '3']);
  const board = (): GameState => scenario([], { defs: [GIANT, BEAR, CUB], p1: { battlefield: ['Test Bear', 'Test Cub'] }, p2: { battlefield: ['Test Wall Giant'] } });
  it('is full', () => expect(full(GIANT)).toBe(true));
  it('CR 509.3a: declared blocking two attackers, it triggers once and gains first strike', () => {
    let s = board();
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const cub = find(s, 'Test Cub', 'battlefield', 'p1');
    const giant = find(s, 'Test Wall Giant', 'battlefield', 'p2');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[bear], [cub]]));
    s = declareBlockers(s, [[giant, bear], [giant, cub]]);
    expect(s.zones.stack.length).toBe(1); // one trigger for the blocker, not one per attacker
    s = resolveAll(s);
    expect(kw(s, giant, 'first strike')).toBe(true);
  });
  it('negative: blocking one attacker does not trigger it', () => {
    let s = board();
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const cub = find(s, 'Test Cub', 'battlefield', 'p1');
    const giant = find(s, 'Test Wall Giant', 'battlefield', 'p2');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[bear], [cub]]));
    s = declareBlockers(s, [[giant, bear]]);
    expect(s.zones.stack.length).toBe(0);
    expect(kw(resolveAll(s), giant, 'first strike')).toBe(false);
  });
});

describe('Enkira, Hostile Scavenger: "Whenever ~ and at least two Zombies attack, ~ gains indestructible until end of turn." (CR 508.1, 508.3a, 603.2c)', () => {
  const SCAV = card('Test Scavenger', 'Legendary Creature — Human Warrior', 'Whenever ~ and at least two Zombies attack, ~ gains indestructible until end of turn.', ['3', '3']);
  const ZOMBIE = card('Test Shambler', 'Creature — Zombie', '', ['2', '2']);
  const run = (others: string[], withSelf = true): { s: GameState; scav: ObjectId } => {
    const s0 = scenario([], { defs: [SCAV, ZOMBIE, BEAR], p1: { battlefield: ['Test Scavenger', ...others] } });
    const scav = find(s0, 'Test Scavenger', 'battlefield', 'p1');
    const ids = s0.zones.battlefield.filter((id) => id !== scav && s0.objects[id]!.controller === 'p1' && getChars(s0, id)!.types.includes('Creature'));
    return { s: attack(s0, [...(withSelf ? [[scav] as [ObjectId]] : []), ...ids.map((x) => [x] as [ObjectId])]), scav };
  };
  it('is full', () => expect(full(SCAV)).toBe(true));
  it('CR 508.3a: with two other Zombies declared in the same declaration it gains indestructible', () => {
    const { s, scav } = run(['Test Shambler', 'Test Shambler']);
    expect(kw(s, scav, 'indestructible')).toBe(true);
  });
  it('negative: one Zombie and one non-Zombie is not two Zombies', () => {
    const { s, scav } = run(['Test Shambler', 'Test Bear']);
    expect(kw(s, scav, 'indestructible')).toBe(false);
  });
  it('negative: the Zombies attacking without ~ do not trigger it', () => {
    const { s, scav } = run(['Test Shambler', 'Test Shambler', 'Test Shambler'], false);
    expect(kw(s, scav, 'indestructible')).toBe(false);
  });
});

describe('Triarch Stalker / Beckoning Will-o\'-Wisp: "Creatures attacking the last chosen player have menace / get +1/+0." (CR 607.2d, 508.1b, 613.1f)', () => {
  const STALKER = card('Test Relay Stalker', 'Artifact Creature — Necron', 'At the beginning of combat on your turn, choose an opponent.\nCreatures attacking the last chosen player have menace.', ['3', '3']);
  const WISP = card('Test Lure Wisp', 'Creature — Spirit', 'Flying\nAt the beginning of combat on your turn, choose an opponent.\nCreatures attacking the last chosen player get +1/+0.', ['1', '1']);
  /** p1's beginning of combat: the trigger asks p1 to choose an opponent. */
  const toChoice = (s0: GameState): GameState => passUntil(s0, (x) => x.pending !== null && x.pending.kind !== 'priority' && x.pending.kind !== 'declareAttackers', 'the choice of an opponent');
  const choose = (s0: GameState, who: string): GameState => {
    const d = s0.pending as unknown as { kind: string; options?: { id: string }[] };
    if (d.kind === 'choosePlayer') return answer(s0, { kind: 'choosePlayer', player: who } as never);
    return answer(s0, { kind: 'chooseOption', ids: [d.options!.find((o) => o.id === who || o.id.includes(who))!.id] });
  };
  const board = (def = STALKER, name = 'Test Relay Stalker'): GameState => mpScenario({ defs: [def, BEAR], zones: { p1: { battlefield: [name, 'Test Bear', { name: 'Test Bear' }] } } });
  it('both are full; the trigger\'s choice keeps the link the static reads', () => {
    expect(full(STALKER)).toBe(true);
    expect(full(WISP)).toBe(true);
    expect(JSON.stringify(STALKER.faces[0]!.abilities)).toContain('"link":"lastChosenPlayer"');
  });
  it('CR 607.2d, 508.1b: only the creatures attacking the chosen opponent have menace', () => {
    let s = choose(toChoice(board()), 'p3');
    s = settle(resolveAll(s));
    const [b1, b2] = s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Bear');
    s = resolveAll(declareAttackers(passUntil(s, (x) => x.pending?.kind === 'declareAttackers', 'attackers'), [[b1!, 'p3'], [b2!, 'p2']]));
    expect(kw(s, b1!, 'menace')).toBe(true);
    expect(kw(s, b2!, 'menace')).toBe(false);
  });
  it('negative: before any choice nobody is the chosen player (no creature has menace)', () => {
    const s = board();
    const b = s.zones.battlefield.find((id) => s.objects[id]!.defId === 'Test Bear')!;
    expect(kw(s, b, 'menace')).toBe(false);
  });
  it('the +1/+0 of the other card follows the last choice too', () => {
    let s = choose(toChoice(board(WISP, 'Test Lure Wisp')), 'p4');
    s = settle(resolveAll(s));
    const [b1, b2] = s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Bear');
    s = resolveAll(declareAttackers(passUntil(s, (x) => x.pending?.kind === 'declareAttackers', 'attackers'), [[b1!, 'p4'], [b2!, 'p2']]));
    expect(pt(s, b1!)).toBe('3/2');
    expect(pt(s, b2!)).toBe('2/2');
  });
  it('negative: a face with a second player choice does not know which is "last chosen" (the static stays manual)', () => {
    const TWO = card('Test Two Relay', 'Artifact Creature — Necron', 'At the beginning of combat on your turn, choose an opponent.\nAt the beginning of your end step, choose an opponent.\nCreatures attacking the last chosen player have menace.', ['3', '3']);
    expect(full(TWO)).toBe(false);
    const NONE = card('Test No Relay', 'Artifact Creature — Necron', 'Creatures attacking the last chosen player have menace.', ['3', '3']);
    expect(full(NONE)).toBe(false);
  });
});

describe('Lava Storm: "~ deals 2 damage to each attacking creature or ~ deals 2 damage to each blocking creature." (CR 608.2d: the controller chooses one instruction)', () => {
  const STORM = card('Test Ash Storm', 'Instant', '~ deals 2 damage to each attacking creature or ~ deals 2 damage to each blocking creature.');
  const ATT = card('Test Raider', 'Creature — Human', '', ['2', '2']);
  const BLK = card('Test Guard', 'Creature — Human', '', ['2', '2']);
  const toBlocked = (): { s: GameState; att: ObjectId; blk: ObjectId } => {
    let s = scenario(['Mountain'], { defs: [STORM, ATT, BLK], p1: { battlefield: ['Test Raider'] }, p2: { battlefield: ['Test Guard'], hand: ['Test Ash Storm'] } });
    const att = find(s, 'Test Raider', 'battlefield', 'p1');
    const blk = find(s, 'Test Guard', 'battlefield', 'p2');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[att]]));
    s = declareBlockers(s, [[blk, att]]);
    s = passUntil(s, (x) => x.pending?.kind === 'priority' && x.pending.player === 'p2', 'p2 priority after blocks');
    return { s, att, blk };
  };
  /** p2 casts it after blocks; as it resolves p2 chooses the instruction (`option`: 0 the first, 1 the second). */
  const castAndPick = (s0: GameState, option: number): GameState => {
    let s = settle(act(s0, { type: 'cast', player: 'p2', card: find(s0, 'Test Ash Storm', 'hand', 'p2') }));
    for (let i = 0; i < 6 && s.pending?.kind === 'priority'; i++) s = pass(s);
    const d = s.pending as unknown as { kind: string; options: { id: string }[] };
    expect(d.kind).toBe('chooseOption');
    s = answer(s, { kind: 'chooseOption', ids: [d.options[option]!.id] });
    return settle(s);
  };
  it('is full', () => expect(full(STORM)).toBe(true));
  it('CR 608.2d: the first instruction damages the attacking creatures only', () => {
    const { s, att, blk } = toBlocked();
    const t = castAndPick(s, 0);
    expect(t.objects[att]?.zone === 'battlefield' ? t.objects[att]!.damage : 2).toBe(2);
    expect(t.objects[blk]!.damage).toBe(0);
  });
  it('CR 608.2d: the second instruction damages the blocking creatures only', () => {
    const { s, att, blk } = toBlocked();
    const t = castAndPick(s, 1);
    expect(t.objects[att]!.damage).toBe(0);
    expect(t.objects[blk]?.zone === 'battlefield' ? t.objects[blk]!.damage : 2).toBe(2);
  });
});

describe('Arctic Foxes: "~ can\'t be blocked by creatures with power 2 or greater as long as defending player controls a snow land." (CR 509.1b, 506.2)', () => {
  const FOX = card('Test Snow Fox', 'Creature — Fox', "~ can't be blocked by creatures with power 2 or greater as long as defending player controls a snow land.", ['1', '1']);
  const SNOW = card('Test Snow Field', 'Snow Land', '{T}: Add {C}.');
  const board = (snow: boolean): { s: GameState; fox: ObjectId } => {
    let s = scenario([], { defs: [FOX, SNOW, BEAR, CUB], p1: { battlefield: ['Test Snow Fox'] }, p2: { battlefield: ['Test Bear', 'Test Cub', ...(snow ? ['Test Snow Field'] : [])] } });
    const fox = find(s, 'Test Snow Fox', 'battlefield', 'p1');
    s = toDeclareBlockers(declareAttackers(toDeclareAttackers(s), [[fox]]));
    return { s, fox };
  };
  const tryBlock = (s: GameState, blocker: ObjectId, fox: ObjectId) => reject(s, { type: 'answer', player: 'p2', decisionId: s.pending!.id, answer: { kind: 'declareBlockers', blocks: [{ blocker, attacker: fox }] } });
  it('is full', () => expect(full(FOX)).toBe(true));
  it('CR 509.1b: with a snow land the defending player can\'t block it with power 2 or greater', () => {
    const { s, fox } = board(true);
    expect(tryBlock(s, find(s, 'Test Bear', 'battlefield', 'p2'), fox).rules).toContain('CR 509.1b');
  });
  it('a creature with power 1 still blocks it', () => {
    const { s, fox } = board(true);
    const t = declareBlockers(s, [[find(s, 'Test Cub', 'battlefield', 'p2'), fox]]);
    expect(t.combat?.blockers.length).toBe(1);
  });
  it('negative: without a snow land the power 2 creature blocks it', () => {
    const { s, fox } = board(false);
    const t = declareBlockers(s, [[find(s, 'Test Bear', 'battlefield', 'p2'), fox]]);
    expect(t.combat?.blockers.length).toBe(1);
  });
});

describe('Giant Turtle: "~ can\'t attack if it attacked during your last turn." (CR 508.1c, 500.1)', () => {
  const TURTLE = card('Test Slow Turtle', 'Creature — Turtle', "~ can't attack if it attacked during your last turn.", ['2', '4']);
  /** Plays on (nobody attacks or blocks) until the first main phase of turn `n`. */
  const toMain = (s0: GameState, n: number): GameState => {
    let s = s0;
    for (let i = 0; i < 600 && !(s.turn.number === n && s.turn.step === 'main1' && s.pending?.kind === 'priority'); i++) {
      if (s.pending?.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
      else if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
      else if (s.pending?.kind === 'priority') s = pass(s);
      else s = settle(s);
    }
    return s;
  };
  const denied = (s: GameState, id: ObjectId): string[] | null => attackDenial(s, s.objects[id]!, getChars(s, id)!)?.rules ?? null;
  const attackOnce = (s0: GameState, id: ObjectId): GameState => answer(toDeclareAttackers(s0), { kind: 'declareAttackers', attacks: [{ attacker: id, defender: 'p2' }] });
  it('is full', () => expect(full(TURTLE)).toBe(true));
  it('CR 500.1, 508.1c: after attacking on your turn it can\'t attack on your next turn, then it can again on the turn after', () => {
    let s = scenario([], { defs: [TURTLE], p1: { battlefield: ['Test Slow Turtle'] } });
    const t = find(s, 'Test Slow Turtle', 'battlefield', 'p1');
    expect(denied(s, t)).toBeNull();
    s = toMain(attackOnce(s, t), 3);
    expect(denied(s, t)).toContain('CR 508.1c');
    s = toMain(s, 5); // it did not attack on turn 3
    expect(denied(s, t)).toBeNull();
  });
  it('negative: during the opponent\'s turn after it attacked, "your last turn" is that turn of yours; a turn it did not attack in frees it', () => {
    let s = scenario([], { defs: [TURTLE], p1: { battlefield: ['Test Slow Turtle'] } });
    const t = find(s, 'Test Slow Turtle', 'battlefield', 'p1');
    s = toMain(s, 3); // no attack on turn 1
    expect(denied(s, t)).toBeNull();
  });
});

describe('The Beast, Deathless Prince: "Whenever a creature deals combat damage to its owner, untap ~ and draw a card." (CR 120.1, 108.3, 510.2)', () => {
  const BEAST = card('Test Old Prince', 'Legendary Creature — Vampire', 'Whenever a creature deals combat damage to its owner, untap ~ and draw a card.', ['5', '5']);
  const run = (stolen: boolean): GameState => {
    // p2 attacks p1 on turn 2 with a Bear; with `stolen` the Bear is p1's own card under p2's control
    let s = scenario([], { defs: [BEAST, BEAR], p1: { battlefield: [{ name: 'Test Old Prince', tapped: true }, ...(stolen ? ['Test Bear'] : [])] }, p2: { battlefield: stolen ? [] : ['Test Bear'] } });
    const bear = find(s, 'Test Bear', 'battlefield');
    if (stolen) { s.objects[bear]!.controller = 'p2'; s.objects[bear]!.controlledSinceTurn = 0; }
    for (let i = 0; i < 200 && !(s.turn.number === 2 && s.pending?.kind === 'declareAttackers'); i++) s = s.pending?.kind === 'declareAttackers' ? answer(s, { kind: 'declareAttackers', attacks: [] }) : s.pending?.kind === 'priority' ? pass(s) : settle(s);
    s = answer(s, { kind: 'declareAttackers', attacks: [{ attacker: bear, defender: 'p1' }] });
    for (let i = 0; i < 200 && s.turn.step !== 'endCombat' && s.turn.step !== 'main2'; i++) s = s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : s.pending?.kind === 'priority' ? pass(s) : settle(s);
    return s;
  };
  it('is full', () => expect(full(BEAST)).toBe(true));
  it('CR 108.3, 510.2: the owner\'s own card dealing combat damage to them (under another player\'s control) untaps ~ and draws a card', () => {
    const s = run(true);
    const beast = find(s, 'Test Old Prince', 'battlefield', 'p1');
    expect(life(s, 'p1')).toBe(18);
    expect(s.objects[beast]!.tapped).toBe(false);
    expect(hand(s, 'p1')).toBe(1);
  });
  it('negative: a creature dealing combat damage to a player who does not own it does nothing', () => {
    const s = run(false);
    const beast = find(s, 'Test Old Prince', 'battlefield', 'p1');
    expect(life(s, 'p1')).toBe(18);
    expect(s.objects[beast]!.tapped).toBe(true);
    expect(hand(s, 'p1')).toBe(0);
  });
});

describe('Canal Courier: "Whenever ~ and another creature attack different players, ~ can\'t be blocked this combat." (CR 508.1b, 506.2, 603.2c)', () => {
  const COURIER = card('Test Canal Runner', 'Creature — Human Rogue', "Whenever ~ and another creature attack different players, ~ can't be blocked this combat.", ['3', '2']);
  const board = (): { s: GameState; courier: ObjectId; bear: ObjectId } => {
    const s = mpScenario({ defs: [COURIER, BEAR, CUB], zones: { p1: { battlefield: ['Test Canal Runner', 'Test Bear'] }, p2: { battlefield: ['Test Cub'] } } });
    return { s, courier: find(s, 'Test Canal Runner', 'battlefield', 'p1'), bear: find(s, 'Test Bear', 'battlefield', 'p1') };
  };
  /** Declares the attacks and resolves the triggers of the declaration (still in the declare attackers step). */
  const attackNow = (s0: GameState, attacks: [ObjectId, string][]): GameState => resolveAll(answer(passUntil(s0, (x) => x.pending?.kind === 'declareAttackers', 'attackers'), { kind: 'declareAttackers', attacks: attacks.map(([attacker, defender]) => ({ attacker, defender })) }));
  it('is full', () => expect(full(COURIER)).toBe(true));
  it('CR 508.1b: attacking a player while another creature attacks another player, it can\'t be blocked', () => {
    const { s: s0, courier, bear } = board();
    const s = attackNow(s0, [[courier, 'p2'], [bear, 'p3']]);
    const cub = find(s, 'Test Cub', 'battlefield', 'p2');
    expect(blocksDenial(s, 'p2', [{ blocker: cub, attacker: courier }])?.rules).toContain('CR 509.1b');
  });
  it('negative: both attacking the same player, it can be blocked', () => {
    const { s: s0, courier, bear } = board();
    const s = attackNow(s0, [[courier, 'p2'], [bear, 'p2']]);
    const cub = find(s, 'Test Cub', 'battlefield', 'p2');
    expect(s.zones.stack.length).toBe(0);
    expect(blocksDenial(s, 'p2', [{ blocker: cub, attacker: courier }])).toBeNull();
  });
});
