/**
 * Commander coordinator E, round edh-e-8 (graveyard 3/3): the round's readings played through the engine with synthetic cards (invented names), compiled by the game's default
 * compiler, in 4-player games. Each test has its negative case. Scryfall rulings were fetched in the cloud session; CR cites are listed in the record.
 *
 *   CR 201.3, 701.23a, 607.2d      "Choose a creature card name. Search target opponent's graveyard, hand, and library for any number of cards with that name and exile them." (Infinite Obliteration)
 *   CR 201.3, 701.23a, 607.2d      "Choose an artifact card name. ... with the chosen name ..." (Dispossess)
 *   CR 201.3, 701.24a, 121.1       "Choose a nonartifact, nonland card name. ... That player shuffles, then draws a card for each card exiled from their hand this way." (Lost Legacy)
 *   CR 701.23a, 608.2h             "... for up to four cards with that name ..." and the same draw (The Stone Brain)
 *   CR 701.20e, 608.2c             "Look at the top X cards ... Put up to two of them into your hand and the rest into your graveyard." (Shadow Prophecy)
 *   CR 118.12a, 701.6a, 201.2      "Counter target spell unless its controller pays {2} plus an additional {2} for each card named ~ in each graveyard." (Rune Snag)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find, findAll, legal } from '../../m3/scenario';
import { mpScenario, namesOn } from '../../m12/rules/helpers';
import { getChars } from '../../../src/rules/characteristics';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id }) as TargetChoice;
const pl = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;

interface Script { targets?: TargetChoice[][]; name?: string; pickAll?: boolean; limit?: number; yes?: boolean; }
/** Answer the decisions that come up until someone has priority. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes ?? false });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'chooseName') s = answer(s, { kind: 'chooseName', name: script.name ?? 'Plains' });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: script.pickAll === false ? [] : (p as unknown as { options: ObjectId[] }).options.slice(0, script.limit ?? 999) });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p)}`);
  }
  return s;
}
/** Everyone passes until the stack is empty again, answering what comes up. */
function settle(s0: GameState, script: Script = {}): GameState {
  let s = drive(s0, script);
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) s = drive(act(s, { type: 'pass', player: s.pending.player }), script);
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, player: PlayerId = 'p1'): GameState => settle(drive(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), script), script);
const activation = (s: GameState, player: PlayerId, source: ObjectId, index = 0) => legal(s, player, 'activate').filter((a) => a.action.type === 'activate' && a.action.source === source)[index]!.action;
const activate = (s: GameState, source: ObjectId, script: Script = {}, player: PlayerId = 'p1'): GameState => settle(drive(act(s, activation(s, player, source)), script), script);
// (the active player has drawn a Plains from the padding of the library at the start of the scenario)
const handNames = (s: GameState, p: PlayerId): string[] => s.zones.hand[p]!.map((id) => s.objects[id]!.defId).filter((n) => n !== 'Plains');
const yardNames = (s: GameState, p: PlayerId): string[] => (s.zones.graveyard[p] ?? []).map((id) => s.objects[id]!.defId);
const libNames = (s: GameState, p: PlayerId): string[] => s.zones.library[p]!.map((id) => s.objects[id]!.defId);
const exileNames = (s: GameState): string[] => s.zones.exile.map((id) => s.objects[id]!.defId);
const colorsOf = (s: GameState, id: ObjectId): string[] => [...getChars(s, id)!.colors];

import { lifeOf } from '../../m12/rules/helpers';

const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'], colors: ['G'] });
const ELF = card('Test Elf', 'Creature — Elf', '', { pt: ['1', '1'], colors: ['G'] });
const RELIC = card('Test Relic', 'Artifact', '');
const SPARK = card('Test Spark', 'Instant', '', { colors: ['R'] });
const FIELD = card('Test Field', 'Land', '');
const ISLE = card('Test Isle', 'Basic Land — Island', '');

/** Casts `name`, answers the target, and stops at the card-name choice (whatever else is pending is passed through). */
function toNameChoice(s0: GameState, name: string, target: PlayerId): GameState {
  let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') }), { targets: [[pl(target)]] });
  for (let guard = 0; guard < 10 && s.pending?.kind !== 'chooseName'; guard++) s = act(s, { type: 'pass', player: s.pending!.player });
  return s;
}
const zonesOf = (extra: Partial<Record<string, string[]>> = {}) => ({
  p1: { hand: ['Test Card'] },
  p2: { hand: ['Test Bear', 'Test Bear', 'Test Relic', 'Test Field'], graveyard: ['Test Bear', 'Test Relic'], library: ['Test Bear', 'Test Relic', 'Test Elf'], ...extra },
  p3: { hand: ['Test Bear', 'Test Relic'], graveyard: ['Test Bear', 'Test Relic'] },
});
const withSpell = (spell: string, z: ReturnType<typeof zonesOf>) => ({ ...z, p1: { hand: [spell] } });

describe('CR 201.3, 701.23a, 607.2d: "Choose a creature card name. Search target opponent\'s graveyard, hand, and library for any number of cards with that name and exile them. Then that player shuffles."', () => {
  const OBLIT = card('Test Obliteration', 'Sorcery', "Choose a creature card name. Search target opponent's graveyard, hand, and library for any number of cards with that name and exile them. Then that player shuffles.");
  const start = () => mpScenario({ defs: [OBLIT, BEAR, ELF, RELIC, FIELD], zones: withSpell('Test Obliteration', zonesOf()) });
  it('is automated', () => expect(full(OBLIT)).toBe(true));
  it('exiles every card with the chosen creature name from the target opponent\'s three zones, and only theirs', () => {
    const s = cast(start(), 'Test Obliteration', { targets: [[pl('p2')]], name: 'Test Bear' });
    expect(handNames(s, 'p2').sort()).toEqual(['Test Field', 'Test Relic']);
    expect(yardNames(s, 'p2')).toEqual(['Test Relic']);
    expect(libNames(s, 'p2')).not.toContain('Test Bear');
    expect(exileNames(s).filter((n) => n === 'Test Bear').length).toBe(4);
    expect(handNames(s, 'p3')).toEqual(['Test Bear', 'Test Relic']);
    expect(yardNames(s, 'p3')).toEqual(['Test Bear', 'Test Relic']);
  });
  it('negative: an artifact card name and a land card name are refused (creature)', () => {
    const s = toNameChoice(start(), 'Test Obliteration', 'p2');
    expect(s.pending).toMatchObject({ kind: 'chooseName', what: 'cardName', cardKind: 'creature' });
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Relic' })).toThrow();
    expect(() => answer(s, { kind: 'chooseName', name: 'Plains' })).toThrow();
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Bear' })).not.toThrow();
  });
  it('negative: a player who is not an opponent is not a legal target', () => {
    const s0 = start();
    const s1 = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Obliteration', 'hand', 'p1') });
    expect(s1.pending?.kind).toBe('chooseTargets');
    expect(() => answer(s1, { kind: 'chooseTargets', targets: [pl('p1')] })).toThrow();
  });
});

describe('CR 201.3, 701.23a, 607.2d: "Choose an artifact card name. Search target opponent\'s graveyard, hand, and library for any number of cards with the chosen name and exile them. Then that player shuffles."', () => {
  const DISP = card('Test Dispossess', 'Sorcery', "Choose an artifact card name. Search target opponent's graveyard, hand, and library for any number of cards with the chosen name and exile them. Then that player shuffles.");
  const start = () => mpScenario({ defs: [DISP, BEAR, ELF, RELIC, FIELD], zones: withSpell('Test Dispossess', zonesOf()) });
  it('is automated', () => expect(full(DISP)).toBe(true));
  it('exiles every card with the chosen artifact name from the target opponent\'s zones only', () => {
    const s = cast(start(), 'Test Dispossess', { targets: [[pl('p2')]], name: 'Test Relic' });
    expect(handNames(s, 'p2').sort()).toEqual(['Test Bear', 'Test Bear', 'Test Field']);
    expect(yardNames(s, 'p2')).toEqual(['Test Bear']);
    expect(libNames(s, 'p2')).not.toContain('Test Relic');
    expect(exileNames(s).filter((n) => n === 'Test Relic').length).toBe(3);
    expect(handNames(s, 'p3')).toEqual(['Test Bear', 'Test Relic']);
  });
  it('negative: a creature card name is refused (artifact)', () => {
    const s = toNameChoice(start(), 'Test Dispossess', 'p2');
    expect(s.pending).toMatchObject({ kind: 'chooseName', what: 'cardName', cardKind: 'artifact' });
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Bear' })).toThrow();
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Relic' })).not.toThrow();
  });
});

describe('CR 201.3, 701.23a, 701.24a, 121.1: "Choose a nonartifact, nonland card name. ... That player shuffles, then draws a card for each card exiled from their hand this way."', () => {
  const LEGACY = card('Test Legacy', 'Sorcery', "Choose a nonartifact, nonland card name. Search target player's graveyard, hand, and library for any number of cards with that name and exile them. That player shuffles, then draws a card for each card exiled from their hand this way.");
  const start = () => mpScenario({ defs: [LEGACY, BEAR, ELF, RELIC, FIELD], zones: withSpell('Test Legacy', zonesOf({ library: ['Test Bear', 'Test Elf', 'Test Elf', 'Test Elf'] })) });
  it('is automated', () => expect(full(LEGACY)).toBe(true));
  it('exiles the name from all three zones, and the player draws one card per card exiled from their hand (two), not for the graveyard or library ones', () => {
    const s0 = start();
    const before = s0.zones.hand['p2']!.length;
    const s = cast(s0, 'Test Legacy', { targets: [[pl('p2')]], name: 'Test Bear' });
    expect(yardNames(s, 'p2')).toEqual(['Test Relic']);
    expect(libNames(s, 'p2')).not.toContain('Test Bear');
    expect(exileNames(s).filter((n) => n === 'Test Bear').length).toBe(4);
    // hand: 4 cards, two of them Test Bear exiled, two drawn from the library
    expect(s.zones.hand['p2']!.length).toBe(before);
    expect(handNames(s, 'p2')).not.toContain('Test Bear');
  });
  it('"any number": finding none draws nothing', () => {
    const s0 = start();
    const s = cast(s0, 'Test Legacy', { targets: [[pl('p2')]], name: 'Test Bear', pickAll: false });
    expect(s.zones.hand['p2']!.length).toBe(s0.zones.hand['p2']!.length);
    expect(handNames(s, 'p2').filter((n) => n === 'Test Bear').length).toBe(2);
  });
  it('negative: an artifact card name and a land card name are refused (nonartifact, nonland)', () => {
    const s = toNameChoice(start(), 'Test Legacy', 'p2');
    expect(s.pending).toMatchObject({ kind: 'chooseName', what: 'cardName', cardKind: 'nonartifactNonland' });
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Relic' })).toThrow();
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Field' })).toThrow();
    expect(() => answer(s, { kind: 'chooseName', name: 'Test Bear' })).not.toThrow();
  });
});

describe('CR 701.23a, 608.2h, 201.3: "{2}, {T}, Exile ~: Choose a card name. Search target opponent\'s ... for up to four cards with that name and exile them. That player shuffles, then draws a card for each card exiled from their hand this way."', () => {
  const BRAIN = card('Test Brain', 'Artifact', "{2}, {T}, Exile ~: Choose a card name. Search target opponent's graveyard, hand, and library for up to four cards with that name and exile them. That player shuffles, then draws a card for each card exiled from their hand this way. Activate only as a sorcery.");
  const start = () => mpScenario({ defs: [BRAIN, BEAR, ELF, RELIC, FIELD], zones: { p1: { battlefield: [{ name: 'Test Brain', since: 0 }, 'Plains', 'Plains'] }, p2: { hand: ['Test Bear', 'Test Bear'], graveyard: ['Test Bear', 'Test Bear', 'Test Bear'], library: ['Test Bear', 'Test Elf', 'Test Elf', 'Test Elf'] } } });
  it('is automated', () => expect(full(BRAIN)).toBe(true));
  it('finds at most four of the named cards (here four of the six) and draws for those from the hand', () => {
    const s0 = start();
    const s = activate(s0, find(s0, 'Test Brain', 'battlefield', 'p1'), { targets: [[pl('p2')]], name: 'Test Bear', limit: 4 });
    expect(exileNames(s).filter((n) => n === 'Test Bear').length).toBe(4);
    expect(exileNames(s).filter((n) => n === 'Test Brain').length).toBe(1);
    const left = [...yardNames(s, 'p2'), ...libNames(s, 'p2'), ...handNames(s, 'p2')].filter((n) => n === 'Test Bear').length;
    expect(left).toBe(2);
  });
  it('draws one card per card exiled from the HAND only (two in hand, one in the library: two drawn, none for the library one)', () => {
    const s0 = mpScenario({ defs: [BRAIN, BEAR, ELF, RELIC, FIELD], zones: { p1: { battlefield: [{ name: 'Test Brain', since: 0 }, 'Plains', 'Plains'] }, p2: { hand: ['Test Bear', 'Test Bear'], library: ['Test Bear', 'Test Elf', 'Test Elf', 'Test Elf'] } } });
    const s = activate(s0, find(s0, 'Test Brain', 'battlefield', 'p1'), { targets: [[pl('p2')]], name: 'Test Bear', limit: 4 });
    expect(exileNames(s).filter((n) => n === 'Test Bear').length).toBe(3);
    expect(s.zones.hand['p2']!.length).toBe(2); // two drawn for the two Bears exiled from the hand (none for the one from the library)
    expect(libNames(s, 'p2').length).toBe(s0.zones.library['p2']!.length - 1 - 2); // the library Bear is gone, two cards drawn
    expect(handNames(s, 'p2')).not.toContain('Test Bear');
  });
  it('negative: five cards cannot be found (up to four): the choice of five is refused', () => {
    const s0 = start();
    expect(() => activate(s0, find(s0, 'Test Brain', 'battlefield', 'p1'), { targets: [[pl('p2')]], name: 'Test Bear', limit: 5 })).toThrow();
  });
});

describe('CR 701.20e, 608.2c, 404.1: "Look at the top X cards of your library. Put up to two of them into your hand and the rest into your graveyard. You lose 2 life."', () => {
  const PROPHECY = card('Test Prophecy', 'Sorcery', 'Look at the top X cards of your library, where X is the number of basic land types among lands you control. Put up to two of them into your hand and the rest into your graveyard. You lose 2 life.');
  const start = () => mpScenario({ defs: [PROPHECY, BEAR, ELF, RELIC, FIELD], zones: { p1: { hand: ['Test Prophecy'], battlefield: ['Plains', 'Plains'], library: ['Test Bear', 'Test Elf', 'Test Relic', 'Test Field'] } } });
  it('is automated', () => expect(full(PROPHECY)).toBe(true));
  it('with one basic land type among your lands: looks at the top card, up to two (here one) goes to your hand, the rest (none) to the graveyard, and you lose 2 life', () => {
    const s0 = start();
    const top = libNames(s0, 'p1')[0]!;
    const s = cast(s0, 'Test Prophecy', {});
    expect(handNames(s, 'p1')).toContain(top);
    expect(lifeOf(s, 'p1')).toBe(lifeOf(s0, 'p1') - 2);
    expect(libNames(s, 'p1').length).toBe(libNames(s0, 'p1').length - 1);
  });
  it('"up to": may take none; the looked-at cards all go to the graveyard', () => {
    const s0 = start();
    const top = libNames(s0, 'p1')[0]!;
    const s = cast(s0, 'Test Prophecy', { pickAll: false });
    expect(handNames(s, 'p1')).not.toContain(top);
    expect(yardNames(s, 'p1')).toContain(top);
    expect(lifeOf(s, 'p1')).toBe(lifeOf(s0, 'p1') - 2);
  });
  it('X is the number of basic land types: with Plains and Island, two cards are looked at, up to two kept, the rest binned', () => {
    const s0 = mpScenario({ defs: [PROPHECY, BEAR, ELF, RELIC, FIELD, ISLE], zones: { p1: { hand: ['Test Prophecy'], battlefield: ['Plains', 'Test Isle'], library: ['Test Bear', 'Test Elf', 'Test Relic', 'Test Field'] } } });
    const [a, b, c] = libNames(s0, 'p1');
    const s = cast(s0, 'Test Prophecy', { limit: 1 });
    expect(handNames(s, 'p1')).toContain(a);
    expect(yardNames(s, 'p1')).toContain(b);
    expect(libNames(s, 'p1')[0]).toBe(c);
  });
});

describe('CR 118.12a, 701.6a, 201.2: "Counter target spell unless its controller pays {2} plus an additional {2} for each card named ~ in each graveyard."', () => {
  const SNAG = card('Test Snag', 'Instant', 'Counter target spell unless its controller pays {2} plus an additional {2} for each card named Test Snag in each graveyard.');
  const start = (lands: number, snagsInYards: [number, number]) => mpScenario({
    defs: [SNAG, BEAR, ELF, SPARK],
    zones: {
      p1: { hand: ['Test Snag', 'Test Bear'], battlefield: Array.from({ length: lands }, () => 'Plains'), graveyard: Array.from({ length: snagsInYards[0] }, () => 'Test Snag') },
      p2: { graveyard: Array.from({ length: snagsInYards[1] }, () => 'Test Snag') },
    },
  });
  const snagOwnSpell = (s0: GameState, pay: boolean): GameState => {
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Bear', 'hand', 'p1') }));
    s = drive(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Snag', 'hand', 'p1') }), { targets: [[{ kind: 'object', id: s.zones.stack[0]! } as TargetChoice]] });
    return settle(s, { yes: pay });
  };
  it('is automated', () => expect(full(SNAG)).toBe(true));
  it('negative (no copies in graveyards but the one in hand): pays {2} only; with enough mana the spell is not countered', () => {
    const s = snagOwnSpell(start(2, [0, 0]), true);
    expect(namesOn(s, 'p1')).toContain('Test Bear');
  });
  it('two Test Snags in graveyards (one in each): the controller must pay {2} + {4}; with six lands, paying keeps the spell', () => {
    const s = snagOwnSpell(start(6, [1, 1]), true);
    expect(namesOn(s, 'p1')).toContain('Test Bear');
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.tapped).length).toBe(6);
  });
  it('two Test Snags in graveyards but only four lands: the payment cannot be made and the spell is countered', () => {
    const s = snagOwnSpell(start(4, [1, 1]), true);
    expect(namesOn(s, 'p1')).not.toContain('Test Bear');
    expect(yardNames(s, 'p1')).toContain('Test Bear');
  });
  it('declining to pay lets the counter happen', () => {
    const s = snagOwnSpell(start(6, [1, 1]), false);
    expect(namesOn(s, 'p1')).not.toContain('Test Bear');
  });
});
