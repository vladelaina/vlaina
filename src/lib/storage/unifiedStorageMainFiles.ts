import { getStorageAdapter } from '@/lib/storage/adapter';
import type { CustomIcon, DataFile, UnifiedData } from './unifiedStorageTypes';
import {
  MAX_CUSTOM_ICONS,
  MAX_DELETED_CUSTOM_ICON_IDS,
  MAX_MAIN_DATA_BYTES,
  type UnifiedSavePatch,
} from './unifiedStorageSaveTypes';
import {
  isRecord,
  isSerializedWithinLimit,
  readBoundedTextFile,
  trimArrayForSerializedLimit,
} from './unifiedStorageCommon';
import {
  normalizeCustomIconList,
  normalizeDeletedCustomIconIds,
  sanitizeUnifiedData,
} from './unifiedStorageMainNormalize';

export async function readExistingMainDataFile(
  storage: ReturnType<typeof getStorageAdapter>,
  path: string,
): Promise<UnifiedData | null> {
  if (!(await storage.exists(path))) {
    return null;
  }

  try {
    const content = await readBoundedTextFile(storage, path, MAX_MAIN_DATA_BYTES);
    if (content === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.data)) {
      return null;
    }

    return sanitizeUnifiedData(parsed.data as unknown as UnifiedData);
  } catch {
    return null;
  }
}

export function mergeCustomIconsForSafeSave(
  incomingData: UnifiedData,
  existingData: UnifiedData | null,
): Pick<UnifiedData, 'customIcons' | 'deletedCustomIconIds'> {
  const incomingDeletedIds = new Set(normalizeDeletedCustomIconIds(incomingData.deletedCustomIconIds));
  const existingDeletedIds = new Set(normalizeDeletedCustomIconIds(existingData?.deletedCustomIconIds));
  const deletedIds = new Set([...existingDeletedIds, ...incomingDeletedIds]);
  const iconsById = new Map<string, CustomIcon>();

  for (const icon of normalizeCustomIconList(existingData?.customIcons)) {
    if (!deletedIds.has(icon.id)) {
      iconsById.set(icon.id, icon);
    }
  }

  for (const icon of normalizeCustomIconList(incomingData.customIcons)) {
    if (!deletedIds.has(icon.id)) {
      iconsById.set(icon.id, icon);
    }
  }

  return {
    customIcons: Array.from(iconsById.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_CUSTOM_ICONS),
    deletedCustomIconIds: Array.from(deletedIds)
      .filter((id) => !iconsById.has(id))
      .slice(0, MAX_DELETED_CUSTOM_ICON_IDS),
  };
}

export function mergeUnifiedSavePatches(
  left: UnifiedSavePatch | undefined,
  right: UnifiedSavePatch | undefined,
): UnifiedSavePatch | undefined {
  if (!left) return right;
  if (!right) return left;

  return {
    customIcons: left.customIcons || right.customIcons || undefined,
    ai: {
      sessions: left.ai?.sessions || right.ai?.sessions || undefined,
      providers: left.ai?.providers || right.ai?.providers || undefined,
    },
    settings: {
      ...left.settings,
      ...right.settings,
      markdown: left.settings?.markdown || right.settings?.markdown
        ? {
            ...left.settings?.markdown,
            ...right.settings?.markdown,
            codeBlock: left.settings?.markdown?.codeBlock || right.settings?.markdown?.codeBlock
              ? {
                  ...left.settings?.markdown?.codeBlock,
                  ...right.settings?.markdown?.codeBlock,
                }
              : undefined,
            body: left.settings?.markdown?.body || right.settings?.markdown?.body
              ? {
                  ...left.settings?.markdown?.body,
                  ...right.settings?.markdown?.body,
                }
              : undefined,
            theme: left.settings?.markdown?.theme || right.settings?.markdown?.theme
              ? {
                  ...left.settings?.markdown?.theme,
                  ...right.settings?.markdown?.theme,
                }
              : undefined,
          }
        : undefined,
      ui: left.settings?.ui || right.settings?.ui
        ? {
            ...left.settings?.ui,
            ...right.settings?.ui,
          }
        : undefined,
    },
  };
}

export function serializeBoundedMainDataFile(mainFile: DataFile): string {
  let data = mainFile.data as UnifiedData;
  let customIcons = normalizeCustomIconList(data.customIcons);
  let deletedCustomIconIds = normalizeDeletedCustomIconIds(data.deletedCustomIconIds);

  const serialize = () => JSON.stringify({
    ...mainFile,
    data: {
      ...data,
      customIcons,
      deletedCustomIconIds,
    },
  }, null, 2);

  let payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  customIcons = trimArrayForSerializedLimit(customIcons, MAX_MAIN_DATA_BYTES, (nextIcons) => {
    customIcons = nextIcons;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  deletedCustomIconIds = trimArrayForSerializedLimit(deletedCustomIconIds, MAX_MAIN_DATA_BYTES, (nextIds) => {
    deletedCustomIconIds = nextIds;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  data = {
    ...data,
    customIcons: [],
    deletedCustomIconIds: [],
  };
  customIcons = [];
  deletedCustomIconIds = [];
  return serialize();
}

export function mergeSettingsForSafeSave(
  incomingSettings: UnifiedData['settings'],
  existingSettings: UnifiedData['settings'] | undefined,
  patch: UnifiedSavePatch | undefined,
): UnifiedData['settings'] {
  const baseSettings = existingSettings || incomingSettings;
  if (!patch?.settings) {
    return baseSettings;
  }

  return {
    ...baseSettings,
    ...(patch.settings.timezone ? { timezone: patch.settings.timezone } : {}),
    markdown: patch.settings.markdown
      ? {
          ...baseSettings.markdown,
          ...patch.settings.markdown,
          codeBlock: patch.settings.markdown.codeBlock
            ? {
                ...baseSettings.markdown.codeBlock,
                ...patch.settings.markdown.codeBlock,
              }
            : baseSettings.markdown.codeBlock,
          body: patch.settings.markdown.body
            ? {
                ...baseSettings.markdown.body,
                ...patch.settings.markdown.body,
              }
            : baseSettings.markdown.body,
          theme: patch.settings.markdown.theme
            ? {
                ...baseSettings.markdown.theme,
                ...patch.settings.markdown.theme,
              }
            : baseSettings.markdown.theme,
        }
      : baseSettings.markdown,
    ui: patch.settings.ui
      ? {
          ...baseSettings.ui,
          ...patch.settings.ui,
        }
      : baseSettings.ui,
  };
}
