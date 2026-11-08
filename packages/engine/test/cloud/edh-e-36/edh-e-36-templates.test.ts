/**
 * Must-finish round edh-e-36 (EDHREC band 5,001-10,000, graveyard-exile-cast): the template data of parser/templates/zz-cloud/edh-e-36.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-e-36-scenarios.test.ts.
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
import edhE36 from '../../../src/parser/templates/zz-cloud/edh-e-36.json';
import review from '../../m5/golden/cards/edh-e-36-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE36 as Template[];
const MECH_COUNT = 7;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full (each wording is printed on one or two cards)
  'eff.edhe36.permit.play.duringTurnAttackedWithSelf': ['Goblin Researcher'],
  'eff.edhe36.permit.play.duringTurnAttackedWithN': ['Boros Strike-Captain'],
  'eff.edhe36.permit.cast.duringTurnAttackedWith.anyColor': ['Robber of the Rich'],
  'eff.edhe36.choose.cardExiledWithSelf': ['Muse Vessel'],
  'sta.edhe36.selfHas.asLongAsExiledCardHas.sameFor': ['Urborg Scavengers'],
  'sta.edhe36.asLongAsExiledCardHas.selfHas.sameFor': ['Death-Mask Duplicant'],
  'sta.edhe36.self.has.allActivatedOf.creatureCardsExiledWith': ['Dark Impostor', 'Patchwork Crawler'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-36 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-36.json, path order: after edh-d-99, before edh-next-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-36.json');
    expect(files.indexOf('zz-cloud/edh-e-36.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-36.json')).toBeLessThan(files.indexOf('zz-cloud/edh-next-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe36.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe36\./);
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

describe('edh-e-36 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bflying\b/g, 'reach'], [/\bactivated\b/g, 'triggered'], [/\bcreature cards\b/g, 'land cards'], [/\bplay\b/g, 'cast'], [/\bor more\b/g, 'or fewer'], [/\bany turn\b/g, 'any combat'],
    [/\bany color\b/g, 'any type'], [/\bexiled with\b/g, 'exiled by'], [/\bthe same is true for\b/g, 'the opposite is true for'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-36 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-36 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-e-36 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-36 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-e-36 parser, renderer and engine changes (one test each)', () => {
  const creature = (text: string) => parseCard(card('Example Beast', 'Creature — Elf', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('parser/parse.ts#readsOnlyAsGroup (CR 607.2a): a permission for "cards exiled with ~" links to SEVERAL abilities that exile; "the exiled card" beside two exiling abilities still stays unlinked', () => {
    const two = '{2}: Exile the top card of your library.\n{3}, {T}: Exile target card from a graveyard.\nYou may cast spells from among cards exiled with this creature.';
    const f = creature(two);
    expect(fullyAutomated(f)).toBe(true);
    expect(f.templatesUsed).toContain('eff.r5refs.linked.cast');
    expect(fullyAutomated(creature('{2}: Exile the top card of your library.\n{3}, {T}: Exile target card from a graveyard.\n{1}: Return the exiled card to its owner\'s hand.'))).toBe(false);
  });
  it('parser/holes/object.ts (CR 401.2, 608.2c): "the top card of their library" names the player an earlier part of the sentence named; with no such player it stays manual', () => {
    expect(fullyAutomated(creature('Whenever this creature deals combat damage to a player, exile the top card of their library.'))).toBe(true);
    expect(fullyAutomated(creature('Whenever this creature attacks, if defending player has more cards in hand than you, exile the top card of their library.'))).toBe(true);
    expect(fullyAutomated(creature('When this creature enters, exile the top card of their library.'))).toBe(false);
  });
  it('render/stat.ts#duringTurnCounter (CR 508.1a): "during any turn you attacked with this creature" and "with three or more creatures"; two or more of a subtype is "N or more <plural>"', () => {
    const f = creature('When this creature enters, exile the top card of your library. During any turn you attacked with this creature, you may play that card.');
    expect(fullyAutomated(f)).toBe(true);
    const g = creature('Whenever this creature attacks, exile the top card of your library. During any turn you attacked with three or more Goblins, you may play that card.');
    expect(fullyAutomated(g)).toBe(true);
    expect(fullyAutomated(creature('Whenever this creature attacks, exile the top card of your library. During any turn an opponent attacked with three or more Goblins, you may play that card.'))).toBe(false);
  });
  it('render/steps-flow.ts (CR 607.2a, 608.2c): "Choose a card exiled with ~" is one card of the cards the linked ability exiled; "two cards" is not read', () => {
    const f = creature('{3}, {T}: Target player exiles a card from their hand.\n{1}: Choose a card exiled with this creature. You may play that card this turn.');
    expect(fullyAutomated(f)).toBe(true);
    expect(fullyAutomated(creature('{3}, {T}: Target player exiles a card from their hand.\n{1}: Choose two cards exiled with this creature. You may play those cards this turn.'))).toBe(false);
  });
  it('render/mods.ts#keywordsOfSentence (CR 613.1f, 607.2a): the object itself shares the keywords of the cards exiled with it, in either Oracle word order; a keyword outside the list is not read', () => {
    const exile = '{2}: Exile target creature card from a graveyard.\n';
    expect(fullyAutomated(creature(`${exile}This creature has flying as long as a card exiled with it has flying. The same is true for reach and trample.`))).toBe(true);
    expect(fullyAutomated(creature(`${exile}As long as a card exiled with this creature has flying, this creature has flying. The same is true for reach and trample.`))).toBe(true);
    expect(fullyAutomated(creature(`${exile}As long as a card exiled with this creature has flying, this creature has flying. The same is true for reach and spell mastery.`))).toBe(false);
  });
  it('eff.r5refs.linked.cast is stable now: Rona, Disciple of Gix is the evidence in cloud-r5-refs-review.json', () => {
    const t = TEMPLATE_SET.find((x) => x.id === 'eff.r5refs.linked.cast');
    expect(t?.status).toBe('stable');
  });
});
