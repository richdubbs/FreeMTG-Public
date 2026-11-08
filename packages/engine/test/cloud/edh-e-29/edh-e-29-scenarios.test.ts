/**
 * edh-e-29, played: assist (CR 702.132a-b; Gang Up, Out of Bounds). The caster may choose another player, who pays any amount of the generic mana of the total cost with
 * their own mana; the caster pays the rest. Without the keyword nobody is asked.
 */
import { describe, expect, it } from 'vitest';
import type { AbilityDef } from '../../../src/index';
import { answer, find, labels, scenario, synth } from '../../m5/helpers';
import { charsOfObject, ptNumbers } from '../../../src/rules/characteristics';
import { castCard, drive } from '../../m5/announce/support';

const assistant = (kw: boolean) => synth({
  name: 'Test Assist Spell', cost: '{3}{R}', type: 'Sorcery',
  abilities: [...(kw ? [{ kind: 'keyword', keyword: 'assist', text: 'Assist' } as unknown as AbilityDef] : []), { kind: 'spell', text: 'x', effect: { targets: [], steps: [] } } as unknown as AbilityDef],
});

const tappedCount = (s: ReturnType<typeof scenario>, who: 'p1' | 'p2'): number => s.zones.battlefield.filter((id) => s.objects[id]!.controller === who && s.objects[id]!.tapped).length;

describe('CR 702.132: assist', () => {
  it('the helper pays the generic mana they name with their own lands; the caster pays the rest', () => {
    const s0 = scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain', 'Mountain'] }, p2: { battlefield: ['Forest', 'Forest', 'Forest'] }, defs: [assistant(true)] });
    let t = castCard(s0, 'Test Assist Spell');
    expect(t.pending).toMatchObject({ kind: 'chooseOption', player: 'p1' });
    t = answer(t, { kind: 'chooseOption', ids: ['p2'] });
    expect(t.pending).toMatchObject({ kind: 'chooseNumber', player: 'p2', min: 0, max: 3 });
    t = drive(answer(t, { kind: 'chooseNumber', n: 2 }), []);
    expect(t.zones.stack.length).toBe(1);
    expect(tappedCount(t, 'p2')).toBe(2);
    expect(tappedCount(t, 'p1')).toBe(2);
  });

  it('negative: the helper pays 0, or the caster names nobody: the caster pays everything', () => {
    const s0 = scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain'] }, p2: { battlefield: ['Forest', 'Forest'] }, defs: [assistant(true)] });
    const none = drive(answer(castCard(s0, 'Test Assist Spell'), { kind: 'chooseOption', ids: [] }), []);
    expect(tappedCount(none, 'p1')).toBe(4);
    expect(tappedCount(none, 'p2')).toBe(0);
    let t = answer(castCard(s0, 'Test Assist Spell'), { kind: 'chooseOption', ids: ['p2'] });
    t = drive(answer(t, { kind: 'chooseNumber', n: 0 }), []);
    expect(tappedCount(t, 'p1')).toBe(4);
    expect(tappedCount(t, 'p2')).toBe(0);
  });

  it('negative: a spell without assist asks nobody', () => {
    const s0 = scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain'] }, p2: { battlefield: ['Forest'] }, defs: [assistant(false)] });
    const t = castCard(s0, 'Test Assist Spell');
    expect(t.pending?.kind).not.toBe('chooseOption');
    expect(find(drive(t, []), 'Test Assist Spell', 'stack')).toBeDefined();
  });

  it('negative: the helper cannot pay colored mana: only the generic part is helped (max 3 of {3}{R})', () => {
    const s0 = scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain'] }, p2: { battlefield: ['Forest', 'Forest', 'Forest', 'Forest', 'Forest'] }, defs: [assistant(true)] });
    let t = castCard(s0, 'Test Assist Spell');
    t = answer(t, { kind: 'chooseOption', ids: ['p2'] });
    expect(t.pending).toMatchObject({ kind: 'chooseNumber', max: 3 });
  });
});

describe('edh-e-29 assist: castability, the rest of the cost, the mana spent', () => {
  it('castable only because the helper can pay the generic part; not castable when the helper is short; not without the keyword', () => {
    const mk = (kw: boolean, forests: number) => scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain'] }, p2: { battlefield: Array(forests).fill('Forest') as string[] }, defs: [assistant(kw)] });
    expect(labels(mk(true, 3), 'p1')).toContain('Cast Test Assist Spell');
    expect(labels(mk(true, 2), 'p1')).not.toContain('Cast Test Assist Spell');
    expect(labels(mk(false, 3), 'p1')).not.toContain('Cast Test Assist Spell');
  });

  it('the helper cannot pay so much that the caster could not pay the rest: the colored part is never helped', () => {
    const s0 = scenario(['Mountain', 'Forest'], { p1: { hand: ['Test Assist Spell'], battlefield: ['Mountain'] }, p2: { battlefield: ['Forest', 'Forest', 'Forest'] }, defs: [assistant(true)] });
    let t = answer(castCard(s0, 'Test Assist Spell'), { kind: 'chooseOption', ids: ['p2'] });
    expect(() => answer(t, { kind: 'chooseNumber', n: 1 })).toThrow();
    t = drive(answer(t, { kind: 'chooseNumber', n: 3 }), []);
    expect(tappedCount(t, 'p1')).toBe(1);
    expect(tappedCount(t, 'p2')).toBe(3);
  });
});

describe('edh-e-29 lands that become creatures (played)', () => {
  it('Natural Emergence-style static: every land you control is a 2/2 creature with first strike and still a land; the other player\'s lands are unchanged', () => {
    const def = synth({ name: 'Test Emergence', cost: '{2}{G}', type: 'Enchantment', abilities: [{ kind: 'static', text: 'x', effects: [{ s: 'continuous', affects: { ref: 'each', filter: { types: ['Land'], controller: 'you' } }, mods: [{ layer: 4, types: { add: ['Creature'] } }, { layer: 6, add: [{ kind: 'keyword', keyword: 'first strike' }] }, { layer: '7b', power: 2, toughness: 2 }] }] } as unknown as AbilityDef] });
    const s0 = scenario(['Forest', 'Island'], { p1: { battlefield: ['Test Emergence', 'Forest'] }, p2: { battlefield: ['Island'] }, defs: [def] });
    const f = find(s0, 'Forest', 'battlefield');
    const i = find(s0, 'Island', 'battlefield');
    const c = charsOfObject(s0, s0.objects[f]!);
    expect(c.types).toEqual(expect.arrayContaining(['Land', 'Creature']));
    expect(ptNumbers(c)).toMatchObject({ power: 2, toughness: 2 });
    expect(charsOfObject(s0, s0.objects[i]!).types).not.toContain('Creature');
  });
});
