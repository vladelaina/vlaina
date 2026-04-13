import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedJavaScriptCases: readonly HandcraftedLanguageCase[] = [
  entry('hello console', `console.log("hello world");`),
  entry('named function add', `function add(left, right) {
  return left + right;
}`),
  entry('const arrow multiply', `const multiply = (left, right) => {
  return left * right;
};`),
  entry('let concise arrow', `let formatTitle = (value) => value.trim().toUpperCase();`),
  entry('async fetch json', `async function loadNotes() {
  const response = await fetch("/api/notes");
  return response.json();
}`),
  entry('promise chain values', `fetch("/api/profile")
  .then((response) => response.json())
  .then((profile) => console.log(profile.name));`),
  entry('array map values', `const names = users.map((user) => user.name.toLowerCase());`),
  entry('array reduce totals', `const total = values.reduce((sum, value) => sum + value, 0);`),
  entry('object destructure', `const { title, updatedAt } = note;
console.log(title, updatedAt);`),
  entry('default parameter', `function greet(name = "friend") {
  return \`Hello \${name}\`;
}`),
  entry('rest parameters join', `function collect(...parts) {
  return parts.join("/");
}`),
  entry('spread arrays merge', `const combined = [...pinned, ...recent];`),
  entry('spread object merge', `const nextState = { ...state, loading: false, error: null };`),
  entry('class constructor', `class NoteStore {
  constructor(items = []) {
    this.items = items;
  }
}`),
  entry('class static method', `class Slugger {
  static fromTitle(title) {
    return title.toLowerCase().replaceAll(" ", "-");
  }
}`),
  entry('class extends error', `class SyncError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncError";
  }
}`),
  entry('getter setter pair', `class Counter {
  get value() {
    return this._value ?? 0;
  }

  set value(nextValue) {
    this._value = nextValue;
  }
}`),
  entry('private field class', `class SessionStore {
  #token = "";

  setToken(value) {
    this.#token = value;
  }
}`),
  entry('optional chaining read', `const city = user?.profile?.address?.city ?? "unknown";`),
  entry('nullish coalescing fallback', `const pageSize = settings.pageSize ?? 20;`),
  entry('dynamic import loader', `const loadEditor = async () => {
  const mod = await import("./editor.js");
  return mod.openEditor;
};`),
  entry('named import helper', `import { readFile } from "./fs.js";

const text = await readFile("note.md");`),
  entry('export default function', `export default function createStore() {
  return new Map();
}`),
  entry('export const helper', `export const slugify = (value) => value.trim().toLowerCase();`),
  entry('module exports object', `module.exports = {
  open() {
    return "ready";
  },
};`),
  entry('require fs module', `const fs = require("fs");
const text = fs.readFileSync("notes.txt", "utf8");`),
  entry('express route handler', `const express = require("express");
const app = express();

app.get("/health", (request, response) => {
  response.json({ ok: true });
});`),
  entry('dom event listener', `button.addEventListener("click", () => {
  console.log("clicked");
});`),
  entry('query selector update', `const heading = document.querySelector("h1");
heading.textContent = "Inbox";`),
  entry('local storage save', `localStorage.setItem("theme", "light");
console.log(localStorage.getItem("theme"));`),
  entry('fetch post request', `const saveNote = async (payload) => {
  return fetch("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};`),
  entry('async iife boot', `(async function boot() {
  const response = await fetch("/api/session");
  console.log(await response.json());
})();`),
  entry('generator function', `function* ids() {
  yield 1;
  yield 2;
}`),
  entry('for await chunks', `async function read(stream) {
  for await (const chunk of stream) {
    console.log(chunk);
  }
}`),
  entry('debounce helper', `const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};`),
  entry('interval ticker', `let ticks = 0;
const timer = setInterval(() => {
  ticks += 1;
  if (ticks === 3) clearInterval(timer);
}, 1000);`),
  entry('promise all items', `Promise.all([loadUser(), loadSettings()]).then(([user, settings]) => {
  console.log(user.id, settings.theme);
});`),
  entry('promise race request', `Promise.race([primary(), fallback()]).then((result) => {
  console.log(result);
});`),
  entry('promise finally cleanup', `loadDraft()
  .catch((error) => console.error(error))
  .finally(() => console.log("done"));`),
  entry('queue microtask flush', `queueMicrotask(() => {
  console.log("flushed");
});`),
  entry('object from entries', `const map = Object.fromEntries([
  ["draft", 1],
  ["published", 2],
]);`),
  entry('object entries loop', `for (const [key, value] of Object.entries(config)) {
  console.log(key, value);
}`),
  entry('switch route handler', `function label(status) {
  switch (status) {
    case "idle":
      return "Idle";
    default:
      return "Unknown";
  }
}`),
  entry('try catch finally', `try {
  runTask();
} catch (error) {
  console.error(error);
} finally {
  console.log("finished");
}`),
  entry('abort controller fetch', `const controller = new AbortController();
fetch("/api/search", { signal: controller.signal });`),
  entry('url search params', `const params = new URLSearchParams({ q: "note", page: "1" });
console.log(params.toString());`),
  entry('intl number format', `const formatter = new Intl.NumberFormat("en-US");
console.log(formatter.format(123456));`),
  entry('intl date time format', `const formatter = new Intl.DateTimeFormat("en-US");
console.log(formatter.format(new Date()));`),
  entry('set unique tags', `const tags = new Set(["work", "work", "todo"]);
console.log(tags.size);`),
  entry('map count lookup', `const counts = new Map();
counts.set("draft", 4);
console.log(counts.get("draft"));`),
  entry('weakmap cache', `const cache = new WeakMap();
cache.set(target, { ready: true });`),
  entry('symbol iterator object', `const range = {
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
  },
};`),
  entry('proxy getter trap', `const proxy = new Proxy(source, {
  get(target, key) {
    return Reflect.get(target, key);
  },
});`),
  entry('reflect own keys', `const keys = Reflect.ownKeys(record);
console.log(keys.length);`),
  entry('json clone object', `const clone = JSON.parse(JSON.stringify(note));
console.log(clone.title);`),
  entry('optional callback invoke', `const notify = (callback) => {
  callback?.("saved");
};`),
  entry('import meta url', `const assetUrl = new URL("./icon.svg", import.meta.url);
console.log(assetUrl.href);`),
  entry('worker onmessage', `self.onmessage = (event) => {
  postMessage(event.data.toUpperCase());
};`),
  entry('navigator clipboard write', `const copy = async (value) => {
  await navigator.clipboard.writeText(value);
};`),
  entry('history push state', `history.pushState({ noteId: 1 }, "", "/notes/1");
window.dispatchEvent(new Event("popstate"));`),
  entry('create element append', `const node = document.createElement("div");
node.textContent = "ready";
document.body.append(node);`),
  entry('multiline template literal', "const message = `Hello\\n${user.name}\\nWelcome back`;"),
  entry('tagged template literal', `function html(strings, ...values) {
  return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
}

const output = html\`<p>\${title}</p>\`;`),
  entry('regex match all', `const matches = [..."a1 b2".matchAll(/([a-z])(\\d)/g)];
console.log(matches.length);`),
  entry('array some every', `const hasDraft = notes.some((note) => note.state === "draft");
const allLoaded = notes.every((note) => note.loaded);`),
  entry('bigint math', `const total = 9007199254740993n;
console.log(total + 2n);`),
  entry('logical assignment', `settings.theme ||= "light";
settings.page ??= 1;`),
  entry('custom element define', `class NoteCard extends HTMLElement {
  constructor() {
    super();
  }
}

customElements.define("note-card", NoteCard);`),
  entry('class static block', `class Registry {
  static items = new Map();

  static {
    this.items.set("ready", true);
  }
}`),
  entry('object method shorthand', `const actions = {
  open() {
    return "open";
  },
};`),
  entry('computed property names', `const field = "title";
const payload = {
  [field]: "Inbox",
};`),
  entry('destructuring rename', `const { title: noteTitle, id: noteId } = note;
console.log(noteTitle, noteId);`),
  entry('nested default destructuring', `const {
  author: { name = "Unknown" } = {},
} = note;`),
  entry('async iterator object', `const loader = {
  async *[Symbol.asyncIterator]() {
    yield "a";
    yield "b";
  },
};`),
  entry('buffer from string', `const data = Buffer.from("hello");
console.log(data.toString("utf8"));`),
  entry('node fs promises import', `import { readFile } from "node:fs/promises";

const load = async () => {
  return readFile("notes.txt", "utf8");
};`),
  entry('process env fallback', `const mode = process.env.NODE_ENV || "development";
console.log(mode);`),
  entry('url parse string', `const url = new URL("https://example.com/notes?id=1");
console.log(url.searchParams.get("id"));`),
  entry('crypto random uuid', `const { randomUUID } = require("node:crypto");
const id = randomUUID();`),
  entry('console table rows', `console.table([
  { id: 1, title: "Inbox" },
  { id: 2, title: "Archive" },
]);`),
  entry('array from set', `const values = Array.from(new Set(["a", "b", "a"]));
console.log(values.join(","));`),
  entry('array find last', `const latest = items.findLast((item) => item.done);
console.log(latest?.id);`),
  entry('structured clone value', `const copy = structuredClone(state);
console.log(copy.ready);`),
  entry('websocket handler', `const socket = new WebSocket("wss://example.com/socket");
socket.addEventListener("message", (event) => {
  console.log(event.data);
});`),
  entry('intersection observer', `const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => console.log(entry.isIntersecting));
});`),
  entry('mutation observer', `const observer = new MutationObserver((records) => {
  console.log(records.length);
});`),
  entry('resize observer', `const observer = new ResizeObserver((entries) => {
  console.log(entries[0].contentRect.width);
});`),
  entry('request animation frame', `requestAnimationFrame(() => {
  window.scrollTo(0, 0);
});`),
  entry('post message parent', `window.parent.postMessage({ type: "ready" }, "*");`),
  entry('session storage read', `sessionStorage.setItem("tab", "notes");
console.log(sessionStorage.getItem("tab"));`),
  entry('indexeddb open', `const request = indexedDB.open("notes", 1);
request.addEventListener("success", () => {
  console.log("opened");
});`),
  entry('formdata append value', `function createPayload(file) {
  const body = new FormData();
  body.append("file", file);
  return body;
}`),
  entry('blob text content', `const blob = new Blob(["hello"]);
blob.text().then((value) => console.log(value));`),
  entry('response json parse', `const response = new Response("{\\"ok\\":true}");
response.json().then((value) => console.log(value.ok));`),
  entry('headers append trace', `function makeHeaders() {
  const headers = new Headers();
  headers.append("X-Trace", "1");
  return headers;
}`),
  entry('promise any winner', `Promise.any([slow(), fast()]).then((value) => {
  console.log(value);
});`),
  entry('array to sorted copy', `const sorted = numbers.toSorted((left, right) => left - right);`),
  entry('object has own', `if (Object.hasOwn(config, "theme")) {
  console.log(config.theme);
}`),
  entry('array flat map parts', `const parts = rows.flatMap((row) => row.split(","));`),
  entry('reduce into object', `const byId = notes.reduce((result, note) => {
  result[note.id] = note;
  return result;
}, {});`),
];
