import type { RefObject } from 'react';
import { ModelSelector } from '@/components/Chat/features/Input/ModelSelector';

interface AiToolbarModelSelectorProps {
  composerInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onSelectModel?: (modelId: string) => void;
}

export function AiToolbarModelSelector({
  composerInputRef,
  onSelectModel,
}: AiToolbarModelSelectorProps) {
  return (
    <ModelSelector
      composerInputRef={composerInputRef ?? { current: null }}
      dropdownPlacement="top"
      onSelectModel={onSelectModel}
      theme="notes"
    />
  );
}
