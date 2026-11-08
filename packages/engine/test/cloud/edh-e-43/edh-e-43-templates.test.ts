/**
 * Round edh-e-43 (Commander coordinator E, EDHREC top 30,000, group tokens): the template data of parser/templates/zz-cloud/edh-e-43.json (see the file) and the round's parser,
 * lowering, engine and renderer changes, tested at the end of this file and in edh-e-43-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites from the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE43 from '../../../src/parser/templates/zz-cloud/edh-e-43.json';
import review from '../../m5/golden/cards/edh-e-43-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE43 as Template[];
const MECH_COUNT = 3;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card that prints the wording and is full (opened by the owner's orders of 2026-11-06, "more cards")
  'trg.edhe43.attacks.mostLife.equipped': ['Seraphic Greatsword'],
  'rid.edhe43.token.itsPowerToughnessEqual': ['Gemini Engine'],
  'eff.edhe43.exile.tokensCreatedWithSelf': ['Dual Nature'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-43 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-43.json, path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-43.json');
    expect(files.indexOf('zz-cloud/edh-e-43.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-43.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe43.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe43\./);
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

describe('edh-e-43 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/attacks the player/, 'attacks a player'], [/most life/, 'least life'], [/equipped/, 'enchanted'], [/exile all tokens/, 'destroy all tokens'], [/power is equal/, 'toughness is equal'],
    [/its toughness/, 'its power'], [/created with/, 'exiled with'], [/leaves the battlefield/, 'enters'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-43 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-43 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          // (the kind of a counter is any word, CR 122.1: "a blorfty counter" is a counter of that kind, so the word before "counter(s)" is no nonsense word for this guard)
          if (/^counters?[.,]?$/.test(words[i + 1] ?? '')) return;
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

describe.skipIf(index === null)('edh-e-43 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-43 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-e-43 parser, renderer and engine changes (one test each)', () => {
  const creature = (text: string, type = 'Creature — Elf') => parseCard(card('Example Beast', type, text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  const json = (f: ReturnType<typeof creature>): string => JSON.stringify(f.abilities);
  it('parser/holes/qty.ts + render/qty.ts + render/steps-zones.ts (CR 700.4, 603.10a; Tobias): "for each nontoken creature you controlled that died this turn, create ..." is the turn\'s deaths of creatures that were yours; "you controlled" of anything else is no reading', () => {
    const f = creature('When Example Beast dies, for each nontoken creature you controlled that died this turn, create a 2/2 black Zombie creature token.');
    expect(fullyAutomated(f)).toBe(true);
    expect(json(f)).toContain('"subject":{"token":false,"types":["Creature"],"controller":"you"},"from":"battlefield","to":"graveyard"');
    expect(fullyAutomated(creature('When Example Beast dies, for each nontoken creature you controlled that was exiled this turn, create a 2/2 black Zombie creature token.'))).toBe(false);
    expect(fullyAutomated(creature('When Example Beast dies, for each nontoken creature an opponent controlled that died this turn, create a 2/2 black Zombie creature token.'))).toBe(false);
  });
  it('render/steps-zones.ts (CR 111.4, 208.3; Gemini Engine): a token "that\'s attacking" with its power and toughness set by a second sentence; with tapped, abilities or a count other than one the sentence stays unread', () => {
    const base = "Whenever Example Beast attacks, create a colorless Construct artifact creature token named Twin that's attacking. Its power is equal to Example Beast's power and its toughness is equal to Example Beast's toughness.";
    expect(fullyAutomated(creature(base))).toBe(true);
    expect(fullyAutomated(creature(base.replace("that's attacking", "that's tapped and attacking")))).toBe(false);
    expect(fullyAutomated(creature(base.replace('create a colorless', 'create two colorless')))).toBe(false);
  });
  it('parser/holes/event.ts (CR 701.27e, 603.2; Blightreaper Thallid): "transforms into ~" is an event that can stand in a union ("... or dies"); the lone "transforms into ~" keeps its m6 template', () => {
    const union = creature('When Example Beast transforms into Example Beast or dies, create a 1/1 green Phyrexian Saproling creature token.');
    expect(fullyAutomated(union)).toBe(true);
    expect(json(union)).toContain('"what":"transformed"');
    const alone = creature('Whenever Example Beast transforms into Example Beast, draw a card.');
    expect(alone.templatesUsed).toContain('trg.m6.self.transformsInto');
  });
  it('parser/holes/event.ts + render/evt.ts + actions/activate.ts (CR 702.107a; Herald of Anafenza): "you activate ~\'s outlast ability" is an activation of the object\'s own outlast ability; another creature\'s or a generic ability is no reading', () => {
    const f = creature("Outlast {2}{W}\nWhenever you activate Example Beast's outlast ability, create a 1/1 white Warrior creature token.");
    expect(fullyAutomated(f)).toBe(true);
    expect(json(f)).toContain('"ability":"outlast","source":{"self":true}');
    expect(fullyAutomated(creature("Outlast {2}{W}\nWhenever you activate an outlast ability, create a 1/1 white Warrior creature token."))).toBe(false);
  });
});
