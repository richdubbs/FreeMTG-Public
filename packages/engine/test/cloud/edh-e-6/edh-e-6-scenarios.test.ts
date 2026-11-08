/**
 * edh-e-6 (Commander coordinator E, graveyard 1/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10). CR cites from memory
 * (unverified) unless noted.
 *
 *   CR 608.2c, 608.2d, 701.20a   "Reveal the top five cards of your library. An opponent chooses a creature card from among them. Put that card onto the battlefield and the rest into your
 *                                graveyard." (Animal Magnetism)
 *   CR 608.2c, 608.2d, 701.20a   "Reveal the top three cards of your library. An opponent chooses one of them. Put that card into your graveyard and the rest into your hand." (Murmurs from Beyond)
 *   CR 608.2d, 701.20a, 400.3    "Reveal the top three cards of your library. Target opponent may choose to put those cards into your hand. If they don't, put those cards into your graveyard
 *                                and draw five cards." (Covenant of Minds)
 *   CR 608.2d, 404.1, 406.1      "Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the other one into your hand." (Phyrexian Grimoire)
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/index';
import { put } from '../../m3/scenario';
import { answer, card, cast, drive, full, passBoth, scenario } from '../r5-cost/support';

type P = 'p1' | 'p2';
const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const names = (s: GameState, ids: readonly string[]): string[] => ids.map((id) => nameOf(s, id));
const handNames = (s: GameState, p: P): string[] => names(s, s.zones.hand[p]!).sort();
const gyNames = (s: GameState, p: P): string[] => names(s, s.zones.graveyard[p]!).sort();
const libNames = (s: GameState, p: P): string[] => names(s, s.zones.library[p]!);
const exileNames = (s: GameState): string[] => names(s, s.zones.exile).sort();
const battlefield = (s: GameState, name: string, controller?: P): string[] => s.zones.battlefield.filter((id) => nameOf(s, id) === name && (controller === undefined || s.objects[id]!.controller === controller));
function setLibrary(s: GameState, p: P, list: string[]): void {
  for (const id of s.zones.library[p]!) delete s.objects[id];
  s.zones.library[p] = [];
  for (const n of list) put(s, p, 'library', n);
}
/** The graveyard of a player, bottom first (so the LAST name is the top card, CR 404.1). */
function setGraveyard(s: GameState, p: P, list: string[]): void {
  for (const id of s.zones.graveyard[p]!) delete s.objects[id];
  s.zones.graveyard[p] = [];
  for (const n of list) put(s, p, 'graveyard', n);
}

/** Play the game out until the stack is empty: each object choice is answered with the cards of `picks[player]` (by name), else with the fewest cards; a yes/no from `yes`. */
function run(s0: GameState, o: { picks?: Partial<Record<P, string[]>>; yes?: boolean[]; stopAtChoice?: boolean } = {}): GameState {
  let s = s0;
  const yes = [...(o.yes ?? [])];
  for (let g = 0; g < 80 && s.pending; g++) {
    const p = s.pending;
    if (p.kind === 'chooseObjects') {
      if (o.stopAtChoice === true && p.options.length > 0) return s;
      const wanted = (o.picks?.[p.player as P] ?? []).map((n) => p.options.find((id) => nameOf(s, id) === n)).filter((id): id is string => id !== undefined).slice(0, p.max);
      s = answer(s, { kind: 'chooseObjects', ids: wanted.length >= p.min ? wanted : p.options.slice(0, p.min) });
    } else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: yes.shift() ?? true });
    else if (p.kind === 'priority') {
      if (s.zones.stack.length === 0) break;
      s = passBoth(s);
    } else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else s = drive(s);
  }
  return s;
}

const MAGNET = card('Test Beast Magnet', 'Sorcery', 'Reveal the top five cards of your library. An opponent chooses a creature card from among them. Put that card onto the battlefield and the rest into your graveyard.');
const MURMUR = card('Test Far Murmur', 'Sorcery', 'Reveal the top three cards of your library. An opponent chooses one of them. Put that card into your graveyard and the rest into your hand.');
const COVENANT = card('Test Mind Pact', 'Sorcery', 'Reveal the top three cards of your library. Target opponent may choose to put those cards into your hand. If they don\'t, put those cards into your graveyard and draw five cards.');
const GRIMOIRE = card('Test Dark Tome', 'Sorcery', 'Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the other one into your hand.');
const BEAR = card('Test Bear', 'Creature — Bear', '', '{2}', ['2', '2']);
const GIANT = card('Test Giant', 'Creature — Giant', '', '{4}', ['4', '4']);
const SPRITE = card('Test Sprite', 'Creature — Faerie', '', '{1}', ['1', '1']);
const RELIC = card('Test Relic', 'Artifact', '', '{1}');
const CHARM = card('Test Charm', 'Sorcery', 'You gain 1 life.', '{1}');
const DEFS = [MAGNET, MURMUR, COVENANT, GRIMOIRE, BEAR, GIANT, SPRITE, RELIC, CHARM];
const opp = { targets: [[{ kind: 'player' as const, id: 'p2' as const }]] };

describe('the synthetic cards are automated', () => {
  it('play fully', () => {
    for (const d of [MAGNET, MURMUR, COVENANT, GRIMOIRE]) expect(full(d), `${d.name}: ${JSON.stringify(d.automation)}`).toBe(true);
  });
});

describe('"An opponent chooses a creature card from among them. Put that card onto the battlefield and the rest into your graveyard." (CR 608.2c, 608.2d, 701.20a; Animal Magnetism)', () => {
  const setup = (lib: string[]): GameState => {
    const s = scenario(['Island'], { defs: DEFS, p1: { hand: ['Test Beast Magnet'], battlefield: ['Plains'] }, p2: {} });
    setLibrary(s, 'p1', lib);
    return s;
  };
  it('the OPPONENT picks the creature card (they are offered only creature cards); it enters under your control, every other revealed card goes to your graveyard, the sixth card stays', () => {
    const s = run(cast(setup(['Test Relic', 'Test Bear', 'Test Giant', 'Test Charm', 'Test Sprite', 'Test Relic']), 'Test Beast Magnet'), { picks: { p2: ['Test Bear'] }, yes: [] });
    expect(battlefield(s, 'Test Bear', 'p1')).toHaveLength(1);
    expect(battlefield(s, 'Test Giant')).toHaveLength(0);
    expect(gyNames(s, 'p1')).toEqual(['Test Beast Magnet', 'Test Charm', 'Test Giant', 'Test Relic', 'Test Sprite']);
    expect(libNames(s, 'p1')).toEqual(['Test Relic']);
  });
  it('the offered cards are the revealed creature cards only', () => {
    const s = run(cast(setup(['Test Relic', 'Test Bear', 'Test Giant', 'Test Charm', 'Test Sprite', 'Test Relic']), 'Test Beast Magnet'), { stopAtChoice: true });
    const p = s.pending as { player: P; options: string[] };
    expect(p.player).toBe('p2');
    expect(names(s, p.options).sort()).toEqual(['Test Bear', 'Test Giant', 'Test Sprite']);
  });
  it('NEGATIVE: with no creature card among the five, nothing enters and all five go to the graveyard', () => {
    const s = run(cast(setup(['Test Relic', 'Test Charm', 'Test Relic', 'Test Charm', 'Test Relic', 'Test Bear']), 'Test Beast Magnet'), { yes: [] });
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p1' && nameOf(s, id) !== 'Plains' && nameOf(s, id) !== 'Island')).toHaveLength(0);
    expect(gyNames(s, 'p1')).toEqual(['Test Beast Magnet', 'Test Charm', 'Test Charm', 'Test Relic', 'Test Relic', 'Test Relic']);
    expect(libNames(s, 'p1')).toEqual(['Test Bear']);
  });
});

describe('"An opponent chooses one of them. Put that card into your graveyard and the rest into your hand." (CR 608.2c, 608.2d, 701.20a; Murmurs from Beyond)', () => {
  it('the opponent picks one of the three revealed cards: it goes to your graveyard, the other two to your hand', () => {
    const s0 = scenario(['Island'], { defs: DEFS, p1: { hand: ['Test Far Murmur'], battlefield: ['Plains'] }, p2: {} });
    setLibrary(s0, 'p1', ['Test Relic', 'Test Bear', 'Test Charm', 'Test Giant']);
    const s = run(cast(s0, 'Test Far Murmur'), { picks: { p2: ['Test Bear'] } });
    expect(gyNames(s, 'p1')).toEqual(['Test Bear', 'Test Far Murmur']);
    expect(handNames(s, 'p1')).toEqual(['Test Charm', 'Test Relic']);
    expect(libNames(s, 'p1')).toEqual(['Test Giant']);
  });
  it('NEGATIVE: the fourth card is not revealed, so it is never offered or moved', () => {
    const s0 = scenario(['Island'], { defs: DEFS, p1: { hand: ['Test Far Murmur'], battlefield: ['Plains'] }, p2: {} });
    setLibrary(s0, 'p1', ['Test Relic', 'Test Bear', 'Test Charm', 'Test Giant']);
    const s = run(cast(s0, 'Test Far Murmur'), { stopAtChoice: true });
    expect(names(s, (s.pending as { options: string[] }).options).sort()).toEqual(['Test Bear', 'Test Charm', 'Test Relic']);
  });
});

describe('"Target opponent may choose to put those cards into your hand. If they don\'t, put those cards into your graveyard and draw five cards." (CR 608.2d, 701.20a; Covenant of Minds)', () => {
  const setup = (): GameState => {
    const s = scenario(['Island'], { defs: DEFS, p1: { hand: ['Test Mind Pact'], battlefield: ['Plains'] }, p2: {} });
    setLibrary(s, 'p1', ['Test Relic', 'Test Bear', 'Test Charm', 'Test Giant', 'Test Sprite', 'Test Giant', 'Test Giant', 'Test Giant']);
    return s;
  };
  it('the opponent accepts: the three revealed cards go to YOUR hand, nothing is drawn, nothing goes to the graveyard', () => {
    const s = run(cast(setup(), 'Test Mind Pact', opp), { yes: [true] });
    expect(handNames(s, 'p1')).toEqual(['Test Bear', 'Test Charm', 'Test Relic']);
    expect(gyNames(s, 'p1')).toEqual(['Test Mind Pact']);
    expect(libNames(s, 'p1')).toHaveLength(5);
  });
  it('the opponent declines: the three revealed cards go to your graveyard and you draw five cards (the next five, not the revealed ones)', () => {
    const s = run(cast(setup(), 'Test Mind Pact', opp), { yes: [false] });
    expect(gyNames(s, 'p1')).toEqual(['Test Bear', 'Test Charm', 'Test Mind Pact', 'Test Relic']);
    expect(handNames(s, 'p1')).toEqual(['Test Giant', 'Test Giant', 'Test Giant', 'Test Giant', 'Test Sprite']);
    expect(libNames(s, 'p1')).toEqual([]);
  });
});

describe('"Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the other one into your hand." (CR 608.2d, 404.1, 406.1; Phyrexian Grimoire)', () => {
  const setup = (): GameState => {
    const s = scenario(['Island'], { defs: DEFS, p1: { hand: ['Test Dark Tome'], battlefield: ['Plains'] }, p2: {} });
    setGraveyard(s, 'p1', ['Test Giant', 'Test Relic', 'Test Bear']); // top: Test Bear, then Test Relic
    return s;
  };
  it('the opponent picks one of the top two: it is exiled and the other goes to your hand; the third card stays in the graveyard', () => {
    const s = run(cast(setup(), 'Test Dark Tome', opp), { picks: { p2: ['Test Bear'] } });
    expect(exileNames(s)).toEqual(['Test Bear']);
    expect(handNames(s, 'p1')).toEqual(['Test Relic']);
    expect(gyNames(s, 'p1')).toEqual(['Test Dark Tome', 'Test Giant']);
  });
  it('picking the second card instead exiles it and returns the top card', () => {
    const s = run(cast(setup(), 'Test Dark Tome', opp), { picks: { p2: ['Test Relic'] } });
    expect(exileNames(s)).toEqual(['Test Relic']);
    expect(handNames(s, 'p1')).toEqual(['Test Bear']);
  });
  it('NEGATIVE: the third card of the graveyard is not offered', () => {
    const s = run(cast(setup(), 'Test Dark Tome', opp), { stopAtChoice: true });
    expect(names(s, (s.pending as { options: string[] }).options).sort()).toEqual(['Test Bear', 'Test Relic']);
  });
});
