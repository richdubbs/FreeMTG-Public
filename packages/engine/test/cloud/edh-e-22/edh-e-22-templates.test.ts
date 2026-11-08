/**
 * Commander coordinator E, round edh-e-22 (group type-change): the template data of parser/templates/zz-cloud/edh-e-22.json and the round's renderer changes (render/mods.ts alts),
 * tested at the end of this file and played in edh-e-22-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON;
 * near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10), checked
 * against the local index when it is present. CR cites from memory (cloud session), listed as unverified in the record.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE22 from '../../../src/parser/templates/zz-cloud/edh-e-22.json';
import review from '../../m5/golden/cards/edh-e-22-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE22 as Template[];
const MECH_COUNT = 10;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one card, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe22.becomes.subtype.basept.abilities': ['Bogardan Dragonheart'],
  'eff.edhe22.becomes.oneColor.subtype.basept.loseAll.gains': ['Dance of the Skywise'],
  'eff.edhe22.becomes.twoColor.subtype.basept.loseAll.gains': ['Dragonshift'],
  'eff.edhe22.becomes.basept.subtype.artifactCreature.gains': ['Majestic Metamorphosis'],
  'eff.edhe22.becomes.basept.artifactCreature.stillLand': ["Mishra's Groundbreaker"],
  'eff.edhe22.becomes.basept.colored.subtype.artifactCreature.trailingDur': ['Stuffed Bear'],
  'eff.edhe22.becomes.basept.subtype.artifactCreature.noLonger': ['Haunted Plate Mail'],
  'eff.edhe22.basePT.become.equal.possessive': ['Shape Stealer'],
  'eff.edhe22.becomes.basept.creature.plain': ['Siege of Towers'],
  'eff.edhe22.it.becomes.subtype.andLoses.keyword': ['Ageless Sentinels'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || t.kind === 'rider' || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-22 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-22.json, path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-22.json');
    expect(files.indexOf('zz-cloud/edh-e-22.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-22.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe22.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe22\./);
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

describe('edh-e-22 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/\b4\/4\b/, '4/4 and 3/3'], [/\bloses all abilities\b/, 'loses flying'], [/\bstill a land\b/, 'still a creature'], [/\bno longer\b/, 'still']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-22 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-22 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe('edh-e-22: the renderer changes (render/mods.ts alts, one test each)', () => {
  it('"becomes a Wurm with base power and toughness 5/5, reach, and lifelink" with the duration in front is the same effect as "... and gains reach and lifelink until end of turn"', () => {
    const f = compiled('Instant', 'Until end of turn, target creature becomes a Wurm with base power and toughness 5/5, reach, and lifelink.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"layer":"7b","power":5,"toughness":5');
  });
  it('"becomes a green Ooze with base power and toughness 2/6, loses all abilities, and gains reach": one layer-6 change (removeAll then add), the identity first', () => {
    const f = compiled('Instant', 'Until end of turn, target creature becomes a green Ooze with base power and toughness 2/6, loses all abilities, and gains reach.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"removeAll":true');
    expect(fullyAutomated(compiled('Instant', 'Until end of turn, target creature becomes a green Ooze with base power and toughness 2/6, gains reach, and loses all abilities.'))).toBe(false);
  });
  it('"becomes a 3/3 artifact creature that\'s still a land" only for the add-types effect; a set-types effect is not worded so (negative)', () => {
    expect(fullyAutomated(compiled('Artifact', '{T}: Target land becomes a 3/3 artifact creature that\'s still a land.'))).toBe(true);
    expect(fullyAutomated(compiled('Artifact', '{T}: Target land becomes a 3/3 artifact creature that\'s still an artifact.'))).toBe(false);
  });
  it('"becomes a 3/3 Golem artifact creature that\'s no longer a Vehicle": the subtype loss is said; a loss of two types or of a creature type is not read', () => {
    expect(fullyAutomated(compiled('Artifact', '{0}: Until end of turn, ~ becomes a 3/3 Golem artifact creature that\'s no longer a Vehicle.'))).toBe(true);
    expect(fullyAutomated(compiled('Artifact', '{0}: Until end of turn, ~ becomes a 3/3 Golem artifact creature that\'s no longer a Vehicle or a Treasure.'))).toBe(false);
  });
  it('"it becomes a Bird Giant, and it loses defender": identity first, then the loss of one keyword', () => {
    const f = compiled('Creature — Wall', 'Defender\nWhen ~ blocks, it becomes a Bird Giant, and it loses defender.');
    expect(fullyAutomated(f)).toBe(true);
    expect(fullyAutomated(compiled('Creature — Wall', 'Defender\nWhen ~ blocks, it becomes a Bird Giant, and it loses flying and defender.'))).toBe(false);
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-22 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-22 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
