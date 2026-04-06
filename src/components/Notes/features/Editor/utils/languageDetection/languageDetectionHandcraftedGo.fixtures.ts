import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedGoCases: readonly HandcraftedLanguageCase[] = [
  entry('hello world main', `package main

import "fmt"

func main() {
  fmt.Println("hello")
}`),
  entry('multi import group', `package main

import (
  "fmt"
  "strings"
)

func main() {
  fmt.Println(strings.ToUpper("go"))
}`),
  entry('short declaration sum', `total := price + tax`),
  entry('multiple return read file', `package main

import "os"

func load(path string) ([]byte, error) {
  data, err := os.ReadFile(path)
  if err != nil {
    return nil, err
  }
  return data, nil
}`),
  entry('package tools helper', `package tools

func Add(left int, right int) int {
  return left + right
}`),
  entry('struct user fields', `package main

type User struct {
  ID int
  Name string
}`),
  entry('interface reader writer', `package main

type Loader interface {
  Load(id string) ([]byte, error)
}`),
  entry('method value receiver', `package main

type Counter struct {
  Value int
}

func (c Counter) String() string {
  return fmt.Sprintf("%d", c.Value)
}`),
  entry('method pointer receiver', `package main

type Counter struct {
  Value int
}

func (c *Counter) Increment() {
  c.Value++
}`),
  entry('embedded struct author', `package main

type Meta struct {
  CreatedAt time.Time
}

type Note struct {
  Meta
  Title string
}`),
  entry('generic minimum function', `package main

func Min[T ~int | ~int64 | ~float64](left T, right T) T {
  if left < right {
    return left
  }
  return right
}`),
  entry('map literal scores', `package main

var scores = map[string]int{
  "go": 10,
  "rust": 9,
}`),
  entry('slice append values', `package main

func main() {
  values := []string{"a", "b"}
  values = append(values, "c")
}`),
  entry('range slice index value', `package main

func printAll(items []string) {
  for index, item := range items {
    fmt.Println(index, item)
  }
}`),
  entry('range map entries', `package main

func main() {
  counts := map[string]int{"inbox": 2, "done": 1}
  for key, value := range counts {
    fmt.Println(key, value)
  }
}`),
  entry('channel send receive', `package main

func main() {
  ch := make(chan int)
  go func() {
    ch <- 42
  }()
  fmt.Println(<-ch)
}`),
  entry('buffered channel queue', `package main

func main() {
  jobs := make(chan string, 2)
  jobs <- "first"
  jobs <- "second"
  close(jobs)
}`),
  entry('select timeout', `package main

import "time"

func main() {
  select {
  case <-time.After(time.Second):
    fmt.Println("timeout")
  }
}`),
  entry('goroutine closure', `package main

func main() {
  done := make(chan struct{})
  go func() {
    defer close(done)
    fmt.Println("working")
  }()
  <-done
}`),
  entry('waitgroup workers', `package main

import "sync"

func main() {
  var wg sync.WaitGroup
  for i := 0; i < 3; i++ {
    wg.Add(1)
    go func(id int) {
      defer wg.Done()
      fmt.Println(id)
    }(i)
  }
  wg.Wait()
}`),
  entry('mutex guard counter', `package main

import "sync"

type Store struct {
  mu sync.Mutex
  count int
}

func (s *Store) Increment() {
  s.mu.Lock()
  defer s.mu.Unlock()
  s.count++
}`),
  entry('rwmutex cache', `package main

import "sync"

type Cache struct {
  mu sync.RWMutex
  items map[string]string
}

func (c *Cache) Get(key string) string {
  c.mu.RLock()
  defer c.mu.RUnlock()
  return c.items[key]
}`),
  entry('context timeout request', `package main

import (
  "context"
  "time"
)

func main() {
  ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
  defer cancel()
  _ = ctx
}`),
  entry('http handle func', `package main

import "net/http"

func main() {
  http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
  })
}`),
  entry('http request with context', `package main

import (
  "context"
  "net/http"
)

func fetch(ctx context.Context, url string) (*http.Response, error) {
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
  if err != nil {
    return nil, err
  }
  return http.DefaultClient.Do(req)
}`),
  entry('json marshal user', `package main

import "encoding/json"

func encode(v any) ([]byte, error) {
  return json.Marshal(v)
}`),
  entry('json decoder stream', `package main

import (
  "encoding/json"
  "io"
)

func decode(r io.Reader, target any) error {
  return json.NewDecoder(r).Decode(target)
}`),
  entry('struct tags json', 'package main\n\ntype Note struct {\n  ID string `json:"id"`\n  Title string `json:"title"`\n}\n'),
  entry('time ticker loop', `package main

import "time"

func run() {
  ticker := time.NewTicker(time.Minute)
  defer ticker.Stop()
  for range ticker.C {
    println("tick")
  }
}`),
  entry('defer close file', `package main

import "os"

func main() {
  file, err := os.Open("notes.txt")
  if err != nil {
    panic(err)
  }
  defer file.Close()
}`),
  entry('named return error', `package main

func parse(raw string) (value int, err error) {
  if raw == "" {
    err = errors.New("empty")
    return
  }
  return 1, nil
}`),
  entry('error wrapping fmt errorf', `package main

import "fmt"

func save(id string, err error) error {
  if err != nil {
    return fmt.Errorf("save %s: %w", id, err)
  }
  return nil
}`),
  entry('os read file helper', `package main

import "os"

func loadConfig(path string) (string, error) {
  data, err := os.ReadFile(path)
  if err != nil {
    return "", err
  }
  return string(data), nil
}`),
  entry('io copy buffer', `package main

import "io"

func copyAll(dst io.Writer, src io.Reader) (int64, error) {
  return io.Copy(dst, src)
}`),
  entry('bytes buffer write', `package main

import "bytes"

func build() string {
  var buf bytes.Buffer
  buf.WriteString("go")
  return buf.String()
}`),
  entry('strings builder concat', `package main

import "strings"

func title(first string, second string) string {
  var b strings.Builder
  b.WriteString(first)
  b.WriteString(" ")
  b.WriteString(second)
  return b.String()
}`),
  entry('rune iteration string', `package main

func main() {
  for _, r := range "你好" {
    println(r)
  }
}`),
  entry('type assertion switch', `package main

func describe(value any) string {
  switch value.(type) {
  case string:
    return "text"
  case int:
    return "number"
  default:
    return "other"
  }
}`),
  entry('type switch with variable', `package main

func name(value any) string {
  switch v := value.(type) {
  case string:
    return v
  case fmt.Stringer:
    return v.String()
  default:
    return ""
  }
}`),
  entry('const iota enum', `package main

type State int

const (
  StateIdle State = iota
  StateRunning
  StateFailed
)`),
  entry('blank identifier ignore error', `package main

func main() {
  _, err := io.Copy(io.Discard, os.Stdin)
  if err != nil {
    panic(err)
  }
}`),
  entry('init function defaults', `package main

var version string

func init() {
  version = "dev"
}`),
  entry('variadic join strings', `package main

func join(parts ...string) string {
  return strings.Join(parts, ",")
}`),
  entry('anonymous struct literal', `package main

func main() {
  item := struct {
    Name string
    Done bool
  }{
    Name: "ship",
    Done: false,
  }
  _ = item
}`),
  entry('function returns closure', `package main

func next(start int) func() int {
  current := start
  return func() int {
    current++
    return current
  }
}`),
  entry('recover from panic', `package main

func safeRun(fn func()) (err error) {
  defer func() {
    if value := recover(); value != nil {
      err = fmt.Errorf("panic: %v", value)
    }
  }()
  fn()
  return nil
}`),
  entry('select default branch', `package main

func poll(ch <-chan string) string {
  select {
  case value := <-ch:
    return value
  default:
    return ""
  }
}`),
  entry('range over channel', `package main

func consume(stream <-chan int) {
  for value := range stream {
    println(value)
  }
}`),
  entry('close jobs channel', `package main

func stop(jobs chan string) {
  close(jobs)
}`),
  entry('map lookup ok idiom', `package main

func has(items map[string]int, key string) bool {
  _, ok := items[key]
  return ok
}`),
  entry('type alias duration', `package main

type Milliseconds = int64
`),
  entry('generic stack type', `package main

type Stack[T any] struct {
  items []T
}

func (s *Stack[T]) Push(value T) {
  s.items = append(s.items, value)
}`),
  entry('generic comparable set', `package main

type Set[T comparable] map[T]struct{}

func (s Set[T]) Add(value T) {
  s[value] = struct{}{}
}`),
  entry('testing function', `package notes

import "testing"

func TestAdd(t *testing.T) {
  if Add(1, 2) != 3 {
    t.Fatal("unexpected result")
  }
}`),
  entry('benchmark function', `package notes

import "testing"

func BenchmarkParse(b *testing.B) {
  for i := 0; i < b.N; i++ {
    Parse("value")
  }
}`),
  entry('subtest table driven', `package notes

import "testing"

func TestTrim(t *testing.T) {
  cases := []struct {
    name string
    input string
    want string
  }{
    {name: "spaces", input: " hi ", want: "hi"},
  }

  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      if got := Trim(tc.input); got != tc.want {
        t.Fatalf("got %q want %q", got, tc.want)
      }
    })
  }
}`),
  entry('httptest recorder', `package notes

import (
  "net/http"
  "net/http/httptest"
)

func TestHandler(t *testing.T) {
  req := httptest.NewRequest(http.MethodGet, "/notes", nil)
  rec := httptest.NewRecorder()
  handler(rec, req)
}`),
  entry('sql row scan', `package main

func loadName(row *sql.Row) (string, error) {
  var name string
  if err := row.Scan(&name); err != nil {
    return "", err
  }
  return name, nil
}`),
  entry('template execute', `package main

import "text/template"

func render() error {
  tmpl, err := template.New("title").Parse("Hello {{.Name}}")
  if err != nil {
    return err
  }
  return tmpl.Execute(os.Stdout, map[string]string{"Name": "Go"})
}`),
  entry('regexp compile match', `package main

import "regexp"

func valid(raw string) bool {
  re := regexp.MustCompile(` + "`^[a-z0-9-]+$`" + `)
  return re.MatchString(raw)
}`),
  entry('filepath walk dir', `package main

import "path/filepath"

func list(root string) error {
  return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
    return err
  })
}`),
  entry('sync once init', `package main

import "sync"

var once sync.Once

func boot() {
  once.Do(func() {
    println("init")
  })
}`),
  entry('sync pool bytes', `package main

import (
  "bytes"
  "sync"
)

var pool = sync.Pool{
  New: func() any {
    return new(bytes.Buffer)
  },
}`),
  entry('atomic counter add', `package main

import "sync/atomic"

type Metrics struct {
  requests atomic.Int64
}

func (m *Metrics) Hit() {
  m.requests.Add(1)
}`),
  entry('worker pool jobs results', `package main

func runJobs() {
  jobs := make(chan int, 4)
  results := make(chan int, 4)
  go func() {
    for job := range jobs {
      results <- job * 2
    }
  }()
}`),
  entry('context cancel select', `package main

import "context"

func wait(ctx context.Context, done <-chan struct{}) error {
  select {
  case <-ctx.Done():
    return ctx.Err()
  case <-done:
    return nil
  }
}`),
  entry('scanner read lines', `package main

import "bufio"

func countLines(file *os.File) int {
  scanner := bufio.NewScanner(file)
  total := 0
  for scanner.Scan() {
    total++
  }
  return total
}`),
  entry('csv writer rows', `package main

import "encoding/csv"

func saveRows(w io.Writer, rows [][]string) error {
  writer := csv.NewWriter(w)
  defer writer.Flush()
  return writer.WriteAll(rows)
}`),
  entry('flag parse int', `package main

import "flag"

var port = flag.Int("port", 8080, "port to listen on")

func main() {
  flag.Parse()
  println(*port)
}`),
  entry('json raw message', `package main

import "encoding/json"

type Envelope struct {
  Type string
  Body json.RawMessage
}`),
  entry('http middleware wrapper', `package main

import "net/http"

func logging(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    println(r.Method)
    next.ServeHTTP(w, r)
  })
}`),
  entry('interface compile check', `package main

type Runner interface {
  Run() error
}

type Job struct{}

func (Job) Run() error {
  return nil
}

var _ Runner = (*Job)(nil)
`),
  entry('pointer with new', `package main

func main() {
  value := new(int)
  *value = 9
}`),
  entry('nested composite literal', `package main

type Point struct {
  X int
  Y int
}

var path = []Point{
  {X: 1, Y: 2},
  {X: 3, Y: 4},
}`),
  entry('map of slices', `package main

var groups = map[string][]string{
  "team": {"a", "b"},
}`),
  entry('fan in channels', `package main

func merge(left <-chan int, right <-chan int) <-chan int {
  out := make(chan int)
  go func() {
    defer close(out)
    for value := range left {
      out <- value
    }
  }()
  go func() {
    for value := range right {
      out <- value
    }
  }()
  return out
}`),
  entry('done channel stop', `package main

func run(done <-chan struct{}) {
  for {
    select {
    case <-done:
      return
    default:
    }
  }
}`),
  entry('select ctx done', `package main

import "context"

func loop(ctx context.Context, jobs <-chan int) {
  for {
    select {
    case <-ctx.Done():
      return
    case job := <-jobs:
      println(job)
    }
  }
}`),
  entry('sentinel error var', `package main

import "errors"

var ErrClosed = errors.New("closed")
`),
  entry('custom error type', `package main

type ParseError struct {
  Line int
}

func (e ParseError) Error() string {
  return fmt.Sprintf("line %d", e.Line)
}`),
  entry('sort slice func', `package main

import "sort"

func order(items []string) {
  sort.Slice(items, func(i int, j int) bool {
    return items[i] < items[j]
  })
}`),
  entry('sort search index', `package main

import "sort"

func find(items []int, target int) int {
  return sort.Search(len(items), func(i int) bool {
    return items[i] >= target
  })
}`),
  entry('time after func', `package main

import "time"

func main() {
  timer := time.AfterFunc(time.Second, func() {
    println("expired")
  })
  defer timer.Stop()
}`),
  entry('ticker stop defer', `package main

import "time"

func poll() {
  ticker := time.NewTicker(500 * time.Millisecond)
  defer ticker.Stop()
  <-ticker.C
}`),
  entry('net listen tcp', `package main

import "net"

func main() {
  ln, err := net.Listen("tcp", ":8080")
  if err != nil {
    panic(err)
  }
  defer ln.Close()
}`),
  entry('url values encode', `package main

import "net/url"

func query() string {
  values := url.Values{}
  values.Set("page", "1")
  return values.Encode()
}`),
  entry('xml marshal book', `package main

import "encoding/xml"

type Book struct {
  XMLName xml.Name ` + "`xml:\"book\"`" + `
  Title string ` + "`xml:\"title\"`" + `
}`),
  entry('gob encoder value', `package main

import "encoding/gob"

func write(buf *bytes.Buffer, value any) error {
  return gob.NewEncoder(buf).Encode(value)
}`),
  entry('big int add', `package main

import "math/big"

func sum(a string, b string) *big.Int {
  left, _ := new(big.Int).SetString(a, 10)
  right, _ := new(big.Int).SetString(b, 10)
  return new(big.Int).Add(left, right)
}`),
  entry('sync map store', `package main

import "sync"

func remember(cache *sync.Map, key string, value string) {
  cache.Store(key, value)
}`),
  entry('env lookup value', `package main

import "os"

func loadEnv() string {
  value, ok := os.LookupEnv("APP_ENV")
  if !ok {
    return "dev"
  }
  return value
}`),
  entry('filepath join paths', `package main

import "path/filepath"

func filePath(root string, name string) string {
  return filepath.Join(root, name)
}`),
  entry('mkdir all storage', `package main

import "os"

func ensure(path string) error {
  return os.MkdirAll(path, 0o755)
}`),
  entry('exec command context', `package main

import (
  "context"
  "os/exec"
)

func runGit(ctx context.Context) error {
  cmd := exec.CommandContext(ctx, "git", "status")
  return cmd.Run()
}`),
  entry('hex encode bytes', `package main

import "encoding/hex"

func encodeHash(sum []byte) string {
  return hex.EncodeToString(sum)
}`),
  entry('sha256 checksum', `package main

import "crypto/sha256"

func digest(data []byte) [32]byte {
  return sha256.Sum256(data)
}`),
  entry('base64 decode string', `package main

import "encoding/base64"

func decode(raw string) ([]byte, error) {
  return base64.StdEncoding.DecodeString(raw)
}`),
  entry('protobuf style tags', 'package main\n\ntype Message struct {\n  State int32 `protobuf:"varint,1,opt,name=state,proto3" json:"state,omitempty"`\n}\n'),
  entry('main goroutine channel print', `package main

func main() {
  values := make(chan string, 1)
  go func() {
    values <- "ready"
  }()
  println(<-values)
}`),
  entry('generic keys helper', `package main

func Keys[K comparable, V any](items map[K]V) []K {
  keys := make([]K, 0, len(items))
  for key := range items {
    keys = append(keys, key)
  }
  return keys
}`),
];
