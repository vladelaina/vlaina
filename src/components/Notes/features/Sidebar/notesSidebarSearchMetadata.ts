import type { NotesSidebarSearchEntry } from './notesSidebarSearchResults';

const SEARCH_ENTRY_METADATA = Symbol('notesSidebarSearchEntryMetadata');
const SEARCH_INDEX_METADATA = Symbol('notesSidebarSearchIndexMetadata');
const MAX_SEARCH_METADATA_FIELD_CHARS = 4096;

interface NotesSidebarSearchEntryMetadata {
  lowerName: string;
  lowerNameStartOffsets: number[];
  lowerPreview: string;
  lowerPreviewStartOffsets: number[];
}

interface NotesSidebarSearchIndexMetadata {
  contentEntriesByPath: NotesSidebarSearchEntry[];
}

type MetadataSearchEntry = NotesSidebarSearchEntry & {
  [SEARCH_ENTRY_METADATA]?: NotesSidebarSearchEntryMetadata;
};

type MetadataSearchIndex = NotesSidebarSearchEntry[] & {
  [SEARCH_INDEX_METADATA]?: NotesSidebarSearchIndexMetadata;
};

function getSearchMetadataField(value: string): string {
  return value.length > MAX_SEARCH_METADATA_FIELD_CHARS
    ? value.slice(0, MAX_SEARCH_METADATA_FIELD_CHARS)
    : value;
}

export function attachSearchEntryMetadata(entry: NotesSidebarSearchEntry): NotesSidebarSearchEntry {
  const normalizedName = normalizeSearchTextWithOffsets(getSearchMetadataField(entry.name));
  const normalizedPreview = normalizeSearchTextWithOffsets(getSearchMetadataField(entry.preview));
  Object.defineProperty(entry, SEARCH_ENTRY_METADATA, {
    configurable: true,
    enumerable: false,
    value: {
      lowerName: normalizedName.text,
      lowerNameStartOffsets: normalizedName.startOffsets,
      lowerPreview: normalizedPreview.text,
      lowerPreviewStartOffsets: normalizedPreview.startOffsets,
    } satisfies NotesSidebarSearchEntryMetadata,
  });

  return entry;
}

export function attachSearchIndexMetadata(index: NotesSidebarSearchEntry[]): NotesSidebarSearchEntry[] {
  const contentEntriesByPath = index
    .filter((entry) => entry.contentSearchable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));

  Object.defineProperty(index, SEARCH_INDEX_METADATA, {
    configurable: true,
    enumerable: false,
    value: {
      contentEntriesByPath,
    } satisfies NotesSidebarSearchIndexMetadata,
  });

  return index;
}

export function getSearchEntryMetadata(entry: NotesSidebarSearchEntry): NotesSidebarSearchEntryMetadata {
  const metadata = (entry as MetadataSearchEntry)[SEARCH_ENTRY_METADATA];
  if (metadata) {
    return metadata;
  }

  const normalizedName = normalizeSearchTextWithOffsets(getSearchMetadataField(entry.name));
  const normalizedPreview = normalizeSearchTextWithOffsets(getSearchMetadataField(entry.preview));
  return {
    lowerName: normalizedName.text,
    lowerNameStartOffsets: normalizedName.startOffsets,
    lowerPreview: normalizedPreview.text,
    lowerPreviewStartOffsets: normalizedPreview.startOffsets,
  };
}

function normalizeSearchTextWithOffsets(value: string): {
  text: string;
  startOffsets: number[];
} {
  let text = '';
  const startOffsets: number[] = [];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
    }

    text += normalized;
    index += sourceLength;
  }

  startOffsets[text.length] = value.length;

  return { text, startOffsets };
}

export function getContentSearchEntriesByPath(index: NotesSidebarSearchEntry[]): NotesSidebarSearchEntry[] {
  const metadata = (index as MetadataSearchIndex)[SEARCH_INDEX_METADATA];
  if (metadata) {
    return metadata.contentEntriesByPath;
  }

  return index
    .filter((entry) => entry.contentSearchable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));
}
