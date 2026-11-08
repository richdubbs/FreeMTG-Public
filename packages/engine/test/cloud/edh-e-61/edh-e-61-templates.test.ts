/**
 * Coordinator E, round edh-e-61 (group rest 3/3, second batch): the template data of parser/templates/zz-cloud/edh-e-61.json and the round's parser, lowering, engine and renderer changes,
 * tested at the end of this file and in edh-e-61-scenarios.test.ts.
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
import edhE61 from '../../../src/parser/templates/zz-cloud/edh-e-61.json';
import review from '../../m5/golden/cards/edh-e-61-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE61 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe61.linked.turnFaceUp.ifTypePutOntoBattlefield': ['Clone Shell', "Summoner's Egg"],
  'sta.edhe61.self.protectionFromColorsAmong': ['Empty-Shrine Kannushi'],
  'rst.edhe61.group.cantBeTargets.blue': ['Spellbane Centaur'],
  'eff.edhe61.damage.halfDownAndHalfUp': ['Banshee'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || text.startsWith('~') ? card('Example Subject', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-61 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-61.json, path order: after edh-e-6.json, before edh-e-9.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-61.json');
    expect(files.indexOf('zz-cloud/edh-e-61.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-e-6.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe61.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|rst|trg|ch|rid)\.edhe61\./);
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

describe('edh-e-61 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bhaste\b/, 'x'], [/\bblocked\b/, 'x'], [/\buntapped\b/, 'x'], [/\btoughness\b/, 'power'], [/\battack\b/, 'block'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-61 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-61 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-e-61 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-61 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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


/** A parsed spell (or creature) card with the text, as a decklist card gets it. */
const parsedText = (text: string, type = 'Instant') => parseCard(type.startsWith('Creature') ? card('Example Subject', type, text, { power: '2', toughness: '2' }) : card('Example Plan', type, text), OPTS).faces[0]!;

describe('edh-e-61: the round\'s parser, lowering, lint and renderer changes', () => {
  it('render/np.ts teamWords (Combo Attack): "creatures your team controls" says the plain creatures you control, only for targets of a plain creature description', () => {
    const f = parsedText('Two target creatures your team controls each deal damage equal to their power to target creature.');
    expect(fullyAutomated(f)).toBe(true);
    // negative: an opponent's team is nobody (no such wording), and the team of a described subset stays unsaid
    expect(fullyAutomated(parsedText('Two target creatures your opponent\'s team controls each deal damage equal to their power to target creature.'))).toBe(false);
    expect(fullyAutomated(parsedText('Two target tapped creatures your team controls each deal damage equal to their power to target creature.'))).toBe(false);
  });
  it('render/fold-edhn10.ts pumpChoice (Jodah\'s Avenger): one listed keyword may be protection from a color; any other qualified keyword stays unread', () => {
    const base = '{0}: Until end of turn, ~ gets -1/-1 and gains your choice of double strike, X, vigilance, or shadow.';
    expect(fullyAutomated(parsedText(base.replace('X', 'protection from red'), 'Creature — Soldier'))).toBe(true);
    expect(fullyAutomated(parsedText(base.replace('X', 'protection from artifacts'), 'Creature — Soldier'))).toBe(false);
    expect(fullyAutomated(parsedText(base.replace('X', 'protection from the color of your choice'), 'Creature — Soldier'))).toBe(false);
  });
  it('parser/holes/object.ts (Choking Vines): "each of those creatures" after the announced targets reads as the group of those targets; with no earlier targets it stays unread', () => {
    expect(fullyAutomated(parsedText('Up to two target attacking creatures become blocked. ~ deals 1 damage to each of those creatures.'))).toBe(true);
    expect(fullyAutomated(parsedText('~ deals 1 damage to each of those creatures.'))).toBe(false);
  });
  it('parser/lower/join-edhd101.ts: only the exact pair "Turn the exiled card face up. If it\'s a <type> card, put it onto the battlefield under your control." is joined', () => {
    const imprint = 'When ~ enters, you may exile a card from your hand face down.\n';
    expect(fullyAutomated(parsedText(`${imprint}When ~ dies, turn the exiled card face up. If it's a land card, put it onto the battlefield under your control.`, 'Creature — Egg'))).toBe(true);
    expect(fullyAutomated(parsedText(`${imprint}When ~ dies, turn the exiled card face up. If it's a land card, put it into your hand.`, 'Creature — Egg'))).toBe(false);
    expect(fullyAutomated(parsedText(`${imprint}When ~ dies, turn the exiled card face up. If it's a land card, put it onto the battlefield under an opponent's control.`, 'Creature — Egg'))).toBe(false);
  });
});
