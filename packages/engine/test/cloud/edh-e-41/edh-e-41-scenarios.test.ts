/**
 * Commander coordinator E, library 2/3, round edh-e-41 (code edhe41): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites were checked against the
 * Comprehensive Rules text of 2026-09-25 (media.wizards.com), and the Scryfall rulings of the real cards were read (2026-11-06).
 *
 *   CR 608.2c, 608.2h, 205.2a   "Target opponent reveals their hand. You choose a nonland card from it. Exile that card. If an A card or a B card is exiled this way, they lose life. Otherwise, you lose life."
 *   CR 118.12, 119.4, 701.20e   "Pay any amount of life, then look at that many cards from the top of your library. Put one of those cards into your hand and exile the rest."
 *   CR 400.11b, 401.4           "You may put a card you own from outside the game on top of your library."
 *   CR 107.3, 701.20a, 608.2h   "When this creature enters, you may reveal X black cards in your hand. If you do, target creature gets -X/-X until end of turn."
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { pt } from '../cmd3/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const defName = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const handOf = (s: GameState, p: PlayerId): string[] => s.zones.hand[p]!.map((id) => defName(s, id));
const libOf = (s: GameState, p: PlayerId): string[] => s.zones.library[p]!.map((id) => defName(s, id));
const exileOf = (s: GameState, p: PlayerId): string[] => (s.zones.exile as unknown as Record<string, ObjectId[]>)[p]?.map((id) => defName(s, id)) ?? s.zones.exile.filter((id) => s.objects[id]!.owner === p).map((id) => defName(s, id));
const player = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;
const object = (id: ObjectId): TargetChoice => ({ kind: 'object', id }) as TargetChoice;

interface Script { yes?: boolean[]; numbers?: number[]; targets?: TargetChoice[][]; pick?: string[] }
/** Answer the decisions that come up until someone has priority. `pick` names (in order) the cards chosen among the options of each object choice. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? p.min });
    else if (p.kind === 'chooseObjects') {
      const want = script.pick?.shift();
      const ids = want === undefined ? p.options.slice(0, p.min) : p.options.filter((o) => defName(s, o) === want).slice(0, Math.max(p.min, 1));
      s = answer(s, { kind: 'chooseObjects', ids });
    }
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [`card:${script.pick?.shift() ?? ''}`] } as never);
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p)}`);
  }
  return s;
}
function settle(s0: GameState, script: Script = {}): GameState {
  let s = drive(s0, script);
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) s = drive(act(s, { type: 'pass', player: s.pending.player }), script);
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, who: PlayerId = 'p1'): GameState => settle(drive(act(s, { type: 'cast', player: who, card: find(s, name, 'hand', who) }), script), script);

const FOREST = card('Forest', 'Basic Land — Forest', '');
const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
const GIANT = card('Test Giant', 'Creature — Giant', '', { pt: ['4', '4'] });

// ---- "If a sorcery card or a card with flash is exiled this way" -------------------------------------------------------------------------------------------------------------------------

const PROBE = card('Test Probe', 'Sorcery', 'Target opponent reveals their hand. You choose a nonland card from it. Exile that card. If a sorcery card or a card with flash is exiled this way, they lose 2 life. Otherwise, you lose 2 life.');
const SORCERY = card('Test Ritual', 'Sorcery', 'Draw a card.');
const FLASHER = card('Test Flash Bear', 'Creature — Bear', 'Flash', { pt: ['2', '2'] });

describe('CR 608.2c, 608.2h, 205.2a: "If a sorcery card or a card with flash is exiled this way, they lose 2 life. Otherwise, you lose 2 life."', () => {
  const setup = (): GameState => mpScenario({ defs: [PROBE, SORCERY, FLASHER, BEAR, FOREST], zones: { p1: { hand: ['Test Probe'] }, p2: { hand: ['Test Ritual', 'Test Flash Bear', 'Test Bear', 'Forest'] } } });
  it('is automated', () => expect(full(PROBE)).toBe(true));
  it('the first described card (a sorcery) exiled: the opponent loses 2 life and you lose none', () => {
    const s = cast(setup(), 'Test Probe', { targets: [[player('p2')]], pick: ['Test Ritual'] });
    expect(lifeOf(s, 'p2')).toBe(18);
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(exileOf(s, 'p2')).toEqual(['Test Ritual']);
  });
  it('the second described card (a card with flash) exiled: the opponent loses 2 life and you lose none', () => {
    const s = cast(setup(), 'Test Probe', { targets: [[player('p2')]], pick: ['Test Flash Bear'] });
    expect(lifeOf(s, 'p2')).toBe(18);
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(exileOf(s, 'p2')).toEqual(['Test Flash Bear']);
  });
  it('negative: a creature card without flash exiled: you lose 2 life and the opponent loses none', () => {
    const s = cast(setup(), 'Test Probe', { targets: [[player('p2')]], pick: ['Test Bear'] });
    expect(lifeOf(s, 'p1')).toBe(18);
    expect(lifeOf(s, 'p2')).toBe(20);
    expect(exileOf(s, 'p2')).toEqual(['Test Bear']);
  });
  it('negative: the land cannot be chosen (a nonland card), and the other opponents lose nothing', () => {
    const s0 = setup();
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Probe', 'hand', 'p1') });
    s = drive(s, { targets: [[player('p2')]] });
    for (let g = 0; g < 10 && s.pending?.kind === 'priority' && s.zones.stack.length > 0; g++) s = act(s, { type: 'pass', player: s.pending.player }); // not `drive`: the choice must stay open
    expect(s.pending?.kind).toBe('chooseObjects');
    const options = (s.pending as unknown as { options: ObjectId[] }).options.map((o) => defName(s, o));
    expect(options).not.toContain('Forest');
    expect(options.sort()).toEqual(['Test Bear', 'Test Flash Bear', 'Test Ritual']);
    s = settle(s, { pick: ['Test Ritual'] });
    expect([lifeOf(s, 'p3'), lifeOf(s, 'p4')]).toEqual([20, 20]);
  });
});

// ---- "Pay any amount of life, then look at that many cards ... exile the rest" -----------------------------------------------------------------------------------------------------------

const DIVE = card('Test Dive', 'Instant', 'Pay any amount of life, then look at that many cards from the top of your library. Put one of those cards into your hand and exile the rest.');
const lib = (...names: string[]): string[] => ['Forest', ...names]; // the first card is drawn in the draw step of turn 1 (m12/rules/helpers.ts#mpScenario)

describe('CR 118.12, 119.4, 701.20e, 406.1: "Pay any amount of life, then look at that many cards from the top of your library. Put one of those cards into your hand and exile the rest."', () => {
  const defs = [DIVE, BEAR, GIANT, FOREST];
  const setup = (library: string[]): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Dive'], library } } });
  it('is automated', () => expect(full(DIVE)).toBe(true));
  it('pays 3 life, looks at the top 3 cards, puts the one chosen into the hand and exiles the other two; the fourth card is still on top', () => {
    const s0 = setup(lib('Test Bear', 'Test Giant', 'Forest', 'Test Bear'));
    const s = cast(s0, 'Test Dive', { numbers: [3], pick: ['Test Giant'] });
    expect(lifeOf(s, 'p1')).toBe(17);
    expect(handOf(s, 'p1')).toContain('Test Giant');
    expect(exileOf(s, 'p1').sort()).toEqual(['Forest', 'Test Bear']);
    expect(libOf(s, 'p1')[0]).toBe('Test Bear');
    expect(libOf(s, 'p1').length).toBe(libOf(s0, 'p1').length - 3);
  });
  it('negative: paying none looks at no card: nothing moves and no life is paid', () => {
    const s0 = setup(lib('Test Bear', 'Test Giant'));
    const s = cast(s0, 'Test Dive', { numbers: [0] });
    expect(lifeOf(s, 'p1')).toBe(20);
    expect(exileOf(s, 'p1')).toEqual([]);
    expect(libOf(s, 'p1')).toEqual(libOf(s0, 'p1'));
    expect(handOf(s, 'p1')).not.toContain('Test Bear');
  });
  it('paying 5 looks at five cards (a Plains the scenario pads the library with among them) and exiles the four not chosen', () => {
    const s0 = setup(lib('Test Bear', 'Test Giant'));
    const s = cast(s0, 'Test Dive', { numbers: [5], pick: ['Test Bear'] });
    expect(lifeOf(s, 'p1')).toBe(15);
    expect(handOf(s, 'p1')).toContain('Test Bear');
    expect(exileOf(s, 'p1').sort()).toEqual(['Plains', 'Plains', 'Plains', 'Test Giant']);
  });
});

// ---- "You may put a card you own from outside the game on top of your library" -----------------------------------------------------------------------------------------------------

const WISH = card('Test Wish Top', 'Sorcery', 'You may put a card you own from outside the game on top of your library.');

describe('CR 400.11b, 401.4: "You may put a card you own from outside the game on top of your library."', () => {
  const setup = (outside: string[]): GameState => ({ ...mpScenario({ defs: [WISH, BEAR, GIANT, FOREST], zones: { p1: { hand: ['Test Wish Top'], library: ['Forest', 'Test Bear'] } } }), outside: { p1: outside } });
  it('is automated', () => expect(full(WISH)).toBe(true));
  it('the chosen sideboard card is the new top card of the library (not the hand), and it leaves the sideboard', () => {
    const s0 = setup(['Test Giant', 'Test Bear']);
    const s = cast(s0, 'Test Wish Top', { yes: [true], pick: ['Test Giant'] });
    expect(libOf(s, 'p1')[0]).toBe('Test Giant');
    expect(libOf(s, 'p1').length).toBe(libOf(s0, 'p1').length + 1);
    expect(handOf(s, 'p1')).not.toContain('Test Giant');
    expect(s.outside?.['p1']).toEqual(['Test Bear']);
  });
  it('negative: declining the "may" leaves the library and the sideboard as they were', () => {
    const s0 = setup(['Test Giant']);
    const s = cast(s0, 'Test Wish Top', { yes: [false] });
    expect(libOf(s, 'p1')).toEqual(libOf(s0, 'p1'));
    expect(s.outside?.['p1']).toEqual(['Test Giant']);
  });
  it('negative: with an empty sideboard nothing happens', () => {
    const s0 = setup([]);
    const s = cast(s0, 'Test Wish Top', { yes: [true] });
    expect(libOf(s, 'p1')).toEqual(libOf(s0, 'p1'));
  });
});

// ---- "you may reveal X black cards in your hand. If you do, target creature gets -X/-X" ---------------------------------------------------------------------------------------------

const ASSASSIN = card('Test Night Hunter', 'Creature — Assassin', 'When this creature enters, you may reveal X black cards in your hand. If you do, target creature gets -X/-X until end of turn.', { pt: ['1', '1'], colors: ['B'] });
const BLACKCARD = card('Test Black Spell', 'Sorcery', 'Draw a card.', { colors: ['B'] });
const REDCARD = card('Test Red Spell', 'Sorcery', 'Draw a card.', { colors: ['R'] });

describe('CR 107.3, 701.20a, 608.2h: "When this creature enters, you may reveal X black cards in your hand. If you do, target creature gets -X/-X until end of turn."', () => {
  const defs = [ASSASSIN, BLACKCARD, REDCARD, GIANT, BEAR];
  const setup = (): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Night Hunter', 'Test Black Spell', 'Test Black Spell', 'Test Red Spell'] }, p2: { battlefield: ['Test Giant'] } } });
  const giant = (s: GameState): ObjectId => s.zones.battlefield.find((id) => defName(s, id) === 'Test Giant')!;
  const play = (revealCount: number): GameState => {
    const s0 = setup();
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Night Hunter', 'hand', 'p1') });
    s = drive(s, { targets: [[object(giant(s0))]] });
    for (let g = 0; g < 30 && s.pending; g++) {
      if (s.pending.kind === 'priority') { if (s.zones.stack.length === 0) break; s = act(s, { type: 'pass', player: s.pending.player }); continue; }
      const p = s.pending as unknown as { kind: string; options?: ObjectId[] };
      if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: revealCount > 0 });
      else if (p.kind === 'chooseObjects') {
        expect(p.options!.map((o) => defName(s, o))).toEqual(['Test Black Spell', 'Test Black Spell']); // the red card is no choice
        s = answer(s, { kind: 'chooseObjects', ids: p.options!.slice(0, revealCount) });
      } else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [object(giant(s0))] });
      else throw new Error(`unexpected ${p.kind}`);
    }
    return s;
  };
  it('is automated', () => expect(full(ASSASSIN)).toBe(true));
  it('reveals both black cards (X = 2): the target creature gets -2/-2', () => expect(pt(play(2), giant(setup()))).toBe('2/2'));
  it('reveals one black card (X = 1): -1/-1, not -2/-2 (X is the number revealed)', () => expect(pt(play(1), giant(setup()))).toBe('3/3'));
  it('negative: the "may" declined (no cards revealed): nothing happens to the creature', () => expect(pt(play(0), giant(setup()))).toBe('4/4'));
});
