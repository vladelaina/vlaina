const YAML_FRONTMATTER_PREFIX_PATTERN =
  /^(\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$))/;
const MERMAID_PREFIX_LINE_PATTERN =
  /^(\s*(?:%%\{[\s\S]*?\}%%|%%[^\r\n]*)[ \t]*(?:\r?\n|$))/;

export function splitLeadingMermaidPrefix(code: string) {
  const frontmatterMatch = YAML_FRONTMATTER_PREFIX_PATTERN.exec(code);
  let prefix = frontmatterMatch?.[1] ?? '';
  let body = prefix ? code.slice(prefix.length) : code;

  let mermaidPrefixLineMatch = MERMAID_PREFIX_LINE_PATTERN.exec(body);
  while (mermaidPrefixLineMatch?.[1]) {
    prefix += mermaidPrefixLineMatch[1];
    body = body.slice(mermaidPrefixLineMatch[1].length);
    mermaidPrefixLineMatch = MERMAID_PREFIX_LINE_PATTERN.exec(body);
  }

  return { prefix, body };
}
