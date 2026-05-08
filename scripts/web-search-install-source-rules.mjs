#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const OUTPUT_PATH = 'electron/webSearch/sourceQuality/installedSourceQualityRules.mjs';

function printUsage() {
  console.error([
    'Usage: node scripts/web-search-install-source-rules.mjs reviewed-rules.json',
    '',
    'The input must be a reviewed JSON file with optional hardBlockedSites,',
    'lowPrioritySites, and querySensitiveBlockedSites.health/documents arrays.',
    'This tool writes the local installed source-quality rules module.',
  ].join('\n'));
}

function normalizeHost(value) {
  const host = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(host)) return '';
  if (host.includes('..')) return '';
  return host;
}

function normalizeHostList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeHost).filter(Boolean))].sort();
}

function readRules(payload) {
  const sensitive = payload?.querySensitiveBlockedSites || {};
  return {
    hardBlockedSites: normalizeHostList(payload?.hardBlockedSites),
    lowPrioritySites: normalizeHostList(payload?.lowPrioritySites),
    querySensitiveBlockedSites: {
      documents: normalizeHostList(sensitive.documents),
      health: normalizeHostList(sensitive.health),
    },
  };
}

function formatArray(values, indent = '') {
  if (values.length === 0) return '[]';
  return `[\n${values.map((value) => `${indent}  '${value}',`).join('\n')}\n${indent}]`;
}

function renderModule(rules) {
  return [
    `export const INSTALLED_HARD_BLOCKED_SITES = ${formatArray(rules.hardBlockedSites)};`,
    '',
    'export const INSTALLED_QUERY_SENSITIVE_BLOCKED_SITES = {',
    `  documents: ${formatArray(rules.querySensitiveBlockedSites.documents, '  ')},`,
    `  health: ${formatArray(rules.querySensitiveBlockedSites.health, '  ')},`,
    '};',
    '',
    `export const INSTALLED_LOW_PRIORITY_SITES = ${formatArray(rules.lowPrioritySites)};`,
    '',
  ].join('\n');
}

const inputPath = process.argv[2];
if (!inputPath) {
  printUsage();
  process.exitCode = 1;
} else {
  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  await writeFile(OUTPUT_PATH, renderModule(readRules(payload)), 'utf8');
  process.stdout.write(`${OUTPUT_PATH}\n`);
}
