/**
 * edh-e-17 (Commander coordinator E, concept "counterspell-modes"): "Counter target spell that's the second spell cast this turn" (Second Guess) played through the engine with
 * synthetic cards (invented names, design 6.10). CR cites from memory, unverified (no rules/cr in the cloud checkout).
 *
 *   CR 601.2i, 701.6a   the second spell cast this turn by ANY player is a legal target and is countered; the first and the third are not legal targets
 */
import { describe, expect, it } from 'vitest';
import { legalActions, type Action, type GameState } from '../../../src/index';
import { act, find, life, scenario } from '../../m3/scenario';
import { card, full, resolveAll, settle } from '../cmd3/helpers';

const GUESS = card('Test Guess', 'Instant', "Counter target spell that's the second spell cast this turn.", undefined, '{0}');
const SIP = card('Test Sip', 'Instant', 'You gain 3 life.', undefined, '{0}');
const DEFS = [GUESS, SIP];

describe('the synthetic cards are automated', () => {
  it('every synthetic card plays fully', () => {
    for (const d of DEFS) expect(full(d), `${d.name}: ${JSON.stringify(d.automation)}`).toBe(true);
  });
});

const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const castAction = (s: GameState, name: string): Action | undefined =>
  legalActions(s, 'p1').find((a) => a.kind === 'cast' && a.object !== undefined && nameOf(s, a.object) === name)?.action;
const stackIds = (s: GameState, name: string): string[] => s.zones.stack.filter((id) => nameOf(s, id) === name);

describe('CR 601.2i, 701.6a: counter target spell that is the second spell cast this turn', () => {
  it('with two Sips cast, the second Sip is countered (no life from it) and the first resolves', () => {
    const s0 = scenario([], { defs: DEFS, p1: { hand: ['Test Sip', 'Test Sip', 'Test Guess'] } });
    const l0 = life(s0, 'p1');
    let s = settle(act(s0, castAction(s0, 'Test Sip')!));
    s = settle(act(s, castAction(s, 'Test Sip')!));
    const sips = stackIds(s, 'Test Sip'); // bottom of the stack first: the first Sip cast, then the second
    expect(sips.length).toBe(2);
    expect(() => settle(act(s, castAction(s, 'Test Guess')!), { targets: [{ kind: 'object', id: sips[0]! }] })).toThrow(/not a legal target/); // the first spell is no target
    s = settle(act(s, castAction(s, 'Test Guess')!), { targets: [{ kind: 'object', id: sips[1]! }] });
    s = resolveAll(s);
    expect(life(s, 'p1')).toBe(l0 + 3); // one Sip resolved, the other was countered
  });
  it('as the only other spell is the first spell this turn, Test Guess finds no legal target', () => {
    const s0 = scenario([], { defs: DEFS, p1: { hand: ['Test Sip', 'Test Guess'] } });
    const s = settle(act(s0, castAction(s0, 'Test Sip')!));
    expect(castAction(s, 'Test Guess')).toBeUndefined(); // the first spell is no target of it (it can only be the second)
  });
  it("counts spells of ALL players: p1's Sip is first, p2's Sip is second (p2's first of its own), so p2's Sip is the only legal target", () => {
    const s0 = scenario([], { defs: DEFS, p1: { hand: ['Test Sip'] }, p2: { hand: ['Test Sip', 'Test Guess'] } });
    let s = settle(act(s0, castAction(s0, 'Test Sip')!));
    const first = s.zones.stack[0]!;
    s = act(s, { type: 'pass', player: 'p1' });
    s = settle(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Sip', 'hand', 'p2') }));
    const second = s.zones.stack.find((id) => id !== first)!;
    const guess = find(s, 'Test Guess', 'hand', 'p2');
    expect(() => settle(act(s, { type: 'cast', player: 'p2', card: guess }), { targets: [{ kind: 'object', id: first }] })).toThrow(/not a legal target/);
    const t = settle(act(s, { type: 'cast', player: 'p2', card: guess }), { targets: [{ kind: 'object', id: second }] });
    expect(t.zones.stack.map((id) => nameOf(t, id))).toContain('Test Guess');
  });
});
