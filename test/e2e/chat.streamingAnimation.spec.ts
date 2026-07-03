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

const STREAM_CHUNK_DELAY_MS = 32;
const STREAM_CHUNK_SIZE = 18;

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

const STREAM_REPLAY_PROBE_RESPONSE = Array.from(
  { length: 160 },
  (_value, index) => String.fromCodePoint(0x4e00 + index),
).join('');

type StreamProbeMetrics = {
  activeChangedTextSamples: number;
  activeFrameCount: number;
  activeLongFramesOver50: number;
  activeLongFramesOver100: number;
  activeMaxFrameMs: number;
  activeP95FrameMs: number;
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
  sawLiveSurface: boolean;
  textReversals: number;
};

async function createStreamingProviderServer(
  content: string,
  options: {
    chunkDelayMs?: number;
    chunkSize?: number;
  } = {},
): Promise<{
  close: () => Promise<void>;
  requests: () => Array<{ body: string; url: string }>;
  url: string;
}> {
  const chunkDelayMs = options.chunkDelayMs ?? STREAM_CHUNK_DELAY_MS;
  const chunkSize = options.chunkSize ?? STREAM_CHUNK_SIZE;
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

        const chunk = content.slice(offset, offset + chunkSize);
        offset += chunkSize;
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }, chunkDelayMs);

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

  test('does not restart stream character animations for already rendered text', async () => {
    const provider = await createStreamingProviderServer(STREAM_REPLAY_PROBE_RESPONSE, {
      chunkDelayMs: 80,
      chunkSize: 8,
    });
    const { app, userDataRoot } = await launchIsolatedElectron('chat-streaming-animation-replay');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        apiHost: provider.url,
        apiModelId: 'e2e-stream-animation-replay-model',
        providerName: 'E2E Streaming Animation Replay Provider',
      });
      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });

      await page.evaluate(() => {
        let animationFrameId = 0;
        const activeCounts = new Map<string, number>();
        const completedChars = new Set<string>();
        const duplicateActivations = new Map<string, number>();
        const activeStyleChanges = new Map<string, number>();
        const previousActiveStyle = new Map<string, string>();
        const previouslyActive = new Set<string>();

        const tick = () => {
          const activeChars = new Set<string>();
          const nextActiveStyle = new Map<string, string>();
          document.querySelectorAll<HTMLElement>('.chat-stream-char').forEach((element) => {
            const char = element.textContent ?? '';
            if (!char) {
              return;
            }
            activeChars.add(char);
            activeCounts.set(char, (activeCounts.get(char) ?? 0) + 1);
            const style = element.getAttribute('style') ?? '';
            nextActiveStyle.set(char, style);
            const previousStyle = previousActiveStyle.get(char);
            if (previousStyle !== undefined && previousStyle !== style) {
              activeStyleChanges.set(char, (activeStyleChanges.get(char) ?? 0) + 1);
            }
            if (completedChars.has(char)) {
              duplicateActivations.set(char, (duplicateActivations.get(char) ?? 0) + 1);
            }
          });

          previouslyActive.forEach((char) => {
            if (!activeChars.has(char)) {
              completedChars.add(char);
            }
          });
          previouslyActive.clear();
          previousActiveStyle.clear();
          activeChars.forEach((char) => previouslyActive.add(char));
          nextActiveStyle.forEach((style, char) => previousActiveStyle.set(char, style));
          animationFrameId = requestAnimationFrame(tick);
        };

        animationFrameId = requestAnimationFrame(tick);

        (window as any).__vlainaChatStreamReplayProbe = {
          read: () => ({
            activeSamples: Array.from(activeCounts.entries())
              .filter(([, count]) => count > 1)
              .map(([char, count]) => ({ char, count })),
            activeStyleChanges: Array.from(activeStyleChanges.entries())
              .map(([char, count]) => ({ char, count })),
            duplicateActivations: Array.from(duplicateActivations.entries())
              .map(([char, count]) => ({ char, count })),
            sampledChars: Array.from(activeCounts.keys()),
          }),
          stop: () => cancelAnimationFrame(animationFrameId),
        };
      });

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('Run the streaming animation replay probe.');
      await textarea.press('Enter');

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, {
        hasText: STREAM_REPLAY_PROBE_RESPONSE.slice(-8),
      })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.chat-stream-char')).toHaveCount(0, { timeout: 10_000 });

      const probe = await page.evaluate(() =>
        (window as any).__vlainaChatStreamReplayProbe.read() as {
          activeSamples: Array<{ char: string; count: number }>;
          activeStyleChanges: Array<{ char: string; count: number }>;
          duplicateActivations: Array<{ char: string; count: number }>;
          sampledChars: string[];
        }
      );
      await page.evaluate(() => (window as any).__vlainaChatStreamReplayProbe.stop());

      expect(probe.sampledChars.length).toBeGreaterThan(0);
      expect(probe.duplicateActivations, JSON.stringify(probe, null, 2)).toEqual([]);
      expect(probe.activeStyleChanges, JSON.stringify(probe, null, 2)).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });

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
        const summarizeFrames = (frameSamples: number[]) => {
          const sorted = frameSamples.slice().sort((a, b) => a - b);
          const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * 0.95)));
          return {
            longFramesOver50: frameSamples.filter((sample) => sample > 50).length,
            longFramesOver100: frameSamples.filter((sample) => sample > 100).length,
            maxFrameMs: Math.max(0, ...frameSamples),
            p95FrameMs: sorted[p95Index] ?? 0,
          };
        };

        const activeSamples: number[] = [];
        const samples: number[] = [];
        let activeChangedTextSamples = 0;
        let animationFrameId = 0;
        let changedTextSamples = 0;
        let lastActiveFrameTime: number | null = null;
        let lastActiveTextLength = 0;
        let lastFrameTime = performance.now();
        let lastHeight = 0;
        let lastTextLength = 0;
        let maxActiveStreamChars = 0;
        let maxHeightDelta = 0;
        let maxLiveSurfaces = 0;
        let sawLiveSurface = false;
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
          const activeStreamChars = document.querySelectorAll('.chat-stream-char').length;
          const isLiveFrame = liveSurfaces > 0 || activeStreamChars > 0;
          if (isLiveFrame) {
            sawLiveSurface = true;
            if (lastActiveFrameTime !== null) {
              activeSamples.push(time - lastActiveFrameTime);
            }
            lastActiveFrameTime = time;
            if (textLength !== lastActiveTextLength) {
              activeChangedTextSamples += 1;
              lastActiveTextLength = textLength;
            }
          } else {
            lastActiveFrameTime = null;
          }

          maxLiveSurfaces = Math.max(maxLiveSurfaces, liveSurfaces);
          maxActiveStreamChars = Math.max(maxActiveStreamChars, activeStreamChars);

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
            const allFrameMetrics = summarizeFrames(samples);
            const activeFrameMetrics = summarizeFrames(activeSamples);
            const assistant = getAssistantSurface();
            const finalText = readText(assistant);
            return {
              activeChangedTextSamples,
              activeFrameCount: activeSamples.length,
              activeLongFramesOver50: activeFrameMetrics.longFramesOver50,
              activeLongFramesOver100: activeFrameMetrics.longFramesOver100,
              activeMaxFrameMs: activeFrameMetrics.maxFrameMs,
              activeP95FrameMs: activeFrameMetrics.p95FrameMs,
              changedTextSamples,
              finalActiveStreamChars: document.querySelectorAll('.chat-stream-char').length,
              finalLiveSurfaces: document.querySelectorAll('[data-chat-markdown-live="true"]').length,
              finalText,
              frameCount: samples.length,
              longFramesOver50: allFrameMetrics.longFramesOver50,
              longFramesOver100: allFrameMetrics.longFramesOver100,
              maxActiveStreamChars,
              maxFrameMs: allFrameMetrics.maxFrameMs,
              maxHeightDelta,
              maxLiveSurfaces,
              p95FrameMs: allFrameMetrics.p95FrameMs,
              sawLiveSurface,
              textReversals,
            };
          },
        };
      });

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('Run the streaming animation probe.');
      await textarea.press('Enter');
      await expect(page.locator('[data-chat-markdown-live="true"]')).toBeVisible({ timeout: 15_000 });

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, {
        hasText: 'E2E_STREAM_DONE',
      })).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-chat-markdown-live="true"]')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('.chat-stream-char')).toHaveCount(0, { timeout: 10_000 });

      const metrics = await page.evaluate(() =>
        (window as any).__vlainaChatStreamProbe.stop() as StreamProbeMetrics
      );

      console.log('chat streaming animation metrics', JSON.stringify({
        activeChangedTextSamples: metrics.activeChangedTextSamples,
        activeFrameCount: metrics.activeFrameCount,
        activeLongFramesOver50: metrics.activeLongFramesOver50,
        activeLongFramesOver100: metrics.activeLongFramesOver100,
        activeMaxFrameMs: Math.round(metrics.activeMaxFrameMs * 10) / 10,
        activeP95FrameMs: Math.round(metrics.activeP95FrameMs * 10) / 10,
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
        sawLiveSurface: metrics.sawLiveSurface,
        textReversals: metrics.textReversals,
      }));

      expect(metrics.finalText).toContain('E2E_STREAM_DONE');
      expect(metrics.sawLiveSurface).toBe(true);
      expect(metrics.changedTextSamples).toBeGreaterThan(0);
      expect(metrics.activeChangedTextSamples).toBeGreaterThan(0);
      expect(metrics.textReversals).toBe(0);
      expect(metrics.maxLiveSurfaces).toBeLessThanOrEqual(1);
      expect(metrics.maxActiveStreamChars).toBeGreaterThan(0);
      expect(metrics.maxActiveStreamChars).toBeLessThanOrEqual(120);
      expect(metrics.finalLiveSurfaces).toBe(0);
      expect(metrics.finalActiveStreamChars).toBe(0);
      expect(metrics.activeFrameCount).toBeGreaterThanOrEqual(2);
      expect(metrics.activeP95FrameMs).toBeLessThan(90);
      expect(metrics.activeMaxFrameMs).toBeLessThan(250);
      expect(metrics.activeLongFramesOver100).toBeLessThanOrEqual(
        Math.max(2, Math.floor(metrics.activeFrameCount * 0.05)),
      );
      expect(provider.requests().length).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });
});
