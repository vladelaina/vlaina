import { VLAINA_THEME_MAPPINGS } from './mappings';

export function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderCustomProperties(properties: Map<string, string>): string {
  return Array.from(properties.entries())
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');
}

function renderVlainaMappings(properties: Map<string, string>): string {
  const declarations = VLAINA_THEME_MAPPINGS.flatMap(({ target, sources }) => {
    const source = sources.find((candidate) => canMapSourceToTarget(properties, candidate, target));
    return source ? [`  ${target}: var(${source});`] : [];
  });

  if (declarations.length > 0) {
    declarations.unshift('  color-scheme: light dark;');
  }

  return declarations.join('\n');
}

function canMapSourceToTarget(
  properties: Map<string, string>,
  source: string,
  target: string
): boolean {
  const value = properties.get(source);
  if (!value) return false;
  return !new RegExp(`var\\(\\s*${escapeRegExp(target)}\\b`, 'i').test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderRule(selector: string, properties: Map<string, string>): string {
  const customProperties = renderCustomProperties(properties);
  const content = [
    customProperties,
    renderVlainaMappings(properties),
  ].filter(Boolean).join('\n');

  return `${selector} {\n${content}\n}`;
}
