import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const everydayFederalServiceCases = [
  ['irs-free-file', 'IRS Free File official', ['irs.gov/file-your-taxes-for-free']],
  ['irs-vita', 'IRS free tax help VITA official', ['irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers']],
  ['irs-directory', 'IRS tax preparer directory official', ['irs.treasury.gov/rpo/rpo.jsf']],
  ['irs-charity-check', 'IRS charity search official', ['irs.gov/charities-non-profits/tax-exempt-organization-search']],
  ['ssa-retirement', 'Social Security retirement estimator official', ['ssa.gov/benefits/retirement/estimator.html']],
  ['ssa-earnings', 'Social Security earnings record official', ['ssa.gov/myaccount']],
  ['medicare-plan', 'Medicare plan compare official', ['medicare.gov/plan-compare']],
  ['medicare-costs', 'Medicare costs official', ['medicare.gov/basics/costs/medicare-costs']],
  ['healthcare-local-help', 'HealthCare.gov find local help official', ['localhelp.healthcare.gov']],
  ['hipaa-complaint', 'HHS HIPAA complaint official', ['hhs.gov/hipaa/filing-a-complaint']],
  ['clinical-trials-search', 'ClinicalTrials.gov search official', ['clinicaltrials.gov']],
  ['pubmed-search', 'PubMed search official', ['pubmed.ncbi.nlm.nih.gov']],
  ['food-recalls', 'FoodSafety.gov recalls official', ['foodsafety.gov/recalls-and-outbreaks']],
  ['foodkeeper', 'FoodKeeper app official', ['foodsafety.gov/keep-food-safe/foodkeeper-app']],
  ['fda-food-recalls', 'FDA food recalls official', ['fda.gov/safety/recalls-market-withdrawals-safety-alerts']],
  ['fda-cosmetics', 'FDA cosmetics official', ['fda.gov/cosmetics']],
  ['cdc-growth', 'CDC growth charts official', ['cdc.gov/growthcharts']],
  ['child-bmi', 'CDC child BMI calculator official', ['cdc.gov/bmi/child-teen-calculator']],
  ['nhtsa-vin', 'NHTSA VIN decoder official', ['vpic.nhtsa.dot.gov/decoder']],
  ['nhtsa-car-seat-finder', 'NHTSA car seat finder official', ['nhtsa.gov/equipment/car-seats-and-booster-seats']],
  ['faa-drone', 'FAA drone registration official', ['faadronezone-access.faa.gov']],
  ['faa-delays', 'FAA airport delays official', ['nasstatus.faa.gov']],
  ['cbp-border-wait', 'CBP border wait times official', ['bwt.cbp.gov']],
  ['travel-advisories', 'State Department travel advisories official', ['travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html']],
  ['smart-traveler', 'STEP enrollment official State Department', ['step.state.gov']],
  ['us-embassy-search', 'Find US embassy official', ['usembassy.gov']],
  ['tsa-medication', 'TSA medication rules official', ['tsa.gov/travel/security-screening/whatcanibring/medical']],
  ['usps-hold-mail', 'USPS hold mail official', ['usps.com/manage/hold-mail.htm']],
  ['usps-informed', 'USPS informed delivery official', ['informeddelivery.usps.com']],
  ['usps-po-box', 'USPS PO Box official', ['usps.com/manage/po-boxes.htm']],
  ['usps-passport', 'USPS passport appointment official', ['tools.usps.com/rcas.htm']],
  ['fcc-license', 'FCC license search official', ['wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp']],
  ['fcc-outage', 'FCC network outage reporting official', ['fcc.gov/network-outage-reporting-system-nors']],
  ['fcc-broadband-label', 'FCC broadband labels official', ['fcc.gov/broadbandlabels']],
  ['census-quickfacts', 'Census QuickFacts official', ['census.gov/quickfacts']],
  ['census-data', 'Census data official', ['data.census.gov']],
  ['bls-cpi', 'BLS CPI official', ['bls.gov/cpi']],
  ['bls-jobs', 'BLS Occupational Outlook Handbook official', ['bls.gov/ooh']],
  ['bea-gdp', 'BEA GDP official', ['bea.gov/data/gdp']],
  ['treasury-rates', 'Treasury rates official', ['treasury.gov/resource-center/data-chart-center/interest-rates']],
  ['treasury-auctions', 'TreasuryDirect auctions official', ['treasurydirect.gov/auctions']],
  ['sam-search', 'SAM.gov entity search official', ['sam.gov/search']],
  ['grants-search', 'Grants.gov search official', ['grants.gov/search-grants']],
  ['usa-spending', 'USAspending official', ['usaspending.gov']],
  ['fbo', 'Contract opportunities official', ['sam.gov/search']],
  ['patent-application', 'USPTO patent application official', ['uspto.gov/patents/apply']],
  ['trademark-application', 'USPTO trademark application official', ['uspto.gov/trademarks/apply']],
  ['copyright-register', 'Copyright registration official', ['copyright.gov/registration']],
  ['loc-catalog', 'Library of Congress catalog official', ['catalog.loc.gov']],
  ['national-archives', 'National Archives catalog official', ['catalog.archives.gov']],
  ['irs-efile-pin', 'IRS e-file PIN official', ['irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin']],
  ['student-loan-forgiveness', 'Student loan forgiveness official', ['studentaid.gov/manage-loans/forgiveness-cancellation']],
  ['loan-simulator', 'Federal student aid loan simulator official', ['studentaid.gov/loan-simulator']],
  ['fafsa-form', 'FAFSA form official', ['studentaid.gov/h/apply-for-aid/fafsa']],
  ['school-closure', 'Closed school discharge official', ['studentaid.gov/manage-loans/forgiveness-cancellation/closed-school']],
  ['nces-college', 'NCES College Navigator official', ['nces.ed.gov/collegenavigator']],
  ['job-center', 'American Job Center finder official', ['careeronestop.org/LocalHelp/AmericanJobCenters']],
  ['apprenticeship', 'Apprenticeship.gov official', ['apprenticeship.gov']],
  ['unemployment-state', 'Find state unemployment office official', ['careeronestop.org/LocalHelp/UnemploymentBenefits']],
  ['workers-rights', 'Worker rights DOL official', ['dol.gov/general/topic/workers-rights']],
  ['osha-standards', 'OSHA standards official', ['osha.gov/laws-regs']],
  ['eeoc-employer', 'EEOC employer guidance official', ['eeoc.gov/employers']],
  ['ada-complaint', 'ADA file complaint official', ['ada.gov/file-a-complaint']],
  ['hud-section8', 'HUD housing choice vouchers official', ['hud.gov/topics/housing_choice_voucher_program_section_8']],
  ['hud-fha', 'FHA loans official HUD', ['hud.gov/buying/loans']],
  ['va-home-loan', 'VA home loan official', ['va.gov/housing-assistance/home-loans']],
  ['va-benefits', 'VA benefits official', ['va.gov/resources']],
  ['military-records', 'Request military records official', ['archives.gov/veterans/military-service-records']],
  ['selective-check', 'Selective Service verify registration official', ['sss.gov/verify']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday federal service web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of everydayFederalServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these federal service probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of everydayFederalServiceCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
