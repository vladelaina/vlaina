import { floatingToolbarPlugin } from '../plugins/floating-toolbar/floatingToolbarPlugin';
import { colorMarksPlugin } from '../plugins/floating-toolbar/colorMarks';
import { blockAlignmentPlugin } from '../plugins/floating-toolbar/blockAlignmentMarkdown';
import { headingPlugin } from '../plugins/heading/headingPlugin';
import { collapsePlugin } from '../plugins/heading/collapse';
import { mathPlugin } from '../plugins/math/mathPlugin';
import { mathEditorPlugin } from '../plugins/math/mathEditorPlugin';
import { slashPlugin } from '../plugins/slash/slashPlugin';
import { emojiShortcutPlugin } from '../plugins/emoji-shortcut/emojiShortcutPlugin';
import { calloutPlugin } from '../plugins/callout/calloutPlugin';
import { tablePlugin } from '../plugins/table/tablePlugin';
import { selectAllPlugin } from '../plugins/select-all/selectAllPlugin';
import { highlightPlugin } from '../plugins/highlight/highlightPlugin';
import { footnotePlugin } from '../plugins/footnote/footnotePlugin';
import { deflistPlugin } from '../plugins/deflist/deflistPlugin';
import { autolinkPlugin } from '../plugins/links/autolink/autolinkPlugin';
import { linkTooltipPlugin } from '../plugins/links/tooltip/linkTooltipPlugin';
import { tocPlugin } from '../plugins/toc/tocPlugin';
import { mermaidPlugin } from '../plugins/mermaid/mermaidPlugin';
import { mermaidEditorPlugin } from '../plugins/mermaid/mermaidEditorPlugin';
import { codePlugin } from '../plugins/code/codePlugin';
import { codeBlockPlugins } from '../plugins/code/codeKeymap';
import { frontmatterPlugin } from '../plugins/frontmatter/frontmatterPlugin';
import { videoPlugin } from '../plugins/video/videoPlugin';
import { abbrPlugin } from '../plugins/abbr/abbrPlugin';
import { taskListClickPlugin } from '../plugins/task-list/taskListClickPlugin';
import { listTabIndentPlugin } from '../plugins/task-list/listTabIndentPlugin';
import { listCollapsePlugin } from '../plugins/collapse/listCollapse';
import { markdownLinkPlugin } from '../plugins/links/markdown-link/markdownLinkPlugin';
import { clipboardPlugin } from '../plugins/clipboard/clipboardPlugin';
import { imageBlockPlugin } from '../plugins/image-block';
import { imageUploadPlugin } from '../plugins/image-upload/imageUploadPlugin';
import { textSelectionOverlayPlugin } from '../plugins/selection/textSelectionOverlayPlugin';
import { editorFindPlugin } from '../plugins/find/editorFindPlugin';
import { blankAreaDragBoxPlugin } from '../plugins/cursor/blankAreaDragBoxPlugin';
import { blockControlsPlugin } from '../plugins/cursor/blockControlsPlugin';
import { textBlockCaretOverlayPlugin } from '../plugins/cursor/textBlockCaretOverlayPlugin';
import { atomicBlockKeyboardNavigationPlugin } from '../plugins/cursor/atomicBlockKeyboardNavigationPlugin';
import { endBlankClickPlugin } from '../plugins/cursor/endBlankClickPlugin';
import { nativeDragGuardPlugin } from '../plugins/cursor/nativeDragGuard';
import { externalTextDropCursorPlugin } from '../plugins/cursor/externalTextDropCursorPlugin';
import { containerBoundaryShiftSelectionPlugin } from '../plugins/cursor/containerBoundaryShiftSelectionPlugin';
import { hrAutoParagraphPlugin } from '../plugins/hr/hrAutoParagraphPlugin';
import { autoPairPlugin } from '../plugins/pairs/autoPairPlugin';
import { titleNavigationPlugin } from '../plugins/cursor/titleNavigationPlugin';
import { typewriterModePlugin } from '../plugins/cursor/typewriterModePlugin';
import { editorShortcutsPlugin } from '../plugins/editorShortcutsPlugin';

export const customPluginGroups = [
  {
    name: 'floating-toolbar',
    plugins: [
      floatingToolbarPlugin,
      ...colorMarksPlugin,
      ...blockAlignmentPlugin,
    ],
  },
  {
    name: 'headings',
    plugins: [
      ...headingPlugin,
      collapsePlugin,
    ],
  },
  {
    name: 'math',
    plugins: [
      ...mathPlugin,
      mathEditorPlugin,
    ],
  },
  {
    name: 'blocks',
    plugins: [
      slashPlugin,
      emojiShortcutPlugin,
      ...calloutPlugin,
      ...tablePlugin,
      selectAllPlugin,
      ...highlightPlugin,
      ...footnotePlugin,
      ...deflistPlugin,
    ],
  },
  {
    name: 'links',
    plugins: [
      autolinkPlugin,
      linkTooltipPlugin,
      markdownLinkPlugin,
    ],
  },
  {
    name: 'generated-blocks',
    plugins: [
      ...tocPlugin,
      ...mermaidPlugin,
      mermaidEditorPlugin,
      ...frontmatterPlugin,
      ...codePlugin,
      ...codeBlockPlugins,
      ...videoPlugin,
      ...abbrPlugin,
    ],
  },
  {
    name: 'lists-clipboard-images',
    plugins: [
      taskListClickPlugin,
      listTabIndentPlugin,
      listCollapsePlugin,
      clipboardPlugin,
      imageUploadPlugin,
      ...imageBlockPlugin,
    ],
  },
  {
    name: 'interaction-overlays',
    plugins: [
      textSelectionOverlayPlugin,
      editorFindPlugin,
      nativeDragGuardPlugin,
      externalTextDropCursorPlugin,
      blockControlsPlugin,
      blankAreaDragBoxPlugin,
      textBlockCaretOverlayPlugin,
      atomicBlockKeyboardNavigationPlugin,
      containerBoundaryShiftSelectionPlugin,
      autoPairPlugin,
      hrAutoParagraphPlugin,
      endBlankClickPlugin,
      titleNavigationPlugin,
      typewriterModePlugin,
      editorShortcutsPlugin,
    ],
  },
];

export const customPlugins = customPluginGroups.flatMap((group) => group.plugins);
