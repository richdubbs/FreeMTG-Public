/**
 * Round edh-e-34 (Commander coordinator E, group dice-random): the behaviour it added, played through the engine with synthetic cards (invented names), compiled by the
 * game's default compiler. The dice are the state's seeded generator; each test reads the results rolled from the game's log.
 *
 *   CR 706.2, 706.6, 603.2c   "Whenever you roll your third die each turn, ..." (Resolute Veggiesaur): each die kept counts, once; the first and second do not trigger
 *   CR 706.2, 611.3a          "~ has trample as long as you've rolled three or more dice this turn" (The Space Family Goblinson)
 *   CR 601.3, 614.1a, 706.2   "You may cast ~ from your graveyard as long as you've rolled a 6 this turn. If you cast it this way and it would be put into your graveyard, exile it instead." (Eelectrocute)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, answer, find, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string } = {}): CardDef {
  return compileCard({
    name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [],
    ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}),
  } as OracleCard);
}
const rolled = (s: GameState): number[] => s.log.flatMap((l) => { const m = /rolls a d\d+: (\d+)\./.exec(l.text); return m ? [Number(m[1])] : []; });
const SEEDS = Array.from({ length: 12 }, (_, i) => `e${i}`);
let reverseOrder = false;
function settle(s0: GameState): GameState {
  let s = s0;
  for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 60; guard++) {
    const p = s.pending as unknown as { kind: string; options: { id: string }[] & string[]; min: number; items: { id: string }[] };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] } as never);
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: (p.options as unknown as string[]).slice(0, p.min) });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((x) => x.id)[reverseOrder ? 'reverse' : 'slice']() });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
}
const resolveAll = (s0: GameState): GameState => {
  let s = settle(s0);
  for (let guard = 0; s.zones.stack.length > 0 && guard < 40; guard++) s = settle(s.pending?.kind === 'priority' ? pass(s) : s);
  return s;
};
const cast = (s: GameState, name: string, zone: 'hand' | 'graveyard' = 'hand'): GameState => resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, name, zone, 'p1') }));
const counters = (s: GameState, id: ObjectId): number => s.objects[id]!.counters['+1/+1'] ?? 0;
const kws = (s: GameState, id: ObjectId): string[] => getChars(s, id)!.keywords.map((k) => (typeof k === 'string' ? k : (k as { keyword: string }).keyword));

const ONE = card('Test One Roller', 'Sorcery', 'Roll a d6.');
const TWO = card('Test Two Roller', 'Sorcery', 'Roll two six-sided dice.');
const DINO = card('Test Dino', 'Creature — Dinosaur', 'Trample\nWhenever you roll your third die each turn, put a +1/+1 counter on this creature.', { pt: ['2', '2'] });
const GOB = card('Test Goblin Guest', 'Creature — Goblin', 'This creature has trample as long as you\'ve rolled three or more dice this turn.', { pt: ['1', '1'] });
const EEL = card('Test Zap', 'Instant', 'Test Zap deals 2 damage to any target.\nYou may cast this card from your graveyard as long as you\'ve rolled a 6 this turn. If you cast it this way and it would be put into your graveyard, exile it instead.');
const VISITOR = card('Test Line Walker', 'Creature — Human', 'When this creature enters, roll to visit your Attractions.', { pt: ['1', '1'] });
const HOLDER = card('Test Pass Holder', 'Creature — Zombie', 'This creature enters tapped.\nWhenever you roll to visit your Attractions, if you roll a 6, you may return this card from your graveyard to the battlefield.', { pt: ['2', '2'] });
const FIND = card('Test Dig', 'Sorcery', 'Return a card at random from your graveyard to your hand, then reorder your graveyard as you choose.');
const SURV = card('Test Search Party', 'Sorcery', "Reorder your graveyard at random. An opponent chooses a card at random in your graveyard. If it's a creature card, put it onto the battlefield. Otherwise, exile it.");
const CREA = card('Test Bear A', 'Creature — Bear', '', { pt: ['2', '2'] });
const CREB = card('Test Bear B', 'Creature — Bear', '', { pt: ['2', '2'] });
const ROCK = card('Test Rock', 'Artifact', '');
const GEM = card('Test Gem', 'Artifact', '');
const DEFS = [ONE, TWO, DINO, GOB, EEL, VISITOR, HOLDER, FIND, SURV, CREA, CREB, ROCK, GEM];

describe('CR 706.2, 603.2c: "Whenever you roll your third die each turn" (Resolute Veggiesaur)', () => {
  it('is fully automated', () => { for (const c of [DINO, GOB, EEL]) expect(c.automation.level, c.name).toBe('full'); });
  const start = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test One Roller', 'Test One Roller', 'Test One Roller', 'Test One Roller', 'Test Two Roller'], battlefield: ['Test Dino'] } });
  it('the first and second dice do nothing; the third die gives exactly one counter; later dice give none', () => {
    for (const seed of SEEDS) {
      let s = start(seed);
      const dino = find(s, 'Test Dino', 'battlefield', 'p1');
      s = cast(s, 'Test One Roller');
      expect(counters(s, dino), `${seed} 1 die`).toBe(0);
      s = cast(s, 'Test One Roller');
      expect(counters(s, dino), `${seed} 2 dice`).toBe(0);
      s = cast(s, 'Test One Roller');
      expect(counters(s, dino), `${seed} 3 dice`).toBe(1);
      s = cast(s, 'Test One Roller');
      expect(counters(s, dino), `${seed} 4 dice`).toBe(1);
      expect(rolled(s).length).toBe(4);
    }
  });
  it('a roll of two dice that includes the third die triggers once; a roll that stays under three does not', () => {
    for (const seed of SEEDS) {
      let s = start(seed);
      const dino = find(s, 'Test Dino', 'battlefield', 'p1');
      s = cast(s, 'Test One Roller');
      s = cast(s, 'Test Two Roller'); // dice 2 and 3
      expect(counters(s, dino), `${seed} 2+3`).toBe(1);
      let t = start(seed);
      t = cast(t, 'Test Two Roller'); // dice 1 and 2
      expect(counters(t, find(t, 'Test Dino', 'battlefield', 'p1')), `${seed} 1+2`).toBe(0);
    }
  });
});

describe('CR 706.2, 611.3a: "has trample as long as you\'ve rolled three or more dice this turn" (The Space Family Goblinson)', () => {
  const start = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test One Roller', 'Test One Roller', 'Test Two Roller'], battlefield: ['Test Goblin Guest'] } });
  it('trample appears with the third die rolled this turn and not before', () => {
    for (const seed of SEEDS) {
      let s = start(seed);
      const g = find(s, 'Test Goblin Guest', 'battlefield', 'p1');
      expect(kws(s, g)).not.toContain('trample');
      s = cast(s, 'Test One Roller');
      s = cast(s, 'Test One Roller');
      expect(kws(s, g), `${seed} two dice`).not.toContain('trample');
      s = cast(s, 'Test Two Roller');
      expect(kws(s, g), `${seed} four dice`).toContain('trample');
    }
  });
});

describe('CR 601.3, 614.1a, 706.2: Eelectrocute cast from the graveyard as long as a 6 was rolled this turn', () => {
  const start = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test Two Roller', 'Test Two Roller', 'Test Two Roller', 'Test Two Roller'], graveyard: ['Test Zap'] } });
  it('castable from the graveyard exactly when a die rolled this turn showed a 6, then exiled instead of going to the graveyard', () => {
    let withSix = 0;
    let withoutSix = 0;
    for (let i = 0; i < 40 && (withSix < 2 || withoutSix < 2); i++) {
      let s = start(`z${i}`);
      const zap = find(s, 'Test Zap', 'graveyard', 'p1');
      const canCast = (st: GameState): boolean => {
        try { act(st, { type: 'cast', player: 'p1', card: zap }); return true; } catch { return false; }
      };
      expect(canCast(s), `z${i} before any roll`).toBe(false);
      s = cast(s, 'Test Two Roller');
      const has6 = rolled(s).includes(6);
      expect(canCast(s), `z${i} rolled ${rolled(s).join(',')}`).toBe(has6);
      if (has6) {
        withSix++;
        const after = resolveAll(act(s, { type: 'cast', player: 'p1', card: zap }));
        expect(after.zones.exile.some((id) => after.objects[id]?.defId === 'Test Zap'), 'exiled').toBe(true);
        expect(after.zones.graveyard.p1!.some((id) => after.objects[id]?.defId === 'Test Zap')).toBe(false);
      } else withoutSix++;
    }
    expect(withSix).toBeGreaterThan(0);
    expect(withoutSix).toBeGreaterThan(0);
  });
  it('cast from the hand (not through the permission) it goes to the graveyard as usual, not to exile (ruling 2022-10-07: the exile applies only to the cast the permission allows)', () => {
    const s0 = scenario([], { seed: 'h1', defs: DEFS, p1: { hand: ['Test Zap'] } });
    const s = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Zap', 'hand', 'p1') }));
    expect(s.zones.graveyard.p1!.some((id) => s.objects[id]?.defId === 'Test Zap')).toBe(true);
    expect(s.zones.exile.some((id) => s.objects[id]?.defId === 'Test Zap')).toBe(false);
  });
});

describe('CR 701.52a, 603.2c: "roll to visit your Attractions" (Line Cutter) and "Whenever you roll to visit your Attractions, if you roll a 6" ("Lifetime" Pass Holder)', () => {
  it('is fully automated', () => { for (const c of [VISITOR, HOLDER]) expect(c.automation.level, c.name).toBe('full'); });
  const start = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test Line Walker', 'Test One Roller'], graveyard: ['Test Pass Holder'] } });
  const onField = (s: GameState, name: string): boolean => s.zones.battlefield.some((id) => s.objects[id]!.defId === name);
  it('rolls exactly one six-sided die; the holder returns from the graveyard exactly when that roll is a 6', () => {
    let six = 0;
    let other = 0;
    for (let i = 0; i < 60 && (six < 3 || other < 3); i++) {
      const s = cast(start(`v${i}`), 'Test Line Walker');
      const r = rolled(s);
      expect(r.length, `v${i}`).toBe(1);
      expect(r[0]! >= 1 && r[0]! <= 6).toBe(true);
      expect(onField(s, 'Test Pass Holder'), `v${i} rolled ${r[0]}`).toBe(r[0] === 6);
      if (r[0] === 6) six++; else other++;
    }
    expect(six).toBeGreaterThan(0);
    expect(other).toBeGreaterThan(0);
  });
  it('an ordinary roll of a die (not to visit) never returns the holder, even when it shows a 6', () => {
    let sixes = 0;
    for (let i = 0; i < 60 && sixes < 3; i++) {
      const s = cast(start(`w${i}`), 'Test One Roller');
      if (rolled(s)[0] === 6) sixes++;
      expect(onField(s, 'Test Pass Holder'), `w${i}`).toBe(false);
    }
    expect(sixes).toBeGreaterThan(0);
  });
});

const gyNames = (s: GameState): string[] => s.zones.graveyard.p1!.map((id) => s.objects[id]!.defId);
describe('CR 404.2, 701.24a, 608.2d: reordering a graveyard (Fossil Find, Search for Survivors)', () => {
  it('are fully automated', () => { expect(FIND.automation.level).toBe('full'); expect(SURV.automation.level).toBe('full'); });
  const startF = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test Dig'], graveyard: ['Test Bear A', 'Test Rock', 'Test Gem', 'Test Bear B'] } });
  it('Fossil Find returns one card of the graveyard to the hand and leaves the others in the order the player chose', () => {
    const returned = new Set<string>();
    for (const seed of SEEDS) {
      for (const rev of [false, true]) {
        reverseOrder = rev;
        const before = gyNames(startF(seed)).slice();
        const s = cast(startF(seed), 'Test Dig');
        reverseOrder = false;
        const hand = s.zones.hand.p1!.map((id) => s.objects[id]!.defId);
        const back = before.filter((n) => hand.includes(n));
        expect(back.length, `${seed} one card returned`).toBe(1);
        returned.add(back[0]!);
        const rest = gyNames(s).filter((n) => n !== 'Test Dig');
        expect(rest.length).toBe(3);
        const expected = before.filter((n) => n !== back[0]);
        expect(rest, `${seed} reversed=${rev}`).toEqual(rev ? [...expected].reverse() : expected);
      }
    }
    expect(returned.size, 'the card is chosen at random').toBeGreaterThan(1);
  });
  const startS = (seed: string): GameState => scenario([], { seed, defs: DEFS, p1: { hand: ['Test Search Party'], graveyard: ['Test Bear A', 'Test Rock', 'Test Gem', 'Test Bear B'] } });
  it('Search for Survivors puts a creature card onto the battlefield or exiles any other card: exactly one card leaves the graveyard, and the order is randomized', () => {
    let creature = 0;
    let other = 0;
    const orders = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = cast(startS(`r${i}`), 'Test Search Party');
      const gone = ['Test Bear A', 'Test Rock', 'Test Gem', 'Test Bear B'].filter((n) => !gyNames(s).includes(n));
      expect(gone.length, `r${i}`).toBe(1);
      const onField = s.zones.battlefield.some((id) => s.objects[id]!.defId === gone[0]);
      const exiled = s.zones.exile.some((id) => s.objects[id]!.defId === gone[0]);
      if (gone[0]!.startsWith('Test Bear')) { expect(onField, `r${i} creature`).toBe(true); creature++; } else { expect(exiled, `r${i} noncreature`).toBe(true); expect(onField).toBe(false); other++; }
      orders.add(gyNames(s).join(','));
    }
    expect(creature).toBeGreaterThan(0);
    expect(other).toBeGreaterThan(0);
    expect(orders.size, 'the graveyard order varies between seeds').toBeGreaterThan(1);
  });
  it('does nothing to an empty graveyard', () => {
    const s = cast(scenario([], { seed: 'q', defs: DEFS, p1: { hand: ['Test Search Party'] } }), 'Test Search Party');
    expect(s.zones.battlefield.length).toBe(0);
  });
});
