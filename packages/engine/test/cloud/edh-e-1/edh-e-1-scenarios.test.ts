/**
 * Commander coordinator E, round edh-e-1 (copy group): the round's readings played through the engine with synthetic cards (invented names and wordings, design 6.10),
 * compiled by the game's default compiler, each with its negative case. CR cites are from the text of 2026-09-25 where marked "checked", otherwise from memory (unverified).
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type Color, type GameState, type ObjectId, type TargetChoice } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, advanceTo, answer, find, legal, pass, scenario } from '../../m3/scenario';
import { activate } from '../../m5/cr-examples/helpers';
import { declareAttackers, toDeclareAttackers } from '../../m4/helpers';

function card(name: string, type: string, text: string, opts: { pt?: [string, string]; cost?: string; colors?: Color[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const automated = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');
const chars = (s: GameState, id: ObjectId) => getChars(s, id);

interface Picks { x?: number[]; yes?: boolean; targets?: TargetChoice[][]; options?: string[][]; objects?: ObjectId[][] }
/** Answer every decision until a player has priority: yes/no by `yes`, targets and options in order, mana automatically. */
function drive(s0: GameState, o: Picks = {}): GameState {
  let s = s0;
  const tq = [...(o.targets ?? [])];
  const oq = [...(o.options ?? [])];
  const cq = [...(o.objects ?? [])];
  const xq = [...(o.x ?? [])];
  for (let guard = 0; guard < 80 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending as unknown as { kind: string; options?: (ObjectId | { id: string })[]; min?: number; max?: number; items?: { id: string }[] };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: o.yes ?? true });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: cq.shift() ?? (p.options as ObjectId[]).slice(0, Math.max(p.min ?? 0, 1)).slice(0, p.max) });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: oq.shift() ?? (p.options as { id: string }[]).slice(0, p.min ?? 1).map((x) => x.id) } as never);
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items!.map((i) => i.id) });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: tq.shift() ?? [] });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: xq.shift() ?? p.min ?? 0 } as never);
    else throw new Error(`unexpected decision ${JSON.stringify(s.pending)}`);
  }
  return s;
}
function resolveAll(s0: GameState, o: Picks = {}): GameState {
  let s = drive(s0, o);
  for (let guard = 0; guard < 40 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); guard++) s = s.pending?.kind === 'priority' ? pass(s) : drive(s, o);
  return s;
}
function castAndResolve(s0: GameState, name: string, o: Picks = {}, mana: string[] = ['C', 'C', 'C']): GameState {
  for (const m of mana) s0.players[0]!.manaPool.push({ type: m } as never);
  return resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') }), o);
}
const onBf = (s: GameState, name: string, controller: 'p1' | 'p2'): ObjectId[] =>
  s.zones.battlefield.filter((id) => s.objects[id]!.controller === controller && chars(s, id).name === name);
const target = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
const pt = (s: GameState, id: ObjectId): [number, number] => [Number(chars(s, id).power), Number(chars(s, id).toughness)];
const hasKeyword = (s: GameState, id: ObjectId, k: string): boolean => chars(s, id).keywords.some((x) => x.keyword === k);

const stackSize = (s: GameState): number => s.zones.stack.length;
const lifeOf = (s: GameState, p: 'p1' | 'p2'): number => s.players.find((x) => x.id === p)!.life;
const lands = (n: number): string[] => Array(n).fill('Mountain') as string[];


const c1 = (s: GameState, p: 'p1' | 'p2', name: string): ObjectId[] => onBf(s, name, p);

describe('CR 603.7b, 707.10c (unverified): "Copy the next instant or sorcery spell you cast this turn when you cast it. You may choose new targets for the copy." (Tzaangor Shaman wording)', () => {
  const PREP = card('Test Prep', 'Sorcery', 'Copy the next instant or sorcery spell you cast this turn when you cast it. You may choose new targets for the copy.', { cost: '{1}' });
  const SPARK = card('Test Spark', 'Instant', 'Test Spark deals 1 damage to any target.', { cost: '{R}', colors: ['R'] });
  const defs = [PREP, SPARK];
  const setup = () => scenario(['Mountain'], { p1: { hand: ['Test Prep', 'Test Spark'], battlefield: lands(4) }, defs });
  it('is automated', () => expect(automated(PREP)).toBe(true));
  it('the next instant cast this turn is copied, the copy with new targets chosen: two damage to the opponent', () => {
    let s = castAndResolve(setup(), 'Test Prep');
    s = resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Spark', 'hand', 'p1') }), { targets: [[{ kind: 'player', id: 'p2' }], [{ kind: 'player', id: 'p2' }]], yes: true });
    expect(lifeOf(s, 'p2')).toBe(18);
  });
  it('NEGATIVE: without the first spell no copy is made: one damage', () => {
    const s0 = setup();
    const s = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Spark', 'hand', 'p1') }), { targets: [[{ kind: 'player', id: 'p2' }]], yes: true });
    expect(lifeOf(s, 'p2')).toBe(19);
  });
});

describe('CR 701.20a, 707.2 (unverified): "You may reveal the top card of your library. If you reveal a creature card this way, ... becomes a copy of that card until end of turn" (Vesuvan Drifter wording)', () => {
  const SPELL = card('Test Peek', 'Sorcery', 'You may reveal the top card of your library. If you reveal a creature card this way, target creature you control becomes a copy of that card until end of turn.', { cost: '{1}' });
  const BIG = card('Test Giant', 'Creature — Giant', '', { pt: ['5', '5'] });
  const SMALL = card('Test Mouse', 'Creature — Mouse', '', { pt: ['1', '1'] });
  const defs = [SPELL, BIG, SMALL];
  const setup = (top: string) => scenario(['Mountain'], { p1: { hand: ['Test Peek'], battlefield: [...lands(2), 'Test Mouse'], library: [top] }, defs });
  const mouse = (s: GameState) => c1(s, 'p1', 'Test Mouse')[0] ?? s.zones.battlefield.find((id) => s.objects[id]!.controller === 'p1' && chars(s, id).types.includes('Creature'))!;
  it('is automated', () => expect(automated(SPELL)).toBe(true));
  it('a revealed creature card: the target becomes a copy of it (5/5 Giant)', () => {
    const s0 = setup('Test Giant');
    const id = mouse(s0);
    const s = castAndResolve(s0, 'Test Peek', { targets: [[target(id)]], yes: true }, ['C']);
    expect(chars(s, id).name).toBe('Test Giant');
    expect(pt(s, id)).toEqual([5, 5]);
  });
  it('NEGATIVE: the option declined, nothing is revealed and nothing changes', () => {
    const s0 = setup('Test Giant');
    const id = mouse(s0);
    const s = castAndResolve(s0, 'Test Peek', { targets: [[target(id)]], yes: false }, ['C']);
    expect(chars(s, id).name).toBe('Test Mouse');
  });
  it('NEGATIVE: a revealed land card changes nothing', () => {
    const s0 = setup('Mountain');
    const id = mouse(s0);
    const s = castAndResolve(s0, 'Test Peek', { targets: [[target(id)]], yes: true }, ['C']);
    expect(chars(s, id).name).toBe('Test Mouse');
  });
});

describe('CR 707.2, 608.2d (unverified): "You may have Shapeshifters you control become copies of that creature until end of turn." (Absorb Identity wording)', () => {
  const SPELL = card('Test Absorb', 'Instant', "Return target creature to its owner's hand. You may have Shapeshifters you control become copies of that creature until end of turn.", { cost: '{1}' });
  const BIG = card('Test Giant', 'Creature — Giant', '', { pt: ['5', '5'] });
  const SHIFT = card('Test Shifter', 'Creature — Shapeshifter', '', { pt: ['1', '1'] });
  const MOUSE = card('Test Mouse', 'Creature — Mouse', '', { pt: ['1', '1'] });
  const defs = [SPELL, BIG, SHIFT, MOUSE];
  const setup = () => scenario(['Mountain'], { p1: { hand: ['Test Absorb'], battlefield: [...lands(2), 'Test Shifter', 'Test Shifter', 'Test Mouse'] }, p2: { battlefield: ['Test Giant'] }, defs });
  it('is automated', () => expect(automated(SPELL)).toBe(true));
  it('every Shapeshifter becomes a Giant; the Mouse does not; this turn only', () => {
    const s0 = setup();
    const giant = c1(s0, 'p2', 'Test Giant')[0]!;
    const s = castAndResolve(s0, 'Test Absorb', { targets: [[target(giant)]], yes: true }, ['C']);
    expect(c1(s, 'p1', 'Test Giant')).toHaveLength(2);
    expect(c1(s, 'p1', 'Test Mouse')).toHaveLength(1);
  });
  it('NEGATIVE: the option declined: the Shapeshifters stay as they are', () => {
    const s0 = setup();
    const giant = c1(s0, 'p2', 'Test Giant')[0]!;
    const s = castAndResolve(s0, 'Test Absorb', { targets: [[target(giant)]], yes: false }, ['C']);
    expect(c1(s, 'p1', 'Test Shifter')).toHaveLength(2);
  });
});

describe('CR 205.2, 608.2h (unverified): "nonlegendary attacking creature" (Tilonalli\'s Skinshifter wording) is the same filter as "attacking nonlegendary"', () => {
  it('parses to a fully automated card; the filter keeps both qualities', () => {
    const d = card('Test Shifter Two', 'Creature — Shapeshifter', 'Whenever this creature attacks, you may have it become a copy of another target nonlegendary attacking creature until end of turn.', { pt: ['1', '1'] });
    expect(automated(d)).toBe(true);
    const j = JSON.stringify(d.faces);
    expect(j).toContain('"Legendary"');
    expect(j).toContain('"attacking":true');
  });
  it('NEGATIVE: "another target legendary attacking creature" is a different filter', () => {
    const d = card('Test Shifter Two', 'Creature — Shapeshifter', 'Whenever this creature attacks, you may have it become a copy of another target legendary attacking creature until end of turn.', { pt: ['1', '1'] });
    expect(JSON.stringify(d.faces)).not.toContain('notSupertypes');
  });
});
