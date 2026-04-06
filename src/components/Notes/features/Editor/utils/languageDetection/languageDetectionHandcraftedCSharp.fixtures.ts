import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedCSharpCases: readonly HandcraftedLanguageCase[] = [
  entry('console write line main', `using System;

class Program {
  static void Main() {
    Console.WriteLine("hello");
  }
}`),
  entry('namespace block class', `namespace Vlaina.Editor {
  class NoteStore {
  }
}`),
  entry('file scoped namespace', `namespace Vlaina.Editor;

class NoteStore {
}`),
  entry('using system linq', `using System;
using System.Linq;

class Example {
  static int Sum(int[] values) {
    return values.Where(value => value > 0).Sum();
  }
}`),
  entry('list property getter setter', `using System.Collections.Generic;

class Example {
  public List<string> Titles { get; set; } = new();
}`),
  entry('init only property', `class Example {
  public string Title { get; init; } = "draft";
}`),
  entry('record primary constructor', `public record Note(string Id, string Title);`),
  entry('sealed record', `public sealed record SyncResult(bool Ok, string Message);`),
  entry('record struct point', `public readonly record struct Point(int X, int Y);`),
  entry('enum with values', `enum SyncState {
  Idle = 0,
  Running = 1,
  Failed = 2
}`),
  entry('interface with task', `using System.Threading.Tasks;

interface INotesClient {
  Task<string> LoadAsync(string id);
}`),
  entry('generic interface', `interface IRepository<T> {
  T? FindById(string id);
}`),
  entry('class implements interface', `class MemoryStore : IRepository<string> {
  public string? FindById(string id) {
    return id;
  }
}`),
  entry('inherit exception', `using System;

class NoteException : Exception {
  public NoteException(string message) : base(message) {
  }
}`),
  entry('expression bodied method', `class Example {
  public string Slug(string value) => value.Trim().ToLowerInvariant();
}`),
  entry('expression bodied property', `class Example {
  public int Count => 3;
}`),
  entry('primary constructor field style', `class Example {
  private readonly string _title;

  public Example(string title) {
    _title = title;
  }
}`),
  entry('private set property', `class Example {
  public int Count { get; private set; }
}`),
  entry('protected internal method', `class Example {
  protected internal virtual void Save() {
  }
}`),
  entry('override tostring', `using System;

class Example {
  public override string ToString() {
    return "Example";
  }
}`),
  entry('readonly field', `class Example {
  private readonly int _size = 4;
}`),
  entry('const field', `class Example {
  private const string AppName = "vlaina";
}`),
  entry('static readonly field', `class Example {
  private static readonly object SyncRoot = new();
}`),
  entry('nullable string property', `class Example {
  public string? Subtitle { get; set; }
}`),
  entry('null forgiving assignment', `class Example {
  private string _title = null!;
}`),
  entry('using var disposable', `using System.IO;

class Example {
  void Load() {
    using var stream = File.OpenRead("note.txt");
  }
}`),
  entry('await using var disposable', `using System.IO;
using System.Threading.Tasks;

class Example {
  async Task LoadAsync() {
    await using var stream = File.OpenRead("note.txt");
    await Task.CompletedTask;
  }
}`),
  entry('async task method', `using System.Threading.Tasks;

class Example {
  public async Task<string> LoadAsync() {
    await Task.Delay(1);
    return "ok";
  }
}`),
  entry('async value task', `using System.Threading.Tasks;

class Example {
  public async ValueTask<int> CountAsync() {
    await Task.Delay(1);
    return 1;
  }
}`),
  entry('task from result', `using System.Threading.Tasks;

class Example {
  Task<string> Load() {
    return Task.FromResult("ok");
  }
}`),
  entry('linq select anonymous', `using System.Linq;

class Example {
  object[] Map(string[] values) {
    return values.Select(value => new { value }).ToArray();
  }
}`),
  entry('linq query syntax', `using System.Linq;

class Example {
  int[] Filter(int[] values) {
    var query = from value in values where value > 0 select value;
    return query.ToArray();
  }
}`),
  entry('where await chain', `using System.Linq;
using System.Threading.Tasks;

class Example {
  public async Task<int> RunAsync(int[] values) {
    var items = values.Where(value => value > 0).ToArray();
    await Task.Delay(1);
    return items.Length;
  }
}`),
  entry('dictionary collection initializer', `using System.Collections.Generic;

class Example {
  Dictionary<string, int> Counts = new() { ["draft"] = 1, ["done"] = 2 };
}`),
  entry('list collection initializer', `using System.Collections.Generic;

class Example {
  List<string> Items = new() { "a", "b", "c" };
}`),
  entry('target typed new', `using System.Collections.Generic;

class Example {
  Dictionary<string, int> Counts = new();
}`),
  entry('switch expression', `class Example {
  string Label(int value) => value switch {
    1 => "one",
    _ => "other",
  };
}`),
  entry('pattern matching is', `class Example {
  int Length(object value) {
    if (value is string text) {
      return text.Length;
    }

    return 0;
  }
}`),
  entry('property pattern', `class Example {
  bool Ready(Note note) {
    return note is { Archived: false, Title.Length: > 0 };
  }
}`),
  entry('tuple return', `class Example {
  (int left, int right) Pair() {
    return (1, 2);
  }
}`),
  entry('deconstruct tuple', `class Example {
  void Run() {
    var (left, right) = (1, 2);
  }
}`),
  entry('discard out variable', `using System;

class Example {
  bool Parse(string raw) {
    return int.TryParse(raw, out _);
  }
}`),
  entry('out var parse', `using System;

class Example {
  int Parse(string raw) {
    return int.TryParse(raw, out var value) ? value : 0;
  }
}`),
  entry('nameof usage', `using System;

class Example {
  string Field() {
    return nameof(Field);
  }
}`),
  entry('interpolated string', `class Example {
  string Label(string value) {
    return $"note:{value}";
  }
}`),
  entry('raw verbatim string path', `class Example {
  string Path() {
    return @"C:\\notes\\draft.txt";
  }
}`),
  entry('string interpolation format', `using System;

class Example {
  string Label(int value) {
    return $"count={value}";
  }
}`),
  entry('index range slice', `class Example {
  string Tail(string value) {
    return value[1..^0];
  }
}`),
  entry('coalesce assignment', `class Example {
  void Run(string? title) {
    title ??= "draft";
  }
}`),
  entry('null conditional access', `class Example {
  int Count(Note? note) {
    return note?.Title?.Length ?? 0;
  }
}`),
  entry('attribute obsolete', `using System;

class Example {
  [Obsolete]
  public void OldMethod() {
  }
}`),
  entry('attribute serializable', `using System;

[Serializable]
class Example {
}`),
  entry('attribute api controller', `using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/notes")]
class NotesController : ControllerBase {
}`),
  entry('http get action', `using Microsoft.AspNetCore.Mvc;

class NotesController : ControllerBase {
  [HttpGet("notes")]
  public ActionResult<string> Get() {
    return "ok";
  }
}`),
  entry('xunit fact test', `using Xunit;

public class ExampleTests {
  [Fact]
  public void AddsValues() {
    Assert.Equal(4, 2 + 2);
  }
}`),
  entry('nunit test fixture', `using NUnit.Framework;

[TestFixture]
class ExampleTests {
  [Test]
  public void AddsValues() {
    Assert.That(2 + 2, Is.EqualTo(4));
  }
}`),
  entry('mstest method', `using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class ExampleTests {
  [TestMethod]
  public void AddsValues() {
    Assert.AreEqual(4, 2 + 2);
  }
}`),
  entry('minimal api map get', `using Microsoft.AspNetCore.Builder;

var app = WebApplication.CreateBuilder(args).Build();
app.MapGet("/health", () => Results.Ok(new { ok = true }));`),
  entry('dependency injection constructor', `class Example {
  private readonly INotesClient _client;

  public Example(INotesClient client) {
    _client = client;
  }
}`),
  entry('generic method where class', `class Example {
  T? Load<T>() where T : class {
    return default;
  }
}`),
  entry('generic method where new', `class Example {
  T Create<T>() where T : new() {
    return new T();
  }
}`),
  entry('generic class where constraint', `class Cache<T> where T : notnull {
  public T Value { get; }

  public Cache(T value) {
    Value = value;
  }
}`),
  entry('interface covariance', `interface ILoader<out T> {
  T Load();
}`),
  entry('struct implementation', `struct Point {
  public int X { get; set; }
  public int Y { get; set; }
}`),
  entry('readonly struct', `readonly struct Size {
  public int Width { get; }
  public int Height { get; }

  public Size(int width, int height) {
    Width = width;
    Height = height;
  }
}`),
  entry('partial class', `partial class Example {
  void Run() {
  }
}`),
  entry('abstract class override', `abstract class BaseJob {
  public abstract void Run();
}

class Job : BaseJob {
  public override void Run() {
  }
}`),
  entry('virtual override', `class Parent {
  public virtual string Name() {
    return "parent";
  }
}

class Child : Parent {
  public override string Name() {
    return "child";
  }
}`),
  entry('sealed override', `class Parent {
  public virtual void Save() {
  }
}

class Child : Parent {
  public sealed override void Save() {
  }
}`),
  entry('lock statement', `class Example {
  private readonly object _sync = new();

  void Run() {
    lock (_sync) {
      System.Console.WriteLine("ok");
    }
  }
}`),
  entry('checked arithmetic', `class Example {
  int Add(int left, int right) {
    checked {
      return left + right;
    }
  }
}`),
  entry('unsafe fixed block', `unsafe class Example {
  void Run(int[] values) {
    fixed (int* pointer = values) {
    }
  }
}`),
  entry('delegate declaration', `public delegate void SavedHandler(string id);`),
  entry('event handler', `class Example {
  public event System.EventHandler? Saved;
}`),
  entry('lambda assigned func', `using System;

class Example {
  Func<int, int> Double = value => value * 2;
}`),
  entry('local function', `class Example {
  int Run() {
    int Add(int left, int right) {
      return left + right;
    }

    return Add(1, 2);
  }
}`),
  entry('partial method declaration', `partial class Example {
  partial void OnSaved();
}`),
  entry('params array method', `class Example {
  int Sum(params int[] values) {
    return values.Length;
  }
}`),
  entry('ref return', `class Example {
  private int _value;

  ref int Value() {
    return ref _value;
  }
}`),
  entry('in parameter readonly', `class Example {
  int Sum(in int left, in int right) {
    return left + right;
  }
}`),
  entry('operator overload', `struct Value {
  public int Count { get; }

  public Value(int count) {
    Count = count;
  }

  public static Value operator +(Value left, Value right) => new(left.Count + right.Count);
}`),
  entry('implicit conversion', `struct Slug {
  public string Value { get; }

  public Slug(string value) {
    Value = value;
  }

  public static implicit operator string(Slug slug) => slug.Value;
}`),
  entry('indexer property', `class Example {
  private readonly string[] _items = new string[4];

  public string this[int index] {
    get => _items[index];
    set => _items[index] = value;
  }
}`),
  entry('with expression record', `public record Note(string Title, bool Archived);

class Example {
  Note Archive(Note note) {
    return note with { Archived = true };
  }
}`),
  entry('collection expression span', `using System;

class Example {
  void Run() {
    Span<int> values = [1, 2, 3];
  }
}`),
  entry('required member', `class Example {
  public required string Title { get; init; }
}`),
  entry('scoped parameter', `ref struct Example {
  public void Load(scoped ReadOnlySpan<char> value) {
  }
}`),
  entry('readonly list interface', `using System.Collections.Generic;

class Example {
  IReadOnlyList<string> Values() {
    return new List<string> { "a" };
  }
}`),
  entry('dictionary try get value', `using System.Collections.Generic;

class Example {
  int Read(Dictionary<string, int> counts) {
    return counts.TryGetValue("draft", out var value) ? value : 0;
  }
}`),
  entry('file read all text', `using System.IO;

class Example {
  string Load() {
    return File.ReadAllText("note.txt");
  }
}`),
  entry('path combine', `using System.IO;

class Example {
  string Build() {
    return Path.Combine("notes", "draft.md");
  }
}`),
  entry('json serializer', `using System.Text.Json;

class Example {
  string Encode(object value) {
    return JsonSerializer.Serialize(value);
  }
}`),
  entry('http client get string', `using System.Net.Http;
using System.Threading.Tasks;

class Example {
  async Task<string> LoadAsync(HttpClient client) {
    return await client.GetStringAsync("https://example.com");
  }
}`),
  entry('guid new guid', `using System;

class Example {
  Guid Next() {
    return Guid.NewGuid();
  }
}`),
  entry('datetime utc now', `using System;

class Example {
  DateTime Value() {
    return DateTime.UtcNow;
  }
}`),
  entry('cancellation token parameter', `using System.Threading;
using System.Threading.Tasks;

class Example {
  async Task RunAsync(CancellationToken cancellationToken) {
    await Task.Delay(1, cancellationToken);
  }
}`),
  entry('parallel foreach async', `using System.Collections.Generic;
using System.Threading.Tasks;

class Example {
  async Task RunAsync(IEnumerable<int> values) {
    await Parallel.ForEachAsync(values, async (value, cancellationToken) => {
      await Task.Delay(value, cancellationToken);
    });
  }
}`),
  entry('async enumerable', `using System.Collections.Generic;
using System.Threading.Tasks;

class Example {
  async IAsyncEnumerable<int> Values() {
    await Task.Delay(1);
    yield return 1;
  }
}`),
  entry('yield return enumerable', `using System.Collections.Generic;

class Example {
  IEnumerable<int> Values() {
    yield return 1;
    yield return 2;
  }
}`),
  entry('immutable array create', `using System.Collections.Immutable;

class Example {
  ImmutableArray<int> Values() {
    return ImmutableArray.Create(1, 2, 3);
  }
}`),
];
