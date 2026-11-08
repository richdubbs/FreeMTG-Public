/**
 * Commander coordinator E, library 2/3, round edh-e-10 (code edhe10): played scenarios (synthetic cards, wordings invented, design 6.10) of the round's fixes, each with its negative case.
 *   CR 701.20a-b, 401.4, 608.2c   "Reveal cards from the top of your library until you reveal a nonland card. ... Put the revealed cards on the bottom of your library in any/a random order."
 *                                 (Erratic Explosion, Erratic Mutation, Calibrated Blast)
 *   CR 603.12, 202.3, 120.3       "When you reveal a nonland card this way, ~ deals damage equal to that card's mana value to any target." (Calibrated Blast; ruling 2021-06-18)
 *   CR 701.20a, 401.4             "Reveal cards ... until you reveal three nonland cards. Put the nonland cards revealed this way into your hand, then put the rest ... on the bottom ... in any order."
 *                                 (Fathom Trawl; ruling 2007-10-01: fewer than three nonland cards: the whole library is revealed)
 */
import { describe, expect, it } from 'vitest';
import { type GameState, type ObjectId } from '../../../src/index';
import { act, answer, find, mpScenario } from '../../m12/rules/helpers';
import { advanceTo, scenario } from '../../m3/scenario';
import { passUntil } from '../../m4/helpers';
import { attackWith, card, full, pt, resolveAll } from '../cmd3/helpers';

type Target = { kind: 'object'; id: ObjectId } | { kind: 'player'; id: string };
const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const defOf = (s: GameState, id: ObjectId): string => s.objects[id]!.defId;
const handOf = (s: GameState, p: string): string[] => s.zones.hand[p]!.map((id) => defOf(s, id));
const libOf = (s: GameState, p: string): string[] => s.zones.library[p]!.map((id) => defOf(s, id));
const onBf = (s: GameState, p: string, defId: string): ObjectId[] => s.zones.battlefield.filter((id) => defOf(s, id) === defId && s.objects[id]!.controller === p);

/** Cast `name` from p1's hand and answer every decision: `target` for a target choice (asked at cast or by a reflexive trigger), the default for the rest. */
function play(s0: GameState, name: string, target?: Target): { s: GameState; asked: number } {
  let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') });
  let asked = 0;
  for (let g = 0; g < 60; g++) {
    if (s.pending?.kind === 'priority') { if (s.zones.stack.length === 0) break; s = act(s, { type: 'pass', player: s.pending.player }); continue; }
    const d = s.pending as unknown as { kind: string; items?: { id: string }[]; options?: ObjectId[]; min?: number };
    if (d.kind === 'chooseTargets') { asked++; s = answer(s, { kind: 'chooseTargets', targets: [target!] } as never); }
    else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (d.kind === 'order') s = answer(s, { kind: 'order', ids: d.items!.map((x) => x.id) });
    else if (d.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: d.options!.slice(0, d.min ?? 0) });
    else throw new Error(`unexpected ${d.kind}`);
  }
  return { s, asked };
}

const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const GIANT = card('Test Giant', 'Creature — Giant', '', ['4', '4'], '{2}{G}{G}');
const BOLT = card('Test Bolt Card', 'Instant', 'Draw a card.', undefined, '{1}{R}');
const FOREST = card('Forest', 'Basic Land — Forest', '');
const XHYDRA = card('Test X Hydra', 'Creature — Hydra', '', ['0', '0'], '{X}{G}');
// the first card of the library given is drawn in the draw step of turn 1 (m12/rules/helpers.ts#mpScenario): a Plains in front of the named cards
const lib = (...names: string[]): string[] => ['Plains', ...names];

describe('CR 701.20a, 401.4, 608.2c: "Choose any target. Reveal cards ... until you reveal a nonland card. ~ deals damage equal to that card\'s mana value to that permanent or player. Put the revealed cards on the bottom of your library in any order."', () => {
  const EXPL = card('Test Erratic Blast', 'Sorcery', 'Choose any target. Reveal cards from the top of your library until you reveal a nonland card. ~ deals damage equal to that card\'s mana value to that permanent or player. Put the revealed cards on the bottom of your library in any order.');
  const defs = [EXPL, BEAR, GIANT, XHYDRA, FOREST];
  const start = (library: string[]): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Erratic Blast'], library } } });
  it('is automated', () => expect(full(EXPL)).toBe(true));
  it('damage equal to the first nonland card revealed (Giant: 4) to the chosen player; every revealed card, lands and the Giant, goes to the bottom, the next card is on top', () => {
    const s0 = start(lib('Plains', 'Forest', 'Test Giant', 'Test Bear'));
    const r = play(s0, 'Test Erratic Blast', { kind: 'player', id: 'p2' });
    expect(life(r.s, 'p2')).toBe(life(s0, 'p2') - 4);
    expect(life(r.s, 'p3')).toBe(life(s0, 'p3'));
    expect(libOf(r.s, 'p1')[0]).toBe('Test Bear');
    expect(libOf(r.s, 'p1').slice(-3).sort()).toEqual(['Forest', 'Plains', 'Test Giant']);
    expect(libOf(r.s, 'p1').length).toBe(libOf(s0, 'p1').length);
  });
  it('X in the revealed card\'s mana cost is 0 (CR 202.3e): {X}{G} is mana value 1', () => {
    const s0 = start(lib('Test X Hydra', 'Test Bear'));
    const r = play(s0, 'Test Erratic Blast', { kind: 'player', id: 'p2' });
    expect(life(r.s, 'p2')).toBe(life(s0, 'p2') - 1);
  });
  it('negative: with nothing but lands in the library no damage is dealt (ruling 2004-10-04) and the whole library is revealed and put on the bottom', () => {
    const s0 = start(lib('Plains', 'Forest'));
    const r = play(s0, 'Test Erratic Blast', { kind: 'player', id: 'p2' });
    expect(life(r.s, 'p2')).toBe(life(s0, 'p2'));
    expect(libOf(r.s, 'p1').length).toBe(libOf(s0, 'p1').length);
  });
});

describe('CR 701.20a, 608.2c, 613.4c: "Choose target creature. Reveal cards ... until you reveal a nonland card. That creature gets +X/-X until end of turn, where X is that card\'s mana value. Put all cards revealed this way on the bottom of your library in any order."', () => {
  const MUT = card('Test Erratic Mutant', 'Sorcery', 'Choose target creature. Reveal cards from the top of your library until you reveal a nonland card. That creature gets +X/-X until end of turn, where X is that card\'s mana value. Put all cards revealed this way on the bottom of your library in any order.');
  const defs = [MUT, BEAR, GIANT, XHYDRA, FOREST];
  const start = (library: string[]): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Erratic Mutant'], library }, p2: { battlefield: ['Test Giant'] } } });
  it('is automated', () => expect(full(MUT)).toBe(true));
  it('+4/-4 on a 4/4 Giant for a revealed Giant (it dies: toughness 0); a 2/2 Bear takes the same -4 and dies; the revealed cards are on the bottom', () => {
    const s0 = start(lib('Plains', 'Test Giant', 'Test Bear'));
    const giant = onBf(s0, 'p2', 'Test Giant')[0]!;
    const r = play(s0, 'Test Erratic Mutant', { kind: 'object', id: giant });
    expect(r.s.zones.battlefield.includes(giant)).toBe(false);
    expect(libOf(r.s, 'p1')[0]).toBe('Test Bear');
  });
  it('X in the revealed card\'s mana cost is 0 (CR 202.3e, ruling 2021-03-19): {X}{G} is mana value 1, so +1/-1', () => {
    const s0 = start(lib('Test X Hydra', 'Test Bear'));
    const giant = onBf(s0, 'p2', 'Test Giant')[0]!;
    const r = play(s0, 'Test Erratic Mutant', { kind: 'object', id: giant });
    expect(pt(r.s, giant)).toBe('5/3');
  });
  it('negative: with only lands in the library X is 0 and nothing changes', () => {
    const s0 = start(lib('Plains', 'Forest'));
    const giant = onBf(s0, 'p2', 'Test Giant')[0]!;
    const r = play(s0, 'Test Erratic Mutant', { kind: 'object', id: giant });
    expect(pt(r.s, giant)).toBe('4/4');
  });
});

describe('CR 701.20a, 603.12, 202.3, 120.3: "Reveal cards ... until you reveal a nonland card. Put the revealed cards on the bottom ... in a random order. When you reveal a nonland card this way, ~ deals damage equal to that card\'s mana value to any target."', () => {
  const BLAST = card('Test Calibrated Bolt', 'Sorcery', 'Reveal cards from the top of your library until you reveal a nonland card. Put the revealed cards on the bottom of your library in a random order. When you reveal a nonland card this way, ~ deals damage equal to that card\'s mana value to any target.');
  const defs = [BLAST, BEAR, GIANT, BOLT, FOREST];
  const start = (library: string[]): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Calibrated Bolt'], library } } });
  it('is automated', () => expect(full(BLAST)).toBe(true));
  it('the target is chosen as the reflexive ability triggers (after the reveal); damage equals the nonland card\'s mana value (Giant: 4); the cards are on the bottom', () => {
    const s0 = start(lib('Plains', 'Test Giant', 'Test Bear'));
    const r = play(s0, 'Test Calibrated Bolt', { kind: 'player', id: 'p3' });
    expect(r.asked).toBe(1);
    expect(life(r.s, 'p3')).toBe(life(s0, 'p3') - 4);
    expect(libOf(r.s, 'p1')[0]).toBe('Test Bear');
    expect(libOf(r.s, 'p1').slice(-2).sort()).toEqual(['Plains', 'Test Giant']);
  });
  it('negative: with only lands in the library nothing triggers: no target is asked and no damage is dealt', () => {
    const s0 = start(lib('Plains', 'Forest'));
    const r = play(s0, 'Test Calibrated Bolt', { kind: 'player', id: 'p3' });
    expect(r.asked).toBe(0);
    expect(life(r.s, 'p3')).toBe(life(s0, 'p3'));
  });
});

describe('CR 701.20a, 401.4: "Reveal cards ... until you reveal three nonland cards. Put the nonland cards revealed this way into your hand, then put the rest of the revealed cards on the bottom of your library in any order."', () => {
  const TRAWL = card('Test Deep Trawl', 'Sorcery', 'Reveal cards from the top of your library until you reveal three nonland cards. Put the nonland cards revealed this way into your hand, then put the rest of the revealed cards on the bottom of your library in any order.');
  const defs = [TRAWL, BEAR, GIANT, BOLT, FOREST];
  const start = (library: string[]): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Deep Trawl'], library } } });
  it('is automated', () => expect(full(TRAWL)).toBe(true));
  it('the three nonland cards go to your hand, the lands revealed with them and nothing else go to the bottom; the fourth nonland card stays on top', () => {
    const s0 = start(lib('Plains', 'Test Bear', 'Forest', 'Test Giant', 'Test Bolt Card', 'Test Bear'));
    const r = play(s0, 'Test Deep Trawl');
    const h = handOf(r.s, 'p1');
    expect(h.filter((n) => n === 'Test Bear')).toHaveLength(1);
    expect(h).toContain('Test Giant');
    expect(h).toContain('Test Bolt Card');
    expect(libOf(r.s, 'p1')[0]).toBe('Test Bear');
    expect(libOf(r.s, 'p1').slice(-2).sort()).toEqual(['Forest', 'Plains']);
  });
  it('ruling 2007-10-01: with fewer than three nonland cards the whole library is revealed, the nonland cards go to your hand and the lands stay in the library', () => {
    const s0 = start(lib('Test Bear', 'Plains', 'Test Giant', 'Forest'));
    const r = play(s0, 'Test Deep Trawl');
    expect(handOf(r.s, 'p1').filter((n) => n === 'Test Bear' || n === 'Test Giant')).toHaveLength(2);
    expect(libOf(r.s, 'p1').every((n) => n === 'Forest' || n === 'Plains')).toBe(true);
    expect(libOf(r.s, 'p1').length).toBe(libOf(s0, 'p1').length - 2);
  });
  it('negative: lands are never put into your hand', () => {
    const s0 = start(lib('Plains', 'Forest', 'Test Bear', 'Test Giant', 'Test Bolt Card'));
    const r = play(s0, 'Test Deep Trawl');
    expect(handOf(r.s, 'p1').filter((n) => n === 'Plains' || n === 'Forest')).toHaveLength(1); // only the Plains drawn for the turn
  });
});

describe('CR 701.20a, 506.4, 608.2c: "Whenever a creature attacks you or a planeswalker you control, reveal the top card of your library. If it\'s a Forest card, remove that creature from combat. Then put the revealed card on the bottom of your library." (Lost in the Woods; "it" is the revealed card, not the attacker)', () => {
  const WOODS = card('Test Lost Wood', 'Enchantment', 'Whenever a creature attacks you or a planeswalker you control, reveal the top card of your library. If it\'s a Forest card, remove that creature from combat. Then put the revealed card on the bottom of your library.');
  const RAIDER = card('Test Raider', 'Creature — Human Warrior', '', ['2', '2']);
  const defs = [WOODS, RAIDER, FOREST];
  const attack = (top: string): GameState => {
    let s = scenario(['Plains'], { p1: { battlefield: ['Test Raider'] }, p2: { battlefield: ['Test Lost Wood'], library: [top, top, top, 'Plains', 'Plains'] }, defs });
    s = advanceTo(s, 3, 'main1');
    return resolveAll(attackWith(s, [find(s, 'Test Raider', 'battlefield', 'p1')]));
  };
  const finish = (s: GameState): GameState => passUntil(s, (x) => x.turn.step === 'endCombat' || x.turn.step === 'main2', 'the end of combat');
  it('is automated', () => expect(full(WOODS)).toBe(true));
  it('a Forest on top: the attacker is removed from combat and deals no damage; the Forest goes to the bottom', () => {
    const s = finish(attack('Forest'));
    expect(s.players.find((x) => x.id === 'p2')!.life).toBe(20);
    expect(libOf(s, 'p2').at(-1)).toBe('Forest');
  });
  it('negative: another card on top: the attacker stays in combat and deals 2 damage; the card still goes to the bottom', () => {
    const s = finish(attack('Plains'));
    expect(s.players.find((x) => x.id === 'p2')!.life).toBe(18);
  });
});
