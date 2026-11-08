/**
 * Commander lane edh-e, round edh-e-47 (counterspell-modes): the round's readings played through the engine with synthetic cards (invented names, design 6.10),
 * compiled by the game's default compiler. CR cites are from the Comprehensive Rules of 2026-09-25 (see the round's record; cites that were not checked against the text are listed there).
 *
 *   CR 701.8a, 701.19c, 208.1, 608.2d  "Destroy the creature with the least power. It can't be regenerated. If two or more creatures are tied for least power, you choose one of them." (Porphyry Nodes, Drop of Honey)
 *   CR 701.6a, 115.9b, 109.4           "Counter target spell or ability an opponent controls that targets a land you control." (Teferi's Response)
 *   CR 701.6a, 202.3, 602.2b           "Counter target spell if it has the same mana value as the discarded card." (Hisoka, Minamo Sensei)
 *   CR 701.6a, 608.2c, 608.2d          "If that spell is countered this way, its controller may put a creature card from their hand onto the battlefield." (Fold into Aether)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { getChars } from '../../../src/index';
import { act, advanceTo, find, legal, pass, scenario } from '../../m3/scenario';
import { card, full, inYard, named, resolveAll, settle } from '../cmd3/helpers';

const give = (s: GameState, player: 'p1' | 'p2', mana: string): void => { for (const t of mana) s.players[player === 'p1' ? 0 : 1]!.manaPool.push({ type: t } as never); };
const handNames = (s: GameState, p: 'p1' | 'p2'): string[] => (s.zones.hand[p] ?? []).map((id) => s.objects[id]!.defId);
void advanceTo; void getChars;

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CR 701.8a, 701.19c, 608.2d: "Destroy the creature with the least power. It can\'t be regenerated. If two or more creatures are tied for least power, you choose one of them."', () => {
  const CULL = card('Test Cull', 'Sorcery', "Destroy the creature with the least power. It can't be regenerated. If two or more creatures are tied for least power, you choose one of them.");
  const MOUSE = card('Test Mouse', 'Creature — Mouse', '', [ '1', '1' ]);
  const MOUSE2 = card('Test Mouse Twin', 'Creature — Mouse', '', [ '1', '1' ]);
  const BEAR = card('Test Bear', 'Creature — Bear', '', [ '2', '2' ]);
  const GIANT = card('Test Giant', 'Creature — Giant', '', [ '4', '4' ]);
  const STONE = card('Test Stone Mouse', 'Creature — Mouse', 'Indestructible', ['1', '1']);
  const defs = [CULL, MOUSE, MOUSE2, BEAR, GIANT, STONE];
  const run = (p1: string[], p2: string[], pickIndex = 0): GameState => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Cull'], battlefield: p1 }, p2: { battlefield: p2 } });
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Cull', 'hand', 'p1') }));
    // both players pass to resolve the spell; the tie choice (if any) is p1's decision
    for (let g = 0; g < 20 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); g++) {
      if (s.pending?.kind === 'chooseObjects') {
        const d = s.pending as unknown as { options: ObjectId[]; player: string };
        expect(d.player).toBe('p1');
        s = settle(s, { objects: [d.options[Math.min(pickIndex, d.options.length - 1)]!] });
      } else if (s.pending?.kind === 'priority') s = pass(s);
      else s = settle(s);
    }
    return s;
  };
  it('is automated', () => { expect(full(CULL)).toBe(true); });
  it('the one creature with the least power dies, whoever controls it (an opponent\'s creature among yours)', () => {
    const s = run(['Test Bear', 'Test Giant'], ['Test Mouse']);
    expect(named(s, 'Test Mouse')).toEqual([]);
    expect(named(s, 'Test Bear')).toHaveLength(1);
    expect(named(s, 'Test Giant')).toHaveLength(1);
    expect(inYard(s, 'Test Mouse', 'p2')).toBe(true);
  });
  it('negative: a creature with more power than another survives; only one creature is destroyed', () => {
    const s = run(['Test Bear', 'Test Giant'], ['Test Bear']);
    expect(named(s, 'Test Bear')).toHaveLength(1); // one of the two 2-power Bears (a tie)
    expect(named(s, 'Test Giant')).toHaveLength(1);
  });
  it('rulings 2021-03-19: an indestructible creature of the least power is not the one chosen (the other one of the tie dies); if all of them are indestructible nothing is destroyed', () => {
    const a = run(['Test Stone Mouse', 'Test Giant'], ['Test Mouse']);
    expect(named(a, 'Test Mouse')).toEqual([]);
    expect(named(a, 'Test Stone Mouse')).toHaveLength(1);
    const b = run(['Test Stone Mouse', 'Test Bear'], ['Test Giant']);
    expect(named(b, 'Test Stone Mouse')).toHaveLength(1);
    expect(named(b, 'Test Bear')).toHaveLength(1); // the 2-power Bear is not of the least power: nothing is destroyed
    expect(named(b, 'Test Giant')).toHaveLength(1);
  });
  it('a tie for least power: its controller (p1) chooses which one dies; the other survives (both picks tried)', () => {
    for (const pick of [0, 1]) {
      const s = run(['Test Mouse'], ['Test Mouse Twin', 'Test Giant'], pick);
      const alive = named(s, 'Test Mouse').length + named(s, 'Test Mouse Twin').length;
      expect(alive).toBe(1);
      expect(named(s, 'Test Giant')).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CR 701.6a, 115.9b, 109.4: "Counter target spell or ability an opponent controls that targets a land you control." (Teferi\'s Response)', () => {
  const RESP = card('Test Response', 'Instant', "Counter target spell or ability an opponent controls that targets a land you control. If a permanent's ability is countered this way, destroy that permanent.\nDraw two cards.");
  const BOLT = card('Test Land Zap', 'Instant', 'Test Land Zap deals 3 damage to target land.');
  const OWN = card('Test Own Zap', 'Instant', 'Test Own Zap deals 1 damage to target land.');
  const FOREST = card('Test Forest', 'Basic Land — Forest', '');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const defs = [RESP, BOLT, OWN, FOREST, BEAR];
  it('is automated', () => { expect(full(RESP)).toBe(true); });
  it("an opponent's spell that targets my land can be answered: it is countered and I draw two", () => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Response'], battlefield: ['Test Forest'], library: ['Test Forest', 'Test Forest', 'Test Forest'] }, p2: { hand: ['Test Land Zap'] } });
    const land = find(s0, 'Test Forest', 'battlefield', 'p1');
    let s = pass(s0); // p2 receives priority in p1's turn
    s = settle(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Land Zap', 'hand', 'p2') }), { targets: [{ kind: 'object', id: land }] });
    // p2 passed priority to p1 with the Zap on the stack
    s = s.pending?.kind === 'priority' && s.pending.player === 'p2' ? pass(s) : s;
    expect(s.pending?.kind === 'priority' ? s.pending.player : null).toBe('p1');
    const zap = s.zones.stack[0]!;
    s = settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Response', 'hand', 'p1') }), { targets: [{ kind: 'object', id: zap }] });
    s = resolveAll(s);
    expect(handNames(s, 'p1')).toHaveLength(2);
    expect(s.objects[land]?.damage).toBe(0);
    expect(inYard(s, 'Test Land Zap', 'p2')).toBe(true);
  });
  it("negative: Response has no legal target when the spell is mine, or aims at a creature (not a land I control)", () => {
    const canCast = (s: GameState): boolean => legal(s, 'p1', 'cast').some((x) => (x as unknown as { object?: string }).object === find(s, 'Test Response', 'hand', 'p1'));
    // an opponent's spell on my land: legal
    const base = scenario([], { defs, p1: { hand: ['Test Response'], battlefield: ['Test Forest', 'Test Bear'], library: ['Test Forest', 'Test Forest'] }, p2: { hand: ['Test Land Zap'], battlefield: ['Test Forest'] } });
    const myLand = find(base, 'Test Forest', 'battlefield', 'p1');
    const theirLand = find(base, 'Test Forest', 'battlefield', 'p2');
    const bear = find(base, 'Test Bear', 'battlefield', 'p1');
    const zapOn = (id: ObjectId): GameState => {
      let s = pass(base);
      s = settle(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Land Zap', 'hand', 'p2') }), { targets: [{ kind: 'object', id }] });
      return s.pending?.kind === 'priority' && s.pending.player === 'p2' ? pass(s) : s;
    };
    expect(canCast(zapOn(myLand))).toBe(true);
    expect(canCast(zapOn(theirLand))).toBe(false); // it targets THEIR land, not a land I control
    void bear;
    // my own spell on my own land: not a spell an opponent controls
    const own = scenario([], { defs, p1: { hand: ['Test Response', 'Test Own Zap'], battlefield: ['Test Forest'], library: ['Test Forest', 'Test Forest'] }, p2: {} });
    const ownLand = find(own, 'Test Forest', 'battlefield', 'p1');
    const s = settle(act(own, { type: 'cast', player: 'p1', card: find(own, 'Test Own Zap', 'hand', 'p1') }), { targets: [{ kind: 'object', id: ownLand }] });
    expect(s.zones.stack).toHaveLength(1);
    expect(canCast(s)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CR 701.6a, 202.3, 602.2b: "Counter target spell if it has the same mana value as the discarded card." (Hisoka, Minamo Sensei)', () => {
  const SAGE = card('Test Sage', 'Creature — Human Wizard', '{U}, Discard a card: Counter target spell if it has the same mana value as the discarded card.', ['1', '2']);
  const TWO = card('Test Two Rock', 'Artifact', '', undefined, '{2}');
  const THREE = card('Test Three Rock', 'Artifact', '', undefined, '{3}');
  const OTHER = card('Test Other Two Rock', 'Artifact', '', undefined, '{2}');
  const defs = [SAGE, TWO, THREE, OTHER];
  const run = (discard: string): GameState => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Two Rock'] }, p2: { battlefield: ['Test Sage'], hand: [discard] } });
    give(s0, 'p1', 'CC');
    give(s0, 'p2', 'U');
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Two Rock', 'hand', 'p1') }));
    if (s.pending?.kind === 'priority' && s.pending.player === 'p1') s = pass(s); // p2 gets priority with the Rock on the stack
    const sage = find(s, 'Test Sage', 'battlefield', 'p2');
    const a = legal(s, 'p2', 'activate').find((x) => (x as unknown as { object: ObjectId }).object === sage) as unknown as { action: never } | undefined;
    if (!a) throw new Error('no activation');
    s = settle(act(s, a.action), { targets: [{ kind: 'object', id: s.zones.stack[0]! }] });
    for (let g = 0; g < 10 && s.zones.stack.length > 0; g++) s = s.pending?.kind === 'priority' ? pass(s) : settle(s);
    return s;
  };
  it('is automated', () => { expect(full(SAGE)).toBe(true); });
  it('the discarded card has the same mana value (2) as the spell: the spell is countered (it is in its controller\'s graveyard, not on the battlefield)', () => {
    const s = run('Test Other Two Rock');
    expect(inYard(s, 'Test Two Rock', 'p1')).toBe(true);
    expect(named(s, 'Test Two Rock')).toEqual([]);
    expect(inYard(s, 'Test Other Two Rock', 'p2')).toBe(true);
  });
  it('negative: a different mana value (3): the discard was paid but the spell is not countered and resolves', () => {
    const s = run('Test Three Rock');
    expect(named(s, 'Test Two Rock')).toHaveLength(1);
    expect(inYard(s, 'Test Three Rock', 'p2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CR 701.6a, 608.2c, 608.2d: "Counter target spell. If that spell is countered this way, its controller may put a creature card from their hand onto the battlefield." (Fold into Aether)', () => {
  const FOLD = card('Test Fold', 'Instant', 'Counter target spell. If that spell is countered this way, its controller may put a creature card from their hand onto the battlefield.');
  const SPELL = card('Test Charm', 'Instant', 'You gain 1 life.');
  const STUBBORN = card('Test Stubborn Charm', 'Instant', "This spell can't be countered.\nYou gain 1 life.");
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const IDOL = card('Test Idol', 'Artifact', '');
  const defs = [FOLD, SPELL, STUBBORN, BEAR, IDOL];
  /** p2 casts `spell`; p1 counters it with the Fold; returns the decision p2 faces (if any) and the final state after p2 answers with `pick` */
  const run = (spell: string, pick: string | null): { asked: boolean; s: GameState } => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Fold'] }, p2: { hand: [spell, 'Test Bear', 'Test Idol'] } });
    let s = pass(s0);
    s = settle(act(s, { type: 'cast', player: 'p2', card: find(s, spell, 'hand', 'p2') }));
    s = pass(s);
    const target = s.zones.stack[0]!;
    s = settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Fold', 'hand', 'p1') }), { targets: [{ kind: 'object', id: target }] });
    let asked = false;
    for (let g = 0; g < 8 && s.zones.stack.length > 0; g++) {
      if (s.pending?.kind === 'chooseObjects') {
        asked = true;
        const d = s.pending as unknown as { player: string; options: ObjectId[] };
        expect(d.player).toBe('p2'); // the countered spell's controller chooses, not the Fold's
        expect(d.options.map((id) => s.objects[id]!.defId)).toEqual(['Test Bear']); // creature cards of THEIR hand only
        s = settle(s, { objects: pick === null ? [] : [d.options[0]!] });
      } else if (s.pending?.kind === 'priority') s = pass(s);
      else s = settle(s);
    }
    return { asked, s };
  };
  it('is automated', () => { expect(full(FOLD)).toBe(true); });
  it("the countered spell's controller may put a creature card from their hand onto the battlefield (it is under their control; the spell is in their graveyard)", () => {
    const { asked, s } = run('Test Charm', 'Test Bear');
    expect(asked).toBe(true);
    expect(named(s, 'Test Bear')).toHaveLength(1);
    expect(s.objects[named(s, 'Test Bear')[0]!]!.controller).toBe('p2');
    expect(inYard(s, 'Test Charm', 'p2')).toBe(true);
  });
  it('negative: it is a "may": choosing nothing leaves the card in the hand', () => {
    const { asked, s } = run('Test Charm', null);
    expect(asked).toBe(true);
    expect(named(s, 'Test Bear')).toEqual([]);
    expect(handNames(s, 'p2')).toContain('Test Bear');
  });
  it("negative: a spell that can't be countered is not countered this way: nothing is offered", () => {
    const { asked, s } = run('Test Stubborn Charm', 'Test Bear');
    expect(asked).toBe(false);
    expect(named(s, 'Test Bear')).toEqual([]);
  });
});
