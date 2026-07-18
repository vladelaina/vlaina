import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';
import { getErrorDiagnosticDetails } from '@/lib/diagnostics/errorDetails';
import type { UnifiedSavePatch, UnifiedSaveRequest } from './unifiedStorageSaveTypes';

function getPatchSections(patch: UnifiedSavePatch | undefined): string[] {
  if (!patch) return [];

  const sections: string[] = [];
  if (patch.customIcons) sections.push('customIcons');
  if (patch.settings?.timezone) sections.push('settings.timezone');
  if (patch.settings?.markdown) sections.push('settings.markdown');
  if (patch.settings?.ui) sections.push('settings.ui');
  if (patch.ai?.sessions) sections.push('ai.sessions');
  if (patch.ai?.providers) sections.push('ai.providers');
  return sections;
}

export function getUnifiedSaveRequestDiagnosticDetails(
  request: UnifiedSaveRequest,
): Record<string, unknown> {
  return {
    writeMode: request.patch ? 'patch' : 'full',
    patchSections: getPatchSections(request.patch),
    persistAI: request.persistAI,
    persistProviders: request.persistProviders,
  };
}

export const getUnifiedStorageErrorDiagnosticDetails = getErrorDiagnosticDetails;

export function logUnifiedStorageDiagnostic(
  event: string,
  details?: Record<string, unknown>,
): void {
  logDiagnostic('unified-storage', event, details);
}
