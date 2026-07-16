import { afterEach, describe, expect, it } from 'vitest';
import { requestManager } from '@/lib/ai/requestManager';
import { canPersistAbortedRequestTranscript } from './requestLifecycle';

const SESSION_ID = 'cancelled-transcript-session';

describe('cancelled request transcript persistence', () => {
  afterEach(() => {
    requestManager.finish(SESSION_ID);
  });

  it('allows the final cancellation update only until a replacement request starts', () => {
    const cancelledController = requestManager.start(SESSION_ID);
    requestManager.abort(SESSION_ID);

    expect(canPersistAbortedRequestTranscript(SESSION_ID, cancelledController)).toBe(true);

    const replacementController = requestManager.start(SESSION_ID);
    expect(canPersistAbortedRequestTranscript(SESSION_ID, cancelledController)).toBe(false);
    requestManager.finish(SESSION_ID, replacementController);
    expect(canPersistAbortedRequestTranscript(SESSION_ID, cancelledController)).toBe(false);
  });
});
