export interface DuplicateLabelCandidate {
  id: string;
  label: string;
  hintSegments: readonly string[];
}

function normalizeLabel(label: string) {
  return label.trim().toLocaleLowerCase();
}

function buildSuffixHint(
  segments: readonly string[],
  depth: number
) {
  const nonEmptySegments = segments.filter((segment) => segment.trim().length > 0);
  return nonEmptySegments.slice(-depth).join(' / ');
}

function buildGroupDisambiguationRegistry(
  candidates: readonly DuplicateLabelCandidate[]
) {
  const maxDepth = Math.max(
    ...candidates.map((candidate) => candidate.hintSegments.filter((segment) => segment.trim().length > 0).length),
    1
  );

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const seen = new Set<string>();
    const nextRegistry = new Map<string, string>();
    let hasConflict = false;

    for (const candidate of candidates) {
      const hint = buildSuffixHint(candidate.hintSegments, depth);
      nextRegistry.set(candidate.id, hint);
      if (!hint || seen.has(hint)) {
        hasConflict = true;
      }
      seen.add(hint);
    }

    if (!hasConflict) {
      return nextRegistry;
    }
  }

  return new Map(
    candidates.map((candidate) => [candidate.id, buildSuffixHint(candidate.hintSegments, maxDepth)])
  );
}

export function buildDuplicateLabelRegistry(
  candidates: readonly DuplicateLabelCandidate[]
) {
  const groups = new Map<string, DuplicateLabelCandidate[]>();

  for (const candidate of candidates) {
    const normalizedLabel = normalizeLabel(candidate.label);
    const existing = groups.get(normalizedLabel);
    if (existing) {
      existing.push(candidate);
      continue;
    }
    groups.set(normalizedLabel, [candidate]);
  }

  const registry = new Map<string, string>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const groupRegistry = buildGroupDisambiguationRegistry(group);
    for (const [id, hint] of groupRegistry) {
      if (hint) {
        registry.set(id, hint);
      }
    }
  }

  return registry;
}
