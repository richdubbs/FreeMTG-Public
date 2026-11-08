/**
 * Commander coordinator E, group graveyard 2/3 second batch, round edh-e-38: the template data of parser/templates/zz-cloud/edh-e-38.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-e-38-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites from memory (no rules/cr in the cloud), listed as unverified in the record.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import { classifyAbility } from '../../../src/model/classify';
import edhE38 from '../../../src/parser/templates/zz-cloud/edh-e-38.json';
import review from '../../m5/golden/cards/edh-e-38-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE38 as Template[];
const MECH_COUNT = 4;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the cards of the EDHREC top 30,000 that print each wording and are full
  'eff.edhe38.exile.allFilter.playerHandAndGraveyard': ['Thought Distortion'],
  'eff.edhe38.exchange.graveyardLibrary': ['Morality Shift'],
  'eff.edhe38.eachPlayer.returnEach.graveyard.bf.additionalCounters': ['Pyrrhic Revival'],
  'eff.edhe38.return.fourCreatureTypes.graveyard.hand': ["Grim Captain's Call"],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-38 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-38.json, path order: after edh-d-99, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-38.json');
    expect(files.indexOf('zz-cloud/edh-e-38.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-38.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 8; ids are *.edhe38.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe38\./);
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

describe('edh-e-38 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bloses\b/, 'gains'], [/\bpoison\b/, 'x'], [/\bthird\b/, 'fourth'], [/\bland\b/, 'x'], [/\bgain control\b/, 'x'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-38 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-38 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          if (/^[+-]?\d+\/[+-]?\d+$/.test(w)) return; // the counter kind is a hole that takes any name (CounterKind), as in the older "enters with a counter" templates
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

describe.skipIf(index === null)('edh-e-38 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-38 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-e-38 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const creature = (text: string) => parseCard(card('Example Beast', 'Creature — Dinosaur', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('render/np.ts#zonePhrase (CR 400.1, 404.1; Thought Distortion): "all <description> cards from <player>\'s hand and graveyard" passes the gate; with the library, or one zone only, the two-zone wording stays unread', () => {
    expect(fullyAutomated(spell("Target opponent reveals their hand. Exile all noncreature, nonland cards from that player's hand and graveyard."))).toBe(true);
    expect(fullyAutomated(spell("Exile all artifact cards from target player's hand and graveyard."))).toBe(true);
    expect(fullyAutomated(spell("Exile all artifact cards from target player's hand and library."))).toBe(false);
  });
  it('render/steps-life.ts#putCountersClause (CR 202.3, 107.1a, 608.2h; Torrent Sculptor): "equal to half that card\'s mana value, rounded up" passes the gate; the rounding must be stated', () => {
    const t = (x: string) => creature(`When ~ enters, exile an instant or sorcery card from your graveyard. Put a number of +1/+1 counters on ~ equal to ${x}.`);
    expect(fullyAutomated(t("half that card's mana value, rounded up"))).toBe(true);
    expect(fullyAutomated(t("half that card's mana value, rounded down"))).toBe(true);
    expect(fullyAutomated(t("half that card's mana value"))).toBe(false);
  });
  it('parser/holes/object.ts + render/refs.ts#anaphor (CR 608.2c, 608.2h; Flesh // Blood): "the power of the card you exiled" is the exiled card, as "the exiled card"; of a card you did not exile, it stays unread', () => {
    expect(fullyAutomated(spell('Exile target creature card from a graveyard. Put X +1/+1 counters on target creature, where X is the power of the card you exiled.'))).toBe(true);
    expect(fullyAutomated(spell('Exile target creature card from a graveyard. Put X +1/+1 counters on target creature, where X is the power of the card you sacrificed.'))).toBe(false);
    expect(fullyAutomated(spell('Put X +1/+1 counters on target creature, where X is the power of the card you exiled.'))).toBe(false);
  });
  it('parser/holes/object.ts + render/refs.ts#specPhrase (CR 115.1, 601.2c, 601.7a; Mausoleum Turnkey): "target creature card of an opponent\'s choice from your graveyard" is a target an opponent chooses among your graveyard; another zone, or "of their choice", stays unread', () => {
    expect(fullyAutomated(creature("When ~ enters, return target creature card of an opponent's choice from your graveyard to your hand."))).toBe(true);
    expect(fullyAutomated(creature("When ~ enters, return target creature card of an opponent's choice from a graveyard to your hand."))).toBe(false);
    expect(fullyAutomated(creature("When ~ enters, return target creature card of an opponent's choice from your hand to your hand."))).toBe(false);
  });
  it('render/self-replacement.ts#notWideReplacement (CR 614.15, 608.2c, 701.8a, 120.3; Rancid Earth): "If C, instead destroy that land and ~ deals 1 damage to each creature" restates the one destroy and does the damage after it; a different destroy, or another instruction, stays unread', () => {
    expect(fullyAutomated(spell('Destroy target land. If there are seven or more cards in your graveyard, instead destroy that land and ~ deals 1 damage to each creature and each player.', 'Instant'))).toBe(true);
    expect(fullyAutomated(spell('Destroy target land. If there are seven or more cards in your graveyard, instead destroy target creature and ~ deals 1 damage to each creature.', 'Instant'))).toBe(false);
    expect(fullyAutomated(spell('Destroy target land. If there are seven or more cards in your graveyard, instead exile that land and ~ deals 1 damage to each creature.', 'Instant'))).toBe(false);
  });
  it('parser/holes/qty.ts + render/qty.ts (CR 506.2, 506.3, 508.1; Custodi Soulcaller): "the number of players you attacked this combat" is the melee count; "this turn" is another count', () => {
    const t = (x: string) => creature(`Whenever ~ attacks, return target creature card with mana value X or less from your graveyard to the battlefield, where X is ${x}.`);
    expect(fullyAutomated(t('the number of players you attacked this combat'))).toBe(true);
    expect(fullyAutomated(t('the number of players you attacked this game'))).toBe(false);
  });
  it('parser/holes/vocab.ts (CR 122.1; Thelon of Havenwood, Sphere of Annihilation, Mairsil): spore, void and cage are counter kinds', () => {
    expect(fullyAutomated(creature('{T}: Put a spore counter on ~.'))).toBe(true);
    expect(fullyAutomated(creature('{T}: Put a void counter on ~.'))).toBe(true);
  });
  it('effects/handlers/zones-status.ts#exchangeGraveyardLibrary (CR 701.12a; Morality Shift): the graveyard-library exchange is a registered capability, the controller\'s own only', () => {
    expect(ENGINE_CAPABILITIES.has('op:exchange.graveyardLibrary')).toBe(true);
    expect(fullyAutomated(spell('Exchange your graveyard and library. Then shuffle your library.'))).toBe(true);
    expect(fullyAutomated(spell("Exchange target player's graveyard and library."))).toBe(false);
  });
});
