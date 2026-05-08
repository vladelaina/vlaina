import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const everydayUserSearchCases = [
  ['voter-status', 'Check voter registration status official', ['vote.gov/confirm-registration']],
  ['polling-place', 'Find polling place official', ['vote.gov']],
  ['absentee-ballot', 'Absentee ballot official', ['vote.gov/absentee-voting']],
  ['election-results', 'Official election results USA', ['usa.gov/election-results']],
  ['campaign-finance', 'FEC campaign finance search official', ['fec.gov/data']],
  ['passport-fees', 'US passport fees official', ['travel.state.gov/content/travel/en/passports/how-apply/fees.html']],
  ['passport-form', 'Passport form DS-11 official', ['travel.state.gov/content/travel/en/passports/how-apply/forms.html']],
  ['customs-duty', 'US customs duty rates official', ['cbp.gov/travel/international-visitors/kbyg/customs-duty-info']],
  ['import-food', 'Can I bring food into the US official', ['cbp.gov/travel/international-visitors/agricultural-items']],
  ['tsa-precheck-status', 'TSA PreCheck status official', ['tsa.gov/precheck']],
  ['airport-security-time', 'TSA security wait times official', ['tsa.gov/mobile']],
  ['driver-record-ca', 'California driver record request official', ['dmv.ca.gov/portal/customer-service/request-vehicle-or-driver-records']],
  ['address-change-ca', 'California DMV change address official', ['dmv.ca.gov/portal/online-change-of-address']],
  ['vehicle-title-ca', 'California vehicle title transfer official', ['dmv.ca.gov/portal/vehicle-registration/titles/title-transfers-and-changes']],
  ['parking-placard-ca', 'California disabled parking placard official', ['dmv.ca.gov/portal/vehicle-registration/license-plates-decals-and-placards/disabled-person-parking-placards-plates']],
  ['irs-refund-amended', 'IRS amended return status official', ['irs.gov/filing/wheres-my-amended-return']],
  ['irs-pin', 'IRS identity protection PIN official', ['irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin']],
  ['irs-direct-file', 'IRS Direct File official', ['irs.gov/filing/irs-direct-file']],
  ['taxpayer-advocate', 'Taxpayer Advocate Service official', ['taxpayeradvocate.irs.gov']],
  ['cfpb-complaint', 'File consumer finance complaint official', ['consumerfinance.gov/complaint']],
  ['credit-card-dispute', 'CFPB credit card dispute official', ['consumerfinance.gov/ask-cfpb']],
  ['fdic-insurance', 'FDIC deposit insurance official', ['fdic.gov/resources/deposit-insurance']],
  ['ncua', 'NCUA credit union locator official', ['mapping.ncua.gov']],
  ['brokercheck', 'FINRA BrokerCheck official', ['brokercheck.finra.org']],
  ['complain-sec', 'SEC investor complaint official', ['sec.gov/oiea/Complaint.html']],
  ['recall-medicine', 'FDA drug recalls official', ['fda.gov/drugs/drug-safety-and-availability/drug-recalls']],
  ['medwatch', 'FDA MedWatch report official', ['fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program']],
  ['vaccine-side-effect', 'VAERS report official', ['vaers.hhs.gov']],
  ['clinical-guidelines', 'CDC vaccination side effects official', ['cdc.gov/vaccine-safety/about']],
  ['rsv', 'CDC RSV symptoms official', ['cdc.gov/rsv']],
  ['measles', 'CDC measles symptoms official', ['cdc.gov/measles']],
  ['norovirus', 'CDC norovirus official', ['cdc.gov/norovirus']],
  ['food-poisoning', 'CDC food poisoning symptoms official', ['cdc.gov/food-safety/signs-symptoms']],
  ['cold-flu', 'symptoms of flu vs cold', ['cdc.gov/flu/signs-symptoms/cold-flu.html']],
  ['handwashing', 'CDC handwashing official', ['cdc.gov/handwashing']],
  ['sleep', 'CDC sleep and sleep disorders official', ['cdc.gov/sleep']],
  ['bmi', 'CDC adult BMI calculator official', ['cdc.gov/bmi/adult-calculator']],
  ['asbestos', 'EPA asbestos official', ['epa.gov/asbestos']],
  ['mercury', 'EPA mercury official', ['epa.gov/mercury']],
  ['pesticide-poisoning', 'EPA pesticide poisoning official', ['epa.gov/pesticide-incidents']],
  ['septic', 'EPA septic systems official', ['epa.gov/septic']],
  ['severe-weather', 'Ready.gov severe weather official', ['ready.gov/severe-weather']],
  ['winter-weather', 'Ready.gov winter weather official', ['ready.gov/winter-weather']],
  ['earthquake-ready', 'Ready.gov earthquake official', ['ready.gov/earthquakes']],
  ['cybersecurity-home', 'CISA secure our world official', ['cisa.gov/secure-our-world']],
  ['passwords', 'CISA passwords official', ['cisa.gov/secure-our-world/use-strong-passwords']],
  ['two-factor', 'CISA multifactor authentication official', ['cisa.gov/secure-our-world/turn-mfa']],
  ['internet-speed', 'FCC broadband map official', ['broadbandmap.fcc.gov']],
  ['robocalls', 'FCC unwanted calls official', ['fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts']],
  ['phone-complaint', 'FCC consumer complaint official', ['consumercomplaints.fcc.gov']],
  ['mail-forwarding', 'USPS change of address official', ['moversguide.usps.com']],
  ['passport-renew-mail', 'how to renew passport by mail', ['travel.state.gov/content/travel/en/passports/have-passport/renew.html']],
  ['boiled-eggs', 'best way to boil eggs', ['fsis.usda.gov/food-safety/safe-food-handling-and-preparation/eggs/shell-eggs-farm-table']],
  ['coffee-stain', 'how to remove coffee stain from shirt', ['extension.illinois.edu/stain-solutions/coffee']],
  ['laptop-fan-noise', 'what causes laptop fan noise', ['dell.com/support/kbdoc/en-us/000179087/how-to-troubleshoot-fan-issues']],
].map(([id, query, expected]) => ({ id, query, expected }));

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

describe('everyday user web search queries', () => {
  it('returns an expected official source in the top results', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider()],
    });

    for (const testCase of everydayUserSearchCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, `${testCase.id}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, testCase.id).toBeLessThan(3);
    }
  }, 30_000);

  it('keeps these everyday official-source probes on the internal fast path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called');
        },
      })],
    });

    for (const testCase of everydayUserSearchCases) {
      const response = await service.webSearch(testCase.query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, testCase.expected));

      expect(hitRank, testCase.id).toBeGreaterThanOrEqual(0);
    }
  });
});
