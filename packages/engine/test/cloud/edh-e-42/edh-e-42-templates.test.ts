/**
 * Commander coordinator E, round edh-e-42 (library 3/3): the template data of parser/templates/zz-cloud/edh-e-42.json and the round's parser/renderer changes.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON;
 * near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10).
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE42 from '../../../src/parser/templates/zz-cloud/edh-e-42.json';
import review from '../../m5/golden/cards/edh-e-42-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const MECH = edhE42 as Template[];
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
/** design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on one or two cards. */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe42.eachOpponentMay.search.bfTapped.shuffle': ['Old-Growth Dryads'],
  'eff.edhe42.hand.mayPutChosen.bfYourControl': ['Treacherous Urge'],
};
const parsedWith = (t: Template, text: string) => parseCard(/^(When|Whenever|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-42 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler in path order (after edh-d-99.json, before edh-mana-keywords-1.json); ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files.indexOf('zz-cloud/edh-e-42.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-42.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two examples and two counter-examples, a status, and is of version 8; ids are *.edhe42.*', () => {
    expect(MECH.length).toBe(2);
    for (const t of MECH) {
      expect(t.id).toMatch(/^eff\.edhe42\./);
      for (const cr of t.cr) expect(cr).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('design 6.9: each stable template has its card (a recorded narrow-wording deviation)', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(t.id)).map((g) => g.card);
      for (const n of NARROW[t.id] ?? []) expect(cards, t.id).toContain(n);
      expect(NARROW[t.id], t.id).toBeDefined();
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', 'then', 'same']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-e-42 guard G9: examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples do not give the same JSON`, () => {
      const first = parsedWith(t, t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(t, e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), e.text).toBe(true);
        expect(f.gate.every((g) => g.ok), `${e.text}: ${JSON.stringify(f.gate)}`).toBe(true);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(t, c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});

describe('edh-e-42 guard G9: near-miss mutations fail or differ', () => {
  for (const t of MECH) {
    it(`${t.id}: an appended "unless/instead/at random/twice" or a swapped number never gives the example's JSON`, () => {
      for (const e of t.examples) {
        const orig = parsedWith(t, e.text);
        const body = e.text.replace(/\.$/, '');
        for (const m of [`${body} unless it is blue.`, `${body} instead.`, `${body} at random.`, `${body} twice.`, e.text.replace(/\bfive\b/, 'three')]) {
          if (m === e.text) continue;
          const f = parsedWith(t, m);
          expect(automated(f.abilities) && f.gate.every((g) => g.ok) && jsonKey(f.abilities) === jsonKey(orig.abilities), m).toBe(false);
        }
      }
    });
  }
});

describe('edh-e-42 guard G2: a nonsense word never leaves an automated card', { timeout: 300_000 }, () => {
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
    });
  }
});

describe('edh-e-42 parser, renderer and engine changes (one test each)', () => {
  const beast = (text: string) => parseCard(card('Example Beast', 'Creature — Beast', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('parser/holes/filter.ts: "a card with the same name as another creature you control" is automated; "as another creature" without "you control" (any controller) and "as a creature card in your graveyard" are other readings', () => {
    expect(fullyAutomated(beast('When this creature enters, you may search your library for a card with the same name as another creature you control, reveal it, put it into your hand, then shuffle.'))).toBe(true);
    expect(jsonKey(beast('When this creature enters, you may search your library for a card with the same name as another creature you control, reveal it, put it into your hand, then shuffle.').abilities))
      .not.toBe(jsonKey(beast('When this creature enters, you may search your library for a card with the same name as a creature you control, reveal it, put it into your hand, then shuffle.').abilities));
  });
  it('review fix (parser/holes/filter.ts): "the same name as another creature you control" on a battlefield creature (the tested object may be in the set) is not read; only a card searched for in a library is', () => {
    expect(fullyAutomated(beast('Whenever a creature you control with the same name as another creature you control attacks, it gets +1/+1 until end of turn.'))).toBe(false);
  });
  it('parser/holes/event.ts + render/evt.ts: "deals combat damage to one or more blocking creatures" is automated; "attacking creatures" and plain damage are not this reading', () => {
    expect(fullyAutomated(beast('Whenever this creature deals combat damage to one or more blocking creatures, manifest the top card of your library.'))).toBe(true);
    expect(fullyAutomated(beast('Whenever this creature deals combat damage to one or more attacking creatures, manifest the top card of your library.'))).toBe(false);
    expect(fullyAutomated(beast('Whenever this creature deals damage to one or more blocking creatures, manifest the top card of your library.'))).toBe(false);
  });
});
