import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const stateHealthFinanceCases = [
  ['ca-real-id', 'California REAL ID official', ['dmv.ca.gov/portal/driver-licenses-identification-cards/real-id']],
  ['ca-registration-renewal', 'California vehicle registration renewal official', ['dmv.ca.gov/portal/vehicle-registration/vehicle-registration-renewal']],
  ['ca-title-replacement', 'California replacement title official', ['dmv.ca.gov/portal/dmv-virtual-office/replacement-title']],
  ['ny-real-id', 'New York REAL ID official', ['dmv.ny.gov/driver-license/federal-real-id']],
  ['ny-address-change', 'New York DMV change address official', ['dmv.ny.gov/address-change']],
  ['ny-title', 'New York vehicle title official', ['dmv.ny.gov/titles']],
  ['tx-real-id', 'Texas REAL ID official', ['dps.texas.gov/section/driver-license/federal-real-id-act']],
  ['tx-registration', 'Texas vehicle registration renewal official', ['txdmv.gov/motorists/register-your-vehicle']],
  ['tx-title', 'Texas title transfer official', ['txdmv.gov/motorists/buying-or-selling-a-vehicle/title-transfer']],
  ['fl-driver-renewal', 'Florida driver license renewal official', ['flhsmv.gov/driver-licenses-id-cards/renew-or-replace-your-florida-driver-license-or-id-card']],
  ['fl-real-id', 'Florida REAL ID official', ['flhsmv.gov/driver-licenses-id-cards/what-to-bring']],
  ['fl-registration', 'Florida vehicle registration renewal official', ['mydmvportal.flhsmv.gov']],
  ['ssa-card-name', 'Social Security card name change official', ['ssa.gov/number-card/replace-card']],
  ['ssa-office-locator', 'Social Security office locator official', ['secure.ssa.gov/ICON/main.jsp']],
  ['ssa-benefits-calculator', 'Social Security benefits calculator official', ['ssa.gov/benefits/calculators']],
  ['medicare-part-d', 'Medicare Part D official', ['medicare.gov/drug-coverage-part-d']],
  ['medicare-appeals', 'Medicare appeals official', ['medicare.gov/basics/your-medicare-rights/appeals']],
  ['medicare-supplier', 'Medicare supplier directory official', ['medicare.gov/medical-equipment-suppliers']],
  ['cfpb-mortgage-complaint', 'CFPB mortgage complaint official', ['consumerfinance.gov/complaint']],
  ['cfpb-mortgage-rates', 'CFPB mortgage rates official', ['consumerfinance.gov/owning-a-home/explore-rates']],
  ['cfpb-debt-collection', 'CFPB debt collection official', ['consumerfinance.gov/consumer-tools/debt-collection']],
  ['ftc-do-not-call', 'FTC do not call official', ['donotcall.gov']],
  ['ftc-reportfraud', 'FTC report fraud official', ['reportfraud.ftc.gov']],
  ['ftc-identity-recovery', 'FTC identity theft recovery official', ['identitytheft.gov']],
  ['consumer-report-bank', 'CFPB consumer complaint database official', ['consumerfinance.gov/data-research/consumer-complaints']],
  ['fdic-bankfind', 'FDIC bank find official', ['banks.data.fdic.gov/bankfind-suite/bankfind']],
  ['ncua-research-credit-union', 'NCUA research credit union official', ['mapping.ncua.gov']],
  ['sec-broker', 'SEC check investment professional official', ['investor.gov/introduction-investing/getting-started/working-investment-professional']],
  ['finra-fund-analyzer', 'FINRA fund analyzer official', ['tools.finra.org/fund_analyzer']],
  ['investor-alerts', 'SEC investor alerts official', ['investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins']],
  ['medlineplus', 'MedlinePlus official', ['medlineplus.gov']],
  ['medline-drug', 'MedlinePlus drug information official', ['medlineplus.gov/druginformation.html']],
  ['nih-dietary-supplements', 'NIH dietary supplements official', ['ods.od.nih.gov']],
  ['nih-clinical-trials', 'NIH clinical trials official', ['clinicaltrials.gov']],
  ['nih-genetics', 'MedlinePlus genetics official', ['medlineplus.gov/genetics']],
  ['cdc-travelers', 'CDC Travelers Health official', ['wwwnc.cdc.gov/travel']],
  ['cdc-yellow-book', 'CDC Yellow Book official', ['cdc.gov/yellow-book']],
  ['cdc-vaccine-info', 'CDC vaccine information statements official', ['cdc.gov/vaccines/hcp/current-vis']],
  ['fda-device-recalls', 'FDA medical device recalls official', ['fda.gov/medical-devices/medical-device-recalls']],
  ['fda-mammography', 'FDA mammography facility search official', ['accessdata.fda.gov/scripts/cdrh/cfdocs/cfMQSA/mqsa.cfm']],
  ['usda-foodkeeper', 'USDA FoodKeeper official', ['foodsafety.gov/keep-food-safe/foodkeeper-app']],
  ['usda-ask', 'Ask USDA food safety official', ['ask.usda.gov']],
  ['usda-hardiness', 'USDA plant hardiness zone map official', ['planthardiness.ars.usda.gov']],
  ['usda-nutrition', 'Dietary Guidelines official', ['dietaryguidelines.gov']],
  ['energystar-products', 'ENERGY STAR product finder official', ['energystar.gov/productfinder']],
  ['energy-saver', 'Energy Saver official', ['energy.gov/energysaver']],
  ['epa-water-where', 'EPA drinking water local official', ['epa.gov/ground-water-and-drinking-water']],
  ['epa-airnow', 'AirNow official', ['airnow.gov']],
  ['epa-superfund', 'EPA Superfund site search official', ['epa.gov/superfund/search-superfund-sites-where-you-live']],
  ['fema-app', 'FEMA app official', ['fema.gov/about/news-multimedia/mobile-products']],
  ['fema-map', 'FEMA flood map service center official', ['msc.fema.gov/portal/home']],
  ['ready-kit', 'Ready.gov emergency kit official', ['ready.gov/kit']],
  ['nws-radar', 'National Weather Service radar official', ['radar.weather.gov']],
  ['nws-hurricane', 'NOAA hurricane center official', ['nhc.noaa.gov']],
  ['usgs-volcano', 'USGS volcanoes official', ['usgs.gov/programs/VHP']],
  ['usgs-waterwatch', 'USGS WaterWatch official', ['waterwatch.usgs.gov']],
  ['nps-fees', 'National Park Service entrance fees official', ['nps.gov/aboutus/entrance-fee-prices.htm']],
  ['nps-pass', 'America the Beautiful pass official', ['nps.gov/planyourvisit/passes.htm']],
  ['recreation-lottery', 'Recreation.gov lotteries official', ['recreation.gov/permits']],
  ['irs-tax-calendar', 'IRS tax calendar official', ['irs.gov/businesses/small-businesses-self-employed/online-tax-calendar']],
  ['irs-sales-tax', 'IRS sales tax deduction official', ['irs.gov/credits-deductions/individuals/sales-tax-deduction-calculator']],
  ['treasury-unclaimed', 'Treasury Hunt official', ['treasurydirect.gov/TH/search-treasury-hunt']],
  ['usps-prices', 'USPS price calculator official', ['postcalc.usps.com']],
  ['usps-locator', 'USPS location finder official', ['tools.usps.com/locations']],
  ['tsa-claims', 'TSA claims official', ['tsa.gov/travel/passenger-support/claims']],
  ['faa-pack-safe', 'FAA PackSafe official', ['faa.gov/hazmat/packsafe']],
  ['dot-car-complaint', 'NHTSA vehicle safety complaint official', ['nhtsa.gov/report-a-safety-problem']],
  ['safercar', 'NHTSA safercar app official', ['nhtsa.gov/campaign/safercar-app']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday state, health, and finance web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of stateHealthFinanceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these state, health, and finance probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of stateHealthFinanceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
