/**
 * Commander coordinator E, group counters 2/3, edh-e-14: the template data of parser/templates/zz-cloud/edh-e-14.json (Batroc the Leaper, Infinite Hourglass, Interdict, Clockwork Avian,
 * Clockwork Swarm) and the parser, renderer and engine changes of the round (one test each at the end). Guard G9 (design 6.8): every example lowers with its template, is automated and
 * passes the exact render gate (G6); every counter-example does not parse or parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an
 * example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10). The behavior is in edh-e-14-scenarios.test.ts. CR cites were checked against the real text.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE14 from '../../../src/parser/templates/zz-cloud/edh-e-14.json';
import review from '../../m5/golden/cards/edh-e-14-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE14 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one
 * or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'rep.edhe14.enters.counter.kicked.onSelf': ['Batroc the Leaper'],
  'sta.edhe14.pump.all.foreach.counters.self': ['Infinite Hourglass'],
  'rid.edhe14.countered.thatPermanent.cantActivate': ['Interdict'],
  'rid.edhe14.putCounters.maxTotal.self': ['Clockwork Avian', 'Clockwork Swarm', 'Clockwork Beast', 'Clockwork Steed'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** Templates whose examples are spell text (an instant or sorcery); the others are abilities of a creature (static, triggered, replacement). */
const SPELL = new Set<string>(['rid.edhe14.countered.thatPermanent.cantActivate']);
const parsedWith = (t: Template, text: string) =>
  (SPELL.has(t.id)
    ? parseCard(card('Example Plan', 'Sorcery', text, { mana_cost: '{X}{R}' }), OPTS)
    : parseCard(card('Example Relic', 'Legendary Artifact Creature — Golem Villain', text, { power: '2', toughness: '2' }), OPTS)).faces[0]!;

describe('edh-e-14 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-14.json, path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-14.json');
    expect(files.indexOf('zz-cloud/edh-e-14.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-14.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are eff.edhe14.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rid|kw|cm|rst|trg|rep)\.edhe14\./);
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

describe('edh-e-14 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bor more\b/, 'or less'], [/\bhaste\b/, 'flying'], [/\btop\b/, 'bottom'], [/\bonce\b/i, 'twice'], [/\bcast\b/, 'exile'], [/\bwithout paying its mana cost\b/, 'by paying its mana cost'], [/\bor less\b/, 'or more'], [/\bplay\b/, 'cast'], [/\battacked\b/, 'blocked'], [/\bspell\b/, 'ability'], [/\blife\b/, 'cards'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-14 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-14 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          if (words.includes('--') && i < words.indexOf('--')) return; // the ability word before the dash has no rules meaning (CR 207.2c)
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

describe.skipIf(index === null)('edh-e-14 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-14 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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

describe('edh-e-14 parser, renderer and resolver changes (one test each)', () => {
  const creature = (text: string) => parseCard(card('Example Relic', 'Legendary Artifact Creature — Golem Villain', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  const spell = (text: string) => parseCard(card('Example Plan', 'Instant', text, { mana_cost: '{X}{R}' }), OPTS).faces[0]!;
  it('parser/holes/filter.ts, render/np.ts (CR 113.7a, 205.2; Interdict): "from an artifact, creature, enchantment, or land" is a permanent source of any of the listed types; two types or a list with "source" keep their own readings', () => {
    const t = 'Counter target activated ability from an artifact, creature, enchantment, or land.';
    expect(fullyAutomated(spell(t))).toBe(true);
    expect(JSON.stringify(spell(t).abilities)).toContain('"abilitySource":{"types":["Artifact","Creature","Enchantment","Land"],"zone":"battlefield"}');
    expect(fullyAutomated(spell('Counter target activated ability from an artifact, creature, or land.'))).toBe(true);
    expect(fullyAutomated(spell('Counter target activated ability from an artifact, creature, creature, or land.'))).toBe(false);
    expect(fullyAutomated(spell('Counter target activated ability from an artifact, blorfty, or land.'))).toBe(false);
  });
  it('render/steps-zones.ts (CR 701.6a, 602.5; Interdict): the restriction on the source said without the "if" is the same JSON as the one with it', () => {
    const a = spell("Counter target activated ability. That permanent's activated abilities can't be activated this turn.");
    const b = spell("Counter target activated ability. If a permanent's ability is countered this way, activated abilities of that permanent can't be activated this turn.");
    expect(fullyAutomated(a)).toBe(true);
    expect(jsonKey(a.abilities)).toBe(jsonKey(b.abilities));
    expect(fullyAutomated(spell("Draw a card. That permanent's activated abilities can't be activated this turn."))).toBe(false);
  });
  it('parser/holes/edhv33.ts, render/edhv33.ts (CR 508.1, 509.1, 506.1; Daredevil Dragster, Clockwork Avian): "attacked or blocked this combat" is the history of the combat phase, not of the turn', () => {
    const t = 'At end of combat, if ~ attacked or blocked this combat, put a velocity counter on it.';
    expect(fullyAutomated(creature(t))).toBe(true);
    expect(JSON.stringify(creature(t).abilities)).toContain('"scope":"combat"');
    expect(JSON.stringify(creature(t.replace('combat, put', 'turn, put').replace('this combat', 'this turn')).abilities)).toContain('"scope":"turn"');
    expect(fullyAutomated(creature(t.replace('attacked or blocked', 'attacked or died')))).toBe(false);
  });
  it('parser/holes/cost.ts, model/cap-walk.ts (CR 119.4, 118.3, 602.2b, 122.1; Tornado): "Pay 3 life for each velocity counter on ~" counts the source\'s own counters; counters of another object are not a cost', () => {
    const t = '{2}{G}, Pay 3 life for each velocity counter on ~: Draw a card.';
    expect(fullyAutomated(creature(t))).toBe(true);
    expect(JSON.stringify(creature(t).abilities)).not.toContain('"kind":"manual"');
    expect(JSON.stringify(creature(t.replace('on ~', 'on target creature')).abilities)).toContain('"kind":"manual"');
    expect(JSON.stringify(creature(t.replace('3 life', '3 cards')).abilities)).toContain('"kind":"manual"');
  });
  it('types/ability.ts, effects/handlers/counters.ts (CR 122.1, 608.2d; Clockwork Avian): `maxTotal` needs the capability op:putCounters.maxTotal and an up-to count of X', () => {
    const t = '{X}, {T}: Put up to X +1/+0 counters on ~. This ability can\'t cause the total number of +1/+0 counters on ~ to be greater than four.';
    expect(fullyAutomated(creature(t))).toBe(true);
    expect(JSON.stringify(creature(t).abilities)).toContain('"maxTotal":4');
    expect(fullyAutomated(creature(t.replace('up to X', 'up to three')))).toBe(false);
  });
});
