/**
 * Commander coordinator E, round edh-e-51 (group mana, second batch): the template data of parser/templates/zz-cloud/edh-e-51.json (a spell's "Spend only mana produced by <sources> to cast this
 * spell" (Myr Superion, Imperiosaur); "You may spend white mana as though it were red mana" (Sunglasses of Urza); "Add {B}{B} or {G}{G}" (Cadaverous Bloom); "+1/+0 until end of turn for each mana from
 * a Treasure that was spent to cast this spell" (Spoils of the Hunt)), and the parser, renderer and engine changes of the round (one test each at the end). Guard G9 (design 6.8): every example lowers
 * with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON; near-miss mutations fail or differ; a nonsense word in
 * place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10). The behavior is in edh-e-51-scenarios.test.ts. CR cites are from memory in the
 * cloud session (no rules/cr): unverified.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE51 from '../../../src/parser/templates/zz-cloud/edh-e-51.json';
import review from '../../m5/golden/cards/edh-e-51-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE51 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on one or two cards, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT, owner instruction 2026-10-21; the standing rule of 2026-10-27). Imperiosaur,
 * Sunglasses of Urza are held-out cards opened by the owner (more cards 2026-11-06).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'sta.edhe51.spell.spendOnlyManaFrom': ['Myr Superion', 'Imperiosaur'],
  'sta.edhe51.spendColorAsColor': ['Sunglasses of Urza'],
  'eff.edhe51.mana.twoOfOneOfTwo': ['Cadaverous Bloom'],
  'eff.edhe51.pump.power.forEachManaFromSpent': ['Spoils of the Hunt'],
};
const NOT_PINNED: readonly string[] = [];
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** Templates whose examples are spell text (a sorcery); the others are abilities of a creature (static, activated, triggered). */
const SPELL = new Set<string>(['eff.edhe51.pump.power.forEachManaFromSpent']);
/** A synthetic card in which an example is an ability of the right kind. */
const parsedWith = (t: Template, text: string) =>
  (SPELL.has(t.id) ? parseCard(card('Example Plan', 'Instant', text), OPTS) : parseCard(card('Example Relic', 'Artifact Creature — Golem', text, { power: '2', toughness: '2' }), OPTS)).faces[0]!;

describe('edh-e-51 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-51.json, path order: after edh-e-5, before edh-e-6) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-51.json');
    expect(files.indexOf('zz-cloud/edh-e-51.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-e-5.json'));
    expect(files.indexOf('zz-cloud/edh-e-51.json')).toBeLessThan(files.indexOf('zz-cloud/edh-e-6.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 12; ids are trg./rid./eff./sta./kw.edhe51.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rid|kw|cm|trg)\.edhe51\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(12);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`)).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) {
      if (NOT_PINNED.includes(g.card)) expect(g.expect, g.card).toBeUndefined();
      else expect(g.expect, g.card).toBe('full');
    }
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

describe('edh-e-51 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const out = [`${body} unless it is blue.`, `${body} instead.`, `${body} at random.`, `${body} twice.`, `${body} if able.`, `${body} until end of turn.`];
  const swaps: [RegExp, string][] = [
    [/to cast/, 'to activate'], [/Merfolk/, 'Merfolk and artifacts'], [/white|blue|black/, 'colorless'], [/\{R\}\{R\}/, '{R}{W}'], [/Forest/, 'Forest or Island'], [/was spent/, 'were spent'], [/\+1\/\+0/, '+2/+0'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-51 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
  for (const t of MECH) {
    it(`${t.id}: an appended "unless/instead/at random/twice/if able/until end of turn" or a swapped key word never gives the example's JSON`, () => {
      for (const e of t.examples) {
        const orig = parsedWith(t, e.text);
        for (const m of nearMisses(e.text)) {
          if (m === e.text) continue;
          const f = parsedWith(t, m);
          expect(automated(f.abilities) && f.gate.every((g) => g.ok) && jsonKey(f.abilities) === jsonKey(orig.abilities), m).toBe(false);
        }
      }
    });
  }
});

describe('edh-e-51 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          if (/^counters?\b/.test(words[i + 1] ?? '')) return; // a counter's kind is any word (CR 122.1): "a blorfty counter" is a counter kind, not nonsense
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    });
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-51 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-51 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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

describe('edh-e-51 parser, renderer and engine changes (one test each)', () => {
  const face = (text: string, type = 'Artifact Creature — Golem') => parseCard(card('Example Relic', type, text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('model/cap-walk.ts, statics/hooks.ts, rules/sources.ts#spendAllows (CR 601.2h, 106.6; Myr Superion): the rule names its capability `rulemod:spendManaOnlyFrom`; a "spend only" sentence for an activation, a color or X stays manual', () => {
    expect(fullyAutomated(face('Spend only mana produced by artifacts to cast ~.'))).toBe(true);
    expect(JSON.stringify(face('Spend only mana produced by artifacts to cast ~.').abilities)).toContain('"rule":"spendManaOnlyFrom"');
    expect(fullyAutomated(face('Spend only mana produced by artifacts to activate ~.'))).toBe(false);
    expect(fullyAutomated(face('Spend only red mana to cast ~.'))).toBe(false);
    expect(fullyAutomated(face('Spend only mana produced by artifacts on X.'))).toBe(false);
  });
  it('statics/play-permits.ts#isSpendAsColorPermit, model/cap-walk.ts (CR 609.4b; Sunglasses of Urza): the permission is `permit:spendMana.asColor`; a color for itself, for several colors or for some spells only is not read', () => {
    expect(fullyAutomated(face('You may spend white mana as though it were red mana.'))).toBe(true);
    expect(JSON.stringify(face('You may spend white mana as though it were red mana.').abilities)).toContain('"asColor":"R"');
    expect(fullyAutomated(face('You may spend white mana as though it were white mana.'))).toBe(false);
    expect(fullyAutomated(face('You may spend white mana as though it were red or green mana.'))).toBe(false);
    expect(fullyAutomated(face('You may spend white mana as though it were red mana to cast creature spells.'))).toBe(false);
  });
  it('render/steps-cards.ts (CR 106.1b; Cadaverous Bloom): "{B}{B} or {G}{G}" is two mana of one of two types; any other pair of runs stays manual', () => {
    expect(fullyAutomated(face('{T}: Add {B}{B} or {G}{G}.'))).toBe(true);
    expect(JSON.stringify(face('{T}: Add {B}{B} or {G}{G}.').abilities)).toContain('"kind":"anyOneColor"');
    expect(fullyAutomated(face('{T}: Add {B}{G} or {G}{G}.'))).toBe(false);
    expect(fullyAutomated(face('{T}: Add {B}{B}{B} or {G}{G}{G}.'))).toBe(false);
  });
  it('render/qty.ts (CR 106.3, 601.2h; Spoils of the Hunt): "for each mana from a Treasure that was spent to cast ~" is the same count as the older "spent to cast it" wording of the token templates', () => {
    const was = face('Target creature gets +1/+0 until end of turn for each mana from a Forest that was spent to cast ~.', 'Instant');
    expect(fullyAutomated(was)).toBe(true);
    expect(fullyAutomated(face('Create a 1/1 white Spirit creature token with flying for each mana from a Forest that was spent to cast ~.', 'Instant'))).toBe(false);
  });
});
