/**
 * Coordinator E, round edh-e-13 (group counters 1/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler, in 4-player games. Each group has its negative cases. CR cites are from the Comprehensive Rules text of 2026-09-25 (fetched from media.wizards.com, rule numbers
 * checked in the round record).
 *
 *   CR 614.12a, 701.21a, 122.6   "As ~ enters, you may sacrifice any number of creatures and/or planeswalkers. If you do, it enters with twice that many +1/+1 counters on it." / "As ~ enters, sacrifice any number of permanents. ~ enters with that many +1/+1 counters on it."
 *   CR 122.1, 608.2d             "Put a K counter on ~ or remove a K counter from it."
 *   CR 614.1a, 614.6, 121.1      "If you would draw a card, you may put a K counter on ~ instead."
 *   CR 614.1a, 614.6, 120.3      "If damage would be dealt to you, put that many K counters on ~ instead."
 *   CR 101.4, 122.6              "each player chooses a nonland permanent and puts a K counter on it"
 */
import { describe, expect, it } from 'vitest';
import { type GameState, type ObjectId } from '../../../src/index';
import { act, answer, find, mpScenario } from '../../m12/rules/helpers';
import { pass } from '../../m3/scenario';
import { getChars } from '../../../src/rules/characteristics';
import { card, counters, full, named } from '../cmd3/helpers';

type Dec = { kind: string; options?: ObjectId[] | { id: string }[]; min?: number };
type Pick = (d: Dec) => Parameters<typeof answer>[1] | undefined;
/** Pass priority until the stack is empty, answering every decision with `pick` (undefined: the first legal answer). */
function drive(s0: GameState, pick: Pick = () => undefined): GameState {
  let s = s0;
  for (let g = 0; g < 80; g++) {
    const d = s.pending as unknown as Dec | undefined;
    if (d === undefined) break;
    if (d.kind === 'priority') { if (s.zones.stack.length === 0) break; s = pass(s); continue; }
    const a = pick(d);
    if (a !== undefined) { s = answer(s, a); continue; }
    if (d.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: (d.options as ObjectId[]).slice(0, d.min ?? 0) });
    else if (d.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (d.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [(d.options as { id: string }[])[0]!.id] });
    else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (d.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [] });
    else break;
  }
  return s;
}
const pickOf = (o: { yes?: boolean; option?: string; ids?: ObjectId[]; targets?: { kind: 'player' | 'object'; id: string }[] }): Pick => (d) => {
  if (d.kind === 'yesNo' && o.yes !== undefined) return { kind: 'yesNo', yes: o.yes };
  if (d.kind === 'chooseOption' && o.option !== undefined) return { kind: 'chooseOption', ids: [o.option] };
  if (d.kind === 'chooseObjects' && o.ids !== undefined) return { kind: 'chooseObjects', ids: o.ids };
  if (d.kind === 'chooseTargets' && o.targets !== undefined) return { kind: 'chooseTargets', targets: o.targets as never };
  return undefined;
};
const settleAll = (s: GameState, o: Parameters<typeof pickOf>[0] = {}): GameState => drive(s, pickOf(o));

const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const plr = (id: string) => ({ kind: 'player' as const, id });
const onBf = (s: GameState, p: string, defId: string): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === defId && s.objects[id]!.controller === p);
const inYard = (s: GameState, p: string, defId: string): boolean => (s.zones.graveyard[p] ?? []).some((id) => s.objects[id]!.defId === defId);
const handSize = (s: GameState, p: string): number => (s.zones.hand[p] ?? []).length;

const FODDER = card('Test Fodder', 'Creature — Goblin', '', ['1', '1']);
const RELIC = card('Test Relic', 'Artifact', '');
const CHARM = card('Test Charm', 'Enchantment', '');

/** Cast the card, pass priority until it resolves, and answer the "sacrifice any number" choice with the first `n` options offered (the options are recorded). */
function castAndSacrifice(s0: GameState, name: string, n: number): { s: GameState; offered: ObjectId[] } {
  let offered: ObjectId[] = [];
  const s1 = act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') });
  const s = drive(s1, (d) => { if (d.kind !== 'chooseObjects') return undefined; offered = d.options as ObjectId[]; return { kind: 'chooseObjects', ids: offered.slice(0, n) }; });
  return { s, offered };
}

describe('CR 614.12a, 701.21a: "As ~ enters, you may sacrifice any number of creatures and/or planeswalkers. If you do, it enters with twice that many +1/+1 counters on it."', () => {
  const EATER = card('Test Twice Eater', 'Creature — Horror', 'As ~ enters, you may sacrifice any number of artifacts and/or enchantments. If you do, it enters with twice that many +1/+1 counters on it.', ['0', '0']);
  const defs = [EATER, FODDER, RELIC, CHARM];
  const start = (): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Twice Eater'], battlefield: ['Test Relic', 'Test Charm', 'Test Fodder'] }, p2: { battlefield: ['Test Relic'] } } });
  it('is automated', () => expect(full(EATER)).toBe(true));
  it('sacrificing two of your artifacts and enchantments gives four counters; your creature and the opponent\'s artifact are not offered', () => {
    const s0 = start();
    const { s, offered } = castAndSacrifice(s0, 'Test Twice Eater', 2);
    expect(offered.length).toBe(2);
    expect(offered.every((id) => s0.objects[id]!.controller === 'p1' && s0.objects[id]!.defId !== 'Test Fodder')).toBe(true);
    expect(counters(s, named(s, 'Test Twice Eater')[0]!, '+1/+1')).toBe(4);
    expect(inYard(s, 'p1', 'Test Relic')).toBe(true);
    expect(inYard(s, 'p1', 'Test Charm')).toBe(true);
    expect(onBf(s, 'p2', 'Test Relic').length).toBe(1);
    expect(onBf(s, 'p1', 'Test Fodder').length).toBe(1);
  });
  it('negative: sacrificing none gives no counters (a 0/0 dies) and sacrifices nothing', () => {
    const { s } = castAndSacrifice(start(), 'Test Twice Eater', 0);
    expect(named(s, 'Test Twice Eater').length).toBe(0);
    expect(onBf(s, 'p1', 'Test Relic').length).toBe(1);
    expect(onBf(s, 'p1', 'Test Charm').length).toBe(1);
  });
  it('one sacrificed gives two counters', () => {
    const { s } = castAndSacrifice(start(), 'Test Twice Eater', 1);
    expect(counters(s, named(s, 'Test Twice Eater')[0]!, '+1/+1')).toBe(2);
  });
});

describe('CR 614.12a, 701.21a: "As ~ enters, sacrifice any number of permanents. ~ enters with that many +1/+1 counters on it."', () => {
  const EATER = card('Test Many Eater', 'Creature — Horror', 'As ~ enters, sacrifice any number of permanents. ~ enters with that many +1/+1 counters on it.', ['0', '0']);
  const defs = [EATER, FODDER, RELIC, CHARM];
  const start = (): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Many Eater'], battlefield: ['Test Relic', 'Test Fodder', 'Test Charm'] }, p2: { battlefield: ['Test Relic'] } } });
  it('is automated', () => expect(full(EATER)).toBe(true));
  it('sacrificing three of your permanents gives three counters; an opponent\'s permanent is never offered', () => {
    const s0 = start();
    const { s, offered } = castAndSacrifice(s0, 'Test Many Eater', 9);
    expect(offered.length).toBe(3);
    expect(offered.every((id) => s0.objects[id]!.controller === 'p1')).toBe(true);
    expect(counters(s, named(s, 'Test Many Eater')[0]!, '+1/+1')).toBe(3);
    expect(onBf(s, 'p2', 'Test Relic').length).toBe(1);
    expect(onBf(s, 'p1', 'Test Relic').length).toBe(0);
  });
  it('negative: sacrificing nothing gives no counters', () => {
    const { s } = castAndSacrifice(start(), 'Test Many Eater', 0);
    expect(named(s, 'Test Many Eater').length).toBe(0);
    expect(onBf(s, 'p1', 'Test Relic').length).toBe(1);
  });
});

describe('CR 122.1, 608.2d: "Put a plague counter on ~ or remove a plague counter from it."', () => {
  const BOILER = card('Test Counter Vat', 'Artifact', '{0}: Put a blorp counter on ~ or remove a blorp counter from it.');
  const defs = [BOILER];
  const activate = (s0: GameState, option: string): GameState => {
    const s1 = act(s0, { type: 'activate', player: 'p1', source: onBf(s0, 'p1', 'Test Counter Vat')[0]!, ability: 'p:0:0' } as never);
    return drive(s1, pickOf({ option }));
  };
  it('is automated', () => expect(full(BOILER)).toBe(true));
  it('choosing put adds a counter', () => {
    const s0 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Counter Vat'] } } });
    let opts: string[] = [];
    drive(act(s0, { type: 'activate', player: 'p1', source: onBf(s0, 'p1', 'Test Counter Vat')[0]!, ability: 'p:0:0' } as never), (d) => { if (d.kind === 'chooseOption') opts = (d.options as { id: string }[]).map((o) => o.id); return undefined; });
    expect(opts.length).toBe(2); // the options are, in order, put and remove
    const s = activate(s0, '0');
    expect(counters(s, onBf(s, 'p1', 'Test Counter Vat')[0]!, 'blorp')).toBe(1);
  });
  it('choosing remove takes one off', () => {
    const s0 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Counter Vat'] } }, setup: (st) => { st.objects[st.zones.battlefield.find((id) => st.objects[id]!.defId === 'Test Counter Vat')!]!.counters['blorp'] = 2; } });
    const s = activate(s0, '1');
    expect(counters(s, onBf(s, 'p1', 'Test Counter Vat')[0]!, 'blorp')).toBe(1);
  });
  it('DEVIATION (allows a choice the rules forbid, shared with the older edh-d-63 template): remove is offered with no counter on it (ruling 2005-10-01 says it can\'t be chosen); choosing it changes nothing', () => {
    const s0 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Counter Vat'] } } });
    const s = activate(s0, '1');
    expect(counters(s, onBf(s, 'p1', 'Test Counter Vat')[0]!, 'blorp')).toBe(0);
  });
});

describe('CR 614.1a, 614.6, 121.1: "If you would draw a card, you may put a study counter on ~ instead."', () => {
  const LIB = card('Test Study Hall', 'Enchantment', 'If you would draw a card, you may put a blorp counter on ~ instead.');
  const hall = (s0: GameState): GameState => drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Study Hall', 'hand', 'p1') }));
  const DRAW = card('Test Peek', 'Instant', 'Draw a card.');
  const defs = [LIB, DRAW];
  const start = (): GameState => hall(mpScenario({ defs, zones: { p1: { hand: ['Test Peek', 'Test Study Hall'] } } }));
  const play = (s0: GameState, yes: boolean): GameState => settleAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Peek', 'hand', 'p1') }), { yes });
  it('is automated', () => expect(full(LIB)).toBe(true));
  it('accepting puts a counter on it and draws no card', () => {
    const s0 = start();
    const s = play(s0, true);
    expect(counters(s, onBf(s, 'p1', 'Test Study Hall')[0]!, 'blorp')).toBe(1);
    expect(handSize(s, 'p1')).toBe(handSize(s0, 'p1') - 1); // the spell left the hand and nothing was drawn
  });
  it('negative: declining draws the card and puts no counter', () => {
    const s0 = start();
    const s = play(s0, false);
    expect(counters(s, onBf(s, 'p1', 'Test Study Hall')[0]!, 'blorp')).toBe(0);
    expect(handSize(s, 'p1')).toBe(handSize(s0, 'p1')); // the spell left the hand and one card was drawn
  });
  it('negative: an opponent\'s draw is not replaced', () => {
    const OPPDRAW = card('Test Gift Draw', 'Instant', 'Target player draws a card.');
    const s0 = hall(mpScenario({ defs: [LIB, OPPDRAW], zones: { p1: { hand: ['Test Gift Draw', 'Test Study Hall'] } } }));
    const s = settleAll(answer(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Gift Draw', 'hand', 'p1') }), { kind: 'chooseTargets', targets: [plr('p2')] }), { yes: true });
    expect(counters(s, onBf(s, 'p1', 'Test Study Hall')[0]!, 'blorp')).toBe(0);
    expect(handSize(s, 'p2')).toBe(handSize(s0, 'p2') + 1);
  });
});

describe('CR 614.1a, 614.6, 120.3: "If damage would be dealt to you, put that many depletion counters on ~ instead."', () => {
  const BUBBLE = card('Test Force Shell', 'Enchantment', 'If damage would be dealt to you, put that many blorp counters on ~ instead.');
  const BOLT = card('Test Burn', 'Instant', '~ deals 3 damage to any target.');
  const defs = [BUBBLE, BOLT, FODDER];
  const burn = (s0: GameState, who: 'p1' | 'p2' | 'creature'): GameState => {
    const t = who === 'creature' ? { kind: 'object' as const, id: onBf(s0, 'p1', 'Test Fodder')[0]! } : plr(who);
    return settleAll(answer(act(s0, { type: 'cast', player: 'p2', card: find(s0, 'Test Burn', 'hand', 'p2') }), { kind: 'chooseTargets', targets: [t] }));
  };
  const start = (): GameState => mpScenario({ defs, zones: { p1: { battlefield: ['Test Force Shell', 'Test Fodder'] }, p2: { hand: ['Test Burn'] } }, setup: (st) => { st.turn.activePlayer = 'p2'; } });
  it('is automated', () => expect(full(BUBBLE)).toBe(true));
  it('damage to you becomes that many counters and you lose no life', () => {
    const s0 = start();
    const s = burn(s0, 'p1');
    expect(life(s, 'p1')).toBe(life(s0, 'p1'));
    expect(counters(s, onBf(s, 'p1', 'Test Force Shell')[0]!, 'blorp')).toBe(3);
  });
  it('negative: damage to another player is dealt normally', () => {
    const s0 = start();
    const s = burn(s0, 'p2');
    expect(life(s, 'p2')).toBe(life(s0, 'p2') - 3);
    expect(counters(s, onBf(s, 'p1', 'Test Force Shell')[0]!, 'blorp')).toBe(0);
  });
  it('negative: damage to your creature is dealt normally', () => {
    const s0 = start();
    const s = burn(s0, 'creature');
    expect(counters(s, onBf(s, 'p1', 'Test Force Shell')[0]!, 'blorp')).toBe(0);
    expect(onBf(s, 'p1', 'Test Fodder').length).toBe(0);
  });
});

describe('CR 101.4, 122.6: "When ~ enters, each player chooses a nonland permanent and puts a blorp counter on it."', () => {
  const EYE = card('Test Doom Eye', 'Artifact', 'When ~ enters, each player chooses a nonland permanent and puts a blorp counter on it.');
  const defs = [EYE, FODDER, RELIC];
  it('is automated', () => expect(full(EYE)).toBe(true));
  it('all four players each put one counter, on the permanent each chose (permanents of any player), and nothing else gets one', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: ['Test Doom Eye'], battlefield: ['Test Fodder'] }, p2: { battlefield: ['Test Relic'] } } });
    const asked: string[] = [];
    const s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Doom Eye', 'hand', 'p1') }), (d) => { if (d.kind === 'chooseObjects') asked.push((d as unknown as { player: string }).player); return undefined; });
    expect(asked).toEqual(['p1', 'p2', 'p3', 'p4']); // turn order, one choice each
    const total = s.zones.battlefield.reduce((n, id) => n + (s.objects[id]!.counters['blorp'] ?? 0), 0);
    expect(total).toBe(4);
    for (const id of s.zones.battlefield) if (s.objects[id]!.counters['blorp'] !== undefined) expect(getChars(s, id)!.types.includes('Land')).toBe(false);
  });
});

describe('edh-e-13 review additions', () => {
  const HALL = card('Test Study Hall', 'Enchantment', 'If you would draw a card, you may put a blorp counter on ~ instead.');
  const DRAW3 = card('Test Big Peek', 'Instant', 'Draw three cards.');
  it('Pursuit reading: "draw three cards" asks for each draw: yes, no, yes gives two counters and one card', () => {
    const s0 = drive(act(mpScenario({ defs: [HALL, DRAW3], zones: { p1: { hand: ['Test Big Peek', 'Test Study Hall'] } } }), { type: 'cast', player: 'p1', card: find(mpScenario({ defs: [HALL, DRAW3], zones: { p1: { hand: ['Test Big Peek', 'Test Study Hall'] } } }), 'Test Study Hall', 'hand', 'p1') }));
    const before = handSize(s0, 'p1');
    let n = 0;
    const s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Big Peek', 'hand', 'p1') }), (d) => (d.kind === 'yesNo' ? { kind: 'yesNo', yes: n++ !== 1 } : undefined));
    expect(counters(s, onBf(s, 'p1', 'Test Study Hall')[0]!, 'blorp')).toBe(2);
    expect(handSize(s, 'p1')).toBe(before - 1 + 1);
  });
  it('Force Bubble reading: at four counters it is sacrificed (the trigger of the same card)', () => {
    const BUBBLE = card('Test Force Shell', 'Enchantment', 'If damage would be dealt to you, put that many blorp counters on ~ instead.\nWhen there are four or more blorp counters on ~, sacrifice it.');
    const BOLT = card('Test Burn', 'Instant', '~ deals 4 damage to any target.');
    const s0 = mpScenario({ defs: [BUBBLE, BOLT], zones: { p1: { battlefield: ['Test Force Shell'] }, p2: { hand: ['Test Burn'] } }, setup: (st) => { st.turn.activePlayer = 'p2'; } });
    const s = drive(answer(act(s0, { type: 'cast', player: 'p2', card: find(s0, 'Test Burn', 'hand', 'p2') }), { kind: 'chooseTargets', targets: [plr('p1')] }));
    expect(life(s, 'p1')).toBe(life(s0, 'p1'));
    expect(onBf(s, 'p1', 'Test Force Shell').length).toBe(0);
  });
});
