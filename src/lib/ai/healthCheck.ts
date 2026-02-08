import { openaiClient } from './providers/openai';
import type { AIModel, Provider } from './types';

export interface HealthCheckResult {
  status: 'success' | 'error';
  latency?: number;
  error?: string;
}

export async function checkModelHealth(
  provider: Provider,
  model: AIModel
): Promise<HealthCheckResult> {
  const start = performance.now();
  const controller = new AbortController();
  let hasReceivedData = false;
  
  // 15s Timeout
  const timeoutId = setTimeout(() => {
      controller.abort();
  }, 15000);

  try {
    await openaiClient.sendMessage(
      'hi', 
      [],
      model,
      provider,
      (chunk) => {
        if (chunk && !hasReceivedData) {
            hasReceivedData = true;
            clearTimeout(timeoutId);
            // Success! Abort immediately to save tokens.
            controller.abort(); 
        }
      },
      controller.signal
      // No options passed - rely on defaults and abort for max compatibility
    );
    
    // If completed without abort (unlikely for 'hi' but possible if very short), success
    return { status: 'success', latency: Math.round(performance.now() - start) };

  } catch (error: any) {
      clearTimeout(timeoutId);

      // If we aborted because we got data, it's a success
      if (hasReceivedData && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
           return { status: 'success', latency: Math.round(performance.now() - start) };
      }
      
      // If aborted but NO data, it's a timeout
      if (!hasReceivedData && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
          return { status: 'error', error: 'Request timed out (15s)' };
      }

      return { 
          status: 'error', 
          error: error.message || 'Unknown error' 
      };
  }
}
