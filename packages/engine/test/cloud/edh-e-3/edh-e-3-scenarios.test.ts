/**
 * Commander lane dice-random, round edh-e-3 (coordinator E): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler. Random outcomes are checked over many seeds against the invariants of the rule (a seed changes the RNG only); each test names the rule it checks, with its negative case.
 *
 *   CR 608.2d, 701.8a      "Choose three target nonenchantment permanents. Destroy one of them at random." (Wild Swing)
 *   CR 701.20a, 608.2d, 201.2, 607.2d  "Choose a card name, then reveal a card at random from your hand. If that card has the chosen name, ..." (Cursed Scroll, Magus of the Scroll, Dementia Sliver)
 *   CR 701.20a, 118.12, 608.2c  "Target player reveals a card at random from their hand. If it's a land card, that player discards it unless they pay 1 life. ..." (Wand of Ith)
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type PlayerId } from '../../../src/index';
import { act, answer, find, findAll, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string } = {}): CardDef {
  return compileCard({
    name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: [], keywords: [],
    ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}),
  } as OracleCard);
}
const noManual = (d: CardDef): boolean => !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const SEEDS = Array.from({ length: 16 }, (_, i) => `e3-${i}`);

/** Answer the decisions that come up until priority. `name`: the card name chosen; `targets`: the objects to target; `life`: whether a player pays life when asked. */
function drive(s0: GameState, o: { targets?: ObjectId[]; name?: string; pay?: boolean; player?: PlayerId } = {}): GameState {
  let s = s0;
  const wanted = [...(o.targets ?? [])];
  for (let guard = 0; guard < 80 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending as unknown as { kind: string; options?: { id: string; label?: string }[]; min?: number; max?: number; prompt?: string };
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') {
      const d = p as unknown as { players: PlayerId[]; objects: ObjectId[]; min: number; max: number };
      if (d.objects.length > 0) {
        const picked = wanted.length > 0 ? wanted.splice(0, d.max) : d.objects.slice(0, d.max);
        s = answer(s, { kind: 'chooseTargets', targets: picked.map((id) => ({ kind: 'object', id })) });
      } else s = answer(s, { kind: 'chooseTargets', targets: d.min === 0 ? [] : [{ kind: 'player', id: o.player ?? d.players[0]! }] });
    } else if (p.kind === 'chooseOption') {
      const opts = p.options ?? [];
      const named = o.name !== undefined ? opts.find((x) => x.id === o.name || x.label === o.name) : undefined;
      s = answer(s, { kind: 'chooseOption', ids: named ? [named.id] : opts.slice(0, p.min ?? 1).map((x) => x.id) });
    } else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: ((p as unknown as { options: ObjectId[] }).options).slice(0, p.max ?? 1) });
    else if (p.kind === 'chooseName') s = answer(s, { kind: 'chooseName', name: o.name ?? '' });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: o.pay ?? true });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: (p as unknown as { items: { id: ObjectId }[] }).items.map((x) => x.id) });
    else throw new Error(`unexpected decision ${p.kind} ${JSON.stringify(p).slice(0, 300)}`);
  }
  return s;
}
function resolveAll(s0: GameState, o: Parameters<typeof drive>[1] = {}): GameState {
  let s = drive(s0, o);
  for (let i = 0; i < 30 && s.zones.stack.length > 0; i++) s = drive(pass(s), o);
  return s;
}
const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;

// ---- Wild Swing -----------------------------------------------------------------------------------------------------------------------------------------------
const SWING = card('Test Wild Swing', 'Sorcery', 'Choose three target nonenchantment permanents. Destroy one of them at random.');
const GIZMO = (n: string, text = ''): CardDef => card(n, 'Artifact', text);
describe('CR 608.2d, 701.8a: "Choose three target nonenchantment permanents. Destroy one of them at random."', () => {
  it('is fully automated', () => { expect(noManual(SWING) && SWING.automation.level === 'full').toBe(true); });
  it('exactly one of the three targets is destroyed, picked by the game: each of them is the one destroyed over the seeds', () => {
    const hit = new Set<string>();
    for (const seed of SEEDS) {
      const s0 = scenario([], { seed, defs: [SWING, GIZMO('Test Gizmo A'), GIZMO('Test Gizmo B'), GIZMO('Test Gizmo C')], p1: { hand: ['Test Wild Swing'] }, p2: { battlefield: ['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C'] } });
      const ids = ['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C'].map((n) => find(s0, n, 'battlefield', 'p2'));
      const s = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Wild Swing', 'hand', 'p1') }), { targets: ids });
      const gone = ['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C'].filter((n) => findAll(s, n, 'battlefield', 'p2').length === 0);
      expect(gone.length, seed).toBe(1);
      hit.add(gone[0]!);
    }
    expect([...hit].sort()).toEqual(['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C']);
  });
  it('negative: a permanent that is not a target is never destroyed (a fourth artifact stays over every seed)', () => {
    for (const seed of SEEDS) {
      const s0 = scenario([], { seed, defs: [SWING, GIZMO('Test Gizmo A'), GIZMO('Test Gizmo B'), GIZMO('Test Gizmo C'), GIZMO('Test Gizmo D')], p1: { hand: ['Test Wild Swing'] }, p2: { battlefield: ['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C', 'Test Gizmo D'] } });
      const ids = ['Test Gizmo A', 'Test Gizmo B', 'Test Gizmo C'].map((n) => find(s0, n, 'battlefield', 'p2'));
      const s = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Wild Swing', 'hand', 'p1') }), { targets: ids });
      expect(findAll(s, 'Test Gizmo D', 'battlefield', 'p2').length, seed).toBe(1);
    }
  });
  it('an indestructible target is still one of the permanents picked from: it survives when picked (nothing is destroyed), so over the seeds sometimes none and sometimes a normal one is destroyed', () => {
    const outcomes = new Set<string>();
    for (const seed of Array.from({ length: 24 }, (_, i) => `e3-ind${i}`)) {
      const s0 = scenario([], { seed, defs: [SWING, GIZMO('Test Gizmo X', 'Indestructible'), GIZMO('Test Gizmo Y'), GIZMO('Test Gizmo Z')], p1: { hand: ['Test Wild Swing'] }, p2: { battlefield: ['Test Gizmo X', 'Test Gizmo Y', 'Test Gizmo Z'] } });
      const ids = ['Test Gizmo X', 'Test Gizmo Y', 'Test Gizmo Z'].map((n) => find(s0, n, 'battlefield', 'p2'));
      const s = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Wild Swing', 'hand', 'p1') }), { targets: ids });
      expect(findAll(s, 'Test Gizmo X', 'battlefield', 'p2').length, seed).toBe(1);
      outcomes.add(['Test Gizmo Y', 'Test Gizmo Z'].filter((n) => findAll(s, n, 'battlefield', 'p2').length === 0).join('+') || 'none');
    }
    expect([...outcomes].sort()).toEqual(['Test Gizmo Y', 'Test Gizmo Z', 'none']); // the pick is not steered away from the indestructible one (unlike Chaos Defiler's ruling)
  });
});

// ---- Cursed Scroll ----------------------------------------------------------------------------------------------------------------------------------------------
const SCROLL = card('Test Cursed Tome', 'Artifact', '{0}, {T}: Choose a card name, then reveal a card at random from your hand. If that card has the chosen name, this artifact deals 2 damage to any target.');
describe('CR 701.20a, 608.2d, 201.2: "Choose a card name, then reveal a card at random from your hand. If that card has the chosen name, ... deals 2 damage to any target."', () => {
  it('is fully automated', () => { expect(noManual(SCROLL) && SCROLL.automation.level === 'full').toBe(true); });
  const run = (name: string, hand: string[], seed = 'e3-scroll') => {
    const s0 = scenario([], { seed, defs: [SCROLL, GIZMO('Test Gizmo A'), GIZMO('Test Gizmo B')], p1: { battlefield: [{ name: 'Test Cursed Tome', since: -1 }], hand } });
    const tome = find(s0, 'Test Cursed Tome', 'battlefield', 'p1');
    return { s0, s: resolveAll(act(s0, { type: 'activate', player: 'p1', source: tome, ability: 'p:0:0' } as never), { name }) };
  };
  it('the hand holds one card: naming it deals 2 damage to the target, naming another card deals none', () => {
    const hit = run('Test Gizmo A', ['Test Gizmo A']);
    expect(lifeOf(hit.s, 'p2') < lifeOf(hit.s0, 'p2') || lifeOf(hit.s, 'p1') < lifeOf(hit.s0, 'p1')).toBe(true);
    const miss = run('Test Gizmo B', ['Test Gizmo A']);
    expect(lifeOf(miss.s, 'p2')).toBe(lifeOf(miss.s0, 'p2'));
    expect(lifeOf(miss.s, 'p1')).toBe(lifeOf(miss.s0, 'p1'));
  });
  it("ruling 2008-08-01: with no cards in hand nothing is revealed, so no damage is dealt", () => {
    const { s, s0 } = run('Test Gizmo A', []);
    expect(lifeOf(s, 'p2')).toBe(lifeOf(s0, 'p2'));
    expect(lifeOf(s, 'p1')).toBe(lifeOf(s0, 'p1'));
  });
});

// ---- Wand of Ith ------------------------------------------------------------------------------------------------------------------------------------------------
const WAND = card('Test Ith Rod', 'Artifact', '{0}, {T}: Target player reveals a card at random from their hand. If it\'s a land card, that player discards it unless they pay 1 life. If it isn\'t a land card, the player discards it unless they pay life equal to its mana value. Activate only during your turn.');
describe('CR 701.20a, 118.12, 608.2c: Wand of Ith: a revealed land is discarded unless 1 life is paid; another card unless life equal to its mana value is paid', () => {
  it('is fully automated', () => { expect(noManual(WAND) && WAND.automation.level === 'full').toBe(true); });
  const SPELL = card('Test Costly Spell', 'Sorcery', '', { cost: '{2}{R}' });
  const run = (hand: string[], pay: boolean) => {
    const s0 = scenario([], { seed: 'e3-wand', defs: [WAND, SPELL], p1: { battlefield: [{ name: 'Test Ith Rod', since: -1 }] }, p2: { hand } });
    const rod = find(s0, 'Test Ith Rod', 'battlefield', 'p1');
    return { s0, s: resolveAll(act(s0, { type: 'activate', player: 'p1', source: rod, ability: 'p:0:0' } as never), { pay, player: 'p2' }) };
  };
  it('a revealed land: not paying discards it; paying 1 life keeps it', () => {
    const no = run(['Plains'], false);
    expect(no.s.zones.hand.p2!.length).toBe(0);
    expect(lifeOf(no.s, 'p2')).toBe(lifeOf(no.s0, 'p2'));
    const yes = run(['Plains'], true);
    expect(yes.s.zones.hand.p2!.length).toBe(1);
    expect(lifeOf(yes.s, 'p2')).toBe(lifeOf(yes.s0, 'p2') - 1);
  });
  it('review finding: with no card in the target\'s hand nothing is revealed and nothing happens (no payment is asked, no life is lost)', () => {
    const { s, s0 } = run([], true);
    expect(lifeOf(s, 'p2')).toBe(lifeOf(s0, 'p2'));
    expect(s.pending?.kind === 'priority' || s.pending === undefined || s.pending === null).toBe(true);
  });
  it('a revealed nonland card: paying life equal to its mana value (3) keeps it; not paying discards it', () => {
    const yes = run(['Test Costly Spell'], true);
    expect(yes.s.zones.hand.p2!.length).toBe(1);
    expect(lifeOf(yes.s, 'p2')).toBe(lifeOf(yes.s0, 'p2') - 3);
    const no = run(['Test Costly Spell'], false);
    expect(no.s.zones.hand.p2!.length).toBe(0);
  });
});

// ---- Diviner's Lockbox (the generic "if that card has the chosen name" over a revealed top card) ---------------------------------------------------------------
const BOX = card('Test Seer Box', 'Artifact', '{0}, {T}: Choose a card name, then reveal the top card of your library. If that card has the chosen name, sacrifice this artifact and draw three cards. Activate only as a sorcery.');
describe('CR 701.20a, 201.2: "Choose a card name, then reveal the top card of your library. If that card has the chosen name, sacrifice this artifact and draw three cards."', () => {
  it('is fully automated', () => { expect(noManual(BOX) && BOX.automation.level === 'full').toBe(true); });
  const run = (name: string) => {
    const s0 = scenario([], { seed: 'e3-box', defs: [BOX, GIZMO('Test Gizmo A'), GIZMO('Test Gizmo B')], p1: { battlefield: [{ name: 'Test Seer Box', since: -1 }], library: ['Test Gizmo A', 'Plains', 'Plains', 'Plains', 'Plains'] } });
    const box = find(s0, 'Test Seer Box', 'battlefield', 'p1');
    return { s0, s: resolveAll(act(s0, { type: 'activate', player: 'p1', source: box, ability: 'p:0:0' } as never), { name }) };
  };
  it('naming the top card sacrifices the artifact and draws three cards; naming another card does neither', () => {
    const hit = run('Test Gizmo A');
    expect(findAll(hit.s, 'Test Seer Box', 'battlefield', 'p1').length).toBe(0);
    expect(hit.s.zones.hand.p1!.length).toBe(hit.s0.zones.hand.p1!.length + 3);
    const miss = run('Test Gizmo B');
    expect(findAll(miss.s, 'Test Seer Box', 'battlefield', 'p1').length).toBe(1);
    expect(miss.s.zones.hand.p1!.length).toBe(miss.s0.zones.hand.p1!.length);
  });
});
