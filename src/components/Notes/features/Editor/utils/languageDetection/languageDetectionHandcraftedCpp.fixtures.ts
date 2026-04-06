import type { HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedCppCases: readonly HandcraftedLanguageCase[] = [
  {
    name: 'hello world cout',
    sample: `#include <iostream>

int main() {
  std::cout << "hello" << std::endl;
}`,
  },
  {
    name: 'using namespace printer',
    sample: `#include <iostream>
using namespace std;

int main() {
  cout << "ready" << endl;
}`,
  },
  {
    name: 'vector accumulate sum',
    sample: `#include <numeric>
#include <vector>

std::vector<int> values = {1, 2, 3, 4};
int total = std::accumulate(values.begin(), values.end(), 0);`,
  },
  {
    name: 'vector sort lambda',
    sample: `#include <algorithm>
#include <vector>

std::sort(users.begin(), users.end(), [](const auto& left, const auto& right) {
  return left.id < right.id;
});`,
  },
  {
    name: 'string replace spaces',
    sample: `#include <algorithm>
#include <string>

std::string slug = title;
std::replace(slug.begin(), slug.end(), ' ', '-');`,
  },
  {
    name: 'map frequency count',
    sample: `#include <map>
#include <string>

std::map<std::string, int> counts;
++counts[word];`,
  },
  {
    name: 'unordered set tags',
    sample: `#include <string>
#include <unordered_set>

std::unordered_set<std::string> tags;
tags.insert("inbox");`,
  },
  {
    name: 'deque push front back',
    sample: `#include <deque>

std::deque<int> queue;
queue.push_front(1);
queue.push_back(2);`,
  },
  {
    name: 'queue next task',
    sample: `#include <queue>
#include <string>

std::queue<std::string> jobs;
jobs.push("sync");
auto next = jobs.front();`,
  },
  {
    name: 'stack unwind names',
    sample: `#include <stack>
#include <string>

std::stack<std::string> frames;
frames.push("main");
frames.pop();`,
  },
  {
    name: 'pair coordinates',
    sample: `#include <utility>

std::pair<int, int> cursor = {12, 48};
auto [x, y] = cursor;`,
  },
  {
    name: 'tuple structured binding',
    sample: `#include <tuple>

std::tuple<int, std::string, bool> row = {7, "done", true};
auto [id, title, archived] = row;`,
  },
  {
    name: 'array fixed buffer',
    sample: `#include <array>

std::array<char, 4> code = {'O', 'K', '!', '\\0'};
auto first = code.front();`,
  },
  {
    name: 'optional parse port',
    sample: `#include <optional>

std::optional<int> parse_port(const std::string& value) {
  if (value.empty()) return std::nullopt;
  return std::stoi(value);
}`,
  },
  {
    name: 'variant visit payload',
    sample: `#include <string>
#include <variant>

std::variant<int, std::string> payload = "ok";
std::visit([](const auto& value) { std::cout << value; }, payload);`,
  },
  {
    name: 'filesystem exists check',
    sample: `#include <filesystem>

std::filesystem::path root = "notes";
bool ready = std::filesystem::exists(root);`,
  },
  {
    name: 'thread join worker',
    sample: `#include <thread>

std::thread worker([] {
  run_sync();
});
worker.join();`,
  },
  {
    name: 'mutex lock guard',
    sample: `#include <mutex>

std::mutex mutex;
std::lock_guard<std::mutex> lock(mutex);
shared_state = 1;`,
  },
  {
    name: 'condition variable wait',
    sample: `#include <condition_variable>
#include <mutex>

std::condition_variable cv;
std::unique_lock<std::mutex> lock(mutex);
cv.wait(lock, [] { return ready; });`,
  },
  {
    name: 'atomic fetch add',
    sample: `#include <atomic>

std::atomic<int> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);`,
  },
  {
    name: 'chrono duration cast',
    sample: `#include <chrono>

auto elapsed = std::chrono::steady_clock::now() - started_at;
auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(elapsed).count();`,
  },
  {
    name: 'ifstream read line',
    sample: `#include <fstream>
#include <string>

std::ifstream input("config.txt");
std::string line;
std::getline(input, line);`,
  },
  {
    name: 'ofstream write report',
    sample: `#include <fstream>

std::ofstream out("report.txt");
out << "processed=" << processed << '\\n';`,
  },
  {
    name: 'stringstream parse ints',
    sample: `#include <sstream>

std::stringstream stream("10 20 30");
int a = 0;
int b = 0;
stream >> a >> b;`,
  },
  {
    name: 'regex email match',
    sample: `#include <regex>
#include <string>

std::regex pattern(R"((.+)@(.+))");
bool valid = std::regex_match(email, pattern);`,
  },
  {
    name: 'random mt19937 draw',
    sample: `#include <random>

std::mt19937 rng(std::random_device{}());
std::uniform_int_distribution<int> dist(1, 6);
int roll = dist(rng);`,
  },
  {
    name: 'iota sequence fill',
    sample: `#include <numeric>
#include <vector>

std::vector<int> ids(5);
std::iota(ids.begin(), ids.end(), 1);`,
  },
  {
    name: 'find if active user',
    sample: `#include <algorithm>

auto it = std::find_if(users.begin(), users.end(), [](const auto& user) {
  return user.active;
});`,
  },
  {
    name: 'erase remove archived',
    sample: `#include <algorithm>
#include <vector>

items.erase(std::remove_if(items.begin(), items.end(), [](const auto& item) {
  return item.archived;
}), items.end());`,
  },
  {
    name: 'transform uppercase chars',
    sample: `#include <algorithm>
#include <cctype>
#include <string>

std::transform(name.begin(), name.end(), name.begin(), [](unsigned char ch) {
  return static_cast<char>(std::toupper(ch));
});`,
  },
  {
    name: 'copy if even values',
    sample: `#include <algorithm>
#include <vector>

std::vector<int> even;
std::copy_if(values.begin(), values.end(), std::back_inserter(even), [](int value) {
  return value % 2 == 0;
});`,
  },
  {
    name: 'all of valid digits',
    sample: `#include <algorithm>
#include <cctype>

bool ok = std::all_of(code.begin(), code.end(), [](unsigned char ch) {
  return std::isdigit(ch) != 0;
});`,
  },
  {
    name: 'any of warning flags',
    sample: `#include <algorithm>

bool flagged = std::any_of(flags.begin(), flags.end(), [](const auto& flag) {
  return flag.severity > 2;
});`,
  },
  {
    name: 'none of archived records',
    sample: `#include <algorithm>

bool clean = std::none_of(notes.begin(), notes.end(), [](const auto& note) {
  return note.archived;
});`,
  },
  {
    name: 'stable sort scores',
    sample: `#include <algorithm>

std::stable_sort(scores.begin(), scores.end(), [](const auto& left, const auto& right) {
  return left.value > right.value;
});`,
  },
  {
    name: 'partial sum totals',
    sample: `#include <numeric>
#include <vector>

std::vector<int> totals(values.size());
std::partial_sum(values.begin(), values.end(), totals.begin());`,
  },
  {
    name: 'adjacent find duplicates',
    sample: `#include <algorithm>

auto duplicate = std::adjacent_find(tokens.begin(), tokens.end());
if (duplicate != tokens.end()) {
  report(*duplicate);
}`,
  },
  {
    name: 'lower bound position',
    sample: `#include <algorithm>

auto pos = std::lower_bound(ids.begin(), ids.end(), target_id);
ids.insert(pos, target_id);`,
  },
  {
    name: 'equal range multimap',
    sample: `#include <map>

auto [first, last] = tags.equal_range("todo");
for (auto it = first; it != last; ++it) {
  consume(it->second);
}`,
  },
  {
    name: 'priority queue heap',
    sample: `#include <queue>

std::priority_queue<int> heap;
heap.push(5);
heap.push(9);
int top = heap.top();`,
  },
  {
    name: 'set intersection ids',
    sample: `#include <algorithm>
#include <set>
#include <vector>

std::vector<int> common;
std::set_intersection(left.begin(), left.end(), right.begin(), right.end(), std::back_inserter(common));`,
  },
  {
    name: 'make unique session',
    sample: `#include <memory>

auto session = std::make_unique<Session>(config);
session->start();`,
  },
  {
    name: 'shared ptr cache node',
    sample: `#include <memory>

std::shared_ptr<Node> node = std::make_shared<Node>();
cache.push_back(node);`,
  },
  {
    name: 'weak ptr expired check',
    sample: `#include <memory>

if (auto current = weak_node.lock()) {
  current->refresh();
}`,
  },
  {
    name: 'unique ptr custom deleter',
    sample: `#include <cstdio>
#include <memory>

std::unique_ptr<FILE, decltype(&fclose)> handle(fopen(path.c_str(), "r"), &fclose);`,
  },
  {
    name: 'shared from this publish',
    sample: `#include <memory>

class Subscription : public std::enable_shared_from_this<Subscription> {
public:
  std::shared_ptr<Subscription> keep_alive() {
    return shared_from_this();
  }
};`,
  },
  {
    name: 'function callback dispatch',
    sample: `#include <functional>

std::function<void(int)> publish = [](int id) {
  notify(id);
};
publish(7);`,
  },
  {
    name: 'bind placeholders sum',
    sample: `#include <functional>

using namespace std::placeholders;
auto call = std::bind(add_three, 1, _1, 3);
int total = call(5);`,
  },
  {
    name: 'mutable lambda counter',
    sample: `#include <functional>

auto next = [count = 0]() mutable {
  return ++count;
};
auto value = next();`,
  },
  {
    name: 'constexpr square value',
    sample: `constexpr int square(int value) {
  return value * value;
}

constexpr int area = square(8);`,
  },
  {
    name: 'constexpr fibonacci table',
    sample: `constexpr int fib(int n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}

constexpr int eighth = fib(8);`,
  },
  {
    name: 'enum class status',
    sample: `enum class Status {
  Draft,
  Published,
  Archived,
};

Status current = Status::Published;`,
  },
  {
    name: 'class constructor initializer',
    sample: `class Counter {
public:
  explicit Counter(int start) : value_(start) {}

private:
  int value_;
};`,
  },
  {
    name: 'virtual override render',
    sample: `class Renderer {
public:
  virtual ~Renderer() = default;
  virtual void render() = 0;
};

class HtmlRenderer : public Renderer {
public:
  void render() override;
};`,
  },
  {
    name: 'abstract interface repository',
    sample: `class NoteRepository {
public:
  virtual ~NoteRepository() = default;
  virtual void save(const Note& note) = 0;
};`,
  },
  {
    name: 'friend ostream operator',
    sample: `#include <ostream>

class Point {
public:
  Point(int x, int y) : x_(x), y_(y) {}
  friend std::ostream& operator<<(std::ostream& out, const Point& point);

private:
  int x_;
  int y_;
};`,
  },
  {
    name: 'move constructor transfer',
    sample: `#include <utility>

class Buffer {
public:
  Buffer(Buffer&& other) noexcept : data_(std::move(other.data_)) {}

private:
  std::string data_;
};`,
  },
  {
    name: 'delete copy constructor',
    sample: `class Socket {
public:
  Socket(const Socket&) = delete;
  Socket& operator=(const Socket&) = delete;
  Socket(Socket&&) noexcept = default;
};`,
  },
  {
    name: 'noexcept swap method',
    sample: `class Token {
public:
  void swap(Token& other) noexcept {
    std::swap(value_, other.value_);
  }

private:
  std::string value_;
};`,
  },
  {
    name: 'template clamp helper',
    sample: `template <typename T>
T clamp_value(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}`,
  },
  {
    name: 'class template box',
    sample: `template <typename T>
class Box {
public:
  explicit Box(T value) : value_(std::move(value)) {}
  const T& get() const { return value_; }

private:
  T value_;
};`,
  },
  {
    name: 'template specialization formatter',
    sample: `template <typename T>
struct Formatter;

template <>
struct Formatter<int> {
  static std::string call(int value) {
    return std::to_string(value);
  }
};`,
  },
  {
    name: 'nested namespace helper',
    sample: `namespace vlaina::notes {
std::string make_slug(const std::string& value) {
  return value + "-slug";
}
}`,
  },
  {
    name: 'namespace alias filesystem',
    sample: `#include <filesystem>

namespace fs = std::filesystem;
fs::path cache = fs::temp_directory_path() / "vlaina";`,
  },
  {
    name: 'using alias vector int',
    sample: `#include <vector>

using IntList = std::vector<int>;
IntList ids = {1, 2, 3};`,
  },
  {
    name: 'static member counter',
    sample: `class Metrics {
public:
  static int active;
};

int Metrics::active = 0;`,
  },
  {
    name: 'inline getter value',
    sample: `class Session {
public:
  inline int timeout() const { return timeout_; }

private:
  int timeout_{30};
};`,
  },
  {
    name: 'operator plus point',
    sample: `struct Point {
  int x;
  int y;
};

Point operator+(const Point& left, const Point& right) {
  return {left.x + right.x, left.y + right.y};
}`,
  },
  {
    name: 'operator less sortable',
    sample: `struct Entry {
  std::string title;
  bool operator<(const Entry& other) const {
    return title < other.title;
  }
};`,
  },
  {
    name: 'range for const ref',
    sample: `#include <vector>

for (const auto& note : notes) {
  total += note.size();
}`,
  },
  {
    name: 'string view prefix check',
    sample: `#include <string_view>

std::string_view text = "notes/today";
bool is_notes = text.starts_with("notes/");`,
  },
  {
    name: 'span sum values',
    sample: `#include <span>

int sum(std::span<const int> values) {
  int total = 0;
  for (int value : values) total += value;
  return total;
}`,
  },
  {
    name: 'ranges sort names',
    sample: `#include <ranges>
#include <vector>

std::ranges::sort(names);
auto view = names | std::views::filter([](const auto& name) { return !name.empty(); });`,
  },
  {
    name: 'format greeting message',
    sample: `#include <format>
#include <string>

std::string message = std::format("hello {}", username);`,
  },
  {
    name: 'bitset feature flags',
    sample: `#include <bitset>

std::bitset<8> flags;
flags.set(3);
bool enabled = flags.test(3);`,
  },
  {
    name: 'complex absolute value',
    sample: `#include <complex>

auto value = std::complex<double>(3.0, 4.0);
auto magnitude = std::abs(value);`,
  },
  {
    name: 'valarray scale values',
    sample: `#include <valarray>

std::valarray<int> values = {1, 2, 3};
auto doubled = values * 2;`,
  },
  {
    name: 'locale imbue stream',
    sample: `#include <locale>
#include <sstream>

std::stringstream stream;
stream.imbue(std::locale(""));`,
  },
  {
    name: 'runtime error throw',
    sample: `#include <stdexcept>

if (token.empty()) {
  throw std::runtime_error("missing token");
}`,
  },
  {
    name: 'source location logger',
    sample: `#include <source_location>
#include <string_view>

void log(std::string_view message, std::source_location where = std::source_location::current());`,
  },
  {
    name: 'jthread stop token',
    sample: `#include <thread>

std::jthread worker([](std::stop_token stop) {
  while (!stop.stop_requested()) {
    tick();
  }
});`,
  },
  {
    name: 'future async value',
    sample: `#include <future>

auto future = std::async(std::launch::async, [] {
  return load_notes();
});
auto notes = future.get();`,
  },
  {
    name: 'promise handoff value',
    sample: `#include <future>

std::promise<int> promise;
auto future = promise.get_future();
promise.set_value(42);`,
  },
  {
    name: 'packaged task invoke',
    sample: `#include <future>

std::packaged_task<int()> task([] {
  return 7;
});
auto future = task.get_future();
task();`,
  },
  {
    name: 'condition variable any wait',
    sample: `#include <condition_variable>
#include <mutex>

std::condition_variable_any cv;
std::unique_lock<std::mutex> lock(mutex);
cv.wait(lock, [] { return done; });`,
  },
  {
    name: 'scoped lock two mutexes',
    sample: `#include <mutex>

std::scoped_lock lock(left_mutex, right_mutex);
merge(left, right);`,
  },
  {
    name: 'shared mutex reader lock',
    sample: `#include <shared_mutex>

std::shared_lock<std::shared_mutex> lock(mutex);
auto snapshot = cache;`,
  },
  {
    name: 'filesystem path join',
    sample: `#include <filesystem>

std::filesystem::path base = "/tmp";
auto report = base / "reports" / "daily.txt";`,
  },
  {
    name: 'filesystem remove error code',
    sample: `#include <filesystem>
#include <system_error>

std::error_code error;
std::filesystem::remove(path, error);`,
  },
  {
    name: 'ostream iterator print',
    sample: `#include <algorithm>
#include <iterator>

std::copy(values.begin(), values.end(), std::ostream_iterator<int>(std::cout, ","));`,
  },
  {
    name: 'istream iterator total',
    sample: `#include <iterator>
#include <numeric>
#include <sstream>

std::istringstream input("1 2 3 4");
std::istream_iterator<int> begin(input), end;
int total = std::accumulate(begin, end, 0);`,
  },
  {
    name: 'transform reduce dot',
    sample: `#include <numeric>

int dot = std::transform_reduce(left.begin(), left.end(), right.begin(), 0);`,
  },
  {
    name: 'gcd lcm numeric',
    sample: `#include <numeric>

int common = std::gcd(a, b);
int period = std::lcm(a, b);`,
  },
  {
    name: 'clamp viewport width',
    sample: `#include <algorithm>

width = std::clamp(width, 320, 1440);`,
  },
  {
    name: 'byte buffer array',
    sample: `#include <array>
#include <cstddef>

std::array<std::byte, 16> buffer{};
buffer[0] = std::byte{0x1};`,
  },
  {
    name: 'optional emplace token',
    sample: `#include <optional>

std::optional<std::string> token;
token.emplace("demo");`,
  },
  {
    name: 'variant holds string',
    sample: `#include <string>
#include <variant>

std::variant<int, std::string> state = std::string("ok");
bool text = std::holds_alternative<std::string>(state);`,
  },
  {
    name: 'switch enum to text',
    sample: `#include <string>

std::string to_string(Status status) {
  switch (status) {
    case Status::Draft: return "draft";
    case Status::Published: return "published";
  }
  return "unknown";
}`,
  },
  {
    name: 'class private constexpr limit',
    sample: `class UploadQueue {
public:
  int capacity() const { return max_items_; }

private:
  static constexpr int max_items_ = 64;
};`,
  },
  {
    name: 'custom comparator set',
    sample: `#include <set>
#include <string>

struct ByLength {
  bool operator()(const std::string& left, const std::string& right) const {
    return left.size() < right.size();
  }
};

std::set<std::string, ByLength> tags;`,
  },
];
