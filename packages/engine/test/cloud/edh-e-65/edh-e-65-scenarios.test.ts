/**
 * Commander coordinator E, round edh-e-65 (graveyard/library): the round's reading played through the engine with synthetic cards (invented names, design 6.10), compiled by the
 * game's default compiler. Alice (p1) is the active player of turn 1. Each test is named after the rule it checks, with its negative case. CR cites from memory (the rules text
 * was not re-read in this round; listed as unverified in the record).
 *
 *   CR 701.21a, 701.20a, 701.20b, 110.2a, 109.4   "The controller of target artifact sacrifices it, then reveals cards from the top of their library until they reveal an artifact card.
 *                                                  That player puts that card onto the battlefield, then shuffles all other cards revealed this way into their library."
 */
import { describe, expect, it } from 'vitest';
import { getChars, type GameState, type PlayerId } from '../../../src/index';
import { card, cast, full, obj, resolveAll, scenario } from '../r3-cost/support';

const nameOf = (s: GameState, id: string): string => getChars(s, id).name;
const names = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId): string[] => s.zones[zone][p]!.map((id) => nameOf(s, id));
/** The library's own test cards in order (the scenario fills the rest of each library with basic lands). */
const lib = (s: GameState, p: PlayerId): string[] => names(s, 'library', p).filter((n) => n.startsWith('Test '));
const bf = (s: GameState, p: PlayerId): string[] => s.zones.battlefield.filter((id) => s.objects[id]!.controller === p).map((id) => nameOf(s, id));

const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
const RELIC = card('Test Relic', 'Artifact', '');
const IDOL = card('Test Idol', 'Artifact', '');
const GEM = card('Test Gem', 'Artifact', '');

describe('"The controller of target artifact sacrifices it, then reveals cards from the top of their library until they reveal an artifact card. That player puts that card onto the battlefield, then shuffles all other cards revealed this way into their library." (CR 701.21a, 701.20a-b, 110.2a, 109.4)', () => {
  const SPELL = card('Test Reshaping', 'Sorcery', 'The controller of target artifact sacrifices it, then reveals cards from the top of their library until they reveal an artifact card. That player puts that card onto the battlefield, then shuffles all other cards revealed this way into their library.');
  const defs = [SPELL, BEAR, RELIC, IDOL, GEM];
  const start = (library: string[]) => scenario([], { p1: { hand: ['Test Reshaping'] }, p2: { battlefield: ['Test Relic'], library }, defs });
  const target = (s: GameState) => [[obj(s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Relic')!)]];
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it("the artifact's controller (not the caster) sacrifices it, then puts the first artifact card of their own library onto the battlefield under their control; the cards revealed before it stay in their library", () => {
    const s0 = start(['Test Bear', 'Test Idol', 'Test Gem']);
    let s = cast(s0, 'Test Reshaping', { targets: target(s0) });
    s = resolveAll(s);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Relic']);
    expect(bf(s, 'p2')).toEqual(['Test Idol']);
    expect(bf(s, 'p1')).toEqual([]);
    expect(lib(s, 'p2').sort()).toEqual(['Test Bear', 'Test Gem']);
    expect(names(s, 'library', 'p1').filter((n) => n.startsWith('Test '))).toEqual([]); // the caster's library is untouched
  });
  it('the negative case: a library without an artifact card puts nothing onto the battlefield and loses no card (the artifact was still sacrificed)', () => {
    const s0 = start(['Test Bear']);
    let s = cast(s0, 'Test Reshaping', { targets: target(s0) });
    s = resolveAll(s);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Relic']);
    expect(bf(s, 'p2')).toEqual([]);
    expect(lib(s, 'p2')).toEqual(['Test Bear']);
  });
  it('the negative case: a creature card revealed on the way is not put onto the battlefield (only an artifact card is)', () => {
    const s0 = start(['Test Bear', 'Test Bear', 'Test Gem']);
    let s = cast(s0, 'Test Reshaping', { targets: target(s0) });
    s = resolveAll(s);
    expect(bf(s, 'p2')).toEqual(['Test Gem']);
    expect(lib(s, 'p2').sort()).toEqual(['Test Bear', 'Test Bear']);
  });
  it("CR 108.3/110.2a: an artifact owned by one player and controlled by another: its controller sacrifices it (it goes to its owner's graveyard) and reveals from THEIR OWN library", () => {
    let s0 = scenario([], { p1: { hand: ['Test Reshaping'], library: ['Test Bear', 'Test Idol'] }, p2: { battlefield: ['Test Relic'], library: ['Test Gem'] }, defs });
    const relic = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Relic')!;
    s0 = structuredClone(s0);
    (s0.objects[relic] as { controller: PlayerId }).controller = 'p1'; // p1 controls what p2 owns
    let s = cast(s0, 'Test Reshaping', { targets: [[obj(relic)]] });
    s = resolveAll(s);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Relic']);
    expect(bf(s, 'p1')).toEqual(['Test Idol']);
    expect(lib(s, 'p1')).toEqual(['Test Bear']);
    expect(lib(s, 'p2')).toEqual(['Test Gem']); // the owner's library is untouched
  });
  it('CR 608.2b: the negative case: if the target is gone before the spell resolves it does nothing (no library is revealed)', () => {
    const ZAP = card('Test Zap', 'Instant', 'Destroy target artifact.');
    const s0 = scenario([], { p1: { hand: ['Test Reshaping', 'Test Zap'] }, p2: { battlefield: ['Test Relic'], library: ['Test Bear', 'Test Gem'] }, defs: [...defs, ZAP] });
    const relic = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Relic')!;
    let s = cast(s0, 'Test Reshaping', { targets: [[obj(relic)]] });
    s = cast(s, 'Test Zap', { targets: [[obj(relic)]] });
    s = resolveAll(s);
    expect(bf(s, 'p2')).toEqual([]);
    expect(lib(s, 'p2')).toEqual(['Test Bear', 'Test Gem']); // order kept: nothing was revealed or shuffled
  });
});
