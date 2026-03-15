import type { RefObject } from 'react';
import { ModelSelector } from '@/components/Chat/features/Input/ModelSelector';

interface AiToolbarModelSelectorProps {
  composerInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function AiToolbarModelSelector({ composerInputRef }: AiToolbarModelSelectorProps) {
  return (
    <ModelSelector
      composerInputRef={composerInputRef ?? { current: null }}
      dropdownPlacement="bottom"
    />
  );
}
