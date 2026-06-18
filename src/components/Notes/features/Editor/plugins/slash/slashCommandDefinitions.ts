import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import type { IconName } from '@/components/ui/icons';
import type { MessageKey } from '@/lib/i18n';
import { convertBlockType } from '../floating-toolbar/blockCommands';
import { insertImageFromFilePicker, insertFrontmatter } from './slashFileCommands';
import { insertFootnoteDef, insertFootnoteRef } from './slashFootnoteCommands';
import { insertHtmlBlockNodeAndOpenEditor } from './slashHtmlCommands';
import { insertMathNodeAndOpenEditor } from './slashMathCommands';
import { insertMermaidNodeAndOpenEditor } from './slashMermaidCommands';
import { openVideoPrompt } from './slashVideoCommand';

export {
  collectFootnoteIds,
  getNextFootnoteDefId,
  getNextFootnoteRefId,
} from './slashFootnoteCommands';

interface SlashCommandDefinition {
  id: string;
  nameKey: MessageKey;
  icon: IconName;
  searchTerms: string[];
  commandId: string;
  run: (ctx: Ctx) => boolean | void | Promise<void>;
}

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    markSlashUserInput(view);
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  } catch (error) {
  }
}

function replaceCurrentTextBlockWithParagraphText(ctx: Ctx, text: string) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { $from } = state.selection;
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph || !$from.parent.isTextblock) return;

  const textNode = state.schema.text(text);
  const from = $from.before();
  const to = $from.after();
  const nextNode = paragraph.create(null, textNode);
  const tr = state.tr.replaceWith(from, to, nextNode);

  tr.setSelection(TextSelection.create(tr.doc, from + 1 + text.length)).scrollIntoView();
  markSlashUserInput(view);
  dispatch(tr);
}

function convertCurrentBlock(ctx: Ctx, blockType: Parameters<typeof convertBlockType>[1]) {
  const view = ctx.get(editorViewCtx);
  convertBlockType(view, blockType);
}

const localizedSearchTerms = {
  heading: ['titre', 'encabezado', 'titulo', 'uberschrift', 'intestazione', 'cabecalho', 'заголовок', 'baslik', 'tieu de', 'judul', 'หัวข้อ', '見出し', '제목'],
  taskList: ['tache', 'aufgabe', 'tarea', 'tarefa', 'attivita', 'задача', 'gorev', 'nhiem vu', 'cong viec', 'tugas', 'งาน', 'タスク', '할 일'],
  orderedList: ['liste numerotee', 'nummerierte liste', 'lista numerada', 'elenco numerato', 'нумерованный список', 'sirali liste', 'danh sach danh so', 'daftar bernomor', 'รายการลำดับเลข', '番号付き', '번호'],
  bulletList: ['liste a puces', 'aufzahlung', 'vinetas', 'marcadores', 'elenco puntato', 'маркированный список', 'madde imi', 'danh sach gach dau dong', 'daftar berpoin', '箇条書き', '글머리'],
  quote: ['citation', 'cita', 'citacao', 'citazione', 'zitat', 'цитата', 'alinti', 'trich dan', 'kutipan', '引用', '인용'],
  callout: ['remarque', 'nota', 'hinweis', 'advertencia', 'aviso', 'attenzione', 'предупреждение', 'uyari', 'chu y', 'peringatan', '注意', '주의'],
  divider: ['separateur', 'trenner', 'divisor', 'separador', 'разделитель', 'ayirici', 'phan cach', 'pemisah', '区切り', '구분선'],
  code: ['codigo', 'codice', 'код', 'kod', 'ma', 'kode', 'コード', '코드'],
  table: ['tableau', 'tabelle', 'tabla', 'tabela', 'tabella', 'таблица', 'tablo', 'bang', 'tabel', 'ตาราง', '表', '테이블'],
  image: ['imagen', 'imagem', 'bild', 'immagine', 'изображение', 'resim', 'anh', 'gambar', 'รูปภาพ', '画像', '이미지'],
  frontmatter: ['proprietes', 'propiedades', 'eigenschaften', 'metadados', 'metadati', 'свойства', 'ozellikler', 'thuoc tinh', 'properti', 'メタデータ', '속성'],
  equation: ['equation', 'ecuacion', 'gleichung', 'equazione', 'equacao', 'уравнение', 'denklem', 'phuong trinh', 'persamaan', '数式', '수식'],
  inlineMath: ['inline equation', 'equation inline', 'ecuacion en linea', 'formule en ligne', 'inline gleichung', 'formula em linha', '行内', 'インライン', '인라인'],
  toc: ['sommaire', 'table des matieres', 'indice', 'inhaltsverzeichnis', 'sumario', 'оглавление', 'icindekiler', 'muc luc', 'daftar isi', '目次', '목차'],
  mermaid: ['diagramme', 'diagrama', 'диаграмма', 'diyagram', 'so do', 'bagan', 'แผนภาพ', '図', '다이어그램'],
  html: ['html block', 'bloc html', 'bloque html', 'bloco html', 'html-block', 'html块', 'html區塊', 'htmlブロック', 'html 블록'],
  footnote: ['note de bas de page', 'nota al pie', 'fussnote', 'nota de rodape', 'nota a pie', 'сноска', 'dipnot', 'catatan kaki', 'chu thich', '脚注', '각주'],
  abbreviation: ['abreviation', 'abreviatura', 'abkurzung', 'abbreviazione', 'сокращение', 'kisaltma', 'singkatan', 'tu viet tat', '略語', '약어'],
  video: ['video', 'film', 'filme', 'vídeo', 'видео', 'vidyo', 'phim', 'วิดีโอ', '動画', '동영상'],
} as const;

export const slashCommandDefinitions = [
  {
    id: 'heading-1',
    nameKey: 'editor.blockType.heading1',
    icon: 'editor.heading1',
    searchTerms: ['h1', 'title', 'heading', 'header', 'heading one', '标题', '一级标题', '大标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-1',
    run: (ctx) => convertCurrentBlock(ctx, 'heading1'),
  },
  {
    id: 'heading-2',
    nameKey: 'editor.blockType.heading2',
    icon: 'editor.heading2',
    searchTerms: ['h2', 'heading', 'header', 'heading two', '标题', '二级标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-2',
    run: (ctx) => convertCurrentBlock(ctx, 'heading2'),
  },
  {
    id: 'heading-3',
    nameKey: 'editor.blockType.heading3',
    icon: 'editor.heading3',
    searchTerms: ['h3', 'heading', 'header', 'heading three', '标题', '三级标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-3',
    run: (ctx) => convertCurrentBlock(ctx, 'heading3'),
  },
  {
    id: 'heading-4',
    nameKey: 'editor.blockType.heading4',
    icon: 'editor.heading4',
    searchTerms: ['h4', 'heading', 'header', 'heading four', '标题', '四级标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-4',
    run: (ctx) => convertCurrentBlock(ctx, 'heading4'),
  },
  {
    id: 'heading-5',
    nameKey: 'editor.blockType.heading5',
    icon: 'editor.heading5',
    searchTerms: ['h5', 'heading', 'header', 'heading five', '标题', '五级标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-5',
    run: (ctx) => convertCurrentBlock(ctx, 'heading5'),
  },
  {
    id: 'heading-6',
    nameKey: 'editor.blockType.heading6',
    icon: 'editor.heading6',
    searchTerms: ['h6', 'heading', 'header', 'heading six', '标题', '六级标题', 'biaoti', 'bt', ...localizedSearchTerms.heading],
    commandId: 'heading-6',
    run: (ctx) => convertCurrentBlock(ctx, 'heading6'),
  },
  {
    id: 'task-list',
    nameKey: 'editor.blockType.taskList',
    icon: 'editor.taskList',
    searchTerms: ['todo', 'td', 'checkbox', 'checklist', 'task', 'tasks', '任务', '待办', '清单', '复选框', 'renwu', 'daiban', ...localizedSearchTerms.taskList],
    commandId: 'task-list',
    run: (ctx) => convertCurrentBlock(ctx, 'taskList'),
  },
  {
    id: 'ordered-list',
    nameKey: 'editor.blockType.orderedList',
    icon: 'editor.listOrdered',
    searchTerms: ['ol', 'ordered', 'numbered', 'number list', '编号', '有序', '数字列表', 'bianhao', 'youxu', ...localizedSearchTerms.orderedList],
    commandId: 'ordered-list',
    run: (ctx) => convertCurrentBlock(ctx, 'orderedList'),
  },
  {
    id: 'bullet-list',
    nameKey: 'editor.blockType.bulletList',
    icon: 'editor.list',
    searchTerms: ['ul', 'unordered', 'bullet', 'bullets', '项目', '无序', '列表', '项目列表', 'wuxu', 'liebiao', ...localizedSearchTerms.bulletList],
    commandId: 'bullet-list',
    run: (ctx) => convertCurrentBlock(ctx, 'bulletList'),
  },
  {
    id: 'quote',
    nameKey: 'editor.blockType.blockquote',
    icon: 'common.quote',
    searchTerms: ['blockquote', 'cite', 'citation', 'quote block', '引用', '引文', 'yinyong', ...localizedSearchTerms.quote],
    commandId: 'quote',
    run: (ctx) => convertCurrentBlock(ctx, 'blockquote'),
  },
  {
    id: 'callout',
    nameKey: 'editor.slash.callout',
    icon: 'common.info',
    searchTerms: ['note', 'tip', 'warning', 'info', 'notice', 'alert', 'admonition', '标注', '提示', '警告', '信息', '注意', 'biaozhu', 'tishi', ...localizedSearchTerms.callout],
    commandId: 'callout',
    run: (ctx) =>
      insertNode(ctx, 'callout', {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      }),
  },
  {
    id: 'divider',
    nameKey: 'editor.slash.divider',
    icon: 'editor.divider',
    searchTerms: ['hr', 'line', 'separator', 'rule', 'horizontal rule', 'divider line', '分割', '分隔', '分割线', '分隔线', 'fengexian', ...localizedSearchTerms.divider],
    commandId: 'divider',
    run: (ctx) => {
      markSlashUserInput(ctx.get(editorViewCtx));
      ctx.get(commandsCtx).call(insertHrCommand.key);
    },
  },
  {
    id: 'code-block',
    nameKey: 'editor.blockType.codeBlock',
    icon: 'editor.code',
    searchTerms: ['code', 'pre', 'snippet', 'program', '代码', '代码块', '片段', 'daima', ...localizedSearchTerms.code],
    commandId: 'code-block',
    run: (ctx) => convertCurrentBlock(ctx, 'codeBlock'),
  },
  {
    id: 'table',
    nameKey: 'editor.slash.table',
    icon: 'editor.table',
    searchTerms: ['grid', 'spreadsheet', 'rows', 'columns', '表格', '网格', 'biaoge', ...localizedSearchTerms.table],
    commandId: 'table',
    run: (ctx) => {
      markSlashUserInput(ctx.get(editorViewCtx));
      ctx.get(commandsCtx).call(insertTableCommand.key);
    },
  },
  {
    id: 'image',
    nameKey: 'editor.slash.image',
    icon: 'file.image',
    searchTerms: ['img', 'picture', 'photo', 'figure', 'upload', '图片', '图像', '照片', 'tupian', 'zhaopian', ...localizedSearchTerms.image],
    commandId: 'image',
    run: insertImageFromFilePicker,
  },
  {
    id: 'frontmatter',
    nameKey: 'editor.slash.frontmatter',
    icon: 'editor.frontmatter',
    searchTerms: ['yaml', 'metadata', 'properties', 'attrs', 'attributes', 'front matter', '属性', '属性区', '元数据', '元信息', 'shuxing', 'yuanshuju', ...localizedSearchTerms.frontmatter],
    commandId: 'frontmatter',
    run: insertFrontmatter,
  },
  {
    id: 'equation',
    nameKey: 'editor.slash.equation',
    icon: 'editor.equation',
    searchTerms: ['math', 'latex', 'formula', 'display math', 'block math', 'equation block', '数学', '公式', '块公式', 'shuxue', 'gongshi', ...localizedSearchTerms.equation],
    commandId: 'equation',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_block'),
  },
  {
    id: 'inline-math',
    nameKey: 'editor.slash.inlineMath',
    icon: 'editor.inlineMath',
    searchTerms: ['math inline', 'latex inline', 'formula inline', 'inline formula', '行内数学', '行内公式', '内联公式', 'hangnei', 'gongshi', ...localizedSearchTerms.inlineMath],
    commandId: 'inline-math',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_inline'),
  },
  {
    id: 'toc',
    nameKey: 'editor.slash.tableOfContents',
    icon: 'editor.toc',
    searchTerms: ['toc', 'contents', 'outline', 'table contents', '目录', '大纲', 'mulu', 'dagang', ...localizedSearchTerms.toc],
    commandId: 'toc',
    run: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 }),
  },
  {
    id: 'mermaid',
    nameKey: 'editor.slash.mermaidDiagram',
    icon: 'editor.diagram',
    searchTerms: ['diagram', 'flowchart', 'chart', 'graph', 'mindmap', 'sequence', '流程图', '图表', '图示', 'liuchengtu', 'tubiao', ...localizedSearchTerms.mermaid],
    commandId: 'mermaid',
    run: insertMermaidNodeAndOpenEditor,
  },
  {
    id: 'html-block',
    nameKey: 'editor.slash.htmlBlock',
    icon: 'editor.code',
    searchTerms: ['html', 'raw html', 'html block', 'embed', 'markup', 'html块', 'html区块', '原始html', 'yuanshihtml', ...localizedSearchTerms.html],
    commandId: 'html-block',
    run: insertHtmlBlockNodeAndOpenEditor,
  },
  {
    id: 'footnote',
    nameKey: 'editor.slash.footnote',
    icon: 'editor.footnote',
    searchTerms: ['note', 'reference', 'citation', 'foot note', '脚注', '引用注释', 'jiazhu', ...localizedSearchTerms.footnote],
    commandId: 'footnote',
    run: insertFootnoteRef,
  },
  {
    id: 'footnote-definition',
    nameKey: 'editor.slash.footnoteDefinition',
    icon: 'editor.footnote',
    searchTerms: ['footnote def', 'footnote definition', 'citation block', 'footnote block', '脚注定义', '脚注块', 'jiazhu dingyi', ...localizedSearchTerms.footnote],
    commandId: 'footnote-definition',
    run: insertFootnoteDef,
  },
  {
    id: 'abbreviation',
    nameKey: 'editor.slash.abbreviation',
    icon: 'editor.abbreviation',
    searchTerms: ['abbr', 'acronym', 'short form', 'short', 'abbreviation definition', '缩写', '简称', 'suoxie', ...localizedSearchTerms.abbreviation],
    commandId: 'abbreviation',
    run: (ctx) => replaceCurrentTextBlockWithParagraphText(ctx, '*[ABBR]: Full phrase'),
  },
  {
    id: 'video',
    nameKey: 'editor.slash.video',
    icon: 'editor.video',
    searchTerms: ['vedio', 'youtube', 'bilibili', 'embed', 'movie', 'media', '视频', '影片', '媒体', 'shipin', ...localizedSearchTerms.video],
    commandId: 'video',
    run: openVideoPrompt,
  },
] as const satisfies readonly SlashCommandDefinition[];

export type SlashCommandId = (typeof slashCommandDefinitions)[number]['commandId'];
