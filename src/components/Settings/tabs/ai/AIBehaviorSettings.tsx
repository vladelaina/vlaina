import { useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { SettingsToggle } from '@/components/Settings/components/SettingsControls';

const SYSTEM_PROMPT_MAX_LENGTH = 4000;

export function AIBehaviorSettings() {
  const {
    customSystemPrompt,
    setCustomSystemPrompt,
    includeTimeContext,
    setIncludeTimeContext
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
    <section className="mb-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-white/5 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">System Prompt</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          This instruction is automatically sent with every AI request.
        </p>
      </div>

      <textarea
        value={draftSystemPrompt}
        onChange={(event) => {
          isEditingPromptRef.current = true;
          setDraftSystemPrompt(event.target.value);
        }}
        onBlur={commitPromptDraft}
        maxLength={SYSTEM_PROMPT_MAX_LENGTH}
        rows={5}
        placeholder="Example: Reply in concise Chinese and keep markdown output clean."
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-gray-500/20 resize-y min-h-[110px]"
      />

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Send Current Time</div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Include current date/time in requests. Enabled by default.
          </p>
        </div>
        <SettingsToggle checked={includeTimeContext} onChange={setIncludeTimeContext} />
      </div>
    </section>
  );
}
