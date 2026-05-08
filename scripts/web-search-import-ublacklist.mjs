#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseUBlacklistRules } from '../electron/webSearch/sourceQuality/ublacklistRuleParser.mjs';
import {
  HARD_BLOCKED_SITES,
  LOW_PRIORITY_SITES,
  QUERY_SENSITIVE_BLOCKED_SITES,
} from '../electron/webSearch/sourceQuality/sourceQualityPolicy.mjs';

const args = process.argv.slice(2);

function printUsage() {
  console.error([
    'Usage: node scripts/web-search-import-ublacklist.mjs [--out report.json] <file-or-url>...',
    '',
    'This development-only tool parses uBlacklist-style rules and emits candidate hosts.',
    'It does not modify runtime policy files. Review licenses and quality before copying candidates.',
  ].join('\n'));
}

function knownHosts() {
  return new Set([
    ...HARD_BLOCKED_SITES,
    ...LOW_PRIORITY_SITES,
    ...Object.values(QUERY_SENSITIVE_BLOCKED_SITES).flat(),
  ]);
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${source}: HTTP ${response.status}`);
    }
    return response.text();
  }
  return readFile(source, 'utf8');
}

function parseArgs(rawArgs) {
  let outPath = '';
  const sources = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--out') {
      outPath = rawArgs[index + 1] || '';
      index += 1;
    } else {
      sources.push(arg);
    }
  }
  return { outPath, sources };
}

const { outPath, sources } = parseArgs(args);
if (sources.length === 0) {
  printUsage();
  process.exitCode = 1;
} else {
  const known = knownHosts();
  const reportSources = [];
  const candidates = new Map();

  for (const source of sources) {
    const text = await readSource(source);
    const parsed = parseUBlacklistRules(text);
    const newHosts = parsed.hosts.filter((host) => !known.has(host));
    for (const host of newHosts) {
      const current = candidates.get(host) || [];
      current.push(source);
      candidates.set(host, current);
    }
    reportSources.push({
      source,
      label: basename(source),
      parsedHostCount: parsed.hosts.length,
      skippedRuleCount: parsed.skippedRules.length,
      newHostCount: newHosts.length,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    warning: 'Development-only candidate report. Review source license and host quality before adding to product policy.',
    sources: reportSources,
    candidates: [...candidates.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([host, candidateSources]) => ({ host, sources: candidateSources })),
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath) {
    await writeFile(outPath, json, 'utf8');
  } else {
    process.stdout.write(json);
  }
}
