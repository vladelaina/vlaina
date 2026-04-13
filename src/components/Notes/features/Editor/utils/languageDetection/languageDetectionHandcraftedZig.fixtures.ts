import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedZigCases: readonly HandcraftedLanguageCase[] = [
  entry('hello world main', `const std = @import("std");

pub fn main() !void {
    try std.io.getStdOut().writer().print("hello\\n", .{});
}`),
  entry('simple pub fn int', `pub fn echo() i32 {
    return 1;
}`),
  entry('fn add ints', `fn add(a: i32, b: i32) i32 {
    return a + b;
}`),
  entry('const import std', `const std = @import("std");`),
  entry('allocator arena init', `const std = @import("std");

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
}`),
  entry('array list append', `const std = @import("std");

pub fn main() !void {
    var list = std.ArrayList(u8).init(std.heap.page_allocator);
    defer list.deinit();
    try list.append('a');
}`),
  entry('slice return text', `fn title() []const u8 {
    return "zig";
}`),
  entry('optional payload if', `fn size(name: ?[]const u8) usize {
    if (name) |value| {
        return value.len;
    }
    return 0;
}`),
  entry('orelse fallback zero', `fn count(value: ?usize) usize {
    return value orelse 0;
}`),
  entry('error union parse', `fn parse(raw: []const u8) !u32 {
    return try std.fmt.parseInt(u32, raw, 10);
}`),
  entry('catch fallback value', `const std = @import("std");

fn parse(raw: []const u8) u32 {
    return std.fmt.parseInt(u32, raw, 10) catch 0;
}`),
  entry('defer close file', `const std = @import("std");

pub fn main() !void {
    const file = try std.fs.cwd().openFile("notes.txt", .{});
    defer file.close();
}`),
  entry('errdefer cleanup', `fn load() !void {
    var buffer: [16]u8 = undefined;
    errdefer _ = &buffer;
}`),
  entry('test expect equal', `const std = @import("std");

test "adds numbers" {
    try std.testing.expectEqual(@as(i32, 4), 2 + 2);
}`),
  entry('struct fields typed', `const User = struct {
    id: u64,
    name: []const u8,
};`),
  entry('packed struct flags', `const Flags = packed struct {
    read: bool,
    write: bool,
    sync: bool,
    _: u5,
};`),
  entry('extern struct c layout', `const Point = extern struct {
    x: c_int,
    y: c_int,
};`),
  entry('enum tag names', `const State = enum {
    idle,
    running,
    failed,
};`),
  entry('tagged union enum', `const Result = union(enum) {
    ok: []const u8,
    err: []const u8,
};`),
  entry('switch union payload', `fn label(result: Result) []const u8 {
    return switch (result) {
        .ok => |value| value,
        .err => |value| value,
    };
}`),
  entry('while iterator loop', `pub fn main() void {
    var index: usize = 0;
    while (index < 3) : (index += 1) {
        _ = index;
    }
}`),
  entry('for items capture', `fn total(values: []const i32) i32 {
    var sum: i32 = 0;
    for (values) |value| {
        sum += value;
    }
    return sum;
}`),
  entry('for index capture', `fn total(values: []const i32) usize {
    var sum: usize = 0;
    for (values, 0..) |_, index| {
        sum += index;
    }
    return sum;
}`),
  entry('inline for comptime', `fn names() void {
    inline for (.{ "a", "b", "c" }) |name| {
        _ = name;
    }
}`),
  entry('comptime block constant', `const value = comptime blk: {
    break :blk 42;
};`),
  entry('comptime parameter anytype', `fn printValue(value: anytype) void {
    _ = value;
}`),
  entry('anyerror alias use', `fn fail() anyerror!void {
    return error.Broken;
}`),
  entry('error set declaration', `const ParseError = error{
    Empty,
    Invalid,
};`),
  entry('error return named', `fn decode(raw: []const u8) ParseError!u8 {
    if (raw.len == 0) return error.Empty;
    return raw[0];
}`),
  entry('multi line string literal', `const text =
    \\first line
    \\second line;
`),
  entry('labelled block break', `fn number() i32 {
    return blk: {
        break :blk 7;
    };
}`),
  entry('switch enum arms', `fn active(state: State) bool {
    return switch (state) {
        .idle => false,
        .running => true,
        .failed => false,
    };
}`),
  entry('switch integer range', `fn grade(score: u8) []const u8 {
    return switch (score) {
        90...100 => "a",
        80...89 => "b",
        else => "c",
    };
}`),
  entry('if else expression', `fn max(left: i32, right: i32) i32 {
    return if (left > right) left else right;
}`),
  entry('optional payload while', `fn drain(values: []?u8) void {
    for (values) |item| {
        if (item) |value| _ = value;
    }
}`),
  entry('pointer dereference write', `fn set(value: *i32) void {
    value.* = 9;
}`),
  entry('many pointer sentinel', `const text: [*:0]const u8 = "zig";`),
  entry('array literal syntax', `const values = [_]u8{ 1, 2, 3, 4 };`),
  entry('slice literal syntax', `const names = [_][]const u8{ "go", "zig" };`),
  entry('struct literal init', `const user = User{
    .id = 1,
    .name = "zig",
};`),
  entry('anonymous tuple syntax', `const pair = .{ 1, "zig" };`),
  entry('enum literal call', `fn state() State {
    return .running;
}`),
  entry('option null assignment', `var current: ?[]const u8 = null;`),
  entry('undefined buffer declaration', `var buffer: [64]u8 = undefined;`),
  entry('volatile pointer type', `fn read(ptr: *volatile u32) u32 {
    return ptr.*;
}`),
  entry('allowzero pointer type', `const maybe_ptr: ?*allowzero anyopaque = null;`),
  entry('opaque handle decl', `const Handle = opaque {};`),
  entry('union plain fields', `const Value = union {
    int: i32,
    text: []const u8,
};`),
  entry('usingnamespace builtin', `const std = @import("std");
usingnamespace std.os;`),
  entry('c import block', `const c = @cImport({
    @cInclude("stdio.h");
});`),
  entry('embed file builtin', `const icon = @embedFile("icon.txt");`),
  entry('sizeOf builtin call', `const bytes = @sizeOf(u64);`),
  entry('typeOf builtin call', `fn same(value: anytype) @TypeOf(value) {
    return value;
}`),
  entry('as builtin cast', `const value = @as(u32, 12);`),
  entry('int cast builtin', `fn cast(value: usize) u32 {
    return @intCast(value);
}`),
  entry('truncate builtin', `fn lower(value: u32) u8 {
    return @truncate(value);
}`),
  entry('ptr cast builtin', `fn cast(ptr: *u8) *const u8 {
    return @ptrCast(ptr);
}`),
  entry('bit cast builtin', `const bits = @bitCast(u32, @as(f32, 1.0));`),
  entry('mem copy forwards', `const std = @import("std");

fn copy(dst: []u8, src: []const u8) void {
    std.mem.copyForwards(u8, dst, src);
}`),
  entry('fmt alloc print', `const std = @import("std");

fn make(allocator: std.mem.Allocator) ![]u8 {
    return try std.fmt.allocPrint(allocator, "{d}", .{42});
}`),
  entry('writer print tuple', `const std = @import("std");

pub fn main() !void {
    try std.debug.print("{s} {d}\\n", .{"zig", 1});
}`),
  entry('std debug assert', `const std = @import("std");

fn ensure(ok: bool) void {
    std.debug.assert(ok);
}`),
  entry('fs read file alloc', `const std = @import("std");

fn load(allocator: std.mem.Allocator) ![]u8 {
    return try std.fs.cwd().readFileAlloc(allocator, "note.md", 1024);
}`),
  entry('json parse from slice', `const std = @import("std");

fn decode(allocator: std.mem.Allocator, raw: []const u8) !std.json.Value {
    return try std.json.parseFromSlice(std.json.Value, allocator, raw, .{});
}`),
  entry('process args iterator', `const std = @import("std");

pub fn main() !void {
    var args = std.process.args();
    _ = args.next();
}`),
  entry('random int range', `const std = @import("std");

fn pick() u32 {
    var prng = std.rand.DefaultPrng.init(0);
    return prng.random().int(u32);
}`),
  entry('hash map init put', `const std = @import("std");

fn build(allocator: std.mem.Allocator) !void {
    var map = std.StringHashMap(u32).init(allocator);
    defer map.deinit();
    try map.put("zig", 1);
}`),
  entry('auto hash map init', `const std = @import("std");

fn build(allocator: std.mem.Allocator) !void {
    var map = std.AutoHashMap(u32, []const u8).init(allocator);
    defer map.deinit();
}`),
  entry('bufset insert value', `const std = @import("std");

fn build(allocator: std.mem.Allocator) !void {
    var set = std.BufSet.init(allocator);
    defer set.deinit();
    try set.insert("zig");
}`),
  entry('fixed buffer allocator', `const std = @import("std");

fn alloc() std.mem.Allocator {
    var buffer: [256]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);
    return fba.allocator();
}`),
  entry('general purpose allocator', `const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
}`),
  entry('page allocator value', `const std = @import("std");

const allocator = std.heap.page_allocator;`),
  entry('reader read all alloc', `const std = @import("std");

fn load(allocator: std.mem.Allocator, file: std.fs.File) ![]u8 {
    return try file.readToEndAlloc(allocator, 4096);
}`),
  entry('split scalar iter', `const std = @import("std");

fn parts(raw: []const u8) void {
    var it = std.mem.splitScalar(u8, raw, ',');
    _ = it.next();
}`),
  entry('tokenize scalar iter', `const std = @import("std");

fn parts(raw: []const u8) void {
    var it = std.mem.tokenizeScalar(u8, raw, ' ');
    _ = it.next();
}`),
  entry('ascii lower string', `const std = @import("std");

fn lower(buffer: []u8) void {
    std.ascii.lowerString(buffer, buffer);
}`),
  entry('unicode utf8 view', `const std = @import("std");

fn count(raw: []const u8) !usize {
    var view = try std.unicode.Utf8View.init(raw);
    return view.iterator().i;
}`),
  entry('fmt parse int call', `const std = @import("std");

fn parse(raw: []const u8) !i64 {
    return try std.fmt.parseInt(i64, raw, 10);
}`),
  entry('sort pdq call', `const std = @import("std");

fn order(values: []i32) void {
    std.sort.pdq(i32, values, {}, comptime std.sort.asc(i32));
}`),
  entry('math max call', `const std = @import("std");

const value = std.math.maxInt(u32);`),
  entry('time milli timestamp', `const std = @import("std");

fn now() i64 {
    return std.time.milliTimestamp();
}`),
  entry('thread spawn join', `const std = @import("std");

pub fn main() !void {
    const handle = try std.Thread.spawn(.{}, worker, .{});
    handle.join();
}

fn worker() void {}`),
  entry('atomic value init', `const std = @import("std");

var counter = std.atomic.Value(u32).init(0);`),
  entry('mutex lock unlock', `const std = @import("std");

var mutex = std.Thread.Mutex{};

fn touch() void {
    mutex.lock();
    defer mutex.unlock();
}`),
  entry('rwlock acquire shared', `const std = @import("std");

var lock = std.Thread.RwLock{};

fn read() void {
    lock.lockShared();
    defer lock.unlockShared();
}`),
  entry('channel like fifo', `const std = @import("std");

fn queue(allocator: std.mem.Allocator) !void {
    var fifo = std.fifo.LinearFifo(u8, .Dynamic).init(allocator);
    defer fifo.deinit();
}`),
  entry('build executable add', `const std = @import("std");

pub fn build(b: *std.Build) void {
    const exe = b.addExecutable(.{
        .name = "demo",
        .root_source_file = b.path("src/main.zig"),
    });
    b.installArtifact(exe);
}`),
  entry('build target options', `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    _ = .{ target, optimize };
}`),
  entry('build add run artifact', `const std = @import("std");

pub fn build(b: *std.Build) void {
    const exe = b.addExecutable(.{
        .name = "notes",
        .root_source_file = b.path("src/main.zig"),
    });
    const run_cmd = b.addRunArtifact(exe);
    _ = run_cmd;
}`),
  entry('test allocator use', `const std = @import("std");

test "array list" {
    var list = std.ArrayList(u8).init(std.testing.allocator);
    defer list.deinit();
    try list.append('z');
}`),
  entry('expect error helper', `const std = @import("std");

test "expect error" {
    try std.testing.expectError(error.Empty, decode(""));
}`),
  entry('expect string helper', `const std = @import("std");

test "expect string" {
    try std.testing.expectEqualStrings("zig", "zig");
}`),
  entry('union init shorthand', `const result: Result = .{ .ok = "done" };`),
  entry('enum int tag type', `const Op = enum(u8) {
    add = 1,
    sub = 2,
};`),
  entry('resume suspend frame', `fn run() void {
    suspend {}
}`),
  entry('async call frame', `fn work() void {}

pub fn main() void {
    _ = async work();
}`),
  entry('nosuspend await syntax', `fn work() void {}

pub fn main() void {
    nosuspend await async work();
}`),
  entry('export c function', `export fn sum(a: c_int, b: c_int) c_int {
    return a + b;
}`),
  entry('callconv c function', `fn open() callconv(.C) void {}`),
  entry('linksection variable', `var value: u8 linksection(".data") = 1;`),
];
