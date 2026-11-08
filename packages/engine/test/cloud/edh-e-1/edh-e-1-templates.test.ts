/**
 * Commander coordinator E, round edh-e-1 (copy group): the template data of parser/templates/zz-cloud/edh-e-1.json ("You may have <group> become copies of <object> <duration>",
 * Absorb Identity, Deceiver of Form; "Choose a <description> on the battlefield", Cytoshape; "<objects> each become a copy of <object> <duration>", Polymorphous Rush). The behavior is in
 * edh-e-1-scenarios.test.ts. Examples are synthetic wordings (design 6.10). CR cites from memory (unverified).
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE1 from '../../../src/parser/templates/zz-cloud/edh-e-1.json';
import review from '../../m5/golden/cards/edh-e-1-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const MECH = edhE1 as Template[];
/** design 6.9 deviation (decided by the owner's standing rule 2026-10-27): templates made stable on fewer than three golden cards, with their tests and played scenarios. */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe1.may.groupBecomeCopies.dur': ['Absorb Identity', 'Deceiver of Form'],
  'eff.edhe1.choose.aFilter.onBattlefield': ['Cytoshape'],
  'eff.edhe1.objs.eachBecomeCopy.dur': ['Polymorphous Rush'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const parsedWith = (text: string) => parseCard(card('Example Plan', 'Instant', text, {}), OPTS).faces[0]!;

describe('edh-e-1 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler, in path order after edh-d-99, and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-1.json');
    expect(files.indexOf('zz-cloud/edh-e-1.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two examples and two counter-examples, a status, version 9, and an id eff.edhe1.*', () => {
    expect(MECH.length).toBe(3);
    for (const t of MECH) {
      expect(t.id).toMatch(/^eff\.edhe1\./);
      expect(t.cr.length).toBeGreaterThan(0);
      expect(t.examples.length).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length).toBeGreaterThanOrEqual(2);
      expect(t.since).toBe(9);
    }
  });
  it('design 6.9: each stable template has its golden cards (the recorded deviation: fewer than three)', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const named = NARROW[t.id]!;
      for (const n of named) expect(golden.map((g) => g.card), t.id).toContain(n);
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['each', 'may', 'other', 'if', 'until']) if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
    }
  });
});

describe('edh-e-1 guard G9 (design 6.8): examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples differ`, () => {
      const first = parsedWith(t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), e.text).toBe(true);
        expect(f.gate.every((g) => g.ok), e.text).toBe(true);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});
