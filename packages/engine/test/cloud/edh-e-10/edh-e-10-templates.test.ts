/**
 * Commander coordinator E, library 2/3, round edh-e-10 (code edhe10): the template data of parser/templates/zz-cloud/edh-e-10.json (see the file) and the round's parser, lowering and renderer changes, tested at the
 * end of this file and in edh-e-10-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON; near-miss mutations fail or
 * differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10), checked against the local index when it is present.
 */
import { describe, expect, it } from 'vitest';
import { compileCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE10 from '../../../src/parser/templates/zz-cloud/edh-e-10.json';
import review from '../../m5/golden/cards/edh-e-10-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE10 as Template[];
const MECH_COUNT = 3;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on one
 * card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe10.revealUntil.countNonland': ['Fathom Trawl'],
  'eff.edhe10.putNonlandRevealedHand.restBottomAny': ['Fathom Trawl'],
  'eff.edhe10.whenRevealNonlandThisWay.damageMv': ['Calibrated Blast'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a trigger on an artifact creature, "this artifact" / "this Vehicle" / "this planeswalker" on such a permanent, a static ability on an enchantment, else a sorcery. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^(Whenever|When|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })
    : /this artifact/.test(text) ? card('Example Relic', 'Artifact', text)
      : /this Vehicle/.test(text) ? card('Example Cart', 'Artifact — Vehicle', text, { power: '3', toughness: '3' })
        : /this planeswalker/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '3' })
      : t.kind === 'static' ? card('Example Shrine', 'Enchantment', text) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-10 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-10.json, path order: after edh-d-9.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-10.json');
    expect(files.indexOf('zz-cloud/edh-e-10.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-9.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status; ids are *.edhe10.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|kw)\.edhe10\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the card that prints the wording', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`) || g.verified.includes(`${t.id})`)).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'additional', 'except', "can't", 'would', 'next', 'then', 'during']) {
        if (words.includes(w)) expect((t.consumes ?? []).join(' ').split(' '), `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-e-10 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/creatures/, 'artifacts'], [/exile/i, 'Destroy'], [/stun/, 'shield'], [/hand/, 'graveyard'], [/other/, 'each'], [/planeswalker type/, 'creature type']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-10 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-10 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          if (/^counters?[.,]?$/.test(words[i + 1] ?? '')) return; // a counter kind is any word (CR 122.1b)
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

describe.skipIf(index === null)('edh-e-10 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-10 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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

/** The parser, lowering and renderer changes of the round: each wording in a synthetic card, with the near misses that must stay out. */
const asCard = (text: string, type = 'Artifact Creature — Construct') => card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {});
/** The card's own automation level (a manual cost part, which `fullyAutomated` does not see, caps it at partial). */
const isFull = (text: string, type?: string): boolean => compileCard(asCard(text, type)).automation.level === 'full' && fullyAutomated(parseCard(asCard(text, type), OPTS).faces[0]!);

describe('edh-e-10: readings of the reveal-until cards (each with its near misses)', () => {
  const REV = 'Reveal cards from the top of your library until you reveal a nonland card. ';
  it('CR 701.20a, 401.4 (parser/holes/object.ts, render/fold-edhe10.ts): "Put the revealed cards / all cards revealed this way on the bottom of your library in a random / any order." after your own reveal until; without the reveal, or not on the bottom, it stays manual', () => {
    expect(isFull(`${REV}Put the revealed cards on the bottom of your library in a random order.`, 'Sorcery')).toBe(true);
    expect(isFull(`${REV}Put the revealed cards on the bottom of your library in any order.`, 'Sorcery')).toBe(true);
    expect(isFull(`${REV}Put all cards revealed this way on the bottom of your library in any order.`, 'Sorcery')).toBe(true);
    expect(isFull('Put the revealed cards on the bottom of your library in a random order.', 'Sorcery')).toBe(false);
    expect(isFull(`${REV}Put the revealed cards into your hand.`, 'Sorcery')).toBe(false);
    expect(isFull(`${REV}Put the revealed cards on top of your library in any order.`, 'Sorcery')).toBe(false);
  });
  it('CR 205.2a, 608.2c (parser/lower/mentions.ts): the nonland card a reveal stopped at is never "that creature"; the chosen target is', () => {
    expect(isFull(`Choose target creature. ${REV}That creature gets +X/-X until end of turn, where X is that card's mana value.`, 'Sorcery')).toBe(true);
    expect(isFull(`Choose target creature. Reveal cards from the top of your library until you reveal a creature card. That creature gets +X/-X until end of turn, where X is that card's mana value.`, 'Sorcery')).toBe(false);
  });
  it('CR 603.12 (parser/lower/conditions.ts): a reflexive trigger may wait for a reveal until of an earlier sentence of the same ability, and only for that', () => {
    const blast = (when: string) => `${REV}Put the revealed cards on the bottom of your library in a random order. When you reveal ${when} this way, ~ deals damage equal to that card's mana value to any target.`;
    expect(isFull(blast('a nonland card'), 'Sorcery')).toBe(true);
    expect(isFull(blast('a land card'), 'Sorcery')).toBe(false);
  });
  it("CR 608.2c, 701.20a (parser/lower/anaphora.ts): a bare \"it\" after the reveal of one top card is that card, not the creature the trigger is about; a creature's own words stay its (\"that creature\")", () => {
    const woods = (cond: string, then: string) => `Whenever a creature attacks you, reveal the top card of your library. If ${cond}, ${then}.`;
    expect(isFull(woods("it's a Forest card", 'remove that creature from combat'), 'Enchantment')).toBe(true);
    expect(isFull('Whenever a creature attacks you, look at the top card of your library. If it\'s a Forest card, remove that creature from combat.', 'Enchantment')).toBe(false); // a look, not a reveal: still ambiguous, fail closed
  });
});
