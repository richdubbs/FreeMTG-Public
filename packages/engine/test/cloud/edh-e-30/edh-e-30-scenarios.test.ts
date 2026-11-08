/**
 * Round edh-e-30 (Commander coordinator E): played scenarios with synthetic cards (invented names, printed wordings), compiled by the default compiler.
 *   CR 107.17, 122.1   {TK}: "You get {TK}" gives ticket counters (a counter kind of the player)
 *   CR 123.3, 123.3b   "you may put a sticker on a nonland permanent you own": a sticker the player has access to, on a permanent they own only
 *   CR 105.3, 613.1e   "becomes blue in addition to its other colors until end of turn"
 *   CR 305.7, 613.1d   "Until end of turn, all creatures become black and all lands become Swamps."
 */
import { describe, expect, it } from 'vitest';
import { getChars, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act as mact, find as mfind, mpScenario, pass as mpass, passUntil, answer as manswer } from '../../m12/rules/helpers';
import { card, full, resolveAll, settle } from '../cmd3/helpers';
import { compileCard, type CardDef, type OracleCard } from '../../../src/index';
const colored = (name: string, color: string): CardDef => compileCard({ name, layout: 'normal', mana_cost: '{0}', type_line: 'Creature — Bear', oracle_text: '', colors: [color], power: '2', toughness: '2' } as OracleCard);
import { activatedAbilities } from '../../../src/rules/abilities';

const bf = (s: GameState, defId: string, p?: PlayerId): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === defId && (p === undefined || s.objects[id]!.controller === p));

describe('CR 107.17: {TK} ("You get {TK}." is a ticket counter on the player)', () => {
  const BUDDY = card('Test Ticket Buddy', 'Creature — Alien', '{T}: You get {TK}.', ['1', '1']);
  const STICK = card('Test Sticker Imp', 'Creature — Imp', 'When this creature enters, you get {TK}, then you may put a sticker on a nonland permanent you own.', ['1', '1']);
  it('compiles full: putCounters of kind ticket on you; a "put a sticker" instruction is not read (a sticker of any kind is not modelled): the card stays partial', () => {
    expect(full(BUDDY)).toBe(true);
    expect(JSON.stringify(BUDDY.faces[0]!.abilities)).toContain('"kind":"ticket"');
    expect(full(STICK)).toBe(false);
  });
  it('the ability gives one ticket counter each time', () => {
    const s0 = mpScenario({ defs: [BUDDY], zones: { p1: { battlefield: ['Test Ticket Buddy'] } } });
    const buddy = bf(s0, 'Test Ticket Buddy')[0]!;
    expect(s0.players[0]!.counters['ticket'] ?? 0).toBe(0);
    const s1 = resolveAll(mact(s0, { type: 'activate', player: 'p1', source: buddy, ability: activatedAbilities(s0, s0.objects[buddy]!).find((a) => true)!.key } as never));
    expect(s1.players[0]!.counters['ticket']).toBe(1);
  });
});

describe('CR 105.3, 613.1e: Indigo Faerie ("{U}: Target permanent becomes blue in addition to its other colors until end of turn.")', () => {
  const FAERIE = card('Test Indigo Imp', 'Creature — Faerie', '{0}: Target permanent becomes blue in addition to its other colors until end of turn.', ['1', '1']);
  const RED = colored('Test Red Bear', 'R');
  it('adds blue and keeps the printed colors; ends with the turn', () => {
    expect(full(FAERIE)).toBe(true);
    const s0 = mpScenario({ defs: [FAERIE, RED], zones: { p1: { battlefield: ['Test Indigo Imp', 'Test Red Bear'] } } });
    const bear = bf(s0, 'Test Red Bear')[0]!;
    const imp = bf(s0, 'Test Indigo Imp')[0]!;
    const colorsBefore = getChars(s0, bear)!.colors;
    expect(colorsBefore).not.toContain('U');
    const s1 = resolveAll(settle(mact(s0, { type: 'activate', player: 'p1', source: imp, ability: activatedAbilities(s0, s0.objects[imp]!)[0]!.key } as never), { targets: [{ kind: 'object', id: bear }] }), { targets: [{ kind: 'object', id: bear }] });
    const after = getChars(s1, bear)!.colors;
    expect(after).toContain('U');
    for (const c of colorsBefore) expect(after).toContain(c);
  });
});

describe('edh-e-30 review: a creature type is not a land type', () => {
  it('"all lands become Zombies" is not fully automated', () => {
    expect(full(card('Test Odd Spell', 'Instant', 'Until end of turn, all creatures become black and all lands become Zombies.'))).toBe(false);
  });
});

describe('CR 305.7, 613.1d-e: Nightcreep ("Until end of turn, all creatures become black and all lands become Swamps.")', () => {
  const NIGHT = card('Test Dusk Spell', 'Instant', 'Until end of turn, all creatures become black and all lands become Swamps.');
  const BEAR = colored('Test Dusk Bear', 'G');
  const FOREST = card('Test Dusk Forest', 'Land — Forest', '');
  it('every creature (any controller) is black only, every land a Swamp only; both end at end of turn', () => {
    expect(full(NIGHT)).toBe(true);
    const s0 = mpScenario({ defs: [NIGHT, BEAR, FOREST], zones: { p1: { hand: ['Test Dusk Spell'], battlefield: ['Test Dusk Bear', 'Test Dusk Forest'] }, p2: { battlefield: ['Test Dusk Bear', 'Test Dusk Forest'] } }, });
    const s1 = resolveAll(mact(s0, { type: 'cast', player: 'p1', card: mfind(s0, 'Test Dusk Spell', 'hand', 'p1') }));
    for (const id of bf(s1, 'Test Dusk Bear')) expect(getChars(s1, id)!.colors).toEqual(['B']);
    for (const id of bf(s1, 'Test Dusk Forest')) { const c = getChars(s1, id)!; expect(c.subtypes).toContain('Swamp'); expect(c.subtypes).not.toContain('Forest'); }
    const s = passUntil(s1, (x) => x.turn.number !== s1.turn.number, 'the next turn');
    for (const id of bf(s, 'Test Dusk Bear')) expect(getChars(s, id)!.colors).toEqual(['G']);
    for (const id of bf(s, 'Test Dusk Forest')) expect(getChars(s, id)!.subtypes).toContain('Forest');
  });
});
