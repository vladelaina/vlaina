import { defaultSchema } from 'rehype-sanitize';
import {
  normalizeRenderableDataImageSrc,
  normalizeRenderableImageSrcset,
} from './renderableImagePolicy';

export { isRenderableDataImageSrc, normalizeRenderableDataImageSrc, normalizeRenderableImageSrc, normalizeRenderableImageSrcset } from './renderableImagePolicy';

const SAFE_COLOR_STYLE_PATTERN = /^(?:color|background-color)\s*:\s*(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[-+.\d%]+\s*(?:,\s*[-+.\d%]+\s*){2,3}\)|var\(--[A-Za-z0-9_-]+\)|[A-Za-z]+)$/i;
const SAFE_TEXT_ALIGN_STYLE_PATTERN = /^text-align\s*:\s*(?:center|right)$/i;
const SAFE_TOC_INDENT_STYLE_PATTERN = /^padding-left\s*:\s*(?:0|16|32|48|64|80)px$/i;
const MAX_IMAGE_POLICY_HAST_DEPTH = 200;
const MAX_IMAGE_POLICY_HAST_NODES = 20_000;

const DATA_IMAGE_SRC_ATTRIBUTES_BY_TAG: Record<string, readonly string[]> = {
  img: ['src'],
  source: ['src'],
  video: ['poster'],
};

function visitImagePolicyNodes(root: any, visitor: (node: any) => void): void {
  const queue = [{ depth: 0, node: root }];
  let visitedNodes = 1;

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];
    const node = current.node;
    if (!node || typeof node !== 'object') {
      continue;
    }

    visitor(node);

    const children = node.children;
    if (!Array.isArray(children)) {
      continue;
    }

    if (current.depth >= MAX_IMAGE_POLICY_HAST_DEPTH) {
      node.children = [];
      continue;
    }

    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      if (!child) {
        children.splice(childIndex, 1);
        childIndex -= 1;
        continue;
      }

      visitedNodes += 1;
      if (visitedNodes > MAX_IMAGE_POLICY_HAST_NODES) {
        children.splice(childIndex);
        break;
      }

      queue.push({ depth: current.depth + 1, node: child });
    }
  }
}

function normalizeImageSrcProperties(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'element' && node.properties && typeof node.properties === 'object') {
    const tagName = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : '';
    for (const key of DATA_IMAGE_SRC_ATTRIBUTES_BY_TAG[tagName] ?? []) {
      if (!Object.prototype.hasOwnProperty.call(node.properties, key)) {
        continue;
      }
      const normalized = normalizeRenderableDataImageSrc(String(node.properties[key] || ''));
      if (normalized) {
        node.properties[key] = normalized;
      }
    }
  }
}

function sanitizeImageSrcsetProperties(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'element' && node.properties && typeof node.properties === 'object') {
    for (const key of ['srcSet', 'srcset']) {
      if (!Object.prototype.hasOwnProperty.call(node.properties, key)) {
        continue;
      }
      const normalized = normalizeRenderableImageSrcset(String(node.properties[key] || ''));
      if (normalized) {
        node.properties[key] = normalized;
      } else {
        delete node.properties[key];
      }
    }
  }
}

export function rehypeImageSrcSanitizer() {
  return (tree: any) => {
    visitImagePolicyNodes(tree, normalizeImageSrcProperties);
  };
}

export function rehypeImageSrcsetSanitizer() {
  return (tree: any) => {
    visitImagePolicyNodes(tree, sanitizeImageSrcsetProperties);
  };
}

export function createMarkdownSanitizeSchema() {
  const protocols = (defaultSchema.protocols || {}) as Record<string, string[]>;
  const hrefProtocols = protocols.href || [];
  const srcProtocols = protocols.src || [];
  const tagNames = Array.isArray(defaultSchema.tagNames) ? defaultSchema.tagNames : [];
  const attributes = (defaultSchema.attributes || {}) as Record<string, Array<string | [string, ...unknown[]]>>;

  const colorStyleAttribute: [string, RegExp] = ['style', SAFE_COLOR_STYLE_PATTERN];
  const textAlignStyleAttribute: [string, RegExp] = ['style', SAFE_TEXT_ALIGN_STYLE_PATTERN];
  const tocIndentStyleAttribute: [string, RegExp] = ['style', SAFE_TOC_INDENT_STYLE_PATTERN];
  const generatedDivTypeAttribute: [string, 'toc', 'callout'] = ['dataType', 'toc', 'callout'];
  const alignedBlockAttributes = ['dataTextAlign', textAlignStyleAttribute] as const;

  return {
    ...defaultSchema,
    tagNames: Array.from(new Set([...tagNames, 'abbr', 'mark', 'sup', 'sub', 'u'])),
    required: {
      ...(defaultSchema.required || {}),
    },
    protocols: {
      ...protocols,
      href: Array.from(new Set([...hrefProtocols, 'tel'])),
      src: Array.from(new Set([...srcProtocols, 'http', 'https', 'data', 'blob', 'asset', 'attachment', 'app-file'])),
    },
    attributes: {
      ...attributes,
      mark: Array.from(new Set([...(attributes.mark || []), 'className', 'dataBgColor'])).concat([
        colorStyleAttribute,
      ]),
      sup: Array.from(new Set([...(attributes.sup || []), 'className'])),
      sub: Array.from(new Set([...(attributes.sub || []), 'className'])),
      u: Array.from(new Set([...(attributes.u || []), 'className'])),
      abbr: Array.from(new Set([...(attributes.abbr || []), 'className', 'title'])),
      a: Array.from(new Set([...(attributes.a || []), 'className'])),
      span: Array.from(new Set([...(attributes.span || []), 'className', 'dataTextColor'])).concat([
        colorStyleAttribute,
      ]),
      ul: Array.from(new Set([...(attributes.ul || []), 'className'])),
      li: Array.from(new Set([...(attributes.li || []), 'className'])).concat([tocIndentStyleAttribute]),
      dl: Array.from(new Set([...(attributes.dl || []), 'className'])),
      dt: Array.from(new Set([...(attributes.dt || []), 'className'])),
      dd: Array.from(new Set([...(attributes.dd || []), 'className'])),
      img: Array.from(new Set([
        ...(attributes.img || []),
        'align',
        'width',
        'dataVlainaCrop',
      ])),
      p: Array.from(new Set([...(attributes.p || []), 'dataTextAlign'])).concat([textAlignStyleAttribute]),
      h1: Array.from(new Set([...(attributes.h1 || []), ...alignedBlockAttributes, 'id'])),
      h2: Array.from(new Set([...(attributes.h2 || []), ...alignedBlockAttributes, 'id'])),
      h3: Array.from(new Set([...(attributes.h3 || []), ...alignedBlockAttributes, 'id'])),
      h4: Array.from(new Set([...(attributes.h4 || []), ...alignedBlockAttributes, 'id'])),
      h5: Array.from(new Set([...(attributes.h5 || []), ...alignedBlockAttributes, 'id'])),
      h6: Array.from(new Set([...(attributes.h6 || []), ...alignedBlockAttributes, 'id'])),
      div: Array.from(new Set([...(attributes.div || []), 'className'])).concat([
        generatedDivTypeAttribute,
      ]),
    },
  };
}
