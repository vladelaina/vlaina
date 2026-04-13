import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedRustCases: readonly HandcraftedLanguageCase[] = [
  entry('hello world main', `fn main() {
    println!("hello");
}`),
  entry('use std io read line', `use std::io;

fn main() {
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
}`),
  entry('simple let mut', `let mut total = 0;`),
  entry('vector macro push', `fn main() {
    let mut values = vec![1, 2, 3];
    values.push(4);
}`),
  entry('string from literal', `fn name() -> String {
    String::from("rust")
}`),
  entry('struct named fields', `struct User {
    id: u64,
    name: String,
}`),
  entry('tuple struct point', `struct Point(i32, i32);`),
  entry('unit struct marker', `struct Marker;`),
  entry('enum option like', `enum State {
    Idle,
    Running,
    Failed(String),
}`),
  entry('match enum arms', `fn label(state: State) -> &'static str {
    match state {
        State::Idle => "idle",
        State::Running => "running",
        State::Failed(_) => "failed",
    }
}`),
  entry('impl new constructor', `struct Note {
    title: String,
}

impl Note {
    fn new(title: &str) -> Self {
        Self { title: title.to_string() }
    }
}`),
  entry('impl display for type', `use std::fmt;

struct Note {
    title: String,
}

impl fmt::Display for Note {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.title)
    }
}`),
  entry('trait with self method', `trait Render {
    fn render(&self) -> String;
}`),
  entry('trait impl block', `trait Save {
    fn save(&self);
}

struct Draft;

impl Save for Draft {
    fn save(&self) {}
}`),
  entry('generic function debug bound', `fn dump<T: std::fmt::Debug>(value: T) {
    println!("{:?}", value);
}`),
  entry('generic where clause', `fn pair<T, U>(left: T, right: U) -> (T, U)
where
    T: Clone,
    U: Clone,
{
    (left.clone(), right.clone())
}`),
  entry('lifetime longest', `fn longest<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}`),
  entry('borrow string slice', `fn first_word(value: &str) -> &str {
    &value[..1]
}`),
  entry('mutable reference update', `fn bump(value: &mut i32) {
    *value += 1;
}`),
  entry('result return question mark', `use std::fs;
use std::io;

fn load(path: &str) -> io::Result<String> {
    let text = fs::read_to_string(path)?;
    Ok(text)
}`),
  entry('option map unwrap or', `fn size(name: Option<String>) -> usize {
    name.map(|value| value.len()).unwrap_or(0)
}`),
  entry('if let some value', `fn print_name(name: Option<&str>) {
    if let Some(value) = name {
        println!("{}", value);
    }
}`),
  entry('while let stack pop', `fn drain(mut values: Vec<i32>) {
    while let Some(value) = values.pop() {
        println!("{}", value);
    }
}`),
  entry('hashmap insert entry', `use std::collections::HashMap;

fn main() {
    let mut counts: HashMap<String, usize> = HashMap::new();
    counts.insert("go".into(), 1);
}`),
  entry('hashset from iter', `use std::collections::HashSet;

fn tags() -> HashSet<String> {
    ["rust", "swift"].into_iter().map(String::from).collect()
}`),
  entry('btreemap collect', `use std::collections::BTreeMap;

fn pairs() -> BTreeMap<String, i32> {
    [(String::from("a"), 1), (String::from("b"), 2)].into_iter().collect()
}`),
  entry('derive debug clone', `#[derive(Debug, Clone)]
struct Config {
    host: String,
}`),
  entry('derive serde style', `#[derive(Serialize, Deserialize)]
struct Payload {
    id: String,
}`),
  entry('cfg test module', `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds() {
        assert_eq!(2 + 2, 4);
    }
}`),
  entry('test function assert eq', `#[test]
fn trims() {
    assert_eq!(" hi ".trim(), "hi");
}`),
  entry('macro rules simple', `macro_rules! greet {
    ($name:expr) => {
        println!("hello {}", $name);
    };
}`),
  entry('format macro string', `fn label(id: i32) -> String {
    format!("note-{}", id)
}`),
  entry('eprintln macro stderr', `fn main() {
    eprintln!("error: {}", 404);
}`),
  entry('matches macro usage', `fn active(state: Option<&str>) -> bool {
    matches!(state, Some("on"))
}`),
  entry('thread spawn join', `use std::thread;

fn main() {
    let handle = thread::spawn(|| 42);
    println!("{}", handle.join().unwrap());
}`),
  entry('arc mutex lock', `use std::sync::{Arc, Mutex};

fn main() {
    let count = Arc::new(Mutex::new(0));
    *count.lock().unwrap() += 1;
}`),
  entry('mpsc channel send recv', `use std::sync::mpsc;

fn main() {
    let (tx, rx) = mpsc::channel();
    tx.send(String::from("ready")).unwrap();
    println!("{}", rx.recv().unwrap());
}`),
  entry('iter map collect vec', `fn doubled(values: Vec<i32>) -> Vec<i32> {
    values.into_iter().map(|value| value * 2).collect()
}`),
  entry('iter filter sum', `fn even_total(values: &[i32]) -> i32 {
    values.iter().copied().filter(|value| value % 2 == 0).sum()
}`),
  entry('closure move capture', `fn main() {
    let title = String::from("note");
    let task = move || println!("{}", title);
    task();
}`),
  entry('boxed dyn trait', `trait Render {
    fn render(&self) -> String;
}

fn build() -> Box<dyn Render> {
    todo!()
}`),
  entry('impl trait return', `fn make_title() -> impl Iterator<Item = char> {
    "rust".chars()
}`),
  entry('associated type trait', `trait Store {
    type Item;
    fn get(&self, key: &str) -> Option<Self::Item>;
}`),
  entry('const item string', `const APP_NAME: &str = "vlaina";`),
  entry('static mut counter', `static mut COUNT: i32 = 0;`),
  entry('module declaration', `mod parser;
mod renderer;`),
  entry('pub crate function', `pub(crate) fn slug(title: &str) -> String {
    title.to_lowercase()
}`),
  entry('pub struct fields', `pub struct Note {
    pub id: String,
    pub title: String,
}`),
  entry('enum result alias', `type AppResult<T> = Result<T, Box<dyn std::error::Error>>;`),
  entry('pattern tuple destructure', `fn main() {
    let (left, right) = (1, 2);
    println!("{} {}", left, right);
}`),
  entry('slice pattern match', `fn head(values: &[i32]) -> Option<i32> {
    match values {
        [first, ..] => Some(*first),
        [] => None,
    }
}`),
  entry('range inclusive match', `fn grade(score: u8) -> &'static str {
    match score {
        90..=100 => "a",
        80..=89 => "b",
        _ => "c",
    }
}`),
  entry('loop break value', `fn next_even(mut value: i32) -> i32 {
    loop {
        value += 1;
        if value % 2 == 0 {
            break value;
        }
    }
}`),
  entry('for in iter enumerate', `fn print_all(values: &[String]) {
    for (index, value) in values.iter().enumerate() {
        println!("{}:{}", index, value);
    }
}`),
  entry('string replace collect', `fn slug(title: &str) -> String {
    title.replace(' ', "-")
}`),
  entry('chars collect string', `fn initials(name: &str) -> String {
    name.chars().take(2).collect()
}`),
  entry('vec deque push front', `use std::collections::VecDeque;

fn queue() -> VecDeque<i32> {
    let mut values = VecDeque::new();
    values.push_front(1);
    values
}`),
  entry('binary heap push', `use std::collections::BinaryHeap;

fn heap() -> BinaryHeap<i32> {
    let mut heap = BinaryHeap::new();
    heap.push(3);
    heap
}`),
  entry('box new node', `struct Node {
    next: Option<Box<Node>>,
}

fn leaf() -> Node {
    Node { next: None }
}`),
  entry('rc refcell state', `use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let value = Rc::new(RefCell::new(1));
    *value.borrow_mut() += 1;
}`),
  entry('async fn fetch', `async fn fetch_title() -> Result<String, reqwest::Error> {
    Ok(String::from("note"))
}`),
  entry('tokio main attribute', `#[tokio::main]
async fn main() {
    println!("ready");
}`),
  entry('await call usage', `async fn run() {
    let title = fetch_title().await.unwrap();
    println!("{}", title);
}`),
  entry('pin box future', `use std::future::Future;
use std::pin::Pin;

fn task() -> Pin<Box<dyn Future<Output = i32>>> {
    Box::pin(async { 1 })
}`),
  entry('serde json from str', `fn decode(raw: &str) -> serde_json::Result<Payload> {
    serde_json::from_str(raw)
}`),
  entry('fs read to string', `use std::fs;

fn load() -> std::io::Result<String> {
    fs::read_to_string("note.md")
}`),
  entry('path buf join push', `use std::path::PathBuf;

fn file_path() -> PathBuf {
    let mut path = PathBuf::from("notes");
    path.push("draft.md");
    path
}`),
  entry('command new output', `use std::process::Command;

fn git_status() {
    let output = Command::new("git").arg("status").output().unwrap();
    println!("{}", output.status);
}`),
  entry('env var get', `use std::env;

fn mode() -> String {
    env::var("APP_ENV").unwrap_or_else(|_| String::from("dev"))
}`),
  entry('parse generic string', `fn parse_id(raw: &str) -> Result<u64, std::num::ParseIntError> {
    raw.parse::<u64>()
}`),
  entry('from str impl', `use std::str::FromStr;

struct Port(u16);

impl FromStr for Port {
    type Err = std::num::ParseIntError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(s.parse()?))
    }
}`),
  entry('default derive impl', `#[derive(Default)]
struct Flags {
    done: bool,
}`),
  entry('ord partialord derive', `#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct Key(String);`),
  entry('iterator fold sum', `fn total(values: &[i32]) -> i32 {
    values.iter().fold(0, |acc, value| acc + value)
}`),
  entry('find map parsing', `fn first_number(values: &[&str]) -> Option<i32> {
    values.iter().find_map(|value| value.parse::<i32>().ok())
}`),
  entry('retain mutable vector', `fn keep_even(values: &mut Vec<i32>) {
    values.retain(|value| value % 2 == 0);
}`),
  entry('sort by key closure', `fn sort_titles(values: &mut [String]) {
    values.sort_by_key(|value| value.len());
}`),
  entry('cow borrowed string', `use std::borrow::Cow;

fn text() -> Cow<'static, str> {
    Cow::Borrowed("ready")
}`),
  entry('iterator zip collect', `fn pairs(left: Vec<i32>, right: Vec<i32>) -> Vec<(i32, i32)> {
    left.into_iter().zip(right).collect()
}`),
  entry('match guard syntax', `fn classify(value: i32) -> &'static str {
    match value {
        v if v < 0 => "neg",
        0 => "zero",
        _ => "pos",
    }
}`),
  entry('ref pattern binding', `fn show(name: Option<String>) {
    if let Some(ref value) = name {
        println!("{}", value);
    }
}`),
  entry('mut pattern binding', `fn take(mut values: Vec<i32>) -> Vec<i32> {
    values.push(9);
    values
}`),
  entry('question mark option', `fn first(values: &[i32]) -> Option<i32> {
    let value = values.first()?;
    Some(*value)
}`),
  entry('let else syntax', `fn parse(raw: &str) -> u64 {
    let Ok(id) = raw.parse::<u64>() else {
        return 0;
    };
    id
}`),
  entry('if let chain result', `fn render(raw: Result<String, std::io::Error>) {
    if let Ok(value) = raw {
        println!("{}", value);
    }
}`),
  entry('match result arms', `fn load_name(raw: Result<String, String>) -> String {
    match raw {
        Ok(value) => value,
        Err(error) => error,
    }
}`),
  entry('option as_deref use', `fn name(raw: Option<String>) -> &str {
    raw.as_deref().unwrap_or("unknown")
}`),
  entry('vec into boxed slice', `fn boxed(values: Vec<i32>) -> Box<[i32]> {
    values.into_boxed_slice()
}`),
  entry('array iter copied', `fn total() -> i32 {
    [1, 2, 3].iter().copied().sum()
}`),
  entry('include str macro', `const TEMPLATE: &str = include_str!("./template.txt");`),
  entry('include bytes macro', `const ICON: &[u8] = include_bytes!("./icon.bin");`),
  entry('panic macro message', `fn fail() {
    panic!("unexpected state");
}`),
  entry('todo macro stub', `fn later() -> i32 {
    todo!()
}`),
  entry('unreachable macro branch', `fn code(flag: bool) -> i32 {
    if flag { 1 } else { unreachable!() }
}`),
  entry('dbg macro inspect', `fn main() {
    let value = dbg!(41 + 1);
    println!("{}", value);
}`),
  entry('raw string literal', `fn query() -> &'static str {
    r#"select * from notes where title = "rust""#
}`),
  entry('byte string literal', `fn bytes() -> &'static [u8] {
    b"rust"
}`),
  entry('char literal match', `fn is_r(value: char) -> bool {
    matches!(value, 'r')
}`),
  entry('const generic array', `fn zeros<const N: usize>() -> [u8; N] {
    [0; N]
}`),
  entry('impl generic struct', `struct Cache<T> {
    value: T,
}

impl<T> Cache<T> {
    fn value(&self) -> &T {
        &self.value
    }
}`),
];
