/**
 * Commander coordinator D, round edh-d-112 (groups counters 1/3 and 2/3): the template data of parser/templates/zz-cloud/edh-d-112.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-d-112-scenarios.test.ts.
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
import edhD112 from '../../../src/parser/templates/zz-cloud/edh-d-112.json';
import review from '../../m5/golden/cards/edh-d-112-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';
import { isMixedActionList, type EventPattern } from '../../../src/types/ability';
import { mixedActionOccurrences } from '../../../src/triggers/occurrences';

const MECH = edhD112 as Template[];
const MECH_COUNT = 7;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full
  'rep.edhd112.enters.payThen.counters': ['Rescuer Sphinx'],
  'rep.edhd112.enters.counters.unless': ['Steel Exemplar'],
  'rid.edhd112.counter.thatSpell.ifMv.instead': ['Prohibit'],
  'eff.edhd112.forEachCounterRemoved.pump': ['Blademane Baku'],
  'eff.edhd112.nextTime.enter.additionalCounters': ['Storyweave'],
  'eff.edhd112.counters.objAndEachOtherSharingType': ['Invasion of New Capenna // Holy Frazzle-Cannon'],
  'eff.edhd112.mayPay.oneOfThreeMana': ['Isu the Abominable'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-112 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-112.json, path order: after edh-d-11, before edh-d-12) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-112.json');
    expect(files.indexOf('zz-cloud/edh-d-112.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-11.json'));
    expect(files.indexOf('zz-cloud/edh-d-112.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-12.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd112.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd112\./);
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

describe('edh-d-112 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bmore\b/, 'fewer'], [/\badditional\b/, 'other'], [/\bshares\b/, 'lacks'], [/\bor less\b/, 'or greater'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-112 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-112 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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
    }, 120_000);
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-d-112 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-112 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




// ---- the round's parser, lowering, engine and renderer changes ---------------------------------------------------------------------------------------------------------------

const face = (type: string, text: string) => parseCard(card('Test Card', type, text, /Creature/.test(type) ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-d-112 parser: "N or more colors of mana were spent to cast it" (parser/holes/edhd112.ts, CR 601.2h, 106.1)', () => {
  it('reads the object itself ("~", "this spell", the entering object\'s "it") as the colorsSpent count, at least N', () => {
    const f = face('Sorcery', 'If three or more colors of mana were spent to cast this spell, draw a card.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('{"cond":"compare","left":{"q":"colorsSpent"},"op":">=","right":3}');
  });
  it('fails closed for one color ("one or more colors" is no such count) and for "it" naming a spell a cast trigger is about', () => {
    expect(fullyAutomated(face('Sorcery', 'If one or more colors of mana were spent to cast this spell, draw a card.'))).toBe(false);
    expect(fullyAutomated(face('Creature — Human', 'Whenever you cast a spell, if two or more colors of mana were spent to cast it, draw a card.'))).toBe(false);
  });
});

describe('edh-d-112 parser: one single action beside a "one or more" action of the same player (parser/holes/event.ts#playerOr, CR 603.2c)', () => {
  it('"an opponent discards a card or mills one or more cards" is a batch trigger whose discard pattern is single', () => {
    const f = face('Creature — Human', 'Whenever an opponent discards a card or mills one or more cards, you gain 1 life.');
    expect(fullyAutomated(f)).toBe(true);
    const trig = (f.abilities[0] as { trigger: { on: EventPattern[]; batch?: boolean } }).trigger;
    expect(trig.batch).toBe(true);
    expect(trig.on.map((p) => (p as { single?: boolean }).single === true)).toEqual([true, false]);
  });
  it('the "one or more" one first, or a zone said by one of them, is not read this way (the negative cases)', () => {
    expect(fullyAutomated(face('Creature — Human', 'Whenever an opponent mills one or more cards or discards a card, you gain 1 life.'))).toBe(false);
    expect(fullyAutomated(face('Creature — Human', 'Whenever an opponent discards a card or mills one or more cards from their library, you gain 1 life.'))).toBe(false);
  });
});

describe('edh-d-112 engine: triggers/occurrences.ts#mixedActionOccurrences (CR 603.2c)', () => {
  const discard = { ev: 'action', verb: 'discard', actor: 'opponent', single: true } as EventPattern;
  const mill = { ev: 'action', verb: 'mill', actor: 'opponent' } as EventPattern;
  const ev = (verb: string, player: string, id: string) => ({ ev: 'action', roles: { player: { players: [player] }, object: { objects: [{ id, zone: 'graveyard' }] } }, data: { verb }, before: {}, seq: 0, batch: 0 }) as never;
  it('is a mixed list only with both kinds of action patterns', () => {
    expect(isMixedActionList([discard, mill])).toBe(true);
    expect(isMixedActionList([discard])).toBe(false);
    expect(isMixedActionList([mill, { ...mill, verb: 'discard' } as EventPattern])).toBe(false);
    expect(isMixedActionList([discard, { ev: 'zoneChange', subject: {}, to: 'graveyard' } as EventPattern])).toBe(false);
  });
  it('each discarded card is an occurrence; the milled cards of one player are one', () => {
    const d1 = ev('discard', 'p2', 'a'); const d2 = ev('discard', 'p2', 'b'); const m1 = ev('mill', 'p2', 'c'); const m2 = ev('mill', 'p2', 'd'); const m3 = ev('mill', 'p3', 'e');
    const hits = new Map([[d1, [discard]], [d2, [discard]], [m1, [mill]], [m2, [mill]], [m3, [mill]]]);
    const groups = mixedActionOccurrences([discard, mill], [d1, d2, m1, m2, m3], hits)!;
    expect(groups.map((g) => g.length).sort()).toEqual([1, 1, 1, 2]);
  });
});
