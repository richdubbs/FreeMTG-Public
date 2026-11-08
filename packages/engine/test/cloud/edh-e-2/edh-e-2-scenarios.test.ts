/**
 * Commander lane E, round edh-e-2: synthetic cards (invented names, design 6.10) played through the engine. CR cites from memory, unverified (rules/cr/ is not in the cloud checkout).
 *
 *   CR 611.2b, 303.4   "Gain control of target creature for as long as that creature is enchanted.": the duration is about the target (`whileObject`, `as: 'enchanted'`)
 *   CR 705.2, 603.7    "Flip a coin at end of combat. If you lose the flip, an opponent gains control of ~.": the result sentence is the branch of the delayed flip
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { whileObjectHolds } from '../../../src/statics/while-object';
import { act, answer, find, pass, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors: [], keywords: [], ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}
const automated = (d: CardDef): boolean => !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));

function settle(s0: GameState, targets: ObjectId[] = []): GameState {
  let s = s0;
  const queue = [...targets];
  for (let guard = 0; guard < 60 && s.pending && !(s.pending.kind === 'priority' && s.zones.stack.length === 0 && s.pending.player === 'p1'); guard++) {
    const d = s.pending;
    if (d.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: queue.length > 0 ? [queue.shift()!].map((id) => ({ kind: 'object' as const, id })) : [] });
    else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (d.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: true });
    else if (d.kind === 'order') s = answer(s, { kind: 'order', ids: d.items.map((i) => i.id) });
    else if (d.kind === 'priority') s = pass(s);
    else throw new Error(`unexpected decision ${d.kind}`);
  }
  return s;
}

describe('CR 611.2b, 303.4: "for as long as that creature is enchanted" (duration whileObject enchanted)', () => {
  const MESMER = card('Test Wreath Mesmer', 'Creature — Wizard', '{0}: Gain control of target creature for as long as that creature is enchanted.', ['1', '1']);
  const OX = card('Test Meadow Ox', 'Creature — Ox', '', ['2', '2']);
  const WREATH = card('Test Daisy Wreath', 'Enchantment — Aura', 'Enchant creature');
  const DEFS = [MESMER, OX, WREATH];
  const setup = (): { s: GameState; mesmer: ObjectId; ox: ObjectId; wreath: ObjectId } => {
    const s = scenario([], { p1: { battlefield: ['Test Wreath Mesmer'] }, p2: { battlefield: ['Test Meadow Ox'], hand: ['Test Daisy Wreath'] }, defs: DEFS });
    const ox = find(s, 'Test Meadow Ox', 'battlefield', 'p2');
    // put the Aura onto the battlefield by hand, attached (the scenario would put an unattached one into the graveyard at once, CR 704.5m)
    const wreath = find(s, 'Test Daisy Wreath', 'hand', 'p2');
    s.zones.hand['p2'] = (s.zones.hand['p2'] ?? []).filter((id) => id !== wreath);
    s.zones.battlefield.push(wreath);
    s.objects[wreath]!.zone = 'battlefield';
    s.objects[wreath]!.attachedTo = ox;
    return { s, mesmer: find(s, 'Test Wreath Mesmer', 'battlefield', 'p1'), ox, wreath };
  };
  it('is parsed and automated, the duration naming the target', () => {
    expect(automated(MESMER)).toBe(true);
    expect(JSON.stringify(MESMER.faces[0]!.abilities)).toContain('"as":"enchanted"');
  });
  it('control is gained while an Aura is attached and ends the moment none is', () => {
    let { s, mesmer, ox, wreath } = setup();
    s = settle(act(s, { type: 'activate', player: 'p1', source: mesmer, ability: 'p:0:0' }), [ox]);
    expect(s.objects[ox]!.controller).toBe('p1');
    s.objects[wreath]!.attachedTo = undefined; // the Aura falls off (a state-based action in play; set directly here)
    const d = s.continuousEffects.map((e) => e.duration).find((x) => x.d === 'whileObject');
    expect(d !== undefined && whileObjectHolds(s, d as never)).toBe(false);
  });
  it('a phased-out Aura does not enchant (CR 702.26b): the duration is over', () => {
    const { s, mesmer, ox, wreath } = setup();
    void mesmer;
    s.objects[wreath]!.phasedOut = true;
    const d = { d: 'whileObject', object: { ref: 'fixed', objects: [{ id: ox, zone: 'battlefield' }] }, as: 'enchanted' } as never;
    expect(whileObjectHolds(s, d)).toBe(false);
  });
  it('an unenchanted target is not taken (the duration does not hold from the start)', () => {
    let { s, mesmer, ox, wreath } = setup();
    s.objects[wreath]!.attachedTo = undefined;
    s = settle(act(s, { type: 'activate', player: 'p1', source: mesmer, ability: 'p:0:0' }), [ox]);
    expect(s.objects[ox]!.controller).toBe('p2');
  });
});

describe('CR 705.2, 603.7: "Flip a coin at end of combat. If you lose the flip, an opponent gains control of ~." (delayed flip with a result)', () => {
  const EFREET = card('Test Dune Efreet', 'Creature — Efreet', 'Whenever this creature attacks or blocks, flip a coin at end of combat. If you lose the flip, an opponent gains control of this creature.', ['3', '3']);
  it('is parsed and automated, the result inside the delayed flip', () => {
    expect(automated(EFREET)).toBe(true);
    const json = JSON.stringify(EFREET.faces[0]!.abilities);
    expect(json).toContain('"op":"delay"');
    expect(json).toContain('"onLose"');
  });
});
