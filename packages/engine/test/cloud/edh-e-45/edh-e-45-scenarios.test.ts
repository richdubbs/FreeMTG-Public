/**
 * Commander coordinator E, second batch, edh-e-45: the round's readings played through the engine with synthetic cards (invented names and wordings, design 6.10), compiled by the game's
 * default compiler, each with its negative case. CR cites are from memory (unverified).
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type TargetChoice } from '../../../src/index';
import { act, advanceTo, answer, castAuto, find, legal, life, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, opts: { pt?: [string, string]; cost?: string } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '', type_line: type, oracle_text: text, colors: [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const automated = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');

interface Picks { yes?: boolean; targets?: TargetChoice[][] }
/** Answer every decision until a player has priority: yes/no by `yes`, targets in order, mana automatically. */
function drive(s0: GameState, o: Picks = {}): GameState {
  let s = s0;
  const tq = [...(o.targets ?? [])];
  for (let guard = 0; guard < 80 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending as unknown as { kind: string; options?: ObjectId[]; min?: number; max?: number; items?: { id: string }[] };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: o.yes ?? true });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: p.options!.slice(0, Math.max(p.min ?? 0, 1)).slice(0, p.max) });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items!.map((i) => i.id) });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: tq.shift() ?? [] });
    else throw new Error(`unexpected decision ${JSON.stringify(s.pending)}`);
  }
  return s;
}
function resolveAll(s0: GameState, o: Picks = {}): GameState {
  let s = drive(s0, o);
  for (let guard = 0; guard < 40 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); guard++) s = s.pending?.kind === 'priority' ? pass(s) : drive(s, o);
  return s;
}
void act; void legal;

describe('CR 122.1, 608.2c, 702.62a (unverified): "put four time counters on each of those cards that has suspend" after an exile of the top cards (Ecstatic Beauty)', () => {
  const BEAUTY = card('Test Beauty', 'Sorcery', 'Exile the top two cards of your library. You may play those cards until end of turn. Put four time counters on each of those cards that has suspend.', { cost: '{2}{R}' });
  const SUSP = card('Test Suspender', 'Creature — Elemental', 'Suspend 3--{R}', { pt: ['2', '2'] });
  const PLAIN = card('Test Plain', 'Creature — Elemental', '', { pt: ['1', '1'] });
  const defs = [BEAUTY, SUSP, PLAIN];
  it('is automated', () => expect(automated(BEAUTY)).toBe(true));
  it('the exiled card that has suspend gets four time counters; the one without suspend gets none', () => {
    const s0 = scenario(['Mountain'], { p1: { hand: ['Test Beauty'], battlefield: ['Mountain', 'Mountain', 'Mountain'], library: ['Test Suspender', 'Test Plain', 'Test Plain'] }, defs });
    const s = resolveAll(castAuto(s0, 'Test Beauty'));
    const exiled = s.zones.exile.filter((id) => ['Test Suspender', 'Test Plain'].includes(s.objects[id]!.defId));
    expect(exiled.length).toBe(2);
    const counters = Object.fromEntries(exiled.map((id) => [s.objects[id]!.defId, s.objects[id]!.counters['time'] ?? 0]));
    expect(counters).toEqual({ 'Test Suspender': 4, 'Test Plain': 0 });
  });
  it('NEGATIVE: a "flash" card in place of the suspend card gets no counters (the keyword is named exactly)', () => {
    const FLASH = card('Test Flasher', 'Creature — Elemental', 'Flash', { pt: ['2', '2'] });
    const s0 = scenario(['Mountain'], { p1: { hand: ['Test Beauty'], battlefield: ['Mountain', 'Mountain', 'Mountain'], library: ['Test Flasher', 'Test Plain', 'Test Plain'] }, defs: [...defs, FLASH] });
    const s = resolveAll(castAuto(s0, 'Test Beauty'));
    const flasher = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Flasher')!;
    expect(s.objects[flasher]!.counters['time'] ?? 0).toBe(0);
  });
});

describe('CR 118.12, 118.12a, 122.1, 608.2h (unverified): "unless <player> pays {1} for each vortex counter on ~" (Energy Vortex)', () => {
  const VORTEX = card('Test Vortex', 'Enchantment', "At the beginning of each player's upkeep, ~ deals 3 damage to that player unless they pay {1} for each vortex counter on ~.", { cost: '{3}{U}' });
  const defs = [VORTEX];
  it('is automated', () => expect(automated(VORTEX)).toBe(true));
  it('a player with two vortex counters on it who pays {2} takes no damage', () => {
    const s0 = scenario(['Mountain'], { p1: { battlefield: [{ name: 'Test Vortex', counters: { vortex: 2 } }] }, p2: { battlefield: ['Mountain', 'Mountain'] }, defs });
    const s = resolveAll(advanceTo(s0, 2, 'upkeep'), { yes: true });
    expect(life(s, 'p2')).toBe(20);
    expect(s.players.find((p) => p.id === 'p2')!.manaPool.length).toBe(0);
  });
  it('a player who does not pay takes 3 damage', () => {
    const s0 = scenario(['Mountain'], { p1: { battlefield: [{ name: 'Test Vortex', counters: { vortex: 2 } }] }, p2: { battlefield: ['Mountain', 'Mountain'] }, defs });
    const s = resolveAll(advanceTo(s0, 2, 'upkeep'), { yes: false });
    expect(life(s, 'p2')).toBe(17);
  });
  it('NEGATIVE: a player who can not pay the whole amount (three counters, two lands) can not pay it and takes the damage', () => {
    const s0 = scenario(['Mountain'], { p1: { battlefield: [{ name: 'Test Vortex', counters: { vortex: 3 } }] }, p2: { battlefield: ['Mountain', 'Mountain'] }, defs });
    const s = resolveAll(advanceTo(s0, 2, 'upkeep'), { yes: true });
    expect(life(s, 'p2')).toBe(17);
  });
  it('with no vortex counters the payment is {0}: no damage', () => {
    const s0 = scenario(['Mountain'], { p1: { battlefield: ['Test Vortex'] }, p2: { battlefield: ['Mountain'] }, defs });
    const s = resolveAll(advanceTo(s0, 2, 'upkeep'), { yes: true });
    expect(life(s, 'p2')).toBe(20);
  });
});

describe('CR 118.12, 118.12a, 122.1 (unverified): "unless the player puts a -1/-1 counter on a creature they control" (Thelon\'s Chant)', () => {
  const CHANT = card("Test Chant", 'Enchantment', 'Whenever a player puts a Swamp onto the battlefield, ~ deals 3 damage to that player unless the player puts a -1/-1 counter on a creature they control.', { cost: '{2}{G}' });
  const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
  const defs = [CHANT, BEAR];
  const play = (s: GameState): GameState => act(s, { type: 'playLand', player: 'p1', card: find(s, 'Swamp', 'hand', 'p1') });
  it('is automated', () => expect(automated(CHANT)).toBe(true));
  it('the player who plays the Swamp may put the counter on their creature instead of taking the damage', () => {
    const s0 = scenario(['Mountain', 'Swamp'], { p1: { hand: ['Swamp'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Chant'] }, defs });
    const s = resolveAll(play(advanceTo(s0, 1, 'main1')), { yes: true });
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    expect(s.objects[bear]!.counters['-1/-1']).toBe(1);
    expect(life(s, 'p1')).toBe(20);
  });
  it('declining the counter: 3 damage to that player, no counter', () => {
    const s0 = scenario(['Mountain', 'Swamp'], { p1: { hand: ['Swamp'], battlefield: ['Test Bear'] }, p2: { battlefield: ['Test Chant'] }, defs });
    const s = resolveAll(play(advanceTo(s0, 1, 'main1')), { yes: false });
    expect(life(s, 'p1')).toBe(17);
    expect(s.objects[find(s, 'Test Bear', 'battlefield', 'p1')]!.counters['-1/-1'] ?? 0).toBe(0);
  });
  it('NEGATIVE: with no creature to put it on the player takes the damage; a creature of the other player does not count', () => {
    const s0 = scenario(['Mountain', 'Swamp'], { p1: { hand: ['Swamp'] }, p2: { battlefield: ['Test Chant', 'Test Bear'] }, defs });
    const s = resolveAll(play(advanceTo(s0, 1, 'main1')), { yes: true });
    expect(life(s, 'p1')).toBe(17);
    expect(s.objects[find(s, 'Test Bear', 'battlefield', 'p2')]!.counters['-1/-1'] ?? 0).toBe(0);
  });
});
