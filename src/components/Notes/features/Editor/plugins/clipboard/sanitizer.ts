import {
  GITHUB_ALLOWED_HTML_TAGS,
  GITHUB_ALLOWED_LINK_PROTOCOLS,
  GITHUB_ALLOWED_MEDIA_PROTOCOLS,
  GITHUB_DROP_WITH_CONTENT_TAGS,
  GITHUB_WRAP_CONTENT_WITH_WHITESPACE_TAGS,
  hasGithubProtocol,
  isGithubAllowedAttribute,
  isGithubSrcsetAttribute,
  isGithubUrlAttribute,
  normalizeGithubSrcset,
  normalizeGithubUrl,
} from '@/lib/notes/markdown/githubHtmlPolicy';

function sanitizeChildren(source: Element | DocumentFragment, target: Element | DocumentFragment): void {
  for (const child of Array.from(source.childNodes)) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      target.appendChild(sanitizedChild);
    }
  }
}

function sanitizeElement(element: Element): Node | null {
  const tagName = element.tagName.toLowerCase();
  const attributeNames = element.getAttributeNames();

  if (GITHUB_DROP_WITH_CONTENT_TAGS.has(tagName)) {
    return null;
  }

  if (attributeNames.some((attributeName) => attributeName.startsWith('<!--'))) {
    return null;
  }

  if (!GITHUB_ALLOWED_HTML_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    if (GITHUB_WRAP_CONTENT_WITH_WHITESPACE_TAGS.has(tagName)) {
      fragment.appendChild(document.createTextNode(' '));
    }
    sanitizeChildren(element, fragment);
    if (GITHUB_WRAP_CONTENT_WITH_WHITESPACE_TAGS.has(tagName)) {
      fragment.appendChild(document.createTextNode(' '));
    }
    return fragment;
  }

  const sanitized = document.createElement(tagName);
  for (const attributeName of attributeNames) {
    const normalizedAttribute = attributeName.toLowerCase();
    if (!isGithubAllowedAttribute(tagName, normalizedAttribute)) {
      continue;
    }

    const value = element.getAttribute(attributeName);
    if (value === null) {
      continue;
    }

    if (isGithubUrlAttribute(tagName, normalizedAttribute)) {
      const protocols = tagName === 'a' ? GITHUB_ALLOWED_LINK_PROTOCOLS : GITHUB_ALLOWED_MEDIA_PROTOCOLS;
      const normalizedUrl = normalizeGithubUrl(value, protocols, { blockLocalNetwork: tagName !== 'a' });
      if (normalizedUrl) {
        sanitized.setAttribute(normalizedAttribute, normalizedUrl);
      }
      continue;
    }

    if (isGithubSrcsetAttribute(tagName, normalizedAttribute)) {
      const normalizedSrcset = normalizeGithubSrcset(value);
      if (normalizedSrcset) {
        sanitized.setAttribute(normalizedAttribute, normalizedSrcset);
      }
      continue;
    }

    if (hasGithubProtocol(value)) {
      continue;
    }

    sanitized.setAttribute(normalizedAttribute, value);
  }

  sanitizeChildren(element, sanitized);
  return sanitized;
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return sanitizeElement(node as Element);
  }

  return null;
}

export function sanitizeHtml(html: string): string {
  if (!html) return html;

  try {
    const template = document.createElement('template');
    template.innerHTML = html;

    const output = document.createElement('template');
    sanitizeChildren(template.content, output.content);
    return output.innerHTML;
  } catch (e) {
    console.error('[Clipboard/Sanitizer] Failed to sanitize HTML:', e);
    return html;
  }
}
