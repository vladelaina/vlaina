import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedTypeScriptCases: readonly HandcraftedLanguageCase[] = [
  entry('typed function add', `function add(left: number, right: number): number {
  return left + right;
}`),
  entry('const arrow typed params', `const formatTitle = (value: string): string => {
  return value.trim();
};`),
  entry('interface note shape', `interface Note {
  id: string;
  title: string;
}`),
  entry('type alias object', `type NoteSummary = {
  id: string;
  updatedAt: number;
};`),
  entry('type union literal', `type Status = 'idle' | 'running' | 'failed';`),
  entry('type intersection merge', `type Entity = WithId & WithTimestamps;`),
  entry('readonly array alias', `type Tags = readonly string[];`),
  entry('generic identity fn', `function identity<T>(value: T): T {
  return value;
}`),
  entry('generic constraint keyof', `function pick<T, K extends keyof T>(value: T, key: K): T[K] {
  return value[key];
}`),
  entry('record alias map', `type StatusMap = Record<string, number>;`),
  entry('partial helper alias', `type DraftNote = Partial<Note>;`),
  entry('omit helper alias', `type PublicNote = Omit<Note, 'secret'>;`),
  entry('pick helper alias', `type NotePreview = Pick<Note, 'id' | 'title'>;`),
  entry('required helper alias', `type StrictDraft = Required<DraftNote>;`),
  entry('mapped type readonly', `type ReadonlyFields<T> = {
  readonly [K in keyof T]: T[K];
};`),
  entry('conditional type infer', `type ElementType<T> = T extends (infer U)[] ? U : T;`),
  entry('template literal type', "type RouteKey = `note:${string}`;"),
  entry('enum numeric kind', `enum ViewMode {
  List,
  Board,
}`),
  entry('enum string kind', `enum ThemeMode {
  Light = 'light',
  Dark = 'dark',
}`),
  entry('namespace helpers', `namespace Formatters {
  export const title = (value: string): string => value.trim();
}`),
  entry('import type symbol', `import type { EditorState } from './editor';`),
  entry('export type alias', `export type Theme = 'light' | 'dark';`),
  entry('export interface props', `export interface PanelProps {
  title: string;
}`),
  entry('export function typed', `export function parse(raw: string): number {
  return Number(raw);
}`),
  entry('class typed field', `class NoteStore {
  items: string[] = [];
}`),
  entry('class readonly field', `class CacheEntry {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}`),
  entry('class access modifiers', `class SessionStore {
  private token: string = '';
  protected active: boolean = false;
}`),
  entry('class parameter property', `class NoteService {
  constructor(private client: ApiClient) {}
}`),
  entry('abstract class member', `abstract class Renderer {
  abstract render(value: string): string;
}`),
  entry('implements interface class', `class MemoryStore implements Persistable {
  save(value: string): void {
    console.log(value);
  }
}`),
  entry('getter return type', `class Counter {
  get value(): number {
    return 1;
  }
}`),
  entry('setter param type', `class Counter {
  set value(nextValue: number) {
    console.log(nextValue);
  }
}`),
  entry('public method typed', `class Slugger {
  public fromTitle(value: string): string {
    return value.toLowerCase();
  }
}`),
  entry('private method typed', `class TokenStore {
  private normalize(value: string): string {
    return value.trim();
  }
}`),
  entry('type predicate fn', `function isString(value: unknown): value is string {
  return typeof value === 'string';
}`),
  entry('asserts function', `function assertString(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('expected string');
}`),
  entry('unknown narrowing', `function parse(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}`),
  entry('never exhaustiveness', `function fail(message: string): never {
  throw new Error(message);
}`),
  entry('tuple typed pair', `const pair: [string, number] = ['draft', 1];`),
  entry('readonly tuple typed', `const point: readonly [number, number] = [0, 1];`),
  entry('generic array alias', `type Box<T> = { value: T };`),
  entry('generic arrow typed', `const first = <T>(values: T[]): T | undefined => values[0];`),
  entry('async function promise', `async function loadTitle(): Promise<string> {
  return 'Inbox';
}`),
  entry('await typed const', `const load = async (): Promise<number> => {
  return 1;
};`),
  entry('import default typed use', `import createStore from './store';

const store = createStore<string>();`),
  entry('satisfies operator', `const theme = {
  mode: 'light',
} satisfies { mode: 'light' | 'dark' };`),
  entry('as const object', `const statuses = {
  idle: 'idle',
  done: 'done',
} as const;`),
  entry('as unknown cast', `const value = response as unknown as Note;`),
  entry('non null assertion', `const title = note.title!.trim();`),
  entry('indexed access type', `type Title = Note['title'];`),
  entry('keyof alias', `type NoteKey = keyof Note;`),
  entry('typeof alias', `const defaults = { pageSize: 20 };
type Defaults = typeof defaults;`),
  entry('declare global block', `declare global {
  interface Window {
    __vlainaReady__: boolean;
  }
}`),
  entry('declare module block', `declare module '*.svg' {
  const value: string;
  export default value;
}`),
  entry('function overload signatures', `function format(value: string): string;
function format(value: number): string;
function format(value: string | number): string {
  return String(value);
}`),
  entry('constructor overload style', `class Parser {
  constructor(value: string);
  constructor(value: number);
  constructor(value: string | number) {
    console.log(value);
  }
}`),
  entry('index signature object', `type Counts = {
  [key: string]: number;
};`),
  entry('call signature interface', `interface Formatter {
  (value: string): string;
}`),
  entry('extends generic interface', `interface Result<T> extends Iterable<T> {
  size: number;
}`),
  entry('generic default param', `type Response<T = string> = {
  data: T;
};`),
  entry('infer promise type', `type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;`),
  entry('discriminated union switch', `type Result =
  | { type: 'ok'; value: string }
  | { type: 'error'; message: string };

function label(result: Result): string {
  switch (result.type) {
    case 'ok':
      return result.value;
    default:
      return result.message;
  }
}`),
  entry('generic extends record', `function values<T extends Record<string, unknown>>(input: T): unknown[] {
  return Object.values(input);
}`),
  entry('readonly modifier prop', `interface Config {
  readonly mode: string;
}`),
  entry('optional prop type', `interface Config {
  theme?: string;
}`),
  entry('union nullable prop', `type MaybeTitle = string | null;`),
  entry('array generic annotation', `const items: Array<string> = ['a', 'b'];`),
  entry('promise generic annotation', `const task: Promise<number> = Promise.resolve(1);`),
  entry('set generic annotation', `const tags: Set<string> = new Set();`),
  entry('map generic annotation', `const counts: Map<string, number> = new Map();`),
  entry('function generic tuple', `function pair<T, U>(left: T, right: U): [T, U] {
  return [left, right];
}`),
  entry('const satisfies tuple', `const routes = ['home', 'inbox'] as const satisfies readonly string[];`),
  entry('literal union array', `const modes: Array<'list' | 'board'> = ['list'];`),
  entry('module augmentation', `declare module './editor' {
  interface EditorOptions {
    theme: string;
  }
}`),
  entry('symbol generic map fn', `function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}`),
  entry('jsx props type alias', `type ButtonProps = {
  label: string;
  onClick(): void;
};`),
  entry('typed component factory alias', `type Props = { title: string };
const createTitle = ({ title }: Props): string => title.toUpperCase();`),
  entry('interface extends generic source', `interface InputProps extends FieldState<string> {
  invalid?: boolean;
}`),
  entry('generic hook return tuple', `function useToggle(initial: boolean): [boolean, () => void] {
  return [initial, () => undefined];
}`),
  entry('union function param', `function render(value: string | number): string {
  return String(value);
}`),
  entry('destructured param type', `function open({ id, title }: { id: string; title: string }): string {
  return id + title;
}`),
  entry('rest param typed array', `function join(...parts: string[]): string {
  return parts.join('/');
}`),
  entry('this parameter typed', `function bind(this: HTMLElement, value: string): void {
  this.dataset.value = value;
}`),
  entry('constructor generic class', `class Box<T> {
  constructor(public value: T) {}
}`),
  entry('implements generic interface', `class MemoryCache implements Cache<string> {
  get(key: string): string | undefined {
    return key;
  }
}`),
  entry('intersection props alias', `type ButtonState = Disabled & Loading;`),
  entry('extract helper alias', `type Visible = Extract<State, { visible: true }>;`),
  entry('exclude helper alias', `type Hidden = Exclude<State, { visible: true }>;`),
  entry('return type helper alias', `type SaveResult = ReturnType<typeof save>;`),
  entry('parameters helper alias', `type SaveArgs = Parameters<typeof save>;`),
  entry('instance type helper', `type StoreInstance = InstanceType<typeof Store>;`),
  entry('awaited helper alias', `type Loaded = Awaited<Promise<string>>;`),
  entry('module export typed const', `export const config: Record<string, string> = {
  theme: 'light',
};`),
  entry('import equals require', `import fs = require('fs');
const text: string = fs.readFileSync('a.txt', 'utf8');`),
  entry('ambient const declare', `declare const APP_VERSION: string;`),
  entry('ambient function declare', `declare function openNote(id: string): Promise<void>;`),
  entry('generic promise fn alias', `const load = <T>(value: T): Promise<T> => Promise.resolve(value);`),
  entry('indexed mapped readonly', `type Flags<T> = {
  readonly [K in keyof T]?: boolean;
};`),
  entry('union narrowing in operator', `function read(value: Fish | Bird): number {
  if ('swim' in value) return 1;
  return 2;
}`),
  entry('bigint typed literal', `const total: bigint = 10n;`),
];
