import englishMessagesJson from './locales/en.json';

export const messageKeys = Object.keys(englishMessagesJson) as MessageKey[];
export type MessageKey = keyof typeof englishMessagesJson;
export type Messages = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;
