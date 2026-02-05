# Comprehensive Language Detection Tests

## Python

### Python - Basic print
```python
print("Hello World")
```

### Python - Function definition
```python
def greet(name):
    return f"Hello {name}"
```

### Python - Class definition
```python
class Person:
    def __init__(self, name):
        self.name = name
```

### Python - List comprehension
```python
squares = [x**2 for x in range(10)]
```

### Python - Import statement
```python
import numpy as np
from typing import List
```

## JavaScript

### JavaScript - Console log
```javascript
console.log("Hello World");
```

### JavaScript - Arrow function
```javascript
const greet = (name) => {
    return `Hello ${name}`;
};
```

### JavaScript - Async/await
```javascript
async function fetchData() {
    const response = await fetch(url);
    return response.json();
}
```

### JavaScript - Destructuring
```javascript
const { name, age } = person;
```

## TypeScript

### TypeScript - Type annotation
```typescript
function greet(name: string): string {
    return `Hello ${name}`;
}
```

### TypeScript - Interface
```typescript
interface User {
    id: number;
    name: string;
    email: string;
}
```

### TypeScript - Generic
```typescript
function identity<T>(arg: T): T {
    return arg;
}
```

## Java

### Java - Main method
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
```

### Java - Class with methods
```java
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}
```

## Go

### Go - Package and import
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello World")
}
```

### Go - Struct
```go
type Person struct {
    Name string
    Age  int
}
```

### Go - Error handling
```go
if err != nil {
    return fmt.Errorf("error: %w", err)
}
```

## Rust

### Rust - Main function
```rust
fn main() {
    println!("Hello World");
}
```

### Rust - Struct with impl
```rust
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }
}
```

### Rust - Pattern matching
```rust
match value {
    Some(x) => println!("{}", x),
    None => println!("No value"),
}
```

## Ruby

### Ruby - Basic puts
```ruby
puts "Hello World"
```

### Ruby - Class definition
```ruby
class Person
  attr_accessor :name
  
  def initialize(name)
    @name = name
  end
end
```

### Ruby - Block iteration
```ruby
[1, 2, 3].each do |num|
  puts num * 2
end
```

## PHP

### PHP - Echo statement
```php
<?php
echo "Hello World";
?>
```

### PHP - Function
```php
<?php
function greet($name) {
    return "Hello " . $name;
}
?>
```

### PHP - Class
```php
<?php
class User {
    private $name;
    
    public function __construct($name) {
        $this->name = $name;
    }
}
?>
```

## C++

### C++ - Hello World
```cpp
#include <iostream>

int main() {
    std::cout << "Hello World" << std::endl;
    return 0;
}
```

### C++ - Class
```cpp
class Rectangle {
private:
    int width, height;
public:
    Rectangle(int w, int h) : width(w), height(h) {}
    int area() { return width * height; }
};
```

## C#

### C# - Hello World
```csharp
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello World");
    }
}
```

### C# - LINQ
```csharp
var result = numbers
    .Where(n => n > 5)
    .Select(n => n * 2)
    .ToList();
```

## Swift

### Swift - Print
```swift
var message: String = "Hello World"
print(message)
```

### Swift - Optional binding
```swift
if let name = optionalName {
    print("Hello \(name)")
}
```

### Swift - Struct
```swift
struct Person {
    var name: String
    var age: Int
}
```

## Kotlin

### Kotlin - Main function
```kotlin
fun main() {
    println("Hello World")
}
```

### Kotlin - Data class
```kotlin
data class User(
    val id: Int,
    val name: String
)
```

### Kotlin - Extension function
```kotlin
fun String.isPalindrome(): Boolean {
    return this == this.reversed()
}
```

## Scala

### Scala - Object
```scala
object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello World")
  }
}
```

### Scala - Case class
```scala
case class Person(name: String, age: Int)
```

## Lua

### Lua - Print
```lua
local message = "Hello World"
print(message)
```

### Lua - Function
```lua
function greet(name)
    return "Hello " .. name
end
```

### Lua - Table
```lua
local person = {
    name = "John",
    age = 30
}
```

## Shell

### Shell - Echo
```bash
echo "Hello World"
```

### Shell - For loop
```bash
for file in *.txt; do
    echo "Processing $file"
done
```

### Shell - If statement
```bash
if [ -f "file.txt" ]; then
    echo "File exists"
fi
```

## SQL

### SQL - Select
```sql
SELECT * FROM users WHERE age > 18;
```

### SQL - Join
```sql
SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id;
```

### SQL - Create table
```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);
```

## HTML

### HTML - Basic structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>Page Title</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
```

### HTML - Form
```html
<form action="/submit" method="post">
    <input type="text" name="username">
    <button type="submit">Submit</button>
</form>
```

## CSS

### CSS - Basic styles
```css
body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
}
```

### CSS - Flexbox
```css
.container {
    display: flex;
    justify-content: center;
    align-items: center;
}
```

## JSON

### JSON - Object
```json
{
    "name": "John",
    "age": 30,
    "city": "New York"
}
```

### JSON - Array
```json
[
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
]
```

## YAML

### YAML - Configuration
```yaml
server:
  host: localhost
  port: 8080
  debug: true
```

### YAML - List
```yaml
fruits:
  - apple
  - banana
  - orange
```

## TOML

### TOML - Configuration
```toml
[server]
host = "localhost"
port = 8080
debug = true
```

## Markdown

### Markdown - Headers and lists
```markdown
# Title

## Subtitle

- Item 1
- Item 2
- Item 3
```

## Dockerfile

### Dockerfile - Multi-stage
```dockerfile
FROM node:16 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:16-alpine
COPY --from=builder /app /app
CMD ["node", "index.js"]
```

## YAML (Kubernetes)

### YAML - K8s deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
```

## GraphQL

### GraphQL - Query
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    posts {
      title
      content
    }
  }
}
```

### GraphQL - Mutation
```graphql
mutation CreateUser($input: UserInput!) {
  createUser(input: $input) {
    id
    name
  }
}
```

## Haskell

### Haskell - Function
```haskell
factorial :: Integer -> Integer
factorial 0 = 1
factorial n = n * factorial (n - 1)
```

### Haskell - List comprehension
```haskell
squares = [x^2 | x <- [1..10]]
```

## Elixir

### Elixir - Module
```elixir
defmodule Math do
  def sum(a, b) do
    a + b
  end
end
```

### Elixir - Pattern matching
```elixir
case value do
  {:ok, result} -> result
  {:error, _} -> nil
end
```

## Erlang

### Erlang - Function
```erlang
factorial(0) -> 1;
factorial(N) -> N * factorial(N-1).
```

## Julia

### Julia - Function
```julia
function fibonacci(n)
    if n <= 1
        return n
    end
    return fibonacci(n-1) + fibonacci(n-2)
end
```

### Julia - Array operations
```julia
A = [1 2 3; 4 5 6]
B = A .^ 2
```

## R

### R - Vector operations
```r
x <- c(1, 2, 3, 4, 5)
y <- x^2
plot(x, y)
```

### R - Data frame
```r
df <- data.frame(
  name = c("Alice", "Bob"),
  age = c(25, 30)
)
```

## Perl

### Perl - Print
```perl
print "Hello World\n";
```

### Perl - Regex
```perl
if ($text =~ /pattern/) {
    print "Match found\n";
}
```

## Vim Script

### Vim Script - Settings
```vim
set number
set relativenumber
syntax on
```

### Vim Script - Function
```vim
function! ToggleNumber()
  if &number
    set nonumber
  else
    set number
  endif
endfunction
```

## Zig

### Zig - Main function
```zig
const std = @import("std");

pub fn main() !void {
    std.debug.print("Hello World\n", .{});
}
```

## Dart

### Dart - Main function
```dart
void main() {
  print('Hello World');
}
```

### Dart - Class
```dart
class Person {
  String name;
  int age;
  
  Person(this.name, this.age);
}
```

## Solidity

### Solidity - Contract
```solidity
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;
    
    function setValue(uint256 _value) public {
        value = _value;
    }
}
```

## Nim

### Nim - Echo
```nim
var message: string = "Hello World"
echo message
```

### Nim - Proc
```nim
proc greet(name: string): string =
  result = "Hello " & name
```

## Crystal

### Crystal - Puts
```crystal
message : String = "Hello World"
puts message
```

### Crystal - Class
```crystal
class Person
  property name : String
  
  def initialize(@name)
  end
end
```

## F#

### F# - Function
```fsharp
let add x y = x + y
let result = add 5 3
```

### F# - Pattern matching
```fsharp
match value with
| Some x -> printfn "%d" x
| None -> printfn "No value"
```

## OCaml

### OCaml - Function
```ocaml
let rec factorial n =
  if n <= 1 then 1
  else n * factorial (n - 1)
```

## Clojure

### Clojure - Function
```clojure
(defn greet [name]
  (str "Hello " name))
```

### Clojure - Map
```clojure
(map inc [1 2 3 4 5])
```

## Groovy

### Groovy - Closure
```groovy
def greet = { name ->
    println "Hello ${name}"
}
```

## Terraform

### Terraform - Resource
```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  tags = {
    Name = "WebServer"
  }
}
```

## Nginx

### Nginx - Server block
```nginx
server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

## Apache

### Apache - VirtualHost
```apache
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/html
    
    <Directory /var/www/html>
        AllowOverride All
    </Directory>
</VirtualHost>
```

## Makefile

### Makefile - Targets
```makefile
CC = gcc
CFLAGS = -Wall -O2

all: program

program: main.o utils.o
	$(CC) $(CFLAGS) -o program main.o utils.o

clean:
	rm -f *.o program
```

## CMake

### CMake - Project
```cmake
cmake_minimum_required(VERSION 3.10)
project(MyProject)

add_executable(myapp main.cpp)
target_link_libraries(myapp pthread)
```

## Prisma

### Prisma - Schema
```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

## Vue

### Vue - Component
```vue
<template>
  <div class="greeting">
    <h1>{{ message }}</h1>
    <button @click="updateMessage">Click me</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      message: 'Hello Vue!'
    }
  },
  methods: {
    updateMessage() {
      this.message = 'Updated!'
    }
  }
}
</script>
```

## Svelte

### Svelte - Component
```svelte
<script>
  let count = 0;
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

## Astro

### Astro - Component
```astro
---
const name = "World";
const items = ['Apple', 'Banana', 'Orange'];
---

<html>
  <body>
    <h1>Hello {name}!</h1>
    <ul>
      {items.map(item => <li>{item}</li>)}
    </ul>
  </body>
</html>
```

## Handlebars

### Handlebars - Template
```handlebars
<div class="user">
  <h1>{{user.name}}</h1>
  {{#if user.isAdmin}}
    <span class="badge">Admin</span>
  {{/if}}
  
  <ul>
    {{#each user.posts}}
      <li>{{this.title}}</li>
    {{/each}}
  </ul>
</div>
```

## Jinja

### Jinja - Template
```jinja
{% extends "base.html" %}

{% block content %}
  <h1>{{ title }}</h1>
  
  {% for item in items %}
    <p>{{ item.name }}: {{ item.price | currency }}</p>
  {% endfor %}
{% endblock %}
```

## Liquid

### Liquid - Template
```liquid
{% if user %}
  <h1>Welcome, {{ user.name }}!</h1>
  
  {% for product in products %}
    <div class="product">
      <h2>{{ product.title }}</h2>
      <p>{{ product.price | money }}</p>
    </div>
  {% endfor %}
{% endif %}
```

## Pug

### Pug - Template
```pug
doctype html
html
  head
    title My Site
  body
    h1 Hello World
    ul
      each item in items
        li= item
```

## Haml

### Haml - Template
```haml
%html
  %head
    %title My Site
  %body
    %h1 Hello World
    %ul
      - items.each do |item|
        %li= item
```

## LaTeX

### LaTeX - Document
```latex
\documentclass{article}
\usepackage{amsmath}

\begin{document}

\title{My Document}
\author{John Doe}
\maketitle

\section{Introduction}
This is a sample document with math: $E = mc^2$

\end{document}
```

## MATLAB

### MATLAB - Script
```matlab
% Create a matrix
A = [1 2 3; 4 5 6; 7 8 9];

% Calculate eigenvalues
eigenvalues = eig(A);

% Plot results
plot(eigenvalues);
title('Eigenvalues');
```

## PowerShell

### PowerShell - Script
```powershell
$files = Get-ChildItem -Path "C:\Temp" -Filter "*.txt"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    $content = Get-Content $file.FullName
    # Process content
}
```

## Protobuf

### Protobuf - Message
```protobuf
syntax = "proto3";

package example;

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  repeated string tags = 4;
}

service UserService {
  rpc GetUser(UserRequest) returns (User);
}
```

## Sass

### Sass - Styles
```scss
$primary-color: #3498db;
$padding: 20px;

.container {
  padding: $padding;
  
  .header {
    background-color: $primary-color;
    
    h1 {
      color: white;
      font-size: 2em;
    }
  }
}
```

## Less

### Less - Styles
```less
@primary-color: #3498db;
@padding: 20px;

.container {
  padding: @padding;
  
  .header {
    background-color: @primary-color;
    
    h1 {
      color: white;
      font-size: 2em;
    }
  }
}
```

## Stylus

### Stylus - Styles
```stylus
primary-color = #3498db
padding = 20px

.container
  padding padding
  
  .header
    background-color primary-color
    
    h1
      color white
      font-size 2em
```

## PostCSS

### PostCSS - Styles
```postcss
.container {
  @apply flex items-center justify-center;
  background: theme('colors.primary');
  
  @media (max-width: 768px) {
    @apply block;
  }
}
```

## Elm

### Elm - Module
```elm
module Main exposing (main)

import Html exposing (Html, text)

main : Html msg
main =
    text "Hello World"

add : Int -> Int -> Int
add a b =
    a + b
```

## CoffeeScript

### CoffeeScript - Function
```coffeescript
square = (x) -> x * x

numbers = [1, 2, 3, 4, 5]
squares = (square num for num in numbers)

console.log squares
```

## GDScript

### GDScript - Script
```gdscript
extends Node2D

var speed = 200
var velocity = Vector2()

func _ready():
    print("Game started")

func _process(delta):
    velocity = Vector2()
    
    if Input.is_action_pressed("ui_right"):
        velocity.x += 1
    
    position += velocity * speed * delta
```

## Objective-C

### Objective-C - Class
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

### Prolog - Facts and rules
```prolog
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).

grandparent(X, Z) :-
    parent(X, Y),
    parent(Y, Z).

sibling(X, Y) :-
    parent(Z, X),
    parent(Z, Y),
    X \= Y.
```

## Dotenv

### Dotenv - Environment variables
```dotenv
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=abc123def456
SECRET_KEY=super_secret_key_here
DEBUG=true
PORT=3000
```

## MDX

### MDX - Component
```mdx
import { Chart } from './components/Chart'

# My Article

This is a paragraph with **bold** text.

<Chart data={[1, 2, 3, 4, 5]} />

## Code Example

```js
console.log('Hello from MDX');
```
```

## Twig

### Twig - Template
```twig
{% extends "layout.html" %}

{% block content %}
    <h1>{{ page.title }}</h1>
    
    {% for post in posts %}
        <article>
            <h2>{{ post.title }}</h2>
            <p>{{ post.content|truncate(100) }}</p>
            <time>{{ post.date|date('Y-m-d') }}</time>
        </article>
    {% endfor %}
{% endblock %}
```

## XML

### XML - Document
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
    <book category="fiction">
        <title>The Great Gatsby</title>
        <author>F. Scott Fitzgerald</author>
        <year>1925</year>
        <price>10.99</price>
    </book>
    <book category="science">
        <title>A Brief History of Time</title>
        <author>Stephen Hawking</author>
        <year>1988</year>
        <price>15.99</price>
    </book>
</bookstore>
```
