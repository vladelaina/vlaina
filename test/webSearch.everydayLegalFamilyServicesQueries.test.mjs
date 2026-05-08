import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const legalFamilyServiceCases = [
  ['uscis-fee', 'USCIS fee calculator official', ['uscis.gov/feecalculator']],
  ['uscis-doctor', 'USCIS civil surgeon locator official', ['uscis.gov/tools/find-a-civil-surgeon']],
  ['uscis-change-address', 'USCIS change address official', ['uscis.gov/addresschange']],
  ['uscis-forms', 'USCIS forms official', ['uscis.gov/forms']],
  ['uscis-e-verify', 'E-Verify official', ['e-verify.gov']],
  ['state-vital-records', 'Find vital records office official', ['cdc.gov/nchs/w2w']],
  ['child-passport', 'Child passport official', ['travel.state.gov/content/travel/en/passports/need-passport/under-16.html']],
  ['passport-lost', 'Lost passport official', ['travel.state.gov/content/travel/en/passports/have-passport/lost-stolen.html']],
  ['visa-waiver', 'Visa Waiver Program official', ['travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html']],
  ['i9', 'Form I-9 official', ['uscis.gov/i-9']],
  ['w2', 'IRS Form W-2 official', ['irs.gov/forms-pubs/about-form-w-2']],
  ['1099', 'IRS Form 1099 official', ['irs.gov/forms-pubs/about-form-1099-misc']],
  ['itin', 'IRS ITIN official', ['irs.gov/individuals/individual-taxpayer-identification-number']],
  ['tax-records', 'IRS tax records official', ['irs.gov/individuals/get-transcript']],
  ['where-file-taxes', 'IRS where to file paper tax return official', ['irs.gov/filing/where-to-file-paper-tax-returns-with-or-without-a-payment']],
  ['irs-office', 'IRS office locator official', ['apps.irs.gov/app/office-locator']],
  ['state-tax-ca', 'California state tax refund official', ['ftb.ca.gov/refund']],
  ['state-tax-ny', 'New York state tax refund official', ['tax.ny.gov/pit/file/refund.htm']],
  ['state-tax-tx', 'Texas sales tax permit official', ['comptroller.texas.gov/taxes/permit']],
  ['state-tax-fl', 'Florida sales tax registration official', ['floridarevenue.com/taxes/registration']],
  ['jury-summons', 'Federal jury service official', ['uscourts.gov/services-forms/jury-service']],
  ['court-forms', 'US courts forms official', ['uscourts.gov/forms-rules/forms']],
  ['federal-rules', 'Federal rules of civil procedure official', ['uscourts.gov/rules-policies/current-rules-practice-procedure']],
  ['bankruptcy-forms', 'Bankruptcy forms official', ['uscourts.gov/forms/bankruptcy-forms']],
  ['probation', 'Federal probation official', ['uscourts.gov/services-forms/probation-and-pretrial-services']],
  ['public-defender', 'Federal public defender official', ['fd.org']],
  ['legal-self-help', 'LawHelp legal aid official', ['lawhelp.org']],
  ['childcare-lookup', 'Child care search official', ['childcare.gov/state-resources']],
  ['childcare-licensing', 'Child care licensing official', ['childcare.gov/consumer-education/child-care-licensing-and-regulations']],
  ['child-support-calculator', 'Child support calculator official', ['acf.hhs.gov/css/parents/how-does-child-support-work']],
  ['wic', 'WIC official', ['fns.usda.gov/wic']],
  ['school-meals', 'School meals official USDA', ['fns.usda.gov/cn']],
  ['snap-retailer', 'SNAP retailer locator official', ['usda-fns.maps.arcgis.com']],
  ['food-bank', 'Find food bank official', ['feedingamerica.org/find-your-local-foodbank']],
  ['housing-counselor', 'HUD housing counselor official', ['hud.gov/counseling']],
  ['hud-homes', 'HUD homes official', ['hudhomestore.gov']],
  ['section-8-waitlist', 'Find public housing agency official', ['hud.gov/program_offices/public_indian_housing/pha/contacts']],
  ['energy-assistance', 'LIHEAP official', ['acf.hhs.gov/ocs/programs/liheap']],
  ['weatherization', 'Weatherization assistance official', ['energy.gov/scep/wap/weatherization-assistance-program']],
  ['lifeline', 'FCC Lifeline official', ['fcc.gov/lifeline-consumers']],
  ['affordable-connectivity', 'FCC Affordable Connectivity Program official', ['fcc.gov/acp']],
  ['211', '211 official', ['211.org']],
  ['pet-import', 'CDC dog import official', ['cdc.gov/importation/dogs']],
  ['pet-airline', 'USDA pet travel official', ['aphis.usda.gov/pet-travel']],
  ['animal-welfare', 'USDA animal welfare complaint official', ['aphis.usda.gov/awa/regulatory-enforcement/complaint']],
  ['rabies-travel', 'CDC rabies travel official', ['wwwnc.cdc.gov/travel/diseases/rabies']],
  ['local-health', 'Find local health department official', ['naccho.org/membership/lhd-directory']],
  ['vaccines-near-me', 'Vaccines.gov official', ['vaccines.gov']],
  ['covid-vaccine-locator', 'Vaccines.gov COVID official', ['vaccines.gov/search']],
  ['mental-health-treatment', 'SAMHSA treatment locator official', ['findtreatment.gov']],
  ['substance-treatment', 'SAMHSA substance treatment locator official', ['findtreatment.gov']],
  ['disaster-shelter', 'Red Cross shelter finder official', ['redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter']],
  ['blood-donation', 'Red Cross blood donation official', ['redcrossblood.org']],
  ['organ-donor', 'Organ donor registration official', ['organdonor.gov/sign-up']],
  ['vaccine-card', 'CDC vaccine records official', ['cdc.gov/vaccines/programs/iis/contacts-locate-records']],
  ['immunization-info', 'Immunization information systems official', ['cdc.gov/vaccines/programs/iis']],
  ['work-permit', 'USCIS work permit official', ['uscis.gov/i-765']],
  ['green-card-renewal', 'Green card renewal official', ['uscis.gov/green-card/after-we-grant-your-green-card/replace-your-green-card']],
  ['daca', 'DACA official USCIS', ['uscis.gov/DACA']],
  ['asylum', 'Asylum official USCIS', ['uscis.gov/humanitarian/refugees-and-asylum/asylum']],
  ['refugee', 'Refugee resettlement official', ['acf.hhs.gov/orr']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday legal and family service web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of legalFamilyServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these legal and family service probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of legalFamilyServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
