const MAX_MERGE_LINES = 4000;
const MAX_MERGE_CELLS = 4_000_000;

interface ChangeHunk {
  start: number;
  end: number;
  lines: string[];
}

function splitLines(content: string): string[] {
  return content.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function diffLines(base: string[], changed: string[]): ChangeHunk[] | null {
  if (base.length > MAX_MERGE_LINES || changed.length > MAX_MERGE_LINES) {
    return null;
  }
  if (base.length * changed.length > MAX_MERGE_CELLS) {
    return null;
  }

  const width = changed.length + 1;
  const table = new Uint16Array((base.length + 1) * width);
  for (let baseIndex = base.length - 1; baseIndex >= 0; baseIndex -= 1) {
    for (let changedIndex = changed.length - 1; changedIndex >= 0; changedIndex -= 1) {
      const cell = baseIndex * width + changedIndex;
      if (base[baseIndex] === changed[changedIndex]) {
        table[cell] = table[(baseIndex + 1) * width + changedIndex + 1] + 1;
      } else {
        table[cell] = Math.max(
          table[(baseIndex + 1) * width + changedIndex],
          table[baseIndex * width + changedIndex + 1],
        );
      }
    }
  }

  const hunks: ChangeHunk[] = [];
  let baseIndex = 0;
  let changedIndex = 0;
  let pending: ChangeHunk | null = null;

  const ensurePending = () => {
    if (!pending) {
      pending = { start: baseIndex, end: baseIndex, lines: [] };
    }
    return pending;
  };
  const flushPending = () => {
    if (pending) {
      hunks.push(pending);
      pending = null;
    }
  };

  while (baseIndex < base.length && changedIndex < changed.length) {
    if (base[baseIndex] === changed[changedIndex]) {
      flushPending();
      baseIndex += 1;
      changedIndex += 1;
      continue;
    }

    if (
      table[(baseIndex + 1) * width + changedIndex] >=
      table[baseIndex * width + changedIndex + 1]
    ) {
      ensurePending().end = baseIndex + 1;
      baseIndex += 1;
    } else {
      ensurePending().lines.push(changed[changedIndex] ?? '');
      changedIndex += 1;
    }
  }

  if (baseIndex < base.length || changedIndex < changed.length) {
    const hunk = ensurePending();
    hunk.end = base.length;
    hunk.lines.push(...changed.slice(changedIndex));
  }
  flushPending();

  return hunks;
}

function hunksOverlap(left: ChangeHunk, right: ChangeHunk): boolean {
  if (left.start === left.end && right.start === right.end) {
    return left.start === right.start;
  }
  return left.start < right.end && right.start < left.end;
}

export function mergeNonConflictingNoteChanges(
  baseContent: string,
  localContent: string,
  diskContent: string,
): string | null {
  if (localContent === diskContent) {
    return localContent;
  }
  if (baseContent === localContent) {
    return diskContent;
  }
  if (baseContent === diskContent) {
    return localContent;
  }

  const baseLines = splitLines(baseContent);
  const localHunks = diffLines(baseLines, splitLines(localContent));
  const diskHunks = diffLines(baseLines, splitLines(diskContent));
  if (!localHunks || !diskHunks) {
    return null;
  }

  for (const localHunk of localHunks) {
    for (const diskHunk of diskHunks) {
      if (!hunksOverlap(localHunk, diskHunk)) {
        continue;
      }
      const sameReplacement =
        localHunk.start === diskHunk.start &&
        localHunk.end === diskHunk.end &&
        localHunk.lines.join('') === diskHunk.lines.join('');
      if (!sameReplacement) {
        return null;
      }
    }
  }

  const mergedLines: string[] = [];
  const allHunks = [...localHunks, ...diskHunks]
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let baseIndex = 0;
  let hunkIndex = 0;

  while (hunkIndex < allHunks.length) {
    const hunk = allHunks[hunkIndex];
    mergedLines.push(...baseLines.slice(baseIndex, hunk.start), ...hunk.lines);
    baseIndex = hunk.end;
    hunkIndex += 1;
    while (
      hunkIndex < allHunks.length &&
      allHunks[hunkIndex].start === hunk.start &&
      allHunks[hunkIndex].end === hunk.end &&
      allHunks[hunkIndex].lines.join('') === hunk.lines.join('')
    ) {
      hunkIndex += 1;
    }
  }

  mergedLines.push(...baseLines.slice(baseIndex));
  return mergedLines.join('');
}
