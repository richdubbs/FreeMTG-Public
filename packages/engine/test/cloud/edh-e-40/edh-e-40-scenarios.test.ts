/**
 * Commander coordinator E, round edh-e-40 (library 1/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10). Alice (p1) is the active
 * player of turn 1, Bob (p2) the opponent. Each test is named after the rule it checks, with its negative case. CR cites from memory (cloud session without rules/cr): unverified
 * unless the record says so.
 *
 *   CR 701.20e, 401.4, 406.1   "Look at the top X cards of target opponent's library. Exile one of those cards and put the rest back on top of that player's library in any order." (Sealed Fate)
 *   CR 701.20e, 401.4, 603.2   "Whenever an opponent shuffles their library, you may look at the top two cards of that library. You may exile one of those cards. Then put the rest on top of that library in any order." (Psychic Surgery)
 *   CR 701.20e, 401.4, 406.1   "Target player looks at the top three cards of their library, puts one of them back on top of their library, then exiles the rest." (Ashnod's Cylix)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { put } from '../../m3/scenario';
import { act, activations, answer, card, find, full, passBoth, scenario } from '../r5-cost/support';

const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const names = (s: GameState, ids: readonly string[]): string[] => ids.map((id) => nameOf(s, id));
const lib = (s: GameState, p: 'p1' | 'p2'): string[] => names(s, s.zones.library[p]!);
const exiled = (s: GameState): string[] => names(s, s.zones.exile);
function setLibrary(s: GameState, p: 'p1' | 'p2', libNames: string[]): void {
  for (const id of s.zones.library[p]!) delete s.objects[id];
  s.zones.library[p] = [];
  for (const n of libNames) put(s, p, 'library', n);
}
const mk = (n: string) => card(n, 'Sorcery', '', '{0}');
const CARDS = ['A', 'B', 'C', 'D', 'E'].map(mk);

interface Pick {
  /** the label of the card each chooseObjects decision takes (in order); a decision beyond the list takes the first option */
  take?: string[];
  /** the order of the `order` decision: labels, first = nearest the top */
  order?: string[];
  x?: number;
  target?: 'p1' | 'p2';
  yes?: boolean[];
  /** the option / color chosen by a chooseOption or chooseColor decision */
  option?: string;
  color?: string;
  /** attackers declared when the declare-attackers decision comes up */
  attack?: ObjectId[];
  /** records every decision kind seen, with the player who had to answer */
  seen?: string[];
}
/** Answers every decision until the stack is empty and the active player has priority again; priority is passed. */
function play(s0: GameState, pick: Pick = {}): GameState {
  let s = s0;
  const take = [...(pick.take ?? [])];
  const yes = [...(pick.yes ?? [true])];
  for (let i = 0; i < 40 && s.pending; i++) {
    const p = s.pending as any;
    pick.seen?.push(`${p.kind}:${p.player}`);
    if (p.kind === 'priority') { if (s.zones.stack.length === 0 && !(pick.attack !== undefined && s.turn.step !== 'main2' && s.turn.step !== 'end')) break; s = passBoth(s); }
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: pick.x ?? p.min });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: p.players?.length ? [{ kind: 'player', id: pick.target ?? 'p2' }] : [] });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: yes.shift() ?? false });
    else if (p.kind === 'chooseObjects') {
      const label = take.shift();
      const ids = label === undefined ? p.options.slice(0, p.min) : label === '*' ? [p.options[0]] : label === '-' ? [] : [p.options.find((o: ObjectId) => nameOf(s, o) === label)];
      s = answer(s, { kind: 'chooseObjects', ids });
    } else if (p.kind === 'chooseName') s = answer(s, { kind: 'chooseName', name: pick.option ?? p.options[0] });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [pick.option ?? p.options[0].id] });
    else if (p.kind === 'chooseColor') s = answer(s, { kind: 'chooseColor', color: (pick.color ?? 'R') as 'R' });
    else if (p.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: (pick.attack ?? []).map((attacker) => ({ attacker, defender: 'p2' as const })) });
    else if (p.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else if (p.kind === 'order') {
      const ids = pick.order === undefined ? p.items.map((x: any) => x.id) : pick.order.map((l) => p.items.find((x: any) => x.label === l).id);
      s = answer(s, { kind: 'order', ids });
    } else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
}

const FATE = card('Test Foresight', 'Sorcery', 'Look at the top X cards of target opponent\'s library. Exile one of those cards and put the rest back on top of that player\'s library in any order.', '{X}');
const SURGERY = card('Test Peeking Aura', 'Enchantment', 'Whenever an opponent shuffles their library, you may look at the top two cards of that library. You may exile one of those cards. Then put the rest on top of that library in any order.');
const STIR = card('Test Stir', 'Instant', 'Shuffle your library.');
const CYLIX = card('Test Cask', 'Artifact', '{0}, {T}: Target player looks at the top three cards of their library, puts one of them back on top of their library, then exiles the rest.');

describe('the synthetic cards are automated', () => {
  it('play fully', () => { for (const d of [FATE, SURGERY, STIR, CYLIX]) expect(full(d), `${d.name}: ${JSON.stringify(d.automation)}`).toBe(true); });
});

describe('"Look at the top X cards of target opponent\'s library. Exile one of those cards and put the rest back on top of that player\'s library in any order." (CR 701.20e, 401.4, 406.1; Sealed Fate)', () => {
  const defs = [FATE, ...CARDS];
  const start = (p1Lib: string[] = ['A', 'B', 'C', 'D', 'E']) => {
    const s = scenario([], { defs, p1: { hand: ['Test Foresight'], battlefield: ['Plains', 'Plains', 'Plains'] } });
    setLibrary(s, 'p2', p1Lib);
    setLibrary(s, 'p1', ['E', 'D']);
    return s;
  };
  const cast = (s: GameState) => act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Foresight', 'hand', 'p1') });
  it('X = 3: exiles the chosen one of the top three, and the other two go back on top in the order the caster chose; the fourth and fifth cards stay where they were', () => {
    const seen: string[] = [];
    const s = play(cast(start()), { x: 3, take: ['B'], order: ['C', 'A'], seen });
    expect(exiled(s)).toEqual(['B']);
    expect(lib(s, 'p2')).toEqual(['C', 'A', 'D', 'E']);
    expect(lib(s, 'p1')).toEqual(['E', 'D']); // the caster's own library is untouched
    expect(seen).toContain('order:p1'); // the caster arranges them (CR 401.4: the effect names the player who looked)
    expect(seen).toContain('chooseObjects:p1');
  });
  it('the cards the caster may exile are only those looked at (the top X)', () => {
    let s = cast(start());
    s = answer(s, { kind: 'chooseNumber', n: 2 });
    s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] });
    s = answer(s, { kind: 'payCost', auto: true });
    s = passBoth(s);
    const p = s.pending as any;
    expect(p.kind).toBe('chooseObjects');
    expect(names(s, p.options)).toEqual(['A', 'B']);
    expect(p.min).toBe(1);
    expect(p.max).toBe(1);
  });
  it('the negative case: X = 1 exiles the only card looked at and has nothing to put back', () => {
    const s = play(cast(start()), { x: 1 });
    expect(exiled(s)).toEqual(['A']);
    expect(lib(s, 'p2')).toEqual(['B', 'C', 'D', 'E']);
  });
  it('the negative case: X larger than the library looks at what is there and still exiles exactly one', () => {
    const s = play(cast(start(['A', 'B'])), { x: 3, take: ['A'] });
    expect(exiled(s)).toEqual(['A']);
    expect(lib(s, 'p2')).toEqual(['B']);
  });
});

describe('"Whenever an opponent shuffles their library, you may look at the top two cards of that library. You may exile one of those cards. Then put the rest on top of that library in any order." (CR 701.20e, 401.4; Psychic Surgery)', () => {
  const defs = [SURGERY, STIR, ...CARDS];
  /** p1 has the Aura on the battlefield; p1 casts a spell is not needed: p1 passes and p2 shuffles their library with an instant. */
  const start = () => {
    const s = scenario([], { defs, p1: { battlefield: ['Test Peeking Aura'] }, p2: { hand: ['Test Stir'] } });
    setLibrary(s, 'p2', ['A', 'B', 'C', 'D']);
    setLibrary(s, 'p1', ['E', 'D']);
    return s;
  };
  const shuffle = (s0: GameState, who: 'p1' | 'p2'): GameState => {
    let s = s0;
    if (who === 'p2') s = act(s, { type: 'pass', player: 'p1' });
    return act(s, { type: 'cast', player: who, card: find(s, 'Test Stir', 'hand', who) });
  };
  it('the opponent shuffles: the library is shuffled, then the trigger looks at the top two cards of the shuffled library, exiles the chosen one and puts the other back', () => {
    const seen: string[] = [];
    let s = shuffle(start(), 'p2');
    s = play(s, { take: ['*'], yes: [true], seen });
    // the shuffle is random: whichever two cards are on top of the shuffled library, exactly one of them is exiled and three remain in the library
    expect(exiled(s).length).toBe(1);
    expect(lib(s, 'p2').length).toBe(3);
    expect([...lib(s, 'p2'), ...exiled(s)].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(seen.filter((x) => x === 'yesNo:p1').length).toBe(1);
  });
  it('declining the option leaves the library as the shuffle left it', () => {
    let s = shuffle(start(), 'p2');
    s = play(s, { yes: [false] });
    expect(exiled(s)).toEqual([]);
    expect(lib(s, 'p2').length).toBe(4);
  });
  it('the negative case: you shuffling your own library does not trigger it', () => {
    const s0 = scenario([], { defs, p1: { battlefield: ['Test Peeking Aura'], hand: ['Test Stir'] } });
    setLibrary(s0, 'p1', ['E', 'D']);
    let s = shuffle(s0, 'p1');
    const seen: string[] = [];
    s = play(s, { seen });
    expect(seen.filter((x) => x.startsWith('yesNo'))).toEqual([]);
    expect(exiled(s)).toEqual([]);
  });
});

describe('"Target player looks at the top three cards of their library, puts one of them back on top of their library, then exiles the rest." (CR 701.20e, 401.4, 109.5; Ashnod\'s Cylix)', () => {
  const defs = [CYLIX, ...CARDS];
  const start = () => {
    const s = scenario([], { defs, p1: { battlefield: ['Test Cask'] } });
    setLibrary(s, 'p2', ['A', 'B', 'C', 'D', 'E']);
    setLibrary(s, 'p1', ['E', 'D', 'C']);
    return s;
  };
  const activate = (s: GameState) => {
    const a = activations(s, 'Test Cask')[0]!;
    return act(s, a.action);
  };
  it('the targeted player (not the activator) chooses which of their top three goes back; the other two are exiled', () => {
    const seen: string[] = [];
    const s = play(activate(start()), { target: 'p2', take: ['C'], seen });
    expect(lib(s, 'p2')).toEqual(['C', 'D', 'E']);
    expect(exiled(s).sort()).toEqual(['A', 'B']);
    expect(seen).toContain('chooseObjects:p2');
    expect(lib(s, 'p1')).toEqual(['E', 'D', 'C']);
  });
  it('targeting yourself: you choose and your own library is the one used', () => {
    const s = play(activate(start()), { target: 'p1', take: ['D'] });
    expect(lib(s, 'p1')).toEqual(['D']);
    expect(exiled(s).sort()).toEqual(['C', 'E']);
    expect(lib(s, 'p2')).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

const OATH = card('Test Vow', 'Instant', 'Choose a card type. Target opponent reveals their hand. ~ deals 3 damage to that player for each card of the chosen type revealed this way.', '{0}');
const DRAKE = card('Test Igniting Drake', 'Creature — Dragon', 'Flying\nWhenever ~ deals combat damage to a player, you may pay {2}{R}. If you do, choose a color, then that player reveals their hand and ~ deals damage to the player equal to the number of cards of that color revealed this way.', '{0}', ['2', '2']);
const life = (s: GameState, p: 'p1' | 'p2'): number => s.players.find((x) => x.id === p)!.life;
const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2'], ['G']);
const RED_SPARK = card('Test Red Spark', 'Instant', '', '{0}', undefined, ['R']);
const RED_BEAR = card('Test Red Bear', 'Creature — Bear', '', '{0}', ['2', '2'], ['R']);
const GREEN_SPARK = card('Test Green Spark', 'Instant', '', '{0}', undefined, ['G']);
const RELIC = card('Test Relic', 'Artifact', '', '{0}');

describe('"Choose a card type. Target opponent reveals their hand. ~ deals 3 damage to that player for each card of the chosen type revealed this way." (CR 608.2d, 607.2d, 701.20a, 120.3; Blood Oath)', () => {
  const defs = [OATH, BEAR, RED_SPARK, GREEN_SPARK, RELIC];
  const start = () => scenario([], { defs, p1: { hand: ['Test Vow'] }, p2: { hand: ['Test Bear', 'Test Bear', 'Test Red Spark', 'Test Relic', 'Plains'] } });
  const cast = (s: GameState) => act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Vow', 'hand', 'p1') });
  it('creature: two creature cards in the hand, 3 damage each, in one event', () => {
    const s = play(cast(start()), { option: 'Creature', target: 'p2' });
    expect(life(s, 'p2')).toBe(20 - 6);
    expect(life(s, 'p1')).toBe(20);
  });
  it('instant: one instant card, 3 damage', () => {
    const s = play(cast(start()), { option: 'Instant' });
    expect(life(s, 'p2')).toBe(17);
  });
  it('the negative case: a type nobody in the hand has deals no damage', () => {
    const s = play(cast(start()), { option: 'Planeswalker' });
    expect(life(s, 'p2')).toBe(20);
  });
  it('the negative case: only the revealed hand counts, not the battlefield or graveyard', () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Vow'] }, p2: { hand: ['Test Relic'], battlefield: ['Test Bear'], graveyard: ['Test Bear'] } });
    const s = play(cast(s0), { option: 'Creature' });
    expect(life(s, 'p2')).toBe(20);
  });
});

describe('"Whenever ~ deals combat damage to a player, you may pay {2}{R}. If you do, choose a color, then that player reveals their hand and ~ deals damage to the player equal to the number of cards of that color revealed this way." (CR 608.2d, 105.1, 701.20a, 120.3; Darigaaz, the Igniter)', () => {
  const defs = [DRAKE, RED_BEAR, RED_SPARK, GREEN_SPARK, BEAR];
  const start = () => scenario(['Mountain'], { defs, p1: { battlefield: ['Test Igniting Drake', 'Mountain', 'Mountain', 'Mountain'] }, p2: { hand: ['Test Red Bear', 'Test Red Spark', 'Test Green Spark'] } });
  const drake = (s: GameState) => find(s, 'Test Igniting Drake', 'battlefield', 'p1');
  const run = (pick: Pick) => { const s0 = start(); let s = s0; while (s.turn.step !== 'declareAttackers' && s.pending?.kind !== 'declareAttackers') s = act(s, { type: 'pass', player: s.pending!.player }); return play(s, { ...pick, attack: [drake(s0)] }); };
  it('pay and choose red: 2 combat damage, then damage equal to the red cards of the revealed hand (2)', () => {
    const s = run({ yes: [true], color: 'R' });
    expect(life(s, 'p2')).toBe(20 - 2 - 2);
  });
  it('choose green: only the green card of the hand counts (1)', () => {
    const s = run({ yes: [true], color: 'G' });
    expect(life(s, 'p2')).toBe(20 - 2 - 1);
  });
  it('the negative case: not paying deals only the combat damage', () => {
    const s = run({ yes: [false] });
    expect(life(s, 'p2')).toBe(18);
  });
});

describe('"Counter target instant or sorcery spell. Its controller reveals cards from the top of their library until they reveal an instant or sorcery card. That player may cast that card without paying its mana cost. Then the player shuffles." (CR 701.6a, 701.20a-b, 601.2, 118.9, 701.24a; Spellshift)', () => {
  const SHIFT = card('Test Spellshift', 'Instant', 'Counter target instant or sorcery spell. Its controller reveals cards from the top of their library until they reveal an instant or sorcery card. That player may cast that card without paying its mana cost. Then the player shuffles.', '{0}');
  const GAIN1 = card('Test Gain One', 'Sorcery', 'You gain 1 life.', '{0}');
  const GAIN5 = card('Test Gain Five', 'Instant', 'You gain 5 life.', '{0}');
  const LAND = card('Test Rock', 'Artifact', '', '{0}');
  const defs = [SHIFT, GAIN1, GAIN5, LAND];
  const start = () => {
    const s = scenario([], { defs, p1: { hand: ['Test Gain One'] }, p2: { hand: ['Test Spellshift'] } });
    setLibrary(s, 'p1', ['Test Rock', 'Test Rock', 'Test Gain Five', 'Test Rock']);
    return s;
  };
  it('the countered spell\'s controller reveals down to the first instant or sorcery and may cast it for free', () => {
    let s = start();
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Gain One', 'hand', 'p1') });
    s = act(s, { type: 'pass', player: 'p1' });
    const spell = s.zones.stack[0]!;
    s = act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Spellshift', 'hand', 'p2') });
    s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'object', id: spell }] });
    const seen: string[] = [];
    s = play(s, { yes: [true], seen });
    expect(life(s, 'p1')).toBe(25); // Test Gain One was countered (no +1); Test Gain Five was cast for free by p1 (+5)
    expect(seen).toContain('yesNo:p1'); // the countered spell's controller decides, not the counterspell's
    expect(s.zones.graveyard.p1!.map((id) => nameOf(s, id)).sort()).toEqual(['Test Gain Five', 'Test Gain One']);
    expect(lib(s, 'p1').length).toBe(3); // the revealed Rocks stay in the library (shuffled), the cast card left it
  });
  it('declining leaves the revealed instant in the library and gains nothing', () => {
    let s = start();
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Gain One', 'hand', 'p1') });
    s = act(s, { type: 'pass', player: 'p1' });
    const spell = s.zones.stack[0]!;
    s = act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Spellshift', 'hand', 'p2') });
    s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'object', id: spell }] });
    s = play(s, { yes: [false] });
    expect(life(s, 'p1')).toBe(20);
    expect(lib(s, 'p1').length).toBe(4);
  });
});
