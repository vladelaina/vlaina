import { VLAINA_THEME_MAPPINGS } from './mappings';

export function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderCustomProperties(properties: Map<string, string>): string {
  return Array.from(properties.entries())
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');
}

interface RenderRuleOptions {
  colorScheme?: 'light' | 'light dark';
  extraDeclarations?: string[];
}

function renderVlainaMappings(properties: Map<string, string>): string {
  return VLAINA_THEME_MAPPINGS.flatMap(({ target, sources }) => {
    const source = sources.find((candidate) => canMapSourceToTarget(properties, candidate, target));
    return source ? [`  ${target}: var(${source});`] : [];
  }).join('\n');
}

function renderExtraDeclarations(declarations: string[]): string {
  return declarations.map((declaration) => `  ${declaration}`).join('\n');
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

export function renderRule(
  selector: string,
  properties: Map<string, string>,
  options: RenderRuleOptions = {}
): string {
  const customProperties = renderCustomProperties(properties);
  const content = [
    options.colorScheme ? `  color-scheme: ${options.colorScheme};` : '',
    customProperties,
    renderExtraDeclarations(options.extraDeclarations ?? []),
    renderVlainaMappings(properties),
  ].filter(Boolean).join('\n');

  return `${selector} {\n${content}\n}`;
}
