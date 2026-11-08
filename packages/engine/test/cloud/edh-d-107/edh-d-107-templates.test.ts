/**
 * Round edh-d-107 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups graveyard 1/3 and 2/3): the template data of parser/templates/zz-cloud/edh-d-107.json (see the file) and the
 * round's parser, lowering, engine and renderer changes, tested at the end of this file and in edh-d-107-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhD107 from '../../../src/parser/templates/zz-cloud/edh-d-107.json';
import review from '../../m5/golden/cards/edh-d-107-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD107 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full (each wording is printed on that one card)
  'rid.edhd107.dig.upToInstead.hand': ['Gather the Pack'],
  'rid.edhd107.dig.mayInstead.battlefield': ['See the Unwritten'],
  'eff.edhd107.dig.revealedThisWay.hand.rest.graveyard': ['Glint Raker'],
  'eff.edhd107.return.all.gy.bf.thenSameFor': ['Estrid, the Masked'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-107 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-107.json, path order: after edh-d-102, before edh-d-11) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-107.json');
    expect(files.indexOf('zz-cloud/edh-d-107.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-107.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd107.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd107\./);
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

describe('edh-d-107 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\binstead of one\b/, 'instead of two'], [/\binto your hand\b/, 'onto the battlefield'], [/\bonto the battlefield instead\b/, 'into your hand instead'], [/\bup to two\b/, 'two'],
    [/\bthe same\b/, 'it'], [/\brevealed this way\b/, 'exiled this way'], [/\binto your graveyard\.$/, 'on the bottom of your library.'], [/\bthen do\b/, 'and do'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-107 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-107 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        let reminder = false; // CR 207.2: reminder text (in parentheses) has no rules meaning; its words are not tested
        words.forEach((w, i) => {
          const inReminder = reminder || w.startsWith('(') || w.startsWith('\n(');
          if (w.includes(')')) reminder = false;
          else if (w.startsWith('(') || w.includes('\n(')) reminder = true;
          if (inReminder) return;
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    }, 120_000); // like the other rounds' G2 guards: one parse per word of each example
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-d-107 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-107 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-d-107 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const relic = (text: string) => parseCard(card('Example Relic', 'Artifact', text), OPTS).faces[0]!;
  it('parser/holes/cost.ts (CR 118.3, 404.1): "Exile a <card> from a graveyard" and "Exile two <cards> from a single graveyard" are costs of any graveyard; "two cards from a graveyard" and "from graveyards" are not read', () => {
    expect(JSON.stringify(relic('{2}, Exile an artifact card from a graveyard: Draw a card.').abilities)).toContain('"anyGraveyard":true');
    expect(JSON.stringify(relic('{2}, Exile three land cards from a single graveyard: Draw a card.').abilities)).toContain('"singleGraveyard":true');
    for (const t of ['{2}, Exile two land cards from a graveyard: Draw a card.', '{2}, Exile two land cards from graveyards: Draw a card.', '{2}, Exile a land card from a single graveyard: Draw a card.']) {
      expect(JSON.stringify(relic(t).abilities), t).not.toContain('anyGraveyard');
    }
  });
  it('parser/holes/cost.ts (CR 404.2): "Exile the top two red cards of your graveyard" is the N topmost cards; "of a graveyard" is not read', () => {
    expect(JSON.stringify(relic('{2}, Exile the top two red cards of your graveyard: Draw a card.').abilities)).toContain('"count":2,"filter":{"colors":["R"]},"top":true');
    expect(JSON.stringify(relic('{2}, Exile the top two red cards of a graveyard: Draw a card.').abilities)).not.toContain('"top":true');
  });
  it('render/refs.ts (CR 110.1): "each <group> on the battlefield" is every such permanent; with a controller named it is not that wording', () => {
    expect(fullyAutomated(spell('Put a charge counter on each Goblin on the battlefield.'))).toBe(true);
    expect(fullyAutomated(spell('Put a charge counter on each Goblin you control on the battlefield.'))).toBe(false);
  });
  it('render/fold.ts (CR 701.20a): "an <X> card revealed this way" after a reveal of the top cards; after a look it is not', () => {
    expect(fullyAutomated(spell('Reveal the top three cards of your library. Put a land card revealed this way into your hand and the rest into your graveyard.'))).toBe(true);
    expect(fullyAutomated(spell('Look at the top three cards of your library. Put a land card revealed this way into your hand and the rest into your graveyard.'))).toBe(false);
  });
  it('parser/lower/conditions.ts (CR 608.2d, 609.3): "exile two cards from your graveyard. If you can\'t" makes the choice all or none; "exile a card" (one) is not read so', () => {
    expect(JSON.stringify(spell("Exile two cards from your graveyard. If you can't, draw a card.").abilities)).toContain('"allOrNone":true');
    expect(JSON.stringify(spell("Exile a card from your graveyard. If you can't, draw a card.").abilities)).not.toContain('allOrNone');
  });
  it('parser/holes/object.ts (CR 404.1): "the top creature card of target opponent\'s graveyard"; "of target opponent\'s library" is another reading', () => {
    expect(JSON.stringify(relic("{T}: Put the top creature card of target opponent's graveyard onto the battlefield under your control.").abilities)).toContain('"matching":{"types":["Creature"]}');
    expect(JSON.stringify(relic("{T}: Put the top creature card of target opponent's library onto the battlefield under your control.").abilities)).not.toContain('"matching"');
  });
  it('parser/holes/cond.ts, render/cond.ts (CR 404.1, 608.2c): "if no cards are in that graveyard" after a card target; with no earlier card it has no antecedent', () => {
    expect(fullyAutomated(relic("{T}: Exile target card from an opponent's graveyard. If no cards are in that graveyard, draw a card."))).toBe(true);
    expect(fullyAutomated(relic('{T}: You gain 1 life. If no cards are in that graveyard, draw a card.'))).toBe(false);
  });
  it('parser/holes/edhd107.ts (CR 608.2c): "then do the same for <cards>" after all cards of your graveyard; after a target it is not printed back', () => {
    expect(fullyAutomated(spell('Return all creature cards from your graveyard to the battlefield, then do the same for land cards.'))).toBe(true);
    expect(fullyAutomated(spell('Return target creature card from your graveyard to the battlefield, then do the same for land cards.'))).toBe(false);
  });
});
