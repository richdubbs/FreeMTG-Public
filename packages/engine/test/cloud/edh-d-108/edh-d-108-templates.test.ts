/**
 * Commander coordinator D, round edh-d-108 (EDHREC ranks 10,001-30,000, groups graveyard 3/3, vote-secret, dice-random): the template data of parser/templates/zz-cloud/edh-d-108.json (see the file) and the
 * round's parser, lowering, engine and renderer changes, tested at the end of this file and in edh-d-108-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhD108 from '../../../src/parser/templates/zz-cloud/edh-d-108.json';
import review from '../../m5/golden/cards/edh-d-108-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';
import { compileCard } from '../../../src/index';

const MECH = edhD108 as Template[];
const MECH_COUNT = 8;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing
 * rule 2026-10-27; one-card templates are allowed in this effort).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhd108.discardRandom.unlessHasDamage': ['Skullscorch'],
  'eff.edhd108.exileNOfSeen.atRandom.restTopAnyOrder': ['Orcish Librarian'],
  'sta.edhd108.attached.pump.insteadAslong.controllerGraveyard': ['So Tiny'],
  'eff.edhd108.eachOpponent.chooseNInGraveyard.exileRest': ['Watchers of the Dead'],
  'eff.edhd108.may.putRevealedTopCards.ownersGraveyards': ['Dakra Mystic'],
  'eff.edhd108.player.choosesPermanentPerGraveyardCard.untapsThem': ['Mist of Stagnation'],
  'eff.edhd108.player.revealsNAtRandom.discardsNonlandRevealed': ['Rise // Fall'],
  'eff.edhd108.search.threeReveal.differentNames.randomToHand.shuffleRest': ['Signal the Clans'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a Saga for chapters, a static, activated or triggered ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^I -- /.test(text) ? card('Example Saga', 'Enchantment — Saga', text.replaceAll(' -- ', ' — '))
    : t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-108 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-108.json, path order: after edh-d-102.json, before edh-d-11.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-108.json');
    expect(files.indexOf('zz-cloud/edh-d-108.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-108.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 108; ids are *.edhd108.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhd108\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(108);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = [...review] as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.expect === 'full' && (g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`))).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'then', 'during', 'still']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-d-108 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/\bsix\b/, 'seven'], [/\bfour\b/, 'five'], [/\bopponent\b/, 'player'], [/\byour graveyard\b/, 'your hand'], [/\bmay\b/, 'must'], [/\b3\b/, '4']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-108 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-108 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w) || w === '--' || /\S\n\S/.test(w) || /^(I|II|III)$/.test(w.replace(/^\n/, ''))) return; // (a word with a line break inside joins two lines: no single-word mutation)
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

describe.skipIf(index === null)('edh-d-108 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-108 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Equipment)\b/gi, '~').trim());
          lines.add(l.replaceAll(' — ', ' -- ').trim());
        }
      }
    }
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim, verbatim.join('\n')).toEqual([]);
  }, 120_000);
});

describe('edh-d-108 parser, lowering, renderer and engine changes (one test each, with the negative case)', () => {
  // the card's automation level as the game compiles it (manual cost parts and capabilities the engine lacks count, which `fullyAutomated` of one face does not see)
  const spellFull = (text: string) => compileCard(card('Example Plan', 'Sorcery', text)).automation.level === 'full';
  const relicFull = (text: string) => compileCard(card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })).automation.level === 'full';
  const auraFull = (text: string) => compileCard(card('Example Charm', 'Enchantment — Aura', `Enchant creature\n${text}`)).automation.level === 'full';
  it('render/steps-flow.ts#unlessPlayerHasDamageDiscard (CR 118.12a, 701.9b): the target player\'s random discard "unless that player has ~ deal N damage to them"; a discard they choose is not this reading', () => {
    expect(spellFull('Target player discards three cards at random unless that player has ~ deal 2 damage to them.')).toBe(true);
    expect(spellFull('Target player discards three cards unless that player has ~ deal 2 damage to them.')).toBe(false);
  });
  it('render/fold-p2coinflip1.ts (CR 400.7, 608.2c): the creature card returned at random is also "that card" later; another noun ("that land") is not it', () => {
    expect(relicFull('At the beginning of your upkeep, you may pay {1}. If you do, return a creature card at random from your graveyard to the battlefield. It gains haste. Exile that card at the beginning of your next end step.')).toBe(true);
    expect(relicFull('At the beginning of your upkeep, return a creature card at random from your graveyard to the battlefield. Exile that land at the beginning of the next end step.')).toBe(false);
  });
  it('render/cond.ts (family attached-controller-has-cards-in-graveyard; CR 404.1): "its controller has N or more cards in their graveyard" after "It gets"; their hand is not that condition', () => {
    expect(auraFull('Enchanted creature gets -1/-0. It gets -3/-0 instead as long as its controller has five or more cards in their graveyard.')).toBe(true);
    expect(auraFull('Enchanted creature gets -1/-0. It gets -3/-0 instead as long as its controller has five or more cards in their hand.')).toBe(false);
  });
  it('render/refs.ts (family union-creatures-battlefield-graveyards; CR 400.1, 115.1): a target permanent beside a target card in a graveyard may say "on the battlefield"; beside another permanent it is not read', () => {
    expect(spellFull('Return target creature card from a graveyard and target artifact on the battlefield to their owners\' hands.')).toBe(true);
    expect(spellFull('Return target creature and target artifact on the battlefield to their owners\' hands.')).toBe(false);
  });
  it('parser/holes/cost.ts + render/costs.ts (CR 118.3, 401.4): "Put three cards from your graveyard on the bottom of your library" as a cost; four cards are not read', () => {
    expect(relicFull('Put three cards from your graveyard on the bottom of your library: ~ gets +2/+2 until end of turn.')).toBe(true);
    expect(relicFull('Put four cards from your graveyard on the bottom of your library: ~ gets +2/+2 until end of turn.')).toBe(false);
  });
  it('parser/lower/join-edhd108.ts (CR 701.23a, 608.2d): the three sentences of the random pick among three searched cards are joined only in that order and wording; "up to three" or another second sentence is not this reading', () => {
    expect(spellFull('Search your library for three enchantment cards and reveal them. If you reveal three cards with different names, choose one of them at random and put that card into your hand. Shuffle the rest into your library.')).toBe(true);
    expect(spellFull('Search your library for up to three enchantment cards and reveal them. If you reveal three cards with different names, choose one of them at random and put that card into your hand. Shuffle the rest into your library.')).toBe(false);
    expect(spellFull('Search your library for three enchantment cards and reveal them. If you reveal three cards with different names, an opponent chooses one of them and you put that card into your hand. Shuffle the rest into your library.')).toBe(false);
  });
  it('parser/holes/cond.ts#graveyardUsedThisTurn + quantity graveyardUsesThisTurn (CR 601.2, 602.2, 404.1): the whole phrase only; either half alone stays not automated', () => {
    expect(relicFull('At the beginning of your end step, draw a card if you\'ve cast a spell from a graveyard or activated an ability of a card in a graveyard this turn.')).toBe(true);
    expect(relicFull('At the beginning of your end step, if you\'ve cast a spell from a graveyard or activated an ability of a card in a graveyard this turn, you gain 2 life.')).toBe(true);
    expect(relicFull('At the beginning of your end step, draw a card if you\'ve cast a spell from a graveyard this turn.')).toBe(false);
    expect(relicFull('At the beginning of your end step, draw a card if you\'ve activated an ability of a card in a graveyard this turn.')).toBe(false);
  });
});
