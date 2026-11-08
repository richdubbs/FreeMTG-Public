/**
 * Commander coordinator E, round edh-e-27 (group sacrifice-destroy): the round's parser readings and filter field. The round adds no template file; it adds
 *   - parser/holes/cond.ts#aDiesThisWay (CR 700.4, 701.8a, 608.2c): "If a white creature dies this way, ..." after a destroy of ONE announced target (`did` with `$dies`, `which`, `to: graveyard`);
 *   - the filter field `enteredSinceYourLastTurn` (parser/holes/filter.ts, rules/history.ts, render/np.ts, render/cond.ts; CR 400.7, 500.1): "that entered since your last turn ended".
 * Every example is a synthetic wording (design 6.10). Guard G9/G2 style checks: the examples are automated and pass the render gate, near misses stay manual or give different JSON.
 */
import { describe, expect, it } from 'vitest';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import { HISTORY_FILTER_FIELDS } from '../../../src/rules/history';
import review from '../../m5/golden/cards/edh-e-27-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const spell = (text: string, type = 'Instant') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;

describe('edh-e-27: "If a <described> creature dies this way" (parser/holes/cond.ts#aDiesThisWay)', () => {
  const EXAMPLES = [
    'Destroy target creature. If a white creature dies this way, ~ deals damage to that creature\'s controller equal to the creature\'s power.',
    'Destroy target artifact. If a historic artifact dies this way, you gain 3 life.',
    'Destroy target creature. If a creature with flying dies this way, draw a card.',
  ];
  for (const text of EXAMPLES) {
    it(`"${text}" is automated, passes the render gate, and reads the destroy of the one target (did with $dies resolved, which and to: graveyard)`, () => {
      const f = spell(text);
      expect(automated(f.abilities), JSON.stringify(f.diagnostics)).toBe(true);
      expect(f.gate.every((g) => g.ok), JSON.stringify(f.gate)).toBe(true);
      const j = JSON.stringify(f.abilities);
      expect(j).toContain('"to":"graveyard"');
      expect(j).not.toContain('$dies');
    });
  }
  it('near misses never give the same JSON: a bare type ("a creature" is the count reading), a group destroy, a controller said, an exile, a different verb', () => {
    const base = jsonKey(spell(EXAMPLES[0]!).abilities);
    for (const t of [
      'Destroy target creature. If a creature dies this way, ~ deals damage to that creature\'s controller equal to the creature\'s power.',
      'Destroy all creatures. If a white creature dies this way, you gain 1 life.',
      'Destroy target creature. If a white creature you control dies this way, you gain 1 life.',
      'Exile target creature. If a white creature dies this way, you gain 1 life.',
      'Destroy target creature. If a white creature is exiled this way, you gain 1 life.',
      'Destroy target creature. If two white creatures die this way, you gain 1 life.',
    ]) {
      const f = spell(t);
      expect(fullyAutomated(f) && jsonKey(f.abilities) === base, t).toBe(false);
    }
  });
  it('the reading needs a destroy right before it: no earlier destroy, and a sacrifice, stay manual', () => {
    expect(fullyAutomated(spell('If a white creature dies this way, you gain 1 life.'))).toBe(false);
    expect(fullyAutomated(spell('Target player sacrifices a creature. If a white creature dies this way, you gain 1 life.'))).toBe(false);
  });
});

describe('edh-e-27: the filter field enteredSinceYourLastTurn ("that entered since your last turn ended")', () => {
  it('is a history field and a declared capability', () => {
    expect(HISTORY_FILTER_FIELDS).toContain('enteredSinceYourLastTurn');
    expect([...ENGINE_CAPABILITIES]).toContain('filter:enteredSinceYourLastTurn');
  });
  for (const text of [
    'Destroy target nonblack creature that entered since your last turn ended.',
    'Destroy target artifact that entered since your last turn ended.',
    'Exile target creature that entered since your last turn ended.',
    'Return target creature that entered since your last turn ended to its owner\'s hand.',
  ]) {
    it(`"${text}" is automated and passes the render gate`, () => {
      const f = spell(text, 'Sorcery');
      expect(automated(f.abilities), JSON.stringify(f.diagnostics)).toBe(true);
      expect(f.gate.every((g) => g.ok), JSON.stringify(f.gate)).toBe(true);
      expect(JSON.stringify(f.abilities)).toContain('"enteredSinceYourLastTurn":true');
    });
  }
  it('near misses stay manual or differ: "this turn" is the other field, "since your last turn began", "since an opponent\'s last turn ended"', () => {
    const base = jsonKey(spell('Destroy target nonblack creature that entered since your last turn ended.', 'Sorcery').abilities);
    for (const t of [
      'Destroy target nonblack creature that entered this turn.',
      'Destroy target nonblack creature that entered since your last turn began.',
      'Destroy target nonblack creature that entered since an opponent\'s last turn ended.',
      'Destroy target nonblack creature that entered since your last turn.',
    ]) {
      const f = spell(t, 'Sorcery');
      expect(fullyAutomated(f) && jsonKey(f.abilities) === base, t).toBe(false);
    }
  });
});

describe('edh-e-27: the golden review file', () => {
  it('every entry is expected full and names the round', () => {
    for (const g of review as { card: string; expect?: string; verified: string }[]) {
      expect(g.expect, g.card).toBe('full');
      expect(g.verified, g.card).toContain('edh-e-27');
    }
  });
});
