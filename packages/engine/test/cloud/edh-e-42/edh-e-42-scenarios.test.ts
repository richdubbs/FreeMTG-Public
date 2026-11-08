/**
 * Commander coordinator E, round edh-e-42 (library 3/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler, in 4-player games. Each test is named after the rule it checks and has its negative case.
 *
 *   CR 101.4, 701.23a, 701.24a   "When ~ enters, each opponent may search their library for a basic land card, put it onto the battlefield tapped, then shuffle." (Old-Growth Dryads)
 *   CR 201.2, 701.23a            "you may search your library for a card with the same name as another creature you control, reveal it, put it into your hand, then shuffle." (Pattern Matcher)
 *   CR 701.20a, 110.2, 608.2d    "Target opponent reveals their hand. You may put a creature card from it onto the battlefield under your control. That creature gains haste. Sacrifice it at the beginning of the next end step." (Treacherous Urge)
 *   CR 603.2c, 510.2, 506.4      "Whenever this creature deals combat damage to one or more blocking creatures, manifest the top card of your library." (Arashin War Beast)
 */
import { describe, expect, it } from 'vitest';
import { hasKeyword, getChars, type DecisionAnswer, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act as mact, answer as manswer, find as mfind, mpScenario, pass as mpass, passUntil } from '../../m12/rules/helpers';
import { card, full } from '../cmd3/helpers';
import { declareAttackers, declareBlockers, toDeclareAttackers, toDeclareBlockers, toStep } from '../../m4/helpers';

interface Script {
  targets?: ObjectId[];
  playerTargets?: PlayerId[];
  yes?: boolean | ((prompt: string, who: PlayerId) => boolean);
  objects?: (options: ObjectId[], prompt: string, state: GameState, who: PlayerId) => ObjectId[];
  until?: (state: GameState) => boolean;
}
/** Answers whatever is asked, from the script, and passes priority until the stack is empty (or `until` holds). */
function run(s0: GameState, sc: Script = {}): GameState {
  let s = s0;
  const targets = [...(sc.targets ?? [])];
  const players = [...(sc.playerTargets ?? [])];
  for (let i = 0; i < 300; i++) {
    const p = s.pending;
    if (p === null || p === undefined) break;
    let a: DecisionAnswer | undefined;
    const d = p as unknown as { min?: number; max?: number; prompt: string; player: PlayerId };
    if (p.kind === 'chooseTargets') {
      const t = p as unknown as { objects?: ObjectId[]; min?: number };
      a = { kind: 'chooseTargets', targets: targets.length > 0 ? [{ kind: 'object', id: targets.shift()! }] : players.length > 0 ? [{ kind: 'player', id: players.shift()! }] : (t.objects ?? []).slice(0, t.min ?? 0).map((id) => ({ kind: 'object' as const, id })) } as DecisionAnswer;
    } else if (p.kind === 'payCost') a = { kind: 'payCost', auto: true };
    else if (p.kind === 'yesNo') a = { kind: 'yesNo', yes: typeof sc.yes === 'function' ? sc.yes(d.prompt, d.player) : sc.yes ?? true };
    else if (p.kind === 'chooseObjects') {
      const o = (p as unknown as { options: ObjectId[] }).options;
      a = { kind: 'chooseObjects', ids: sc.objects !== undefined ? sc.objects(o, d.prompt, s, d.player) : o.slice(0, d.min ?? 0) };
    } else if (p.kind === 'chooseOption') a = { kind: 'chooseOption', ids: [(p as unknown as { options: { id: string }[] }).options[0]!.id] };
    else if (p.kind === 'order') a = { kind: 'order', ids: (p as unknown as { items: { id: string }[] }).items.map((x) => x.id) };
    else if (p.kind === 'declareAttackers') a = { kind: 'declareAttackers', attacks: [] } as DecisionAnswer;
    else if (p.kind === 'declareBlockers') a = { kind: 'declareBlockers', blocks: [] };
    else if (p.kind === 'priority') { if (s.zones.stack.length === 0 && (sc.until === undefined || sc.until(s))) break; s = mpass(s); continue; }
    else throw new Error(`unexpected ${p.kind}: ${p.prompt}`);
    s = manswer(s, a);
  }
  return s;
}
const toMain = (s: GameState, player: PlayerId): GameState => passUntil(s, (x) => x.turn.activePlayer === player && x.turn.step === 'main1' && x.pending?.kind === 'priority', `${player}'s main phase`);
const castIt = (s: GameState, player: PlayerId, name: string): GameState => mact(s, { type: 'cast', player, card: mfind(s, name, 'hand', player) });
const cardAt = (name: string, type: string, text: string, ptv?: [string, string], cost = '{0}') => card(name, type, text, ptv, cost);
const bf = (s: GameState, defId: string, p?: PlayerId): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === defId && (p === undefined || s.objects[id]!.controller === p));
const hand = (s: GameState, p: PlayerId, defId: string): ObjectId[] => s.zones.hand[p]!.filter((id) => s.objects[id]!.defId === defId);
const lib = (s: GameState, p: PlayerId, defId: string): ObjectId[] => s.zones.library[p]!.filter((id) => s.objects[id]!.defId === defId);
const byName = (s: GameState, ids: ObjectId[]): string[] => ids.map((id) => s.objects[id]!.defId);

describe('CR 101.4, 701.23a, 701.24a: Old-Growth Dryads (eff.edhe42.eachOpponentMay.search.bfTapped.shuffle)', () => {
  const DRY = cardAt('Test Old Dryad', 'Creature — Dryad', 'When this creature enters, each opponent may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.', ['3', '3']);
  const defs = [DRY];
  const game = (): GameState => toMain(mpScenario({ defs, cards: ['Forest'], zones: { p1: { hand: ['Test Old Dryad'], library: ['Plains'] }, p2: { library: ['Forest'] }, p3: { library: ['Forest'] }, p4: { library: ['Forest'] } } }), 'p1');
  it('is automated', () => expect(full(DRY)).toBe(true));
  it('each opponent chooses for themselves: p2 and p4 put a tapped Forest onto the battlefield under their own control, p3 declines, I (the caster) get nothing', () => {
    let s = game();
    s = run(castIt(s, 'p1', 'Test Old Dryad'), { yes: (_p, who) => who !== 'p3', objects: (o) => o.slice(0, 1) });
    for (const p of ['p2', 'p4'] as PlayerId[]) { const f = bf(s, 'Forest', p); expect(f).toHaveLength(1); expect(s.objects[f[0]!]!.tapped).toBe(true); }
    expect(bf(s, 'Forest', 'p3')).toHaveLength(0);
    expect(bf(s, 'Forest', 'p1')).toHaveLength(0);
    expect(lib(s, 'p3', 'Forest')).toHaveLength(1);
  });
});

describe('CR 201.2, 701.23a: Pattern Matcher (sharesWith name, another creature you control)', () => {
  const PM = cardAt('Test Twin Finder', 'Creature — Shapeshifter', 'When this creature enters, you may search your library for a card with the same name as another creature you control, reveal it, put it into your hand, then shuffle.', ['1', '1']);
  const BEAR = cardAt('Test Bear R', 'Creature — Bear', '', ['2', '2']);
  const ELK = cardAt('Test Elk R', 'Creature — Elk', '', ['3', '3']);
  const defs = [PM, BEAR, ELK];
  it('is automated', () => expect(full(PM)).toBe(true));
  it('finds a copy of another creature I control (the Bear), not a card whose name no creature of mine has (the Elk)', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { hand: ['Test Twin Finder'], battlefield: ['Test Bear R'], library: ['Plains', 'Test Elk R', 'Test Bear R'] } } }), 'p1');
    let offered: string[] = [];
    s = run(castIt(s, 'p1', 'Test Twin Finder'), { objects: (o, _p, st) => { offered = byName(st, o); return o.slice(0, 1); } });
    expect(offered).toEqual(['Test Bear R']);
    expect(hand(s, 'p1', 'Test Bear R')).toHaveLength(1);
    expect(hand(s, 'p1', 'Test Elk R')).toHaveLength(0);
  });
  it('the Matcher itself is not "another creature": a second copy of it in the library is not offered when it is my only creature (the negative case)', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { hand: ['Test Twin Finder'], library: ['Plains', 'Test Twin Finder', 'Test Elk R'] } } }), 'p1');
    let offered: string[] = ['unset'];
    s = run(castIt(s, 'p1', 'Test Twin Finder'), { objects: (o, _p, st) => { offered = byName(st, o); return o.slice(0, 1); } });
    expect(offered.includes('Test Twin Finder')).toBe(false);
    expect(hand(s, 'p1', 'Test Twin Finder')).toHaveLength(0);
  });
  it('an opponent\'s creature does not count (the negative case)', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { hand: ['Test Twin Finder'], library: ['Plains', 'Test Bear R'] }, p2: { battlefield: ['Test Bear R'] } } }), 'p1');
    s = run(castIt(s, 'p1', 'Test Twin Finder'), { objects: (o) => o.slice(0, 1) });
    expect(hand(s, 'p1', 'Test Bear R')).toHaveLength(0);
  });
});

describe('CR 701.20a, 110.2, 608.2d: Treacherous Urge (put a creature card from their hand under my control)', () => {
  const TU = cardAt('Test Sly Urge', 'Instant', 'Target opponent reveals their hand. You may put a creature card from it onto the battlefield under your control. That creature gains haste. Sacrifice it at the beginning of the next end step.');
  const BEAR = cardAt('Test Bear U', 'Creature — Bear', '', ['2', '2']);
  const ROCK = cardAt('Test Rock U', 'Artifact', '');
  const defs = [TU, BEAR, ROCK];
  it('is automated', () => expect(full(TU)).toBe(true));
  it('the Bear leaves p2\'s hand, enters under MY control with haste, and is sacrificed at the next end step; only creature cards are offered', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { hand: ['Test Sly Urge'] }, p2: { hand: ['Test Rock U', 'Test Bear U'] } } }), 'p1');
    let offered: string[] = [];
    s = run(castIt(s, 'p1', 'Test Sly Urge'), { playerTargets: ['p2'], objects: (o, _p, st) => { offered = byName(st, o); return o.slice(0, 1); } });
    expect(offered).toEqual(['Test Bear U']);
    const bear = bf(s, 'Test Bear U', 'p1')[0]!;
    expect(hasKeyword(getChars(s, bear)!, 'haste')).toBe(true);
    expect(hand(s, 'p2', 'Test Rock U')).toHaveLength(1);
    s = run(s, { until: (x) => bf(x, 'Test Bear U').length === 0 });
    expect(bf(s, 'Test Bear U')).toHaveLength(0);
  });
});

describe('CR 603.2c, 510.2, 506.4: Arashin War Beast (combat damage to one or more blocking creatures)', () => {
  const BEAST = cardAt('Test War Hog', 'Creature — Beast', 'Whenever this creature deals combat damage to one or more blocking creatures, manifest the top card of your library.', ['3', '3']);
  const BEAR = cardAt('Test Bear V', 'Creature — Bear', '', ['2', '2']);
  const ELK = cardAt('Test Elk V', 'Creature — Elk', '', ['1', '1']);
  const defs = [BEAST, BEAR, ELK];
  it('is automated', () => expect(full(BEAST)).toBe(true));
  it('blocked by a Bear: the damage to the blocker manifests my top card (a face-down creature appears)', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { battlefield: ['Test War Hog'], library: ['Plains', 'Test Elk V', 'Test Elk V'] }, p2: { battlefield: ['Test Bear V'] } } }), 'p1');
    const hog = bf(s, 'Test War Hog', 'p1')[0]!;
    s = declareAttackers(toDeclareAttackers(s), [[hog, 'p2']]);
    s = toDeclareBlockers(s);
    s = declareBlockers(s, [[bf(s, 'Test Bear V', 'p2')[0]!, hog]]);
    s = run(toStep(s, 'endCombat'), { until: (x) => x.turn.step === 'endCombat' });
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p1' && s.objects[id]!.defId !== 'Test War Hog')).toHaveLength(1);
  });
  it('unblocked (damage goes to the player): no manifest (the negative case)', () => {
    let s = toMain(mpScenario({ defs, zones: { p1: { battlefield: ['Test War Hog'], library: ['Plains', 'Test Elk V', 'Test Elk V'] }, p2: { battlefield: ['Test Bear V'] } } }), 'p1');
    const hog = bf(s, 'Test War Hog', 'p1')[0]!;
    s = declareAttackers(toDeclareAttackers(s), [[hog, 'p2']]);
    s = toDeclareBlockers(s);
    s = declareBlockers(s, []);
    s = run(toStep(s, 'endCombat'), { until: (x) => x.turn.step === 'endCombat' });
    expect(s.zones.battlefield.filter((id) => s.objects[id]!.controller === 'p1' && s.objects[id]!.defId !== 'Test War Hog')).toHaveLength(0);
  });
});
