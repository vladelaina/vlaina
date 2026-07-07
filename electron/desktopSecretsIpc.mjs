import { primitiveToString } from './managedRequestHelpers.mjs';

function isSafeProviderId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  );
}

function requireSafeProviderId(value, requireNonEmptyString) {
  const providerId = requireNonEmptyString(value, 'provider id').trim();
  if (!isSafeProviderId(providerId)) {
    throw new Error('Provider id contains unsupported characters.');
  }
  return providerId;
}

export function registerDesktopSecretsIpc({
  handleIpc,
  readSecretsStore,
  requireNonEmptyString,
  requireStringArray,
  updateSecretsStore,
}) {
  handleIpc('desktop:secrets:get-ai-provider-secrets', async (_event, providerIds) => {
    const { data } = await readSecretsStore();
    const result = {};

    for (const providerId of requireStringArray(providerIds, 'provider id')) {
      const normalizedProviderId = requireSafeProviderId(providerId, requireNonEmptyString);
      if (typeof data[normalizedProviderId] === 'string') {
        result[normalizedProviderId] = data[normalizedProviderId];
      }
    }

    return result;
  });

  handleIpc('desktop:secrets:set-ai-provider-secret', async (_event, providerId, apiKey) => {
    const normalizedProviderId = requireSafeProviderId(providerId, requireNonEmptyString);
    await updateSecretsStore((data) => {
      data[normalizedProviderId] = primitiveToString(apiKey) ?? '';
    });
  });

  handleIpc('desktop:secrets:delete-ai-provider-secret', async (_event, providerId) => {
    const normalizedProviderId = requireSafeProviderId(providerId, requireNonEmptyString);
    await updateSecretsStore((data) => {
      delete data[normalizedProviderId];
    });
  });
}
