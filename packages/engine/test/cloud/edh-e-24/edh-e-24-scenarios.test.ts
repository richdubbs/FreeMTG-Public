/**
 * edh-e-24 (Commander coordinator E, EDHREC players-life group): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. Scryfall rulings were fetched in the cloud
 * session (2004-10-04 rhystic order, 2005-06-01 Blood Clock, 2016-01-22/04-08 Remorseless Punishment, 2017-02-09 Perilous Predicament, 2007-05-01 Even the Odds).
 *
 *   CR 603.7, 603.7c, 120.2     "Until end of turn, whenever target creature deals damage, you gain that much life." / "Whenever target creature deals damage this turn, ..."
 *   CR 118.12, 118.12a, 101.4   "<effect> unless any player pays {2}" (additional pump), "Then if any player pays {2}, discard three cards."
 *   CR 118.12a, 608.2d, 400.7   "At the beginning of each player's upkeep, that player returns a permanent they control to its owner's hand unless they pay 2 life."
 *   CR 118.12a, 701.9a, 701.21a "Target opponent loses 5 life unless that player discards two cards or sacrifices a creature of their choice. Repeat this process once."
 *   CR 701.21a, 608.2d          "Each opponent sacrifices an artifact creature and a nonartifact creature of their choice."
 *   CR 601.3, 102.2, 102.3      "Cast this spell only if you control fewer creatures than each opponent."
 *   CR 701.9a, 608.2c, 119.3    "Each player discards a card. Then each player who didn't discard a creature card this way loses 4 life."
 */
import { describe, expect, it } from 'vitest';
import { applyAction, compileCard, getChars, type CardDef, type DecisionAnswer, type GameState, type ObjectId, type OracleCard, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find, pass } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, toDeclareAttackers } from '../../m4/helpers';
import { mpScenario, lifeOf } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, cost = '{0}', pt?: [string, string], colors: string[] = []): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors, keywords: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
const pl = (id: PlayerId): TargetChoice => ({ kind: 'player', id } as never);
const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const on = (s: GameState, name: string, p?: PlayerId): ObjectId[] => s.zones.battlefield.filter((id) => nameOf(s, id) === name && (p === undefined || s.objects[id]!.controller === p));
const inZone = (s: GameState, z: 'hand' | 'graveyard' | 'library', p: PlayerId): string[] => s.zones[z][p]!.map((id) => nameOf(s, id));
const pt = (s: GameState, id: ObjectId): string => `${String(getChars(s, id).power)}/${String(getChars(s, id).toughness)}`;

interface Policy {
  /** yes/no answers by the asked player (default no). */
  yes?: Partial<Record<PlayerId, boolean>>;
  /** targets for the next target decisions, in order. */
  targets?: TargetChoice[][];
  /** objects chosen by the asked player: card names in order of preference (default: the first options). */
  pick?: Partial<Record<PlayerId, string[]>>;
  /** numbers (default the minimum). */
  asked?: string[];
}
/** Answer every decision until priority comes back with an empty stack or the stack is just passed; records what was asked. */
function settle(s0: GameState, pol: Policy = {}): GameState {
  let s = s0;
  const targets = [...(pol.targets ?? [])];
  for (let g = 0; g < 200; g++) {
    const p = s.pending as { kind: string; player: PlayerId; options?: ObjectId[]; min?: number; max?: number } | undefined;
    if (p && p.kind !== 'priority') {
      pol.asked?.push(`${p.player}:${p.kind}`);
      if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: pol.yes?.[p.player] ?? false });
      else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: targets.shift() ?? [] } as DecisionAnswer);
      else if (p.kind === 'chooseObjects') {
        const opts = p.options ?? [];
        const want = pol.pick?.[p.player] ?? [];
        const chosen: ObjectId[] = [];
        for (const n of want) { const id = opts.find((o) => nameOf(s, o) === n && !chosen.includes(o)); if (id !== undefined) chosen.push(id); }
        for (const o of opts) { if (chosen.length >= (p.min ?? 0)) break; if (!chosen.includes(o)) chosen.push(o); }
        s = answer(s, { kind: 'chooseObjects', ids: chosen.slice(0, p.max ?? chosen.length) } as DecisionAnswer);
      } else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: p.min ?? 0 } as DecisionAnswer);
      else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: (s.pending as { items: { id: string }[] }).items.map((i) => i.id) } as DecisionAnswer);
      else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: ((s.pending as unknown as { options: { id: string }[] }).options).slice(0, p.min ?? 1).map((o) => o.id) } as DecisionAnswer);
      else throw new Error(`unexpected decision ${p.kind}`);
      continue;
    }
    if (s.zones.stack.length > 0) { s = pass(s); continue; }
    return s;
  }
  throw new Error('settle did not finish');
}
const cast = (s: GameState, name: string, pol: Policy = {}, player: PlayerId = 'p1'): GameState => settle(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) } as never), pol);

// ---- Spiritualize, Paladin of Prahv ----------------------------------------------------------------------------------------------------------------------------------

const SPIRIT = card('Test Spiritualize', 'Instant', 'Until end of turn, whenever target creature deals damage, you gain that much life. Draw a card.');
const FORECAST = card('Test Forecaster', 'Creature — Human Cleric', '{W}: Whenever target creature deals damage this turn, you gain that much life.', '{1}', ['1', '1']);
const BRUTE = card('Test Brute', 'Creature — Ogre', '', '{1}', ['3', '3']);
const IMP = card('Test Imp', 'Creature — Imp', '', '{1}', ['2', '2']);
const ARTIFACT_BEAST = card('Test Gearbeast', 'Artifact Creature — Construct', '', '{1}', ['1', '1']);
function attackAll(s0: GameState, attackers: ObjectId[], defender: PlayerId = 'p2'): GameState {
  let s = declareAttackers(toDeclareAttackers(s0), attackers.map((a) => [a, defender] as [ObjectId, PlayerId]));
  s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'blockers or the second main phase', 60);
  while (s.pending?.kind === 'declareBlockers') { s = declareBlockers(s, []); s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || x.turn.step === 'main2', 'the second main phase', 60); }
  return s;
}
/** Pass (declaring no attackers and no blockers) until `done`. */
function skipUntil(s0: GameState, done: (s: GameState) => boolean, what: string, max = 800): GameState {
  let s = s0;
  for (let i = 0; i < max; i++) {
    if (done(s)) return s;
    if (s.result) throw new Error(`The game ended while waiting for ${what}`);
    if (s.pending?.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
    else if (s.pending?.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else if (s.pending?.kind === 'priority') s = pass(s);
    else throw new Error(`Waiting for ${what} but a ${s.pending?.kind} decision is pending`);
  }
  throw new Error(`Never reached ${what}`);
}
describe('CR 603.7c, 120.2: "Until end of turn, whenever target creature deals damage, you gain that much life" (Spiritualize)', () => {
  const board = (): GameState => mpScenario({ defs: [SPIRIT, BRUTE, IMP], zones: { p1: { battlefield: ['Test Brute', 'Test Imp'], hand: ['Test Spiritualize'] } } });
  it('is full', () => expect(full(SPIRIT)).toBe(true));
  it('the chosen creature\'s damage gains that much life, each time it deals damage this turn; another creature\'s damage gains nothing; the card is drawn', () => {
    let s = board();
    const handBefore = inZone(s, 'hand', 'p1').length;
    s = cast(s, 'Test Spiritualize', { targets: [[obj(on(s, 'Test Brute')[0]!)]] });
    expect(inZone(s, 'hand', 'p1').length).toBe(handBefore); // one card cast, one drawn
    s = attackAll(s, [on(s, 'Test Brute')[0]!, on(s, 'Test Imp')[0]!]);
    expect(lifeOf(s, 'p2')).toBe(15);
    expect(lifeOf(s, 'p1')).toBe(23); // the Brute's 3 only, not the Imp's 2
  });
  it('negative: the watcher ends with the turn: the next turn the creature\'s damage gains nothing', () => {
    let s = board();
    s = cast(s, 'Test Spiritualize', { targets: [[obj(on(s, 'Test Brute')[0]!)]] });
    s = skipUntil(s, (x) => x.turn.activePlayer === 'p1' && x.turn.number > 1 && x.turn.step === 'main1' && x.pending?.kind === 'priority', "p1's next turn", 600);
    s = attackAll(s, [on(s, 'Test Brute')[0]!]);
    expect(lifeOf(s, 'p1')).toBe(20);
  });
});
describe('CR 603.7c, 120.2: "Whenever target creature deals damage this turn, you gain that much life" (Paladin of Prahv)', () => {
  it('is full', () => expect(full(FORECAST)).toBe(true));
  it('gains the damage dealt, once for each damage event', () => {
    let s = mpScenario({ defs: [FORECAST, BRUTE], zones: { p1: { battlefield: ['Test Forecaster', 'Test Brute', 'Plains'] } } });
    s = settle(act(s, { type: 'activate', player: 'p1', source: find(s, 'Test Forecaster', 'battlefield', 'p1'), ability: 'p:0:0' } as never), { targets: [[obj(on(s, 'Test Brute')[0]!)]] });
    s = attackAll(s, [on(s, 'Test Brute')[0]!]);
    expect(lifeOf(s, 'p1')).toBe(23);
  });
});

// ---- rhystic: Wild Might, Rhystic Shield, Rhystic Scrying ------------------------------------------------------------------------------------------------------------

const MIGHT = card('Test Might', 'Instant', 'Target creature gets +1/+1 until end of turn. That creature gets an additional +4/+4 until end of turn unless any player pays {2}.');
const SHIELD = card('Test Shield', 'Instant', 'Creatures you control get +0/+1 until end of turn. They get an additional +0/+2 until end of turn unless any player pays {2}.');
const SCRY = card('Test Scrying', 'Sorcery', 'Draw three cards. Then if any player pays {2}, discard three cards.');
describe('CR 118.12a, 101.4: "That creature gets an additional +4/+4 until end of turn unless any player pays {2}" (Wild Might)', () => {
  const game = (p3Lands: number) => mpScenario({ defs: [MIGHT, BRUTE], zones: { p1: { battlefield: ['Test Brute'], hand: ['Test Might'] }, p3: { battlefield: Array(p3Lands).fill('Plains') as string[] } } });
  it('is full', () => expect(full(MIGHT)).toBe(true));
  it('nobody pays: +5/+5 in all', () => {
    let s = game(2);
    s = cast(s, 'Test Might', { targets: [[obj(on(s, 'Test Brute')[0]!)]] });
    expect(pt(s, on(s, 'Test Brute')[0]!)).toBe('8/8');
  });
  it('any player (here an opponent, third in turn order) pays {2}: only +1/+1', () => {
    let s = game(2);
    s = cast(s, 'Test Might', { targets: [[obj(on(s, 'Test Brute')[0]!)]], yes: { p3: true } });
    expect(pt(s, on(s, 'Test Brute')[0]!)).toBe('4/4');
    expect(s.zones.battlefield.filter((id) => nameOf(s, id) === 'Plains' && s.objects[id]!.controller === 'p3' && s.objects[id]!.tapped).length).toBe(2);
  });
  it('negative: a player who cannot pay {2} is not asked to be able to: with no mana nobody pays', () => {
    let s = game(0);
    s = cast(s, 'Test Might', { targets: [[obj(on(s, 'Test Brute')[0]!)]], yes: { p3: true } });
    expect(pt(s, on(s, 'Test Brute')[0]!)).toBe('8/8');
  });
});
describe('CR 118.12a, 101.4: "They get an additional +0/+2 until end of turn unless any player pays {2}" (Rhystic Shield)', () => {
  const game = (p2Lands: number) => mpScenario({ defs: [SHIELD, BRUTE, IMP], zones: { p1: { battlefield: ['Test Brute', 'Test Imp'], hand: ['Test Shield'] }, p2: { battlefield: Array(p2Lands).fill('Plains') as string[] } } });
  it('is full', () => expect(full(SHIELD)).toBe(true));
  it('nobody pays: your creatures get +0/+3; an opponent\'s creature is not changed', () => {
    let s = mpScenario({ defs: [SHIELD, BRUTE, IMP], zones: { p1: { battlefield: ['Test Brute'], hand: ['Test Shield'] }, p2: { battlefield: ['Test Imp'] } } });
    s = cast(s, 'Test Shield');
    expect(pt(s, on(s, 'Test Brute')[0]!)).toBe('3/6');
    expect(pt(s, on(s, 'Test Imp')[0]!)).toBe('2/2');
  });
  it('someone pays {2}: only +0/+1', () => {
    let s = game(2);
    s = cast(s, 'Test Shield', { yes: { p2: true } });
    expect(pt(s, on(s, 'Test Brute')[0]!)).toBe('3/4');
    expect(pt(s, on(s, 'Test Imp')[0]!)).toBe('2/3');
  });
});
describe('CR 118.12, 608.2c, 101.4: "Then if any player pays {2}, discard three cards." (Rhystic Scrying)', () => {
  const FILL = card('Test Filler', 'Artifact', '');
  const game = () => mpScenario({ defs: [SCRY, FILL], zones: { p1: { hand: ['Test Scrying'], library: ['Test Filler', 'Test Filler', 'Test Filler', 'Test Filler'] }, p4: { battlefield: ['Plains', 'Plains'] } } });
  it('is full', () => expect(full(SCRY)).toBe(true));
  it('nobody pays: you keep the three cards', () => {
    let s = game();
    s = cast(s, 'Test Scrying');
    expect(inZone(s, 'hand', 'p1').length).toBe(4); // the draw step's card and the three
    expect(inZone(s, 'graveyard', 'p1').filter((n) => n === 'Test Filler').length).toBe(0);
  });
  it('an opponent pays {2}: you discard three cards (the controller discards, not the payer)', () => {
    let s = game();
    s = cast(s, 'Test Scrying', { yes: { p4: true } });
    expect(inZone(s, 'hand', 'p1').length).toBe(1);
    expect(inZone(s, 'graveyard', 'p1').filter((n) => n === 'Test Filler').length).toBe(3);
    expect(inZone(s, 'graveyard', 'p4').length).toBe(0);
  });
});

// ---- Blood Clock --------------------------------------------------------------------------------------------------------------------------------------------------------

const CLOCK = card('Test Clock', 'Artifact', "At the beginning of each player's upkeep, that player returns a permanent they control to its owner's hand unless they pay 2 life.", '{4}');
describe('CR 118.12a, 608.2d: "that player returns a permanent they control to its owner\'s hand unless they pay 2 life" (Blood Clock)', () => {
  const start = (): GameState => mpScenario({ defs: [CLOCK, BRUTE, IMP], zones: { p1: { battlefield: ['Test Clock'] }, p2: { battlefield: ['Test Brute', 'Test Imp'] } } });
  const toUpkeep = (s0: GameState, who: PlayerId, pol: Policy = {}): GameState => {
    let s = s0;
    for (let i = 0; i < 400 && !(s.turn.activePlayer === who && s.turn.step === 'upkeep' && s.zones.stack.length > 0); i++) {
      if (s.pending && s.pending.kind !== 'priority') s = settle(s, pol);
      else if (s.pending?.kind === 'priority') s = pass(s);
    }
    return s;
  };
  it('is full', () => expect(full(CLOCK)).toBe(true));
  it('the upkeep player who declines to pay returns a permanent of their own choice to its owner\'s hand; the clock\'s controller is not asked', () => {
    let s = toUpkeep(start(), 'p2');
    s = settle(s, { yes: { p2: false }, pick: { p2: ['Test Imp'] } });
    expect(inZone(s, 'hand', 'p2')).toContain('Test Imp');
    expect(on(s, 'Test Brute', 'p2').length).toBe(1);
    expect(lifeOf(s, 'p2')).toBe(20);
  });
  it('paying 2 life keeps everything on the battlefield', () => {
    let s = toUpkeep(start(), 'p2');
    s = settle(s, { yes: { p2: true } });
    expect(lifeOf(s, 'p2')).toBe(18);
    expect(on(s, 'Test Brute', 'p2').length + on(s, 'Test Imp', 'p2').length).toBe(2);
  });
  it('negative: it triggers for the upkeep player only: p3\'s permanents are untouched in p2\'s upkeep', () => {
    let s = mpScenario({ defs: [CLOCK, BRUTE, IMP], zones: { p1: { battlefield: ['Test Clock'] }, p2: { battlefield: ['Test Brute'] }, p3: { battlefield: ['Test Imp'] } } });
    s = toUpkeep(s, 'p2');
    s = settle(s, { yes: { p2: false } });
    expect(on(s, 'Test Imp', 'p3').length).toBe(1);
    expect(on(s, 'Test Brute', 'p2').length).toBe(0);
  });
});

// ---- Remorseless Punishment ---------------------------------------------------------------------------------------------------------------------------------------------

const PUNISH = card('Test Punishment', 'Sorcery', 'Target opponent loses 5 life unless that player discards two cards or sacrifices a creature or planeswalker of their choice. Repeat this process once.');
const FILL = card('Test Filler', 'Artifact', '');
describe('CR 118.12a, 701.9a, 701.21a: "loses 5 life unless that player discards two cards or sacrifices a creature or planeswalker of their choice. Repeat this process once." (Remorseless Punishment)', () => {
  const game = (p2: { hand?: string[]; battlefield?: string[] }) => mpScenario({ defs: [PUNISH, FILL, BRUTE], zones: { p1: { hand: ['Test Punishment'] }, p2 } });
  const target = (s: GameState): Policy => ({ targets: [[pl('p2')]] });
  it('is full', () => expect(full(PUNISH)).toBe(true));
  it('an opponent with nothing to discard or sacrifice loses 5 life twice', () => {
    let s = game({});
    s = cast(s, 'Test Punishment', target(s));
    expect(lifeOf(s, 'p2')).toBe(10);
  });
  it('discarding two cards each time (four in all) costs no life; another opponent is not affected', () => {
    let s = game({ hand: ['Test Filler', 'Test Filler', 'Test Filler', 'Test Filler'] });
    const before = inZone(s, 'hand', 'p2').length;
    s = cast(s, 'Test Punishment', { ...target(s), yes: { p2: true } });
    expect(lifeOf(s, 'p2')).toBe(20);
    expect(inZone(s, 'hand', 'p2').length).toBe(before - 4);
    expect(lifeOf(s, 'p3')).toBe(20);
  });
  it('sacrificing a creature the first time, then (no creature, one card) losing 5 life the second time', () => {
    let s = game({ hand: ['Test Filler'], battlefield: ['Test Brute'] });
    s = cast(s, 'Test Punishment', { ...target(s), yes: { p2: true } });
    expect(lifeOf(s, 'p2')).toBe(15);
    expect(on(s, 'Test Brute', 'p2').length).toBe(0);
  });
  it('negative: declining both payments loses 5 life each time and keeps the cards and creature', () => {
    let s = game({ hand: ['Test Filler', 'Test Filler'], battlefield: ['Test Brute'] });
    const before = inZone(s, 'hand', 'p2').length;
    s = cast(s, 'Test Punishment', { ...target(s), yes: { p2: false } });
    expect(lifeOf(s, 'p2')).toBe(10);
    expect(inZone(s, 'hand', 'p2').length).toBe(before);
    expect(on(s, 'Test Brute', 'p2').length).toBe(1);
  });
});

// ---- Perilous Predicament -----------------------------------------------------------------------------------------------------------------------------------------------

const PREDICAMENT = card('Test Predicament', 'Instant', 'Each opponent sacrifices an artifact creature and a nonartifact creature of their choice.');
describe('CR 701.21a, 608.2d: "Each opponent sacrifices an artifact creature and a nonartifact creature of their choice." (Perilous Predicament)', () => {
  it('is full', () => expect(full(PREDICAMENT)).toBe(true));
  it('each opponent loses one artifact creature and one nonartifact creature of their choice; you lose nothing', () => {
    let s = mpScenario({ defs: [PREDICAMENT, BRUTE, IMP, ARTIFACT_BEAST], zones: {
      p1: { hand: ['Test Predicament'], battlefield: ['Test Brute', 'Test Gearbeast'] },
      p2: { battlefield: ['Test Brute', 'Test Imp', 'Test Gearbeast', 'Test Gearbeast'] },
      p3: { battlefield: ['Test Gearbeast'] },
    } });
    s = cast(s, 'Test Predicament', { pick: { p2: ['Test Imp'] } });
    expect(on(s, 'Test Imp', 'p2').length).toBe(0);
    expect(on(s, 'Test Brute', 'p2').length).toBe(1);
    expect(on(s, 'Test Gearbeast', 'p2').length).toBe(1);
    expect(on(s, 'Test Gearbeast', 'p3').length).toBe(0); // the only creature of p3 is an artifact creature: only one is sacrificed (ruling 2017-02-09)
    expect(on(s, 'Test Brute', 'p1').length + on(s, 'Test Gearbeast', 'p1').length).toBe(2);
  });
  it('negative: an opponent with no creatures sacrifices nothing and the other types are untouched', () => {
    let s = mpScenario({ defs: [PREDICAMENT, FILL], zones: { p1: { hand: ['Test Predicament'] }, p2: { battlefield: ['Test Filler'] } } });
    s = cast(s, 'Test Predicament');
    expect(s.zones.battlefield.filter((id) => nameOf(s, id) === 'Test Filler').length).toBe(1);
  });
});

// ---- Even the Odds ------------------------------------------------------------------------------------------------------------------------------------------------------

const ODDS = card('Test Odds', 'Instant', 'Cast this spell only if you control fewer creatures than each opponent.\nCreate three 1/1 white Soldier creature tokens.', '{0}');
describe('CR 601.3, 102.2: "Cast this spell only if you control fewer creatures than each opponent." (Even the Odds)', () => {
  const castable = (s: GameState): boolean => applyAction(s, { type: 'cast', player: 'p1', card: find(s, 'Test Odds', 'hand', 'p1') } as never).error === undefined;
  it('is full', () => expect(full(ODDS)).toBe(true));
  it('castable when every opponent controls more creatures than you', () => {
    const s = mpScenario({ defs: [ODDS, BRUTE, IMP], zones: { p1: { hand: ['Test Odds'], battlefield: ['Test Imp'] }, p2: { battlefield: ['Test Brute', 'Test Brute'] }, p3: { battlefield: ['Test Brute', 'Test Imp'] }, p4: { battlefield: ['Test Imp', 'Test Imp'] } } });
    expect(castable(s)).toBe(true);
    const t = cast(s, 'Test Odds');
    expect(t.zones.battlefield.filter((id) => s.defs[t.objects[id]!.defId]?.name === 'Soldier' || nameOf(t, id).includes('Soldier')).length).toBe(3);
  });
  it('negative: not castable when one opponent controls as many (not fewer) creatures as you', () => {
    const s = mpScenario({ defs: [ODDS, BRUTE, IMP], zones: { p1: { hand: ['Test Odds'], battlefield: ['Test Imp', 'Test Imp'] }, p2: { battlefield: ['Test Brute', 'Test Brute', 'Test Imp'] }, p3: { battlefield: ['Test Brute', 'Test Imp'] }, p4: { battlefield: ['Test Imp', 'Test Imp', 'Test Imp'] } } });
    expect(castable(s)).toBe(false);
  });
  it('negative: not castable when one opponent controls fewer creatures than you', () => {
    const s = mpScenario({ defs: [ODDS, BRUTE, IMP], zones: { p1: { hand: ['Test Odds'], battlefield: ['Test Imp'] }, p2: { battlefield: ['Test Brute', 'Test Brute'] }, p3: { battlefield: [] }, p4: { battlefield: ['Test Imp', 'Test Imp'] } } });
    expect(castable(s)).toBe(false);
  });
});

// ---- Strongarm Tactics --------------------------------------------------------------------------------------------------------------------------------------------------

const STRONG = card('Test Strongarm', 'Sorcery', "Each player discards a card. Then each player who didn't discard a creature card this way loses 4 life.");
describe("CR 701.9a, 608.2c, 119.3: \"Each player discards a card. Then each player who didn't discard a creature card this way loses 4 life.\" (Strongarm Tactics)", () => {
  it('is full', () => expect(full(STRONG)).toBe(true));
  it('players who discarded a creature card lose nothing; those who discarded something else, or nothing, lose 4 life', () => {
    let s = mpScenario({ defs: [STRONG, BRUTE, FILL], zones: {
      p1: { hand: ['Test Strongarm', 'Test Brute'] }, p2: { hand: ['Test Filler'] }, p3: { hand: ['Test Brute'] }, p4: {} } });
    s = cast(s, 'Test Strongarm', { pick: { p1: ['Test Brute'], p2: ['Test Filler'], p3: ['Test Brute'] } });
    expect([lifeOf(s, 'p1'), lifeOf(s, 'p2'), lifeOf(s, 'p3'), lifeOf(s, 'p4')]).toEqual([20, 16, 20, 16]);
  });
});
