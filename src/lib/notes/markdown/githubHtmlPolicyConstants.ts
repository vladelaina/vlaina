export const GITHUB_ALLOWED_HTML_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'tt',
  'div', 'ins', 'del', 'sup', 'sub', 'p', 'picture',
  'ol', 'ul', 'table', 'thead', 'tbody', 'tfoot', 'blockquote',
  'dl', 'dt', 'dd', 'kbd', 'q', 'samp', 'var', 'hr', 'ruby', 'rt', 'rp',
  'li', 'tr', 'td', 'th', 's', 'strike', 'summary', 'details', 'caption',
  'figure', 'figcaption', 'abbr', 'bdo', 'cite', 'dfn', 'mark', 'small',
  'source', 'span', 'time', 'wbr', 'video', 'audio', 'iframe', 'track',
]);

export const GITHUB_DROP_WITH_CONTENT_TAGS = new Set([
  'script', 'style', 'title', 'textarea', 'xmp', 'noembed',
  'noframes', 'plaintext', 'math', 'noscript', 'svg',
]);

export const GITHUB_GFM_DISALLOWED_RAW_HTML_TAGS = new Set([
  'title', 'textarea', 'style', 'xmp', 'noembed', 'noframes',
  'script', 'plaintext',
]);

export const GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS = new Set([
  'math', 'noscript', 'svg',
]);

export const GITHUB_WRAP_CONTENT_WITH_WHITESPACE_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
  'li', 'nav', 'ol', 'p', 'pre', 'section', 'ul',
]);

export const GITHUB_ALLOWED_GLOBAL_ATTRIBUTES = new Set([
  'abbr', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt',
  'aria-describedby', 'aria-hidden', 'aria-label', 'aria-labelledby', 'axis',
  'border', 'char', 'charoff', 'charset', 'checked', 'clear', 'cols', 'colspan',
  'compact', 'coords', 'datetime', 'dir', 'disabled', 'enctype', 'for', 'frame',
  'headers', 'height', 'hreflang', 'hspace', 'ismap', 'label', 'lang',
  'maxlength', 'media', 'method', 'multiple', 'name', 'nohref', 'noshade',
  'nowrap', 'open', 'progress', 'prompt', 'readonly', 'rel', 'rev', 'role',
  'rows', 'rowspan', 'rules', 'scope', 'selected', 'shape', 'size', 'span',
  'start', 'style', 'summary', 'tabindex', 'title', 'type', 'usemap', 'valign', 'value',
  'width', 'itemprop',
]);

export const GITHUB_ALLOWED_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href']),
  img: new Set(['src', 'longdesc', 'loading', 'alt']),
  div: new Set(['itemscope', 'itemtype']),
  blockquote: new Set(['cite']),
  del: new Set(['cite']),
  ins: new Set(['cite']),
  q: new Set(['cite']),
  source: new Set(['src', 'srcset', 'type', 'media']),
  video: new Set(['src', 'poster', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'playsinline']),
  audio: new Set(['src', 'controls', 'autoplay', 'loop', 'muted', 'preload']),
  track: new Set(['src', 'kind', 'srclang', 'label', 'default']),
  iframe: new Set([
    'src', 'sandbox', 'allow', 'allowfullscreen', 'allowtransparency',
    'frameborder', 'scrolling', 'referrerpolicy', 'loading',
  ]),
};

export const GITHUB_URL_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href']),
  img: new Set(['src', 'longdesc']),
  blockquote: new Set(['cite']),
  del: new Set(['cite']),
  ins: new Set(['cite']),
  q: new Set(['cite']),
  source: new Set(['src']),
  video: new Set(['src', 'poster']),
  audio: new Set(['src']),
  track: new Set(['src']),
  iframe: new Set(['src']),
};

export const GITHUB_SRCSET_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  source: new Set(['srcset']),
};

export const GITHUB_LOADABLE_OR_URL_ATTRIBUTES = new Set([
  'action',
  'cite',
  'formaction',
  'href',
  'longdesc',
  'poster',
  'src',
  'srcset',
]);

export const GITHUB_ALLOWED_RELATIVE_PROTOCOL_MARKERS = new Set(['#', '/']);
export const GITHUB_ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'weixin:']);
export const GITHUB_ALLOWED_MEDIA_PROTOCOLS = new Set(['http:', 'https:']);
export const GITHUB_FORCED_IFRAME_SANDBOX = 'allow-scripts';
export const GITHUB_ALLOWED_IFRAME_SANDBOX_TOKENS = new Set(['allow-scripts', 'allow-forms', 'allow-popups', 'allow-presentation']);
export const GITHUB_ALLOWED_IFRAME_ALLOW_FEATURES = new Set([
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'gyroscope',
  'picture-in-picture',
]);
export const GITHUB_ALLOWED_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-color',
  'border-radius',
  'border-style',
  'border-width',
  'color',
  'display',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'vertical-align',
  'width',
]);
