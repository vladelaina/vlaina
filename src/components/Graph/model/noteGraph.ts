import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import {
  getMarkdownLinkHref,
  MARKDOWN_LINK_PATTERN_GLOBAL,
} from '@/lib/notes/markdown/markdownLinkParser';
import { collectMarkdownReferenceLinkDestinations } from '@/lib/notes/markdown/markdownReferenceLinkStyle';
import { stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import {
  getNoteMarkdownExcludedRanges,
  isNoteMarkdownIndexExcluded,
} from '@/lib/notes/tags';
import type { FileTreeNode, NoteContentCacheEntry } from '@/stores/notes/types';

export const MAX_GRAPH_NODES = 240;
export const MAX_GRAPH_EDGES = 4_000;
const MAX_GRAPH_CANDIDATE_NODES = 5_000;

const WIKI_LINK_PATTERN = /\[\[([^\]\n]{1,512})\]\]/g;
const EXTERNAL_LINK_TARGET_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

export interface NoteGraphNode {
  id: string;
  label: string;
  degree: number;
}

export interface NoteGraphEdge {
  source: string;
  target: string;
}

export interface NoteGraph {
  nodes: NoteGraphNode[];
  edges: NoteGraphEdge[];
}

export interface NoteGraphScanInput {
  key: string;
  priorityPaths: string[];
}

let graphBuildCache: {
  fileTree: readonly FileTreeNode[];
  noteContentsCache: ReadonlyMap<string, NoteContentCacheEntry>;
  revision: number;
  graph: NoteGraph;
} | null = null;

function collectNotePaths(nodes: readonly FileTreeNode[], limit: number): string[] {
  const paths: string[] = [];
  const stack = [...nodes].reverse();

  while (stack.length > 0 && paths.length < limit) {
    const node = stack.pop()!;
    if (node.isFolder) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]!);
      }
      continue;
    }
    if (node.kind !== 'image') paths.push(node.path);
  }

  return paths.sort((left, right) => left.localeCompare(right));
}

export function createNoteGraphScanInput(nodes: readonly FileTreeNode[]): NoteGraphScanInput {
  const candidatePaths = collectNotePaths(nodes, MAX_GRAPH_CANDIDATE_NODES);
  return {
    key: candidatePaths.join('\0'),
    priorityPaths: candidatePaths.slice(0, MAX_GRAPH_NODES),
  };
}

function selectVisibleGraphPaths(
  paths: readonly string[],
  edges: readonly NoteGraphEdge[],
): string[] {
  if (paths.length <= MAX_GRAPH_NODES) return [...paths];

  const degreeByPath = new Map(paths.map((path) => [path, 0]));
  for (const edge of edges) {
    degreeByPath.set(edge.source, (degreeByPath.get(edge.source) ?? 0) + 1);
    degreeByPath.set(edge.target, (degreeByPath.get(edge.target) ?? 0) + 1);
  }

  return [...paths]
    .sort((left, right) => (
      (degreeByPath.get(right) ?? 0) - (degreeByPath.get(left) ?? 0)
      || left.localeCompare(right)
    ))
    .slice(0, MAX_GRAPH_NODES)
    .sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return '';
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

function withoutExtension(path: string): string {
  return stripSupportedMarkdownExtension(path).toLocaleLowerCase();
}

function sourceDirectory(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  return slashIndex < 0 ? '' : path.slice(0, slashIndex);
}

function decodeLinkTarget(value: string): string {
  const rawTarget = value.split('#', 1)[0]?.split('?', 1)[0]?.trim() ?? '';
  if (EXTERNAL_LINK_TARGET_PATTERN.test(rawTarget)) return '';
  if (!rawTarget) return '';
  try {
    return decodeURIComponent(rawTarget);
  } catch {
    return rawTarget;
  }
}

function createTargetResolver(paths: readonly string[]) {
  const pathByKey = new Map(paths.map((path) => [withoutExtension(normalizePath(path)), path]));
  const pathsByTitle = new Map<string, string[]>();
  for (const path of paths) {
    const title = getNoteTitleFromPath(path).toLocaleLowerCase();
    const titlePaths = pathsByTitle.get(title);
    if (titlePaths) titlePaths.push(path);
    else pathsByTitle.set(title, [path]);
  }

  return (sourcePath: string, rawTarget: string): string | null => {
    const target = decodeLinkTarget(rawTarget);
    if (!target) return null;

    const relativeCandidate = normalizePath([sourceDirectory(sourcePath), target].filter(Boolean).join('/'));
    const relativeMatch = pathByKey.get(withoutExtension(relativeCandidate));
    if (relativeMatch) return relativeMatch;

    const rootMatch = pathByKey.get(withoutExtension(normalizePath(target)));
    if (rootMatch) return rootMatch;

    const titleMatches = pathsByTitle.get(getNoteTitleFromPath(target).toLocaleLowerCase()) ?? [];
    if (titleMatches.length < 2) return titleMatches[0] ?? null;
    const currentDirectory = sourceDirectory(sourcePath);
    return [...titleMatches].sort((left, right) => {
      const leftIsLocal = sourceDirectory(left) === currentDirectory;
      const rightIsLocal = sourceDirectory(right) === currentDirectory;
      if (leftIsLocal !== rightIsLocal) return leftIsLocal ? -1 : 1;
      const leftDepth = normalizePath(left).split('/').length;
      const rightDepth = normalizePath(right).split('/').length;
      return leftDepth - rightDepth || left.localeCompare(right);
    })[0] ?? null;
  };
}

function collectLinkedTargets(
  content: string,
  resolveTarget: (rawTarget: string) => string | null,
): string[] {
  const targets: string[] = [];
  const excludedRanges = getNoteMarkdownExcludedRanges(content, { excludeFrontmatter: false });
  let excludedRangeCursor = 0;
  WIKI_LINK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = WIKI_LINK_PATTERN.exec(content)) !== null) {
    while (
      excludedRangeCursor < excludedRanges.length &&
      excludedRanges[excludedRangeCursor]!.to <= match.index
    ) {
      excludedRangeCursor += 1;
    }
    if (isNoteMarkdownIndexExcluded(match.index, excludedRanges, excludedRangeCursor)) continue;

    const target = resolveTarget(match[1]!.split('|', 1)[0] ?? '');
    if (target) targets.push(target);
  }

  excludedRangeCursor = 0;
  MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;
  while ((match = MARKDOWN_LINK_PATTERN_GLOBAL.exec(content)) !== null) {
    while (
      excludedRangeCursor < excludedRanges.length
      && excludedRanges[excludedRangeCursor]!.to <= match.index
    ) {
      excludedRangeCursor += 1;
    }
    if (
      content[match.index - 1] === '!'
      || isNoteMarkdownIndexExcluded(match.index, excludedRanges, excludedRangeCursor)
    ) {
      continue;
    }

    const target = resolveTarget(getMarkdownLinkHref(match[2] ?? ''));
    if (target) targets.push(target);
  }

  for (const destination of collectMarkdownReferenceLinkDestinations(content)) {
    const target = resolveTarget(destination);
    if (target) targets.push(target);
  }

  return targets;
}

export function buildNoteGraph(
  fileTree: readonly FileTreeNode[],
  noteContentsCache: ReadonlyMap<string, NoteContentCacheEntry>,
  revision?: number,
): NoteGraph {
  if (
    revision !== undefined
    && graphBuildCache?.fileTree === fileTree
    && graphBuildCache.noteContentsCache === noteContentsCache
    && graphBuildCache.revision === revision
  ) {
    return graphBuildCache.graph;
  }

  const candidatePaths = collectNotePaths(fileTree, MAX_GRAPH_CANDIDATE_NODES);
  const candidatePathSet = new Set(candidatePaths);
  const resolveTargetForPath = createTargetResolver(candidatePaths);
  const edgeKeys = new Set<string>();
  const candidateEdges: NoteGraphEdge[] = [];

  for (const source of candidatePaths) {
    if (candidateEdges.length >= MAX_GRAPH_EDGES) break;
    const content = noteContentsCache.get(source)?.content;
    if (!content?.includes('[')) continue;

    for (const target of collectLinkedTargets(content, (rawTarget) => resolveTargetForPath(source, rawTarget))) {
      if (target === source || !candidatePathSet.has(target)) continue;
      const [left, right] = source < target ? [source, target] : [target, source];
      const key = `${left}\n${right}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      candidateEdges.push({ source: left, target: right });
      if (candidateEdges.length >= MAX_GRAPH_EDGES) break;
    }
  }

  const paths = selectVisibleGraphPaths(candidatePaths, candidateEdges);
  const pathSet = new Set(paths);
  const edges = candidateEdges.filter(
    (edge) => pathSet.has(edge.source) && pathSet.has(edge.target),
  );
  const degreeByPath = new Map(paths.map((path) => [path, 0]));
  for (const edge of edges) {
    degreeByPath.set(edge.source, (degreeByPath.get(edge.source) ?? 0) + 1);
    degreeByPath.set(edge.target, (degreeByPath.get(edge.target) ?? 0) + 1);
  }

  const graph = {
    nodes: paths.map((path) => ({
      id: path,
      label: getNoteTitleFromPath(path),
      degree: degreeByPath.get(path) ?? 0,
    })),
    edges,
  };
  if (revision !== undefined) {
    graphBuildCache = { fileTree, noteContentsCache, revision, graph };
  }
  return graph;
}
