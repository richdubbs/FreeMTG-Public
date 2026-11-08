/**
 * Commander coordinator E, round edh-e-26 (hand and draw wordings): the template data of parser/templates/zz-cloud/edh-e-26.json and the round's parser and renderer changes,
 * tested at the end of this file and played in edh-e-26-scenarios.test.ts. Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6);
 * every counter-example does not parse or parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2).
 * Examples are synthetic wordings (design 6.10).
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE26 from '../../../src/parser/templates/zz-cloud/edh-e-26.json';
import review from '../../m5/golden/cards/edh-e-26-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE26 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one card, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe26.discard.thatObject': ["Fa'adiyah Seer"],
  'eff.edhe26.look.hand.choose.x': ['Mind Warp'],
  'eff.edhe26.discard.thoseChosenCards': ['Mind Warp'],
  'eff.edhe26.mill.thenMayPut.fromAmong.hand': ["T'Chaka, Venerable King"],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || t.kind === 'rider' || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-26 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-26.json, path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-26.json');
    expect(files.indexOf('zz-cloud/edh-e-26.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-26.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe26.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe26\./);
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

describe('edh-e-26 guard G9 (design 6.8): examples and counter-examples', () => {
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

describe('edh-e-26 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-26 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe('edh-e-26: the hole readings, lowering and renderer changes (one test each)', () => {
  const steps = (f: ReturnType<typeof compiled>): string => JSON.stringify(f.abilities);
  it('parser/holes/moved-words.ts + render/moved.ts + render/fold.ts (CR 400.3, 608.2c): "for each Swamp returned this way" counts what the return of any number of Swamps moved; a count with no return before it is not read', () => {
    const f = compiled('Instant', "Return any number of Swamps you control to their owner's hand. Draw a card for each Swamp returned this way.");
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"q":"resultCount"');
    expect(fullyAutomated(compiled('Instant', 'Draw a card for each Swamp returned this way.'))).toBe(false);
  });
  it('render/steps-cards.ts (CR 701.9a, 608.2c): "that player discards a card for each Swamp returned this way"', () => {
    expect(fullyAutomated(compiled('Sorcery', "Return any number of Swamps you control to their owner's hand. Target player discards a card for each Swamp returned this way."))).toBe(true);
  });
  it('parser/holes/cond.ts + render/steps-lasting.ts (CR 701.50a, 603.12): "When it connives this way" is the reflexive trigger of the connive right before it; with nothing before it, or after a different instruction, it is not read', () => {
    const f = compiled('Creature — Rogue', 'When this creature enters, it connives. When it connives this way, you gain 2 life.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"op":"reflexive"');
    expect(fullyAutomated(compiled('Creature — Rogue', 'When this creature enters, you gain 1 life. When it connives this way, you gain 2 life.'))).toBe(false);
    expect(fullyAutomated(compiled('Creature — Rogue', 'When this creature enters, it connives 2. When it connives this way, you gain 2 life.'))).toBe(true); // connive N: the same reading
    expect(fullyAutomated(compiled('Creature — Rogue', 'When this creature enters, it explores. When it connives this way, you gain 2 life.'))).toBe(false);
  });
  it('render/steps-flow.ts + render/steps-cards.ts (CR 107.3, 701.20e): "choose X cards from it" is exactly X of the looked-at hand; "choose Y cards" is not read', () => {
    expect(fullyAutomated(compiled('Artifact', "{X}, {T}: Look at target opponent's hand and choose Y nonland cards from it. That player discards those cards."))).toBe(false);
    expect(fullyAutomated(compiled('Artifact', "{X}, {T}: Look at target opponent's hand and choose X nonland cards from it. That player discards those cards."))).toBe(true);
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-26 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-26 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
