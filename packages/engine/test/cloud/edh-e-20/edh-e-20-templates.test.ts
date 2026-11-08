/**
 * Commander coordinator E, round edh-e-20 (group combat 2/2): the template data of parser/templates/zz-cloud/edh-e-20.json ("destroy it and all creatures ...", "return it and this Aura to their owners' hands",
 * "Each attacking creature gets +1/+0 until end of turn for each nonbasic land defending player controls") and the round's parser, engine and renderer changes (the block-pair filter `blockedWithThisTurn`),
 * tested at the end of this file and in edh-e-20-scenarios.test.ts. Guards G9, G2, G3 (design 6.8) as in every round; examples are synthetic wordings (design 6.10).
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE20 from '../../../src/parser/templates/zz-cloud/edh-e-20.json';
import reviewE20 from '../../m5/golden/cards/edh-e-20-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE20 as Template[];
/** The round's golden entries. */
const review = reviewE20 as { card: string; verified: string; expect?: string }[];
const MECH_COUNT = 2;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on one card (of the EDHREC top
 * 5,000) only, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (standing rule 2026-10-27, recommendation: accept).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe20.destroy.objAndObjs': ['Defiant Vanguard'],
  'eff.edhe20.return.objAndObj.hands': ['Contempt'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static line on an Aura, an Equipment or a creature, a triggered or activated line on an artifact or a creature, else a sorcery. */
const parsedWith = (t: Template, text: string) =>
  parseCard(
    /^\{/.test(text) ? card('Example Plan', 'Artifact', text)
    : /^(When|At the|Whenever)/.test(text) && /enchanted creature/.test(text) ? card('Example Plan', 'Enchantment — Aura', `Enchant creature\n${text}`)
    : /^(When|At the|Whenever)/.test(text) ? card('Example Plan', 'Creature — Pirate', text, { power: '3', toughness: '3' } as Partial<OracleCard>)
    : t.id.startsWith('sta.') && /enchanted creature/.test(text) ? card('Example Plan', 'Enchantment — Aura', `Enchant creature\n${text}`)
    : t.id.startsWith('sta.') ? card('Example Plan', 'Creature — Pirate', text, { power: '3', toughness: '3' } as Partial<OracleCard>)
    : card('Example Plan', 'Sorcery', text),
    OPTS,
  ).faces[0]!;

describe('edh-e-20 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-20.json, path order: after edh-d-99) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-20.json');
    expect(files.indexOf('zz-cloud/edh-e-20.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe20.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rid|cm)\.edhe20\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(9);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the cards that print the wording', () => {
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

describe('edh-e-20 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/half/, 'a third of'], [/rounded up/, 'rounded down'], [/round up/, 'round down'], [/your/, 'their'], [/first/, 'second'], [/an opponent/, 'you'], [/less/, 'more'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-20 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-20 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

const index = localIndex();

describe.skipIf(index === null)('edh-e-20 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-20 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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

const sorcery = (text: string) => parseCard(card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const enchantment = (text: string) => parseCard(card('Example Plan', 'Enchantment', text), OPTS).faces[0]!;
const creature = (text: string) => parseCard(card('Example Plan', 'Creature — Drake', text, { power: '3', toughness: '3' } as Partial<OracleCard>), OPTS).faces[0]!;
const artifact = (text: string) => parseCard(card('Example Plan', 'Artifact', text), OPTS).faces[0]!;


describe('edh-e-20 parser, engine and renderer changes (one test each)', () => {
  it('parser/holes/filter.ts, rules/history.ts, render/np.ts (CR 509.1g-h, 506.4): "creatures that blocked ~ this turn", "creatures it blocked this turn" and "that blocked or were blocked by it this turn" are the three roles of one block pair; other turns, other verbs and a swapped role are other readings', () => {
    const tap = creature('At end of combat, tap all creatures that blocked this creature this turn.');
    expect(fullyAutomated(tap)).toBe(true);
    expect(JSON.stringify(tap.abilities)).toContain('"blockedWithThisTurn":{"role":"blocker","with":{"ref":"self"}}');
    const kill = creature('When this creature blocks, at end of combat, destroy all creatures it blocked this turn.');
    expect(fullyAutomated(kill)).toBe(true);
    expect(JSON.stringify(kill.abilities)).toContain('"role":"blocked"');
    const either = sorcery('Destroy target creature that blocked or was blocked by a legendary creature this turn.');
    expect(fullyAutomated(either)).toBe(true);
    expect(JSON.stringify(either.abilities)).toContain('"role":"either"');
    for (const bad of ['At end of combat, tap all creatures that blocked this creature last turn.', 'At end of combat, tap all creatures that blocked this creature or were dealt damage this turn.', 'At end of combat, tap all creatures that attacked this creature this turn.']) {
      const f = creature(bad);
      expect(fullyAutomated(f) && JSON.stringify(f.abilities).includes('blockedWithThisTurn'), bad).toBe(false);
    }
  });
  it('the "this combat" scope is a field of the same filter (Cathedral Membrane\'s "each creature it blocked this combat"); "this turn" does not give it', () => {
    const a = creature('When this creature dies during combat, it deals 6 damage to each creature it blocked this combat.');
    expect(fullyAutomated(a)).toBe(true);
    expect(JSON.stringify(a.abilities)).toContain('"combat":true');
    const b = creature('When this creature dies during combat, it deals 6 damage to each creature it blocked this turn.');
    expect(JSON.stringify(b.abilities)).not.toContain('"combat":true');
  });
  it('rules/history.ts#HISTORY_FILTER_FIELDS and the capability list name blockedWithThisTurn (a filter that reads the history needs the history)', () => {
    expect(ENGINE_CAPABILITIES).toContain('filter:blockedWithThisTurn');
  });
});
