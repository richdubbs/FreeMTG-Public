/**
 * Round edh-e-4 (Commander coordinator E, group vote-secret): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented
 * names, design 6.10; the wording is the card's own where only one card prints it), in four-player games where the rule needs them, each with its negative cases and the Scryfall rulings of
 * the card. CR cites are from the 2026-09-25 text but could not be checked in this session (no rules/cr and the cloud session's copy was not fetched): listed as unverified in the record.
 *
 *   CR 700.3, 701.13a, 608.2d      "Exile up to N target permanent cards from your graveyard and separate them into two piles. An opponent chooses one of those piles. ..." (Split the Spoils)
 *   CR 406.3, 701.58a, 701.58e     "Exile target creature and the top two cards of your library in a face-down pile, shuffle that pile, then cloak those cards. They enter tapped." (Become Anonymous)
 *   CR 608.2d, 107.1b, 119.3       "Each player secretly chooses a number. Then those numbers are revealed. Each player with the highest number loses that much life. If you are one of those players, ..." (Menacing Ogre)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, viewFor, type CardDef, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act, answer, find, findAll, scenario } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const life = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const exiledOf = (s: GameState, p: PlayerId): ObjectId[] => s.zones.exile.filter((id) => s.objects[id]!.owner === p);
const BEAR = (n: string, cost = '{0}') => card(n, 'Creature — Bear', '', { pt: ['2', '2'], cost });

interface Script { pile1?: string[]; pileChoice?: 'pile1' | 'pile2'; targets?: ObjectId[]; numbers?: number[]; options?: string[]; asked?: string[]; onAsk?: (s: GameState) => void }
/** Answer what is asked until someone has priority: piles, numbers and word votes from the script, the first choices otherwise. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    script.asked?.push(`${p.kind}:${p.player}`);
    script.onAsk?.(s);
    if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: (script.targets ?? p.objects).map((id) => ({ kind: 'object' as const, id })) });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: script.pile1 === undefined ? p.options.slice(0, p.min) : p.options.filter((id) => script.pile1!.includes(nameOf(s, id))) }); // (a card exiled is a new object, CR 400.7: piles are named by card name)
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? p.min });
    else if (p.kind === 'chooseOption') {
      const want = script.options?.shift() ?? script.pileChoice;
      const id = want === undefined ? p.options[0]!.id : (p.options.find((o) => o.label === want || o.id === want) ?? p.options[0]!).id;
      s = answer(s, { kind: 'chooseOption', ids: [id] });
    } else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: false });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p)}`);
  }
  return s;
}
function settle(s0: GameState, script: Script = {}): GameState {
  let s = drive(s0, script);
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) s = drive(act(s, { type: 'pass', player: s.pending.player }), script);
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, player: PlayerId = 'p1'): GameState => settle(drive(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), script), script);

// ---- Split the Spoils ---------------------------------------------------------------------------------------------------------------------------------------------------

const SPLIT = card('Test Salvage Split', 'Sorcery', 'Exile up to four target permanent cards from your graveyard and separate them into two piles. An opponent chooses one of those piles. Put that pile into your hand and the other into your graveyard.');
const ZAP = card('Test Zap', 'Instant', '');

describe('CR 700.3, 701.13a, 608.2d: "Exile up to N target permanent cards from your graveyard and separate them into two piles. An opponent chooses one of those piles. Put that pile into your hand and the other into your graveyard." (Split the Spoils)', () => {
  const setup = (): GameState => scenario([], { defs: [SPLIT, BEAR('Test Bear A'), BEAR('Test Bear B'), BEAR('Test Bear C'), ZAP], p1: { hand: ['Test Salvage Split'], graveyard: ['Test Bear A', 'Test Bear B', 'Test Bear C', 'Test Zap'] }, p2: {} });
  const inHand = (s: GameState): string[] => s.zones.hand.p1!.map((id) => nameOf(s, id)).sort();
  const inYard = (s: GameState): string[] => s.zones.graveyard.p1!.map((id) => nameOf(s, id)).sort();
  it('is automated', () => expect(full(SPLIT)).toBe(true));
  it('you separate the exiled cards, an opponent chooses: the chosen pile goes to your hand and the other to your graveyard; nothing stays in exile', () => {
    const s0 = setup();
    const asked: string[] = [];
    const s = cast(s0, 'Test Salvage Split', { pile1: ['Test Bear A'], pileChoice: 'pile1', asked });
    expect(asked.filter((a) => /choose(Objects|Option)/.test(a))).toEqual(['chooseObjects:p1', 'chooseOption:p2']); // you separate, then an opponent chooses
    expect(inHand(s)).toEqual(['Test Bear A']); // pile 1 held one card
    expect(inYard(s)).toEqual(['Test Bear B', 'Test Bear C', 'Test Salvage Split', 'Test Zap']);
    expect(exiledOf(s, 'p1')).toHaveLength(0);
  });
  it('the other pile may be the one chosen: pile 2 goes to your hand', () => {
    const s0 = setup();
    const s = cast(s0, 'Test Salvage Split', { pile1: ['Test Bear A'], pileChoice: 'pile2' });
    expect(inHand(s)).toEqual(['Test Bear B', 'Test Bear C']);
    expect(inYard(s)).toEqual(['Test Bear A', 'Test Salvage Split', 'Test Zap']);
  });
  it('ruling 2022-06-10: an empty pile may be chosen, and then every card goes back to your graveyard', () => {
    const s = cast(setup(), 'Test Salvage Split', { pile1: [], pileChoice: 'pile1' });
    expect(inHand(s)).toEqual([]);
    expect(inYard(s)).toEqual(['Test Bear A', 'Test Bear B', 'Test Bear C', 'Test Salvage Split', 'Test Zap']);
  });
  it('negative: a card that is not a permanent card (an instant) cannot be chosen as a target and stays where it is', () => {
    const s0 = setup();
    const s1 = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Salvage Split', 'hand', 'p1') });
    expect(s1.pending?.kind).toBe('chooseTargets');
    const offered = (s1.pending as unknown as { objects: ObjectId[] }).objects.map((id) => nameOf(s1, id)).sort();
    expect(offered).toEqual(['Test Bear A', 'Test Bear B', 'Test Bear C']);
  });
  it('negative: with no target chosen nothing is exiled, nobody separates and the opponent is not asked', () => {
    const asked: string[] = [];
    const s = cast(setup(), 'Test Salvage Split', { targets: [], asked });
    expect(asked.some((a) => a.startsWith('chooseOption'))).toBe(false);
    expect(inHand(s)).toEqual([]);
  });
});

// ---- Become Anonymous ----------------------------------------------------------------------------------------------------------------------------------------------------

const ANON = card('Test Hidden Self', 'Instant', 'Exile target creature you control and the top two cards of your library in a face-down pile, shuffle that pile, then cloak those cards. They enter tapped.');
const ANON_UNTAPPED = card('Test Hidden Self Untapped', 'Instant', 'Exile target creature you control and the top two cards of your library in a face-down pile, shuffle that pile, then cloak those cards.');

describe('CR 406.3, 701.58a, 701.58e, 614.1c: "Exile target creature ... and the top two cards of your library in a face-down pile, shuffle that pile, then cloak those cards. They enter tapped." (Become Anonymous)', () => {
  const setup = (name: string): GameState => scenario([], { defs: [ANON, ANON_UNTAPPED, BEAR('Test Bear A'), BEAR('Test Bear B'), BEAR('Test Bear C')], p1: { hand: [name], battlefield: ['Test Bear A'], library: ['Test Bear B', 'Test Bear C'] }, p2: {} });
  const mine = (s: GameState): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p1');
  it('is automated', () => { expect(full(ANON)).toBe(true); expect(full(ANON_UNTAPPED)).toBe(true); });
  it('the creature and the top two cards come back face down (three cloaked permanents), tapped; nothing is left in exile or the graveyard', () => {
    const s0 = setup('Test Hidden Self');
    const bear = mine(s0)[0]!;
    const s = cast(s0, 'Test Hidden Self', { targets: [bear] });
    const perms = mine(s);
    expect(perms).toHaveLength(3);
    for (const id of perms) { expect(s.objects[id]!.faceDown, id).toBe(true); expect(s.objects[id]!.tapped, id).toBe(true); }
    expect(exiledOf(s, 'p1')).toHaveLength(0);
    expect(s.zones.graveyard.p1!.map((id) => nameOf(s, id))).toEqual(['Test Hidden Self']);
  });
  it('negative: without "They enter tapped." the cloaked cards enter untapped', () => {
    const s0 = setup('Test Hidden Self Untapped');
    const s = cast(s0, 'Test Hidden Self Untapped', { targets: [mine(s0)[0]!] });
    const perms = mine(s);
    expect(perms).toHaveLength(3);
    for (const id of perms) { expect(s.objects[id]!.faceDown, id).toBe(true); expect(s.objects[id]!.tapped, id).toBeFalsy(); }
  });
  it('negative: the opponent\'s library and creatures are untouched', () => {
    const s0 = setup('Test Hidden Self');
    const before = s0.zones.library.p2!.length;
    const s = cast(s0, 'Test Hidden Self', { targets: [mine(s0)[0]!] });
    expect(s.zones.library.p2!.length).toBe(before);
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p2')).toHaveLength(0);
  });
});

// ---- Menacing Ogre --------------------------------------------------------------------------------------------------------------------------------------------------------

const OGRE = card('Test Brawler', 'Creature — Ogre', 'When ~ enters, each player secretly chooses a number. Then those numbers are revealed. Each player with the highest number loses that much life. If you are one of those players, put two +1/+1 counters on this creature.', { pt: ['3', '3'] });
const PLAYERS: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];

describe('CR 608.2d, 107.1b, 119.3, 122.1: "Each player secretly chooses a number. Then those numbers are revealed. Each player with the highest number loses that much life. If you are one of those players, put two +1/+1 counters on this creature." (Menacing Ogre)', () => {
  const setup = (): GameState => mpScenario({ defs: [OGRE], zones: { p1: { hand: ['Test Brawler'] }, p2: {}, p3: {}, p4: {} } });
  const lost = (s0: GameState, s: GameState): number[] => PLAYERS.map((p) => life(s0, p) - life(s, p));
  const ogre = (s: GameState): ObjectId => s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Brawler')!;
  it('is automated', () => expect(full(OGRE)).toBe(true));
  it('every player chooses, in turn order, a number from 0 up', () => {
    const asked: string[] = [];
    let min = -1;
    cast(setup(), 'Test Brawler', { numbers: [1, 2, 3, 4], asked, onAsk: (s) => { if (s.pending?.kind === 'chooseNumber') min = s.pending.min; } });
    expect(asked.filter((a) => a.startsWith('chooseNumber'))).toEqual(['chooseNumber:p1', 'chooseNumber:p2', 'chooseNumber:p3', 'chooseNumber:p4']);
    expect(min).toBe(0); // ruling 2004-10-04: zero or a positive integer
  });
  it('the highest number is lost by every player who chose it (a tie): p2 and p3 lose 5; you chose less, so no counters', () => {
    const s0 = setup();
    const s = cast(s0, 'Test Brawler', { numbers: [3, 5, 5, 1] });
    expect(lost(s0, s)).toEqual([0, 5, 5, 0]);
    expect(s.objects[ogre(s)]!.counters['+1/+1'] ?? 0).toBe(0);
  });
  it('you chose the highest number: you lose that much life and the creature gets two +1/+1 counters', () => {
    const s0 = setup();
    const s = cast(s0, 'Test Brawler', { numbers: [7, 2, 2, 2] });
    expect(lost(s0, s)).toEqual([7, 0, 0, 0]);
    expect(s.objects[ogre(s)]!.counters['+1/+1']).toBe(2);
  });
  it('you are tied for the highest: you and the other player lose that much and you get the counters (every player who chose it)', () => {
    const s0 = setup();
    const s = cast(s0, 'Test Brawler', { numbers: [4, 4, 0, 1] });
    expect(lost(s0, s)).toEqual([4, 4, 0, 0]);
    expect(s.objects[ogre(s)]!.counters['+1/+1']).toBe(2);
  });
  it('everybody chose 0: all four are "the players with the highest number" and lose 0 life; you get the counters', () => {
    const s0 = setup();
    const s = cast(s0, 'Test Brawler', { numbers: [0, 0, 0, 0] });
    expect(lost(s0, s)).toEqual([0, 0, 0, 0]);
    expect(s.objects[ogre(s)]!.counters['+1/+1']).toBe(2);
  });
  it('negative: the numbers stay secret until all are chosen (a later chooser sees no earlier number), then all four are revealed at once', () => {
    const seen: string[][] = [];
    const s = cast(setup(), 'Test Brawler', { numbers: [11, 12, 13, 14], onAsk: (st) => { if (st.pending?.kind === 'chooseNumber') seen.push(viewFor(st, st.pending.player).log.map((e) => e.text)); } });
    const p3 = seen[2]!.join('\n');
    expect(p3).toMatch(/secretly chooses a number/);
    expect(p3).not.toMatch(/\b11\b|\b12\b/);
    const after = viewFor(s, 'p2').log.map((e) => e.text).join('\n');
    for (const n of ['11', '12', '13', '14']) expect(after).toContain(`reveals ${n}`);
  });
});
