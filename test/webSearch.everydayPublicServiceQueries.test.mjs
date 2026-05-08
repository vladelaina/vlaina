import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const everydayPublicServiceCases = [
  ['osha-complaint', 'OSHA file safety complaint official', ['osha.gov/workers/file-complaint']],
  ['wage-complaint', 'File wage complaint official', ['dol.gov/agencies/whd/contact/complaints']],
  ['fmla-eligibility', 'FMLA eligibility official', ['dol.gov/agencies/whd/fmla']],
  ['eeoc-charge', 'EEOC file discrimination charge official', ['eeoc.gov/filing-charge-discrimination']],
  ['ada', 'ADA service animal official', ['ada.gov/topics/service-animals']],
  ['housing-complaint', 'HUD housing discrimination complaint official', ['hud.gov/program_offices/fair_housing_equal_opp/online-complaint']],
  ['tenant-rights', 'Tenant rights official USA.gov', ['usa.gov/tenant-rights']],
  ['small-claims', 'Small claims court official USA.gov', ['usa.gov/small-claims-court']],
  ['legal-aid', 'Find legal aid official', ['usa.gov/legal-aid']],
  ['disaster-assistance', 'FEMA disaster assistance official', ['disasterassistance.gov']],
  ['flood-map', 'FEMA flood map official', ['msc.fema.gov/portal/home']],
  ['hurricane', 'National Hurricane Center official', ['nhc.noaa.gov']],
  ['wildfire-map', 'National wildfire map official', ['fire.airnow.gov']],
  ['aqi', 'Air quality index official', ['airnow.gov/aqi']],
  ['radon', 'EPA radon map official', ['epa.gov/radon']],
  ['lead-paint', 'EPA lead paint official', ['epa.gov/lead']],
  ['drinking-water', 'EPA drinking water standards official', ['epa.gov/ground-water-and-drinking-water']],
  ['medication-label', 'FDA nutrition facts label official', ['fda.gov/food/nutrition-facts-label']],
  ['myplate', 'USDA MyPlate official', ['myplate.gov']],
  ['pet-travel', 'USDA pet travel official', ['aphis.usda.gov/pet-travel']],
  ['tax-transcript', 'IRS get tax transcript official', ['irs.gov/individuals/get-transcript']],
  ['withholding', 'IRS tax withholding estimator official', ['irs.gov/individuals/tax-withholding-estimator']],
  ['tax-extension', 'IRS file tax extension official', ['irs.gov/forms-pubs/extension-of-time-to-file-your-tax-return']],
  ['unclaimed', 'Unclaimed money official', ['usa.gov/unclaimed-money']],
  ['savings-bonds', 'Savings bonds official', ['treasurydirect.gov/savings-bonds']],
  ['charity', 'IRS tax exempt organization search official', ['irs.gov/charities-non-profits/tax-exempt-organization-search']],
  ['investor', 'SEC investor.gov official', ['investor.gov']],
  ['bankfind', 'FDIC BankFind official', ['banks.data.fdic.gov/bankfind-suite/bankfind']],
  ['patent-search', 'USPTO patent search official', ['uspto.gov/patents/search']],
  ['trademark-search', 'USPTO trademark search official', ['uspto.gov/trademarks/search']],
  ['currency', 'US currency education official', ['uscurrency.gov']],
  ['mint', 'US Mint coin catalog official', ['catalog.usmint.gov']],
  ['passport-photo', 'Passport photo requirements official', ['travel.state.gov/content/travel/en/passports/how-apply/photos.html']],
  ['embassy-tokyo', 'US Embassy Tokyo official', ['jp.usembassy.gov']],
  ['park-finder', 'National Park Service find a park official', ['nps.gov/findapark']],
  ['camping', 'Recreation.gov camping official', ['recreation.gov']],
  ['zip', 'USPS zip code lookup official', ['tools.usps.com/zip-code-lookup.htm']],
  ['postage', 'USPS postage rates official', ['pe.usps.com']],
  ['time', 'Time zones US government official', ['time.gov']],
  ['sunrise', 'NOAA sunrise sunset calculator official', ['gml.noaa.gov/grad/solcalc']],
  ['moon', 'NASA moon phase official', ['science.nasa.gov/moon/moon-phases']],
  ['eclipse', 'NASA eclipse official', ['science.nasa.gov/eclipses']],
  ['periodic', 'NIST periodic table official', ['nist.gov/pml/periodic-table-elements']],
  ['si-units', 'NIST SI units official', ['nist.gov/pml/owm/metric-si/si-units']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday public service web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of everydayPublicServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these public-service probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of everydayPublicServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
