/**
 * Commander coordinator E, round edh-e-58 (second batch, group enters-leaves, EDHREC top 30,000): the template data of parser/templates/zz-cloud/edh-e-58.json (see the file) and the round's parser
 * and renderer changes, tested at the end of this file and in edh-e-58-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25 (unverified where a cloud session had no copy).
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE58 from '../../../src/parser/templates/zz-cloud/edh-e-58.json';
import review from '../../m5/golden/cards/edh-e-58-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE58 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the cards of the EDHREC top 30,000 that print each wording and are full (held-out ones opened by the owner, more cards 2026-11-06)
  'eff.edhe58.return.thatCard.whenSelfLeaves': ['Portcullis'],
  'eff.edhe58.opponentChooses.yourPermanent.exile': ['Wormfang Crab'],
  'trg.edhe58.landOppControlsSameNameExiled.enters': ['Invader Parasite'],
  'eff.edhe58.fateseal': ['Mesmeric Sliver', 'Spin into Myth'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-58 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-58.json, path order: after edh-e-5.json, before edh-e-6.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-58.json');
    expect(files.indexOf('zz-cloud/edh-e-58.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-e-5.json'));
    expect(files.indexOf('zz-cloud/edh-e-58.json')).toBeLessThan(files.indexOf('zz-cloud/edh-e-6.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe58.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhe58\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(8);
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

describe('edh-e-58 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/\btwo\b/, 'three'], [/\bhaste\b/, 'flying'], [/\bWalls\b/, 'Wall'], [/\bone\b/, 'two']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-58 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-58 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          if (/^counters?[.,]?$/.test(words[i + 1] ?? '')) return; // a counter kind is any word (CR 122.1b: a counter with a name no rule defines is allowed)
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

describe.skipIf(index === null)('edh-e-58 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-58 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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



describe('edh-e-58 parser and renderer changes (one test each)', () => {
  const trig = (text: string, type = 'Artifact') => parseCard(card('Example Relic', type, text), OPTS).faces[0]!;
  it('parser/lower/anaphora.ts#resolveEventDelay (CR 603.7c, 400.7; Portcullis): "that card" after "exile that creature" in a delayed trigger of the ability\'s own object is the card the exile made, moved again by the binding name; a delay on another event keeps its reading', () => {
    expect(fullyAutomated(trig('Whenever a creature enters, exile that creature. Return that card to the battlefield under its owner\'s control when ~ leaves the battlefield.'))).toBe(true);
    expect(fullyAutomated(trig('Whenever a creature enters, exile that creature. Return that card to the battlefield under your control when ~ leaves the battlefield.'))).toBe(false);
    expect(fullyAutomated(trig('Whenever a creature enters, exile that creature. Return that card to the battlefield under its owner\'s control when ~ dies.'))).toBe(false);
  });
  it('parser/lower/ability.ts#otherThanEventSubject (CR 603.4; Portcullis, rulings 2004-10-04): "two or more other creatures" of a creature-enters trigger on a noncreature source does not count the creature that entered; on a creature source the filter stays "other than the source"', () => {
    const noncreature = trig('Whenever a creature enters, if there are two or more other creatures on the battlefield, exile that creature.');
    expect(JSON.stringify(noncreature.abilities)).toContain('"not":{"is":{"ref":"event","role":"subject"}}');
    const creature = trig('Whenever a creature enters, if there are two or more other creatures on the battlefield, draw a card.', 'Creature — Wizard');
    expect(JSON.stringify(creature.abilities)).toContain('"other":true');
  });
  it('render/fold-edhe58.ts (CR 608.2d, 701.13a): the opponent\'s choice among your other permanents is said "an opponent chooses a <desc> you control other than ~ and exiles it"; a choice by you, or of the opponent\'s own permanent, is another wording', () => {
    expect(fullyAutomated(trig('When ~ enters, an opponent chooses a permanent you control other than ~ and exiles it.\nWhen ~ leaves the battlefield, return the exiled card to the battlefield under its owner\'s control.'))).toBe(true);
    expect(fullyAutomated(trig('When ~ enters, you choose a permanent you control other than ~ and exile it.\nWhen ~ leaves the battlefield, return the exiled card to the battlefield under its owner\'s control.'))).toBe(false);
  });
  it('effects/handlers/cards-library.ts#fatesealHandler, model/cap-walk.ts (CR 701.29a): the capability is registered; "fateseal" takes a number and nothing else', () => {
    expect(ENGINE_CAPABILITIES.has('op:scry.fateseal')).toBe(true);
    expect(fullyAutomated(trig('Fateseal 2.', 'Sorcery'))).toBe(true);
    expect(fullyAutomated(trig('Fateseal 2, then draw a card.', 'Sorcery'))).toBe(true);
    expect(fullyAutomated(trig('Fateseal.', 'Sorcery'))).toBe(false);
    expect(fullyAutomated(trig('Each opponent fateseals 2.', 'Sorcery'))).toBe(false);
  });
  it('review finding (anaphora.ts): a delayed trigger on the very creature an earlier instruction moved keeps its reading ("When that creature dies this turn, return it ..."), not ambiguous', () => {
    expect(fullyAutomated(trig('Exile target creature you control, then return it to the battlefield under its owner\'s control. When that creature dies this turn, return it to its owner\'s hand.', 'Instant'))).toBe(true);
    expect(fullyAutomated(trig('Return target creature card from your graveyard to the battlefield. When that creature dies this turn, exile it.', 'Instant'))).toBe(true);
  });
});
