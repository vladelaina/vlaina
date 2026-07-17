export interface ProviderCardDraft {
  name?: string;
  apiHost?: string;
  apiKey?: string;
}

export interface PendingDeleteProvider {
  id: string;
  name: string;
}
