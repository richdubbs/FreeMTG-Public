/**
 * Commander coordinator E, library 2/3, round edh-e-41 (code edhe41): the template data of parser/templates/zz-cloud/edh-e-41.json (see the file) and the round's parser, lowering and renderer changes, tested at the
 * end of this file and in edh-e-41-scenarios.test.ts.
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
import edhE41 from '../../../src/parser/templates/zz-cloud/edh-e-41.json';
import review from '../../m5/golden/cards/edh-e-41-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE41 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on one
 * card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe41.pay.anyAmountOfLife': ['Plunge into Darkness'],
  'eff.edhe41.dig.putHand.rest.exile': ['Plunge into Darkness'],
  'eff.edhe41.wish.putTop': ["The Raven's Warning"],
  'eff.edhe41.mayReveal.X': ['Nightshade Assassin'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a trigger on an artifact creature, "this artifact" / "this Vehicle" / "this planeswalker" on such a permanent, a static ability on an enchantment, else a sorcery. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^(Whenever|When|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })
    : /this artifact/.test(text) ? card('Example Relic', 'Artifact', text)
      : /this Vehicle/.test(text) ? card('Example Cart', 'Artifact — Vehicle', text, { power: '3', toughness: '3' })
        : /this planeswalker/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '3' })
      : t.kind === 'static' ? card('Example Shrine', 'Enchantment', text) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-41 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-41.json, path order: after edh-d-99.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-41.json');
    expect(files.indexOf('zz-cloud/edh-e-41.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status; ids are *.edhe41.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|kw)\.edhe41\./);
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

describe('edh-e-41 guard G9 (design 6.8): examples and counter-examples', () => {
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

describe('edh-e-41 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-41 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-e-41 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-41 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
const asCard = (text: string, type = 'Sorcery') => card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {});
/** The card's own automation level (a manual cost part, which `fullyAutomated` does not see, caps it at partial). */
const isFull = (text: string, type?: string): boolean => compileCard(asCard(text, type)).automation.level === 'full' && fullyAutomated(parseCard(asCard(text, type), OPTS).faces[0]!);

describe('edh-e-41: the reading "if <A> or <B> is exiled this way" (parser/holes/moved.ts, render/moved.ts)', () => {
  const HAND = 'Target opponent reveals their hand. You choose a nonland card from it. Exile that card. ';
  it('CR 608.2c, 608.2h, 205.2a: two plain descriptions with their own articles, the passive present tense: automated and rendered back; a third description, a different verb or a single one stay as before', () => {
    expect(isFull(`${HAND}If a sorcery card or a land card is exiled this way, they lose 2 life. Otherwise, you lose 2 life.`)).toBe(true);
    expect(isFull(`${HAND}If a sorcery card or a card with flash is exiled this way, they lose 2 life.`)).toBe(true);
    expect(isFull(`${HAND}If a sorcery card is exiled this way, they lose 2 life. Otherwise, you lose 2 life.`)).toBe(true); // the older reading, unchanged
    expect(isFull(`${HAND}If a sorcery card or a land card or an artifact card is exiled this way, they lose 2 life.`)).toBe(false);
    expect(isFull(`${HAND}If a sorcery card or a land card is discarded this way, they lose 2 life.`)).toBe(false);
    expect(isFull(`${HAND}If a sorcery card or a land card is put onto the battlefield this way, they lose 2 life.`)).toBe(false); // the verb must be the one of the instruction right before (an exile)
  });
});

describe('edh-e-41: the pay of any amount of life and what reads it (render/steps-flow.ts, render/qty.ts, render/fold.ts)', () => {
  it('CR 118.12, 119.4, 608.2c: "Pay any amount of life. Draw that many cards." is automated; with "you may" the older template keeps the sentence (no second reading, guard G5)', () => {
    expect(isFull('Pay any amount of life. Draw that many cards.')).toBe(true);
    expect(isFull('You may pay any amount of life. Draw that many cards.')).toBe(true);
    expect(parseCard(asCard('You may pay any amount of life. Draw that many cards.'), OPTS).faces[0]!.templatesUsed).toContain('eff.edhp16.mayPay.anyAmountOfLife');
    expect(isFull('Pay any amount of mana. Draw that many cards.')).toBe(true); // edh-next-136's, unchanged
    expect(isFull('Each opponent pays any amount of life. Draw that many cards.')).toBe(false);
    expect(isFull('Pay any amount of life, then draw that many cards.')).toBe(true);
  });
  it('CR 701.20e, 406.1, 608.2c: "Put one of those cards into your hand and exile the rest." after a look at the top cards; the rest on the bottom, face down or another zone is another template', () => {
    const LOOK = 'Look at the top four cards of your library. ';
    expect(isFull(`${LOOK}Put one of them into your hand and exile the rest.`)).toBe(true);
    expect(isFull(`${LOOK}Put two of those cards into your hand and exile the rest.`)).toBe(true);
    expect(isFull(`${LOOK}Put one of them into your hand and exile the rest face down.`)).toBe(false);
    expect(isFull(`${LOOK}Put one of them into your graveyard and exile the rest.`)).toBe(false);
    expect(isFull('Put one of them into your hand and exile the rest.')).toBe(false); // nothing looked at
  });
});

describe('edh-e-41: "put a card you own from outside the game on top of your library" (types/ability.ts fromOutside.top, effects/handlers/outside.ts)', () => {
  it('CR 400.11b, 401.4: the optional wish that puts the card on top of the library (never revealed); other destinations stay with the older templates or manual', () => {
    expect(isFull('You may put a card you own from outside the game on top of your library.')).toBe(true);
    expect(isFull('You may put a card you own from outside the game into your hand.')).toBe(true);
    expect(isFull('You may reveal a card you own from outside the game and put it on top of your library.')).toBe(false);
    expect(isFull('You may put a card you own from outside the game on the bottom of your library.')).toBe(false);
  });
});

describe('edh-e-41: "you may reveal X <cards> in your hand. If you do, ... X" (parser/lower/edhd90.ts, render/fold-edhe41.ts, render/mods.ts)', () => {
  const ETB = 'When this creature enters, you may reveal X black cards in your hand. If you do, ';
  it('CR 107.3, 608.2h: the X is the number of cards revealed, in a triggered ability only; an announced X, a second X definition or an X read before the reveal stay manual', () => {
    expect(isFull(`${ETB}target creature gets -X/-X until end of turn.`, 'Artifact Creature — Construct')).toBe(true);
    expect(isFull(`${ETB}target creature gets +X/+X until end of turn.`, 'Artifact Creature — Construct')).toBe(true);
    expect(isFull('You may reveal X black cards in your hand. If you do, target creature gets -X/-X until end of turn.')).toBe(false); // a spell: its X is the announced one
    expect(isFull('When this creature enters, you may reveal two black cards in your hand. If you do, target creature gets -X/-X until end of turn.', 'Artifact Creature — Construct')).toBe(false);
    expect(isFull('When this creature enters, you may reveal X black cards in your graveyard. If you do, target creature gets -X/-X until end of turn.', 'Artifact Creature — Construct')).toBe(false);
  });
});
