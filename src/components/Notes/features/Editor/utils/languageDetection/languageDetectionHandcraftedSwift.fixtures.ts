import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedSwiftCases: readonly HandcraftedLanguageCase[] = [
  entry('uikit view controller', `import UIKit

final class NotesViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
  }
}`),
  entry('swiftui simple body', `import SwiftUI

struct InboxView: View {
  var body: some View {
    Text("Inbox")
  }
}`),
  entry('optional chaining count', `let count = user?.profile?.name.count`),
  entry('guard let url', `func open(_ raw: String) {
  guard let url = URL(string: raw) else { return }
  print(url)
}`),
  entry('defer unlock state', `func update() {
  lock.lock()
  defer { lock.unlock() }
  state += 1
}`),
  entry('enum raw string', `enum SyncState: String {
  case idle
  case running
  case failed
}`),
  entry('struct typed properties', `struct Note {
  let id: UUID
  var title: String
}`),
  entry('class inherits object', `class CacheStore: NSObject {
  var items: [String] = []
}`),
  entry('protocol with method', `protocol Persisting {
  func save() throws
}`),
  entry('string extension slug', `extension String {
  func slugged() -> String {
    lowercased().replacingOccurrences(of: " ", with: "-")
  }
}`),
  entry('function returns string', `func greeting(name: String) -> String {
  "Hello, \\(name)"
}`),
  entry('throwing decode function', `func decode(_ data: Data) throws -> Message {
  try JSONDecoder().decode(Message.self, from: data)
}`),
  entry('do catch request', `do {
  let data = try loader.read()
  print(data.count)
} catch {
  print(error)
}`),
  entry('task await call', `Task {
  let notes = await repository.fetchNotes()
  print(notes.count)
}`),
  entry('actor cache storage', `actor NoteCache {
  private var storage: [UUID: String] = [:]
}`),
  entry('main actor model', `@MainActor
final class ComposerModel: ObservableObject {
  @Published var title = ""
}`),
  entry('did set observer', `var title: String = "" {
  didSet {
    print(title)
  }
}`),
  entry('computed initials', `var initials: String {
  let parts = name.split(separator: " ")
  return parts.prefix(2).map { String($0.first ?? "-") }.joined()
}`),
  entry('generic swap values', `func swapValues<T>(_ left: inout T, _ right: inout T) {
  let old = left
  left = right
  right = old
}`),
  entry('array where element string', `extension Array where Element == String {
  var joinedWithComma: String { joined(separator: ",") }
}`),
  entry('map closure dollars', `let ids = notes.map { $0.id }`),
  entry('compact map url list', `let urls = rawValues.compactMap(URL.init(string:))`),
  entry('reduce total count', `let total = numbers.reduce(0) { $0 + $1 }`),
  entry('sorted by title', `let ordered = notes.sorted { $0.title < $1.title }`),
  entry('filter active notes', `let active = notes.filter { $0.isArchived == false }`),
  entry('typed dictionary literal', `let counts: [String: Int] = ["inbox": 3, "archive": 1]`),
  entry('typed array literal', `let names: [String] = ["a", "b", "c"]`),
  entry('nil coalescing subtitle', `let subtitle = draft.subtitle ?? "Untitled"`),
  entry('if case failure result', `if case let .failure(error) = result {
  print(error.localizedDescription)
}`),
  entry('switch associated enum', `switch state {
case .loaded(let items):
  print(items.count)
case .failed(let error):
  print(error)
default:
  break
}`),
  entry('trailing closure animation', `UIView.animate(withDuration: 0.2) {
  self.banner.alpha = 1
}`),
  entry('escaping completion handler', `func load(completion: @escaping (Result<Data, Error>) -> Void) {
  queue.async {
    completion(.success(Data()))
  }
}`),
  entry('async throws fetcher', `func fetchNotes() async throws -> [Note] {
  try await service.requestNotes()
}`),
  entry('try await inside task', `Task {
  let value = try await api.refreshToken()
  print(value)
}`),
  entry('guard let image', `func render() {
  guard let image = UIImage(named: "cover") else { return }
  print(image)
}`),
  entry('lazy formatter property', `lazy var formatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.dateFormat = "yyyy-MM-dd"
  return formatter
}()`),
  entry('weak delegate property', `weak var delegate: UITableViewDelegate?`),
  entry('unowned self closure', `lazy var dismissAction: () -> Void = { [unowned self] in
  close()
}`),
  entry('private set items', `private(set) var items: [Note] = []`),
  entry('mutating append line', `struct Buffer {
  var lines: [String] = []

  mutating func append(_ line: String) {
    lines.append(line)
  }
}`),
  entry('inout increment value', `func increment(_ value: inout Int) {
  value += 1
}`),
  entry('tuple destructuring point', `let (x, y) = (12, 48)`),
  entry('key path sort', `let ordered = users.sorted { $0[keyPath: .name] < $1[keyPath: .name] }`),
  entry('result typed value', `let result: Result<String, Error> = .success("ok")`),
  entry('url components query items', `import Foundation

var components = URLComponents(string: "https://example.com")
components?.queryItems = [URLQueryItem(name: "page", value: "1")]`),
  entry('codable message struct', `struct Message: Codable {
  let id: UUID
  let title: String
}`),
  entry('json decoder usage', `let note = try JSONDecoder().decode(Note.self, from: data)`),
  entry('notification center observer', `import Foundation

NotificationCenter.default.addObserver(forName: .NSSystemClockDidChange, object: nil, queue: .main) { _ in
  print("changed")
}`),
  entry('dispatch queue main async', `DispatchQueue.main.async {
  self.reload()
}`),
  entry('task sleep nanoseconds', `try await Task.sleep(nanoseconds: 300_000_000)`),
  entry('actor method await', `actor Store {
  func title(for id: UUID) -> String? { nil }
}

let value = await store.title(for: id)`),
  entry('protocol extension default', `protocol BadgePresenting {
  func badgeText() -> String
}

extension BadgePresenting {
  func badgeText() -> String { "0" }
}`),
  entry('associated type sequence', `protocol CacheProtocol {
  associatedtype Value
  func value(for key: String) -> Value?
}`),
  entry('swiftui make body view', `import SwiftUI

func makeRow(title: String) -> some View {
  Text(title)
}`),
  entry('toolbar item placement', `import SwiftUI

ToolbarItem(placement: .topBarTrailing) {
  Button("Save") {}
}`),
  entry('foreach row builder', `import SwiftUI

ForEach(items, id: .id) { item in
  Text(item.title)
}`),
  entry('navigation stack path', `import SwiftUI

NavigationStack {
  List(items) { item in
    Text(item.title)
  }
}`),
  entry('on delete perform', `import SwiftUI

List {
  ForEach(items) { item in
    Text(item.title)
  }
  .onDelete(perform: delete)
}`),
  entry('sheet is presented', `import SwiftUI

.sheet(isPresented: $isPresented) {
  EditorView()
}`),
  entry('button action closure', `import SwiftUI

Button("Archive") {
  archiveAll()
}`),
  entry('task view modifier', `import SwiftUI

.task {
  await load()
}`),
  entry('app storage property', `import SwiftUI

@AppStorage("theme") private var theme = "system"`),
  entry('environment object property', `import SwiftUI

@EnvironmentObject var session: SessionStore`),
  entry('observed object property', `import SwiftUI

@ObservedObject var model: EditorModel`),
  entry('state object property', `import SwiftUI

@StateObject private var model = InboxModel()`),
  entry('guard case enum', `guard case let .loaded(items) = state else { return }
print(items.count)`),
  entry('double optional binding', `if let data = data, let text = String(data: data, encoding: .utf8) {
  print(text)
}`),
  entry('download state enum', `enum DownloadState {
  case idle
  case loading
  case loaded(Data)
  case failed(Error)
}`),
  entry('remove all predicate', `numbers.removeAll { $0.isMultiple(of: 2) }`),
  entry('stride through values', `for value in stride(from: 0, through: 10, by: 2) {
  print(value)
}`),
  entry('for index range', `for index in 0..<items.count {
  print(items[index])
}`),
  entry('url session data task', `let task = URLSession.shared.dataTask(with: request) { data, response, error in
  print(response as Any)
}
task.resume()`),
  entry('main actor run block', `await MainActor.run {
  self.title = "Ready"
}`),
  entry('availability check ios', `if #available(iOS 17.0, *) {
  print("modern")
}`),
  entry('anyobject protocol', `protocol ThemeProviding: AnyObject {
  var currentTheme: String { get }
}`),
  entry('collection where int', `extension Collection where Element == Int {
  var total: Int { reduce(0, +) }
}`),
  entry('some view function', `import SwiftUI

func makeBanner() -> some View {
  Text("Banner")
}`),
  entry('closure type variable', `let action: () -> Void = {
  print("tap")
}`),
  entry('generic transform block', `func transform<T>(_ value: T, using block: (T) -> T) -> T {
  block(value)
}`),
  entry('switch range status', `switch statusCode {
case 200...299:
  print("ok")
default:
  print("error")
}`),
  entry('guard not empty items', `guard !items.isEmpty else { return }
print(items.count)`),
  entry('multiline string interpolation', String.raw`let message = """
Hello, \\(name)
Welcome back
"""`),
  entry('print interpolated value', `print("hello \\(name)")`),
  entry('fatal error missing item', `guard let item else {
  fatalError("Missing item")
}`),
  entry('async let pair values', `async let inbox = api.fetchInbox()
async let archive = api.fetchArchive()
let result = await (inbox, archive)`),
  entry('await for try tuple', `let (data, _) = try await URLSession.shared.data(from: url)`),
  entry('task group usage', `try await withThrowingTaskGroup(of: Note.self) { group in
  group.addTask { try await api.fetchNote(id: first) }
}`),
  entry('property wrapper state value', `@State var isExpanded = false`),
  entry('guard let self pattern', `guard let self else { return }
self.reload()`),
  entry('enum iterable cases', `enum SidebarItem: CaseIterable {
  case inbox
  case archive
}`),
  entry('hashable struct item', `struct Row: Hashable {
  let id: UUID
  let title: String
}`),
  entry('sendable closure alias', `typealias Completion = @Sendable () -> Void`),
  entry('nonisolated actor member', `actor FeedStore {
  nonisolated let name = "feed"
}`),
  entry('await async sequence', `for await event in stream {
  print(event)
}`),
  entry('continuation bridge', `return await withCheckedContinuation { continuation in
  continuation.resume(returning: value)
}`),
  entry('guard let first line', `guard let first = lines.first else { return }
print(first)`),
  entry('extension protocol conforming', `extension URL: Identifiable {
  public var id: String { absoluteString }
}`),
  entry('button role cancel', `import SwiftUI

Button("Close", role: .cancel) {
  dismiss()
}`),
  entry('list selection binding', `import SwiftUI

List(selection: $selection) {
  Text("Inbox")
}`),
  entry('navigation title modifier', `import SwiftUI

.navigationTitle("Notes")`),
];
