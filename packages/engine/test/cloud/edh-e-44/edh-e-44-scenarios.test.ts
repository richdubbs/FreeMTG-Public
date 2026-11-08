/**
 * edh-e-44 (Commander coordinator E, counters 1/2): the round's readings played through the engine with synthetic cards (invented names, design 6.10), four players.
 *   CR 122.1, 608.2c       "Remove all gloom counters from permanents you control." takes the counters off a whole group (and only that kind, only that group)
 *   CR 701.19c, 107.3      "Destroy up to X target ..., where X is the number of gloom counters on ~. They can't be regenerated." is automated
 *   CR 406.1, 122.1, 400.3 exile with a counter, return all exiled cards with that counter to the battlefield under their owners' control, put the ones you own into your hand
 * CR cites from memory (cloud session), unverified.
 */
import { describe, expect, it } from 'vitest';
import { act } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { card, counters, full, resolveAll, settle } from '../cmd3/helpers';
import type { GameState, ObjectId } from '../../../src/index';

const SWEEP = card('Test Frost Sweep', 'Artifact', '{0}: Remove all gloom counters from creatures you control.');
const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const WIDE = card('Test Wide Sweep', 'Artifact', '{0}: Remove all gloom counters from creatures.');
const LEASH = card('Test Leash', 'Creature — Soldier', '{0}: Choose another target creature. Its controller may exile it with an aegis counter on it.', ['1', '1']);
const RECALL = card('Test Recall', 'Artifact', '{0}: Return all exiled cards with aegis counters on them to the battlefield under their owners\' control.');
const SCRY = card('Test Hand Recall', 'Artifact', '{0}: Put all exiled cards you own with intel counters on them into your hand.');
const REQUIEM = card('Test Requiem', 'Enchantment', '{0}, Sacrifice this enchantment: Destroy up to X target nonblack creatures, where X is the number of verse counters on this enchantment. They can\'t be regenerated.');

const byName = (s: GameState, name: string): ObjectId[] => Object.values(s.objects).filter((o) => s.defs[o.defId]!.name === name).map((o) => o.id);
const activate = (s: GameState, name: string, picks = {}): GameState => resolveAll(settle(act(s, { type: 'activate', player: 'p1', source: byName(s, name)[0]!, ability: 'p:0:0' } as never), picks));

describe('the synthetic cards are automated', () => {
  for (const d of [SWEEP, LEASH, RECALL, SCRY, REQUIEM]) it(d.name, () => expect(full(d), JSON.stringify(d.automation)).toBe(true));
  it('CR 608.2c (fail closed): "creatures" after "remove all gloom counters from" with no "you control" still reads as every creature', () => expect(full(WIDE)).toBe(true));
});

describe('CR 122.1: remove all counters of one kind from a group', () => {
  it('your creatures lose their gloom counters, an opponent\'s creature and other kinds keep theirs', () => {
    const s0 = mpScenario({ defs: [SWEEP, BEAR], zones: { p1: { battlefield: ['Test Frost Sweep', { name: 'Test Bear', counters: { gloom: 2, '+1/+1': 1 } } as never] }, p2: { battlefield: [{ name: 'Test Bear', counters: { gloom: 3 } } as never] } } } as never);
    const s = activate(s0, 'Test Frost Sweep');
    const [mine, theirs] = byName(s, 'Test Bear').sort((a, b) => (s.objects[a]!.controller === 'p1' ? -1 : 1) - (s.objects[b]!.controller === 'p1' ? -1 : 1));
    expect(counters(s, mine!, 'gloom')).toBe(0);
    expect(counters(s, mine!, '+1/+1')).toBe(1);
    expect(counters(s, theirs!, 'gloom')).toBe(3);
  });
});

describe('CR 406.1, 122.1, 400.3: exile with a counter, then return or take back the exiled cards that have it', () => {
  it('"Its controller may exile it with an aegis counter on it" puts the target in exile with an aegis counter; "return all exiled cards with aegis counters" brings it back under its owner\'s control', () => {
    const s0 = mpScenario({ defs: [LEASH, RECALL, BEAR], zones: { p1: { battlefield: ['Test Leash', 'Test Recall'] }, p2: { battlefield: ['Test Bear'] } } } as never);
    const bear = byName(s0, 'Test Bear')[0]!;
    let s = activate(s0, 'Test Leash', { targets: [{ kind: 'object', id: bear }], yes: true });
    const inExile = s.zones.exile.filter((id) => counters(s, id, 'aegis') === 1);
    expect(inExile.length).toBe(1);
    s = activate(s, 'Test Recall');
    expect(s.zones.battlefield.filter((id) => s.defs[s.objects[id]!.defId]!.name === 'Test Bear' && s.objects[id]!.controller === 'p2').length).toBe(1);
    expect(s.zones.exile.length).toBe(0);
  });
  it('negative: a card in exile with no aegis counter, or with another kind of counter, stays', () => {
    const s0 = mpScenario({ defs: [RECALL, BEAR], zones: { p1: { battlefield: ['Test Recall'] }, p2: { exile: [{ name: 'Test Bear', counters: { gloom: 1 } } as never, 'Test Bear'] } } } as never);
    const s = activate(s0, 'Test Recall');
    expect(s.zones.exile.length).toBe(2);
  });
  it('"Put all exiled cards you own with intel counters on them into your hand" takes only your own cards that have the counter', () => {
    const s0 = mpScenario({ defs: [SCRY, BEAR], zones: { p1: { battlefield: ['Test Hand Recall'], exile: [{ name: 'Test Bear', counters: { intel: 1 } } as never, 'Test Bear'] }, p2: { exile: [{ name: 'Test Bear', counters: { intel: 1 } } as never] } } } as never);
    const s = activate(s0, 'Test Hand Recall');
    const before = (s0.zones.hand['p1'] ?? []).length;
    expect((s.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect(s.zones.exile.length).toBe(2);
  });
});

describe('CR 701.19c, 107.3: destroy up to X targets, where X is a counter count, and they can\'t be regenerated', () => {
  it('with two verse counters, two targets are destroyed; a third is not chosen', () => {
    const s0 = mpScenario({ defs: [REQUIEM, BEAR], zones: { p1: { battlefield: [{ name: 'Test Requiem', counters: { verse: 2 } } as never] }, p2: { battlefield: ['Test Bear', 'Test Bear', 'Test Bear'] } } } as never);
    const bears = byName(s0, 'Test Bear');
    const s = activate(s0, 'Test Requiem', { targets: [{ kind: 'object', id: bears[0]! }, { kind: 'object', id: bears[1]! }] });
    expect(s.zones.battlefield.filter((id) => s.defs[s.objects[id]!.defId]!.name === 'Test Bear').length).toBe(1);
  });
});
