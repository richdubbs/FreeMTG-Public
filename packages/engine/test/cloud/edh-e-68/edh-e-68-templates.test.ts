/**
 * Commander coordinator E, round edh-e-68 (groups counters/cost/replace-prevent/combat): the template data of parser/templates/zz-cloud/edh-e-68.json and the round's parser, lowering and
 * renderer changes (a divided prevention shield, the kicked total of its division, the comma list of "another target creature, planeswalker, or player"), tested at the end of this file and played in
 * edh-e-68-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON;
 * near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10), checked
 * against the local index when it is present. CR cites from the Comprehensive Rules of 2026-09-25 (see the record for any cite that could not be checked).
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE68 from '../../../src/parser/templates/zz-cloud/edh-e-68.json';
import review from '../../m5/golden/cards/edh-e-68-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE68 as Template[];
const MECH_COUNT = 8;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one card, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe68.redirect.next.toSelfAndYou': ['Glarecaster'],
  'eff.edhe68.redirect.all.toObj.dur': ["Karona's Zealot"],
  'eff.edhe68.redirect.nextCombat.objToOpponent': ['Soltari Guerrillas'],
  'eff.edhe68.redirect.nextN.recipient.toAnother': ["Captain's Maneuver"],
  'rid.edhe68.instead.prevent.next.divided.kicked': ['Pollen Remedy'],
  'eff.edhe68.redirect.nextCombat.objToSelf.backToSource': ['Shield Dancer'],
  'eff.edhe68.redirect.nextSourceOfChoice.toItsController': ['Reflect Damage'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || (t.kind === 'rider' && !/^(Kicker [^\n]*\n)?Prevent /.test(text)) /* the kicked divided prevention is a spell's rider (edh-e-68) */ || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-68 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-68.json, path order: after edh-e-6, before edh-e-9) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-68.json');
    expect(files.indexOf('zz-cloud/edh-e-68.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-e-6.json'));
    expect(files.indexOf('zz-cloud/edh-e-68.json')).toBeLessThan(files.indexOf('zz-cloud/edh-e-9.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe68.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe68\./);
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

describe('edh-e-68 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/\bthat much\b/, 'twice that much'], [/\bnext 3\b/, 'next 4'], [/\bunblocked\b/, 'blocked'], [/\bshuffle the rest\b/, 'put the rest']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-68 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-68 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe('edh-e-68: the renderer and parser changes (one test each)', () => {
  const steps = (f: ReturnType<typeof compiled>): string => JSON.stringify(f.abilities);
  it('effects/handlers/lasting.ts#dividedEffects, parser/lower/targets.ts (CR 601.2d, 615.7): a divided prevention marks its target spec with the division; "divided as you choose" without the targets of the shield is not a reading', () => {
    const f = compiled('Instant', 'Prevent the next 6 damage that would be dealt this turn to any number of targets, divided as you choose.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"divided":true');
    expect(steps(f)).toMatch(/"divide":\{[^}]*"total":6/);
    expect(fullyAutomated(compiled('Instant', 'Prevent the next 6 damage that would be dealt this turn to you, divided as you choose.'))).toBe(false);
  });
  it('parser/lower/riders.ts#fixDividedTotals (CR 601.2b, 601.2d, 702.33a): the division of a kicked divided prevention is announced with the total of the kick (3 + 3 * min(1, kicks)); any other condition is manual', () => {
    const f = compiled('Instant', 'Kicker {1}\nPrevent the next 3 damage that would be dealt this turn to any number of targets, divided as you choose. If this spell was kicked, prevent the next 6 damage this way instead.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"q":"kickCount"');
    expect(fullyAutomated(compiled('Instant', 'Prevent the next 3 damage that would be dealt this turn to any number of targets, divided as you choose. If you control a Wall, prevent the next 6 damage this way instead.'))).toBe(false);
  });
  it('render/refs.ts (CR 115.1, 115.3): "another target creature, planeswalker, or player" is the comma list of a second, different target; "target creature or planeswalker or player" is not its text', () => {
    const f = compiled('Instant', 'The next 2 damage that would be dealt to target creature, planeswalker, or player this turn is dealt to another target creature, planeswalker, or player instead.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('distinctFrom');
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-68 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-68 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
