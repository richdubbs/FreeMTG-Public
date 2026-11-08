/**
 * edh-d-103 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups replace-prevent and cost; code edhd103): the round's readings played through the engine with synthetic cards
 * compiled by the game's default compiler (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its negative case. Scryfall
 * rulings were fetched in the cloud session; CR cites checked against the 2026-09-25 text (media.wizards.com) unless the record lists them as unverified.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find } from '../../m3/scenario';
import { lifeOf, mpScenario } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const pl = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;
const obj = (id: string): TargetChoice => ({ kind: 'object', id }) as TargetChoice;
const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const onBf = (s: GameState, name: string, player?: PlayerId): string[] => s.zones.battlefield.filter((id) => nameOf(s, id) === name && (player === undefined || s.objects[id]!.controller === player));

interface Script { colors?: string[]; yes?: boolean[]; targets?: TargetChoice[][]; options?: (string[] | 'all')[]; objects?: string[][]; division?: number[][]; numbers?: number[]; log?: string[] }
/** Answer the decisions that come up until someone has priority. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    script.log?.push(p.kind);
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: script.numbers?.shift() ?? 0 });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: ((o) => o === 'all' ? p.options.map((x) => x.id) : o ?? p.options.slice(0, p.min).map((x) => x.id))(script.options?.shift()) });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: script.objects?.shift() ?? (p.options as string[]).slice(0, p.min) });
    else if (p.kind === 'chooseDivision') s = answer(s, { kind: 'chooseDivision', amounts: script.division?.shift() ?? p.targets.map((_, i) => (i === 0 ? p.total - p.targets.length + 1 : 1)) });
    else if (p.kind === 'chooseColor') s = answer(s, { kind: 'chooseColor', color: script.colors?.shift() ?? p.options[0] } as never);
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
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
const dmg = (s: GameState, id: string): number => s.objects[id]!.damage;

const BEAR = card('Test Sturdy Bear', 'Creature — Bear', '', { pt: ['2', '9'] });
const ZAP = card('Test Zap Four', 'Instant', '~ deals 4 damage to any target.', { colors: ['R'] });
const ZAP2 = card('Test Second Zap', 'Instant', '~ deals 4 damage to any target.', { colors: ['R'] });

// ---- Prevention with an additional instruction (Vengeful Archon, Honorable Passage, Samite Ministration) ------------------------------------------------------------------------------

const GREEN_ZAP = card('Test Green Zap', 'Instant', '~ deals 4 damage to any target.', { colors: ['G'] });
const WHITE_ZAP = card('Test White Zap', 'Instant', '~ deals 4 damage to any target.', { colors: ['W'] });

describe('CR 615.5, 615.7: "{X}: Prevent the next X damage that would be dealt to you this turn. If damage is prevented this way, ~ deals that much damage to target player or planeswalker."', () => {
  const ARCHON = card('Test Vengeful Warden', 'Creature — Archon', 'Flying\n{X}: Prevent the next X damage that would be dealt to you this turn. If damage is prevented this way, this creature deals that much damage to target player or planeswalker.', { pt: ['5', '5'] });
  const setup = (): GameState => mpScenario({ defs: [ARCHON, ZAP, BEAR], zones: { p1: { hand: ['Test Zap Four'], battlefield: ['Test Vengeful Warden', 'Plains', 'Plains', 'Plains'] }, p2: { battlefield: ['Test Sturdy Bear'] } } });
  const activate = (s0: GameState, x: number, target: TargetChoice): GameState => settle(drive(act(s0, { type: 'activate', player: 'p1', source: onBf(s0, 'Test Vengeful Warden')[0]!, ability: 'p:0:1' } as never), { numbers: [x], targets: [[target]] }));
  it('is automated', () => expect(full(ARCHON)).toBe(true));
  it('X = 3, 4 damage to me: 3 prevented, 1 dealt; the target player is dealt the 3 prevented (Vengeful Archon rulings 2010-08-15)', () => {
    const s0 = setup();
    const s1 = activate(s0, 3, pl('p2'));
    const [me, foe] = [lifeOf(s1, 'p1'), lifeOf(s1, 'p2')];
    const s2 = cast(s1, 'Test Zap Four', { targets: [[pl('p1')]] });
    expect(lifeOf(s2, 'p1')).toBe(me - 1);
    expect(lifeOf(s2, 'p2')).toBe(foe - 3);
  });
  it('negative: damage to my creature is not prevented and nothing is dealt to the target player', () => {
    const s0 = mpScenario({ defs: [ARCHON, ZAP, BEAR], zones: { p1: { hand: ['Test Zap Four'], battlefield: ['Test Vengeful Warden', 'Plains', 'Plains', 'Plains', 'Test Sturdy Bear'] } } });
    const s1 = activate(s0, 3, pl('p2'));
    const foe = lifeOf(s1, 'p2');
    const bear = onBf(s1, 'Test Sturdy Bear', 'p1')[0]!;
    const s2 = cast(s1, 'Test Zap Four', { targets: [[obj(bear)]] });
    expect(dmg(s2, bear)).toBe(4);
    expect(lifeOf(s2, 'p2')).toBe(foe);
  });
});

/** p1 casts a zap at `target`; p2, given priority with the zap on the stack, casts `response` choosing the zap as the source. */
function zapAndRespond(s0: GameState, zap: string, target: TargetChoice, response: string, script: Script = {}): GameState {
  const s1 = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, zap, 'hand', 'p1') }), { targets: [[target]] });
  const zapId = s1.zones.stack[s1.zones.stack.length - 1]!;
  const s2 = drive(act(s1, { type: 'pass', player: 'p1' }));
  expect(s2.pending?.kind === 'priority' && s2.pending.player).toBe('p2');
  const all: Script = { objects: [[zapId]], ...script };
  return settle(drive(act(s2, { type: 'cast', player: 'p2', card: find(s2, response, 'hand', 'p2') }), all), all);
}

describe('CR 609.7a, 615.5, 105.2: "The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a red source is prevented this way, ~ deals that much damage to the source\'s controller."', () => {
  const PASS = card('Test Honor Shield', 'Instant', "The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a red source is prevented this way, Test Honor Shield deals that much damage to the source's controller.", { colors: ['W'] });
  const setup = (): GameState => mpScenario({ defs: [PASS, ZAP, GREEN_ZAP, BEAR], zones: { p1: { hand: ['Test Zap Four', 'Test Green Zap'] }, p2: { hand: ['Test Honor Shield'], battlefield: ['Test Sturdy Bear'] } } });
  it('is automated', () => expect(full(PASS)).toBe(true));
  it('a red source: its 4 damage to the creature is prevented and its controller is dealt 4', () => {
    const s0 = setup();
    const bear = onBf(s0, 'Test Sturdy Bear', 'p2')[0]!;
    const life = lifeOf(s0, 'p1');
    const s = zapAndRespond(s0, 'Test Zap Four', obj(bear), 'Test Honor Shield', { targets: [[obj(bear)]] });
    expect(dmg(s, bear)).toBe(0);
    expect(lifeOf(s, 'p1')).toBe(life - 4);
  });
  it('negative: a green source: the damage is prevented, nothing is dealt back', () => {
    const s0 = setup();
    const bear = onBf(s0, 'Test Sturdy Bear', 'p2')[0]!;
    const life = lifeOf(s0, 'p1');
    const s = zapAndRespond(s0, 'Test Green Zap', obj(bear), 'Test Honor Shield', { targets: [[obj(bear)]] });
    expect(dmg(s, bear)).toBe(0);
    expect(lifeOf(s, 'p1')).toBe(life);
  });
});

describe('CR 609.7a, 615.5, 603.12, 119.3: "Prevent all damage that would be dealt to you this turn by a source of your choice. Whenever damage from a black or red source is prevented this way this turn, you gain that much life."', () => {
  const MIN = card('Test Kind Ministry', 'Instant', 'Prevent all damage that would be dealt to you this turn by a source of your choice. Whenever damage from a black or red source is prevented this way this turn, you gain that much life.', { colors: ['W'] });
  const setup = (): GameState => mpScenario({ defs: [MIN, ZAP, WHITE_ZAP], zones: { p1: { hand: ['Test Zap Four', 'Test White Zap'] }, p2: { hand: ['Test Kind Ministry'] } } });
  it('is automated', () => expect(full(MIN)).toBe(true));
  it('a red source: its 4 damage to me is prevented and I gain 4', () => {
    const s0 = setup();
    const life = lifeOf(s0, 'p2');
    const s = zapAndRespond(s0, 'Test Zap Four', pl('p2'), 'Test Kind Ministry');
    expect(lifeOf(s, 'p2')).toBe(life + 4);
  });
  it('negative: a white source: prevented, no life gained', () => {
    const s0 = setup();
    const life = lifeOf(s0, 'p2');
    const s = zapAndRespond(s0, 'Test White Zap', pl('p2'), 'Test Kind Ministry');
    expect(lifeOf(s, 'p2')).toBe(life);
  });
});

// ---- Shields from a source of your choice with a quality (Story Circle, Circle of Protection: Shadow) --------------------------------------------------------------------------------

describe('CR 609.7a, 615.7, 607.2d: "As ~ enters, choose a color. {W}: The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage."', () => {
  const CIRCLE = card('Test Tale Ring', 'Enchantment', 'As this enchantment enters, choose a color.\n{0}: The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage.', { colors: ['W'] });
  const setup = (): GameState => mpScenario({ defs: [CIRCLE, ZAP, GREEN_ZAP], zones: { p1: { hand: ['Test Tale Ring', 'Test Zap Four', 'Test Green Zap'] } } });
  /** Cast the ring choosing red, then a zap at me, and in response activate the ring (choosing the zap when it may be chosen). */
  const run = (zap: string): { s: GameState; life: number; log: string[] } => {
    const s0 = cast(setup(), 'Test Tale Ring', { colors: ['R'] });
    const s1 = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, zap, 'hand', 'p1') }), { targets: [[pl('p1')]] });
    const zapId = s1.zones.stack[s1.zones.stack.length - 1]!;
    const log: string[] = [];
    const script: Script = { objects: [[zapId]], log };
    const s = settle(drive(act(s1, { type: 'activate', player: 'p1', source: onBf(s1, 'Test Tale Ring')[0]!, ability: 'p:0:1' } as never), script), script);
    return { s, life: lifeOf(s0, 'p1'), log };
  };
  it('is automated', () => expect(full(CIRCLE)).toBe(true));
  it('red chosen, a red source: its damage to me is prevented', () => {
    const { s, life } = run('Test Zap Four');
    expect(lifeOf(s, 'p1')).toBe(life);
  });
  it('negative: a green source is not of the chosen color, nothing is prevented', () => {
    const { s, life } = run('Test Green Zap');
    expect(lifeOf(s, 'p1')).toBe(life - 4);
  });
});

describe('CR 609.7a, 615.7, 702.28a: "{1}: The next time a creature of your choice with shadow would deal damage to you this turn, prevent that damage."', () => {
  const COP = card('Test Shade Ward', 'Enchantment', '{0}: The next time a creature of your choice with shadow would deal damage to you this turn, prevent that damage.', { colors: ['W'] });
  const SHADE = card('Test Ping Shade', 'Creature — Spirit', 'Shadow\n{T}: This creature deals 2 damage to any target.', { pt: ['1', '1'] });
  const PINGER = card('Test Ping Imp', 'Creature — Imp', '{T}: This creature deals 2 damage to any target.', { pt: ['1', '1'] });
  const run = (pinger: string): { s: GameState; life: number } => {
    const s0 = mpScenario({ defs: [COP, SHADE, PINGER], zones: { p1: { battlefield: ['Test Shade Ward', 'Test Ping Shade', 'Test Ping Imp'] } } });
    const src = onBf(s0, pinger)[0]!;
    const s1 = drive(act(s0, { type: 'activate', player: 'p1', source: src, ability: pinger === 'Test Ping Shade' ? 'p:0:1' : 'p:0:0' } as never), { targets: [[pl('p1')]] });
    const script: Script = { objects: [[src]] };
    const s = settle(drive(act(s1, { type: 'activate', player: 'p1', source: onBf(s1, 'Test Shade Ward')[0]!, ability: 'p:0:0' } as never), script), script);
    return { s, life: lifeOf(s0, 'p1') };
  };
  it('is automated', () => expect(full(COP)).toBe(true));
  it('a creature with shadow chosen: its 2 damage to me is prevented', () => {
    const { s, life } = run('Test Ping Shade');
    expect(lifeOf(s, 'p1')).toBe(life);
  });
  it('negative: a creature without shadow cannot be chosen, its damage is dealt', () => {
    const { s, life } = run('Test Ping Imp');
    expect(lifeOf(s, 'p1')).toBe(life - 2);
  });
});

// ---- Damage dealt to the spell's controller instead (Aegis of Honor) ----------------------------------------------------------------------------------------------

describe('CR 614.9, 615.8: "{1}: The next time an instant or sorcery spell would deal damage to you this turn, that spell deals that damage to its controller instead."', () => {
  const AEGIS = card('Test Honor Aegis', 'Enchantment', '{0}: The next time an instant or sorcery spell would deal damage to you this turn, that spell deals that damage to its controller instead.', { colors: ['W'] });
  const PINGER = card('Test Ping Imp', 'Creature — Imp', '{T}: This creature deals 2 damage to any target.', { pt: ['1', '1'] });
  const setup = (): GameState => mpScenario({ defs: [AEGIS, ZAP, ZAP2, PINGER], zones: { p1: { hand: ['Test Zap Four', 'Test Second Zap'], battlefield: ['Test Ping Imp'] }, p2: { battlefield: ['Test Honor Aegis'] } } });
  const shield = (s0: GameState): GameState => {
    const s1 = drive(act(s0, { type: 'pass', player: 'p1' }));
    return settle(drive(act(s1, { type: 'activate', player: 'p2', source: onBf(s1, 'Test Honor Aegis')[0]!, ability: 'p:0:0' } as never)));
  };
  it('is automated', () => expect(full(AEGIS)).toBe(true));
  it('the next instant\'s damage to me is dealt to its controller instead, once', () => {
    const s0 = setup();
    // p2 activates on p1's turn when p1 passes priority with an empty stack: p2 gets priority only in response, so the shield is made in response to the first zap
    const s1 = drive(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Zap Four', 'hand', 'p1') }), { targets: [[pl('p2')]] });
    const [me, foe] = [lifeOf(s1, 'p1'), lifeOf(s1, 'p2')];
    const s2 = shield(s1);
    expect(lifeOf(s2, 'p2')).toBe(foe);
    expect(lifeOf(s2, 'p1')).toBe(me - 4);
    const s3 = cast(s2, 'Test Second Zap', { targets: [[pl('p2')]] }); // used up
    expect(lifeOf(s3, 'p2')).toBe(foe - 4);
  });
  it('negative: damage from a creature ability is not redirected and the shield stays for a spell', () => {
    const s0 = setup();
    const s1 = drive(act(s0, { type: 'activate', player: 'p1', source: onBf(s0, 'Test Ping Imp')[0]!, ability: 'p:0:0' } as never), { targets: [[pl('p2')]] });
    const [me, foe] = [lifeOf(s1, 'p1'), lifeOf(s1, 'p2')];
    const s2 = shield(s1);
    expect(lifeOf(s2, 'p2')).toBe(foe - 2);
    const s3 = cast(s2, 'Test Zap Four', { targets: [[pl('p2')]] });
    expect(lifeOf(s3, 'p2')).toBe(foe - 2);
    expect(lifeOf(s3, 'p1')).toBe(me - 4);
  });
});

describe('CR 615.5, 608.2h: "Prevent all damage that would be dealt to you and permanents you control this turn by sources you don\'t control. If damage is prevented this way, you may have ~ deal that much damage to target creature."', () => {
  const HARM = card('Test Harm Channel', 'Instant', "Prevent all damage that would be dealt to you and permanents you control this turn by sources you don't control. If damage is prevented this way, you may have Test Harm Channel deal that much damage to target creature.", { colors: ['W'] });
  const ZAP_P2 = card('Test Foe Zap', 'Instant', '~ deals 4 damage to any target.', { colors: ['R'] });
  const setup = (): GameState => mpScenario({ defs: [HARM, ZAP, ZAP_P2, BEAR], zones: { p1: { hand: ['Test Harm Channel', 'Test Zap Four'], battlefield: ['Test Sturdy Bear'] }, p2: { hand: ['Test Foe Zap'], battlefield: ['Test Sturdy Bear'] } } });
  /** p1 casts the channel at the opponent's creature; then p2, given priority, zaps p1 (or p1's own zap hits p1). */
  const run = (yes: boolean, own = false): { s: GameState; life: number; foeBear: string } => {
    const s0 = setup();
    const foeBear = onBf(s0, 'Test Sturdy Bear', 'p2')[0]!;
    const s1 = cast(s0, 'Test Harm Channel', { targets: [[obj(foeBear)]] });
    const life = lifeOf(s1, 'p1');
    if (own) return { s: cast(s1, 'Test Zap Four', { targets: [[pl('p1')]], yes: [yes] }), life, foeBear };
    const s2 = drive(act(s1, { type: 'pass', player: 'p1' }));
    const s = settle(drive(act(s2, { type: 'cast', player: 'p2', card: find(s2, 'Test Foe Zap', 'hand', 'p2') }), { targets: [[pl('p1')]] }), { yes: [yes] });
    return { s, life, foeBear };
  };
  it('is automated', () => expect(full(HARM)).toBe(true));
  it('an opponent\'s 4 damage to me is prevented, and I may have the spell deal 4 to the target creature', () => {
    const { s, life, foeBear } = run(true);
    expect(lifeOf(s, 'p1')).toBe(life);
    expect(dmg(s, foeBear)).toBe(4);
  });
  it('negative: I decline, the damage is still prevented and the creature is not dealt damage (Channel Harm ruling 2014-11-24)', () => {
    const { s, life, foeBear } = run(false);
    expect(lifeOf(s, 'p1')).toBe(life);
    expect(dmg(s, foeBear)).toBe(0);
  });
  it('negative: damage from a source I control is not prevented', () => {
    const { s, life, foeBear } = run(true, true);
    expect(lifeOf(s, 'p1')).toBe(life - 4);
    expect(dmg(s, foeBear)).toBe(0);
  });
});

describe('CR 615.7, 611.2c: "{T}: Prevent the next 1 damage that would be dealt to each creature and each player this turn." (Kitsune Palliator ruling 2005-02-01)', () => {
  const FOX = card('Test Mending Fox', 'Creature — Fox Cleric', '{T}: Prevent the next 1 damage that would be dealt to each creature and each player this turn.', { pt: ['0', '2'] });
  const LATE = card('Test Late Bear', 'Creature — Bear', '', { pt: ['2', '9'] });
  const ZAP3 = card('Test Third Zap', 'Instant', '~ deals 4 damage to any target.', { colors: ['R'] });
  const setup = (): GameState => mpScenario({ defs: [FOX, ZAP, ZAP2, ZAP3, BEAR, LATE], zones: { p1: { hand: ['Test Zap Four', 'Test Second Zap', 'Test Third Zap', 'Test Late Bear'], battlefield: ['Test Mending Fox'] }, p2: { battlefield: ['Test Sturdy Bear'] } } });
  const tap = (s0: GameState): GameState => settle(drive(act(s0, { type: 'activate', player: 'p1', source: onBf(s0, 'Test Mending Fox')[0]!, ability: 'p:0:0' } as never)));
  it('is automated', () => expect(full(FOX)).toBe(true));
  it('each creature and each player gets its own shield of 1: an opponent\'s creature and a player each have 1 of their damage prevented; a shield is used once', () => {
    const s1 = tap(setup());
    const bear = onBf(s1, 'Test Sturdy Bear', 'p2')[0]!;
    const life = lifeOf(s1, 'p3');
    const s2 = cast(s1, 'Test Zap Four', { targets: [[obj(bear)]] });
    expect(dmg(s2, bear)).toBe(3);
    const s3 = cast(s2, 'Test Second Zap', { targets: [[pl('p3')]] });
    expect(lifeOf(s3, 'p3')).toBe(life - 3);
  });
  it('negative: a creature that enters after it resolves has no shield; a second hit on the same creature is not prevented', () => {
    const s1 = cast(tap(setup()), 'Test Late Bear');
    const late = onBf(s1, 'Test Late Bear', 'p1')[0]!;
    const bear = onBf(s1, 'Test Sturdy Bear', 'p2')[0]!;
    const s2 = cast(s1, 'Test Zap Four', { targets: [[obj(late)]] });
    expect(dmg(s2, late)).toBe(4);
    const s3 = cast(cast(s2, 'Test Second Zap', { targets: [[obj(bear)]] }), 'Test Third Zap', { targets: [[obj(bear)]] });
    expect(dmg(s3, bear)).toBe(7); // 3 + 4
  });
});

