/**
 * Round edh-e-58 (Commander coordinator E, second batch, group enters-leaves): the behaviour it added, played through the engine with synthetic cards (invented names), compiled by the
 * game's default compiler.
 *
 *   CR 603.7c, 400.7        "Exile that creature. Return that card to the battlefield under its owner's control when ~ leaves the battlefield." (Portcullis)
 *   CR 608.2d, 607.2a       "An opponent chooses a permanent you control other than ~ and exiles it." + "When ~ leaves the battlefield, return the exiled card ..." (Wormfang Crab)
 *   CR 701.29a   "Fateseal N" (Mesmeric Sliver, Spin into Myth): look at the top N cards of an opponent's library, any number on the bottom, the rest back on top
 *   CR 607.2a, 201.2        "Whenever a land an opponent controls with the same name as the exiled card enters, ~ deals 2 damage to that player." (Invader Parasite)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type OracleCard } from '../../../src/index';
import { act, answer, find, life, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string } = {}): CardDef {
  return compileCard({
    name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [],
    ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}),
  } as OracleCard);
}
const PORT = card('Test Gate', 'Artifact', 'Whenever a creature enters, if there are two or more other creatures on the battlefield, exile that creature. Return that card to the battlefield under its owner\'s control when this artifact leaves the battlefield.');
const CRAB = card('Test Crab', 'Creature — Nightmare Crab', 'This creature can\'t be blocked.\nWhen this creature enters, an opponent chooses a permanent you control other than this creature and exiles it.\nWhen this creature leaves the battlefield, return the exiled card to the battlefield under its owner\'s control.', { pt: ['3', '3'] });
const PARA = card('Test Parasite', 'Creature — Insect', 'Imprint — When this creature enters, exile target land.\nWhenever a land an opponent controls with the same name as the exiled card enters, this creature deals 2 damage to that player.', { pt: ['1', '1'] });
const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
const BEAR2 = card('Test Bear Two', 'Creature — Bear', '', { pt: ['2', '2'] });
const BEAR3 = card('Test Bear Three', 'Creature — Bear', '', { pt: ['2', '2'] });
const NEWBIE = card('Test Newcomer', 'Creature — Elf', '', { pt: ['1', '1'] });
const ROCK = card('Test Rock', 'Artifact', '');
const SMASH = card('Test Smash', 'Instant', 'Destroy target artifact.');
const KILL = card('Test Kill', 'Instant', 'Destroy target creature.');
const AMBUSH = card('Test Ambush', 'Instant', 'You may put a land card from your hand onto the battlefield.');
const SEAL = card('Test Seal', 'Sorcery', 'Fateseal 2.');
const SLIV = card('Test Hive', 'Creature — Sliver', 'All Slivers have "When this permanent enters, you may fateseal 1."', { pt: ['1', '1'] });
const SLIV2 = card('Test Drone', 'Creature — Sliver', '', { pt: ['1', '1'] });
const DEFS = [SEAL, SLIV, SLIV2, PORT, CRAB, PARA, BEAR, BEAR2, BEAR3, NEWBIE, ROCK, SMASH, KILL, AMBUSH];

const names = (s: GameState, zone: 'battlefield' | 'exile'): string[] => s.zones[zone].map((id) => s.objects[id]!.defId);
let aim: string | undefined; // the defId of the object the next "choose targets" decision names
const settle = (s0: GameState, pick?: (ids: string[]) => string[]): GameState => {
  let s = s0;
  for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 40; guard++) {
    const p = s.pending as unknown as { kind: string; options: string[]; min: number };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (p.kind === 'chooseTargets') {
      const d = s.pending as unknown as { objects: string[]; min: number };
      const hit = d.objects.find((o) => s.objects[o]?.defId === aim) ?? d.objects[0];
      s = answer(s, { kind: 'chooseTargets', targets: hit && d.min > 0 ? [{ kind: 'object', id: hit }] : [] } as never);
    }
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: (s.pending as unknown as { items: { id: string }[] }).items.map((x) => x.id) });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: (pick ? pick(p.options) : p.options).slice(0, Math.max(p.min, 1)) });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
};
const resolveAll = (s0: GameState, pick?: (ids: string[]) => string[]): GameState => {
  let s = settle(s0, pick);
  for (let guard = 0; s.zones.stack.length > 0 && guard < 40; guard++) s = settle(s.pending?.kind === 'priority' ? pass(s) : s, pick);
  return s;
};
const cast = (s: GameState, name: string, player: 'p1' | 'p2' = 'p1', pick?: (ids: string[]) => string[], at?: string): GameState => { aim = at; return resolveAll(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), pick); };

describe('Portcullis: exile the creature that enters with two or more others, return it when ~ leaves (CR 603.7c, 400.7)', () => {
  it('is fully automated', () => { expect(PORT.automation.level).toBe('full'); });
  const start = (others: string[]): GameState => scenario([], { seed: 'g1', defs: DEFS, p1: { hand: ['Test Newcomer', 'Test Smash'], battlefield: ['Test Gate', ...others] } });
  it('with two other creatures on the battlefield the entering creature is exiled; when the artifact leaves it returns to the battlefield under its owner\'s control', () => {
    let s = start(['Test Bear', 'Test Bear Two']);
    s = cast(s, 'Test Newcomer');
    expect(names(s, 'battlefield')).not.toContain('Test Newcomer');
    expect(names(s, 'exile')).toContain('Test Newcomer');
    s = cast(s, 'Test Smash', 'p1', undefined, 'Test Gate');
    expect(names(s, 'battlefield')).not.toContain('Test Gate');
    expect(names(s, 'battlefield')).toContain('Test Newcomer');
    expect(names(s, 'exile')).not.toContain('Test Newcomer');
    const back = s.zones.battlefield.map((id) => s.objects[id]!).find((o) => o.defId === 'Test Newcomer')!;
    expect(back.controller).toBe('p1');
  });
  it('negative: with fewer than two other creatures nothing is exiled, and the artifact leaving returns nothing', () => {
    let s = start(['Test Bear']);
    s = cast(s, 'Test Newcomer');
    expect(names(s, 'battlefield')).toContain('Test Newcomer');
    expect(names(s, 'exile')).toEqual([]);
  });
  it('negative: a card that stays exiled stays there while the artifact is still on the battlefield', () => {
    let s = start(['Test Bear', 'Test Bear Two']);
    s = cast(s, 'Test Newcomer');
    expect(names(s, 'exile')).toEqual(['Test Newcomer']);
    expect(names(s, 'battlefield')).toContain('Test Gate');
  });
});

describe('Wormfang Crab: an opponent chooses a permanent you control other than ~ and exiles it; it returns when ~ leaves (CR 608.2d, 607.2a)', () => {
  it('is fully automated', () => { expect(CRAB.automation.level).toBe('full'); });
  const start = (): GameState => scenario([], { seed: 'c1', defs: DEFS, p1: { hand: ['Test Crab', 'Test Kill'], battlefield: ['Test Rock', 'Test Bear'] }, p2: { hand: [] } });
  it('the opponent picks the permanent (not the Crab itself, not the opponent\'s own); it is exiled; destroying the Crab returns that card under its owner\'s control', () => {
    let s = start();
    const offered: string[][] = [];
    s = cast(s, 'Test Crab', 'p1', (ids) => { offered.push(ids.map((i) => s.objects[i]?.defId ?? i)); return [ids.find((i) => s.objects[i]?.defId === 'Test Bear') ?? ids[0]!]; });
    expect(offered.length).toBeGreaterThan(0);
    expect(names(s, 'exile')).toEqual(['Test Bear']);
    expect(names(s, 'battlefield')).toContain('Test Crab');
    s = cast(s, 'Test Kill', 'p1', undefined, 'Test Crab');
    expect(names(s, 'battlefield')).not.toContain('Test Crab');
    expect(names(s, 'exile')).toEqual([]);
    const bear = s.zones.battlefield.map((id) => s.objects[id]!).find((o) => o.defId === 'Test Bear')!;
    expect(bear.controller).toBe('p1');
  });
  it('the opponent chooses among your permanents other than the Crab: the Crab is never offered, and a permanent the opponent controls is not either', () => {
    let s = scenario([], { seed: 'c2', defs: DEFS, p1: { hand: ['Test Crab'], battlefield: ['Test Rock', 'Test Bear'] }, p2: { battlefield: ['Test Bear Two'] } });
    let seen: string[] = [];
    s = cast(s, 'Test Crab', 'p1', (ids) => { seen = ids.map((i) => s.objects[i]?.defId ?? i); return ids; });
    expect(seen.length).toBe(2);
    expect(seen.sort()).toEqual(['Test Bear', 'Test Rock']);
  });
  it('negative: nothing to return if the Crab leaves when it exiled nothing (no other permanent): no card appears from nowhere', () => {
    let s = scenario([], { seed: 'c3', defs: DEFS, p1: { hand: ['Test Crab'], battlefield: [] }, p2: { hand: [] } });
    s = cast(s, 'Test Crab');
    expect(names(s, 'exile')).toEqual([]);
    expect(names(s, 'battlefield')).toEqual(['Test Crab']);
  });
});

describe('Invader Parasite: a land an opponent controls with the same name as the exiled card enters (CR 607.2a, 201.2)', () => {
  it('is fully automated', () => { expect(PARA.automation.level).toBe('full'); });
  const start = (): GameState => scenario(['Forest', 'Island'], { seed: 'p1', defs: DEFS, p1: { hand: ['Test Parasite', 'Test Ambush', 'Forest', 'Island'] }, p2: { hand: ['Test Ambush', 'Test Ambush', 'Forest', 'Island'], battlefield: ['Forest'] } });
  const landNamed = (n: string) => (ids: string[]) => [ids.find((i) => (globalS?.objects[i]?.defId ?? '') === n)!];
  let globalS: GameState | undefined;
  const play = (s: GameState, who: 'p1' | 'p2', land: string): GameState => { const t = who === 'p2' && s.pending?.kind === 'priority' && s.pending.player === 'p1' ? pass(s) : s; globalS = t; return cast(t, 'Test Ambush', who, landNamed(land)); };
  it('an opponent\'s land with the same name deals 2 damage to that player; another name does nothing; the Parasite\'s controller\'s own land of that name does nothing', () => {
    let s = cast(start(), 'Test Parasite', 'p1', undefined, 'Forest');
    expect(names(s, 'exile')).toEqual(['Forest']);
    const before = life(s, 'p2');
    s = play(s, 'p2', 'Island');
    expect(life(s, 'p2'), 'a different name').toBe(before);
    s = play(s, 'p1', 'Forest');
    expect(life(s, 'p2'), 'the controller\'s own Forest').toBe(before);
    expect(life(s, 'p1')).toBe(20);
    s = play(s, 'p2', 'Forest');
    expect(life(s, 'p2'), 'the opponent\'s Forest').toBe(before - 2);
    expect(life(s, 'p1')).toBe(20);
  });
});

describe('Fateseal (CR 701.29a): Mesmeric Sliver, Spin into Myth', () => {
  it('are fully automated', () => { for (const c of [SEAL, SLIV]) expect(c.automation.level, c.name).toBe('full'); });
  const libs = (s: GameState, p: 'p1' | 'p2'): string[] => s.zones.library[p]!.map((id) => s.objects[id]!.defId);
  const start = (): GameState => scenario([], { seed: 'f1', defs: DEFS, p1: { hand: ['Test Seal'], library: ['Test Bear', 'Test Rock', 'Test Kill'] }, p2: { library: ['Test Bear Two', 'Test Smash', 'Test Newcomer', 'Test Gate'] } });
  it('looks at the top two cards of the OPPONENT\'s library: the chosen card goes to the bottom, the other stays on top; your own library is untouched', () => {
    let s = start();
    const own = libs(s, 'p1');
    const was = libs(s, 'p2');
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Seal', 'hand', 'p1') });
    let seen: string[] = [];
    for (let guard = 0; guard < 20 && (s.pending?.kind !== 'priority' || s.zones.stack.length > 0); guard++) {
      const p = s.pending as unknown as { kind: string; options: string[]; min: number };
      if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (p.kind === 'chooseObjects') { seen = p.options.map((i) => s.objects[i]!.defId); s = answer(s, { kind: 'chooseObjects', ids: [p.options[0]!] }); }
      else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: (s.pending as unknown as { items: { id: string }[] }).items.map((x) => x.id) });
      else s = pass(s);
    }
    expect(seen).toEqual(was.slice(0, 2)); // (the options are the top two cards of p2's library)
    expect(libs(s, 'p1')).toEqual(own);
    expect(libs(s, 'p2')).toEqual([...was.slice(1), was[0]!]); // the first option went to the bottom, the second stayed on top
  });
  it('Mesmeric Sliver: every Sliver that enters offers the fateseal (the Sliver itself too); a non-Sliver creature offers none', () => {
    const logged = (st: GameState, from: number): boolean => st.log.slice(from).some((l) => /fateseals/i.test(l.text));
    let s = scenario([], { seed: 'f2', defs: DEFS, p1: { hand: ['Test Hive', 'Test Drone', 'Test Bear'], library: ['Test Bear', 'Test Rock'] }, p2: { library: ['Test Smash', 'Test Newcomer', 'Test Gate'] } });
    let mark = s.log.length;
    s = cast(s, 'Test Hive');
    expect(logged(s, mark), 'the Sliver itself').toBe(true);
    mark = s.log.length;
    s = cast(s, 'Test Drone');
    expect(logged(s, mark), 'another Sliver').toBe(true);
    mark = s.log.length;
    s = cast(s, 'Test Bear');
    expect(logged(s, mark), 'a Bear is no Sliver').toBe(false);
  });
});
