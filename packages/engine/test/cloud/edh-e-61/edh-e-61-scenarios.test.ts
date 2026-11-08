/**
 * Coordinator E, round edh-e-61 (group rest 3/3, second batch): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler, in 4-player games. Each group has its negative cases. CR cites are from the Comprehensive Rules text of 2026-09-25.
 *
 *   CR 702.16a, 105.1, 613.1f   "~ has protection from each color among permanents you control."
 *   CR 115.1, 113.7a, 101.2     "Creatures you control can't be the targets of blue spells or abilities from blue sources."
 *   CR 608.2d, 702.16a          "Until end of turn, ~ gets -1/-1 and gains your choice of double strike, protection from red, vigilance, or shadow."
 *   CR 107.3, 120.3             "{X}, {T}: ~ deals half X damage, rounded down, to any target, and half X damage, rounded up, to you."
 */
import { describe, expect, it } from 'vitest';
import { type GameState, type ObjectId } from '../../../src/index';
import { act, answer, find, mpScenario } from '../../m12/rules/helpers';
import { pass } from '../../m3/scenario';
import { declareAttackers, declareBlockers, passUntil, runCombat, toDeclareAttackers } from '../../m4/helpers';
import { getChars } from '../../../src/rules/characteristics';
import { compileCard, type CardDef, type OracleCard } from '../../../src/index';
import { card, full, named, pt } from '../cmd3/helpers';

/** A synthetic card with colors (cmd3/helpers#card has none). */
const colored = (name: string, type: string, text: string, ptv: [string, string] | undefined, colors: string[], cost = '{0}'): CardDef =>
  compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors, ...(ptv ? { power: ptv[0], toughness: ptv[1] } : {}) } as OracleCard);

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

const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const plr = (id: string) => ({ kind: 'player' as const, id });
const obj = (id: ObjectId) => ({ kind: 'object' as const, id });
const prot = (s: GameState, id: ObjectId): string[] => getChars(s, id)!.keywords.filter((k) => k.keyword === 'protection').map((k) => k.quality ?? '').sort();

describe('CR 702.16a, 105.1, 613.1f: "~ has protection from each color among permanents you control."', () => {
  const KANNUSHI = card('Test Shrine Keeper', 'Creature — Spirit', '~ has protection from each color among permanents you control.', ['2', '2']);
  const RED = colored('Test Red Bear', 'Creature — Bear', '', ['2', '2'], ['R']);
  const GREEN = colored('Test Green Elf', 'Creature — Elf', '', ['1', '1'], ['G'], '{G}');
  const BLUE = colored('Test Blue Fish', 'Creature — Fish', '', ['1', '1'], ['U']);
  const GOLEM = colored('Test Grey Golem', 'Artifact Creature — Golem', '', ['1', '1'], [], '{2}');
  const defs = [KANNUSHI, RED, GREEN, BLUE, GOLEM];
  it('is automated', () => expect(full(KANNUSHI)).toBe(true));
  it('has protection from each color among your permanents (its own colorless: none), and follows the permanents as they come and go', () => {
    const s0 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Shrine Keeper', 'Test Grey Golem'] }, p2: { battlefield: ['Test Blue Fish'] } } });
    const k = named(s0, 'Test Shrine Keeper')[0]!;
    expect(prot(s0, k)).toEqual([]); // colorless permanents only
    const s1 = mpScenario({ defs, zones: { p1: { battlefield: ['Test Shrine Keeper', 'Test Red Bear', 'Test Green Elf'] }, p2: { battlefield: ['Test Blue Fish'] } } });
    const k1 = named(s1, 'Test Shrine Keeper')[0]!;
    expect(prot(s1, k1)).toEqual(['color:G', 'color:R']); // red and green of your permanents; the opponent's blue is not among them
  });
  it('is read again when the permanents change (the characteristics cache): a destroyed red creature takes its color away, a new blue one adds it', () => {
    const KILL = card('Test Smite Red', 'Instant', 'Destroy target creature.');
    const NEW_BLUE = colored('Test Blue Newcomer', 'Creature — Fish', '', ['1', '1'], ['U']);
    const s0 = mpScenario({ defs: [...defs, KILL, NEW_BLUE], zones: { p1: { hand: ['Test Smite Red', 'Test Blue Newcomer'], battlefield: ['Test Shrine Keeper', 'Test Red Bear', 'Test Green Elf'] } } });
    const k = named(s0, 'Test Shrine Keeper')[0]!;
    expect(prot(s0, k)).toEqual(['color:G', 'color:R']); // (read once, so the cache holds it)
    const bear = named(s0, 'Test Red Bear')[0]!;
    const s1 = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Smite Red', 'hand', 'p1') }), (d) => (d.kind === 'chooseTargets' ? { kind: 'chooseTargets', targets: [obj(bear)] } as never : undefined));
    expect(named(s1, 'Test Red Bear').length).toBe(0);
    expect(prot(s1, named(s1, 'Test Shrine Keeper')[0]!)).toEqual(['color:G']);
    const s2 = drive(act(s1, { type: 'cast', player: 'p1', card: find(s1, 'Test Blue Newcomer', 'hand', 'p1') }));
    expect(prot(s2, named(s2, 'Test Shrine Keeper')[0]!)).toEqual(['color:G', 'color:U']);
  });
});

describe('CR 115.1, 113.7a, 101.2: "Creatures you control can\'t be the targets of blue spells or abilities from blue sources."', () => {
  const CENTAUR = card('Test Ward Centaur', 'Creature — Centaur', "Creatures you control can't be the targets of blue spells or abilities from blue sources.", ['3', '3']);
  const MATE = card('Test Ward Mate', 'Creature — Elf', '', ['1', '1']);
  const FOE = card('Test Foreign Elf', 'Creature — Elf', '', ['1', '1']);
  const BLUE_PUMP = colored('Test Blue Boost', 'Instant', 'Target creature gets +1/+1 until end of turn.', undefined, ['U']);
  const RED_PUMP = colored('Test Red Boost', 'Instant', 'Target creature gets +1/+1 until end of turn.', undefined, ['R']);
  const defs = [CENTAUR, MATE, FOE, BLUE_PUMP, RED_PUMP];
  const start = (): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Blue Boost', 'Test Red Boost'], battlefield: ['Test Ward Centaur', 'Test Ward Mate'] }, p2: { battlefield: ['Test Foreign Elf'] } } });
  /** The creatures the caster is offered as the target of the instant. */
  it('is automated', () => expect(full(CENTAUR)).toBe(true));
  it('a blue spell is not offered your creatures (the Centaur and its friend), only the opponent\'s; a red spell is offered them all', () => {
    const s0 = start();
    const centaur = named(s0, 'Test Ward Centaur')[0]!;
    const mate = named(s0, 'Test Ward Mate')[0]!;
    const foe = named(s0, 'Test Foreign Elf')[0]!;
    const blue = JSON.stringify(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Blue Boost', 'hand', 'p1') }).pending);
    expect(blue).toContain(foe);
    expect(blue).not.toContain(centaur);
    expect(blue).not.toContain(mate);
    const red = JSON.stringify(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Red Boost', 'hand', 'p1') }).pending);
    for (const id of [centaur, mate, foe]) expect(red).toContain(id);
  });
  it('negative: without the Centaur, a blue spell may target your creature', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: ['Test Blue Boost'], battlefield: ['Test Ward Mate'] }, p2: { battlefield: ['Test Foreign Elf'] } } });
    const mate = named(s0, 'Test Ward Mate')[0]!;
    expect(JSON.stringify(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Blue Boost', 'hand', 'p1') }).pending)).toContain(mate);
  });
});

describe('CR 608.2d, 702.16a, 611.2a: "Until end of turn, ~ gets -1/-1 and gains your choice of double strike, protection from red, vigilance, or shadow."', () => {
  const AVENGER = card('Test Quick Avenger', 'Creature — Soldier', '{0}: Until end of turn, ~ gets -1/-1 and gains your choice of double strike, protection from red, vigilance, or shadow.', ['3', '3']);
  const start = (): GameState => mpScenario({ defs: [AVENGER], zones: { p1: { battlefield: ['Test Quick Avenger'] } } });
  /** Activate, then answer the choice with the option whose label matches. */
  const choose = (word: RegExp): { s: GameState; id: ObjectId; labels: string[] } => {
    const s0 = start();
    const id = named(s0, 'Test Quick Avenger')[0]!;
    let labels: string[] = [];
    const s = drive(act(s0, { type: 'activate', player: 'p1', source: id, ability: 'p:0:0' }), (d) => {
      if (d.kind !== 'chooseOption') return undefined;
      const opts = d.options as { id: string; label?: string }[];
      labels = opts.map((o) => o.label ?? o.id);
      return { kind: 'chooseOption', ids: [opts.find((o) => word.test(o.label ?? o.id))!.id] };
    });
    return { s, id, labels };
  };
  it('is automated', () => expect(full(AVENGER)).toBe(true));
  it('offers the four keywords and gives -1/-1 and protection from red when that is chosen', () => {
    const { s, id, labels } = choose(/protection from red/i);
    expect(labels.length).toBe(4);
    expect(pt(s, id)).toBe('2/2');
    expect(prot(s, id)).toEqual(['color:R']);
    expect(getChars(s, id)!.keywords.map((k) => k.keyword)).not.toContain('double strike');
  });
  it('negative: choosing vigilance gives vigilance and no protection', () => {
    const { s, id } = choose(/vigilance/i);
    expect(pt(s, id)).toBe('2/2');
    expect(prot(s, id)).toEqual([]);
    expect(getChars(s, id)!.keywords.map((k) => k.keyword)).toContain('vigilance');
  });
});

describe('CR 107.3, 120.3, 601.2b: "{X}, {T}: ~ deals half X damage, rounded down, to any target, and half X damage, rounded up, to you."', () => {
  const WRAITH = card('Test Half Wraith', 'Creature — Wraith', '{X}, {T}: ~ deals half X damage, rounded down, to any target, and half X damage, rounded up, to you.', ['1', '1']);
  const start = (): GameState => mpScenario({ defs: [WRAITH], zones: { p1: { battlefield: ['Test Half Wraith', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'] }, p2: {} } });
  const fire = (x: number, target: 'p2' | 'p3'): GameState => {
    const s0 = start();
    const w = named(s0, 'Test Half Wraith')[0]!;
    return drive(act(s0, { type: 'activate', player: 'p1', source: w, ability: 'p:0:0' }), (d) => {
      if (d.kind === 'chooseNumber') return { kind: 'chooseNumber', n: x } as never;
      if (d.kind === 'chooseTargets') return { kind: 'chooseTargets', targets: [plr(target)] } as never;
      return undefined;
    });
  };
  it('is automated', () => expect(full(WRAITH)).toBe(true));
  it('X = 5: 2 damage to the target (rounded down), 3 to you (rounded up)', () => {
    const s = fire(5, 'p2');
    expect(life(s, 'p2')).toBe(18);
    expect(life(s, 'p1')).toBe(17);
  });
  it('X = 4: 2 and 2; X = 1: 0 to the target and 1 to you', () => {
    const a = fire(4, 'p2');
    expect([life(a, 'p2'), life(a, 'p1')]).toEqual([18, 18]);
    const b = fire(1, 'p3');
    expect([life(b, 'p3'), life(b, 'p1')]).toEqual([20, 19]);
  });
});

describe('CR 406.3, 607.2a, 701.40a, 110.2a: "When ~ dies, turn the exiled card face up. If it\'s a creature card, put it onto the battlefield under your control."', () => {
  const EGG = card('Test Shell Egg', 'Artifact Creature — Egg', 'When ~ enters, you may exile a card from your hand face down.\nWhen ~ dies, turn the exiled card face up. If it\'s a creature card, put it onto the battlefield under your control.', ['0', '2']);
  const BEAST = card('Test Hidden Beast', 'Creature — Beast', '', ['4', '4']);
  const RELIC = card('Test Hidden Relic', 'Artifact', '');
  const KILL = card('Test Smite', 'Sorcery', 'Destroy target creature.');
  const defs = [EGG, BEAST, RELIC, KILL];
  /** Cast the Egg and exile `hidden` face down with it, then destroy the Egg with the Smite. */
  const play = (hidden: string, then = true): { s: GameState; hid: ObjectId } => {
    void hidden;
    const s0 = mpScenario({ defs, zones: { p1: { hand: ['Test Shell Egg', hidden, 'Test Smite'] } } });
    const hid = find(s0, hidden, 'hand', 'p1');
    let s = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Shell Egg', 'hand', 'p1') }), (d) => (d.kind === 'chooseObjects' ? { kind: 'chooseObjects', ids: [hid] } : undefined));
    expect(s.zones.exile.length).toBe(1); // the card exiled face down (a new object in exile, CR 400.7)
    expect(s.objects[s.zones.exile[0]!]!.faceDown).toBe(true);
    if (!then) return { s, hid: s.zones.exile[0]! };
    const egg = named(s, 'Test Shell Egg')[0]!;
    s = drive(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Smite', 'hand', 'p1') }), (d) => (d.kind === 'chooseTargets' ? { kind: 'chooseTargets', targets: [obj(egg)] } as never : undefined));
    return { s, hid: s.zones.exile[0] ?? hid };
  };
  it('is automated', () => expect(full(EGG)).toBe(true));
  it('a creature card exiled face down comes onto the battlefield under your control when the Egg dies', () => {
    const { s } = play('Test Hidden Beast');
    expect(named(s, 'Test Shell Egg').length).toBe(0);
    expect(named(s, 'Test Hidden Beast').length).toBe(1);
    expect(s.objects[named(s, 'Test Hidden Beast')[0]!]!.controller).toBe('p1');
  });
  it('negative: a card that is not a creature card is turned face up and stays exiled', () => {
    const { s } = play('Test Hidden Relic');
    expect(named(s, 'Test Shell Egg').length).toBe(0);
    expect(named(s, 'Test Hidden Relic').length).toBe(0);
    expect(s.zones.exile.map((id) => s.objects[id]!.defId)).toContain('Test Hidden Relic');
    expect(s.zones.exile.every((id) => !s.objects[id]!.faceDown)).toBe(true);
  });
  it('negative: nothing happens while the Egg is alive (the card stays face down in exile)', () => {
    const { s, hid } = play('Test Hidden Beast', false);
    expect(named(s, 'Test Shell Egg').length).toBe(1);
    expect(s.objects[hid]!.faceDown).toBe(true);
  });
});

describe('CR 120.3, 115.1, 102.3: "Two target creatures your team controls each deal damage equal to their power to target creature." (your team is you)', () => {
  const ATTACK = card('Test Pair Strike', 'Instant', 'Two target creatures your team controls each deal damage equal to their power to target creature.');
  const HIT3 = card('Test Hitter Three', 'Creature — Warrior', '', ['3', '3']);
  const HIT2 = card('Test Hitter Two', 'Creature — Warrior', '', ['2', '2']);
  const WALL = card('Test Big Wall', 'Creature — Wall', '', ['0', '5']);
  const defs = [ATTACK, HIT3, HIT2, WALL];
  const start = (): GameState => mpScenario({ defs, zones: { p1: { hand: ['Test Pair Strike'], battlefield: ['Test Hitter Three', 'Test Hitter Two'] }, p2: { battlefield: ['Test Big Wall', 'Test Hitter Two'] } } });
  /** Cast the instant: the two creatures of yours first, then the target. The offered options of the first choice are recorded. */
  const fire = (s0: GameState, mine: ObjectId[], at: ObjectId, offered: string[] = []): GameState =>
    drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Pair Strike', 'hand', 'p1') }), (d) => {
      if (d.kind !== 'chooseTargets') return undefined;
      const dd = d as unknown as { targetText: string; objects: ObjectId[] };
      if (/^two target/i.test(dd.targetText)) { offered.push(...dd.objects); return { kind: 'chooseTargets', targets: mine.map(obj) } as never; }
      return { kind: 'chooseTargets', targets: [obj(at)] } as never;
    });
  it('is automated', () => expect(full(ATTACK)).toBe(true));
  it('two of your creatures each deal damage equal to their power to the target: 3 + 2 = 5 kills a 0/5; the opponent\'s creatures are not offered for the first two', () => {
    const s0 = start();
    const wall = named(s0, 'Test Big Wall')[0]!;
    const mine = s0.zones.battlefield.filter((id) => s0.objects[id]!.controller === 'p1');
    const offered: string[] = [];
    const s = fire(s0, mine, wall, offered);
    expect(named(s, 'Test Big Wall').length).toBe(0);
    expect(named(s, 'Test Hitter Three').length).toBe(1); // the target deals no damage back
    expect([...offered].sort()).toEqual([...mine].sort());
  });
  it('negative: 2 + 2 = 4 damage does not kill a 0/5', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: ['Test Pair Strike'], battlefield: ['Test Hitter Two', 'Test Hitter Two'] }, p2: { battlefield: ['Test Big Wall'] } } });
    const s = fire(s0, s0.zones.battlefield.filter((id) => s0.objects[id]!.controller === 'p1'), named(s0, 'Test Big Wall')[0]!);
    expect(named(s, 'Test Big Wall').length).toBe(1);
  });
});

describe('CR 601.3, 101.2, 509.1h, 506.4: "Cast this spell only during the declare blockers step. Attacking creatures become blocked." / "~ deals 1 damage to each of those creatures."', () => {
  const PATCH = card('Test Mist Patch', 'Instant', "Cast this spell only during the declare blockers step.\nAttacking creatures become blocked.");
  const VINES = card('Test Choke Vines', 'Instant', "Cast this spell only during the declare blockers step.\nUp to two target attacking creatures become blocked. ~ deals 1 damage to each of those creatures.");
  const HITTER = card('Test Raid Hitter', 'Creature — Warrior', '', ['3', '3']);
  const SMALL = card('Test Raid Small', 'Creature — Warrior', '', ['1', '1']);
  const defs = [PATCH, VINES, HITTER, SMALL];
  const start = (spell: string): GameState => {
    const s0 = passUntil(mpScenario({ defs, zones: { p1: { battlefield: ['Test Raid Hitter', 'Test Raid Small'] }, p2: { hand: [spell] } } }), (x) => x.turn.activePlayer === 'p1' && x.turn.step === 'main1' && x.pending?.kind === 'priority', 'p1 main');
    return s0;
  };
  const toBlockers = (s0: GameState, attackers: ObjectId[]): GameState => {
    let s = declareAttackers(toDeclareAttackers(s0), attackers.map((a) => [a, 'p2'] as [ObjectId, string]));
    s = passUntil(s, (x) => x.pending?.kind === 'declareBlockers' || (x.turn.step === 'declareBlockers' && x.pending?.kind === 'priority'), 'the declare blockers step');
    return s.pending?.kind === 'declareBlockers' ? declareBlockers(s, []) : s;
  };
  /** After the blockers are declared, p1 passes and p2 casts the spell (answering its targets with `targets`), then combat runs to its end. */
  const play = (spell: string, attackers: string[], targets: (s: GameState) => ObjectId[], cast = true): GameState => {
    const s0 = start(spell);
    let s = toBlockers(s0, attackers.map((n) => named(s0, n)[0]!));
    if (s.pending!.player !== 'p2') s = pass(s);
    if (cast) s = drive(act(s, { type: 'cast', player: 'p2', card: find(s, spell, 'hand', 'p2') }), (d) => (d.kind === 'chooseTargets' ? { kind: 'chooseTargets', targets: targets(s).map(obj) } as never : undefined));
    return passUntil(s, (x) => x.turn.step === 'endCombat' || x.turn.step === 'main2', 'the end of combat');
  };
  it('are automated', () => { expect(full(PATCH)).toBe(true); expect(full(VINES)).toBe(true); });
  it('Mist Patch: every attacking creature becomes blocked, so no combat damage reaches the defending player', () => {
    const s = play('Test Mist Patch', ['Test Raid Hitter', 'Test Raid Small'], () => []);
    expect(life(s, 'p2')).toBe(20);
  });
  it('negative: without the spell the same attack deals 4', () => {
    const s = play('Test Mist Patch', ['Test Raid Hitter', 'Test Raid Small'], () => [], false);
    expect(life(s, 'p2')).toBe(16);
  });
  it('negative: it can be cast only during the declare blockers step (not in the main phase)', () => {
    const s0 = mpScenario({ defs, zones: { p1: { hand: ['Test Mist Patch'] } } });
    expect(() => act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Mist Patch', 'hand', 'p1') })).toThrow();
  });
  it('Choke Vines: the chosen attackers become blocked and are dealt 1 damage each (a 1/1 dies, the 3/3 survives); an attacker not chosen still connects', () => {
    const s0 = start('Test Choke Vines');
    const small = named(s0, 'Test Raid Small')[0]!;
    const hitter = named(s0, 'Test Raid Hitter')[0]!;
    const s = play('Test Choke Vines', ['Test Raid Hitter', 'Test Raid Small'], () => [small]);
    expect(named(s, 'Test Raid Small').length).toBe(0);
    expect(named(s, 'Test Raid Hitter').length).toBe(1);
    expect(life(s, 'p2')).toBe(17); // only the Hitter was not chosen
    void hitter;
  });
});
