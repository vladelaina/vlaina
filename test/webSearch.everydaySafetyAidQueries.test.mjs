import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const everydaySafetyAidCases = [
  ['airline-complaint', 'File airline complaint official', ['secure.dot.gov/air-travel-complaint']],
  ['flight-rights', 'Flight delayed rights official', ['transportation.gov/airconsumer']],
  ['tsa-id', 'TSA acceptable ID official', ['tsa.gov/travel/security-screening/identification']],
  ['tsa-food', 'TSA bring food official', ['tsa.gov/travel/security-screening/whatcanibring/food']],
  ['car-seat', 'Child car seat safety official', ['nhtsa.gov/equipment/car-seats-and-booster-seats']],
  ['car-seat-inspection', 'Car seat inspection station official', ['nhtsa.gov/equipment/car-seats-and-booster-seats']],
  ['vehicle-recall', 'Vehicle recalls official', ['nhtsa.gov/recalls']],
  ['tire-recall', 'Tire recalls official', ['nhtsa.gov/recalls']],
  ['fuel-economy', 'Fuel economy official', ['fueleconomy.gov']],
  ['energy-rebate', 'Energy Star appliance rebate official', ['energystar.gov/rebate-finder']],
  ['power-outage', 'Ready.gov power outage official', ['ready.gov/power-outages']],
  ['emergency-kit', 'Ready.gov emergency kit official', ['ready.gov/kit']],
  ['smoke-alarm', 'NFPA smoke alarm official', ['nfpa.org/education-and-research/home-fire-safety/smoke-alarms']],
  ['carbon-monoxide', 'CDC carbon monoxide official', ['cdc.gov/carbon-monoxide']],
  ['mold', 'EPA mold cleanup official', ['epa.gov/mold']],
  ['bed-bugs', 'EPA bed bugs official', ['epa.gov/bedbugs']],
  ['radon-map', 'EPA radon map official', ['epa.gov/radon']],
  ['lead', 'EPA lead paint official', ['epa.gov/lead']],
  ['drinking-water', 'EPA drinking water standards official', ['epa.gov/ground-water-and-drinking-water']],
  ['airport-lost-baggage', 'Airline lost baggage official', ['transportation.gov/airconsumer']],
  ['passport-status', 'Passport status official', ['passportstatus.state.gov']],
  ['uscis-processing', 'USCIS processing times official', ['egov.uscis.gov/processing-times']],
  ['irs-payment', 'IRS make a payment official', ['irs.gov/payments']],
  ['ssa-replace-card', 'Replace social security card official', ['ssa.gov/number-card/replace-card']],
  ['medicare-card', 'Replace Medicare card official', ['medicare.gov/basics/get-started-with-medicare/using-medicare/your-medicare-card']],
  ['do-not-call', 'Do Not Call registry official', ['donotcall.gov']],
  ['product-recall', 'Consumer product recalls official', ['cpsc.gov/Recalls']],
  ['poison-control', 'Poison control phone number official', ['poison.org']],
  ['safe-chicken', 'Chicken internal temperature official', ['fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart']],
  ['covid-test', 'CDC covid test official', ['cdc.gov/covid/testing']],
  ['flu-symptoms', 'CDC flu symptoms official', ['cdc.gov/flu/signs-symptoms']],
  ['blood-pressure', 'CDC high blood pressure official', ['cdc.gov/high-blood-pressure']],
  ['diabetes', 'WHO diabetes fact sheet official', ['who.int/news-room/fact-sheets/detail/diabetes']],
  ['back-pain', 'NHS back pain advice official', ['nhs.uk/conditions/back-pain']],
  ['crisis', '988 suicide crisis lifeline official', ['988lifeline.org']],
  ['adult-vaccine', 'CDC adult vaccine schedule official', ['cdc.gov/vaccines/hcp/imz-schedules/adult-age.html']],
  ['tornado', 'NOAA tornado safety official', ['weather.gov/safety/tornado']],
  ['extreme-heat', 'CDC extreme heat safety official', ['cdc.gov/extreme-heat']],
  ['japan-advisory', 'Travel advisory Japan official', ['travel.state.gov/content/travel/en/traveladvisories/traveladvisories/japan-travel-advisory.html']],
  ['tsa-liquids', 'TSA liquids rule official', ['tsa.gov/travel/security-screening/liquids-rule']],
  ['summer-meals', 'USDA summer meals official', ['fns.usda.gov/summer']],
  ['child-care', 'Child care assistance official', ['childcare.gov/consumer-education/get-help-paying-for-child-care']],
  ['head-start', 'Head Start locator official', ['headstart.gov/center-locator']],
  ['child-vaccine', 'CDC child immunization schedule official', ['cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html']],
  ['credit-freeze', 'FTC credit freeze official', ['consumer.ftc.gov/articles/what-know-about-credit-freezes-and-fraud-alerts']],
  ['gift-card-scam', 'FTC gift card scam official', ['consumer.ftc.gov/articles/gift-card-scams']],
  ['rental-scam', 'FTC rental listing scam official', ['consumer.ftc.gov/articles/rental-listing-scams']],
  ['romance-scam', 'FTC romance scam official', ['consumer.ftc.gov/articles/what-know-about-romance-scams']],
  ['phishing', 'FTC phishing scam official', ['consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams']],
  ['rental-assistance', 'HUD rental assistance official', ['hud.gov/topics/rental_assistance']],
  ['homeless-shelter', 'Homeless shelter official', ['hud.gov/findshelter']],
  ['fair-housing', 'HUD fair housing complaint official', ['hud.gov/program_offices/fair_housing_equal_opp/online-complaint']],
  ['library-congress', 'Library of Congress search official', ['loc.gov']],
  ['copyright-records', 'Copyright public records official', ['publicrecords.copyright.gov']],
  ['student-aid-login', 'Federal student aid login official', ['studentaid.gov/app/login']],
  ['pell', 'Pell Grant official', ['studentaid.gov/understand-aid/types/grants/pell']],
  ['pslf', 'Public Service Loan Forgiveness official', ['studentaid.gov/manage-loans/forgiveness-cancellation/public-service']],
  ['college-scorecard', 'College Scorecard official', ['collegescorecard.ed.gov']],
  ['ged', 'GED official', ['ged.com']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday safety and aid web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of everydaySafetyAidCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these safety and aid probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of everydaySafetyAidCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
