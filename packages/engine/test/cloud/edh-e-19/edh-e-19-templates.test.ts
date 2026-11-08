/**
 * Commander coordinator E, round edh-e-19 (EDHREC top 30,000, group combat 1/2): the template data of parser/templates/zz-cloud/edh-e-19.json (see the file) and the round's
 * parser and renderer changes. Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not
 * parse or parses to different JSON. Examples are synthetic wordings (design 6.10). CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE19 from '../../../src/parser/templates/zz-cloud/edh-e-19.json';
import review from '../../m5/golden/cards/edh-e-19-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const MECH = edhE19 as Template[];
/** design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): the wording is printed by one card. */
const NARROW: Readonly<Record<string, readonly string[]>> = { 'eff.edhe19.objs.cantAttackOrBlock': ['Droning Bureaucrats'], 'eff.edhe19.duringTheirNextTurn.creaturesAttackYou': ['Taunt'] };
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const parsedWith = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;

describe('edh-e-19 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler and its ids are unique in the whole set', () => {
    expect(TEMPLATE_FILES.map((f) => f.file)).toContain('zz-cloud/edh-e-19.json');
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two examples and two counter-examples; ids are *.edhe19.*; stable ones have their golden evidence', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH) {
      expect(t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhe19\./);
      expect(t.cr.length).toBeGreaterThan(0);
      expect(t.examples.length).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length).toBeGreaterThanOrEqual(2);
      const cards = golden.filter((g) => g.verified.includes(t.id)).map((g) => g.card);
      for (const n of NARROW[t.id] ?? []) expect(cards, t.id).toContain(n);
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) for (const w of ["can't"]) if (t.pattern.includes(w)) expect(t.consumes ?? [], t.id).toContain(w);
  });
});

describe('edh-e-19 guard G9: examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples never give the same JSON`, () => {
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

describe('edh-e-19 readings (CR 509.3c, 603.2c, 303.4b): the wordings the round opens, and what stays manual', () => {
  const auto = (text: string, type: string) => { const f = parsedWith(text, type); return automated(f.abilities) && f.gate.every((g) => g.ok); };
  it('"blocks or becomes blocked by one or more <described creatures>" of the object itself or the equipped creature is automated', () => {
    expect(auto('Whenever Example Plan blocks or becomes blocked by one or more Orcs, Example Plan gets +0/+2 until end of turn.', 'Creature — Zombie')).toBe(true);
    expect(auto('Whenever Example Plan blocks or becomes blocked by one or more blue and/or black creatures, Example Plan gets +3/+3 until end of turn.', 'Creature — Zombie')).toBe(true);
    expect(auto('Whenever equipped creature becomes blocked by one or more colorless creatures, it gains deathtouch until end of turn.', 'Artifact — Equipment')).toBe(true);
  });
  it('negatives: the group of blockers is never "that creature"; another creature as the subject is not read (one occurrence per attacker would differ)', () => {
    expect(auto('Whenever equipped creature becomes blocked by one or more colorless creatures, destroy that creature.', 'Artifact — Equipment')).toBe(false);
    expect(auto('Whenever a creature you control becomes blocked by one or more Orcs, draw a card.', 'Enchantment')).toBe(false);
  });
  it('Taunt: every creature the target player controls must attack the caster during that player\'s next turn (CR 508.1d); not a block requirement, not a lasting-until reading', () => {
    const f = parsedWith('During target player\'s next turn, creatures that player controls attack you if able.');
    const j = JSON.stringify(f.abilities);
    expect(j).toContain('"mode":"mustIfAble"');
    expect(j).toContain('"otherPlayer":{"ref":"you"}');
    expect(j).toContain('"duringNextTurn"');
    expect(auto('During target player\'s next turn, creatures that player controls block you if able.', 'Sorcery')).toBe(false);
  });
  it('"creatures that are enchanted" (CR 303.4b) is the same group as "enchanted creatures"', () => {
    expect(auto('Creatures that are enchanted can\'t attack or block.', 'Enchantment')).toBe(true);
  });
});
