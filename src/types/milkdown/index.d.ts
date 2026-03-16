import type * as React from 'react';

type AnyRecord = Record<string, any>;
type AnyFn = (...args: any[]) => any;

interface MilkdownCtxToken<T = any> {
  readonly __milkdownType?: T;
}

interface MilkdownMarkType {
  name: string;
  spec: AnyRecord;
  create(attrs?: AnyRecord | null): MilkdownMark;
  isInSet(marks: readonly MilkdownMark[] | null | undefined): MilkdownMark | undefined;
}

interface MilkdownMark {
  type: MilkdownMarkType;
  attrs: AnyRecord;
  [key: string]: any;
}

interface MilkdownNodeType {
  name: string;
  spec: AnyRecord;
  schema: MilkdownSchema;
  create(
    attrs?: AnyRecord | null,
    content?: MilkdownNode | readonly MilkdownNode[] | null,
    marks?: readonly MilkdownMark[] | null,
  ): MilkdownNode;
  createAndFill?(
    attrs?: AnyRecord | null,
    content?: MilkdownNode | readonly MilkdownNode[] | null,
    marks?: readonly MilkdownMark[] | null,
  ): MilkdownNode | null;
}

interface MilkdownResolvedPos {
  pos: number;
  depth: number;
  parent: MilkdownNode;
  parentOffset: number;
  nodeBefore: MilkdownNode | null;
  nodeAfter: MilkdownNode | null;
  start(depth?: number): number;
  end(depth?: number): number;
  before(depth?: number): number;
  after(depth?: number): number;
  index(depth?: number): number;
  indexAfter(depth?: number): number;
  posAtIndex(index: number, depth?: number): number;
  node(depth: number): MilkdownNode;
  marks(): MilkdownMark[];
}

interface MilkdownFragmentLike {
  size: number;
  forEach(
    callback: (node: MilkdownNode, offset: number, index: number) => void,
  ): void;
}

interface MilkdownNode {
  type: MilkdownNodeType;
  attrs: AnyRecord;
  text?: string | null;
  textContent: string;
  content: MilkdownFragmentLike;
  marks: readonly MilkdownMark[];
  nodeSize: number;
  childCount: number;
  firstChild: MilkdownNode | null;
  lastChild: MilkdownNode | null;
  isText: boolean;
  isBlock: boolean;
  isTextblock: boolean;
  isInline: boolean;
  descendants(
    callback: (
      node: MilkdownNode,
      pos: number,
      parent?: MilkdownNode,
      index?: number,
    ) => boolean | void,
  ): void;
  nodesBetween(
    from: number,
    to: number,
    callback: (
      node: MilkdownNode,
      pos: number,
      parent?: MilkdownNode,
      index?: number,
    ) => boolean | void,
    startPos?: number,
  ): void;
  forEach(callback: (node: MilkdownNode, offset: number, index: number) => void): void;
  maybeChild(index: number): MilkdownNode | null;
  child(index: number): MilkdownNode;
  copy(content?: any): MilkdownNode;
  cut(from: number, to?: number): MilkdownNode;
  slice(from: number, to?: number, includeParents?: boolean): any;
  resolve(pos: number): MilkdownResolvedPos;
  nodeAt(pos: number): MilkdownNode | null;
  textBetween(from: number, to: number, blockSeparator?: string | null, leafText?: string | null): string;
  rangeHasMark(from: number, to: number, markType: MilkdownMarkType): boolean;
  eq(other: MilkdownNode): boolean;
  [key: string]: any;
}

interface MilkdownSchema {
  nodes: Record<string, MilkdownNodeType>;
  marks: Record<string, MilkdownMarkType>;
  text(text: string, marks?: readonly MilkdownMark[] | null): MilkdownNode;
  [key: string]: any;
}

interface MilkdownMapping {
  map(pos: number, assoc?: number): number;
}

interface MilkdownSelectionInstance {
  from: number;
  to: number;
  empty: boolean;
  $from: MilkdownResolvedPos;
  $to: MilkdownResolvedPos;
  eq(other: MilkdownSelectionInstance): boolean;
  [key: string]: any;
}

interface MilkdownTransactionLike {
  doc: MilkdownNode;
  selection: MilkdownSelectionInstance;
  schema: MilkdownSchema;
  mapping: MilkdownMapping;
  docChanged: boolean;
  getMeta(key: any): any;
  setSelection(selection: MilkdownSelectionInstance): MilkdownTransactionLike;
  setMeta(key: any, value: any): MilkdownTransactionLike;
  setNodeMarkup(pos: number, type?: any, attrs?: AnyRecord, marks?: readonly MilkdownMark[] | null): MilkdownTransactionLike;
  replaceRange(from: number, to: number, slice: any): MilkdownTransactionLike;
  replaceRangeWith(from: number, to: number, node: MilkdownNode): MilkdownTransactionLike;
  replaceWith(from: number, to: number, content: any): MilkdownTransactionLike;
  replaceSelectionWith(node: MilkdownNode, inheritMarks?: boolean): MilkdownTransactionLike;
  replaceSelection(slice: any): MilkdownTransactionLike;
  insert(pos: number, content: any): MilkdownTransactionLike;
  insertText(text: string, from?: number, to?: number): MilkdownTransactionLike;
  delete(from: number, to: number): MilkdownTransactionLike;
  addMark(from: number, to: number, mark: MilkdownMark): MilkdownTransactionLike;
  removeMark(from: number, to?: number, mark?: any): MilkdownTransactionLike;
  removeStoredMark(mark: any): MilkdownTransactionLike;
  setStoredMarks(marks: readonly MilkdownMark[] | null): MilkdownTransactionLike;
  ensureMarks(marks: readonly MilkdownMark[]): MilkdownTransactionLike;
  scrollIntoView(): MilkdownTransactionLike;
  [key: string]: any;
}

interface MilkdownEditorStateLike {
  doc: MilkdownNode;
  selection: MilkdownSelectionInstance;
  schema: MilkdownSchema;
  tr: MilkdownTransactionLike;
  storedMarks?: readonly MilkdownMark[] | null;
  [key: string]: any;
}

interface MilkdownPluginStateField<T = any> {
  init(config: any, state: MilkdownEditorStateLike): T;
  apply(
    tr: MilkdownTransactionLike,
    value: T,
    oldState: MilkdownEditorStateLike,
    newState: MilkdownEditorStateLike,
  ): T;
}

interface MilkdownPluginView {
  update?(view: import('@milkdown/kit/prose/view').EditorView, prevState?: MilkdownEditorStateLike): void;
  destroy?(): void;
}

interface MilkdownPluginProps {
  decorations?(state: MilkdownEditorStateLike): any;
  attributes?: AnyRecord | ((state: MilkdownEditorStateLike) => AnyRecord);
  nodeViews?: Record<string, AnyFn>;
  handlePaste?(view: import('@milkdown/kit/prose/view').EditorView, event: ClipboardEvent): boolean;
  handleTextInput?(
    view: import('@milkdown/kit/prose/view').EditorView,
    from: number,
    to: number,
    text: string,
  ): boolean;
  handleKeyDown?(view: import('@milkdown/kit/prose/view').EditorView, event: KeyboardEvent): boolean;
  handleClick?(view: import('@milkdown/kit/prose/view').EditorView, pos: number, event: MouseEvent): boolean;
  handleDOMEvents?: Record<
    string,
    (view: import('@milkdown/kit/prose/view').EditorView, event: any) => boolean
  >;
  transformPastedHTML?(html: string): string;
  [key: string]: any;
}

interface MilkdownPluginSpec<T = any> {
  key?: import('@milkdown/kit/prose/state').PluginKey<T>;
  state?: MilkdownPluginStateField<T>;
  props?: MilkdownPluginProps;
  view?(view: import('@milkdown/kit/prose/view').EditorView): MilkdownPluginView | void;
  appendTransaction?(
    transactions: readonly MilkdownTransactionLike[],
    oldState: MilkdownEditorStateLike,
    newState: MilkdownEditorStateLike,
  ): MilkdownTransactionLike | null | undefined;
  filterTransaction?(tr: MilkdownTransactionLike, state: MilkdownEditorStateLike): boolean;
  [key: string]: any;
}

interface MilkdownParseDOMRule {
  tag?: string;
  style?: string;
  preserveWhitespace?: boolean | 'full';
  getAttrs?(value: unknown): AnyRecord | false | null | undefined;
  [key: string]: any;
}

interface MilkdownMarkdownState {
  openNode(type: any, attrs?: AnyRecord): void;
  closeNode(): void;
  openMark(type: any, attrs?: AnyRecord): void;
  closeMark(type?: any): void;
  addNode(type: string | any, attrs?: AnyRecord, value?: any, meta?: AnyRecord): void;
  addText(text: string): void;
  next(node: any): void;
  [key: string]: any;
}

interface MilkdownNodeSpec {
  content?: string;
  group?: string;
  inline?: boolean;
  atom?: boolean;
  code?: boolean;
  defining?: boolean;
  isolating?: boolean;
  marks?: string;
  attrs?: AnyRecord;
  parseDOM?: readonly MilkdownParseDOMRule[];
  toDOM?(node: MilkdownNode): any;
  parseMarkdown?: {
    match?(node: any): boolean;
    runner?(state: MilkdownMarkdownState, node: any, type: any): void;
  };
  toMarkdown?: {
    match?(node: MilkdownNode): boolean;
    runner?(state: MilkdownMarkdownState, node: MilkdownNode): void;
  };
  [key: string]: any;
}

interface MilkdownMarkSpec {
  attrs?: AnyRecord;
  inclusive?: boolean;
  excludes?: string;
  parseDOM?: readonly MilkdownParseDOMRule[];
  toDOM?(mark: MilkdownMark): any;
  parseMarkdown?: {
    match?(node: any): boolean;
    runner?(state: MilkdownMarkdownState, node: any, markType: any): void;
  };
  toMarkdown?: {
    match?(mark: MilkdownMark): boolean;
    runner?(state: MilkdownMarkdownState, mark: MilkdownMark, node: MilkdownNode): void;
  };
  [key: string]: any;
}

interface MilkdownNodeAttrSpec {
  default?: any;
  get?(dom: HTMLElement): any;
  set?(value: any): AnyRecord;
  [key: string]: any;
}

interface MilkdownCtx {
  inject<T>(token: MilkdownCtxToken<T>, value?: T): MilkdownCtx;
  remove<T>(token: MilkdownCtxToken<T> | string): MilkdownCtx;
  record(timer: MilkdownTimerType): MilkdownCtx;
  clearTimer(timer: MilkdownTimerType): MilkdownCtx;
  set<T>(token: MilkdownCtxToken<T>, value: T): void;
  get<T>(token: MilkdownCtxToken<T>): T;
  update<T>(token: MilkdownCtxToken<T>, updater: (prev: T) => T): void;
  done(timer: MilkdownTimerType): void;
  wait(timer: MilkdownTimerType): Promise<void>;
  waitTimers(token: MilkdownCtxToken<MilkdownTimerType[]>): Promise<void>;
}

interface MilkdownEditorInstance {
  ctx: MilkdownCtx;
  [key: string]: any;
}

interface MilkdownEditorBuilder {
  config(fn: (ctx: MilkdownCtx) => void): MilkdownEditorBuilder;
  use(plugin: any): MilkdownEditorBuilder;
}

interface MilkdownCommandManager {
  call(key: any, ...args: any[]): boolean;
  [key: string]: any;
}

type MilkdownCommand = (
  state: MilkdownEditorStateLike,
  dispatch?: ((tr: MilkdownTransactionLike) => void) | null,
  view?: import('@milkdown/kit/prose/view').EditorView,
) => boolean;

type MilkdownCommandFactory = (...args: any[]) => MilkdownCommand;
type MilkdownRunner = () => void | Promise<void> | (() => void | Promise<void>) | Promise<() => void | Promise<void>>;
type MilkdownPlugin = ((ctx: MilkdownCtx) => MilkdownRunner) & { meta?: Record<string, any> };

interface MilkdownTimerType {
  readonly id: symbol;
  readonly name: string;
  readonly timeout: number;
}

declare module '@milkdown/kit/core' {
  export const rootCtx: MilkdownCtxToken<HTMLElement>;
  export const defaultValueCtx: MilkdownCtxToken<string>;
  export const editorViewCtx: MilkdownCtxToken<import('@milkdown/kit/prose/view').EditorView>;
  export const remarkStringifyOptionsCtx: MilkdownCtxToken<Record<string, unknown>>;
  export const parserCtx: MilkdownCtxToken<import('@milkdown/kit/transformer').Parser>;
  export const serializerCtx: MilkdownCtxToken<import('@milkdown/kit/transformer').Serializer>;
  export const commandsCtx: MilkdownCtxToken<MilkdownCommandManager>;

  export const Editor: {
    make(): MilkdownEditorBuilder;
  };
}

declare module '@milkdown/kit/ctx' {
  export type Ctx = MilkdownCtx;
}

declare module '@milkdown/core' {
  export const remarkPluginsCtx: MilkdownCtxToken<any[]>;
  export const schemaTimerCtx: MilkdownCtxToken<MilkdownTimerType[]>;
}

declare module '@milkdown/ctx' {
  export type Ctx = MilkdownCtx;
  export type MilkdownPlugin = globalThis.MilkdownPlugin;
  export type TimerType = MilkdownTimerType;
  export function createTimer(name: string, timeout?: number): MilkdownTimerType;
}

declare module '@milkdown/kit/plugin/history' {
  export const history: any;
}

declare module '@milkdown/kit/plugin/listener' {
  interface ListenerApi {
    markdownUpdated(callback: (ctx: MilkdownCtx, markdown: string) => void): void;
  }

  export const listener: any;
  export const listenerCtx: MilkdownCtxToken<ListenerApi>;
}

declare module '@milkdown/kit/preset/commonmark' {
  interface CommandKeyLike {
    key: any;
    [key: string]: any;
  }

  export const commonmark: any;
  export const headingSchema: any;
  export const paragraphSchema: any;
  export const strongSchema: any;
  export const emphasisSchema: any;
  export const inlineCodeSchema: any;
  export const linkSchema: any;
  export const blockquoteSchema: any;
  export const hrSchema: any;
  export const imageSchema: any;
  export const listItemSchema: any;
  export const bulletListSchema: any;
  export const orderedListSchema: any;
  export const codeBlockSchema: any;
  export const wrapInHeadingCommand: CommandKeyLike;
  export const createCodeBlockCommand: CommandKeyLike;
  export const insertHrCommand: CommandKeyLike;
}

declare module '@milkdown/kit/preset/gfm' {
  interface CommandKeyLike {
    key: any;
    [key: string]: any;
  }

  export const gfm: any;
  export const tableSchema: any;
  export const tableRowSchema: any;
  export const tableHeaderSchema: any;
  export const tableCellSchema: any;
  export const insertTableCommand: CommandKeyLike;
}

declare module '@milkdown/kit/component/table-block' {
  export const tableBlock: any;
  export const tableBlockConfig: MilkdownCtxToken<{
    renderButton: (renderType: string) => string;
  }>;
}

declare module '@milkdown/kit/prose/commands' {
  export function setBlockType(nodeType: any, attrs?: AnyRecord): MilkdownCommand;
  export function wrapIn(nodeType: any, attrs?: AnyRecord): MilkdownCommand;
  export function lift(state: MilkdownEditorStateLike, dispatch?: ((tr: MilkdownTransactionLike) => void) | null): boolean;
  export function toggleMark(markType: any, attrs?: AnyRecord): MilkdownCommand;
}

declare module '@milkdown/kit/prose/inputrules' {
  export class InputRule {
    constructor(
      match: RegExp,
      handler: (
        state: MilkdownEditorStateLike,
        match: RegExpMatchArray,
        start: number,
        end: number,
      ) => MilkdownTransactionLike | null | undefined,
      options?: AnyRecord,
    );
  }
}

declare module '@milkdown/kit/prose/keymap' {
  export function keymap(bindings: Record<string, MilkdownCommand>): any;
}

declare module '@milkdown/kit/prose/model' {
  export class Node implements MilkdownNode {
    type: MilkdownNodeType;
    attrs: AnyRecord;
    text?: string | null;
    textContent: string;
    content: MilkdownFragmentLike;
    marks: readonly MilkdownMark[];
    nodeSize: number;
    childCount: number;
    firstChild: Node | null;
    lastChild: Node | null;
    isText: boolean;
    isBlock: boolean;
    isTextblock: boolean;
    isInline: boolean;
    descendants(
      callback: (node: Node, pos: number, parent?: Node, index?: number) => boolean | void,
    ): void;
    nodesBetween(
      from: number,
      to: number,
      callback: (node: Node, pos: number, parent?: Node, index?: number) => boolean | void,
      startPos?: number,
    ): void;
    forEach(callback: (node: Node, offset: number, index: number) => void): void;
    maybeChild(index: number): Node | null;
    child(index: number): Node;
    copy(content?: any): Node;
    cut(from: number, to?: number): Node;
    slice(from: number, to?: number, includeParents?: boolean): Slice;
    resolve(pos: number): MilkdownResolvedPos;
    nodeAt(pos: number): Node | null;
    textBetween(from: number, to: number, blockSeparator?: string | null, leafText?: string | null): string;
    rangeHasMark(from: number, to: number, markType: MilkdownMarkType): boolean;
    eq(other: Node): boolean;
    [key: string]: any;
  }

  export class NodeType implements MilkdownNodeType {
    name: string;
    spec: AnyRecord;
    schema: MilkdownSchema;
    create(
      attrs?: AnyRecord | null,
      content?: Node | readonly Node[] | null,
      marks?: readonly MilkdownMark[] | null,
    ): Node;
    createAndFill?(
      attrs?: AnyRecord | null,
      content?: Node | readonly Node[] | null,
      marks?: readonly MilkdownMark[] | null,
    ): Node | null;
    [key: string]: any;
  }

  export class Fragment {
    size: number;
    static from(content: Node | readonly Node[] | Fragment | null): Fragment;
    static fromArray(nodes: readonly Node[]): Fragment;
    static empty: Fragment;
    append(other: Fragment): Fragment;
    forEach(callback: (node: Node, offset: number, index: number) => void): void;
    [key: string]: any;
  }

  export class Slice {
    content: Fragment;
    openStart: number;
    openEnd: number;
    constructor(content: Fragment, openStart: number, openEnd: number);
    [key: string]: any;
  }

  export type DOMOutputSpec = any;
}

declare module '@milkdown/kit/prose/schema-list' {
  export function sinkListItem(nodeType: any): MilkdownCommand;
  export function liftListItem(nodeType: any): MilkdownCommand;
}

declare module '@milkdown/kit/prose/state' {
  export type EditorState = MilkdownEditorStateLike;
  export type Transaction = MilkdownTransactionLike;

  export class Plugin<T = any> {
    constructor(spec?: MilkdownPluginSpec<T>);
    [key: string]: any;
  }

  export class PluginKey<T = any> {
    constructor(name?: string);
    getState(state: EditorState): T | undefined;
    [key: string]: any;
  }

  export class Selection implements MilkdownSelectionInstance {
    from: number;
    to: number;
    empty: boolean;
    $from: MilkdownResolvedPos;
    $to: MilkdownResolvedPos;
    eq(other: Selection): boolean;
    static findFrom(
      $pos: MilkdownResolvedPos,
      dir: number,
      textOnly?: boolean,
    ): Selection | null;
    static near($pos: MilkdownResolvedPos, bias?: number): Selection;
    static create(doc: MilkdownNode, anchor: number, head?: number): Selection;
    static atStart(doc: MilkdownNode): Selection;
    [key: string]: any;
  }

  export class TextSelection extends Selection {
    static create(doc: MilkdownNode, anchor: number, head?: number): TextSelection;
  }

  export class NodeSelection extends Selection {
    static create(doc: MilkdownNode, from: number): NodeSelection;
  }
}

declare module '@milkdown/kit/prose/tables' {
  export const addColumnAfter: MilkdownCommand;
  export const addColumnBefore: MilkdownCommand;
  export const addRowAfter: MilkdownCommand;
  export const addRowBefore: MilkdownCommand;
  export const deleteColumn: MilkdownCommand;
  export const deleteRow: MilkdownCommand;
  export const deleteTable: MilkdownCommand;
}

declare module '@milkdown/kit/prose/view' {
  export class EditorView {
    dom: HTMLElement;
    state: MilkdownEditorStateLike;
    dispatch: (tr: MilkdownTransactionLike) => void;
    focus(): void;
    hasFocus(): boolean;
    posAtCoords(coords: { left: number; top: number }): { pos: number; inside: number } | null;
    posAtDOM(node: globalThis.Node, offset: number, bias?: number): number;
    coordsAtPos(pos: number): { left: number; right: number; top: number; bottom: number };
    domAtPos(pos: number, side?: number): { node: globalThis.Node; offset: number };
    nodeDOM(pos: number): globalThis.Node | null;
    endOfTextblock(dir?: string, state?: MilkdownEditorStateLike): boolean;
    [key: string]: any;
  }

  export class Decoration {
    static widget(
      pos: number,
      toDOM: AnyFn | globalThis.Node,
      spec?: AnyRecord & { stopEvent?: (event: any) => boolean },
    ): Decoration;
    static node(from: number, to: number, attrs?: AnyRecord, spec?: AnyRecord): Decoration;
    static inline(from: number, to: number, attrs?: AnyRecord, spec?: AnyRecord): Decoration;
    [key: string]: any;
  }

  export class DecorationSet {
    static create(doc: MilkdownNode, decorations: readonly Decoration[]): DecorationSet;
    static empty: DecorationSet;
    map(mapping: MilkdownMapping, doc: MilkdownNode): DecorationSet;
    add(doc: MilkdownNode, decorations: readonly Decoration[]): DecorationSet;
    remove(decorations: readonly Decoration[]): DecorationSet;
    [key: string]: any;
  }

  export class NodeView {
    [key: string]: any;
  }
}

declare module '@milkdown/kit/transformer' {
  export type Parser = ((markdown: string) => import('@milkdown/kit/prose/model').Node) & AnyRecord;
  export type Serializer = ((node: any) => string) & AnyRecord;
}

declare module '@milkdown/kit/utils' {
  export function $prose(factory: (ctx: MilkdownCtx) => any): any;
  export function $node(name: string, factory: (ctx: MilkdownCtx) => MilkdownNodeSpec): any;
  export function $command(name: string, factory: (ctx: MilkdownCtx) => MilkdownCommandFactory): any;
  export function $mark(name: string, factory: (ctx: MilkdownCtx) => MilkdownMarkSpec): any;
  export function $inputRule(factory: (ctx: MilkdownCtx) => any): any;
  export function $remark(name: string, factory: (ctx: MilkdownCtx) => AnyFn): any;
  export function $nodeAttr(
    nodeName: string,
    factory: (ctx: MilkdownCtx) => Record<string, MilkdownNodeAttrSpec>,
  ): any;
}

declare module '@milkdown/react' {
  export const Milkdown: (props?: any) => React.ReactElement | null;
  export const MilkdownProvider: (props: {
    children?: React.ReactNode;
  }) => React.ReactElement | null;
  export function useEditor(
    factory: (root: HTMLElement) => any,
    deps?: readonly unknown[],
  ): {
    get?: () => MilkdownEditorInstance | null;
  };
}
