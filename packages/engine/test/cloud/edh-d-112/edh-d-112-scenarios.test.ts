/**
 * edh-d-112 (Commander coordinator D, groups counters 1/3 and 2/3): the round's readings played through the engine with synthetic cards compiled by the game's default
 * compiler (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. CR cites checked against
 * the Comprehensive Rules of 2026-09-25 (MagicCompRules 20260925.txt); Scryfall rulings of each card made full were read.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, legalActions, type CardDef, type GameState, type ObjectId, type PlayerId, type TargetChoice } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, answer, find } from '../../m3/scenario';
import { mpScenario, passUntil } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const pl = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;
const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const inZone = (s: GameState, name: string, zone: 'hand' | 'graveyard' | 'battlefield', p?: PlayerId): number =>
  (zone === 'battlefield' ? s.zones.battlefield : s.zones[zone][p!]!).filter((id) => nameOf(s, id) === name).length;

interface Script { numbers?: number[]; yes?: boolean[]; targets?: TargetChoice[][]; options?: string[][]; objects?: (string[] | ((options: string[], s: GameState) => string[]))[] }
/** Answer the decisions that come up until someone has priority. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: script.options?.shift() ?? p.options.slice(0, p.min).map((o) => o.id) });
    else if (p.kind === 'chooseObjects') { const pick = script.objects?.shift(); s = answer(s, { kind: 'chooseObjects', ids: typeof pick === 'function' ? pick(p.options as string[], s) : pick ?? (p.options as string[]).slice(0, p.min) }); }
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? p.min });
    else if (p.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
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

const counters = (s: GameState, name: string, kind = '+1/+1'): number => { const id = s.zones.battlefield.find((x) => nameOf(s, x) === name); return id === undefined ? -1 : (s.objects[id]!.counters?.[kind] ?? 0); };

// ---- Rescuer Sphinx: "As ~ enters, you may <cost>. If you do, ~ enters with a +1/+1 counter on it." -----------------------------------------------------------------

const RESCUER = card('Test Rescuer', 'Creature — Sphinx', "Flying\nAs this creature enters, you may return a nonland permanent you control to its owner's hand. If you do, this creature enters with a +1/+1 counter on it.", { pt: ['3', '2'] });
const TRINKET = card('Test Trinket', 'Artifact', '');
describe("CR 614.12a, 614.1c, 122.6: \"As ~ enters, you may return a nonland permanent you control to its owner's hand. If you do, ~ enters with a +1/+1 counter on it.\"", () => {
  const setup = (mine: string[] = ['Test Trinket']): GameState => mpScenario({ defs: [RESCUER, TRINKET], zones: { p1: { hand: ['Test Rescuer'], battlefield: mine.map((name) => ({ name })) }, p2: { battlefield: [{ name: 'Test Trinket' }] } } });
  it('is automated', () => expect(full(RESCUER)).toBe(true));
  it('the controller returns the artifact: it goes back to its owner\'s hand and the creature enters with one +1/+1 counter', () => {
    const s = cast(setup(), 'Test Rescuer', { yes: [true] });
    expect(counters(s, 'Test Rescuer')).toBe(1);
    expect(inZone(s, 'Test Trinket', 'hand', 'p1')).toBe(1);
    expect(inZone(s, 'Test Trinket', 'battlefield')).toBe(1); // the opponent's artifact stays: only a permanent you control can be returned
  });
  it('the controller declines: nothing returns and it enters with no counter (the negative case)', () => {
    const s = cast(setup(), 'Test Rescuer', { yes: [false] });
    expect(counters(s, 'Test Rescuer')).toBe(0);
    expect(inZone(s, 'Test Trinket', 'battlefield')).toBe(2);
  });
  it('with no nonland permanent of its controller to return (only lands), nothing is asked and no counter is put (the negative case)', () => {
    const s = cast(setup(['Plains']), 'Test Rescuer', { yes: [true] });
    expect(counters(s, 'Test Rescuer')).toBe(0);
    expect(inZone(s, 'Test Trinket', 'battlefield')).toBe(1);
  });
});
const idOn = (s: GameState, name: string, owner?: PlayerId): ObjectId => s.zones.battlefield.find((x) => nameOf(s, x) === name && (owner === undefined || s.objects[x]!.controller === owner))!;
const pt = (s: GameState, id: ObjectId): string => { const c = getChars(s, id)!; return `${c.power}/${c.toughness}`; };
const offeredOn = (s: GameState, id: ObjectId, player: PlayerId = 'p1'): { key: string; text: string }[] =>
  legalActions(s, player).filter((l) => l.kind === 'activate' && l.object === id).map((l) => ({ key: (l.action as { ability: string }).ability, text: l.label.replace(/^[^:]*: /, '') }));
const activateText = (s: GameState, id: ObjectId, text: RegExp, script: Script = {}, player: PlayerId = 'p1'): GameState => {
  const hit = offeredOn(s, id, player).find((x) => text.test(x.text));
  if (!hit) throw new Error(`no ability ${text} offered on ${id}: ${JSON.stringify(offeredOn(s, id, player))}`);
  return settle(drive(act(s, { type: 'activate', player, source: id, ability: hit.key } as never), script), script);
};

// ---- Steel Exemplar: "~ enters with two +1/+1 counters on it unless two or more colors of mana were spent to cast it." ------------------------------------------------------

const EXEMPLAR = card('Test Exemplar', 'Artifact Creature — Wizard', 'Trample\nThis creature enters with two +1/+1 counters on it unless two or more colors of mana were spent to cast it.', { pt: ['2', '2'], cost: '{2}' });
describe('CR 614.1c, 614.12, 601.2h, 106.1: "~ enters with two +1/+1 counters on it unless two or more colors of mana were spent to cast it."', () => {
  const setup = (lands: string[]): GameState => mpScenario({ defs: [EXEMPLAR], cards: ['Island'], zones: { p1: { hand: ['Test Exemplar'], battlefield: lands } } });
  it('is automated', () => expect(full(EXEMPLAR)).toBe(true));
  it('paid with white and blue mana (two colors): it enters with no counter', () => {
    const s = cast(setup(['Plains', 'Island']), 'Test Exemplar');
    expect(counters(s, 'Test Exemplar')).toBe(0);
  });
  it('paid with white mana only (one color): it enters with two +1/+1 counters (the negative case)', () => {
    const s = cast(setup(['Plains', 'Plains']), 'Test Exemplar');
    expect(counters(s, 'Test Exemplar')).toBe(2);
  });
});

// ---- Prohibit: "Counter target spell if its mana value is 2 or less. If this spell was kicked, counter that spell if its mana value is 4 or less instead." ---------------------

const BAN = card('Test Ban', 'Instant', 'Kicker {2}\nCounter target spell if its mana value is 2 or less. If this spell was kicked, counter that spell if its mana value is 4 or less instead.', { cost: '{1}' });
const BIG = card('Test Big Rite', 'Sorcery', 'You gain 5 life.', { cost: '{2}{W}' });
const SMALL = card('Test Small Rite', 'Sorcery', 'You gain 2 life.', { cost: '{W}' });
describe('CR 701.6a, 614.15, 702.33d: "Counter target spell if its mana value is 2 or less. If this spell was kicked, counter that spell if its mana value is 4 or less instead."', () => {
  const play = (rite: string, kicked: boolean): GameState => {
    const s0 = mpScenario({ defs: [BAN, BIG, SMALL], zones: { p1: { hand: [rite], battlefield: ['Plains', 'Plains', 'Plains'] }, p2: { hand: ['Test Ban'], battlefield: ['Plains', 'Plains', 'Plains'] } } });
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, rite, 'hand', 'p1') }), {});
    const spell = s.zones.stack[s.zones.stack.length - 1]!;
    s = drive(act(s, { type: 'pass', player: s.pending!.player as PlayerId }), {});
    s = settle(drive(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Ban', 'hand', 'p2') }), { yes: [kicked], numbers: [kicked ? 1 : 0], targets: [[{ kind: 'object', id: spell } as TargetChoice]] }));
    return s;
  };
  it('is automated', () => expect(full(BAN)).toBe(true));
  it('not kicked: a spell of mana value 1 is countered', () => expect(lifeOf(play('Test Small Rite', false), 'p1')).toBe(20));
  it('not kicked: a spell of mana value 3 resolves (the negative case)', () => expect(lifeOf(play('Test Big Rite', false), 'p1')).toBe(25));
  it('kicked: the spell of mana value 3 is countered (the limit is 4 instead)', () => expect(lifeOf(play('Test Big Rite', true), 'p1')).toBe(20));
});

// ---- Blademane Baku: "{1}, Remove X ki counters from ~: For each counter removed, ~ gets +2/+0 until end of turn." ------------------------------------------------------

const BAKU = card('Test Baku', 'Creature — Spirit', '{1}, Remove X ki counters from this creature: For each counter removed, this creature gets +2/+0 until end of turn.', { pt: ['1', '1'] });
describe('CR 107.3, 122.1, 613.4c: "{1}, Remove X ki counters from ~: For each counter removed, ~ gets +2/+0 until end of turn."', () => {
  const setup = (): GameState => mpScenario({ defs: [BAKU], zones: { p1: { battlefield: [{ name: 'Test Baku' }, 'Plains'] } }, setup: (g) => { const id = g.zones.battlefield.find((x) => nameOf(g, x) === 'Test Baku')!; g.objects[id]!.counters = { ki: 3 }; } });
  it('is automated', () => expect(full(BAKU)).toBe(true));
  it('removing two of its three ki counters gives +4/+0 and leaves one counter', () => {
    const s0 = setup();
    const s = activateText(s0, idOn(s0, 'Test Baku'), /counter removed/, { numbers: [2] });
    expect(pt(s, idOn(s, 'Test Baku'))).toBe('5/1');
    expect(counters(s, 'Test Baku', 'ki')).toBe(1);
  });
  it('removing none (X = 0) changes nothing (the negative case)', () => {
    const s0 = setup();
    const s = activateText(s0, idOn(s0, 'Test Baku'), /counter removed/, { numbers: [0] });
    expect(pt(s, idOn(s, 'Test Baku'))).toBe('1/1');
    expect(counters(s, 'Test Baku', 'ki')).toBe(3);
  });
});

// ---- Storyweave: "The next time one or more enchantment creatures you control enter this turn, each enters with two additional +1/+1 counters on it." ------------------------------

const WEAVE = card('Test Weave', 'Sorcery', 'The next time one or more enchantment creatures you control enter this turn, each enters with two additional +1/+1 counters on it.');
const SPIRIT = card('Test Spirit', 'Enchantment Creature — Spirit', '', { pt: ['1', '1'] });
const BEAST = card('Test Beast', 'Creature — Beast', '', { pt: ['3', '3'] });
const PAIR = card('Test Pair Rite', 'Sorcery', 'Create two 1/1 white Spirit enchantment creature tokens.');
describe('CR 614.1c, 614.12, 615.1 (one batch): "The next time one or more enchantment creatures you control enter this turn, each enters with two additional +1/+1 counters on it."', () => {
  const setup = (hand: string[], theirs: string[] = []): GameState => mpScenario({ defs: [WEAVE, SPIRIT, BEAST, PAIR], zones: { p1: { hand: ['Test Weave', ...hand] }, p2: { hand: theirs } } });
  it('is automated', () => expect(full(WEAVE)).toBe(true));
  it('the next enchantment creature you control enters with two counters; the second one this turn enters with none (the negative case: one batch only)', () => {
    let s = cast(setup(['Test Spirit', 'Test Spirit']), 'Test Weave');
    s = cast(s, 'Test Spirit');
    expect(counters(s, 'Test Spirit')).toBe(2);
    s = cast(s, 'Test Spirit');
    const mine = s.zones.battlefield.filter((x) => nameOf(s, x) === 'Test Spirit').map((x) => s.objects[x]!.counters?.['+1/+1'] ?? 0).sort();
    expect(mine).toEqual([0, 2]);
  });
  it('two enchantment creatures entering at once both get the counters (one batch)', () => {
    let s = cast(setup(['Test Pair Rite']), 'Test Weave');
    s = cast(s, 'Test Pair Rite');
    const tokens = s.zones.battlefield.filter((x) => s.objects[x]!.controller === 'p1' && getChars(s, x)!.types.includes('Enchantment'));
    expect(tokens.length).toBe(2);
    for (const t of tokens) expect(s.objects[t]!.counters?.['+1/+1'] ?? 0).toBe(2);
  });
  it('a creature that is no enchantment is not changed and does not use the replacement up (the negative case)', () => {
    let s = cast(setup(['Test Beast', 'Test Spirit']), 'Test Weave');
    s = cast(s, 'Test Beast');
    expect(counters(s, 'Test Beast')).toBe(0);
    s = cast(s, 'Test Spirit');
    expect(counters(s, 'Test Spirit')).toBe(2);
  });
});

// ---- Holy Frazzle-Cannon: "Whenever equipped creature attacks, put a +1/+1 counter on that creature and each other creature you control that shares a creature type with it." ------

const CANNON = card('Test Cannon', 'Artifact — Equipment', 'Whenever equipped creature attacks, put a +1/+1 counter on that creature and each other creature you control that shares a creature type with it.\nEquip {1}');
const ELF = card('Test Elf Warrior', 'Creature — Elf Warrior', '', { pt: ['2', '2'] });
const ELF2 = card('Test Elf Druid', 'Creature — Elf Druid', '', { pt: ['1', '1'] });
const WARRIOR = card('Test Human Warrior', 'Creature — Human Warrior', '', { pt: ['2', '2'] });
const GIANT = card('Test Giant', 'Creature — Giant', '', { pt: ['4', '4'] });
describe('CR 205.3m, 109.2, 508.1, 603.2: "Whenever equipped creature attacks, put a +1/+1 counter on that creature and each other creature you control that shares a creature type with it."', () => {
  const setup = (): GameState => mpScenario({
    defs: [CANNON, ELF, ELF2, WARRIOR, GIANT],
    zones: { p1: { battlefield: [{ name: 'Test Cannon' }, { name: 'Test Elf Warrior' }, { name: 'Test Elf Druid' }, { name: 'Test Human Warrior' }, { name: 'Test Giant' }] }, p2: { battlefield: [{ name: 'Test Elf Druid' }] } },
    setup: (g) => { const eq = g.zones.battlefield.find((x) => nameOf(g, x) === 'Test Cannon')!; g.objects[eq]!.attachedTo = g.zones.battlefield.find((x) => nameOf(g, x) === 'Test Elf Warrior')!; },
  });
  const attack = (s0: GameState, attacker: string): GameState => {
    let s = s0;
    for (let i = 0; i < 40 && s.pending?.kind !== 'declareAttackers'; i++) s = act(s, { type: 'pass', player: s.pending!.player });
    s = answer(s, { kind: 'declareAttackers', attacks: [{ attacker: idOn(s, attacker, 'p1'), defender: 'p2' }] });
    for (let i = 0; i < 40 && s.zones.stack.length === 0 && s.pending?.kind === 'priority' && s.turn.step === 'declareAttackers'; i++) break;
    return settle(s);
  };
  it('is automated', () => expect(full(CANNON)).toBe(true));
  it('the equipped Elf Warrior attacks: it, the other Elf and the other Warrior get one counter each; the Giant and the opponent\'s Elf get none (the negative cases)', () => {
    const s = attack(setup(), 'Test Elf Warrior');
    expect(s.objects[idOn(s, 'Test Elf Warrior', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(1);
    expect(s.objects[idOn(s, 'Test Elf Druid', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(1);
    expect(s.objects[idOn(s, 'Test Human Warrior', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(1);
    expect(s.objects[idOn(s, 'Test Giant', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(0);
    expect(s.objects[idOn(s, 'Test Elf Druid', 'p2')]!.counters?.['+1/+1'] ?? 0).toBe(0);
  });
  it('a creature that is not equipped attacks: nothing triggers (the negative case)', () => {
    const s = attack(setup(), 'Test Giant');
    expect(s.objects[idOn(s, 'Test Elf Warrior', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(0);
    expect(s.objects[idOn(s, 'Test Giant', 'p1')]!.counters?.['+1/+1'] ?? 0).toBe(0);
  });
});

// ---- Lo and Li, Royal Advisors: "Whenever an opponent discards a card or mills one or more cards, put a +1/+1 counter on each Advisor you control." ------------------------------

const ADVISORS = card('Test Advisors', 'Legendary Creature — Human Advisor', 'Whenever an opponent discards a card or mills one or more cards, put a +1/+1 counter on each Advisor you control.', { pt: ['2', '2'] });
const PURGE = card('Test Purge', 'Sorcery', 'Target player discards two cards.');
const SIFT = card('Test Sift', 'Sorcery', 'Target player mills three cards.');
const WASTE = card('Test Waste', 'Sorcery', 'Each player mills two cards.');
describe('CR 603.2, 603.2c, 701.9a, 701.17a: "Whenever an opponent discards a card or mills one or more cards, put a +1/+1 counter on each Advisor you control."', () => {
  const setup = (spell: string, theirHand: string[] = ['Plains', 'Plains', 'Plains']): GameState => mpScenario({ defs: [ADVISORS, PURGE, SIFT, WASTE], zones: { p1: { hand: [spell, 'Plains', 'Plains'], battlefield: [{ name: 'Test Advisors' }] }, p2: { hand: theirHand } } });
  it('is automated', () => expect(full(ADVISORS)).toBe(true));
  it('an opponent discards two cards: it triggers twice (one for each card discarded)', () => {
    const s = cast(setup('Test Purge'), 'Test Purge', { targets: [[pl('p2')]] });
    expect(counters(s, 'Test Advisors')).toBe(2);
  });
  it('an opponent mills three cards: it triggers once (one or more cards)', () => {
    const s = cast(setup('Test Sift'), 'Test Sift', { targets: [[pl('p2')]] });
    expect(counters(s, 'Test Advisors')).toBe(1);
  });
  it('three opponents and you mill at once: once for each opponent, never for you (the negative case)', () => {
    const s = cast(setup('Test Waste'), 'Test Waste');
    expect(counters(s, 'Test Advisors')).toBe(3);
  });
  it('you discard two cards yourself: it does not trigger (the negative case)', () => {
    const s = cast(setup('Test Purge'), 'Test Purge', { targets: [[pl('p1')]] });
    expect(counters(s, 'Test Advisors')).toBe(0);
  });
});

// ---- Isu the Abominable: "Whenever another snow permanent you control enters, you may pay {G}, {W}, or {U}. If you do, put a +1/+1 counter on ~." ------------------------------

const YETI = card('Test Yeti', 'Snow Creature — Yeti', 'Whenever another snow permanent you control enters, you may pay {G}, {W}, or {U}. If you do, put a +1/+1 counter on this creature.', { pt: ['5', '5'] });
const SNOWLING = card('Test Snowling', 'Snow Creature — Spirit', '', { pt: ['1', '1'] });
const PLAINLING = card('Test Plainling', 'Creature — Spirit', '', { pt: ['1', '1'] });
describe('CR 118.12, 601.2b, 603.2: "you may pay {G}, {W}, or {U}. If you do, put a +1/+1 counter on ~." (one of three costs)', () => {
  const setup = (hand: string, lands: string[]): GameState => mpScenario({ defs: [YETI, SNOWLING, PLAINLING], cards: ['Island', 'Mountain'], zones: { p1: { hand: [hand], battlefield: [{ name: 'Test Yeti' }, ...lands] } } });
  it('is automated', () => expect(full(YETI)).toBe(true));
  it('a snow creature enters and the controller pays {W} (a Plains is all it has): one counter, the Plains is tapped', () => {
    const s = cast(setup('Test Snowling', ['Plains']), 'Test Snowling', { yes: [true, true] });
    expect(counters(s, 'Test Yeti')).toBe(1);
    expect(s.objects[idOn(s, 'Plains')]!.tapped).toBe(true);
  });
  it('the controller can pay none of the three (only a Mountain): no counter (the negative case)', () => {
    const s = cast(setup('Test Snowling', ['Mountain']), 'Test Snowling', { yes: [true, true] });
    expect(counters(s, 'Test Yeti')).toBe(0);
  });
  it('a creature that is not snow enters: nothing triggers (the negative case)', () => {
    const s = cast(setup('Test Plainling', ['Plains']), 'Test Plainling', { yes: [true, true] });
    expect(counters(s, 'Test Yeti')).toBe(0);
    expect(s.objects[idOn(s, 'Plains')]!.tapped ?? false).toBe(false);
  });
});
