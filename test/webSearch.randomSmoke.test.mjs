import { describe, expect, it } from 'vitest';
import { LocalSearchProvider, localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const smokeCases = [
  ['catime', 'what is catime', 'https://cati.me/'],
  ['wechat', 'wechat pc download official', 'https://www.wechat.com/en/'],
  ['python', 'Python download official', 'https://www.python.org/downloads/'],
  ['w4', 'IRS W-4 form official', 'https://www.irs.gov/forms-pubs/about-form-w-4'],
  ['poison', 'Poison Control phone number official', 'https://www.poison.org/'],
  ['github-cli', 'GitHub CLI download official', 'https://cli.github.com/'],
  ['credit-report', 'Free credit report official', 'https://www.annualcreditreport.com/'],
  ['vote', 'Register to vote official', 'https://vote.gov/'],
  ['zip-code', 'USPS ZIP code lookup official', 'https://tools.usps.com/zip-code-lookup.htm'],
  ['cisa-passwords', 'CISA passwords official', 'https://www.cisa.gov/secure-our-world/use-strong-passwords'],
  ['fcc-broadband', 'FCC broadband map official', 'https://broadbandmap.fcc.gov/'],
  ['car-recall', 'NHTSA car recall official', 'https://www.nhtsa.gov/recalls'],
];

const naturalUserCases = [
  ['passport', 'where do I renew my US passport online official', ['travel.state.gov/content/travel/en/passports/have-passport/renew-online.html']],
  ['irs-refund', 'how can I check my IRS refund status official', ['irs.gov/wheres-my-refund']],
  ['car-recall', 'how do I check if my car has a recall official', ['nhtsa.gov/recalls']],
  ['credit-report', 'where can I get my free credit report official', ['annualcreditreport.com']],
  ['chicken-temp', 'what temperature is chicken safe to eat official', ['fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart']],
  ['poison', 'poison control phone number official', ['poison.org']],
  ['passport-photo', 'official passport photo requirements US', ['travel.state.gov/content/travel/en/passports/how-apply/photos.html']],
  ['identity-theft', 'where to report identity theft official', ['identitytheft.gov']],
  ['zip-code', 'USPS ZIP code lookup official', ['tools.usps.com/zip-code-lookup']],
  ['tsa-id', 'what ID can I use at the airport TSA official', ['tsa.gov/travel/security-screening/identification']],
  ['tsa-food', 'can I bring food through airport security TSA official', ['tsa.gov/travel/security-screening/whatcanibring/food']],
  ['passport-status', 'I applied for a passport where do I check status official', ['passportstatus.state.gov']],
  ['unclaimed-money', 'how do I find unclaimed money official', ['usa.gov/unclaimed-money']],
  ['snap', 'how to apply for food stamps SNAP official', ['usa.gov/food-help', 'fns.usda.gov/snap']],
  ['legal-aid', 'where can I find free legal aid official', ['usa.gov/legal-aid']],
  ['homeless-shelter', 'find homeless shelter official', ['hud.gov/findshelter']],
  ['lost-baggage', 'airline lost baggage complaint official', ['transportation.gov/airconsumer']],
  ['student-loans', 'where do I manage federal student loans official', ['studentaid.gov/manage-loans/repayment']],
  ['fafsa', 'FAFSA deadline official', ['studentaid.gov/apply-for-aid/fafsa/fafsa-deadlines']],
  ['gift-card-scam', 'what to do if I paid a scammer with gift card official', ['consumer.ftc.gov/articles/gift-card-scams']],
  ['phishing', 'how to recognize phishing scams official FTC', ['consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams']],
  ['tsa-liquids', 'how much liquid can I bring on a plane TSA official', ['tsa.gov/travel/security-screening/liquids-rule']],
  ['global-entry', 'where do I apply for Global Entry official', ['ttp.dhs.gov', 'cbp.gov/travel/trusted-traveler-programs/global-entry']],
  ['real-id', 'when is the REAL ID deadline official', ['dhs.gov/real-id']],
  ['voter', 'where can I register to vote official', ['vote.gov']],
  ['selective-service', 'how do I register for selective service official', ['sss.gov/register']],
  ['free-credit-report', 'is annual credit report the official free credit report site', ['annualcreditreport.com']],
  ['product-recall', 'where do I check product recalls official', ['cpsc.gov/Recalls']],
  ['car-seat-inspection', 'how do I find car seat inspection station official', ['nhtsa.gov/equipment/car-seats-and-booster-seats']],
  ['carbon-monoxide', 'carbon monoxide poisoning symptoms official CDC', ['cdc.gov/carbon-monoxide']],
  ['mold-cleanup', 'how to clean mold after flood official EPA', ['epa.gov/mold']],
  ['leftovers', 'how long are leftovers safe official USDA', ['fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety']],
  ['egg-safety', 'are raw eggs safe official FDA', ['fda.gov/food/buy-store-serve-safe-food/what-you-need-know-about-egg-safety']],
  ['baby-formula', 'infant formula recall official FDA', ['fda.gov/food/infant-formula']],
  ['dog-food', 'dog food recall official FDA', ['fda.gov/animal-veterinary/safety-health/recalls-withdrawals']],
  ['plant-hardiness', 'what plant hardiness zone am I in official USDA', ['planthardiness.ars.usda.gov']],
  ['wic-apply', 'how do I apply for WIC official', ['fns.usda.gov/wic']],
  ['summer-meals-usda', 'summer meals for kids official USDA', ['fns.usda.gov/summer']],
  ['childcare-pay', 'help paying for child care official', ['childcare.gov/consumer-education/get-help-paying-for-child-care']],
  ['head-start-center', 'find Head Start center official', ['headstart.gov/center-locator']],
  ['credit-freeze', 'how to freeze my credit official FTC', ['consumer.ftc.gov/articles/what-know-about-credit-freezes-and-fraud-alerts']],
  ['rental-scam', 'how to spot rental listing scams official FTC', ['consumer.ftc.gov/articles/rental-listing-scams']],
  ['romance-scam', 'romance scam warning signs official FTC', ['consumer.ftc.gov/articles/what-know-about-romance-scams']],
  ['small-claims', 'how to file small claims court official', ['usa.gov/small-claims-court']],
  ['housing-help', 'where can I get rental assistance official HUD', ['hud.gov/topics/rental_assistance']],
  ['fema-aid', 'apply for FEMA disaster assistance official', ['disasterassistance.gov']],
  ['covid-testing', 'where can I read official CDC covid testing guidance', ['cdc.gov/covid/testing']],
  ['flu-symptoms', 'what are flu symptoms CDC official', ['cdc.gov/flu/signs-symptoms']],
  ['high-blood-pressure', 'high blood pressure information official CDC', ['cdc.gov/high-blood-pressure']],
  ['diabetes-who', 'diabetes fact sheet official WHO', ['who.int/news-room/fact-sheets/detail/diabetes']],
  ['back-pain-nhs', 'back pain advice official NHS', ['nhs.uk/conditions/back-pain']],
  ['crisis-lifeline', 'suicide crisis lifeline 988 official', ['988lifeline.org']],
  ['adult-vaccine', 'adult vaccine schedule official CDC', ['cdc.gov/vaccines/hcp/imz-schedules/adult-age']],
  ['air-quality-index', 'where do I check air quality index official', ['airnow.gov/aqi']],
  ['hurricane-center', 'official hurricane center NOAA', ['nhc.noaa.gov']],
  ['earthquake-map', 'USGS earthquake map official', ['earthquake.usgs.gov/earthquakes/map']],
  ['wildfire-map', 'national wildfire smoke map official', ['fire.airnow.gov']],
  ['flood-map', 'FEMA flood maps official', ['msc.fema.gov/portal/home']],
  ['tornado-safety', 'tornado safety official NOAA', ['weather.gov/safety/tornado']],
  ['heat-safety', 'extreme heat safety official CDC', ['cdc.gov/extreme-heat']],
  ['uscis-processing', 'how long is USCIS processing times official', ['egov.uscis.gov/processing-times']],
  ['green-card', 'how to replace green card official', ['uscis.gov/green-card/after-we-grant-your-green-card/replace-your-green-card']],
  ['citizenship', 'apply for citizenship official USCIS', ['uscis.gov/citizenship/apply-for-citizenship']],
  ['i94', 'where can I get I-94 travel history official', ['i94.cbp.dhs.gov']],
  ['esta', 'ESTA application official', ['esta.cbp.dhs.gov']],
  ['minimum-wage', 'federal minimum wage official DOL', ['dol.gov/agencies/whd/minimum-wage']],
  ['overtime', 'overtime pay rules official DOL', ['dol.gov/agencies/whd/overtime']],
  ['osha-report', 'report unsafe workplace official OSHA', ['osha.gov/workers/file-complaint']],
  ['fmla', 'family medical leave FMLA official', ['dol.gov/agencies/whd/fmla']],
  ['unpaid-wages', 'report unpaid wages official DOL', ['dol.gov/agencies/whd/contact/complaints']],
  ['fafsa-apply', 'apply for FAFSA official', ['studentaid.gov/h/apply-for-aid/fafsa']],
  ['pell-grant', 'Pell Grant official', ['studentaid.gov/understand-aid/types/grants/pell']],
  ['pslf', 'public service loan forgiveness official', ['studentaid.gov/manage-loans/forgiveness-cancellation/public-service']],
  ['ein', 'apply for EIN online official IRS', ['irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online']],
  ['sba-loans', 'SBA loans official', ['sba.gov/funding-programs/loans']],
  ['trademark-basics', 'trademark basics official USPTO', ['uspto.gov/trademarks/basics']],
  ['birth-certificate', 'how do I get a birth certificate official', ['usa.gov/birth-certificate']],
  ['marriage-certificate', 'how to get marriage certificate official', ['usa.gov/marriage-certificate']],
  ['death-certificate', 'death certificate official', ['usa.gov/death-certificate']],
  ['name-change-legal', 'legal name change official USA', ['usa.gov/name-change']],
  ['court-records', 'how to find federal court records official', ['pacer.uscourts.gov']],
  ['bankruptcy-basics', 'bankruptcy basics official court', ['uscourts.gov/services-forms/bankruptcy/bankruptcy-basics']],
  ['jury-scam', 'jury duty scam official courts', ['uscourts.gov/services-forms/jury-service/juror-scams']],
  ['irs-transcript', 'get IRS tax transcript official', ['irs.gov/individuals/get-transcript']],
  ['irs-withholding', 'IRS tax withholding estimator official', ['irs.gov/individuals/tax-withholding-estimator']],
  ['irs-extension', 'file tax extension official IRS', ['irs.gov/forms-pubs/extension-of-time-to-file-your-tax-return']],
  ['treasury-bonds', 'savings bonds official TreasuryDirect', ['treasurydirect.gov/savings-bonds']],
  ['embassy-tokyo', 'US embassy Tokyo official', ['jp.usembassy.gov']],
  ['national-park', 'find national park official', ['nps.gov/findapark']],
  ['camping-official', 'book camping official recreation.gov', ['recreation.gov']],
  ['flight-delay-rights', 'what are my rights if flight delayed official DOT', ['transportation.gov/airconsumer']],
  ['airline-complaint-dot', 'file airline complaint official DOT', ['secure.dot.gov/air-travel-complaint']],
  ['tsa-acceptable-id', 'acceptable ID airport security official TSA', ['tsa.gov/travel/security-screening/identification']],
  ['child-car-seat', 'child car seat safety official', ['nhtsa.gov/equipment/car-seats-and-booster-seats']],
  ['fuel-economy', 'compare car fuel economy official', ['fueleconomy.gov']],
  ['pet-travel', 'USDA pet travel official', ['aphis.usda.gov/pet-travel']],
  ['lost-pet-chip', 'pet microchip lookup official', ['aaha.org/for-veterinary-professionals/microchip-search']],
  ['invasive-plants', 'invasive plants official USDA', ['invasivespeciesinfo.gov']],
  ['school-lunch', 'school lunch program official USDA', ['fns.usda.gov/nslp']],
  ['public-library', 'find public library official', ['imls.gov/search-compare']],
  ['medicare-nursing-home', 'compare nursing homes official Medicare', ['medicare.gov/care-compare']],
  ['medicare-hospital', 'hospital compare official Medicare', ['medicare.gov/care-compare']],
  ['resume-help-career', 'resume help official CareerOneStop', ['careeronestop.org/JobSearch/Resumes']],
  ['patent-search-uspto', 'patent search official USPTO', ['uspto.gov/patents/search']],
  ['clinical-trials-nih', 'clinical trials official NIH', ['clinicaltrials.gov']],
  ['pubmed-search', 'PubMed official search', ['pubmed.ncbi.nlm.nih.gov']],
];

function includesExpected(url, expected) {
  const lowerUrl = String(url).toLowerCase();
  return expected.some((part) => lowerUrl.includes(part.toLowerCase()));
}

function makeSeededIndexes(total, count, seed) {
  const indexes = Array.from({ length: total }, (_, index) => index);
  let state = seed;
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swapIndex = state % (index + 1);
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes.slice(0, count);
}

describe('random web search smoke coverage', () => {
  it('keeps seeded user-style queries on official zero-network results', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called for official smoke cases');
      },
    });
    const selectedCases = makeSeededIndexes(smokeCases.length, 8, 20260508)
      .map((index) => smokeCases[index]);

    for (const [name, query, expectedUrl] of selectedCases) {
      const response = await new SearchService({ providers: [provider] }).webSearch(query, { limit: 5 });
      expect(response.results[0]?.url, name).toBe(expectedUrl);
    }
  });

  it('keeps random low-quality and unsafe fixture results out of parsed search results', () => {
    const blockedFixtures = [
      ['csdn', 'https://blog.csdn.net/example/article/details/1'],
      ['zhihu', 'https://www.zhihu.com/question/1'],
      ['tieba', 'https://tieba.baidu.com/p/1'],
      ['fake-wechat', 'https://www.inivite-wechat.com/en/'],
      ['bilibili-video', 'https://www.bilibili.com/video/BV1xx411c7mD'],
      ['private-ip', 'http://192.168.1.2/admin'],
    ];
    const selectedFixtures = makeSeededIndexes(blockedFixtures.length, 4, 424242)
      .map((index) => blockedFixtures[index]);
    const html = `
      ${selectedFixtures.map(([name, url]) => `
        <li class="b_algo"><h2><a href="${url}">${name}</a></h2><p>Low-quality or unsafe result.</p></li>
      `).join('\n')}
      <li class="b_algo">
        <h2><a href="https://www.wechat.com/en/">WeChat</a></h2>
        <p>Official WeChat site.</p>
      </li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5, new Set(), {
      query: 'wechat pc download official',
    })).toEqual([
      expect.objectContaining({ url: 'https://www.wechat.com/en/' }),
    ]);
  });

  it('handles seeded natural-language user queries on the zero-network official path', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called for natural-language official cases');
      },
    });
    const selectedCases = makeSeededIndexes(naturalUserCases.length, naturalUserCases.length, 20260525)
      .map((index) => naturalUserCases[index]);

    for (const [name, query, expected] of selectedCases) {
      const response = await new SearchService({ providers: [provider] }).webSearch(query, { limit: 5 });
      const hitRank = response.results.findIndex((result) => includesExpected(result.url, expected));

      expect(hitRank, `${name}: ${JSON.stringify(response.results.slice(0, 3))}`).toBeGreaterThanOrEqual(0);
      expect(hitRank, name).toBeLessThan(3);
    }
  });
});
