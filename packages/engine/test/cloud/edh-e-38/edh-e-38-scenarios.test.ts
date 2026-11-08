/**
 * edh-e-38 (Commander coordinator E, group graveyard 2/3, second batch): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites checked against the Comprehensive
 * Rules of 2026-09-25 only where marked; the rest are from memory (listed as unverified in the record).
 *
 *   CR 406.1, 404.1, 402.1, 400.7        "Target opponent reveals their hand. Exile all noncreature, nonland cards from that player's hand and graveyard." (Thought Distortion)
 *   CR 701.12a, 400.1, 404.1, 401.1      "Exchange your graveyard and library. Then shuffle your library." (Morality Shift)
 *   CR 101.4, 110.2a, 122.1, 614.1c      "Each player returns each creature card from their graveyard to the battlefield with an additional -1/-1 counter on it." (Pyrrhic Revival)
 *   CR 608.2c, 205.3m, 400.3             "Return a Pirate card from your graveyard to your hand, then do the same for Vampire, Dinosaur, and Merfolk." (Grim Captain's Call)
 *   CR 202.3, 107.1a, 608.2h, 122.1      "exile an instant or sorcery card from your graveyard. Put a number of +1/+1 counters on this creature equal to half that card's mana value, rounded up." (Torrent Sculptor)
 *   CR 208.1, 608.2h, 701.13a, 122.1     "Exile target creature card from a graveyard. Put X +1/+1 counters on target creature, where X is the power of the card you exiled." (Flesh // Blood)
 *   CR 115.1, 601.2c, 601.7a, 404.1      "return target creature card of an opponent's choice from your graveyard to your hand." (Mausoleum Turnkey)
 *   CR 614.15, 608.2c, 701.8a, 120.3     "Destroy target land. If there are seven or more cards in your graveyard, instead destroy that land and ~ deals 1 damage to each creature and each player." (Rancid Earth)
 *   CR 506.2, 506.3, 508.1, 702.121a     "return target creature card with mana value X or less from your graveyard to the battlefield, where X is the number of players you attacked this combat." (Custodi Soulcaller)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, createGame, getChars, legalActions, type CardDef, type GameConfig, type GameState, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[]; loyalty?: string } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}), ...(opts.loyalty ? { loyalty: opts.loyalty } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const obj = (id: string): TargetChoice => ({ kind: 'object', id }) as TargetChoice;

interface Script { yes?: boolean[]; targets?: TargetChoice[][]; objects?: (string[] | ((options: string[], s: GameState) => string[]))[]; options?: (string[] | ((p: { min: number; max: number; options: { id: string }[] }) => string[]))[]; order?: ((ids: string[], s: GameState) => string[])[]; numbers?: number[] }
/** Answer the decisions that come up until someone has priority. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 200 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'chooseObjects') { const pick = script.objects?.shift(); s = answer(s, { kind: 'chooseObjects', ids: typeof pick === 'function' ? pick(p.options, s) : pick ?? p.options.slice(0, p.min) }); }
    else if (p.kind === 'order') { const f = script.order?.shift(); const ids = p.items.map((i) => i.id); s = answer(s, { kind: 'order', ids: f ? f(ids, s) : ids }); }
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'chooseOption') { const o = script.options?.shift(); s = answer(s, { kind: 'chooseOption', ids: typeof o === 'function' ? o(p) : o ?? p.options.slice(0, p.min).map((x) => x.id) }); }
    else if (p.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
    else if (p.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? p.min });
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
const names = (s: GameState, ids: readonly string[]): string[] => ids.map((id) => s.objects[id]!.defId);
const gy = (s: GameState, p: PlayerId): string[] => names(s, s.zones.graveyard[p]!);
const lib = (s: GameState, p: PlayerId): string[] => names(s, s.zones.library[p]!);
const exileOf = (s: GameState, p: PlayerId): string[] => s.zones.exile.filter((id) => s.objects[id]!.owner === p).map((id) => s.objects[id]!.defId);
const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const byName = (s: GameState, wanted: readonly string[]) => (options: string[]): string[] => {
  const left = [...wanted];
  return options.filter((id) => { const k = left.indexOf(s.objects[id]!.defId); if (k < 0) return false; left.splice(k, 1); return true; });
};
void obj;


const counters = (s: GameState, id: string, kind: string): number => s.objects[id]!.counters[kind] ?? 0;
const player = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;
const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
const MOUSE = card('Test Mouse', 'Creature — Mouse', '', { pt: ['1', '1'] });
const SPELL_A = card('Test Spell A', 'Instant', 'You gain 1 life.');
const LAND_A = card('Test Land A', 'Land', '');
const GIZMO = card('Test Gizmo', 'Artifact', '');
const idsOf = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId, name: string): string[] => s.zones[zone][p]!.filter((id) => s.objects[id]!.defId === name);

// ---- Thought Distortion: "Target opponent reveals their hand. Exile all noncreature, nonland cards from that player's hand and graveyard." --------------------------------

const PURGE = card('Test Mind Purge', 'Sorcery', "Target opponent reveals their hand. Exile all noncreature, nonland cards from that player's hand and graveyard.");

describe("CR 406.1, 404.1, 402.1 (Thought Distortion): exile every noncreature, nonland card from the target opponent's hand and graveyard", () => {
  const setup = (): GameState => mpScenario({
    defs: [PURGE, BEAR, SPELL_A, LAND_A, GIZMO],
    zones: { p1: { hand: ['Test Mind Purge'], graveyard: ['Test Spell A'] }, p2: { hand: ['Test Bear', 'Test Spell A', 'Test Land A'], graveyard: ['Test Gizmo', 'Test Bear', 'Test Spell A'] }, p3: { hand: ['Test Spell A'], graveyard: ['Test Spell A', 'Test Gizmo'] } },
  });
  it('is automated', () => expect(full(PURGE)).toBe(true));
  it('only the target opponent\'s noncreature, nonland cards go (hand and graveyard); their creatures and lands stay; nobody else\'s cards are touched', () => {
    const s0 = setup();
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Mind Purge', 'hand', 'p1') }), { targets: [[player('p2')]] });
    expect(names(s, s.zones.hand.p2!).sort()).toEqual(['Test Bear', 'Test Land A']);
    expect(gy(s, 'p2')).toEqual(['Test Bear']);
    expect(exileOf(s, 'p2').sort()).toEqual(['Test Gizmo', 'Test Spell A', 'Test Spell A']);
    expect(gy(s, 'p3').sort()).toEqual(['Test Gizmo', 'Test Spell A']);
    expect(names(s, s.zones.hand.p3!)).toEqual(['Test Spell A']);
    expect(gy(s, 'p1').sort()).toEqual(['Test Mind Purge', 'Test Spell A']);
  });
  it('a card of the target\'s that is both a creature and an artifact is not exiled (it is a creature card)', () => {
    const ART_CREATURE = card('Test Clockwork Bear', 'Artifact Creature — Construct', '', { pt: ['1', '1'] });
    const s0 = mpScenario({ defs: [PURGE, ART_CREATURE], zones: { p1: { hand: ['Test Mind Purge'] }, p2: { graveyard: ['Test Clockwork Bear'], hand: ['Test Clockwork Bear'] } } });
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Mind Purge', 'hand', 'p1') }), { targets: [[player('p2')]] });
    expect(gy(s, 'p2')).toEqual(['Test Clockwork Bear']);
    expect(names(s, s.zones.hand.p2!)).toEqual(['Test Clockwork Bear']);
  });
});

// ---- Morality Shift: "Exchange your graveyard and library. Then shuffle your library." ------------------------------------------------------------------------------------

const SWAP = card('Test Tide Swap', 'Sorcery', 'Exchange your graveyard and library. Then shuffle your library.');

describe('CR 701.12a, 400.1, 401.1 (Morality Shift): every card of your graveyard goes into your library and every card of your library into your graveyard', () => {
  const setup = (graveyard: string[], library: string[] = []): GameState => mpScenario({
    defs: [SWAP, SPELL_A, GIZMO, BEAR], zones: { p1: { hand: ['Test Tide Swap'], graveyard, library }, p2: { graveyard: ['Test Gizmo'], library: ['Test Spell A'] } },
  });
  const cast = (s: GameState): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Tide Swap', 'hand', 'p1') }));
  it('is automated', () => expect(full(SWAP)).toBe(true));
  it('the graveyard cards end in the library and the old library (all of it, whatever was drawn before) in the graveyard, with the spell itself last; another player\'s zones are untouched', () => {
    const s0 = setup(['Test Spell A', 'Test Gizmo'], ['Test Bear']);
    const before = lib(s0, 'p1').length;
    const hand0 = s0.zones.hand.p1!.length;
    const s = cast(s0);
    expect([...lib(s, 'p1')].sort()).toEqual(['Test Gizmo', 'Test Spell A']);
    expect(gy(s, 'p1').length).toBe(before + 1);
    expect(gy(s, 'p1')[gy(s, 'p1').length - 1]).toBe('Test Tide Swap');
    expect(s.zones.hand.p1!.length).toBe(hand0 - 1);
    expect(gy(s, 'p2')).toEqual(['Test Gizmo']);
    expect(lib(s, 'p2')).toContain('Test Spell A');
    expect(lib(s, 'p2').length).toBe(21);
  });
  it('ruling 2004-10-04: it works with an empty graveyard (the whole library goes to the graveyard and the library is left empty)', () => {
    const s0 = setup([]);
    const before = lib(s0, 'p1').length;
    const s = cast(s0);
    expect(lib(s, 'p1')).toEqual([]);
    expect(gy(s, 'p1').length).toBe(before + 1);
  });
});

// ---- Pyrrhic Revival: "Each player returns each creature card from their graveyard to the battlefield with an additional -1/-1 counter on it." --------------------------------

const REVIVE = card('Test Grim Revival', 'Sorcery', 'Each player returns each creature card from their graveyard to the battlefield with an additional -1/-1 counter on it.');

describe('CR 101.4, 110.2a, 122.1, 614.1c (Pyrrhic Revival): every player\'s creature cards return under their owner\'s control with a -1/-1 counter', () => {
  const s0 = mpScenario({
    defs: [REVIVE, BEAR, MOUSE, SPELL_A], zones: { p1: { hand: ['Test Grim Revival'], graveyard: ['Test Bear', 'Test Spell A'] }, p2: { graveyard: ['Test Bear', 'Test Bear'] }, p3: { graveyard: ['Test Mouse'] } },
  });
  it('is automated', () => expect(full(REVIVE)).toBe(true));
  it('each creature card of each graveyard enters with a -1/-1 counter under its owner\'s control; a 1/1 comes back and dies (0 toughness); noncreature cards stay', () => {
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Grim Revival', 'hand', 'p1') }));
    const bears = s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Bear');
    expect(bears.length).toBe(3);
    for (const id of bears) expect(counters(s, id, '-1/-1')).toBe(1);
    expect(bears.map((id) => s.objects[id]!.controller).sort()).toEqual(['p1', 'p2', 'p2']);
    expect(gy(s, 'p3')).toEqual(['Test Mouse']);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Mouse')).toBe(false);
    expect(gy(s, 'p1').sort()).toEqual(['Test Grim Revival', 'Test Spell A']);
    expect(Number(getChars(s, bears[0]!).power)).toBe(1);
  });
});

// ---- Grim Captain's Call: "Return a Pirate card from your graveyard to your hand, then do the same for Vampire, Dinosaur, and Merfolk." ----------------------------------------

const CALL = card("Test Captain's Hail", 'Sorcery', 'Return a Pirate card from your graveyard to your hand, then do the same for Vampire, Dinosaur, and Merfolk.');
const PIRATE_A = card('Test Pirate A', 'Creature — Pirate', '', { pt: ['1', '1'] });
const PIRATE_B = card('Test Pirate B', 'Creature — Pirate', '', { pt: ['1', '1'] });
const VAMPIRE = card('Test Vampire', 'Creature — Vampire', '', { pt: ['1', '1'] });
const PIRATE_VAMPIRE = card('Test Pirate Vampire', 'Creature — Pirate Vampire', '', { pt: ['1', '1'] });
const MERFOLK = card('Test Merfolk', 'Creature — Merfolk', '', { pt: ['1', '1'] });
const DINO = card('Test Dino', 'Creature — Dinosaur', '', { pt: ['1', '1'] });

describe('CR 608.2c, 205.3m (Grim Captain\'s Call): one card of each of the four creature types, in turn, from your graveyard to your hand', () => {
  const setup = (graveyard: string[]): GameState => mpScenario({ defs: [CALL, PIRATE_A, PIRATE_B, VAMPIRE, PIRATE_VAMPIRE, MERFOLK, DINO], zones: { p1: { hand: ["Test Captain's Hail"], graveyard } } });
  const cast = (s: GameState, script: Script): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, "Test Captain's Hail", 'hand', 'p1') }), script);
  it('is automated', () => expect(full(CALL)).toBe(true));
  it('the player picks one card for each type in turn: a card that is two of the types can be taken once; a type with no card in the graveyard is skipped; the others stay', () => {
    const seen: string[][] = [];
    const s = cast(setup(['Test Pirate A', 'Test Pirate B', 'Test Vampire', 'Test Pirate Vampire', 'Test Merfolk']), { objects: [
      (opts, st) => { seen.push(opts.map((id) => st.objects[id]!.defId)); return byName(st, ['Test Pirate Vampire'])(opts); },
      (opts, st) => { seen.push(opts.map((id) => st.objects[id]!.defId)); return byName(st, ['Test Vampire'])(opts); },
      (opts, st) => { seen.push(opts.map((id) => st.objects[id]!.defId)); return byName(st, ['Test Merfolk'])(opts); },
    ] });
    expect(seen[0]!.sort()).toEqual(['Test Pirate A', 'Test Pirate B', 'Test Pirate Vampire']);
    expect(seen.length).toBe(1); // the Vampire, the Dinosaur and the Merfolk steps have one or no candidate left: nothing to ask
    expect(names(s, s.zones.hand.p1!).filter((n) => n !== 'Plains').sort()).toEqual(['Test Merfolk', 'Test Pirate Vampire', 'Test Vampire']);
    expect(gy(s, 'p1').sort()).toEqual(["Test Captain's Hail", 'Test Pirate A', 'Test Pirate B']);
  });
  it('a Dinosaur in the graveyard is taken too; with none of the four types nothing returns', () => {
    const s = cast(setup(['Test Dino', 'Test Pirate A']), {});
    expect(names(s, s.zones.hand.p1!).filter((n) => n !== 'Plains').sort()).toEqual(['Test Dino', 'Test Pirate A']);
    const none = cast(mpScenario({ defs: [CALL, BEAR], zones: { p1: { hand: ["Test Captain's Hail"], graveyard: ['Test Bear'] } } }), {});
    expect(names(none, none.zones.hand.p1!).filter((n) => n !== 'Plains')).toEqual([]);
    expect(gy(none, 'p1').sort()).toEqual(['Test Bear', "Test Captain's Hail"]);
  });
});

// ---- Torrent Sculptor: "When this creature enters, exile an instant or sorcery card from your graveyard. Put a number of +1/+1 counters on this creature equal to half that card's mana value, rounded up." -----

const SCULPTOR = card('Test Tide Sculptor', 'Creature — Merfolk', "When this creature enters, exile an instant or sorcery card from your graveyard. Put a number of +1/+1 counters on this creature equal to half that card's mana value, rounded up.", { pt: ['2', '2'] });
const SPELL3 = card('Test Three Spell', 'Instant', 'You gain 1 life.', { cost: '{2}{U}', colors: ['U'] });
const SPELL4 = card('Test Four Spell', 'Sorcery', 'You gain 1 life.', { cost: '{3}{U}', colors: ['U'] });
const SPELL0 = card('Test Free Spell', 'Instant', 'You gain 1 life.');

describe('CR 202.3, 107.1a, 608.2h (Torrent Sculptor): exile an instant or sorcery card from your graveyard, then half its mana value (rounded up) in +1/+1 counters', () => {
  const setup = (graveyard: string[]): GameState => mpScenario({ defs: [SCULPTOR, SPELL3, SPELL4, SPELL0, BEAR], zones: { p1: { hand: ['Test Tide Sculptor'], graveyard } } });
  const cast = (s: GameState, script: Script = {}): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Tide Sculptor', 'hand', 'p1') }), script);
  const sculptor = (s: GameState): string => find(s, 'Test Tide Sculptor', 'battlefield', 'p1');
  it('is automated', () => expect(full(SCULPTOR)).toBe(true));
  it('a mana value 3 card gives 2 counters (3 halved, rounded up) and a mana value 4 card gives 2: the chosen one is exiled, the other stays; a creature card is no choice', () => {
    const s = cast(setup(['Test Three Spell', 'Test Four Spell', 'Test Bear']), { objects: [(opts, st) => byName(st, ['Test Four Spell'])(opts)] });
    expect(counters(s, sculptor(s), '+1/+1')).toBe(2);
    expect(exileOf(s, 'p1')).toEqual(['Test Four Spell']);
    expect(gy(s, 'p1').sort()).toEqual(['Test Bear', 'Test Three Spell']);
    const s3 = cast(setup(['Test Three Spell', 'Test Bear']));
    expect(counters(s3, sculptor(s3), '+1/+1')).toBe(2);
  });
  it('a mana value 0 card gives no counters; with no instant or sorcery card in the graveyard nothing is exiled and no counter is put', () => {
    const s0 = cast(setup(['Test Free Spell']));
    expect(counters(s0, sculptor(s0), '+1/+1')).toBe(0);
    expect(exileOf(s0, 'p1')).toEqual(['Test Free Spell']);
    const none = cast(setup(['Test Bear']));
    expect(counters(none, sculptor(none), '+1/+1')).toBe(0);
    expect(exileOf(none, 'p1')).toEqual([]);
    expect(gy(none, 'p1')).toEqual(['Test Bear']);
  });
});

// ---- Flesh // Blood: "Exile target creature card from a graveyard. Put X +1/+1 counters on target creature, where X is the power of the card you exiled." -------------------------

const FLESH = card('Test Flesh Rite', 'Sorcery', 'Exile target creature card from a graveyard. Put X +1/+1 counters on target creature, where X is the power of the card you exiled.');
const BRUTE = card('Test Brute', 'Creature — Ogre', '', { pt: ['4', '3'] });

describe('CR 701.13a, 208.1, 608.2h (Flesh // Blood): exile a creature card from a graveyard, then put as many +1/+1 counters on a creature as its power', () => {
  const s0 = mpScenario({ defs: [FLESH, BRUTE, BEAR], zones: { p1: { hand: ['Test Flesh Rite'], battlefield: ['Test Bear'] }, p2: { graveyard: ['Test Brute', 'Test Bear'] } } });
  it('is automated', () => expect(full(FLESH)).toBe(true));
  it('the power of the exiled card (4) is the number of counters; the card is exiled from the other player\'s graveyard', () => {
    const brute = find(s0, 'Test Brute', 'graveyard', 'p2');
    const bear = find(s0, 'Test Bear', 'battlefield', 'p1');
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Flesh Rite', 'hand', 'p1') }), { targets: [[obj(brute)], [obj(bear)]] });
    expect(counters(s, bear, '+1/+1')).toBe(4);
    expect(exileOf(s, 'p2')).toEqual(['Test Brute']);
    expect(gy(s, 'p2')).toEqual(['Test Bear']);
  });
  it('a creature card with power 2 gives 2 counters (the power of the card that was exiled, not of the creature that gets them)', () => {
    const bearCard = find(s0, 'Test Bear', 'graveyard', 'p2');
    const target = find(s0, 'Test Bear', 'battlefield', 'p1');
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Flesh Rite', 'hand', 'p1') }), { targets: [[obj(bearCard)], [obj(target)]] });
    expect(counters(s, target, '+1/+1')).toBe(2);
  });
});

// ---- Rancid Earth: "Destroy target land. Threshold -- If there are seven or more cards in your graveyard, instead destroy that land and ~ deals 1 damage to each creature and each player." ----

const QUAKE = card('Test Foul Quake', 'Instant', 'Destroy target land.\nThreshold — If there are seven or more cards in your graveyard, instead destroy that land and ~ deals 1 damage to each creature and each player.');
const FIELD = card('Test Field', 'Land', '');

describe('CR 614.15, 608.2c, 120.3 (Rancid Earth): destroy target land; with seven or more cards in your graveyard, also 1 damage to each creature and each player', () => {
  const setup = (cards: number): GameState => mpScenario({
    defs: [QUAKE, FIELD, BEAR, MOUSE, SPELL_A],
    zones: { p1: { hand: ['Test Foul Quake'], graveyard: Array(cards).fill('Test Spell A') }, p2: { battlefield: ['Test Field', 'Test Mouse'] }, p3: { battlefield: ['Test Bear'] } },
  });
  const cast = (s: GameState): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Foul Quake', 'hand', 'p1') }), { targets: [[obj(find(s, 'Test Field', 'battlefield', 'p2'))]] });
  it('is automated', () => expect(full(QUAKE)).toBe(true));
  it('with six cards in the graveyard only the land is destroyed (the spell on the stack does not count): no damage', () => {
    const s0 = setup(6);
    const life0 = ['p1', 'p2', 'p3', 'p4'].map((p) => lifeOf(s0, p));
    const s = cast(s0);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Field')).toBe(false);
    expect(['p1', 'p2', 'p3', 'p4'].map((p) => lifeOf(s, p))).toEqual(life0);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Mouse')).toBe(true);
  });
  it('with seven cards the land is destroyed and every creature and every player is dealt 1 damage (the 1/1 dies, the 2/2 survives)', () => {
    const s0 = setup(7);
    const life0 = ['p1', 'p2', 'p3', 'p4'].map((p) => lifeOf(s0, p));
    const s = cast(s0);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Field')).toBe(false);
    expect(['p1', 'p2', 'p3', 'p4'].map((p) => lifeOf(s, p))).toEqual(life0.map((l) => l - 1));
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Mouse')).toBe(false);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Bear')).toBe(true);
  });
});

// ---- Mausoleum Turnkey: "When this creature enters, return target creature card of an opponent's choice from your graveyard to your hand." --------------------------------

const TURNKEY = card('Test Crypt Warden', 'Creature — Skeleton', "When this creature enters, return target creature card of an opponent's choice from your graveyard to your hand.", { pt: ['3', '3'] });

describe('CR 115.1, 601.2c, 601.7a (Mausoleum Turnkey): an opponent chooses which creature card of your graveyard is the target', () => {
  const s0 = mpScenario({ defs: [TURNKEY, BEAR, BRUTE, SPELL_A], zones: { p1: { hand: ['Test Crypt Warden'], graveyard: ['Test Bear', 'Test Brute', 'Test Spell A'] } } });
  it('is automated', () => expect(full(TURNKEY)).toBe(true));
  it('the target is chosen by an opponent (not by the controller), among the creature cards of the controller\'s graveyard only', () => {
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Crypt Warden', 'hand', 'p1') });
    let chooser: string | undefined;
    let asked: string | undefined;
    let candidates: string[] = [];
    for (let guard = 0; guard < 40 && s.pending !== null; guard++) {
      const p = s.pending;
      if (p.kind === 'chooseOption') { // CR 601.7a: the controller picks which opponent makes the choice
        asked = (p as { player: string }).player;
        s = answer(s, { kind: 'chooseOption', ids: ['p3'] });
      } else if (p.kind === 'chooseTargets') {
        chooser = (p as { player: string }).player;
        const opts = JSON.stringify(p);
        candidates = ['Test Bear', 'Test Brute', 'Test Spell A'].filter((n) => opts.includes(find(s, n, 'graveyard', 'p1')));
        s = answer(s, { kind: 'chooseTargets', targets: [obj(find(s, 'Test Brute', 'graveyard', 'p1'))] });
      } else if (p.kind === 'priority') {
        if (s.zones.stack.length === 0) break;
        s = act(s, { type: 'pass', player: p.player });
      } else s = drive(s, {});
    }
    expect(asked).toBe('p1');
    expect(chooser).toBe('p3');
    expect(candidates.sort()).toEqual(['Test Bear', 'Test Brute']);
    expect(names(s, s.zones.hand.p1!).filter((n) => n !== 'Plains')).toEqual(['Test Brute']);
    expect(gy(s, 'p1').sort()).toEqual(['Test Bear', 'Test Spell A']);
  });
});

// ---- Custodi Soulcaller: "Whenever this creature attacks, return target creature card with mana value X or less from your graveyard to the battlefield, where X is the number of players you attacked this combat." ----

const SOUL = card('Test Grave Herald', 'Creature — Human Cleric', 'Whenever this creature attacks, return target creature card with mana value X or less from your graveyard to the battlefield, where X is the number of players you attacked this combat.', { pt: ['1', '2'] });
const TWO = card('Test Two Drop', 'Creature — Bear', '', { pt: ['2', '2'], cost: '{1}{G}' });
const THREE = card('Test Three Drop', 'Creature — Bear', '', { pt: ['3', '3'], cost: '{2}{G}' });
const ONE = card('Test One Drop', 'Creature — Bear', '', { pt: ['1', '1'], cost: '{G}' });

describe('CR 506.2, 506.3, 508.1 (Custodi Soulcaller): X is the number of different players you attacked this combat', () => {
  /** Attack the given players (one attacker each, in order) and aim the trigger at `pick`: the state, or `'illegal'` when the engine refuses that card as a target. */
  const run = (defenders: PlayerId[], pick: string): GameState | 'illegal' => {
    let s = mpScenario({ defs: [SOUL, BEAR, TWO, THREE, ONE], zones: { p1: { battlefield: ['Test Grave Herald', 'Test Bear'], graveyard: ['Test One Drop', 'Test Two Drop', 'Test Three Drop'] } } });
    for (let g = 0; g < 30 && s.pending?.kind !== 'declareAttackers'; g++) s = act(s, { type: 'pass', player: s.pending!.player });
    const herald = find(s, 'Test Grave Herald', 'battlefield', 'p1');
    const bear = find(s, 'Test Bear', 'battlefield', 'p1');
    const attacks = [{ attacker: herald, defender: defenders[0]! }, ...(defenders[1] !== undefined ? [{ attacker: bear, defender: defenders[1] }] : [])];
    s = answer(s, { kind: 'declareAttackers', attacks });
    for (let g = 0; g < 40 && s.turn.step === 'declareAttackers'; g++) {
      if (s.pending?.kind === 'chooseTargets') {
        try { s = answer(s, { kind: 'chooseTargets', targets: [obj(find(s, pick, 'graveyard', 'p1'))] }); } catch (e) { if (/not a legal target/.test(String(e))) return 'illegal'; throw e; }
      } else if (s.pending?.kind === 'priority') s = act(s, { type: 'pass', player: s.pending.player });
      else s = drive(s, {});
    }
    return s;
  };
  const back = (r: GameState | 'illegal', name: string): boolean => r !== 'illegal' && r.zones.battlefield.some((id) => r.objects[id]!.defId === name);
  it('is automated', () => expect(full(SOUL)).toBe(true));
  it('attacking one player makes X = 1 (the mana value 1 card returns; a mana value 2 card is no legal target); attacking two players makes X = 2 (the mana value 2 card returns, the mana value 3 card is no legal target)', () => {
    expect(back(run(['p2'], 'Test One Drop'), 'Test One Drop')).toBe(true);
    expect(run(['p2'], 'Test Two Drop')).toBe('illegal');
    expect(back(run(['p2', 'p3'], 'Test Two Drop'), 'Test Two Drop')).toBe(true);
    expect(run(['p2', 'p3'], 'Test Three Drop')).toBe('illegal');
  });
  it('two creatures attacking the same player count that player once (X = 1)', () => {
    expect(run(['p2', 'p2'], 'Test Two Drop')).toBe('illegal');
    expect(back(run(['p2', 'p2'], 'Test One Drop'), 'Test One Drop')).toBe(true);
  });
});
