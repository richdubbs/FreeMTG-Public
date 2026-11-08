/**
 * Round edh-e-35 (coordinator E, group vote-secret): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler, in a four-player game (mpScenario: p1 is the active player of turn 1). Each test is named after the rule it checks, with its negative case. CR cites are
 * from the Comprehensive Rules of 2026-09-25 where a rule number is given; the record lists any cite not checked against the text.
 *
 *   CR 614.12a, 608.2d, 702.16k   "As ~ enters, secretly choose an opponent. Reveal the player you chose: You and target permanent you control each gain protection from the chosen player ..." (Guardian Archon)
 *   CR 115.7, 607.2d              "Reveal the player you chose: Choose new targets for target spell or ability if it's controlled by the chosen player and if it targets you or a permanent you control." (Emissary of Grudges)
 *   CR 701.38a, 702.16a           "Starting with you, each player votes for blue, black, red, or green. ~ gains protection from each color with the most votes or tied for most votes." (Council Guardian)
 *   CR 701.38a, 701.17a, 406.3    "... You mill a card for each past vote, then ~ deals damage ... Exile the top card of your library for each present vote. Until the end of your next turn, you may play the exiled cards." (Fateful Tempest)
 *   CR 700.3, 406.3, 608.2d       "Exile the top N cards ... in a face-down pile, then ... in a face-up pile. An opponent chooses one of those piles. Put that pile into your graveyard. Look at the cards in the other pile. ..." (Abstract Performance)
 *   CR 700.3, 508.1c, 509.1c      "Separate all creatures ... into two piles. Only creatures in the pile of their choice can attack this turn." / "... Only creatures in the chosen piles can block this turn." (Fight or Flight, Stand or Fall)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, viewFor, type CardDef, type GameState, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find, legal } from '../../m3/scenario';
import { mpScenario, passUntil } from '../../m12/rules/helpers';
import { charsOfObject } from '../../../src/rules/characteristics';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));

interface Script { numbers?: number[]; options?: string[]; optionIds?: string[]; asked?: string[]; onAsk?: (s: GameState) => void; yes?: boolean[]; targets?: TargetChoice[][]; objects?: ((s: GameState) => string[])[]; colors?: string[] }
/** Answer the decisions that come up until someone has priority: numbers and option labels in the order asked. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    script.asked?.push(`${p.kind}:${p.player}`);
    script.onAsk?.(s);
    if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? p.min });
    else if (p.kind === 'chooseOption') {
      const byId = script.optionIds?.shift();
      const want = byId === undefined ? script.options?.shift() : undefined;
      const id = byId ?? (want === undefined ? p.options[0]!.id : p.options.find((o) => o.label === want || o.label.startsWith(want))!.id);
      s = answer(s, { kind: 'chooseOption', ids: [id] });
    } else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'chooseObjects') {
      const pick = script.objects?.shift();
      s = answer(s, { kind: 'chooseObjects', ids: pick ? pick(s) : p.options.slice(0, Math.max(p.min, 1)).slice(0, p.max) });
    } else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p)}`);
  }
  return s;
}
function settle(s0: GameState, script: Script = {}): GameState {
  let s = drive(s0, script);
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) s = drive(act(s, { type: 'pass', player: s.pending.player }), script);
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, player: PlayerId = 'p1'): GameState => settle(drive(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), script), script);
const life = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const names = (s: GameState, ids: readonly string[]): string[] => ids.map((id) => s.defs[s.objects[id]!.defId]!.name);
const BRUTE = card('Test Road Brute', 'Creature — Ogre', '', { pt: ['3', '3'] });
const KEEP = card('Test Keepsake', 'Artifact', '');

// ---- Guardian Archon ------------------------------------------------------------------------------------------------------------------------------------------------

const ARCHON = card('Test Hidden Warden', 'Creature — Archon', "Flying\nAs ~ enters, secretly choose an opponent.\nReveal the player you chose: You and target permanent you control each gain protection from the chosen player until end of turn. Activate only once.", { pt: ['3', '3'] });
const ZAP = card('Test Zap Bolt', 'Instant', '~ deals 2 damage to any target.', { colors: ['R'] });

describe('CR 614.12a, 608.2d, 702.16k: "As ~ enters, secretly choose an opponent." and protection from the chosen player (Guardian Archon)', () => {
  const setup = (): GameState => mpScenario({
    defs: [ARCHON, BRUTE, KEEP, ZAP],
    zones: { p1: { hand: ['Test Hidden Warden'], battlefield: ['Test Road Brute'] }, p2: { hand: ['Test Zap Bolt'] }, p3: { hand: ['Test Zap Bolt'] } },
  });
  const archon = (s: GameState): string => find(s, 'Test Hidden Warden', 'battlefield', 'p1');
  const activate = (s: GameState, target: string): GameState => settle(drive(act(s, { type: 'activate', player: 'p1', source: archon(s), ability: 'p:0:2' } as never), { targets: [[{ kind: 'object', id: target }]] }));
  it('is automated', () => expect(full(ARCHON)).toBe(true));
  it('the choice is made as it enters and is secret: the other players\' views do not show it; yours does', () => {
    const s = cast(setup(), 'Test Hidden Warden', { optionIds: ['p3'] });
    const link = (v: GameState) => v.objects[archon(s)]!.links?.['opponent'];
    expect(link(s)?.players).toEqual(['p3']);
    expect(link(viewFor(s, 'p1') as unknown as GameState)?.players).toEqual(['p3']);
    expect(link(viewFor(s, 'p3') as unknown as GameState)?.players).toBeUndefined();
    expect(link(viewFor(s, 'p2') as unknown as GameState)?.players).toBeUndefined();
  });
  it('revealing the player: the chosen player\'s spells can\'t target you or the permanent (damage prevented too); another opponent\'s still can', () => {
    let s = cast(setup(), 'Test Hidden Warden', { optionIds: ['p3'] });
    const brute = find(s, 'Test Road Brute', 'battlefield', 'p1');
    s = activate(s, brute);
    expect((viewFor(s, 'p2') as unknown as GameState).objects[archon(s)]!.links?.['opponent']?.players).toEqual(['p3']); // the reveal made the choice public
    s = passUntil(s, (x) => x.pending?.kind === 'priority' && x.pending.player === 'p3' && x.zones.stack.length === 0, 'p3 priority');
    // p3's Zap can't target p1 or the Brute
    for (const target of [{ kind: 'player', id: 'p1' }, { kind: 'object', id: brute }] as TargetChoice[]) {
      expect(() => drive(act(s, { type: 'cast', player: 'p3', card: find(s, 'Test Zap Bolt', 'hand', 'p3') }), { targets: [[target]] })).toThrow();
    }
    // p2's Zap can target the Brute
    const t = passUntil(s, (x) => x.pending?.kind === 'priority' && x.pending.player === 'p2' && x.zones.stack.length === 0, 'p2 priority');
    const after = settle(drive(act(t, { type: 'cast', player: 'p2', card: find(t, 'Test Zap Bolt', 'hand', 'p2') }), { targets: [[{ kind: 'object', id: brute }]] }));
    expect(after.objects[brute]!.damage).toBe(2);
  });
  it('the negative case: the ability is used up (activate only once), and with no opponent chosen the cost can\'t be paid', () => {
    let s = cast(setup(), 'Test Hidden Warden', { optionIds: ['p3'] });
    s = activate(s, find(s, 'Test Road Brute', 'battlefield', 'p1'));
    expect(() => act(s, { type: 'activate', player: 'p1', source: archon(s), ability: 'p:0:2' } as never)).toThrow();
    const t = mpScenario({ defs: [ARCHON, BRUTE, KEEP], zones: { p1: { battlefield: ['Test Hidden Warden', 'Test Road Brute'] } } });
    expect(() => activate(t, find(t, 'Test Road Brute', 'battlefield', 'p1'))).toThrow();
  });
});

// ---- Fight or Flight and Stand or Fall -------------------------------------------------------------------------------------------------------------------------------

const FIGHT = card('Test Fork Road', 'Enchantment', "At the beginning of combat on each opponent's turn, separate all creatures that player controls into two piles. Only creatures in the pile of their choice can attack this turn.");
const STAND = card('Test Line Drawn', 'Enchantment', 'At the beginning of combat on your turn, for each defending player, separate all creatures that player controls into two piles and that player chooses one. Only creatures in the chosen piles can block this turn.');
const SCOUT = card('Test Scout', 'Creature — Human Scout', '', { pt: ['2', '2'] });

describe('CR 700.3, 508.1c, 509.1c: only the creatures in the chosen pile can attack or block (Fight or Flight, Stand or Fall)', () => {
  it('both are automated', () => { expect(full(FIGHT)).toBe(true); expect(full(STAND)).toBe(true); });
  it('Fight or Flight: you separate the opponent\'s creatures, the opponent chooses a pile, and only creatures in it can attack that turn (a creature that entered later cannot)', () => {
    const s0 = mpScenario({ defs: [FIGHT, BRUTE, SCOUT, KEEP], zones: { p1: { battlefield: ['Test Fork Road'] }, p2: { battlefield: ['Test Road Brute', 'Test Scout', 'Test Scout'] } } });
    let s = passUntil(s0, (x) => x.turn.number === 2 && x.pending?.kind === 'chooseObjects', 'p1 separates');
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p1' }); // you separate (CR 700.3)
    const brute = find(s, 'Test Road Brute', 'battlefield', 'p2');
    const scouts = s.zones.battlefield.filter((id) => s.defs[s.objects[id]!.defId]!.name === 'Test Scout');
    s = answer(s, { kind: 'chooseObjects', ids: [brute] }); // pile 1: the Brute; pile 2: the two Scouts
    expect(s.pending).toMatchObject({ kind: 'chooseOption', player: 'p2' }); // the player whose creatures they are chooses
    s = answer(s, { kind: 'chooseOption', ids: ['pile2'] });
    s = passUntil(s, (x) => x.pending?.kind === 'declareAttackers', 'the attack');
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [{ attacker: brute, defender: 'p1' }] })).toThrow(); // not in the chosen pile
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [{ attacker: scouts[0]!, defender: 'p1' }, { attacker: scouts[1]!, defender: 'p1' }] })).not.toThrow();
  });
  it('Fight or Flight, negative case: on your own turn nothing is separated and your creatures attack as usual', () => {
    const s0 = mpScenario({ defs: [FIGHT, BRUTE, KEEP], zones: { p1: { battlefield: ['Test Fork Road', 'Test Road Brute'] } } });
    const s = passUntil(s0, (x) => x.pending?.kind === 'declareAttackers', 'the attack');
    expect(s.turn.number).toBe(1);
    const brute = find(s, 'Test Road Brute', 'battlefield', 'p1');
    expect(() => answer(s, { kind: 'declareAttackers', attacks: [{ attacker: brute, defender: 'p2' }] })).not.toThrow();
  });
  it('Stand or Fall: for each opponent you separate their creatures and they choose a pile; only creatures in the chosen piles can block', () => {
    const s0 = mpScenario({ defs: [STAND, BRUTE, SCOUT, KEEP], zones: { p1: { battlefield: ['Test Line Drawn', 'Test Scout'] }, p2: { battlefield: ['Test Road Brute', 'Test Scout'] }, p3: { battlefield: ['Test Road Brute'] } } });
    const s1 = passUntil(s0, (x) => x.turn.number === 1 && x.turn.step === 'beginCombat' && x.pending?.kind === 'chooseObjects', 'p1 separates for the first opponent');
    const asked: string[] = [];
    // p2's creatures: pile 1 = the Brute, pile 2 = the Scout; p2 chooses pile 2; p3's one creature: pile 1 = the Brute, pile 2 empty; p3 chooses pile 1
    const p2Brute = find(s1, 'Test Road Brute', 'battlefield', 'p2');
    const p2Scout = find(s1, 'Test Scout', 'battlefield', 'p2');
    const p3Brute = find(s1, 'Test Road Brute', 'battlefield', 'p3');
    let s = drive(s1, { asked, objects: [() => [p2Brute], () => [p3Brute]], optionIds: ['pile2', 'pile1'] });
    expect(asked).toEqual(['chooseObjects:p1', 'chooseOption:p2', 'chooseObjects:p1', 'chooseOption:p3']);
    s = passUntil(s, (x) => x.pending?.kind === 'declareAttackers', 'the attack');
    s = answer(s, { kind: 'declareAttackers', attacks: [{ attacker: find(s, 'Test Scout', 'battlefield', 'p1'), defender: 'p2' }] });
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers', 'the blocks');
    expect(s.pending).toMatchObject({ kind: 'declareBlockers', player: 'p2' });
    const attacker = find(s, 'Test Scout', 'battlefield', 'p1');
    expect(() => answer(s, { kind: 'declareBlockers', blocks: [{ blocker: p2Brute, attacker }] })).toThrow(); // in the pile p2 did not choose
    expect(() => answer(s, { kind: 'declareBlockers', blocks: [{ blocker: p2Scout, attacker }] })).not.toThrow(); // in the chosen pile
  });
});

// ---- Council Guardian -------------------------------------------------------------------------------------------------------------------------------------------------

const GIANT = card('Test Vote Giant', 'Creature — Giant Soldier', 'When ~ enters, starting with you, each player votes for blue, black, red, or green. ~ gains protection from each color with the most votes or tied for most votes.', { pt: ['3', '3'] });

describe('CR 701.38a-b, 702.16a: "~ gains protection from each color with the most votes or tied for most votes." (Council Guardian)', () => {
  const protections = (s: GameState, id: string): string[] => charsOfObject(s, s.objects[id]!).keywords.filter((k) => k.keyword === 'protection').map((k) => k.quality ?? '').sort();
  const vote = (picks: string[]): GameState => cast(mpScenario({ defs: [GIANT, KEEP], zones: { p1: { hand: ['Test Vote Giant'] } } }), 'Test Vote Giant', { optionIds: picks });
  const giant = (s: GameState): string => find(s, 'Test Vote Giant', 'battlefield', 'p1');
  it('is automated', () => expect(full(GIANT)).toBe(true));
  it('one winner: it gains protection from that color only', () => {
    const s = vote(['blue', 'blue', 'red', 'green']);
    expect(protections(s, giant(s))).toEqual(['color:U']);
  });
  it('a tie for most votes: it gains protection from every tied color (and not from a color with fewer votes)', () => {
    const s = vote(['blue', 'red', 'red', 'blue']);
    expect(protections(s, giant(s))).toEqual(['color:R', 'color:U']);
  });
  it('four different colors, one vote each: protection from all four (a color nobody voted for is not one of them)', () => {
    const s = vote(['blue', 'black', 'red', 'green']);
    expect(protections(s, giant(s))).toEqual(['color:B', 'color:G', 'color:R', 'color:U']);
  });
  it('negative case: before the vote it has no protection, and the vote is cast by every player in turn order', () => {
    const asked: string[] = [];
    const s0 = mpScenario({ defs: [GIANT, KEEP], zones: { p1: { hand: ['Test Vote Giant'] } } });
    cast(s0, 'Test Vote Giant', { optionIds: ['green', 'green', 'green', 'green'], asked });
    expect(asked).toEqual(['chooseOption:p1', 'chooseOption:p2', 'chooseOption:p3', 'chooseOption:p4']);
  });
});

// ---- Fateful Tempest --------------------------------------------------------------------------------------------------------------------------------------------------

const TEMPEST = card('Test Tide Reckoning', 'Sorcery', 'Starting with you, each player votes for past or present. You mill a card for each past vote, then ~ deals damage to each opponent equal to the total mana value of cards milled this way. Exile the top card of your library for each present vote. Until the end of your next turn, you may play the exiled cards.', { cost: '{0}' });
const START = 20; // the life every player starts with in the scenario game
const COSTS = [1, 2, 3, 4, 5].map((n) => card(`Test Cost ${n}`, 'Artifact', '', { cost: `{${n}}` }));

describe('CR 701.38a, 701.17a, 202.3, 406.3: mill for each past vote and damage equal to their total mana value; exile for each present vote and play them (Fateful Tempest)', () => {
  const setup = (): GameState => mpScenario({ defs: [TEMPEST, KEEP, ...COSTS], zones: { p1: { hand: ['Test Tide Reckoning'], battlefield: ['Plains', 'Plains', 'Plains', 'Plains', 'Plains'], library: ['Test Keepsake', ...COSTS.map((d) => d.name)] } } });
  const play = (picks: string[]): GameState => cast(setup(), 'Test Tide Reckoning', { optionIds: picks });
  it('is automated', () => expect(full(TEMPEST)).toBe(true));
  it('two past votes and two present votes: the top two cards are milled and each opponent takes their total mana value (1 + 2 = 3); the next two are exiled and may be played', () => {
    const s = play(['past', 'present', 'past', 'present']);
    expect(names(s, s.zones.graveyard.p1!).filter((n) => n !== 'Test Tide Reckoning').sort()).toEqual(['Test Cost 1', 'Test Cost 2']);
    for (const p of ['p2', 'p3', 'p4'] as PlayerId[]) expect(life(s, p)).toBe(START - 3);
    expect(life(s, 'p1')).toBe(START);
    expect(names(s, s.zones.exile).sort()).toEqual(['Test Cost 3', 'Test Cost 4']);
    expect(legal(s, 'p1', 'cast').map((a) => a.label).join('|')).toMatch(/Test Cost 3/); // "you may play the exiled cards" (the permission lasts until the end of your next turn)
  });
  it('all present votes: nothing is milled, no damage is dealt, four cards are exiled', () => {
    const s = play(['present', 'present', 'present', 'present']);
    expect(names(s, s.zones.graveyard.p1!).filter((n) => n !== 'Test Tide Reckoning')).toEqual([]);
    for (const p of ['p2', 'p3', 'p4'] as PlayerId[]) expect(life(s, p)).toBe(START);
    expect(names(s, s.zones.exile).sort()).toEqual(['Test Cost 1', 'Test Cost 2', 'Test Cost 3', 'Test Cost 4']);
  });
  it('all past votes: four cards are milled (1 + 2 + 3 + 4 = 10 damage to each opponent) and nothing is exiled', () => {
    const s = play(['past', 'past', 'past', 'past']);
    for (const p of ['p2', 'p3', 'p4'] as PlayerId[]) expect(life(s, p)).toBe(START - 10);
    expect(s.zones.exile).toEqual([]);
  });
});

// ---- Abstract Performance ---------------------------------------------------------------------------------------------------------------------------------------------

const PERF = card('Test Stage Piles', 'Sorcery', 'Exile the top four cards of your library in a face-down pile, then exile the top four cards of your library in a face-up pile. An opponent chooses one of those piles. Put that pile into your graveyard. Look at the cards in the other pile. You may cast a spell from among them without paying its mana cost. Put the rest into your hand.');
const DOWN = ['Dn1', 'Dn2', 'Dn3', 'Dn4'].map((n) => card(`Test ${n}`, 'Artifact', '', { cost: '{3}' }));
const UP = ['Up1', 'Up2', 'Up3', 'Up4'].map((n) => card(`Test ${n}`, 'Artifact', '', { cost: '{3}' }));

describe('CR 700.3, 406.3, 608.2d, 601.2, 118.9: two given piles (one face down, one face up), an opponent chooses, look at the other, cast one free, the rest to your hand (Abstract Performance)', () => {
  const setup = (): GameState => mpScenario({ defs: [PERF, KEEP, ...DOWN, ...UP], zones: { p1: { hand: ['Test Stage Piles'], library: ['Test Keepsake', ...DOWN.map((d) => d.name), ...UP.map((d) => d.name)] } } });
  it('is automated', () => expect(full(PERF)).toBe(true));
  it('the opponent sees the face-up cards and the size of the face-down pile; the chosen pile goes to your graveyard, you look at the other, cast one card free and take the rest', () => {
    let seen: string[] = [];
    const s = cast(setup(), 'Test Stage Piles', {
      optionIds: ['p2', 'pile2'], // you pick which opponent chooses; that opponent chooses the face-up pile
      onAsk: (x) => { if (x.pending?.kind === 'chooseOption' && x.pending.player === 'p2') seen = x.pending.options.map((o) => o.label); },
      objects: [(x) => [(x.pending as { options: string[] }).options.find((o) => x.defs[x.objects[o]!.defId]!.name === 'Test Dn3')!]],
    });
    expect(seen).toEqual(['Pile 1: 4 cards face down', 'Pile 2: Test Up1, Test Up2, Test Up3, Test Up4']);
    expect(names(s, s.zones.graveyard.p1!).filter((n) => n !== 'Test Stage Piles').sort()).toEqual(['Test Up1', 'Test Up2', 'Test Up3', 'Test Up4']); // the chosen (face-up) pile
    expect(names(s, s.zones.battlefield).filter((n) => n.startsWith('Test Dn'))).toEqual(['Test Dn3']); // cast without paying its mana cost ({3})
    expect(names(s, s.zones.hand.p1!).filter((n) => n.startsWith('Test Dn')).sort()).toEqual(['Test Dn1', 'Test Dn2', 'Test Dn4']); // the rest of the other pile
    expect(s.zones.exile).toEqual([]);
  });
  it('the opponent chooses the face-down pile: it goes to the graveyard, you take the face-up pile (no cast chosen, so all four go to your hand)', () => {
    const s = cast(setup(), 'Test Stage Piles', { optionIds: ['p2', 'pile1'], objects: [() => []] });
    expect(names(s, s.zones.graveyard.p1!).filter((n) => n !== 'Test Stage Piles').sort()).toEqual(['Test Dn1', 'Test Dn2', 'Test Dn3', 'Test Dn4']);
    expect(names(s, s.zones.hand.p1!).filter((n) => n.startsWith('Test Up')).sort()).toEqual(['Test Up1', 'Test Up2', 'Test Up3', 'Test Up4']);
  });
  it('negative case: with fewer than eight cards in the library the second pile is smaller (ruling 2026-03-20), and nothing is cast when the chosen cards are all lands', () => {
    const s0 = mpScenario({ defs: [PERF, KEEP, ...DOWN, ...UP], zones: { p1: { hand: ['Test Stage Piles'], library: ['Test Keepsake', ...DOWN.map((d) => d.name), 'Test Up1'] } }, setup: (x) => { x.zones.library.p1 = x.zones.library.p1!.slice(0, 6); } });
    const s = cast(s0, 'Test Stage Piles', { optionIds: ['p2', 'pile1'], objects: [() => []] });
    expect(names(s, s.zones.graveyard.p1!).filter((n) => n !== 'Test Stage Piles').length + s.zones.hand.p1!.length).toBeGreaterThan(0);
  });
});

// ---- Emissary of Grudges ----------------------------------------------------------------------------------------------------------------------------------------------

const EMISSARY = card('Test Grudge Envoy', 'Creature — Human Advisor', "Flying, haste\nAs ~ enters, secretly choose an opponent.\nReveal the player you chose: Choose new targets for target spell or ability if it's controlled by the chosen player and if it targets you or a permanent you control. Activate only once.", { pt: ['3', '3'] });

describe('CR 115.7, 607.2d, 608.2c: "Choose new targets for target spell or ability if it\'s controlled by the chosen player and if it targets you or a permanent you control." (Emissary of Grudges)', () => {
  const setup = (): GameState => mpScenario({
    defs: [EMISSARY, BRUTE, KEEP, ZAP],
    zones: { p1: { hand: ['Test Grudge Envoy'], battlefield: ['Test Road Brute'] }, p2: { hand: ['Test Zap Bolt'], battlefield: ['Test Road Brute'] }, p3: { hand: ['Test Zap Bolt'] } },
  });
  /** `caster` casts Zap on p1's Brute at their first priority; returns with p1 holding priority and the Zap on the stack. */
  const zapped = (s0: GameState, caster: PlayerId, victim: PlayerId = 'p1'): GameState => {
    let s = passUntil(s0, (x) => x.pending?.kind === 'priority' && x.pending.player === caster && x.zones.stack.length === 0, `${caster} priority`);
    s = drive(act(s, { type: 'cast', player: caster, card: find(s, 'Test Zap Bolt', 'hand', caster) }), { targets: [[{ kind: 'object', id: find(s, 'Test Road Brute', 'battlefield', victim) }]] });
    return passUntil(s, (x) => x.pending?.kind === 'priority' && x.pending.player === 'p1' && x.zones.stack.length === 1, 'p1 priority with the Zap on the stack');
  };
  const envoy = (s: GameState): string => find(s, 'Test Grudge Envoy', 'battlefield', 'p1');
  const respond = (s: GameState): GameState => drive(act(s, { type: 'activate', player: 'p1', source: envoy(s), ability: 'p:0:3' } as never), { targets: [[{ kind: 'object', id: s.zones.stack[0]! }]] });
  it('is automated', () => expect(full(EMISSARY)).toBe(true));
  it('the chosen player\'s spell that targets your permanent: you choose new targets, here the chosen player themself; the Zap then hits them and your permanent is unharmed', () => {
    let s = cast(setup(), 'Test Grudge Envoy', { optionIds: ['p3'] });
    s = zapped(s, 'p3');
    const brute = find(s, 'Test Road Brute', 'battlefield', 'p1');
    const asked: string[] = [];
    s = settle(respond(s), { asked, yes: [true], targets: [[{ kind: 'player', id: 'p3' }]] });
    expect(s.zones.stack).toEqual([]);
    expect(s.objects[brute]!.damage).toBe(0);
    expect(life(s, 'p3')).toBe(START - 2);
  });
  it('negative case: a spell of another opponent is left alone, and the Zap kills nothing but still hits the permanent', () => {
    let s = cast(setup(), 'Test Grudge Envoy', { optionIds: ['p3'] });
    s = zapped(s, 'p2');
    const brute = find(s, 'Test Road Brute', 'battlefield', 'p1');
    const asked: string[] = [];
    s = settle(respond(s), { asked });
    expect(asked.filter((a) => a.startsWith('chooseTargets') || a.startsWith('yesNo'))).toEqual([]);
    expect(s.objects[brute]!.damage).toBe(2);
  });
  it('negative case: the chosen player\'s spell that targets neither you nor a permanent you control is left alone', () => {
    let s = cast(setup(), 'Test Grudge Envoy', { optionIds: ['p3'] });
    s = zapped(s, 'p3', 'p2');
    const theirs = find(s, 'Test Road Brute', 'battlefield', 'p2');
    const asked: string[] = [];
    s = settle(respond(s), { asked });
    expect(asked.filter((a) => a.startsWith('chooseTargets') || a.startsWith('yesNo'))).toEqual([]);
    expect(s.objects[theirs]!.damage).toBe(2);
  });
});
