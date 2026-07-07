import { readBoundedJsonResponse } from './boundedJsonResponse.mjs';

const BILIBILI_METADATA_TIMEOUT_MS = 15000;
const MAX_BILIBILI_PAGELIST_RESPONSE_BYTES = 256 * 1024;
const MAX_BILIBILI_METADATA_RESPONSE_BYTES = 4 * 1024 * 1024;
const BILIBILI_API_HEADERS = {
  accept: 'application/json',
  referer: 'https://www.bilibili.com/',
  'user-agent': 'Mozilla/5.0 vlaina desktop',
};

function extractBilibiliBvid(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return null;
  }

  return rawUrl.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)?.[1]
    ?? rawUrl.match(/[?&]bvid=(BV[a-zA-Z0-9]+)/)?.[1]
    ?? null;
}

function buildBilibiliEmbedUrl({ bvid, aid, cid, page }) {
  const params = new URLSearchParams({
    isOutside: 'true',
    bvid,
    p: String(page ?? 1),
    danmaku: '0',
    autoplay: '0',
  });

  if (typeof aid === 'number' && Number.isFinite(aid)) {
    params.set('aid', String(aid));
  }

  if (typeof cid === 'number' && Number.isFinite(cid)) {
    params.set('cid', String(cid));
  }

  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

function readBilibiliPage(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return parsePositiveInteger(url.searchParams.get('p') ?? url.searchParams.get('page'));
  } catch {
    return null;
  }
}

function selectBilibiliPage(pages, requestedPage) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  if (requestedPage) {
    return pages.find((page) => parsePositiveInteger(page?.page) === requestedPage)
      ?? pages[requestedPage - 1]
      ?? pages[0]
      ?? null;
  }

  return pages[0] ?? null;
}

async function fetchBilibiliJson(path, bvid, {
  signal,
  maxBytes,
  tooLargeMessage,
}) {
  const response = await fetch(`https://api.bilibili.com${path}?bvid=${encodeURIComponent(bvid)}`, {
    cache: 'no-store',
    signal,
    headers: BILIBILI_API_HEADERS,
  });
  const payload = await readBoundedJsonResponse(response, {
    maxBytes,
    signal,
    tooLargeMessage,
  });

  return { response, payload };
}

function readFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.length <= 64) {
    const trimmed = value.trim();
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function parsePositiveInteger(value) {
  const parsed = readFiniteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function resolveVideoUrl(rawUrl, requireNonEmptyString) {
  const startedAt = Date.now();
  const inputUrl = requireNonEmptyString(rawUrl, 'video URL').trim();
  const bvid = extractBilibiliBvid(inputUrl);
  if (!bvid) {
    return {
      resolvedUrl: inputUrl,
      source: 'unchanged',
      durationMs: Date.now() - startedAt,
      stage: 'no-bvid',
    };
  }

  const timeoutMs = BILIBILI_METADATA_TIMEOUT_MS;
  let timeoutFired = false;
  let stage = 'start';
  let timeout = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => {
      timeoutFired = true;
      stage = 'timeout';
      controller.abort();
    }, timeoutMs);
    const requestedPage = readBilibiliPage(inputUrl);
    stage = 'fetching-pagelist';
    const pageListResult = await fetchBilibiliJson('/x/player/pagelist', bvid, {
      signal: controller.signal,
      maxBytes: MAX_BILIBILI_PAGELIST_RESPONSE_BYTES,
      tooLargeMessage: 'Bilibili page list response body is too large.',
    });
    stage = 'parsed-pagelist';
    const selectedPage = selectBilibiliPage(pageListResult.payload?.data, requestedPage);
    const pageListCid = parsePositiveInteger(selectedPage?.cid);
    if (pageListResult.response.ok && pageListResult.payload?.code === 0 && pageListCid) {
      const page = parsePositiveInteger(selectedPage?.page) ?? requestedPage;
      const resolvedUrl = buildBilibiliEmbedUrl({
        bvid,
        cid: pageListCid,
        page: page ?? undefined,
      });
      return {
        resolvedUrl,
        source: 'bilibili',
        bvid,
        aid: null,
        cid: pageListCid,
        page,
        stage,
        timeoutFired,
        durationMs: Date.now() - startedAt,
      };
    }

    stage = 'fetching-view';
    const viewResult = await fetchBilibiliJson('/x/web-interface/view', bvid, {
      signal: controller.signal,
      maxBytes: MAX_BILIBILI_METADATA_RESPONSE_BYTES,
      tooLargeMessage: 'Bilibili metadata response body is too large.',
    });
    stage = 'parsed-view';
    const viewSelectedPage = selectBilibiliPage(viewResult.payload?.data?.pages, requestedPage);
    const aid = parsePositiveInteger(viewResult.payload?.data?.aid);
    const cid = parsePositiveInteger(viewSelectedPage?.cid ?? viewResult.payload?.data?.cid);
    const page = parsePositiveInteger(viewSelectedPage?.page) ?? requestedPage;

    if (!viewResult.response.ok || viewResult.payload?.code !== 0 || !cid) {
      return {
        resolvedUrl: inputUrl,
        source: 'fallback',
        error: `Bilibili resolve failed: HTTP ${viewResult.response.status}, code ${viewResult.payload?.code ?? 'unknown'}`,
        bvid,
        stage,
        timeoutFired,
        durationMs: Date.now() - startedAt,
      };
    }

    const resolvedUrl = buildBilibiliEmbedUrl({
      bvid,
      aid: aid ?? undefined,
      cid,
      page: page ?? undefined,
    });
    return {
      resolvedUrl,
      source: 'bilibili',
      bvid,
      aid,
      cid,
      page,
      stage,
      timeoutFired,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      resolvedUrl: inputUrl,
      source: 'fallback',
      error: error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error',
      bvid,
      stage,
      timeoutFired,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
