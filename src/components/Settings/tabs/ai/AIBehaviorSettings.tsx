import { useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SettingsTextarea } from '@/components/Settings/components/SettingsFields';
import { SettingsItem, SettingsToggle } from '@/components/Settings/components/SettingsControls';

const SYSTEM_PROMPT_MAX_LENGTH = 4000;

export function AIBehaviorSettings() {
  const {
    customSystemPrompt,
    setCustomSystemPrompt,
    webSearchEnabled,
    setWebSearchEnabled,
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
    <section className="mx-auto mb-7 max-w-5xl">
      <div className="mb-3 px-1">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">System Prompt</h3>
      </div>

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
        textareaClassName="max-h-[320px]"
      />

      <div className="mt-4 rounded-lg border border-zinc-100 px-4 dark:border-white/5">
        <SettingsItem
          title="Web Search"
          description="Allow chat models to search the web and read selected pages through the built-in search service."
        >
          <SettingsToggle checked={webSearchEnabled} onChange={setWebSearchEnabled} />
        </SettingsItem>
      </div>
    </section>
  );
}
