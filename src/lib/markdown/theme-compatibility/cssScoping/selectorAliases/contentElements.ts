export function normalizeContentElementAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_CONTENT_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])figure\.table-figure(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(figure.table-figure, .milkdown-table-block.table-figure)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.el-pre\s+pre\s+code(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(.el-pre.code-block-container .cm-content, .el-pre .code-block-lazy-preview)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.el-pre\s+pre(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(.el-pre.code-block-container, .el-pre .code-block-lazy-preview)')}`
    )
    .replace(
      /(^|[\s>+~,(])(?:div|span)((?:\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, attrSelectors: string) => {
        if (!/\[\s*src\b/i.test(attrSelectors)) return match;
        return `${prefix}${stash(`.image-block-container${attrSelectors}`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])((?:\.md-image|\[[^\]]+\])+)\s*>\s*img(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, mdImageCompound: string) => {
        if (!isImageAliasCompound(mdImageCompound)) return match;
        return `${prefix}${stash(renderImageAliasWithImage(mdImageCompound))}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])((?:\.md-image|\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, mdImageCompound: string) => {
        if (!isImageAliasCompound(mdImageCompound)) return match;
        return `${prefix}${stash(renderImageAliasCompound(mdImageCompound))}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])img((?:\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, attrSelectors: string) => {
        if (!/\[\s*src\b/i.test(attrSelectors)) return match;
        return `${prefix}${stash(`:is(img${attrSelectors}, .image-block-container${attrSelectors} img)`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])pre\s+code(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(pre code, .code-block-container .cm-content)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.style\s+\.token\.string(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.language-css .token.string')}`
    )
    .replace(
      /(^|[\s>+~,(])\.mathjax-block(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(.mathjax-block, [data-type="math-block"], .math-block-wrapper)')}`
    )
    .replace(
      /(^|[\s>+~,(])table\.v-freeze\.auto(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(table.v-freeze.auto, .milkdown-table-block.v-freeze.auto table)')}`
    )
    .replace(/(^|[\s>+~,(])pre(?=\.md-meta-block\b)/gi, '$1')
    .replace(/(^|[\s>+~,(])pre(?=\.md-fences\b)/gi, '$1')
    .replace(
      /(^|[\s>+~,(])pre\.ty-contain-cm(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.code-block-container')}`
    )
    .replace(
      /(^|[\s>+~,(])pre(\[[^\]]*language-[^\]]*\])(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string, attrSelector: string) =>
        `${prefix}${stash(`:is(pre${attrSelector}, .code-block-container${attrSelector})`)}`
    )
    .replace(
      /(^|[\s>+~,(])pre:not\(\.frontmatter\)(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(
          ':is(pre:not([data-type="frontmatter"]), .code-block-container:not(.frontmatter-block-container))'
        )}`
    )
    .replace(
      /(^|[\s>+~,(])pre(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(pre, .code-block-container)')}`
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_CONTENT_ALIAS_${index}__`, value);
  });

  return result;
}

function renderImageAliasWithImage(mdImageCompound: string): string {
  return `:is(${mdImageCompound} > img, ${renderImageContainerCompound(mdImageCompound)} img)`;
}

function renderImageAliasCompound(mdImageCompound: string): string {
  return `:is(${mdImageCompound}, ${renderImageContainerCompound(mdImageCompound)})`;
}

function renderImageContainerCompound(mdImageCompound: string): string {
  return mdImageCompound
    .replace(/\.md-image\b/gi, '.image-block-container')
    .replace(/\[\s*md-inline\s*=\s*(?:"image"|'image'|image)\s*\]/gi, '.image-block-container');
}

function isImageAliasCompound(compound: string): boolean {
  return /\.md-image\b/i.test(compound)
    || /\[\s*md-inline\s*=\s*(?:"image"|'image'|image)\s*\]/i.test(compound);
}
