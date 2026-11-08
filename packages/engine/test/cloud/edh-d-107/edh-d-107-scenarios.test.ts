/**
 * Round edh-d-107 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups graveyard 1/3 and 2/3): the new readings played through the engine with synthetic cards (invented names,
 * design 6.10), each test named after the rule it checks, with its negative case. CR cites checked against the Comprehensive Rules of 2026-09-25; Scryfall rulings named where used.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, legalActions, type CardDef, type GameState, type OracleCard } from '../../../src/index';
import { act, answer, cast, drive, find, lands, resolveTop, scenario } from '../../m6/dfc/support';
import { activate } from '../../m5/cr-examples/helpers';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: o.colors ?? [], keywords: [], ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full';
const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const namesIn = (s: GameState, zone: 'graveyard' | 'exile' | 'hand' | 'battlefield' | 'library', p?: 'p1' | 'p2'): string[] =>
  (zone === 'battlefield' || zone === 'exile' ? s.zones[zone] : s.zones[zone][p ?? 'p1'] ?? []).filter((id) => p === undefined || zone === 'graveyard' || zone === 'hand' || zone === 'library' || s.objects[id]!.owner === p).map((id) => nameOf(s, id));
const activations = (s: GameState, source: string): ReturnType<typeof legalActions> => legalActions(s, 'p1').filter((a) => a.kind === 'activate' && !a.isMana && a.object === source);
/** Answer every pending choice of objects with the given ids (in order of the questions), the rest automatically; stops at priority. */
function settle(s0: GameState, picks: string[][] = []): GameState {
  let s = s0;
  const queue = [...picks];
  for (let i = 0; i < 60 && s.pending && s.pending.kind !== 'priority'; i++) {
    const p = s.pending;
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: queue.shift() ?? p.options.slice(0, p.min) });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((x) => x.id) });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else break;
  }
  return s;
}

const BEAR = card('Test Grave Bear', 'Creature — Bear', '', { pt: ['2', '2'] });
const ELK = card('Test Grave Elk', 'Creature — Elk', '', { pt: ['3', '3'] });
const ROCK = card('Test Plain Rock', 'Artifact', '');

// --- Night Soil: "{1}, Exile two creature cards from a single graveyard: Create a 1/1 green Saproling creature token." ---
const PIT = card('Test Compost Pit', 'Enchantment', '{1}, Exile two creature cards from a single graveyard: Create a 1/1 green Saproling creature token.');

describe('Night Soil: a cost that exiles two creature cards from a single graveyard (CR 118.3, 404.1, 602.2b; ruling 2008-10-01)', () => {
  it('is fully automated', () => expect(full(PIT)).toBe(true));
  it('CR 118.3: two creature cards of an opponent\'s graveyard pay it; the token is created', () => {
    let s = scenario(['Plains'], { defs: [PIT, BEAR, ELK, ROCK], p1: { battlefield: ['Test Compost Pit', 'Plains'], graveyard: ['Test Grave Bear'] }, p2: { graveyard: ['Test Grave Elk', 'Test Grave Bear', 'Test Plain Rock'] } });
    const pit = find(s, 'Test Compost Pit', 'battlefield', 'p1');
    expect(activations(s, pit)).toHaveLength(1);
    s = settle(act(s, activations(s, pit)[0]!.action));
    expect(namesIn(s, 'graveyard', 'p2')).toEqual(['Test Plain Rock']); // the two creature cards of the one graveyard that has two
    expect(namesIn(s, 'graveyard', 'p1')).toEqual(['Test Grave Bear']);
    const before = s.zones.battlefield.length;
    s = resolveTop(s);
    expect(s.zones.battlefield.length).toBe(before + 1); // the Saproling token
  });
  it('negative (ruling 2008-10-01): one creature card in each graveyard can\'t pay it: no graveyard has two', () => {
    const s = scenario(['Plains'], { defs: [PIT, BEAR, ELK], p1: { battlefield: ['Test Compost Pit', 'Plains'], graveyard: ['Test Grave Bear'] }, p2: { graveyard: ['Test Grave Elk'] } });
    expect(activations(s, find(s, 'Test Compost Pit', 'battlefield', 'p1'))).toHaveLength(0);
  });
  it('negative (CR 118.3): a card of another graveyard than the one the other card comes from is never offered', () => {
    const s = scenario(['Plains'], { defs: [PIT, BEAR, ELK], p1: { battlefield: ['Test Compost Pit', 'Plains'], graveyard: ['Test Grave Bear', 'Test Grave Elk', 'Test Grave Bear'] }, p2: { graveyard: ['Test Grave Elk'] } });
    const theirs = find(s, 'Test Grave Elk', 'graveyard', 'p2');
    let t = act(s, activations(s, find(s, 'Test Compost Pit', 'battlefield', 'p1'))[0]!.action);
    if (t.pending?.kind === 'payCost') t = answer(t, { kind: 'payCost', auto: true });
    expect(t.pending?.kind, JSON.stringify(t.pending)).toBe('chooseObjects');
    const options = (t.pending as { options: string[] }).options;
    expect(options).toHaveLength(3); // p1's three creature cards: p2's one creature card can't be paired with a card of its own graveyard
    expect(options).not.toContain(theirs);
    t = settle(t);
    expect(namesIn(t, 'graveyard', 'p2')).toEqual(['Test Grave Elk']);
    expect(namesIn(t, 'graveyard', 'p1')).toHaveLength(1);
  });
});

// --- Thelon of Havenwood: "{B}{G}, Exile a Fungus card from a graveyard: Put a spore counter on each Fungus on the battlefield." ---
const THELON = card('Test Spore Keeper', 'Creature — Elf Druid', '{1}, Exile a Fungus card from a graveyard: Put a spore counter on each Fungus on the battlefield.', { pt: ['2', '2'] });
const FUNGUS = card('Test Cap Fungus', 'Creature — Fungus', '', { pt: ['1', '1'] });

describe('Thelon of Havenwood: a cost that exiles a Fungus card from any graveyard; a counter on each Fungus on the battlefield (CR 118.3, 404.1, 110.1)', () => {
  it('is fully automated', () => expect(full(THELON)).toBe(true));
  it('CR 118.3, 110.1: an opponent\'s Fungus card pays; every Fungus of every player gets a spore counter, nothing else does', () => {
    let s = scenario(['Plains'], { defs: [THELON, FUNGUS, BEAR], p1: { battlefield: ['Test Spore Keeper', 'Test Cap Fungus', 'Test Grave Bear', 'Plains'] }, p2: { battlefield: ['Test Cap Fungus'], graveyard: ['Test Cap Fungus'] } });
    const k = find(s, 'Test Spore Keeper', 'battlefield', 'p1');
    s = resolveTop(settle(act(s, activations(s, k)[0]!.action)));
    expect(namesIn(s, 'exile')).toEqual(['Test Cap Fungus']);
    const spores = s.zones.battlefield.map((id) => [nameOf(s, id), s.objects[id]!.counters?.['spore'] ?? 0] as const);
    expect(spores.filter(([n]) => n === 'Test Cap Fungus').map(([, c]) => c)).toEqual([1, 1]);
    expect(spores.filter(([n]) => n !== 'Test Cap Fungus').every(([, c]) => c === 0)).toBe(true);
  });
  it('negative: with no Fungus card in any graveyard the ability is not offered', () => {
    const s = scenario(['Plains'], { defs: [THELON, FUNGUS, BEAR], p1: { battlefield: ['Test Spore Keeper', 'Plains'], graveyard: ['Test Grave Bear'] }, p2: { battlefield: ['Test Cap Fungus'] } });
    expect(activations(s, find(s, 'Test Spore Keeper', 'battlefield', 'p1'))).toHaveLength(0);
  });
});

// --- Spinning Darkness: "You may exile the top three black cards of your graveyard rather than pay this spell's mana cost." ---
const DARK = card('Test Night Coil', 'Instant', "You may exile the top three black cards of your graveyard rather than pay this spell's mana cost.\n~ deals 3 damage to target nonblack creature. You gain 3 life.", { cost: '{4}{B}{B}', colors: ['B'] });
const B1 = card('Test Ink One', 'Creature — Shade', '', { pt: ['1', '1'], cost: '{B}', colors: ['B'] });
const B2 = card('Test Ink Two', 'Creature — Shade', '', { pt: ['1', '1'], cost: '{B}', colors: ['B'] });
const B3 = card('Test Ink Three', 'Creature — Shade', '', { pt: ['1', '1'], cost: '{B}', colors: ['B'] });
const B4 = card('Test Ink Four', 'Creature — Shade', '', { pt: ['1', '1'], cost: '{B}', colors: ['B'] });
const RED = card('Test Ember Pup', 'Creature — Dog', '', { pt: ['1', '1'], cost: '{R}', colors: ['R'] });

describe('Spinning Darkness: an alternative cost that exiles the top three black cards of your graveyard (CR 404.2, 118.3; rulings 2008-04-01)', () => {
  it('is fully automated', () => expect(full(DARK)).toBe(true));
  it('CR 404.2: the three black cards put there last are exiled (the red card above them and the black card under them stay); nothing is chosen', () => {
    let s = scenario([], { defs: [DARK, B1, B2, B3, B4, RED, BEAR], p1: { hand: ['Test Night Coil'], graveyard: ['Test Ink One', 'Test Ink Two', 'Test Ink Three', 'Test Ember Pup', 'Test Ink Four'] }, p2: { battlefield: ['Test Grave Bear'] } });
    const la = legalActions(s, 'p1').find((a) => a.kind === 'cast' && /exile|alternative|rather/i.test(a.label));
    expect(la, legalActions(s, 'p1').map((a) => a.label).join(' | ')).toBeDefined();
    s = drive(act(s, la!.action), [{ kind: 'chooseTargets', targets: [{ kind: 'object', id: find(s, 'Test Grave Bear', 'battlefield', 'p2') }] }]);
    s = settle(s);
    expect(namesIn(s, 'exile').sort()).toEqual(['Test Ink Four', 'Test Ink Three', 'Test Ink Two']);
    expect(namesIn(s, 'graveyard', 'p1')).toEqual(['Test Ink One', 'Test Ember Pup']);
  });
  it('negative (CR 118.3): with only two black cards in your graveyard the alternative cost can\'t be paid', () => {
    const s = scenario([], { defs: [DARK, B1, B2, RED, BEAR], p1: { hand: ['Test Night Coil'], graveyard: ['Test Ink One', 'Test Ember Pup', 'Test Ink Two'] }, p2: { battlefield: ['Test Grave Bear'] } });
    expect(legalActions(s, 'p1').filter((a) => a.kind === 'cast')).toHaveLength(0);
  });
});

// --- Gather the Pack / See the Unwritten: "If C, put up to two creature cards from among the revealed cards into your hand instead of one." ---
const PACK = card('Test Pack Call', 'Sorcery', 'Reveal the top four cards of your library. You may put a creature card from among them into your hand. Put the rest into your graveyard.\nIf there are two or more instant and/or sorcery cards in your graveyard, put up to two creature cards from among the revealed cards into your hand instead of one.');
const UNWRIT = card('Test Unwritten Gate', 'Sorcery', 'Reveal the top four cards of your library. You may put a creature card from among them onto the battlefield. Put the rest into your graveyard.\nIf you control a creature with power 4 or greater, you may put two creature cards onto the battlefield instead of one.');
const BOLT = card('Test Spark Bolt', 'Instant', 'You gain 1 life.');
const OGRE = card('Test Big Ogre', 'Creature — Ogre', '', { pt: ['4', '4'] });

describe('Gather the Pack and See the Unwritten: a dig that chooses up to two instead of one when a condition holds as it resolves (CR 608.2c, 614.15, 701.20a; rulings 2015-06-22, 2014-09-20)', () => {
  it('both are fully automated', () => { expect(full(PACK)).toBe(true); expect(full(UNWRIT)).toBe(true); });
  const lib = ['Test Grave Bear', 'Test Grave Elk', 'Test Plain Rock', 'Test Grave Bear'];
  it('CR 614.15 (ruling 2015-06-22): with two instants in the graveyard two creature cards may go to the hand; the rest goes to the graveyard', () => {
    let s = scenario([], { defs: [PACK, BEAR, ELK, ROCK, BOLT], p1: { hand: ['Test Pack Call'], library: lib, graveyard: ['Test Spark Bolt', 'Test Spark Bolt'] } });
    s = cast(s, 'Test Pack Call');
    s = drive(s);
    let t = resolveTop(s);
    expect(t.pending).toMatchObject({ kind: 'chooseObjects', max: 2 });
    const opts = (t.pending as { options: string[] }).options;
    t = settle(answer(t, { kind: 'chooseObjects', ids: opts.slice(0, 2) }));
    expect(namesIn(t, 'hand', 'p1')).toHaveLength(2);
    expect(namesIn(t, 'graveyard', 'p1').filter((n) => n !== 'Test Spark Bolt' && n !== 'Test Pack Call')).toHaveLength(2);
  });
  it('negative: with one instant in the graveyard only one creature card may be chosen', () => {
    let s = scenario([], { defs: [PACK, BEAR, ELK, ROCK, BOLT], p1: { hand: ['Test Pack Call'], library: lib, graveyard: ['Test Spark Bolt'] } });
    s = drive(cast(s, 'Test Pack Call'));
    const t = resolveTop(s);
    expect(t.pending).toMatchObject({ kind: 'chooseObjects', max: 1 });
  });
  it('CR 614.15 (ruling 2014-09-20): with a creature of power 4 or greater two creature cards may be put onto the battlefield; without one, only one', () => {
    let s = scenario([], { defs: [UNWRIT, BEAR, ELK, ROCK, OGRE], p1: { hand: ['Test Unwritten Gate'], library: lib, battlefield: ['Test Big Ogre'] } });
    s = drive(cast(s, 'Test Unwritten Gate'));
    let t = resolveTop(s);
    expect(t.pending).toMatchObject({ kind: 'chooseObjects', max: 2 });
    t = settle(answer(t, { kind: 'chooseObjects', ids: (t.pending as { options: string[] }).options.slice(0, 2) }));
    expect(namesIn(t, 'battlefield', 'p1').filter((n) => n === 'Test Grave Bear' || n === 'Test Grave Elk')).toHaveLength(2);
    let u = scenario([], { defs: [UNWRIT, BEAR, ELK, ROCK], p1: { hand: ['Test Unwritten Gate'], library: lib, battlefield: ['Test Grave Bear'] } });
    u = resolveTop(drive(cast(u, 'Test Unwritten Gate')));
    expect(u.pending).toMatchObject({ kind: 'chooseObjects', max: 1 });
  });
});

// --- Glint Raker: "Put an artifact card revealed this way into your hand and the rest into your graveyard." ---
const RAKE = card('Test Glint Rake', 'Sorcery', 'Reveal the top three cards of your library. Put an artifact card revealed this way into your hand and the rest into your graveyard.');

describe('Glint Raker: an artifact card revealed this way into your hand, the rest into your graveyard (CR 701.20a, 608.2c)', () => {
  it('is fully automated', () => expect(full(RAKE)).toBe(true));
  it('CR 701.20a: the one artifact card among the revealed cards goes to the hand; the others to the graveyard', () => {
    let s = scenario([], { defs: [RAKE, BEAR, ROCK, ELK], p1: { hand: ['Test Glint Rake'], library: ['Test Grave Bear', 'Test Plain Rock', 'Test Grave Elk', 'Test Grave Bear'] } });
    s = settle(resolveTop(drive(cast(s, 'Test Glint Rake'))));
    expect(namesIn(s, 'hand', 'p1')).toEqual(['Test Plain Rock']);
    expect(namesIn(s, 'graveyard', 'p1').sort()).toEqual(['Test Glint Rake', 'Test Grave Bear', 'Test Grave Elk'].sort());
    expect(namesIn(s, 'library', 'p1')[0]).toBe('Test Grave Bear'); // the fourth card was not revealed
  });
  it('negative: with no artifact card revealed all three go to the graveyard', () => {
    let s = scenario([], { defs: [RAKE, BEAR, ELK], p1: { hand: ['Test Glint Rake'], library: ['Test Grave Bear', 'Test Grave Elk', 'Test Grave Bear', 'Test Grave Elk'] } });
    s = settle(resolveTop(drive(cast(s, 'Test Glint Rake'))));
    expect(namesIn(s, 'hand', 'p1')).toEqual([]);
    expect(namesIn(s, 'graveyard', 'p1')).toHaveLength(4);
  });
});

// --- Egon, God of Death: "exile two cards from your graveyard. If you can't, sacrifice Egon and draw a card." ---
const EGON = card('Test Toll Rite', 'Sorcery', "Exile two cards from your graveyard. If you can't, draw a card.");

describe('Egon, God of Death: "exile two cards from your graveyard. If you can\'t" exiles all or none (CR 608.2d, 609.3, 118.12; rulings 2021-02-05)', () => {
  it('is fully automated', () => expect(full(EGON)).toBe(true));
  it('ruling 2021-02-05: with one card in the graveyard it is not exiled, and the player draws', () => {
    let s = scenario([], { defs: [EGON, BEAR], p1: { hand: ['Test Toll Rite'], graveyard: ['Test Grave Bear'] } });
    const hand = (s.zones.hand.p1 ?? []).length;
    s = settle(resolveTop(drive(cast(s, 'Test Toll Rite'))));
    expect(namesIn(s, 'graveyard', 'p1')).toEqual(['Test Grave Bear', 'Test Toll Rite']);
    expect(namesIn(s, 'exile')).toEqual([]);
    expect((s.zones.hand.p1 ?? []).length).toBe(hand); // the spell left the hand, a card was drawn
  });
  it('negative (ruling 2021-02-05): with three cards there, two of them are exiled and nothing is drawn', () => {
    let s = scenario([], { defs: [EGON, BEAR, ELK], p1: { hand: ['Test Toll Rite'], graveyard: ['Test Grave Bear', 'Test Grave Elk', 'Test Grave Bear'] } });
    const hand = (s.zones.hand.p1 ?? []).length;
    s = settle(resolveTop(drive(cast(s, 'Test Toll Rite'))));
    expect(namesIn(s, 'exile')).toHaveLength(2);
    expect((s.zones.hand.p1 ?? []).length).toBe(hand - 1);
  });
});

// --- Bone Dancer: "the top creature card of defending player's graveyard" (another player's graveyard) ---
const DANCER = card('Test Grave Dancer', 'Artifact', "{T}: You may put the top creature card of target opponent's graveyard onto the battlefield under your control.");

describe('Bone Dancer: the top creature card of another player\'s graveyard (CR 404.1, 401.2; rulings 2008-04-01)', () => {
  it('is fully automated', () => expect(full(DANCER)).toBe(true));
  it('CR 404.1: the creature card put into that graveyard last comes under your control; a card above it that is not a creature stays', () => {
    let s = scenario([], { defs: [DANCER, BEAR, ELK, ROCK], p1: { battlefield: ['Test Grave Dancer'] }, p2: { graveyard: ['Test Grave Bear', 'Test Grave Elk', 'Test Plain Rock'] } });
    s = activate(s, find(s, 'Test Grave Dancer', 'battlefield', 'p1'), [{ kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] }]);
    s = settle(resolveTop(s));
    const elk = s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Grave Elk');
    expect(elk).toBeDefined();
    expect(s.objects[elk!]!.controller).toBe('p1');
    expect(namesIn(s, 'graveyard', 'p2')).toEqual(['Test Grave Bear', 'Test Plain Rock']);
  });
  it('negative: with no creature card in that graveyard nothing comes back', () => {
    let s = scenario([], { defs: [DANCER, ROCK], p1: { battlefield: ['Test Grave Dancer'] }, p2: { graveyard: ['Test Plain Rock'] } });
    s = activate(s, find(s, 'Test Grave Dancer', 'battlefield', 'p1'), [{ kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] }]);
    s = settle(resolveTop(s));
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.owner === 'p2')).toHaveLength(0);
  });
});

// --- Nezumi Graverobber: "Exile target card from an opponent's graveyard. If no cards are in that graveyard, ..." ---
const ROBBER = card('Test Tomb Rat', 'Artifact', "{T}: Exile target card from an opponent's graveyard. If no cards are in that graveyard, draw a card.");

describe('Nezumi Graverobber: "if no cards are in that graveyard" reads the target card\'s owner\'s graveyard after the exile (CR 404.1, 608.2c)', () => {
  it('is fully automated', () => expect(full(ROBBER)).toBe(true));
  it('CR 608.2c: exiling the last card of that graveyard meets the condition', () => {
    let s = scenario([], { defs: [ROBBER, BEAR], p1: { battlefield: ['Test Tomb Rat'], graveyard: ['Test Grave Bear'] }, p2: { graveyard: ['Test Grave Bear'] } });
    const hand = (s.zones.hand.p1 ?? []).length;
    s = activate(s, find(s, 'Test Tomb Rat', 'battlefield', 'p1'), [{ kind: 'chooseTargets', targets: [{ kind: 'object', id: find(s, 'Test Grave Bear', 'graveyard', 'p2') }] }]);
    s = settle(resolveTop(s));
    expect((s.zones.hand.p1 ?? []).length).toBe(hand + 1); // your own graveyard is not that graveyard
  });
  it('negative: a card left in that graveyard means no draw', () => {
    let s = scenario([], { defs: [ROBBER, BEAR, ELK], p1: { battlefield: ['Test Tomb Rat'] }, p2: { graveyard: ['Test Grave Bear', 'Test Grave Elk'] } });
    const hand = (s.zones.hand.p1 ?? []).length;
    s = activate(s, find(s, 'Test Tomb Rat', 'battlefield', 'p1'), [{ kind: 'chooseTargets', targets: [{ kind: 'object', id: find(s, 'Test Grave Bear', 'graveyard', 'p2') }] }]);
    s = settle(resolveTop(s));
    expect((s.zones.hand.p1 ?? []).length).toBe(hand);
  });
});

// --- Estrid, the Masked: "Return all non-Aura enchantment cards from your graveyard to the battlefield, then do the same for Aura cards." ---
const MASK = card('Test Mask Rite', 'Sorcery', 'Return all non-Aura enchantment cards from your graveyard to the battlefield, then do the same for Aura cards.');
const SHRINE = card('Test Quiet Shrine', 'Enchantment', '');
const VEIL = card('Test Veil Charm', 'Enchantment — Aura', 'Enchant enchantment');

describe('Estrid, the Masked: the non-Aura enchantments return first, then the Auras, which may enchant them (CR 608.2c, 303.4f; rulings 2018-07-13)', () => {
  it('is fully automated', () => expect(full(MASK)).toBe(true));
  it('ruling 2018-07-13: an Aura returned second may enchant an enchantment returned first', () => {
    let s = scenario([], { defs: [MASK, SHRINE, VEIL], p1: { hand: ['Test Mask Rite'], graveyard: ['Test Quiet Shrine', 'Test Veil Charm'] } });
    s = settle(resolveTop(drive(cast(s, 'Test Mask Rite'))));
    const shrine = s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Quiet Shrine');
    const veil = s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Veil Charm');
    expect(shrine).toBeDefined();
    expect(veil).toBeDefined();
    expect(s.objects[veil!]!.attachedTo).toBe(shrine);
  });
  it('negative (ruling 2018-07-13): an Aura that can enchant nothing stays in the graveyard', () => {
    let s = scenario([], { defs: [MASK, VEIL], p1: { hand: ['Test Mask Rite'], graveyard: ['Test Veil Charm'] } });
    s = settle(resolveTop(drive(cast(s, 'Test Mask Rite'))));
    expect(namesIn(s, 'graveyard', 'p1')).toContain('Test Veil Charm');
  });
});
