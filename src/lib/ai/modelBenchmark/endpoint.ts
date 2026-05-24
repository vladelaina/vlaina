import type { BenchmarkEndpoint } from './types';
import { isStandaloneImageGenerationModel } from '../modelCapabilities';

const EMBEDDING_MODEL_HINTS = ['embedding', 'bge-', 'm3e', 'text-embedding'];
const RESPONSES_MODEL_HINTS = ['codex'];

function includesAnyHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

export function inferBenchmarkEndpoint(modelId: string): BenchmarkEndpoint {
  const lowerModelId = modelId.toLowerCase();

  if (includesAnyHint(lowerModelId, EMBEDDING_MODEL_HINTS)) {
    return 'embeddings';
  }

  if (includesAnyHint(lowerModelId, RESPONSES_MODEL_HINTS)) {
    return 'responses';
  }

  if (isStandaloneImageGenerationModel({ apiModelId: modelId, name: modelId })) {
    return 'image';
  }

  return 'chat';
}
