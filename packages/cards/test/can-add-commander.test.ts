/**
 * deck-art-1 part 1: the deckbuilder offers "Commander" only for a card the deck check accepts there. `canAddCommander` is the deck check
 * (`checkCommanders`, CR 903.3, 903.3a, 903.12c, 702.124) applied to the commander set the deck would then have.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '@openmtg/engine';
import { canAddCommander } from '../src/formats/commander';

const c = (name: string, type_line: string, oracle_text = '', extra: Partial<OracleCard> = {}): OracleCard =>
  ({ name, layout: 'normal', type_line, oracle_text, color_identity: [], ...extra }) as OracleCard;

const bears = c('Grizzly Bears', 'Creature — Bear', '', { power: '2', toughness: '2' });
const ring = c('Sol Ring', 'Legendary Artifact');
const krenko = c('Krenko, Mob Boss', 'Legendary Creature — Goblin Warrior', '{T}: Create X 1/1 red Goblin creature tokens.', { power: '3', toughness: '3' });
const vehicle = c('Parhelion II', 'Legendary Artifact — Vehicle', 'Crew 4', { power: '5', toughness: '5' });
const shipPT = c('Test Spacecraft', 'Legendary Artifact — Spacecraft', 'Station', { power: '4', toughness: '4' });
const shipNoPT = c('Test Station', 'Legendary Artifact — Spacecraft', 'Station');
const freya = c('Freya, the Fury', 'Legendary Planeswalker — Freya', '+1: Draw a card.\nFreya, the Fury can be your commander.');
const pw = c('Plain Walker', 'Legendary Planeswalker — Plain');
const background = c('Cloakwood Hermit', 'Legendary Enchantment — Background', 'Commander creatures you own have "Whenever ..."');
const chooser = c('Wilson, Refined Grizzly', 'Legendary Creature — Bear Warrior', 'Choose a Background', { power: '4', toughness: '4' });
const partnerA = c('Partner A', 'Legendary Creature — Human', 'Partner', { power: '1', toughness: '1' });
const partnerB = c('Partner B', 'Legendary Creature — Elf', 'Partner', { power: '1', toughness: '1' });

describe('deck-art-1: canAddCommander', () => {
  it('CR 903.3: a legendary creature, Vehicle or Spacecraft with a P/T box; not a non-legendary creature or a legendary non-creature', () => {
    expect(canAddCommander([], bears, 'commander')).toBe(false);
    expect(canAddCommander([], ring, 'commander')).toBe(false);
    expect(canAddCommander([], krenko, 'commander')).toBe(true);
    expect(canAddCommander([], vehicle, 'commander')).toBe(true);
    expect(canAddCommander([], shipPT, 'commander')).toBe(true);
    expect(canAddCommander([], shipNoPT, 'commander')).toBe(false);
  });

  it('CR 903.3a: "can be your commander"; Brawl (903.12c) adds legendary planeswalkers', () => {
    expect(canAddCommander([], freya, 'commander')).toBe(true);
    expect(canAddCommander([], pw, 'commander')).toBe(false);
    expect(canAddCommander([], pw, 'brawl')).toBe(true);
  });

  it('CR 702.124k: a Background only beside a "Choose a Background" commander', () => {
    expect(canAddCommander([], background, 'commander')).toBe(false);
    expect(canAddCommander([krenko], background, 'commander')).toBe(false);
    expect(canAddCommander([chooser], background, 'commander')).toBe(true);
    expect(canAddCommander([background], chooser, 'commander')).toBe(true);
  });

  it('CR 702.124h, 702.124f: two partners pair; a non-partner pair does not; never a third or the same card again', () => {
    expect(canAddCommander([partnerA], partnerB, 'commander')).toBe(true);
    expect(canAddCommander([partnerA], krenko, 'commander')).toBe(false);
    expect(canAddCommander([krenko], partnerA, 'commander')).toBe(false);
    expect(canAddCommander([partnerA, partnerB], krenko, 'commander')).toBe(false);
    expect(canAddCommander([partnerA], partnerA, 'commander')).toBe(false);
  });
});
