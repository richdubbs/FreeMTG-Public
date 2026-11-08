/**
 * edh-e-36 scenarios (Commander coordinator E, second batch, group exile-play; code edhe36): each new reading played through the engine with synthetic cards (invented names
 * and wordings, design 6.10), with its negative case. Nothing is mocked. Rules (Comprehensive Rules 2026-09-25; cites from memory where the real text was not read, listed in the record):
 *   CR 611.2c, 508.1a, 305.1, 601.3   "During any turn you attacked with this creature, you may play that card" / "... with three or more creatures ..." (Goblin Researcher, Boros Strike-Captain)
 *   CR 609.4b, 107.4e, 601.3, 401.2   "exile the top card of their library. During any turn you attacked with a Rogue, you may cast that card and you may spend mana as though it were mana of any color" (Robber of the Rich)
 *   CR 607.2a, 601.3                  "You may cast spells from among cards exiled with ~" with several abilities that exile (Rona, Disciple of Gix)
 *   CR 607.2a, 608.2c, 601.3          "Choose a card exiled with ~. You may play that card this turn." (Muse Vessel)
 *   CR 613.1f, 607.2a                 "~ has flying as long as a card exiled with it has flying. The same is true for ..." (Urborg Scavengers, Death-Mask Duplicant)
 *   CR 613.1f, 602.1, 607.2a          "~ has all activated abilities of all creature cards exiled with it" (Dark Impostor, Patchwork Crawler)
 */
import { describe, expect, it } from 'vitest';
import { getChars, legalActions, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act, advanceTo, answer, card, drive, find, full, legal, resolveAll, scenario } from '../r3-cost/support';
import { activate, castFrom, castable, exiled } from '../edh-next-62/support';

const passTo = (s0: GameState, kind: 'declareAttackers' | 'declareBlockers'): GameState => {
  let s = s0;
  for (let i = 0; i < 60 && s.pending?.kind !== kind; i++) s = act(s, { type: 'pass', player: s.pending!.player });
  if (s.pending?.kind !== kind) throw new Error(`never reached ${kind}`);
  return s;
};
const attackWith = (s: GameState, ids: ObjectId[]): GameState => resolveAll(answer(s, { kind: 'declareAttackers', attacks: ids.map((attacker) => ({ attacker, defender: 'p2' as const })) }));
/** Pass to the second main phase of turn `n` (no blockers). */
const toMain2 = (s0: GameState, n: number): GameState => {
  let s = s0;
  for (let i = 0; i < 200 && !(s.turn.number === n && s.turn.step === 'main2'); i++) s = s.pending?.kind === 'declareBlockers' ? answer(s, { kind: 'declareBlockers', blocks: [] }) : act(s, { type: 'pass', player: s.pending!.player });
  return s;
};
const usable = (s: GameState, id: ObjectId, player: PlayerId = 'p1'): boolean => legalActions(s, player).some((a) => a.object === id && (a.kind === 'playLand' || a.kind === 'cast'));
const kw = (s: GameState, name: string): string[] => getChars(s, find(s, name, 'battlefield', 'p1')).keywords.map((k) => k.keyword).sort();
const s0 = (x: GameState): GameState => x;
const abilitiesOf = (s: GameState, id: ObjectId): string[] => legal(s, 'p1', 'activate').filter((a) => a.object === id).map((a) => JSON.stringify(a.action));

describe('CR 611.2c, 508.1a, 305.1: "During any turn you attacked with this creature, you may play that card" (Goblin Researcher)', () => {
  const PILFER = card('Test Pilferer', 'Creature — Goblin', 'When this creature enters, exile the top card of your library. During any turn you attacked with this creature, you may play that card.', '{0}', ['2', '2']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{1}{G}', ['2', '2'], ['G']);
  const MEADOW = card('Test Meadow', 'Land', '', '');
  const defs = [PILFER, BEAR, MEADOW];
  const start = (): GameState => scenario([], { defs, p1: { hand: ['Test Pilferer'], battlefield: [{ name: 'Test Bear', since: -1 }], library: ['Test Meadow', 'Test Meadow', 'Test Meadow'] } } as never);
  const played = (): GameState => {
    let s = start();
    s = resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Pilferer', 'hand', 'p1') }));
    return s;
  };
  it('is automated', () => { expect(full(PILFER)).toBe(true); });
  it('the exiled card is not playable on the turn it was exiled (no attack with this creature yet), nor on a turn another creature attacked alone; it is on a turn this creature attacked', () => {
    let s = played();
    const meadow = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Meadow')!;
    expect(meadow).toBeDefined();
    expect(usable(s, meadow)).toBe(false);
    // turn 3: the Bear attacks alone: still nothing (the permission needs an attack by THIS creature)
    s = advanceTo(s, 3, 'main1');
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [find(s, 'Test Bear', 'battlefield', 'p1')]);
    s = toMain2(s, 3);
    expect(usable(s, meadow)).toBe(false);
    // turn 5: this creature attacks: the card may be played in that turn
    s = advanceTo(s, 5, 'main1');
    expect(usable(s, meadow)).toBe(false);
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [find(s, 'Test Pilferer', 'battlefield', 'p1')]);
    s = toMain2(s, 5);
    expect(usable(s, meadow)).toBe(true);
    // turn 7: no attack by it again: the permission is not used up, but it does not hold in a turn without the attack
    s = advanceTo(s, 7, 'main1');
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [find(s, 'Test Bear', 'battlefield', 'p1')]);
    s = toMain2(s, 7);
    expect(usable(s, meadow)).toBe(false);
  });
});

describe('CR 611.2c, 400.7, 508.1a: Goblin Researcher rulings 2022-12-02: the exiled card may be played in a turn this creature attacked even after it left the battlefield; two of them are independent', () => {
  const PILFER = card('Test Pilferer', 'Creature — Goblin', 'When this creature enters, exile the top card of your library. During any turn you attacked with this creature, you may play that card.', '{0}', ['2', '2']);
  const ALTAR = card('Test Altar', 'Artifact', '{0}, Sacrifice a creature: You gain 1 life.');
  const MEADOW = card('Test Meadow', 'Land', '', '');
  const defs = [PILFER, ALTAR, MEADOW];
  it('after it attacked and was sacrificed the card is still playable that turn; a second copy that did not attack gives nothing for its own card', () => {
    let s = scenario([], { defs, p1: { hand: ['Test Pilferer', 'Test Pilferer'], battlefield: ['Test Altar'], library: Array.from({ length: 8 }, () => 'Test Meadow') } } as never);
    s = resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Pilferer', 'hand', 'p1') }));
    const first = s.zones.battlefield.find((id) => s.objects[id]!.defId === 'Test Pilferer')!;
    const firstCard = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Meadow')!;
    s = resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Pilferer', 'hand', 'p1') }));
    const secondCard = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Meadow' && id !== firstCard)!;
    expect(secondCard).toBeDefined();
    s = advanceTo(s, 3, 'main1');
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [first]);
    s = toMain2(s, 3);
    expect(usable(s, firstCard)).toBe(true);
    expect(usable(s, secondCard)).toBe(false); // the other copy did not attack (each one's effect is independent)
    const altar = find(s, 'Test Altar', 'battlefield', 'p1');
    const sac = legal(s, 'p1', 'activate').find((a) => a.object === altar)!;
    s = resolveAll(drive(act(s, sac.action), { objects: [[first]] }));
    expect(s.zones.battlefield.includes(first)).toBe(false);
    expect(usable(s, firstCard)).toBe(true);
  });
});

describe('CR 508.1a, 611.2c: an opponent attacking with a Goblin Researcher you own does not count as "you attacked with this creature"', () => {
  const PILFER = card('Test Pilferer', 'Creature — Goblin', 'When this creature enters, exile the top card of your library. During any turn you attacked with this creature, you may play that card.', '{0}', ['2', '2']);
  const SNATCH = card('Test Snatch', 'Sorcery', 'Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.', '{0}');
  const MEADOW = card('Test Meadow', 'Land', '', '');
  it('p2 steals it and attacks with it: the exiled card is not playable by p1', () => {
    let s = scenario([], { defs: [PILFER, SNATCH, MEADOW], p1: { hand: ['Test Pilferer'], library: Array.from({ length: 8 }, () => 'Test Meadow') }, p2: { hand: ['Test Snatch'] } } as never);
    s = resolveAll(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Pilferer', 'hand', 'p1') }));
    const meadow = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Meadow')!;
    const pil = find(s, 'Test Pilferer', 'battlefield', 'p1');
    s = advanceTo(s, 2, 'main1');
    s = resolveAll(drive(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Snatch', 'hand', 'p2') }), { targets: [[{ kind: 'object', id: pil }]] }));
    s = passTo(s, 'declareAttackers');
    s = resolveAll(answer(s, { kind: 'declareAttackers', attacks: [{ attacker: pil, defender: 'p1' as const }] }));
    expect(usable(s, meadow, 'p1')).toBe(false);
  });
});

describe('CR 611.2c, 508.1a, 305.1: "During any turn you attacked with three or more creatures, you may play that card" (Boros Strike-Captain)', () => {
  const CAPT = card('Test Banner Captain', 'Creature — Human Soldier', 'Whenever this creature attacks, exile the top card of your library. During any turn you attacked with three or more creatures, you may play that card.', '{0}', ['2', '2']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', '{1}{G}', ['2', '2'], ['G']);
  const MEADOW = card('Test Meadow', 'Land', '', '');
  const defs = [CAPT, BEAR, MEADOW];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: [{ name: 'Test Banner Captain', since: -1 }, { name: 'Test Bear', since: -1 }, { name: 'Test Bear', since: -1 }], library: Array.from({ length: 8 }, () => 'Test Meadow') } } as never);
  it('is automated', () => { expect(full(CAPT)).toBe(true); });
  it('attacking with two creatures does not allow it; a later turn with three attackers allows the card exiled earlier too (the permission has no end)', () => {
    let s = start();
    s = advanceTo(s, 3, 'main1');
    s = passTo(s, 'declareAttackers');
    const bears = s.zones.battlefield.filter((id) => s.objects[id]!.defId === 'Test Bear');
    s = attackWith(s, [find(s, 'Test Banner Captain', 'battlefield', 'p1'), bears[0]!]);
    const first = s.zones.exile.find((id) => s.objects[id]!.defId === 'Test Meadow')!;
    expect(first).toBeDefined();
    s = toMain2(s, 3);
    expect(usable(s, first)).toBe(false);
    s = advanceTo(s, 5, 'main1');
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [find(s, 'Test Banner Captain', 'battlefield', 'p1'), ...bears]);
    s = toMain2(s, 5);
    expect(usable(s, first)).toBe(true);
    expect(s.zones.exile.filter((id) => s.objects[id]!.defId === 'Test Meadow')).toHaveLength(2);
  });
});

describe('CR 609.4b, 601.3, 508.1a: "exile the top card of their library. During any turn you attacked with a Rogue, you may cast that card and you may spend mana as though it were mana of any color" (Robber of the Rich)', () => {
  const ROBBER = card('Test Cutpurse', 'Creature — Human Rogue', 'Whenever this creature attacks, if defending player has more cards in hand than you, exile the top card of their library. During any turn you attacked with a Rogue, you may cast that card and you may spend mana as though it were mana of any color to cast that spell.', '{0}', ['2', '2']);
  const IMP = card('Test Red Imp', 'Creature — Imp', '', '{R}', ['1', '1'], ['R']);
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['1', '1']);
  const defs = [ROBBER, IMP, OX];
  const start = (p1Hand: string[] = []): GameState => scenario([], { defs, p1: { hand: p1Hand, battlefield: [{ name: 'Test Cutpurse', since: -1 }, 'Plains'] }, p2: { hand: ['Test Ox'], library: ['Test Red Imp', 'Test Red Imp'] } } as never);
  it('is automated', () => { expect(full(ROBBER)).toBe(true); });
  it("the opponent's top card is exiled when they have more cards in hand; on a turn you attacked with a Rogue it can be cast with white mana, and not on a turn you did not", () => {
    let s = advanceTo(start(), 3, 'main1');
    s = passTo(s, 'declareAttackers');
    const libBefore = s.zones.library.p2!.length;
    s = attackWith(s, [find(s, 'Test Cutpurse', 'battlefield', 'p1')]);
    const imp = exiled(s, 'Test Red Imp')[0]!;
    expect(imp).toBeDefined();
    expect(s.objects[imp]!.owner).toBe('p2');
    expect(s.zones.library.p2!.length).toBe(libBefore - 1);
    s = toMain2(s, 3);
    expect(castable(s)).toContain(imp);
    s = castFrom(s, imp);
    expect(s.zones.battlefield.some((id) => s.objects[id]!.defId === 'Test Red Imp' && s.objects[id]!.controller === 'p1')).toBe(true);
  });
  it('a turn without an attack by a Rogue: the exiled card cannot be cast (the permission holds only in a turn you attacked with a Rogue)', () => {
    let s = advanceTo(start(), 3, 'main1');
    s = passTo(s, 'declareAttackers');
    s = attackWith(s, [find(s, 'Test Cutpurse', 'battlefield', 'p1')]);
    const imp = exiled(s, 'Test Red Imp')[0]!;
    s = advanceTo(s, 5, 'main1');
    expect(castable(s)).not.toContain(imp);
  });
  it('the negative case (intervening "if"): with as many cards in hand as the defending player nothing is exiled', () => {
    let s = advanceTo(start(['Test Ox']), 3, 'main1');
    s = passTo(s, 'declareAttackers');
    const libBefore = s.zones.library.p2!.length;
    s = attackWith(s, [find(s, 'Test Cutpurse', 'battlefield', 'p1')]);
    expect(exiled(s, 'Test Red Imp')).toEqual([]);
    expect(s.zones.library.p2).toHaveLength(libBefore);
  });
});

describe('CR 607.2a, 601.3, 305.9: "You may cast spells from among cards exiled with ~" when several abilities exile (Rona, Disciple of Gix)', () => {
  const ARCHIVIST = card('Test Archivist', 'Creature — Human Wizard', '{0}: Exile the top card of your library.\n{0}: Exile target card from a graveyard.\nYou may cast spells from among cards exiled with this creature.', '{0}', ['2', '2']);
  const BANISHER = card('Test Banisher', 'Artifact', '{0}: Exile the top card of your library.');
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['1', '4']);
  const ELK = card('Test Elk', 'Creature — Elk', '', '{0}', ['2', '2']);
  const MEADOW = card('Test Meadow', 'Land', '', '');
  const defs = [ARCHIVIST, BANISHER, OX, ELK, MEADOW];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: ['Test Archivist', 'Test Banisher'], graveyard: ['Test Elk'], library: ['Test Ox', 'Test Meadow', 'Test Ox'] } } as never);
  it('is automated', () => { expect(full(ARCHIVIST)).toBe(true); });
  it('the card its top-of-library ability exiled and the card its graveyard ability exiled are both castable from exile; a land is not a spell; a card another object exiled is not', () => {
    let s = start();
    const arch = find(s, 'Test Archivist', 'battlefield', 'p1');
    s = activate(s, arch, 'p:0:0'); // top card: Test Ox
    const ox = exiled(s, 'Test Ox')[0]!;
    s = activate(s, arch, 'p:0:1', { targets: [[{ kind: 'object', id: find(s, 'Test Elk', 'graveyard', 'p1') }]] });
    const elk = exiled(s, 'Test Elk')[0]!;
    s = activate(s, arch, 'p:0:0'); // top card: Test Meadow
    const meadow = exiled(s, 'Test Meadow')[0]!;
    s = activate(s, find(s, 'Test Banisher', 'battlefield', 'p1'), 'p:0:0'); // top card: Test Ox, exiled by the other object
    const other = exiled(s, 'Test Ox').find((id) => id !== ox)!;
    const can = castable(s);
    expect(can).toContain(ox);
    expect(can).toContain(elk);
    expect(can).not.toContain(meadow);
    expect(can).not.toContain(other);
    expect(usable(s, meadow)).toBe(false);
  });
});

describe('CR 607.2a, 608.2c, 601.3: "Choose a card exiled with ~. You may play that card this turn." (Muse Vessel)', () => {
  const VESSEL = card('Test Muse Urn', 'Artifact', '{0}: Target player exiles a card from their hand.\n{0}: Choose a card exiled with this artifact. You may play that card this turn.');
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['1', '4']);
  const ELK = card('Test Elk', 'Creature — Elk', '', '{0}', ['2', '2']);
  const defs = [VESSEL, OX, ELK];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: ['Test Muse Urn'], hand: ['Test Ox', 'Test Elk'] } } as never);
  it('is automated', () => { expect(full(VESSEL)).toBe(true); });
  it('only the chosen card may be played, and only this turn; before choosing, the exiled cards may not be played', () => {
    let s = start();
    const urn = find(s, 'Test Muse Urn', 'battlefield', 'p1');
    s = activate(s, urn, 'p:0:0', { targets: [[{ kind: 'player', id: 'p1' }]], picks: [[find(s, 'Test Ox', 'hand', 'p1')]] });
    s = activate(s, urn, 'p:0:0', { targets: [[{ kind: 'player', id: 'p1' }]], picks: [[find(s, 'Test Elk', 'hand', 'p1')]] });
    const ox = exiled(s, 'Test Ox')[0]!;
    const elk = exiled(s, 'Test Elk')[0]!;
    expect(castable(s)).not.toContain(ox);
    expect(castable(s)).not.toContain(elk);
    s = activate(s, urn, 'p:0:1', { picks: [[ox]] });
    expect(castable(s)).toContain(ox);
    expect(castable(s)).not.toContain(elk);
    // "this turn": on the next turn of yours neither may be played
    s = advanceTo(s, 3, 'main1');
    expect(castable(s)).not.toContain(ox);
  });
});

describe('CR 613.1f, 607.2a, 702.9a: "~ has flying as long as a card exiled with it has flying. The same is true for ..." (Urborg Scavengers)', () => {
  const SCAV = card('Test Scavenger', 'Creature — Beast', '{0}: Exile target creature card from a graveyard.\nThis creature has flying as long as a card exiled with it has flying. The same is true for first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance.', '{0}', ['2', '2']);
  const HAWK = card('Test Sky Hawk', 'Creature — Bird', 'Flying\nTrample', '{0}', ['2', '2']);
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['1', '4']);
  const BANISH = card('Test Banisher', 'Artifact', '{0}: Exile target creature card from a graveyard.');
  const defs = [SCAV, HAWK, OX, BANISH];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: [{ name: 'Test Scavenger', since: -1 }, 'Test Banisher'], graveyard: ['Test Sky Hawk', 'Test Ox'] } } as never);
  it('is automated', () => { expect(full(SCAV)).toBe(true); });
  it('a vanilla card exiled with it gives nothing; a flying, trample card gives flying and trample; a card another object exiled gives nothing (CR 607.2a)', () => {
    let s = start();
    const scav = find(s, 'Test Scavenger', 'battlefield', 'p1');
    expect(kw(s, 'Test Scavenger')).toEqual([]);
    s = activate(s, find(s, 'Test Banisher', 'battlefield', 'p1'), 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Sky Hawk', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Scavenger')).toEqual([]);
    s = activate(s, scav, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Ox', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Scavenger')).toEqual([]);
  });
  it('the positive case', () => {
    let s = start();
    const scav = find(s, 'Test Scavenger', 'battlefield', 'p1');
    s = activate(s, scav, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Sky Hawk', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Scavenger')).toEqual(['flying', 'trample']);
  });
});

describe('CR 613.1f, 607.2a: "As long as a card exiled with ~ has flying, ~ has flying. The same is true for fear, first strike, double strike, haste, landwalk, protection, and trample." (Death-Mask Duplicant)', () => {
  const DUP = card('Test Mask Copier', 'Artifact Creature — Construct', '{0}: Exile target creature card from your graveyard.\nAs long as a card exiled with this creature has flying, this creature has flying. The same is true for fear, first strike, double strike, haste, landwalk, protection, and trample.', '{0}', ['2', '2']);
  const HAWK = card('Test Sky Hawk', 'Creature — Bird', 'Flying\nReach', '{0}', ['2', '2']);
  const OX = card('Test Ox', 'Creature — Ox', '', '{0}', ['1', '4']);
  const defs = [DUP, HAWK, OX];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: [{ name: 'Test Mask Copier', since: -1 }], graveyard: ['Test Sky Hawk', 'Test Ox'] } } as never);
  it('is automated', () => { expect(full(DUP)).toBe(true); });
  it('flying comes from the exiled Hawk, but reach is not in the list (the negative case); a vanilla card gives nothing', () => {
    let s = start();
    const dup = find(s, 'Test Mask Copier', 'battlefield', 'p1');
    s = activate(s, dup, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Ox', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Mask Copier')).toEqual([]);
    s = activate(s, dup, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Sky Hawk', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Mask Copier')).toEqual(['flying']);
  });
});

describe('CR 613.1f, 702.14a, 702.16, 702.118: the same list carries the exiled card\'s landwalk (with its land type), fear, haste and protection (with its quality) (Death-Mask Duplicant)', () => {
  const DUP = card('Test Mask Copier', 'Artifact Creature — Construct', '{0}: Exile target creature card from your graveyard.\nAs long as a card exiled with this creature has flying, this creature has flying. The same is true for fear, first strike, double strike, haste, landwalk, protection, and trample.', '{0}', ['2', '2']);
  const WALKER = card('Test Walker', 'Creature — Zombie', 'Swampwalk\nFear\nProtection from red\nHaste\nVigilance', '{0}', ['2', '2']);
  it('takes landwalk, fear, protection and haste, and not vigilance (not in this card\'s list)', () => {
    let s = scenario([], { defs: [DUP, WALKER], p1: { battlefield: [{ name: 'Test Mask Copier', since: -1 }], graveyard: ['Test Walker'] } } as never);
    s = activate(s, find(s, 'Test Mask Copier', 'battlefield', 'p1'), 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Walker', 'graveyard', 'p1') }]] });
    expect(kw(s, 'Test Mask Copier')).toEqual(['fear', 'haste', 'landwalk', 'protection']);
  });
});

describe('CR 613.1f, 602.1, 607.2a: "~ has all activated abilities of all creature cards exiled with it" (Dark Impostor, Patchwork Crawler)', () => {
  const IMP = card('Test Mimic Fiend', 'Creature — Shapeshifter', '{0}: Exile target card from a graveyard.\nThis creature has all activated abilities of all creature cards exiled with it.', '{0}', ['2', '2']);
  const HEALER = card('Test Healer', 'Creature — Cleric', '{0}: You gain 1 life.', '{0}', ['1', '1']);
  const RELIC = card('Test Healing Relic', 'Artifact', '{0}: You gain 2 life.');
  const defs = [IMP, HEALER, RELIC];
  const start = (): GameState => scenario([], { defs, p1: { battlefield: ['Test Mimic Fiend'], graveyard: ['Test Healer', 'Test Healing Relic'] } } as never);
  it('is automated', () => { expect(full(IMP)).toBe(true); });
  it('after exiling a creature card with an activated ability it has that ability; an artifact card exiled with it gives nothing', () => {
    let s = start();
    const imp = find(s, 'Test Mimic Fiend', 'battlefield', 'p1');
    const granted = (x: GameState): string[] => abilitiesOf(s0(x), imp).filter((a) => a.includes('g:live'));
    expect(granted(s)).toEqual([]);
    s = activate(s, imp, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Healing Relic', 'graveyard', 'p1') }]] });
    expect(granted(s)).toEqual([]); // an artifact card exiled with it: not a creature card
    s = activate(s, imp, 'p:0:0', { targets: [[{ kind: 'object', id: find(s, 'Test Healer', 'graveyard', 'p1') }]] });
    expect(granted(s)).toHaveLength(1); // the Healer's ability, granted (its own ability has no target left)
    const life = s.players.find((x) => x.id === 'p1')!.life;
    s = activate(s, imp, granted(s).map((a) => JSON.parse(a).ability as string)[0]!);
    expect(s.players.find((x) => x.id === 'p1')!.life).toBe(life + 1);
  });
});
