export function normalizeCodeMirrorElementAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_CODEMIRROR_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-focused\s+\.CodeMirror-activeline-gutter\s*\+\s*\.CodeMirror-line(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-editor.cm-focused .cm-activeLine')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-focused\s+\.CodeMirror-activeline\s+\.CodeMirror-linenumber(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-editor.cm-focused .cm-activeLineGutter')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-activeline-background(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-activeLine')}`
    )
    .replace(
      /(^|[\s>+~,(])\.cm-gutterElement\.cm-active(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-gutterElement.cm-activeLineGutter')}`
    )
    .replace(
      /(^|[\s>+~,(])([a-z][\w-]*)\.CodeMirror-cursor(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string, element: string) => `${prefix}${stash(`${element}.cm-cursor`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-cursor(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-cursor')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-gutters(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-gutters')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-linenumber(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(.cm-lineNumbers .cm-gutterElement, .code-block-lazy-line-numbers)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-lines(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-content')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-scroll(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-scroller')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-line(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-line')}`
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_CODEMIRROR_ALIAS_${index}__`, value);
  });

  return result;
}
