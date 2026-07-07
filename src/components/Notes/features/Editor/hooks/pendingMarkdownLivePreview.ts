import {
  serializeEditorMarkdownSnapshot,
} from '../utils/pendingMarkdownUpdate';

const LIVE_PREVIEW_EDITOR_ARTIFACT_PATTERN =
  /(?:vlaina-markdown-|vlaina-rendered-html-boundary-blank-line|dat[ae]-vlaina|VLAINA_|[\u200B\u200C\u2800]|<br\b|&#(?:x0*20|0*32)(?:;|(?=$|[ \t])))/i;

export function publishLiveMarkdownPreview(path: string | undefined, content: string) {
  if (!path || typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('editor:note-markdown-preview', {
    detail: { path, content },
  }));
}

export function getLiveMarkdownPreviewContent(markdown: string, referenceMarkdown: string): string {
  if (!LIVE_PREVIEW_EDITOR_ARTIFACT_PATTERN.test(markdown)) {
    return markdown;
  }

  return serializeEditorMarkdownSnapshot(markdown, referenceMarkdown);
}
