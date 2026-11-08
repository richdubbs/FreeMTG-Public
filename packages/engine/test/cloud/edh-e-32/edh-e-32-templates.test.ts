/**
 * edh-e-32 (Commander coordinator E, group copy): the template data of parser/templates/zz-cloud/edh-e-32.json and the parser, renderer and engine changes of the round. Guard G9 (design 6.8):
 * every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not give the same JSON. Examples are synthetic wordings (design 6.10),
 * checked against the local index when it is present. The behavior is in edh-e-32-scenarios.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE32 from '../../../src/parser/templates/zz-cloud/edh-e-32.json';
import review from '../../m5/golden/cards/edh-e-32-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE32 as Template[];
/** design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): stable on the one card that prints the wording (held-out, opened by the owner, more cards 2026-11-06). */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe32.copy.exiledCard': ['Elite Arcanist'],
  'eff.edhe32.forEach.controllerCopiesThat': ['Parallel Evolution'],
  'eff.edhe32.copy.forEachOtherSpellCast': ['Show of Confidence'],
  'eff.edhe32.copy.ifThenCopyIf': ['Banish into Fable'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const TYPE: Record<string, string> = { 'eff.edhe32.forEach.controllerCopiesThat': 'Sorcery', 'eff.edhe32.copy.forEachOtherSpellCast': 'Instant', 'eff.edhe32.copy.ifThenCopyIf': 'Instant' };
const parsedWith = (t: Template, text: string) => {
  const type = TYPE[t.id];
  return (type !== undefined ? parseCard(card('Example Plan', type, text), OPTS) : parseCard(card('Example Wizard', 'Creature — Wizard', text, { power: '1', toughness: '1' }), OPTS)).faces[0]!;
};

describe('edh-e-32 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler (path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-32.json');
    expect(files.indexOf('zz-cloud/edh-e-32.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-32.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two or more examples and counter-examples and a status; ids are *.edhe32.*', () => {
    expect(MECH.length).toBe(4);
    for (const t of MECH) {
      expect(t.id).toMatch(/^(eff|rid)\.edhe32\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
    }
  });
  it('design 6.9: a stable template has its narrow-wording evidence: the one golden card that prints it', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(t.id)).map((g) => g.card);
      for (const n of NARROW[t.id] ?? []) expect(cards, t.id).toContain(n);
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('design 6.10: no example is a real Oracle line of the local index', () => {
    const idx = localIndex();
    if (idx === null) return;
    const oracle = idx.map((c) => (c.oracle_text ?? '').toLowerCase().replace(/\s+/g, ' '));
    for (const t of MECH) for (const e of t.examples) for (const line of e.text.split('\n')) expect(oracle.some((o) => o.includes(line.toLowerCase().replace(/\bthis spell\b|~/g, '').trim()) && line.length > 60 && !line.includes('~')), line).toBe(false);
  });
});

describe('edh-e-32 guard G9: examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples do not give the same JSON`, () => {
      const first = parsedWith(t, t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(t, e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), `${e.text}: ${JSON.stringify(f.diagnostics)}`).toBe(true);
        expect(f.gate.every((g) => g.ok), e.text).toBe(true);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(t, c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});
