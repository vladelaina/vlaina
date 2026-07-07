export async function getAIProviderSecretCommands() {
  const { aiProviderSecretCommands } = await import('@/lib/desktop/secretsCommands');
  return aiProviderSecretCommands;
}

export function showStorageToast(
  messageKey: 'storage.keychainUnavailable' | 'storage.saveFailed',
  type: 'error',
  duration: number,
): void {
  void Promise.all([
    import('@/stores/useToastStore'),
    import('@/lib/i18n'),
  ])
    .then(([toastStore, i18n]) => {
      toastStore.useToastStore
        .getState()
        .addToast(i18n.translate(messageKey), type, duration);
    })
    .catch(() => {
    });
}
