/**
 * Commander coordinator E, round edh-e-21 (group mana): the template data of parser/templates/zz-cloud/edh-e-21.json and the round's engine and renderer changes,
 * tested at the end of this file and played in edh-e-21-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON;
 * near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10), checked
 * against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE21 from '../../../src/parser/templates/zz-cloud/edh-e-21.json';
import review from '../../m5/golden/cards/edh-e-21-review.json';
import { capabilitiesOfDef } from '../../../src/model/cap-walk';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE21 as Template[];
const MECH_COUNT = 6;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one or two
 * cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe21.sacrifice.unlessPay.itsManaCost': ['Pendrell Flux', 'Essence Leak'],
  'eff.edhe21.sacrifice.theirChoice.manaValueOrLess': ['Exile into Darkness'],
  'sta.edhe21.enchanted.aslong.notCreature.artifactCreature.ptManaValue': ['Animate Artifact'],
  'eff.edhe21.player.adds.anyOneColor.theyChoose': ['Stadium Vendors'],
  'eff.edhe21.add.manaEqualToCost': ['Elemental Resonance'],
  'sta.edhe21.enchantedLand.losesTypesAbilities.has': ['Lithoform Blight'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || t.kind === 'rider' || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-21 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-21.json, path order: after edh-d-99) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-21.json');
    expect(files.indexOf('zz-cloud/edh-e-21.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe21.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe21\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(9);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`)).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'then', 'during']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-e-21 guard G9 (design 6.8): examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id} (${t.cr.join(', ')}): every example parses with it, is automated and passes the render gate; counter-examples do not give the same JSON`, () => {
      const first = parsedWith(t, t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(t, e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), `${e.text}: ${JSON.stringify(f.abilities)} ${JSON.stringify(f.diagnostics)}`).toBe(true);
        expect(f.gate.every((g) => g.ok), `${e.text}: ${JSON.stringify(f.gate)}`).toBe(true);
        expect(f.diagnostics.filter((d) => d.level === 'manual'), e.text).toEqual([]);
        if (e.expect !== undefined) expect(bare(f.abilities), e.text).toEqual(e.expect);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(t, c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});

/** Near-miss mutations of one example (design 6.8 G9): each must not parse, or parse to different JSON. */
function nearMisses(text: string): string[] {
  const body = text.replace(/\.$/, '');
  const out = [`${body} unless it is blue.`, `${body} at random.`, `${body} twice.`, `${body} if able.`];
  const swaps: [RegExp, string][] = [[/\blibrary this turn\b/, 'hand this turn'], [/\bfreerunning\b/, 'prowl'], [/\bthat much\b/, 'twice that much'], [/\breduced by \{2\}/, 'reduced by {1}'], [/\bshuffle the rest\b/, 'put the rest']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-21 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
  for (const t of MECH) {
    it(`${t.id}: an appended "unless/at random/twice/if able" or a swapped key word never gives the example's JSON`, () => {
      for (const e of t.examples) {
        const orig = parsedWith(t, e.text);
        for (const m of nearMisses(e.text)) {
          if (m === e.text) continue;
          const f = parsedWith(t, m);
          expect(automated(f.abilities) && f.gate.every((g) => g.ok) && jsonKey(f.abilities) === jsonKey(orig.abilities), m).toBe(false);
        }
      }
    }, 120_000);
  }
});

describe('edh-e-21 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    }, 120_000);
  }
});

describe('edh-e-21: the engine, lowering and renderer changes (one test each)', () => {
  const steps = (f: ReturnType<typeof compiled>): string => JSON.stringify(f.abilities);
  it('effects/handlers/pay.ts#manaCostOfObject (CR 118.12, 202.1): "sacrifice this creature unless you pay its mana cost" is a pay step with manaCostOf; only that wording is said (render/steps-flow.ts)', () => {
    const f = compiled('Creature — Ogre', 'At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"op":"pay","who":{"ref":"you"},"cost":{},"manaCostOf":{"ref":"self"},"else":[{"op":"sacrifice","what":{"ref":"self"}}]');
    for (const bad of ['At the beginning of your upkeep, sacrifice this creature unless you pay its mana value.', 'At the beginning of your upkeep, sacrifice this creature unless an opponent pays its mana cost.', 'At the beginning of your upkeep, you may pay its mana cost.']) expect(fullyAutomated(compiled('Creature — Ogre', bad)), bad).toBe(false);
  });
  it('a granted trigger (Pendrell Flux) and a conditional grant (Essence Leak) name the creature itself, not the Aura', () => {
    const f = compiled('Enchantment — Aura', 'Enchant creature\nEnchanted creature has "At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost."');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"manaCostOf":{"ref":"self"}');
  });
  it('model/cap-walk.ts + parser/lower/ability.ts + model/lint-nodes.ts (CR 605.3b, 120.3): a mana ability may deal fixed damage to you "if you don\'t control" a description; "if you control", other damage and other receivers stay manual', () => {
    const ok = compiled('Land', "{T}: Add {B}. Example Relic deals 1 damage to you if you don't control an Ogre.");
    expect(fullyAutomated(ok)).toBe(true);
    for (const bad of ["{T}: Add {B}. Example Relic deals 1 damage to you if you control an Ogre.", "{T}: Add {B}. Example Relic deals 1 damage to each opponent if you don't control an Ogre."]) expect(fullyAutomated(compiled('Land', bad)), bad).toBe(false);
  });
  it('model/cap-walk.ts#nativeManaEffect (CR 605.3b, 608.2h): after "Sacrifice ~" a production of {C} for each counter on ~ is run (the counters as it last had them); a count of anything else is not', () => {
    const needs = (t: string): string[] => compiled('Artifact', t).abilities.flatMap((a) => capabilitiesOfDef(a)).filter((c) => !ENGINE_CAPABILITIES.has(c)); // capabilities the engine lacks (the classifier makes the ability manual)
    expect(needs('{T}, Sacrifice this artifact: Add {C} for each charge counter on this artifact.')).toEqual([]);
    expect(needs('{T}, Sacrifice this artifact: Add {C} for each creature you control.')).toContain('feature:mana.steps');
    expect(needs('{T}, Sacrifice this artifact: Add {C} for each +1/+1 counter on this artifact.')).toEqual([]); // any counter kind of the source itself
  });
  it('types/ability.ts ManaProduction manaCostOf (CR 106.1, 202.1): "add mana equal to <object>\'s mana cost" is the cost of that object; "mana value" and "power" are not read', () => {
    const f = compiled('Enchantment — Aura', "Enchant permanent\nAt the beginning of your upkeep, add mana equal to enchanted permanent's mana cost.");
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"dynamic":{"kind":"manaCostOf","of":{"ref":"attachedTo"}}');
    expect(fullyAutomated(compiled('Enchantment — Aura', "Enchant permanent\nAt the beginning of your upkeep, add mana equal to enchanted permanent's mana value."))).toBe(false);
  });
  it('render/steps-zones.ts (CR 701.21a, 202.3): "of their choice with mana value N or less" is read only with "or less" and a number', () => {
    expect(fullyAutomated(compiled('Sorcery', 'Target player sacrifices a creature of their choice with mana value 3 or less.'))).toBe(true);
    expect(fullyAutomated(compiled('Sorcery', 'Target player sacrifices a creature of their choice with mana value 3 or greater.'))).toBe(false);
    expect(fullyAutomated(compiled('Sorcery', 'Target player sacrifices a creature of your choice with mana value 3 or less.'))).toBe(false);
  });
  it('eff.stdwoe.choose.player is stable (made stable on Stadium Vendors, design 6.9 deviation recorded): "choose a player" followed by "that player gains N life" is automated', () => {
    expect(fullyAutomated(compiled('Creature — Goblin', 'When this creature enters, choose a player. That player gains 3 life.'))).toBe(true);
    expect(fullyAutomated(compiled('Creature — Goblin', 'When this creature enters, choose two players. They each gain 3 life.'))).toBe(false);
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-21 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-21 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Equipment)\b/gi, '~').trim());
        }
      }
    }
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim).toEqual([]);
  }, 120_000);
});
