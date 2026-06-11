import { expect, test } from '@playwright/test';
import http from 'node:http';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_MESSAGE_SELECTOR,
  CHAT_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  createChatModelFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

const STREAM_CHUNK_DELAY_MS = 8;
const STREAM_CHUNK_SIZE = 22;

const STREAM_RESPONSE = [
  '# Streaming animation probe',
  '',
  'This response is intentionally shaped like a normal assistant answer. It mixes paragraphs, lists, inline code, fenced code and a small table so the renderer has to update real Markdown structure while the stream is still active.',
  '',
  '- First point arrives while the paragraph is still settling.',
  '- Second point includes `inline code` and **strong text**.',
  '- Third point is long enough to wrap across multiple visual lines inside the chat column, which catches layout and span animation churn.',
  '',
  '```ts',
  'type Result = {',
  '  id: string;',
  '  status: "streaming" | "done";',
  '};',
  '',
  'export function summarize(result: Result) {',
  '  return `${result.id}:${result.status}`;',
  '}',
  '```',
  '',
  '| phase | expectation |',
  '| --- | --- |',
  '| stream | text grows monotonically |',
  '| render | no excessive active animation nodes |',
  '| done | E2E_STREAM_DONE |',
  '',
  'Final paragraph: the stream should finish cleanly, remove live animation wrappers, and keep the completed answer readable without a late flicker. E2E_STREAM_DONE',
].join('\n');

type StreamProbeMetrics = {
  changedTextSamples: number;
  finalActiveStreamChars: number;
  finalLiveSurfaces: number;
  finalText: string;
  frameCount: number;
  longFramesOver50: number;
  longFramesOver100: number;
  maxActiveStreamChars: number;
  maxFrameMs: number;
  maxHeightDelta: number;
  maxLiveSurfaces: number;
  p95FrameMs: number;
  textReversals: number;
};

async function createStreamingProviderServer(content: string): Promise<{
  close: () => Promise<void>;
  requests: () => Array<{ body: string; url: string }>;
  url: string;
}> {
  const requests: Array<{ body: string; url: string }> = [];
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404);
      response.end();
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push({ body, url: request.url ?? '' });
      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      });

      let offset = 0;
      const timer = setInterval(() => {
        if (offset >= content.length) {
          clearInterval(timer);
          response.write('data: [DONE]\n\n');
          response.end();
          return;
        }

        const chunk = content.slice(offset, offset + STREAM_CHUNK_SIZE);
        offset += STREAM_CHUNK_SIZE;
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }, STREAM_CHUNK_DELAY_MS);

      response.on('close', () => {
        clearInterval(timer);
      });
      request.on('aborted', () => {
        clearInterval(timer);
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate streaming provider port.');
  }

  return {
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    requests: () => requests.slice(),
    url: `http://127.0.0.1:${address.port}/v1`,
  };
}

test.describe('chat streaming animation', () => {
  test.setTimeout(120_000);

  test('keeps streamed markdown animation bounded with a local provider stream', async () => {
    const provider = await createStreamingProviderServer(STREAM_RESPONSE);
    const { app, userDataRoot } = await launchIsolatedElectron('chat-streaming-animation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        apiHost: provider.url,
        apiModelId: 'e2e-stream-animation-model',
        providerName: 'E2E Streaming Animation Provider',
      });
      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });

      await page.evaluate(() => {
        const samples: number[] = [];
        let animationFrameId = 0;
        let changedTextSamples = 0;
        let lastFrameTime = performance.now();
        let lastHeight = 0;
        let lastTextLength = 0;
        let maxActiveStreamChars = 0;
        let maxHeightDelta = 0;
        let maxLiveSurfaces = 0;
        let textReversals = 0;

        const getAssistantSurface = () => {
          const messages = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-message-item="true"][data-role="assistant"]',
          ));
          return messages.at(-1) ?? null;
        };

        const readText = (assistant: HTMLElement | null) => {
          const markdownSurface = assistant?.querySelector<HTMLElement>('.markdown-surface');
          return markdownSurface?.textContent ?? '';
        };

        const tick = (time: number) => {
          const frameMs = time - lastFrameTime;
          lastFrameTime = time;
          samples.push(frameMs);

          const assistant = getAssistantSurface();
          const text = readText(assistant);
          const textLength = Array.from(text).length;
          if (textLength !== lastTextLength) {
            changedTextSamples += 1;
            if (textLength < lastTextLength) {
              textReversals += 1;
            }
            lastTextLength = textLength;
          }

          const liveSurfaces = document.querySelectorAll('[data-chat-markdown-live="true"]').length;
          maxLiveSurfaces = Math.max(maxLiveSurfaces, liveSurfaces);
          maxActiveStreamChars = Math.max(maxActiveStreamChars, document.querySelectorAll('.chat-stream-char').length);

          if (assistant) {
            const height = assistant.getBoundingClientRect().height;
            if (lastHeight > 0) {
              maxHeightDelta = Math.max(maxHeightDelta, Math.abs(height - lastHeight));
            }
            lastHeight = height;
          }

          animationFrameId = requestAnimationFrame(tick);
        };

        animationFrameId = requestAnimationFrame(tick);

        (window as any).__vlainaChatStreamProbe = {
          stop: (): StreamProbeMetrics => {
            cancelAnimationFrame(animationFrameId);
            const sorted = samples.slice().sort((a, b) => a - b);
            const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * 0.95)));
            const assistant = getAssistantSurface();
            const finalText = readText(assistant);
            return {
              changedTextSamples,
              finalActiveStreamChars: document.querySelectorAll('.chat-stream-char').length,
              finalLiveSurfaces: document.querySelectorAll('[data-chat-markdown-live="true"]').length,
              finalText,
              frameCount: samples.length,
              longFramesOver50: samples.filter((sample) => sample > 50).length,
              longFramesOver100: samples.filter((sample) => sample > 100).length,
              maxActiveStreamChars,
              maxFrameMs: Math.max(0, ...samples),
              maxHeightDelta,
              maxLiveSurfaces,
              p95FrameMs: sorted[p95Index] ?? 0,
              textReversals,
            };
          },
        };
      });

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('Run the streaming animation probe.');
      await textarea.press('Enter');

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, {
        hasText: 'E2E_STREAM_DONE',
      })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(250);

      const metrics = await page.evaluate(() =>
        (window as any).__vlainaChatStreamProbe.stop() as StreamProbeMetrics
      );

      console.log('chat streaming animation metrics', JSON.stringify({
        changedTextSamples: metrics.changedTextSamples,
        frameCount: metrics.frameCount,
        longFramesOver50: metrics.longFramesOver50,
        longFramesOver100: metrics.longFramesOver100,
        maxActiveStreamChars: metrics.maxActiveStreamChars,
        maxFrameMs: Math.round(metrics.maxFrameMs * 10) / 10,
        maxHeightDelta: Math.round(metrics.maxHeightDelta * 10) / 10,
        maxLiveSurfaces: metrics.maxLiveSurfaces,
        p95FrameMs: Math.round(metrics.p95FrameMs * 10) / 10,
        providerRequests: provider.requests().length,
        textReversals: metrics.textReversals,
      }));

      expect(metrics.finalText).toContain('E2E_STREAM_DONE');
      expect(metrics.changedTextSamples).toBeGreaterThan(3);
      expect(metrics.textReversals).toBe(0);
      expect(metrics.maxLiveSurfaces).toBeLessThanOrEqual(1);
      expect(metrics.maxActiveStreamChars).toBeLessThanOrEqual(120);
      expect(metrics.finalLiveSurfaces).toBe(0);
      expect(metrics.finalActiveStreamChars).toBe(0);
      expect(metrics.p95FrameMs).toBeLessThan(60);
      expect(metrics.longFramesOver100).toBeLessThanOrEqual(1);
      expect(provider.requests().length).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });
});
