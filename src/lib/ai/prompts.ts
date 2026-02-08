export const SEARCH_SYSTEM_PROMPT = (context: string, timeInfo: string) => `Current Date/Time: ${timeInfo}

Internet Search Results:
${context}

Please use the information above to answer the user question. CITATION REQUIREMENT: You MUST cite your sources using [1], [2], etc. notation at the end of sentences that use information from the search results.`;

export const TIME_SYSTEM_PROMPT = (timeInfo: string) => `Current Date/Time: ${timeInfo}`;

export const IMAGE_PLACEHOLDER = '[Image]';
