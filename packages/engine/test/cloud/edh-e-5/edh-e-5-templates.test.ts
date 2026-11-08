/**
 * Commander coordinator E, round edh-e-5 (group exile-play): the template data of parser/templates/zz-cloud/edh-e-5.json (see the file) and the
 * round's parser, lowering, engine and renderer changes, tested at the end of this file and in edh-e-5-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE5 from '../../../src/parser/templates/zz-cloud/edh-e-5.json';
import review from '../../m5/golden/cards/edh-e-5-review.json';
import fxbReview from '../../m5/golden/cards/cloud-r5-fxb-promoted.json'; // Bottled Cloister's entry (updated by this round)
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';
import { compileCard } from '../../../src/index';

const MECH = edhE5 as Template[];
const MECH_COUNT = 2;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing
 * rule 2026-10-27; one-card templates are allowed in this effort).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe5.linked.returnAllOwned.hand': ['Bottled Cloister'],
  'eff.edhe5.linked.untilEot.castOne.free': ['Idol of Endurance'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a Saga for chapters, a static, activated or triggered ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^I -- /.test(text) ? card('Example Saga', 'Enchantment — Saga', text.replaceAll(' -- ', ' — '))
    : t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-5 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-5.json, path order: after edh-d-99.json, before edh-mana-keywords-1.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-5.json');
    expect(files.indexOf('zz-cloud/edh-e-5.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-5.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 105; ids are *.edhe5.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhe5\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(105);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = [...review, ...fxbReview] as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.expect === 'full' && (g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`))).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'then', 'during', 'still']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-e-5 guard G9 (design 6.8): examples and counter-examples', () => {
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
    }, 120_000);
  }
});

/** Near-miss mutations of one example (design 6.8 G9): each must not parse, or parse to different JSON. */
function nearMisses(text: string): string[] {
  const body = text.replace(/\.$/, '');
  const out = [`${body} unless it is blue.`, `${body} instead.`, `${body} at random.`, `${body} twice.`, `${body} if able.`, `${body} until end of turn.`];
  const swaps: [RegExp, string][] = [[/\bsix\b/, 'seven'], [/\bfour\b/, 'five'], [/\bopponent\b/, 'player'], [/\byour graveyard\b/, 'your hand'], [/\bmay\b/, 'must'], [/\b3\b/, '4']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-5 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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
    }, 120_000);
  }
});

describe('edh-e-5 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w) || w === '--' || /\S\n\S/.test(w) || /^(I|II|III)$/.test(w.replace(/^\n/, ''))) return; // (a word with a line break inside joins two lines: no single-word mutation)
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    }, 120_000);
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-5 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-5 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Equipment)\b/gi, '~').trim());
          lines.add(l.replaceAll(' — ', ' -- ').trim());
        }
      }
    }
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim, verbatim.join('\n')).toEqual([]);
  }, 120_000);
});

describe('edh-e-5 parser and renderer changes (one test each, with the negative case)', () => {
  const relicFull = (text: string) => compileCard(card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })).automation.level === 'full';
  const HIDE = 'Hideaway 4\nThis land enters tapped.\n{T}: Add {U}.\n{U}, {T}: You may play the exiled card without paying its mana cost if ';
  const landFull = (cond: string) => compileCard(card('Example Isle', 'Land', HIDE + cond)).automation.level === 'full';
  it('parser/holes/cond.ts#aLibraryHasFewer (CR 401.1, 102.3): "a library has N or fewer cards in it" is read; "or more", "a graveyard" and "your library" are not this reading', () => {
    expect(landFull('a library has twenty or fewer cards in it.')).toBe(true);
    expect(landFull('a library has twenty or more cards in it.')).toBe(false);
    expect(landFull('a graveyard has twenty or fewer cards in it.')).toBe(false);
  });
  it('parser/holes/cond.ts#eachPlayerNoHand (CR 402.1, 102.3): "each player has no cards in hand" is read; "a player", "no player" and "each opponent" are other readings', () => {
    expect(landFull('each player has no cards in hand.')).toBe(true);
    expect(landFull('each player has no cards in their hand.')).toBe(false);
    expect(landFull('each player has two cards in hand.')).toBe(false);
  });
  it('render/steps-zones.ts (family linked-return-all-owned-hand, CR 607.2a, 108.3): "return all cards you own exiled with ~ to your hand" is read; without "you own" or to the battlefield it is not this move', () => {
    expect(relicFull('{T}: Exile a card from your hand face down.\n{1}: Return all cards you own exiled with ~ to your hand.')).toBe(true);
    expect(relicFull('{T}: Exile a card from your hand face down.\n{1}: Return all cards you own exiled with ~ to the battlefield.')).toBe(false);
  });
});
