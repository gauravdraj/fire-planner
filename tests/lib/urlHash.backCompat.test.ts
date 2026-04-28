import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import { decodeScenario, encodeScenario, type ScenarioHashInput, type ScenarioHashPayload } from '@/lib/urlHash';

import productionUrlHashFixtures from '../fixtures/urlHash.production.json';

type ProductionUrlHashFixture = Readonly<{
  name: string;
  description: string;
  capture: Readonly<{
    kind: string;
    capturedAt: string;
    source: string;
  }>;
  payloadKeys: readonly string[];
  hash: string;
}>;

type RawHashPayload = ScenarioHashInput &
  Readonly<{
    customLawActive: boolean;
    [key: string]: unknown;
  }>;

const LOCAL_ONLY_KEYS = [
  'layout',
  'view',
  'mode',
  'advancedDisclosed',
  'namedScenarioId',
  'activeScenarioIndex',
] as const;

const fixtures = productionUrlHashFixtures.fixtures as readonly ProductionUrlHashFixture[];

function fixtureByName(name: string): ProductionUrlHashFixture {
  const fixture = fixtures.find((entry) => entry.name === name);

  if (fixture === undefined) {
    throw new Error(`Missing URL hash fixture: ${name}`);
  }

  return fixture;
}

function rawPayloadFromHash(hash: string): RawHashPayload {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const json = decompressFromEncodedURIComponent(normalizedHash.slice('v1:'.length));

  if (typeof json !== 'string') {
    throw new Error(`Could not decompress URL hash fixture: ${hash}`);
  }

  return JSON.parse(json) as RawHashPayload;
}

function hashFromRawPayload(payload: RawHashPayload): string {
  return `v1:${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

function decodedPayloadFromHash(hash: string): ScenarioHashPayload {
  const decoded = decodeScenario(hash);

  if (decoded === null) {
    throw new Error(`Could not decode URL hash fixture: ${hash}`);
  }

  return decoded;
}

describe('production v1 URL hash back compatibility', () => {
  it('keeps captured fixture metadata tied to the production v1 payload contract', () => {
    expect(productionUrlHashFixtures.fixtureSet).toBe('urlHash.production.v1');
    expect(productionUrlHashFixtures.note).toContain('never encoded mode/view/layout navigation state');
    expect(fixtures).toHaveLength(3);

    for (const fixture of fixtures) {
      const rawPayload = rawPayloadFromHash(fixture.hash);

      expect(fixture.capture.kind).toBe('canonical');
      expect(fixture.hash).toMatch(/^v1:/);
      expect(Object.keys(rawPayload).sort()).toEqual([...fixture.payloadKeys].sort());
      for (const key of LOCAL_ONLY_KEYS) {
        expect(rawPayload).not.toHaveProperty(key);
      }
    }
  });

  it('round-trips basic scenario data from production v1 hashes', () => {
    const fixture = fixtureByName('basic-scenario-plan');
    const rawPayload = rawPayloadFromHash(fixture.hash);
    const decoded = decodedPayloadFromHash(fixture.hash);

    expect(decoded.scenario).toEqual(rawPayload.scenario);
    expect(decoded.scenario.startYear).toBe(2026);
    expect(decoded.scenario.balances.taxableBrokerage).toBe(650_000);
    expect(decodeScenario(encodeScenario(decoded))).toEqual(decoded);
  });

  it('round-trips sparse customLaw data and customLawActive state from production v1 hashes', () => {
    const fixture = fixtureByName('custom-law-active');
    const rawPayload = rawPayloadFromHash(fixture.hash);
    const decoded = decodedPayloadFromHash(fixture.hash);

    expect(decoded.customLaw).toEqual(rawPayload.customLaw);
    expect(decoded.customLawActive).toBe(true);
    expect(decoded.scenario.customLaw).toEqual(rawPayload.customLaw);
    expect(decodeScenario(encodeScenario(decoded))).toEqual(decoded);
  });

  it('round-trips plan data from production v1 hashes', () => {
    const fixture = fixtureByName('manual-plan-data');
    const rawPayload = rawPayloadFromHash(fixture.hash);
    const decoded = decodedPayloadFromHash(fixture.hash);

    expect(decoded.plan).toEqual(rawPayload.plan);
    expect(decoded.plan.rothConversions).toEqual([{ year: 2028, amount: 35_000 }]);
    expect(decoded.plan.brokerageHarvests).toEqual([{ year: 2029, amount: 18_000 }]);
    expect(decodeScenario(encodeScenario(decoded))).toEqual(decoded);
  });

  it('keeps new hashes free of local-only navigation and named-scenario state', () => {
    const rawPayload = rawPayloadFromHash(fixtureByName('basic-scenario-plan').hash);
    const payloadWithLocalState = {
      ...rawPayload,
      layout: 'verdict',
      view: 'compare',
      mode: 'advanced',
      advancedDisclosed: true,
      namedScenarioId: 'local-only-id',
      activeScenarioIndex: 1,
    };

    const encoded = encodeScenario(payloadWithLocalState);
    const encodedRawPayload = rawPayloadFromHash(encoded);

    expect(Object.keys(encodedRawPayload).sort()).toEqual(['customLawActive', 'plan', 'scenario']);
    for (const key of LOCAL_ONLY_KEYS) {
      expect(encodedRawPayload).not.toHaveProperty(key);
    }
  });

  it('ignores unknown extra payload keys without changing decoded scenario or plan data', () => {
    const fixture = fixtureByName('basic-scenario-plan');
    const rawPayload = rawPayloadFromHash(fixture.hash);
    const originalDecoded = decodedPayloadFromHash(fixture.hash);

    // Production v1 hashes never encoded mode, so the nav collapse has no mode-to-view translation to perform.
    const hashWithUnknownUiState = hashFromRawPayload({
      ...rawPayload,
      mode: 'advanced',
      view: 'compare',
      layout: 'verdict',
      advancedDisclosed: true,
      namedScenarioId: 'local-only-id',
    });

    expect(decodedPayloadFromHash(hashWithUnknownUiState)).toEqual(originalDecoded);
  });
});
