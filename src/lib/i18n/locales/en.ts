import type { Messages } from '../schema';
import englishMessagesJson from './en.json';

export const englishMessages = englishMessagesJson satisfies Messages;
