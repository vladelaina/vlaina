let checkStatusPromise: Promise<void> | null = null;
let checkStatusPromiseVersion = 0;
let accountSessionMutationVersion = 0;
let accountAuthAttemptVersion = 0;
let lastCheckStatusSyncAt = 0;

export const ACCOUNT_STATUS_REFRESH_INTERVAL_MS = 30_000;

export function invalidateAccountSessionChecks(): void {
  accountSessionMutationVersion += 1;
  checkStatusPromise = null;
}

export function startAccountAuthAttempt(): number {
  accountAuthAttemptVersion += 1;
  invalidateAccountSessionChecks();
  return accountAuthAttemptVersion;
}

export function invalidateAccountAuthAttempts(): void {
  accountAuthAttemptVersion += 1;
  invalidateAccountSessionChecks();
}

export function invalidateAccountSessionAuthState(): void {
  invalidateAccountAuthAttempts();
}

export function isCurrentAccountAuthAttempt(version: number): boolean {
  return version === accountAuthAttemptVersion;
}

export function getAccountSessionMutationVersion(): number {
  return accountSessionMutationVersion;
}

export function isCurrentAccountSessionMutation(version: number): boolean {
  return version === accountSessionMutationVersion;
}

export function getCurrentCheckStatusPromise(version: number): Promise<void> | null {
  return checkStatusPromise && checkStatusPromiseVersion === version ? checkStatusPromise : null;
}

export function setCurrentCheckStatusPromise(version: number, promise: Promise<void>): void {
  checkStatusPromiseVersion = version;
  checkStatusPromise = promise;
}

export function clearCurrentCheckStatusPromise(promise: Promise<void>): void {
  if (checkStatusPromise === promise) {
    checkStatusPromise = null;
  }
}

export function getLastCheckStatusSyncAt(): number {
  return lastCheckStatusSyncAt;
}

export function markCheckStatusSynced(): void {
  lastCheckStatusSyncAt = Date.now();
}
