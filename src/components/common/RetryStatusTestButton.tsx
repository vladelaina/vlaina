import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { requestManager } from '@/lib/ai/requestManager';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { AIErrorType, type AIModel, type Provider } from '@/lib/ai/types';
import { sendMessageWithEndpointFallback } from '@/hooks/chatService/sendMessageWithEndpointFallback';

const TEST_RETRY_ERROR = 'Service unavailable';
let activePreviewCleanup: (() => void) | null = null;

const TEST_PROVIDER_ID = 'vlaina-retry-test-provider';
const TEST_MODEL_ID = 'vlaina-retry-test-model';

function createTestProvider(): Provider {
  const now = Date.now();
  return {
    id: TEST_PROVIDER_ID,
    name: 'Retry test',
    type: 'newapi',
    endpointType: 'openai',
    endpointTypeCheckedAt: now,
    apiHost: 'https://retry-test.invalid/v1',
    apiKey: 'sk-test',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestModel(providerId: string): AIModel {
  return {
    id: TEST_MODEL_ID,
    apiModelId: TEST_MODEL_ID,
    name: 'Retry test',
    providerId,
    endpointType: 'openai',
    endpointTypeCheckedAt: Date.now(),
    enabled: true,
    createdAt: Date.now(),
  };
}

interface RetryStatusTestButtonProps {
  embedded?: boolean;
  onTriggered?: () => void;
}

export function RetryStatusTestButton({ embedded = false, onTriggered }: RetryStatusTestButtonProps) {
  const { t } = useI18n();
  const [isRunning, setIsRunning] = useState(false);
  const mountedRef = useRef(true);
  const simulatedClient = useMemo(() => ({
    sendMessage: async () => {
      throw {
        type: AIErrorType.SERVER_ERROR,
        message: TEST_RETRY_ERROR,
        statusCode: 503,
      };
    },
  }), []);

  const cleanupActivePreview = () => {
    activePreviewCleanup?.();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleClick = () => {
    cleanupActivePreview();

    const ai = useUnifiedStore.getState().data.ai;
    if (!ai) {
      return;
    }

    const sessionId = useAIUIStore.getState().currentSessionId || aiActions.createSession();
    const selectedModel = ai.models.find((model) => model.id === ai.selectedModelId) || ai.models[0];
    const selectedProvider = selectedModel
      ? ai.providers.find((provider) => provider.id === selectedModel.providerId)
      : undefined;
    const provider = selectedProvider || createTestProvider();
    const model = selectedModel || createTestModel(provider.id);
    const messageId = aiActions.addMessage({
      role: 'assistant',
      content: '',
      modelId: model.id,
    }, sessionId, {
      persistUnified: false,
      touchSession: false,
    });
    if (!messageId) {
      return;
    }

    const controller = requestManager.start(sessionId);
    const uiState = useAIUIStore.getState();
    uiState.setSessionLoading(sessionId, true);
    let didFinish = false;
    const finishPreview = () => {
      if (didFinish) {
        return;
      }
      didFinish = true;
      requestManager.finish(sessionId, controller);
      useAIUIStore.getState().setSessionLoading(sessionId, false);
      aiActions.completeMessage(sessionId, messageId);
      if (mountedRef.current) {
        setIsRunning(false);
      }
      if (activePreviewCleanup === finishPreview) {
        activePreviewCleanup = null;
      }
    };

    setIsRunning(true);
    onTriggered?.();
    focusComposerInput();
    activePreviewCleanup = () => {
      requestManager.abort(sessionId);
    };
    void sendMessageWithEndpointFallback({
      content: '',
      history: [],
      model,
      provider,
      onChunk: () => {},
      signal: controller.signal,
      client: simulatedClient,
      updateProvider: () => {},
      updateModel: () => {},
      retryDelayMs: 0,
      options: {
        onRetryStatus: (message) => {
          if (!requestManager.isCurrent(sessionId, controller) || controller.signal.aborted) {
            return;
          }
          aiActions.updateMessage(sessionId, messageId, message);
        },
      },
    }).catch(() => {
    }).finally(finishPreview);
  };

  const label = t('chat.retryTestButton');
  const positionClass = embedded
    ? ''
    : 'fixed bottom-[var(--vlaina-size-16px)] right-[var(--vlaina-size-16px)] z-[var(--vlaina-z-50)] shadow-[var(--vlaina-shadow-floating-panel)]';

  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      data-retry-status-test-button
      className={`max-w-[calc(100vw-var(--vlaina-size-32px))] ${embedded ? 'w-full justify-start' : ''} ${positionClass}`}
      disabled={isRunning}
      onClick={handleClick}
    >
      <span className="truncate">{label}</span>
    </Button>
  );
}
