import { useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SettingsTextarea } from '@/components/Settings/components/SettingsFields';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';

const SYSTEM_PROMPT_MAX_LENGTH = 4000;

export function AIBehaviorSettings() {
  const {
    customSystemPrompt,
    setCustomSystemPrompt,
  } = useAIStore();
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(customSystemPrompt);
  const isEditingPromptRef = useRef(false);
  const latestDraftRef = useRef(draftSystemPrompt);
  const latestPersistedPromptRef = useRef(customSystemPrompt);

  useEffect(() => {
    latestDraftRef.current = draftSystemPrompt;
  }, [draftSystemPrompt]);

  useEffect(() => {
    latestPersistedPromptRef.current = customSystemPrompt;
    if (!isEditingPromptRef.current) {
      setDraftSystemPrompt(customSystemPrompt);
    }
  }, [customSystemPrompt]);

  useEffect(() => {
    return () => {
      if (!isEditingPromptRef.current) return;
      const latestDraft = latestDraftRef.current;
      const latestPersistedPrompt = latestPersistedPromptRef.current;
      if (latestDraft !== latestPersistedPrompt) {
        setCustomSystemPrompt(latestDraft);
      }
    };
  }, [setCustomSystemPrompt]);

  const commitPromptDraft = () => {
    if (draftSystemPrompt !== customSystemPrompt) {
      setCustomSystemPrompt(draftSystemPrompt);
    }
    isEditingPromptRef.current = false;
  };

  return (
    <section className="mx-auto mb-10 max-w-5xl">
      <div className="mb-4 px-1">
        <h3 className="text-[14px] font-bold text-[var(--notes-sidebar-text)] tracking-tight">System Prompt</h3>
      </div>

      <div className={cn("overflow-hidden rounded-[26px] p-2", chatComposerPillSurfaceClass)}>
        <SettingsTextarea
          autoGrow={true}
          value={draftSystemPrompt}
          onChange={(event) => {
            isEditingPromptRef.current = true;
            setDraftSystemPrompt(event.target.value);
          }}
          onBlur={commitPromptDraft}
          maxLength={SYSTEM_PROMPT_MAX_LENGTH}
          rows={1}
          placeholder="Style, tone, or other response preferences"
          textareaClassName="max-h-[320px] bg-transparent border-0 ring-0 focus:ring-0 text-[14px] px-4 py-3 text-[var(--notes-sidebar-text)]"
          shellClassName="border-0 shadow-none bg-transparent dark:bg-transparent"
        />
      </div>
    </section>
  );
}
