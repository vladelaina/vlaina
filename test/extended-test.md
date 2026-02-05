# 扩展语言检测测试用例

这个文件包含每种语言的多个测试用例，包括单行和多行代码。

## Python

### Python - 单行导入
```python
import numpy as np
```

### Python - 列表操作
```python
numbers = [1, 2, 3, 4, 5]
squared = [x**2 for x in numbers]
print(squared)
```

### Python - 装饰器
```python
@app.route('/api/users')
def get_users():
    return jsonify(users)
```

### Python - 异步函数
```python
async def fetch_data(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

## JavaScript

### JavaScript - 单行箭头函数
```javascript
const add = (a, b) => a + b;
```

### JavaScript - Promise
```javascript
fetch('/api/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

### JavaScript - Class
```javascript
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  
  greet() {
    return `Hello, ${this.name}!`;
  }
}
```

### JavaScript - 解构赋值
```javascript
const { name, age, ...rest } = user;
const [first, second, ...others] = array;
```

## TypeScript

### TypeScript - 单行类型定义
```typescript
type User = { name: string; age: number };
```

### TypeScript - 泛型函数
```typescript
function identity<T>(arg: T): T {
  return arg;
}
```

### TypeScript - 接口继承
```typescript
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
  bark(): void;
}
```

## Java

### Java - 单行静态导入
```java
import static java.lang.Math.*;
```

### Java - Lambda 表达式
```java
List<String> names = Arrays.asList("Alice", "Bob", "Charlie");
names.stream()
     .filter(name -> name.startsWith("A"))
     .forEach(System.out::println);
```

### Java - 注解
```java
@RestController
@RequestMapping("/api")
public class UserController {
    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();
    }
}
```

## Go

### Go - 单行变量声明
```go
name := "Alice"
```

### Go - 接口实现
```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type MyReader struct{}

func (r MyReader) Read(p []byte) (int, error) {
    return len(p), nil
}
```

### Go - Channel 操作
```go
ch := make(chan int, 10)
go func() {
    for i := 0; i < 10; i++ {
        ch <- i
    }
    close(ch)
}()

for val := range ch {
    fmt.Println(val)
}
```

## Rust

### Rust - 单行宏调用
```rust
println!("Hello, {}!", name);
```

### Rust - 生命周期
```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

### Rust - Trait 实现
```rust
trait Summary {
    fn summarize(&self) -> String;
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}, by {}", self.headline, self.author)
    }
}
```

## Ruby

### Ruby - 单行符号
```ruby
status = :active
```

### Ruby - 块语法
```ruby
[1, 2, 3].each do |num|
  puts num * 2
end
```

### Ruby - 元编程
```ruby
class Person
  attr_accessor :name, :age
  
  def initialize(name, age)
    @name = name
    @age = age
  end
end
```

## PHP

### PHP - 单行命名空间
```php
namespace App\Controllers;
```

### PHP - Trait
```php
trait Logger {
    public function log($message) {
        echo "[LOG] $message\n";
    }
}

class User {
    use Logger;
}
```

### PHP - 匿名函数
```php
$numbers = [1, 2, 3, 4, 5];
$squared = array_map(function($n) {
    return $n * $n;
}, $numbers);
```


## C++

### C++ - 单行模板
```cpp
template<typename T> T max(T a, T b) { return a > b ? a : b; }
```

### C++ - 智能指针
```cpp
std::unique_ptr<int> ptr = std::make_unique<int>(42);
std::shared_ptr<std::string> str = std::make_shared<std::string>("Hello");
```

### C++ - Lambda 表达式
```cpp
auto add = [](int a, int b) -> int {
    return a + b;
};

std::vector<int> nums = {1, 2, 3, 4, 5};
std::for_each(nums.begin(), nums.end(), [](int n) {
    std::cout << n << std::endl;
});
```

## C#

### C# - 单行 LINQ
```csharp
var result = numbers.Where(n => n > 5).Select(n => n * 2);
```

### C# - 属性
```csharp
public class Person
{
    public string Name { get; set; }
    public int Age { get; init; }
    public string Email { get; private set; }
}
```

### C# - 异步方法
```csharp
public async Task<List<User>> GetUsersAsync()
{
    using var client = new HttpClient();
    var response = await client.GetAsync("https://api.example.com/users");
    return await response.Content.ReadAsAsync<List<User>>();
}
```

## Swift

### Swift - 单行可选链
```swift
let length = user?.name?.count
```

### Swift - Guard 语句
```swift
func greet(person: [String: String]) {
    guard let name = person["name"] else {
        return
    }
    print("Hello \(name)!")
}
```

### Swift - 协议扩展
```swift
protocol Drawable {
    func draw()
}

extension Drawable {
    func draw() {
        print("Drawing...")
    }
}
```

## Kotlin

### Kotlin - 单行数据类
```kotlin
data class User(val name: String, val age: Int)
```

### Kotlin - 扩展函数
```kotlin
fun String.isPalindrome(): Boolean {
    return this == this.reversed()
}
```

### Kotlin - 协程
```kotlin
suspend fun fetchUser(id: Int): User {
    delay(1000)
    return userRepository.findById(id)
}

fun main() = runBlocking {
    val user = async { fetchUser(1) }
    println(user.await())
}
```

## Scala

### Scala - 单行模式匹配
```scala
val result = x match { case 1 => "one"; case 2 => "two"; case _ => "other" }
```

### Scala - Case Class
```scala
case class Person(name: String, age: Int)

val alice = Person("Alice", 30)
val bob = alice.copy(name = "Bob")
```

### Scala - For 推导式
```scala
val result = for {
  x <- List(1, 2, 3)
  y <- List(10, 20, 30)
  if x + y > 15
} yield x * y
```

## Lua

### Lua - 单行表定义
```lua
local config = { host = "localhost", port = 8080 }
```

### Lua - 元表
```lua
local mt = {
  __add = function(a, b)
    return a.value + b.value
  end
}

local obj = { value = 10 }
setmetatable(obj, mt)
```

### Lua - 闭包
```lua
function counter()
  local count = 0
  return function()
    count = count + 1
    return count
  end
end

local c = counter()
print(c())  -- 1
print(c())  -- 2
```

## Shell

### Shell - 单行管道
```bash
cat file.txt | grep "error" | wc -l
```

### Shell - 函数定义
```bash
function backup() {
    local source=$1
    local dest=$2
    tar -czf "$dest/backup-$(date +%Y%m%d).tar.gz" "$source"
}
```

### Shell - 条件判断
```bash
if [ -f "$file" ]; then
    echo "File exists"
elif [ -d "$file" ]; then
    echo "Directory exists"
else
    echo "Not found"
fi
```

## SQL

### SQL - 单行更新
```sql
UPDATE users SET status = 'active' WHERE id = 1;
```

### SQL - 子查询
```sql
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

### SQL - 窗口函数
```sql
SELECT 
    name,
    department,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) as rank
FROM employees;
```


## HTML

### HTML - 单行链接
```html
<a href="https://example.com" target="_blank">Visit</a>
```

### HTML - 表单
```html
<form action="/submit" method="POST">
    <input type="text" name="username" required>
    <input type="password" name="password" required>
    <button type="submit">Login</button>
</form>
```

### HTML - 语义化标签
```html
<article>
    <header>
        <h1>Article Title</h1>
        <time datetime="2024-01-01">January 1, 2024</time>
    </header>
    <section>
        <p>Article content...</p>
    </section>
</article>
```

## CSS

### CSS - 单行变量
```css
:root { --primary-color: #007bff; }
```

### CSS - Grid 布局
```css
.container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}
```

### CSS - 动画
```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.element {
    animation: fadeIn 0.3s ease-in;
}
```

## JSON

### JSON - 单行对象
```json
{"name": "Alice", "age": 30}
```

### JSON - 嵌套结构
```json
{
    "users": [
        {
            "id": 1,
            "name": "Alice",
            "email": "alice@example.com",
            "roles": ["admin", "user"]
        },
        {
            "id": 2,
            "name": "Bob",
            "email": "bob@example.com",
            "roles": ["user"]
        }
    ]
}
```

## YAML

### YAML - 单行键值对
```yaml
name: MyApp
```

### YAML - 列表和映射
```yaml
server:
  host: localhost
  port: 8080
  ssl:
    enabled: true
    cert: /path/to/cert.pem

databases:
  - name: primary
    host: db1.example.com
    port: 5432
  - name: replica
    host: db2.example.com
    port: 5432
```

## TOML

### TOML - 单行表
```toml
[server]
host = "localhost"
```

### TOML - 数组和表
```toml
[package]
name = "myapp"
version = "1.0.0"

[[dependencies]]
name = "express"
version = "^4.18.0"

[[dependencies]]
name = "mongoose"
version = "^7.0.0"
```

## XML

### XML - 单行元素
```xml
<user id="1" name="Alice" />
```

### XML - 嵌套结构
```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
    <book id="1">
        <title>The Great Gatsby</title>
        <author>F. Scott Fitzgerald</author>
        <year>1925</year>
    </book>
    <book id="2">
        <title>1984</title>
        <author>George Orwell</author>
        <year>1949</year>
    </book>
</catalog>
```

## Markdown

### Markdown - 单行标题
```markdown
# Hello World
```

### Markdown - 混合内容
```markdown
# Project Documentation

## Features

- **Fast**: Optimized for performance
- **Secure**: Built with security in mind
- **Scalable**: Handles millions of requests

## Code Example

\`\`\`javascript
const app = express();
app.listen(3000);
\`\`\`

## Links

Visit [our website](https://example.com) for more info.
```

## Dockerfile

### Dockerfile - 单行 FROM
```dockerfile
FROM node:18-alpine
```

### Dockerfile - 多阶段构建
```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --production
CMD ["node", "dist/index.js"]
```

## GraphQL

### GraphQL - 单行查询
```graphql
{ user(id: 1) { name email } }
```

### GraphQL - 复杂查询
```graphql
query GetUserWithPosts($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    posts(first: 10) {
      edges {
        node {
          id
          title
          content
          createdAt
        }
      }
    }
  }
}

mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    post {
      id
      title
    }
    errors {
      field
      message
    }
  }
}
```


## Haskell

### Haskell - 单行类型签名
```haskell
factorial :: Integer -> Integer
```

### Haskell - 递归函数
```haskell
factorial :: Integer -> Integer
factorial 0 = 1
factorial n = n * factorial (n - 1)

quicksort :: Ord a => [a] -> [a]
quicksort [] = []
quicksort (x:xs) = quicksort smaller ++ [x] ++ quicksort larger
  where
    smaller = [a | a <- xs, a <= x]
    larger = [b | b <- xs, b > x]
```

### Haskell - Monad
```haskell
import Control.Monad

main :: IO ()
main = do
  name <- getLine
  when (not $ null name) $ do
    putStrLn $ "Hello, " ++ name ++ "!"
```

## Elixir

### Elixir - 单行管道
```elixir
result = data |> Enum.map(&(&1 * 2)) |> Enum.sum()
```

### Elixir - 模式匹配
```elixir
defmodule Math do
  def factorial(0), do: 1
  def factorial(n) when n > 0 do
    n * factorial(n - 1)
  end
end
```

### Elixir - GenServer
```elixir
defmodule Counter do
  use GenServer

  def start_link(initial_value) do
    GenServer.start_link(__MODULE__, initial_value, name: __MODULE__)
  end

  def init(initial_value) do
    {:ok, initial_value}
  end

  def handle_call(:get, _from, state) do
    {:reply, state, state}
  end

  def handle_cast(:increment, state) do
    {:noreply, state + 1}
  end
end
```

## Erlang

### Erlang - 单行函数
```erlang
double(X) -> X * 2.
```

### Erlang - 递归和模式匹配
```erlang
-module(factorial).
-export([fac/1]).

fac(0) -> 1;
fac(N) when N > 0 -> N * fac(N-1).
```

### Erlang - 进程通信
```erlang
-module(ping_pong).
-export([start/0, ping/1, pong/0]).

ping(0) ->
    pong ! finished,
    io:format("Ping finished~n", []);
ping(N) ->
    pong ! {ping, self()},
    receive
        pong -> ok
    end,
    ping(N - 1).

pong() ->
    receive
        finished -> ok;
        {ping, Pid} ->
            Pid ! pong,
            pong()
    end.
```

## Julia

### Julia - 单行函数
```julia
f(x) = x^2 + 2x + 1
```

### Julia - 向量化操作
```julia
x = [1, 2, 3, 4, 5]
y = x .^ 2 .+ 2 .* x .+ 1

A = [1 2; 3 4]
B = [5 6; 7 8]
C = A .* B
```

### Julia - 类型定义
```julia
struct Point{T<:Real}
    x::T
    y::T
end

function distance(p1::Point, p2::Point)
    sqrt((p1.x - p2.x)^2 + (p1.y - p2.y)^2)
end
```

## R

### R - 单行向量
```r
x <- c(1, 2, 3, 4, 5)
```

### R - 数据框操作
```r
library(dplyr)

result <- mtcars %>%
  filter(mpg > 20) %>%
  select(mpg, cyl, hp) %>%
  arrange(desc(mpg))
```

### R - 绘图
```r
library(ggplot2)

ggplot(iris, aes(x = Sepal.Length, y = Sepal.Width, color = Species)) +
  geom_point() +
  geom_smooth(method = "lm") +
  theme_minimal()
```

## Perl

### Perl - 单行正则
```perl
$text =~ s/old/new/g;
```

### Perl - 哈希操作
```perl
my %config = (
    host => 'localhost',
    port => 8080,
    debug => 1
);

foreach my $key (keys %config) {
    print "$key: $config{$key}\n";
}
```

### Perl - 文件处理
```perl
open(my $fh, '<', 'input.txt') or die "Cannot open file: $!";
while (my $line = <$fh>) {
    chomp $line;
    print "$line\n" if $line =~ /pattern/;
}
close($fh);
```

## OCaml

### OCaml - 单行函数
```ocaml
let square x = x * x
```

### OCaml - 模式匹配
```ocaml
let rec factorial n =
  match n with
  | 0 -> 1
  | n -> n * factorial (n - 1)

let rec length lst =
  match lst with
  | [] -> 0
  | _ :: tail -> 1 + length tail
```

### OCaml - 模块
```ocaml
module Stack = struct
  type 'a t = 'a list

  let empty = []
  let push x s = x :: s
  let pop = function
    | [] -> None
    | x :: xs -> Some (x, xs)
end
```

## F#

### F# - 单行管道
```fsharp
let result = [1..10] |> List.map (fun x -> x * 2) |> List.sum
```

### F# - 类型提供器
```fsharp
type Person = {
    Name: string
    Age: int
}

let alice = { Name = "Alice"; Age = 30 }
let bob = { alice with Name = "Bob" }
```

### F# - 异步工作流
```fsharp
let fetchData url = async {
    use client = new HttpClient()
    let! response = client.GetStringAsync(url) |> Async.AwaitTask
    return response
}

let main = async {
    let! data = fetchData "https://api.example.com/data"
    printfn "%s" data
}
```

## Clojure

### Clojure - 单行向量
```clojure
(def numbers [1 2 3 4 5])
```

### Clojure - 高阶函数
```clojure
(defn square [x] (* x x))

(def numbers [1 2 3 4 5])
(def squared (map square numbers))
(def sum (reduce + squared))
```

### Clojure - 宏
```clojure
(defmacro unless [condition & body]
  `(if (not ~condition)
     (do ~@body)))

(unless false
  (println "This will print"))
```


## Dart

### Dart - 单行 Future
```dart
Future<String> fetchData() async => await http.get(url);
```

### Dart - 类和构造函数
```dart
class Person {
  final String name;
  final int age;
  
  Person(this.name, this.age);
  
  Person.fromJson(Map<String, dynamic> json)
      : name = json['name'],
        age = json['age'];
}
```

### Dart - Stream
```dart
Stream<int> countStream(int max) async* {
  for (int i = 1; i <= max; i++) {
    await Future.delayed(Duration(seconds: 1));
    yield i;
  }
}
```

## Zig

### Zig - 单行函数
```zig
fn add(a: i32, b: i32) i32 { return a + b; }
```

### Zig - 错误处理
```zig
const std = @import("std");

fn divide(a: f64, b: f64) !f64 {
    if (b == 0) return error.DivisionByZero;
    return a / b;
}

pub fn main() !void {
    const result = try divide(10, 2);
    std.debug.print("Result: {}\n", .{result});
}
```

## Nim

### Nim - 单行过程
```nim
proc greet(name: string) = echo "Hello, ", name
```

### Nim - 宏和模板
```nim
import macros

macro debug(n: varargs[typed]): untyped =
  result = newStmtList()
  for arg in n:
    result.add quote do:
      echo `arg`, " = ", `arg`

let x = 10
let y = 20
debug(x, y)
```

## Crystal

### Crystal - 单行方法
```crystal
def greet(name : String) : String
  "Hello, #{name}!"
end
```

### Crystal - 类和模块
```crystal
module Drawable
  abstract def draw
end

class Circle
  include Drawable
  
  property radius : Float64
  
  def initialize(@radius)
  end
  
  def draw
    puts "Drawing circle with radius #{@radius}"
  end
end
```

## Solidity

### Solidity - 单行状态变量
```solidity
uint256 public totalSupply;
```

### Solidity - 智能合约
```solidity
pragma solidity ^0.8.0;

contract Token {
    mapping(address => uint256) public balances;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }
}
```

## Groovy

### Groovy - 单行闭包
```groovy
def square = { it * it }
```

### Groovy - 集合操作
```groovy
def numbers = [1, 2, 3, 4, 5]
def doubled = numbers.collect { it * 2 }
def evens = numbers.findAll { it % 2 == 0 }
def sum = numbers.inject(0) { acc, val -> acc + val }
```

## Elm

### Elm - 单行类型别名
```elm
type alias User = { name : String, age : Int }
```

### Elm - 更新函数
```elm
type Msg
    = Increment
    | Decrement
    | Reset

update : Msg -> Model -> Model
update msg model =
    case msg of
        Increment ->
            { model | count = model.count + 1 }
        
        Decrement ->
            { model | count = model.count - 1 }
        
        Reset ->
            { model | count = 0 }
```

## Vim Script

### Vim Script - 单行设置
```vim
set number relativenumber
```

### Vim Script - 函数
```vim
function! ToggleNumber()
    if &number
        set nonumber
    else
        set number
    endif
endfunction

nnoremap <leader>n :call ToggleNumber()<CR>
```

## PowerShell

### PowerShell - 单行管道
```powershell
Get-Process | Where-Object CPU -gt 100 | Sort-Object CPU -Descending
```

### PowerShell - 函数
```powershell
function Get-FileSize {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )
    
    $files = Get-ChildItem -Path $Path -Recurse -File
    $totalSize = ($files | Measure-Object -Property Length -Sum).Sum
    
    return [PSCustomObject]@{
        Path = $Path
        FileCount = $files.Count
        TotalSize = $totalSize
    }
}
```

## LaTeX

### LaTeX - 单行公式
```latex
$E = mc^2$
```

### LaTeX - 文档结构
```latex
\documentclass{article}
\usepackage{amsmath}

\begin{document}

\section{Introduction}

This is a sample document with math:

\begin{equation}
    \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\end{equation}

\end{document}
```

## MATLAB

### MATLAB - 单行矩阵
```matlab
A = [1 2 3; 4 5 6; 7 8 9];
```

### MATLAB - 函数和绘图
```matlab
function y = myFunction(x)
    y = x.^2 + 2*x + 1;
end

x = linspace(-10, 10, 100);
y = myFunction(x);

figure;
plot(x, y, 'LineWidth', 2);
xlabel('x');
ylabel('y');
title('Quadratic Function');
grid on;
```

## Protobuf

### Protobuf - 单行消息
```protobuf
message User { string name = 1; }
```

### Protobuf - 复杂定义
```protobuf
syntax = "proto3";

package example;

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  repeated string roles = 4;
  
  message Address {
    string street = 1;
    string city = 2;
    string country = 3;
  }
  
  Address address = 5;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}
```


## Vue

### Vue - 单行模板
```vue
<template><div>{{ message }}</div></template>
```

### Vue - 完整组件
```vue
<template>
  <div class="user-card">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="handleClick">Contact</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const user = ref({
  name: 'Alice',
  email: 'alice@example.com'
})

const handleClick = () => {
  console.log('Contact clicked')
}
</script>

<style scoped>
.user-card {
  padding: 1rem;
  border: 1px solid #ccc;
}
</style>
```

## Svelte

### Svelte - 单行绑定
```svelte
<input bind:value={name} />
```

### Svelte - 完整组件
```svelte
<script>
  let count = 0
  
  function increment() {
    count += 1
  }
  
  $: doubled = count * 2
</script>

<div>
  <p>Count: {count}</p>
  <p>Doubled: {doubled}</p>
  <button on:click={increment}>Increment</button>
</div>

<style>
  div {
    padding: 1rem;
  }
</style>
```

## Astro

### Astro - 单行组件
```astro
---
const title = "Hello World"
---
<h1>{title}</h1>
```

### Astro - 完整页面
```astro
---
import Layout from '../layouts/Layout.astro'
import Card from '../components/Card.astro'

const posts = await fetch('https://api.example.com/posts').then(r => r.json())
---

<Layout title="Blog">
  <main>
    <h1>Blog Posts</h1>
    <div class="grid">
      {posts.map(post => (
        <Card title={post.title} href={`/posts/${post.slug}`} />
      ))}
    </div>
  </main>
</Layout>
```

## Handlebars

### Handlebars - 单行变量
```handlebars
<h1>{{title}}</h1>
```

### Handlebars - 循环和条件
```handlebars
<div class="users">
  {{#if users}}
    <ul>
      {{#each users}}
        <li>
          <strong>{{this.name}}</strong>
          {{#if this.isAdmin}}
            <span class="badge">Admin</span>
          {{/if}}
        </li>
      {{/each}}
    </ul>
  {{else}}
    <p>No users found.</p>
  {{/if}}
</div>
```

## Jinja

### Jinja - 单行变量
```jinja
<h1>{{ title }}</h1>
```

### Jinja - 模板继承
```jinja
{% extends "base.html" %}

{% block title %}{{ page_title }}{% endblock %}

{% block content %}
  <div class="posts">
    {% for post in posts %}
      <article>
        <h2>{{ post.title }}</h2>
        <p>{{ post.content|truncate(100) }}</p>
        <a href="{{ url_for('post', id=post.id) }}">Read more</a>
      </article>
    {% endfor %}
  </div>
{% endblock %}
```

## Liquid

### Liquid - 单行变量
```liquid
<h1>{{ page.title }}</h1>
```

### Liquid - 循环和过滤器
```liquid
<div class="products">
  {% for product in collections.all.products %}
    <div class="product">
      <h3>{{ product.title }}</h3>
      <p>{{ product.price | money }}</p>
      {% if product.available %}
        <button>Add to Cart</button>
      {% else %}
        <span>Out of Stock</span>
      {% endif %}
    </div>
  {% endfor %}
</div>
```

## Pug

### Pug - 单行元素
```pug
h1 Hello World
```

### Pug - 完整模板
```pug
doctype html
html
  head
    title= pageTitle
    script(src='/js/app.js')
  body
    header
      h1= title
    main
      each item in items
        .card
          h2= item.name
          p= item.description
    footer
      p Copyright 2024
```

## Haml

### Haml - 单行元素
```haml
%h1 Hello World
```

### Haml - 完整模板
```haml
!!!
%html
  %head
    %title= @page_title
  %body
    %header
      %h1= @title
    %main
      - @posts.each do |post|
        .post
          %h2= post.title
          %p= post.content
          %a{href: post_path(post)} Read more
```

## Sass

### Sass - 单行变量
```scss
$primary-color: #007bff;
```

### Sass - 嵌套和混入
```scss
$primary-color: #007bff;
$border-radius: 4px;

@mixin button-style($bg-color) {
  background-color: $bg-color;
  border: none;
  border-radius: $border-radius;
  padding: 0.5rem 1rem;
  cursor: pointer;
  
  &:hover {
    background-color: darken($bg-color, 10%);
  }
}

.button {
  @include button-style($primary-color);
  
  &.secondary {
    @include button-style(#6c757d);
  }
}
```

## Less

### Less - 单行变量
```less
@primary-color: #007bff;
```

### Less - 混入和运算
```less
@primary-color: #007bff;
@spacing: 1rem;

.box-shadow(@x: 0, @y: 2px, @blur: 4px, @color: rgba(0,0,0,0.1)) {
  box-shadow: @x @y @blur @color;
}

.card {
  padding: @spacing;
  margin: @spacing * 2;
  .box-shadow();
  
  &:hover {
    .box-shadow(0, 4px, 8px, rgba(0,0,0,0.2));
  }
}
```

## Stylus

### Stylus - 单行变量
```stylus
primary-color = #007bff
```

### Stylus - 简洁语法
```stylus
primary-color = #007bff
border-radius = 4px

button-style(bg-color)
  background-color bg-color
  border none
  border-radius border-radius
  padding 0.5rem 1rem
  cursor pointer
  
  &:hover
    background-color darken(bg-color, 10%)

.button
  button-style(primary-color)
  
  &.secondary
    button-style(#6c757d)
```

## PostCSS

### PostCSS - 单行自定义属性
```postcss
:root { --primary: #007bff; }
```

### PostCSS - 现代 CSS 特性
```postcss
.container {
  @apply flex items-center justify-center;
  background: theme('colors.primary');
  
  @media (width >= 768px) {
    @apply grid grid-cols-2;
  }
}

.button {
  @apply px-4 py-2 rounded;
  background: color-mix(in srgb, var(--primary) 80%, white);
  
  &:hover {
    background: var(--primary);
  }
}
```


## Nginx

### Nginx - 单行指令
```nginx
server_name example.com;
```

### Nginx - 完整配置
```nginx
upstream backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name example.com www.example.com;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /static/ {
        alias /var/www/static/;
        expires 30d;
    }
}
```

## Apache

### Apache - 单行指令
```apache
ServerName example.com
```

### Apache - 虚拟主机
```apache
<VirtualHost *:80>
    ServerName example.com
    ServerAlias www.example.com
    DocumentRoot /var/www/html
    
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

## Terraform

### Terraform - 单行资源
```terraform
resource "aws_s3_bucket" "bucket" { bucket = "my-bucket" }
```

### Terraform - 完整配置
```terraform
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "public-subnet"
  }
}
```

## Makefile

### Makefile - 单行目标
```makefile
all: build test
```

### Makefile - 完整构建
```makefile
.PHONY: all build test clean install

CC = gcc
CFLAGS = -Wall -Wextra -O2
TARGET = myapp
SOURCES = $(wildcard src/*.c)
OBJECTS = $(SOURCES:.c=.o)

all: build

build: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

test:
	./$(TARGET) --test

clean:
	rm -f $(OBJECTS) $(TARGET)

install: $(TARGET)
	install -m 755 $(TARGET) /usr/local/bin/
```

## CMake

### CMake - 单行项目
```cmake
project(MyApp)
```

### CMake - 完整配置
```cmake
cmake_minimum_required(VERSION 3.15)
project(MyApp VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Boost REQUIRED COMPONENTS system filesystem)

add_executable(myapp
    src/main.cpp
    src/utils.cpp
    src/config.cpp
)

target_include_directories(myapp PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${Boost_INCLUDE_DIRS}
)

target_link_libraries(myapp PRIVATE
    ${Boost_LIBRARIES}
)

install(TARGETS myapp DESTINATION bin)
```

## Prisma

### Prisma - 单行模型
```prisma
model User { id Int @id @default(autoincrement()) }
```

### Prisma - 完整 Schema
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId Int    @unique
}
```

## Dotenv

### Dotenv - 单行变量
```dotenv
DATABASE_URL=postgresql://localhost:5432/mydb
```

### Dotenv - 完整配置
```dotenv
# Database
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_POOL_SIZE=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# API Keys
API_KEY=your-api-key-here
SECRET_KEY=your-secret-key-here

# Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

## MDX

### MDX - 单行导入
```mdx
import { Button } from './components'
```

### MDX - 混合内容
```mdx
import { Chart } from './components/Chart'
import { CodeBlock } from './components/CodeBlock'

# Data Visualization

Here's an interactive chart:

<Chart data={salesData} type="line" />

## Code Example

<CodeBlock language="javascript">
{`
const data = [1, 2, 3, 4, 5]
const sum = data.reduce((a, b) => a + b, 0)
`}
</CodeBlock>

You can also use regular markdown:

- Item 1
- Item 2
- Item 3
```

## Twig

### Twig - 单行变量
```twig
<h1>{{ title }}</h1>
```

### Twig - 模板继承
```twig
{% extends "layout.html" %}

{% block title %}{{ page.title }}{% endblock %}

{% block content %}
  <div class="products">
    {% for product in products %}
      <div class="product">
        <h3>{{ product.name }}</h3>
        <p>{{ product.price|number_format(2) }} USD</p>
        {% if product.onSale %}
          <span class="badge">Sale!</span>
        {% endif %}
      </div>
    {% endfor %}
  </div>
{% endblock %}
```

## CoffeeScript

### CoffeeScript - 单行函数
```coffeescript
square = (x) -> x * x
```

### CoffeeScript - 类和循环
```coffeescript
class Animal
  constructor: (@name) ->
  
  move: (meters) ->
    console.log "#{@name} moved #{meters}m."

class Snake extends Animal
  move: ->
    console.log "Slithering..."
    super 5

numbers = [1, 2, 3, 4, 5]
squared = (num * num for num in numbers)
console.log squared
```

## GDScript

### GDScript - 单行变量
```gdscript
var health = 100
```

### GDScript - 完整脚本
```gdscript
extends Node2D

var speed = 200
var velocity = Vector2()

func _ready():
    print("Player ready!")

func _process(delta):
    velocity = Vector2()
    
    if Input.is_action_pressed("ui_right"):
        velocity.x += 1
    if Input.is_action_pressed("ui_left"):
        velocity.x -= 1
    if Input.is_action_pressed("ui_down"):
        velocity.y += 1
    if Input.is_action_pressed("ui_up"):
        velocity.y -= 1
    
    velocity = velocity.normalized() * speed
    position += velocity * delta
```

## Objective-C

### Objective-C - 单行导入
```objectivec
#import <Foundation/Foundation.h>
```

### Objective-C - 类定义
```objectivec
#import <Foundation/Foundation.h>

@interface Person : NSObject

@property (nonatomic, strong) NSString *name;
@property (nonatomic, assign) NSInteger age;

- (instancetype)initWithName:(NSString *)name age:(NSInteger)age;
- (void)greet;

@end

@implementation Person

- (instancetype)initWithName:(NSString *)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        _name = name;
        _age = age;
    }
    return self;
}

- (void)greet {
    NSLog(@"Hello, I'm %@", self.name);
}

@end
```

## Prolog

### Prolog - 单行事实
```prolog
parent(tom, bob).
```

### Prolog - 规则和查询
```prolog
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).
parent(pat, jim).

grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).

sibling(X, Y) :- parent(Z, X), parent(Z, Y), X \= Y.
```

