/**
 * Commander coordinator E, round edh-e-49 (EDHREC top 30,000, group combat 1/2, second batch): the template data of parser/templates/zz-cloud/edh-e-49.json (see the file) and the round's
 * parser and renderer changes. Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not
 * parse or parses to different JSON. Examples are synthetic wordings (design 6.10). CR cites from memory where marked unverified in the record.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE49 from '../../../src/parser/templates/zz-cloud/edh-e-49.json';
import review from '../../m5/golden/cards/edh-e-49-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const MECH = edhE49 as Template[];
/** design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): the wording is printed by these cards only. */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'sta.edhe49.attackTax.sacrificeLand': ['Flooded Woodlands', 'Reclamation'],
  'sta.edhe49.aura.allAttackControllerOfEnchanted': ['Public Enemy'],
  'sta.edhe49.blockAsThough.selfAttackers.hadShadow': ['Wall of Diffusion', 'Heartwood Dryad'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const parsedWith = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;

describe('edh-e-49 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler and its ids are unique in the whole set', () => {
    expect(TEMPLATE_FILES.map((f) => f.file)).toContain('zz-cloud/edh-e-49.json');
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two examples and two counter-examples; ids are *.edhe49.*; stable ones have their golden evidence', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH) {
      expect(t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhe49\./);
      expect(t.cr.length).toBeGreaterThan(0);
      expect(t.examples.length).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length).toBeGreaterThanOrEqual(2);
      const cards = golden.filter((g) => g.verified.includes(t.id)).map((g) => g.card);
      for (const n of NARROW[t.id] ?? []) expect(cards, t.id).toContain(n);
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) for (const w of ["can't", 'unless', 'each', 'all', 'if able', 'as though']) if (t.pattern.includes(w)) expect(t.consumes ?? [], t.id).toContain(w);
  });
});

describe('edh-e-49 guard G9: examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples never give the same JSON`, () => {
      const first = parsedWith(t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(e.text, e.text.startsWith('Enchant') || e.text.includes('enchanted') ? 'Enchantment — Aura' : e.text.includes('~') ? 'Creature — Wall' : 'Enchantment');
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), e.text).toBe(true);
        expect(f.gate.every((g) => g.ok), e.text).toBe(true);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(c, c.includes('~') ? 'Creature — Wall' : c.includes('enchanted') ? 'Enchantment — Aura' : 'Enchantment');
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});

describe('edh-e-49 readings: the wordings the round opens, and what stays manual', () => {
  const auto = (text: string, type: string) => { const f = parsedWith(text, type); return automated(f.abilities) && f.gate.every((g) => g.ok); };
  it('"deals combat damage to defending player" (CR 506.2, 510.2) is automated for the source it names', () => {
    expect(auto('Whenever Example Plan deals combat damage to defending player, draw a card.', 'Creature — Zombie')).toBe(true);
    expect(auto('Whenever enchanted creature deals combat damage to defending player, that player loses 1 life.', 'Enchantment — Aura')).toBe(true);
  });
  it('negatives: noncombat damage to defending player, and a batch of creatures, stay manual', () => {
    expect(auto('Whenever Example Plan deals damage to defending player, draw a card.', 'Creature — Zombie')).toBe(false);
    expect(auto('Whenever one or more creatures you control deal combat damage to defending player, draw a card.', 'Enchantment')).toBe(false);
  });
});
