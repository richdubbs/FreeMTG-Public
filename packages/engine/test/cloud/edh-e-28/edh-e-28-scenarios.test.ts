/**
 * Round edh-e-28 (coordinator E, group "enters-leaves", code edhe28): the round's readings and engine pieces played through the engine with synthetic cards (invented names, design 6.10),
 * compiled by the game's default compiler. Each test names the rule it checks, with its negative case. CR cites: 614.12a, 613.2a, 701.17a, 702.33d, 702.29c, 603.10a (from memory, unverified).
 */
import { describe, expect, it } from 'vitest';
import { compileCard, getChars, type CardDef, type DecisionAnswer, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { act, answer, find, legal, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"');
const land = (name: string, sub: string, mana: string): CardDef => compileCard({ name, layout: 'normal', mana_cost: '', type_line: `Basic Land — ${sub}`, oracle_text: `({T}: Add {${mana}}.)`, colors: [] } as OracleCard);
const ISLAND = land('Island', 'Island', 'U');
const SWAMP = land('Swamp', 'Swamp', 'B');

interface Opts { targets?: { kind: 'object'; id: ObjectId }[][]; answers?: DecisionAnswer[] }
function settle(s0: GameState, o: Opts = {}): GameState {
  let s = s0;
  for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 40; guard++) {
    const p = s.pending;
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets' && o.targets && o.targets.length > 0) s = answer(s, { kind: 'chooseTargets', targets: o.targets.shift()! } as never);
    else if (o.answers && o.answers.length > 0) s = answer(s, o.answers.shift()!);
    else break;
  }
  return s;
}
function drain(s0: GameState, o: Opts): GameState {
  let s = s0;
  for (let guard = 0; s.pending?.kind === 'priority' && s.zones.stack.length > 0 && guard < 40; guard++) s = settle(pass(s), o);
  return s;
}
const cast = (s0: GameState, name: string, o: Opts = {}): GameState => drain(settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') } as never), o), o);
/** Cast answering the kicker questions: `kicks` = how many kicker costs to pay (the first N options). */
function castKicked(s0: GameState, name: string, kicks: number): GameState {
  let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') } as never);
  let left = kicks;
  for (let k = 0; k < 20 && s.pending && s.pending.kind !== 'priority'; k++) {
    const d = s.pending as unknown as { kind: string; options?: { id: string }[]; max?: number };
    if (d.kind === 'yesNo') { s = answer(s, { kind: 'yesNo', yes: left > 0 }); left = Math.max(0, left - 1); }
    else if (d.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: d.options!.slice(0, left).map((x) => x.id) } as never);
    else s = settle(s);
  }
  return drain(s, {});
}
function cycle(s0: GameState, name: string): GameState {
  const id = find(s0, name, 'hand', 'p1');
  const la = legal(s0, 'p1', 'activate').find((a) => a.object === id && !a.isMana);
  if (!la) throw new Error(`no cycling for ${name}`);
  return drain(settle(act(s0, la.action)), {});
}
const lib = (s: GameState, p = 'p1'): number => Object.values(s.objects).filter((o) => o.zone === 'library' && o.owner === p).length;
const lifeOf = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const stat = (s: GameState, id: ObjectId): string => { const c = getChars(s, id)!; return `${c.power}/${c.toughness}`; };
const kw = (s: GameState, id: ObjectId): string[] => getChars(s, id)!.keywords.map((k) => (typeof k === 'string' ? k : (k as { keyword?: string }).keyword ?? ''));
const defs = (...d: CardDef[]): CardDef[] => [ISLAND, SWAMP, ...d];

// ---- Primal Plasma: "As ~ enters, it becomes your choice of a 3/3 creature, a 2/2 creature with flying, or a 1/6 creature with defender." --------------------------------
describe('CR 614.12a, 613.2a: "As ~ enters, it becomes your choice of a 3/3 creature, a 2/2 creature with flying, or a 1/6 creature with defender."', () => {
  const PLASMA = card('Test Plasma', 'Creature — Elemental Shapeshifter', 'As ~ enters, it becomes your choice of a 3/3 creature, a 2/2 creature with flying, or a 1/6 creature with defender.', ['0', '0'], '{0}');
  const play = (pick: number): { s: GameState; id: ObjectId } => {
    const s0 = scenario([], { defs: [PLASMA], p1: { hand: ['Test Plasma'] } });
    const s = cast(s0, 'Test Plasma', { answers: [{ kind: 'chooseOption', ids: [String(pick)] } as never] });
    return { s, id: find(s, 'Test Plasma', 'battlefield', 'p1') };
  };
  it('is full', () => expect(full(PLASMA)).toBe(true));
  it('first option: a 3/3 with no abilities', () => { const { s, id } = play(0); expect(stat(s, id)).toBe('3/3'); expect(kw(s, id)).not.toContain('flying'); expect(kw(s, id)).not.toContain('defender'); });
  it('second option: a 2/2 with flying', () => { const { s, id } = play(1); expect(stat(s, id)).toBe('2/2'); expect(kw(s, id)).toContain('flying'); });
  it('third option: a 1/6 with defender (negative: not flying)', () => { const { s, id } = play(2); expect(stat(s, id)).toBe('1/6'); expect(kw(s, id)).toContain('defender'); expect(kw(s, id)).not.toContain('flying'); });
});

// ---- Monstrous War-Leech / Urborg Lhurgoyf: milled as it enters --------------------------------------------------------------------------------------------------------------
describe('CR 614.12a, 701.17a, 702.33d: "As ~ enters, if it was kicked, mill four cards."', () => {
  const LEECH = card('Test Leech', 'Creature — Leech', 'Kicker {U}\nAs ~ enters, if it was kicked, mill four cards.', ['1', '1'], '{0}');
  it('is full', () => expect(full(LEECH)).toBe(true));
  it('kicked: its controller mills four cards before it is on the battlefield', () => {
    const s0 = scenario([], { defs: defs(LEECH), p1: { hand: ['Test Leech'], battlefield: ['Island'] } });
    const s = castKicked(s0, 'Test Leech', 1);
    expect(find(s, 'Test Leech', 'battlefield', 'p1')).toBeDefined();
    expect(lib(s)).toBe(lib(s0) - 4);
    expect(lib(s, 'p2')).toBe(lib(s0, 'p2'));
  });
  it('negative: not kicked, nothing is milled', () => {
    const s0 = scenario([], { defs: defs(LEECH), p1: { hand: ['Test Leech'], battlefield: ['Island'] } });
    const s = castKicked(s0, 'Test Leech', 0);
    expect(find(s, 'Test Leech', 'battlefield', 'p1')).toBeDefined();
    expect(lib(s)).toBe(lib(s0));
  });
});

describe('CR 614.12a, 701.17a, 702.33d: "As ~ enters, mill three cards for each time it was kicked."', () => {
  const GOYF = card('Test Goyf', 'Creature — Lhurgoyf', 'Kicker {U} and/or {B}\nAs ~ enters, mill three cards for each time it was kicked.', ['1', '1'], '{0}');
  const run = (kicks: number): { s: GameState; s0: GameState } => {
    const s0 = scenario([], { defs: defs(GOYF), p1: { hand: ['Test Goyf'], battlefield: ['Island', 'Swamp'] } });
    return { s: castKicked(s0, 'Test Goyf', kicks), s0 };
  };
  it('is full', () => expect(full(GOYF)).toBe(true));
  it('kicked twice: six cards', () => { const { s, s0 } = run(2); expect(lib(s)).toBe(lib(s0) - 6); });
  it('kicked once: three cards', () => { const { s, s0 } = run(1); expect(lib(s)).toBe(lib(s0) - 3); });
  it('negative: not kicked, nothing is milled', () => { const { s, s0 } = run(0); expect(lib(s)).toBe(lib(s0)); expect(find(s, 'Test Goyf', 'battlefield', 'p1')).toBeDefined(); });
});

// ---- Esper / Bant Sojourners: "When you cycle ~ and when ~ dies, ..." ---------------------------------------------------------------------------------------------------
describe('CR 702.29c, 603.10a: "When you cycle ~ and when ~ dies, you gain 2 life."', () => {
  const SOJ = card('Test Sojourners', 'Creature — Soldier', 'When you cycle ~ and when ~ dies, you gain 2 life.\nCycling {0}', ['1', '1'], '{2}');
  const KILL = card('Test Kill', 'Instant', 'Destroy target creature.');
  const MIND = card('Test Mind', 'Sorcery', 'Target player discards a card.');
  it('is full', () => expect(full(SOJ)).toBe(true));
  it('cycled: the trigger happens once, from the graveyard', () => {
    const s0 = scenario([], { defs: defs(SOJ), p1: { hand: ['Test Sojourners'] } });
    expect(lifeOf(cycle(s0, 'Test Sojourners'), 'p1')).toBe(lifeOf(s0, 'p1') + 2);
  });
  it('dies on the battlefield: the trigger happens once (no second one from the graveyard)', () => {
    const s0 = scenario([], { defs: defs(SOJ, KILL), p1: { hand: ['Test Kill'], battlefield: ['Test Sojourners'] } });
    const id = find(s0, 'Test Sojourners', 'battlefield', 'p1');
    const s = cast(s0, 'Test Kill', { targets: [[{ kind: 'object', id }]] });
    expect(s.objects[find(s, 'Test Sojourners', 'graveyard', 'p1')]).toBeDefined();
    expect(lifeOf(s, 'p1')).toBe(lifeOf(s0, 'p1') + 2);
  });
  it('a token copy of it that dies triggers once (not once from the battlefield and once from the graveyard)', () => {
    const COPY = card('Test Copier', 'Sorcery', 'Create a token that\'s a copy of target creature you control.');
    const s0 = scenario([], { defs: defs(SOJ, KILL, COPY), p1: { hand: ['Test Copier', 'Test Kill'], battlefield: ['Test Sojourners'] } });
    const orig = find(s0, 'Test Sojourners', 'battlefield', 'p1');
    let s = cast(s0, 'Test Copier', { targets: [[{ kind: 'object', id: orig }]] });
    const token = Object.values(s.objects).find((o) => o.kind === 'token' && o.zone === 'battlefield')!.id;
    const before = lifeOf(s, 'p1');
    s = cast(s, 'Test Kill', { targets: [[{ kind: 'object', id: token }]] });
    expect(lifeOf(s, 'p1')).toBe(before + 2);
  });
  it('negative: discarded (not cycled) from the hand, it does not trigger', () => {
    const s0 = scenario([], { defs: defs(SOJ, MIND), p1: { hand: ['Test Mind', 'Test Sojourners'] } });
    const s = cast(s0, 'Test Mind', { targets: [[{ kind: 'player', id: 'p1' } as never]], answers: [{ kind: 'chooseObjects', ids: [find(s0, 'Test Sojourners', 'hand', 'p1')] } as never] });
    expect(lifeOf(s, 'p1')).toBe(lifeOf(s0, 'p1'));
  });
});
