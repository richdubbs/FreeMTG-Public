/**
 * Round edh-d-111 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups library 3/3 and counters 3/3): the template data of parser/templates/zz-cloud/edh-d-111.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-d-111-scenarios.test.ts.
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
import edhD111 from '../../../src/parser/templates/zz-cloud/edh-d-111.json';
import review from '../../m5/golden/cards/edh-d-111-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD111 as Template[];
const MECH_COUNT = 5;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full (the round's golden card for it)
  'eff.edhd111.putThat.hand.rest.bottomChosen': ['Explosive Revelation'],
  'eff.edhd111.dig.mayReveal.colorOrType.hand': ["Tezzeret's Gatebreaker"],
  'eff.edhd111.dig.mayPutOne.top': ['Voda Sea Scavenger'],
  'eff.edhd111.reveal.inHand.one': ['Assembly Hall'],
  'rep.edhd111.enters.putCounterOnChosenYouControl': ['Phylactery Lich'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-111 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-111.json, path order: after edh-d-11, before edh-d-12) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-111.json');
    expect(files.indexOf('zz-cloud/edh-d-111.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-11.json'));
    expect(files.indexOf('zz-cloud/edh-d-111.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-12.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd111.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd111\./);
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

describe('edh-d-111 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bany order\b/, 'a random order'], [/\binto your hand\b/, 'onto the battlefield'], [/\bon top of your library\b/, 'on the bottom of your library'], [/\bin your hand\b/, 'in your graveyard'],
    [/\bred or creature\b/, 'red and creature'], [/\bgreen or land\b/, 'green or lands'], [/\bone of\b/, 'two of'], [/\byou control\b/, 'an opponent controls'], [/\bsoul counter\b/, 'two soul counters'],
    [/\bAs ~ enters\b/, 'When ~ enters'], [/\bnonland card\b/, 'land card'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-111 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-111 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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
          if (/^counters?[.,]?$/.test(words[i + 1] ?? '')) return; // CR 122.1: the kind of a counter is any word (the CounterKind hole reads an unlisted word, weak)
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

describe.skipIf(index === null)('edh-d-111 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-111 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-d-111 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const creature = (text: string, type = 'Creature — Elf') => parseCard(card('Example Beast', type, text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('parser/holes/object.ts (CR 608.2c, 701.20a): "the nonland card" names the card a reveal until of a nonland card stopped at; after a reveal of a creature card it is not that card', () => {
    expect(fullyAutomated(spell('Reveal cards from the top of your library until you reveal a nonland card. Put the nonland card into your hand and the rest on the bottom of your library in any order.'))).toBe(true);
    expect(fullyAutomated(spell('Reveal cards from the top of your library until you reveal a creature card. Put the nonland card into your hand and the rest on the bottom of your library in any order.'))).toBe(false);
  });
  it('render/fold-edhd111.ts#hitHandRestBottomAny (CR 608.2c): "the noncreature card" is the card your own reveal until of a noncreature card stopped at; a reveal by another player has no such name', () => {
    expect(fullyAutomated(spell('Reveal cards from the top of your library until you reveal a noncreature card. Put the noncreature card into your hand and the rest on the bottom of your library in any order.'))).toBe(true);
    expect(fullyAutomated(spell("Target opponent reveals cards from the top of their library until they reveal a noncreature card. Put the noncreature card into your hand and the rest on the bottom of your library in any order."))).toBe(false);
  });
  it('parser/holes/edhd111.ts, render/np.ts (CR 105.2, 205.2a): "a blue or artifact card" is a card of that color or that card type; two colors or a plural type are not this hole\'s', () => {
    const f = creature('When Example Beast enters, look at the top four cards of your library. You may reveal a blue or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"anyOf":[{"colors":["U"]},{"types":["Artifact"]}]');
    expect(f.templatesUsed).toContain('eff.edhd111.dig.mayReveal.colorOrType.hand');
    expect(creature('When Example Beast enters, look at the top four cards of your library. You may reveal a blue or red card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.').templatesUsed).not.toContain('eff.edhd111.dig.mayReveal.colorOrType.hand');
  });
  it('render/fold-edhd111.ts#mayPutOneTopRestBottom (CR 701.20e, 401.4): one of the cards looked at on top, the rest on the bottom; with a description of the card it is not this fold', () => {
    expect(fullyAutomated(creature('When Example Beast enters, look at the top three cards of your library. You may put one of those cards on top of your library. Put the rest on the bottom of your library in any order.'))).toBe(true);
    expect(fullyAutomated(creature('When Example Beast enters, look at the top three cards of your library. You may put one of those cards on top of your library. Put the rest into your graveyard.'))).toBe(false);
  });
  it('render/fold-edhd35.ts#tapAnyNumber (CR 701.26a, 608.2c): the tapped group is "each of those Vampires" afterwards; another subtype is not that group', () => {
    expect(fullyAutomated(spell('You may tap any number of untapped Vampire creatures you control. If you do, put a +1/+1 counter on each of those Vampires.', 'Instant'))).toBe(true);
    expect(fullyAutomated(spell('You may tap any number of untapped Vampire creatures you control. If you do, put a +1/+1 counter on each of those Zombies.', 'Instant'))).toBe(false);
  });
  it('render/fold.ts#revealOneFromHand (CR 701.20a, 402.3): "Reveal a creature card in your hand." and "that card" after it; "in your graveyard" is not read', () => {
    expect(fullyAutomated(creature('{3}, {T}: Reveal a creature card in your hand. Search your library for a card with the same name as that card, reveal it, put it into your hand, then shuffle.', 'Artifact Creature — Golem'))).toBe(true);
    expect(fullyAutomated(creature('{3}, {T}: Reveal a creature card in your graveyard. Search your library for a card with the same name as that card, reveal it, put it into your hand, then shuffle.', 'Artifact Creature — Golem'))).toBe(false);
  });
  it('parser/holes/cost.ts, render/costs.ts, actions/activate.ts#leastX (CR 107.1c, 107.3a): "Remove one or more <kind> counters from ~" is X at least one (`oneOrMore`); "two or more" is not read', () => {
    const f = creature('{1}, Remove one or more +1/+1 counters from Example Beast: It deals that much damage to target creature.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"oneOrMore":true');
    expect(fullyAutomated(creature('{1}, Remove two or more +1/+1 counters from Example Beast: It deals that much damage to target creature.'))).toBe(false);
  });
  it('render/steps-cards.ts (CR 106.4, 605.3b): the X of a "one or more" counter cost is "add that much {C}" in a mana ability; "add that much {C}" after a fixed cost is not read', () => {
    expect(fullyAutomated(creature('{T}, Remove one or more charge counters from Example Beast: Add that much {C}.'))).toBe(true);
    expect(fullyAutomated(creature('{T}, Remove a charge counter from Example Beast: Add that much {C}.'))).toBe(false);
  });
  it('parser/holes/cond.ts, render/cond.ts (CR 601.2i, 603.4): "if it was the second spell you cast this turn" is wasCast with `nth` 2; "if it was the second spell an opponent cast this turn" is not read', () => {
    const f = creature('When Example Beast enters, if it was the second spell you cast this turn, draw a card.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"interveningIf":{"cond":"wasCast","by":"you","nth":2}');
    expect(fullyAutomated(creature('When Example Beast enters, if it was the second spell an opponent cast this turn, draw a card.'))).toBe(false);
  });
  it('parser/lower/activation.ts, render/abil.ts (CR 107.3c, 122.1): "X is the number of <kind> counters on ~." defines the X of the cost (`xIs` counters); counters on another object are not read', () => {
    const f = creature('{X}, {T}: Example Beast deals damage equal to the number of age counters on it to any target. X is the number of age counters on Example Beast.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"xIs":{"q":"counters","kind":"age","on":{"ref":"self"}}');
    expect(fullyAutomated(creature('{X}, {T}: Example Beast deals damage equal to the number of age counters on it to any target. X is the number of age counters on target creature.'))).toBe(false);
  });
});
