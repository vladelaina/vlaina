#!/usr/bin/env node
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const LOAD_PROFILES = {
  smoke: { durationSeconds: 15, concurrency: 10, warmupSeconds: 2, sessionUsers: 20, users: 200 },
  medium: { durationSeconds: 60, concurrency: 50, warmupSeconds: 5, sessionUsers: 100, users: 5_000 },
  heavy: { durationSeconds: 300, concurrency: 200, warmupSeconds: 10, sessionUsers: 500, users: 20_000 },
};

const USER_ID_START = readIntegerEnv("PERF_USER_ID_START", 10_000_000, 1, Number.MAX_SAFE_INTEGER - 1);
const profileName = String(process.env.PERF_PROFILE || "smoke").trim().toLowerCase();
const profile = LOAD_PROFILES[profileName] || LOAD_PROFILES.smoke;
const selectedProfileName = LOAD_PROFILES[profileName] ? profileName : "smoke";

const config = {
  baseUrl: normalizeBaseUrl(process.env.PERF_BASE_URL || "http://127.0.0.1:8787"),
  scenario: String(process.env.PERF_SCENARIO || (process.env.PERF_ADMIN_KEY ? "mixed" : "public")).trim().toLowerCase(),
  durationSeconds: readIntegerEnv("PERF_DURATION_SECONDS", profile.durationSeconds, 1, 24 * 3600),
  concurrency: readIntegerEnv("PERF_CONCURRENCY", profile.concurrency, 1, 5000),
  warmupSeconds: readIntegerEnv("PERF_WARMUP_SECONDS", profile.warmupSeconds, 0, 3600),
  timeoutMs: readIntegerEnv("PERF_TIMEOUT_MS", 15_000, 100, 120_000),
  thinkMs: readIntegerEnv("PERF_THINK_MS", 0, 0, 60_000),
  rotateIps: readBooleanEnv("PERF_ROTATE_IPS", true),
  ipCount: readIntegerEnv("PERF_IP_COUNT", Math.max(profile.concurrency * 20, 1000), 1, 187_500),
  adminKey: String(process.env.PERF_ADMIN_KEY || "").trim(),
  adminUsername: String(process.env.PERF_ADMIN_USERNAME || "admin").trim() || "admin",
  sessionUsers: readIntegerEnv("PERF_SESSION_USERS", profile.sessionUsers, 0, 50_000),
  users: readIntegerEnv("PERF_USERS", profile.users, 1, 2_000_000),
  maxLatencySamples: readIntegerEnv("PERF_MAX_LATENCY_SAMPLES", 500_000, 1000, 10_000_000),
  failOnBudget: readBooleanEnv("PERF_FAIL_ON_BUDGET", false),
  maxHttpErrorRate: readNumberEnv("PERF_MAX_HTTP_ERROR_RATE", 0.05, 0, 1),
  maxServerErrorRate: readNumberEnv("PERF_MAX_SERVER_ERROR_RATE", 0.01, 0, 1),
  p95BudgetMs: readIntegerEnv("PERF_P95_BUDGET_MS", 0, 0, 600_000),
  json: readBooleanEnv("PERF_JSON", false),
};

const sessionTokens = Array.from(
  { length: Math.max(0, config.sessionUsers) },
  (_, index) => perfSessionToken(index + 1)
);

let endpoints = [];
let interrupted = false;
process.on("SIGINT", () => {
  interrupted = true;
  console.error("\nStopping after in-flight requests finish...");
});

async function main() {
  assertLocalBaseUrl(config.baseUrl);
  endpoints = buildScenario(config.scenario);
  validateScenario(endpoints);

  if (!config.json) {
    console.log(`Local API load test: profile=${selectedProfileName}, scenario=${config.scenario}`);
    console.log(`Target: ${config.baseUrl}`);
    console.log(
      `Concurrency=${config.concurrency}, duration=${config.durationSeconds}s, warmup=${config.warmupSeconds}s, timeout=${config.timeoutMs}ms, rotateIps=${config.rotateIps ? "yes" : "no"}`
    );
  }

  if (config.warmupSeconds > 0) {
    if (!config.json) console.log(`Warming up for ${config.warmupSeconds}s...`);
    await runPhase({ durationSeconds: config.warmupSeconds, collect: false, stats: null });
  }

  const stats = new Stats(config.maxLatencySamples);
  const measuredStartedAt = performance.now();
  await runPhase({ durationSeconds: config.durationSeconds, collect: true, stats });
  const elapsedSeconds = Math.max(0.001, (performance.now() - measuredStartedAt) / 1000);
  const summary = stats.toSummary(elapsedSeconds, {
    profile: selectedProfileName,
    scenario: config.scenario,
    baseUrl: config.baseUrl,
    concurrency: config.concurrency,
    durationSeconds: config.durationSeconds,
    warmupSeconds: config.warmupSeconds,
    rotateIps: config.rotateIps,
    interrupted,
  });

  if (config.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }

  if (config.failOnBudget && violatesBudget(summary)) {
    process.exitCode = 1;
  }
}

async function runPhase({ durationSeconds, collect, stats }) {
  const deadline = performance.now() + durationSeconds * 1000;
  const workers = Array.from({ length: config.concurrency }, (_, workerId) =>
    runWorker({ workerId, deadline, collect, stats })
  );
  await Promise.all(workers);
}

async function runWorker({ workerId, deadline, collect, stats }) {
  let requestIndex = 0;
  while (!interrupted && performance.now() < deadline) {
    const endpoint = pickEndpoint(endpoints);
    const request = buildRequest(endpoint, workerId, requestIndex);
    const startedAt = performance.now();
    let status = 0;
    let bytes = 0;
    let errorName = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: "GET",
        headers: request.headers,
        signal: controller.signal,
      });
      maybeUpdateSessionToken(request.sessionIndex, response.headers.get("x-app-session-token"));
      status = response.status;
      const body = await response.arrayBuffer();
      bytes = body.byteLength;
    } catch (error) {
      errorName = formatFetchError(error);
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = performance.now() - startedAt;
    if (collect && stats) {
      stats.record({
        endpoint: endpoint.name,
        path: request.path,
        status,
        bytes,
        latencyMs,
        errorName,
      });
    }

    requestIndex += 1;
    if (config.thinkMs > 0) {
      await sleep(config.thinkMs);
    }
  }
}

function buildScenario(name) {
  const scenarios = {
    public: publicEndpoints(),
    "public-models": publicEndpoints(),
    "managed-client": managedClientEndpoints(),
    models: [
      endpoint("GET /v1/models", () => "/v1/models", 100),
    ],
    budget: budgetEndpoints(),
    analytics: adminAnalyticsEndpoints(),
    "analytics-ranges": adminAnalyticsEndpoints(),
    "analytics-page": adminAnalyticsPageEndpoints(),
    "admin-open": adminOpenEndpoints(),
    "admin-models": adminModelEndpoints(),
    "admin-users": adminUserEndpoints(),
    "admin-logs": adminLogEndpoints(),
    "admin-tables": adminTableEndpoints(),
    admin: [...adminAnalyticsEndpoints(), ...adminTableEndpoints()],
    "admin-heavy": [
      ...weighted(adminAnalyticsEndpoints(), 2),
      ...adminTableEndpoints(),
    ],
    "mixed-open": [
      ...weighted(publicEndpoints(), 2),
      ...budgetEndpoints(),
      ...adminAnalyticsPageEndpoints(),
      ...adminOpenEndpoints(),
    ],
    "mixed-open-client": [
      ...weighted(managedClientEndpoints(), 2),
      ...budgetEndpoints(),
      ...adminAnalyticsPageEndpoints(),
      ...adminOpenEndpoints(),
    ],
    mixed: [
      ...weighted(publicEndpoints(), 2),
      ...budgetEndpoints(),
      ...adminAnalyticsEndpoints(),
      ...adminTableEndpoints(),
    ],
  };
  return scenarios[name] || scenarios.mixed;
}

function publicEndpoints() {
  return [
    endpoint("GET /v1/models", () => "/v1/models", 85),
    endpoint("GET /v1/models/version", () => "/v1/models/version", 15),
  ];
}

function managedClientEndpoints() {
  return [
    endpoint("GET /v1/models/version", () => "/v1/models/version", 95),
    endpoint("GET /v1/models cached refresh", () => "/v1/models", 5),
  ];
}

function budgetEndpoints() {
  return [
    endpoint("GET /v1/budget", () => "/v1/budget", 100, { session: true }),
  ];
}

function adminAnalyticsEndpoints() {
  return [
    endpoint("GET /admin/analytics", () => `/admin/analytics?range=${randomRange()}`, 28, { admin: true }),
    endpoint("GET /admin/analytics/overview", () => `/admin/analytics/overview?range=${randomRange()}`, 24, { admin: true }),
    endpoint("GET /admin/analytics/top-users", () => `/admin/analytics/top-users?range=${randomRange()}`, 12, { admin: true }),
    endpoint("GET /admin/analytics/top-models", () => `/admin/analytics/top-models?range=${randomRange()}`, 12, { admin: true }),
    endpoint(
      "GET /admin/analytics/users-summary",
      () => `/admin/analytics/users-summary?range=${randomRange()}&kind=${randomUserSummaryKind()}&limit=100`,
      14,
      { admin: true }
    ),
    endpoint(
      "GET /admin/analytics/users/:id",
      () => `/admin/analytics/users/${randomPerfUserId()}?range=${randomRange()}`,
      10,
      { admin: true }
    ),
  ];
}

function adminAnalyticsPageEndpoints() {
  return [
    endpoint("GET /admin/analytics", () => `/admin/analytics?range=${randomRange()}`, 72, { admin: true }),
    endpoint(
      "GET /admin/analytics/users-summary",
      () => `/admin/analytics/users-summary?range=${randomRange()}&kind=${randomUserSummaryKind()}&limit=100`,
      20,
      { admin: true }
    ),
    endpoint(
      "GET /admin/analytics/users/:id",
      () => `/admin/analytics/users/${randomPerfUserId()}?range=${randomRange()}`,
      8,
      { admin: true }
    ),
  ];
}

function adminTableEndpoints() {
  return [
    endpoint("GET /admin/users", () => `/admin/users?page=${randomPage(30)}&limit=200`, 24, { admin: true }),
    endpoint("GET /admin/users low", () => `/admin/users?page=${randomPage(10)}&limit=200&pointsFilter=low`, 8, { admin: true }),
    endpoint("GET /admin/logs all", () => `/admin/logs?page=${randomPage(40)}&limit=200&status=all`, 24, { admin: true }),
    endpoint("GET /admin/logs rejected", () => `/admin/logs?page=${randomPage(12)}&limit=200&status=rejected`, 8, { admin: true }),
    endpoint("GET /admin/models", () => `/admin/models?page=${randomPage(20)}&limit=500`, 20, { admin: true }),
    endpoint("GET /admin/channels", () => "/admin/channels", 8, { admin: true }),
    endpoint("GET /admin/system-health", () => "/admin/system-health", 8, { admin: true }),
  ];
}

function adminOpenEndpoints() {
  return [
    endpoint("GET /admin/users first page", () => "/admin/users?page=1&limit=100", 24, { admin: true }),
    endpoint("GET /admin/logs first page", () => "/admin/logs?page=1&limit=50&status=all&diagnosticOnly=false", 24, { admin: true }),
    endpoint("GET /admin/models first page", () => "/admin/models?page=1&limit=500", 20, { admin: true }),
    endpoint("GET /admin/models second page", () => "/admin/models?page=2&limit=500", 10, { admin: true }),
    endpoint("GET /admin/channels", () => "/admin/channels", 12, { admin: true }),
    endpoint("GET /admin/system-health", () => "/admin/system-health", 10, { admin: true }),
  ];
}

function adminModelEndpoints() {
  return [
    endpoint("GET /admin/models page 1", () => "/admin/models?page=1&limit=500", 60, { admin: true }),
    endpoint("GET /admin/models page 2", () => "/admin/models?page=2&limit=500", 40, { admin: true }),
  ];
}

function adminUserEndpoints() {
  return [
    endpoint("GET /admin/users first pages", () => `/admin/users?page=${randomPage(5)}&limit=100`, 80, { admin: true }),
    endpoint("GET /admin/users low first pages", () => `/admin/users?page=${randomPage(3)}&limit=100&pointsFilter=low`, 20, { admin: true }),
  ];
}

function adminLogEndpoints() {
  return [
    endpoint("GET /admin/logs all first pages", () => `/admin/logs?page=${randomPage(10)}&limit=50&status=all&diagnosticOnly=false`, 80, { admin: true }),
    endpoint("GET /admin/logs rejected first pages", () => `/admin/logs?page=${randomPage(5)}&limit=50&status=rejected&diagnosticOnly=false`, 20, { admin: true }),
  ];
}

function endpoint(name, pathFactory, weight, options = {}) {
  return {
    name,
    pathFactory,
    weight: Math.max(1, Math.floor(weight)),
    admin: options.admin === true,
    session: options.session === true,
  };
}

function weighted(items, multiplier) {
  return items.map((item) => ({ ...item, weight: item.weight * multiplier }));
}

function validateScenario(items) {
  if (!items.length) {
    throw new Error("No endpoints selected for scenario.");
  }
  const needsAdmin = items.some((item) => item.admin);
  if (needsAdmin && !config.adminKey) {
    throw new Error("This scenario includes admin endpoints. Set PERF_ADMIN_KEY to the local ADMIN_API_KEY.");
  }
  const needsSession = items.some((item) => item.session);
  if (needsSession && config.sessionUsers <= 0) {
    throw new Error("This scenario includes /v1/budget. Seed sessions first or set PERF_SESSION_USERS > 0.");
  }
}

function pickEndpoint(items) {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function buildRequest(endpointConfig, workerId, requestIndex) {
  const path = endpointConfig.pathFactory();
  const sessionIndex = endpointConfig.session && config.sessionUsers > 0
    ? (workerId + requestIndex) % config.sessionUsers
    : null;
  const headers = {
    Accept: "application/json",
    "User-Agent": `vlaina-local-api-load/${selectedProfileName}`,
    "CF-Connecting-IP": ipFor(workerId, requestIndex),
  };

  if (endpointConfig.admin) {
    headers.Authorization = `Bearer ${config.adminKey}`;
    headers["x-admin-username"] = config.adminUsername;
  } else if (endpointConfig.session) {
    headers.Authorization = `Bearer ${sessionTokens[sessionIndex] || perfSessionToken(sessionIndex + 1)}`;
  }

  return {
    path,
    headers,
    sessionIndex,
    url: new URL(path, `${config.baseUrl}/`).toString(),
  };
}

class Stats {
  constructor(maxLatencySamples) {
    this.maxLatencySamples = maxLatencySamples;
    this.overall = new Metric(maxLatencySamples);
    this.byEndpoint = new Map();
    this.slowest = [];
  }

  record(sample) {
    this.overall.record(sample);
    let metric = this.byEndpoint.get(sample.endpoint);
    if (!metric) {
      metric = new Metric(this.maxLatencySamples);
      this.byEndpoint.set(sample.endpoint, metric);
    }
    metric.record(sample);
    this.recordSlowSample(sample);
  }

  recordSlowSample(sample) {
    const item = {
      endpoint: sample.endpoint,
      path: sample.path,
      status: sample.status || sample.errorName || "ERR",
      latencyMs: round(sample.latencyMs),
    };
    if (this.slowest.length < 10) {
      this.slowest.push(item);
      this.slowest.sort((left, right) => right.latencyMs - left.latencyMs);
      return;
    }
    const last = this.slowest[this.slowest.length - 1];
    if (item.latencyMs > last.latencyMs) {
      this.slowest[this.slowest.length - 1] = item;
      this.slowest.sort((left, right) => right.latencyMs - left.latencyMs);
    }
  }

  toSummary(elapsedSeconds, context) {
    const endpoints = Array.from(this.byEndpoint.entries())
      .map(([name, metric]) => ({ name, ...metric.toSummary(elapsedSeconds) }))
      .sort((left, right) => right.requests - left.requests);

    return {
      ...context,
      elapsedSeconds: round(elapsedSeconds),
      overall: this.overall.toSummary(elapsedSeconds),
      endpoints,
      statusCounts: Object.fromEntries(this.overall.statusCounts),
      slowest: this.slowest,
    };
  }
}

class Metric {
  constructor(maxLatencySamples) {
    this.maxLatencySamples = maxLatencySamples;
    this.requests = 0;
    this.ok = 0;
    this.http4xx = 0;
    this.http5xx = 0;
    this.networkErrors = 0;
    this.bytes = 0;
    this.totalLatencyMs = 0;
    this.maxLatencyMs = 0;
    this.latencySamplesSeen = 0;
    this.latencies = [];
    this.statusCounts = new Map();
  }

  record(sample) {
    this.requests += 1;
    this.bytes += sample.bytes || 0;
    this.totalLatencyMs += sample.latencyMs;
    this.maxLatencyMs = Math.max(this.maxLatencyMs, sample.latencyMs);
    this.recordLatency(sample.latencyMs);

    const statusKey = sample.status > 0 ? String(sample.status) : `ERR:${sample.errorName || "network"}`;
    this.statusCounts.set(statusKey, (this.statusCounts.get(statusKey) || 0) + 1);

    if (sample.status >= 200 && sample.status < 400) {
      this.ok += 1;
    } else if (sample.status >= 500) {
      this.http5xx += 1;
    } else if (sample.status >= 400) {
      this.http4xx += 1;
    } else {
      this.networkErrors += 1;
    }
  }

  recordLatency(value) {
    this.latencySamplesSeen += 1;
    if (this.latencies.length < this.maxLatencySamples) {
      this.latencies.push(value);
      return;
    }
    const slot = Math.floor(Math.random() * this.latencySamplesSeen);
    if (slot < this.maxLatencySamples) {
      this.latencies[slot] = value;
    }
  }

  toSummary(elapsedSeconds) {
    const sorted = [...this.latencies].sort((left, right) => left - right);
    const requests = this.requests;
    const httpErrors = this.http4xx + this.http5xx;
    return {
      requests,
      rps: round(requests / elapsedSeconds),
      ok: this.ok,
      http4xx: this.http4xx,
      http5xx: this.http5xx,
      networkErrors: this.networkErrors,
      httpErrorRate: rate(httpErrors, requests),
      serverErrorRate: rate(this.http5xx + this.networkErrors, requests),
      avgMs: requests > 0 ? round(this.totalLatencyMs / requests) : 0,
      p50Ms: percentile(sorted, 50),
      p90Ms: percentile(sorted, 90),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      maxMs: round(this.maxLatencyMs),
      mbReceived: round(this.bytes / 1024 / 1024),
      sampledLatencies: sorted.length,
      latencySampled: this.latencySamplesSeen > sorted.length,
    };
  }
}

function printSummary(summary) {
  console.log("\nOverall");
  console.log(formatTable([
    ["requests", "rps", "ok", "4xx", "5xx", "net err", "http err", "server err", "avg", "p50", "p90", "p95", "p99", "max", "MiB"],
    [
      summary.overall.requests,
      summary.overall.rps,
      summary.overall.ok,
      summary.overall.http4xx,
      summary.overall.http5xx,
      summary.overall.networkErrors,
      percent(summary.overall.httpErrorRate),
      percent(summary.overall.serverErrorRate),
      `${summary.overall.avgMs}ms`,
      `${summary.overall.p50Ms}ms`,
      `${summary.overall.p90Ms}ms`,
      `${summary.overall.p95Ms}ms`,
      `${summary.overall.p99Ms}ms`,
      `${summary.overall.maxMs}ms`,
      summary.overall.mbReceived,
    ],
  ]));

  console.log("\nBy endpoint");
  console.log(formatTable([
    ["endpoint", "requests", "rps", "ok", "4xx", "5xx", "net err", "p50", "p95", "p99", "max", "MiB"],
    ...summary.endpoints.map((item) => [
      item.name,
      item.requests,
      item.rps,
      item.ok,
      item.http4xx,
      item.http5xx,
      item.networkErrors,
      `${item.p50Ms}ms`,
      `${item.p95Ms}ms`,
      `${item.p99Ms}ms`,
      `${item.maxMs}ms`,
      item.mbReceived,
    ]),
  ]));

  console.log("\nStatus counts");
  console.log(Object.entries(summary.statusCounts).map(([status, count]) => `${status}:${count}`).join(" "));

  if (summary.slowest.length > 0) {
    console.log("\nSlowest samples");
    console.log(formatTable([
      ["latency", "status", "endpoint", "path"],
      ...summary.slowest.map((item) => [`${item.latencyMs}ms`, item.status, item.endpoint, item.path]),
    ]));
  }

  if (summary.overall.latencySampled) {
    console.log(`\nLatency percentiles used reservoir sampling (${summary.overall.sampledLatencies} samples).`);
  }
}

function formatTable(rows) {
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => String(row[columnIndex] ?? "").length))
  );
  return rows
    .map((row) =>
      row
        .map((cell, columnIndex) => String(cell ?? "").padEnd(widths[columnIndex]))
        .join("  ")
        .trimEnd()
    )
    .join("\n");
}

function violatesBudget(summary) {
  if (summary.overall.httpErrorRate > config.maxHttpErrorRate) {
    console.error(`HTTP error rate ${percent(summary.overall.httpErrorRate)} exceeded ${percent(config.maxHttpErrorRate)}.`);
    return true;
  }
  if (summary.overall.serverErrorRate > config.maxServerErrorRate) {
    console.error(`Server/network error rate ${percent(summary.overall.serverErrorRate)} exceeded ${percent(config.maxServerErrorRate)}.`);
    return true;
  }
  if (config.p95BudgetMs > 0 && summary.overall.p95Ms > config.p95BudgetMs) {
    console.error(`p95 ${summary.overall.p95Ms}ms exceeded ${config.p95BudgetMs}ms.`);
    return true;
  }
  return false;
}

function randomRange() {
  const ranges = ["6h", "24h", "7d", "30d", "90d", "all"];
  return ranges[Math.floor(Math.random() * ranges.length)];
}

function randomUserSummaryKind() {
  const kinds = ["total", "new", "free", "pro", "max", "ultra"];
  return kinds[Math.floor(Math.random() * kinds.length)];
}

function randomPage(maxPage) {
  return 1 + Math.floor(Math.random() * Math.max(1, maxPage));
}

function randomPerfUserId() {
  return USER_ID_START + Math.floor(Math.random() * config.users);
}

function ipFor(workerId, requestIndex) {
  if (!config.rotateIps) return "10.222.0.1";
  const slot = Math.abs((workerId * 1_000_003 + requestIndex * 97) % config.ipCount);
  const second = 222 + Math.floor(slot / 62_500);
  const remainder = slot % 62_500;
  const third = Math.floor(remainder / 250);
  const fourth = (remainder % 250) + 1;
  return `10.${second}.${third}.${fourth}`;
}

function perfSessionToken(index) {
  return `nts_${sha256Hex(`vlaina-perf-session-${index}`)}`;
}

function maybeUpdateSessionToken(sessionIndex, token) {
  if (sessionIndex === null || sessionIndex === undefined || !isValidSessionToken(token)) {
    return;
  }
  sessionTokens[sessionIndex] = token;
}

function isValidSessionToken(token) {
  return typeof token === "string" && /^nts_[0-9a-f]{64}$/i.test(token);
}

function formatFetchError(error) {
  if (!(error instanceof Error)) return String(error).slice(0, 160);
  const cause = error.cause instanceof Error
    ? ` cause=${error.cause.message}`
    : error.cause
      ? ` cause=${String(error.cause)}`
      : "";
  return `${error.name || "Error"}:${error.message || "fetch failed"}${cause}`.slice(0, 160);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function assertLocalBaseUrl(value) {
  if (readBooleanEnv("PERF_ALLOW_REMOTE", false)) return;
  const url = new URL(value);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing to load test non-local URL ${value}. Set PERF_ALLOW_REMOTE=1 to override.`);
  }
}

function percentile(sorted, value) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((value / 100) * sorted.length) - 1));
  return round(sorted[index]);
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function percent(value) {
  return `${round(value * 100)}%`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readNumberEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return !/^(0|false|no|off)$/i.test(raw.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
