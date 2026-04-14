# Real World Code Test Cases

## JavaScript

### JavaScript - React Component
```javascript
import React, { useState, useEffect } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

### JavaScript - Express Server
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/users', async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running'));
```

## TypeScript

### TypeScript - Interface and Class
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

class UserService {
  private users: Map<number, User> = new Map();
  
  async createUser(data: Omit<User, 'id'>): Promise<User> {
    const id = this.users.size + 1;
    const user: User = { id, ...data };
    this.users.set(id, user);
    return user;
  }
  
  getUser(id: number): User | undefined {
    return this.users.get(id);
  }
}
```

### TypeScript - Generic Function
```typescript
function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}
```

## Python

### Python - FastAPI Endpoint
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float
    description: Optional[str] = None

items_db: List[Item] = []

@app.post("/items/", response_model=Item)
async def create_item(item: Item):
    items_db.append(item)
    return item

@app.get("/items/", response_model=List[Item])
async def read_items(skip: int = 0, limit: int = 10):
    return items_db[skip : skip + limit]
```

### Python - Data Processing
```python
import pandas as pd
import numpy as np

def analyze_sales(df: pd.DataFrame) -> dict:
    """Analyze sales data and return statistics."""
    return {
        'total_sales': df['amount'].sum(),
        'avg_sale': df['amount'].mean(),
        'top_products': df.groupby('product')['amount']
            .sum()
            .sort_values(ascending=False)
            .head(5)
            .to_dict()
    }
```

## Go

### Go - HTTP Handler
```go
package main

import (
    "encoding/json"
    "net/http"
    "github.com/gorilla/mux"
)

type User struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

func getUserHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    userID := vars["id"]
    
    user := User{
        ID:    1,
        Name:  "John Doe",
        Email: "john@example.com",
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}
```

### Go - Concurrent Processing
```go
func processItems(items []string) []Result {
    results := make(chan Result, len(items))
    var wg sync.WaitGroup
    
    for _, item := range items {
        wg.Add(1)
        go func(i string) {
            defer wg.Done()
            result := process(i)
            results <- result
        }(item)
    }
    
    go func() {
        wg.Wait()
        close(results)
    }()
    
    var output []Result
    for r := range results {
        output = append(output, r)
    }
    return output
}
```

## Rust

### Rust - Error Handling
```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file_contents(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn main() {
    match read_file_contents("data.txt") {
        Ok(contents) => println!("File contents: {}", contents),
        Err(e) => eprintln!("Error reading file: {}", e),
    }
}
```

### Rust - Trait Implementation
```rust
trait Drawable {
    fn draw(&self);
}

struct Circle {
    radius: f64,
}

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle with radius {}", self.radius);
    }
}

fn render<T: Drawable>(shape: &T) {
    shape.draw();
}
```


## Java

### Java - Spring Boot Controller
```java
@RestController
@RequestMapping("/api/products")
public class ProductController {
    
    @Autowired
    private ProductService productService;
    
    @GetMapping("/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        return productService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        Product saved = productService.save(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
```

### Java - Stream Processing
```java
import java.util.List;
import java.util.stream.Collectors;

public class DataProcessor {
    public List<String> processNames(List<Person> people) {
        return people.stream()
            .filter(p -> p.getAge() >= 18)
            .map(Person::getName)
            .map(String::toUpperCase)
            .sorted()
            .collect(Collectors.toList());
    }
}
```

## C#

### C# - LINQ Query
```csharp
using System.Linq;

public class OrderService
{
    public IEnumerable<OrderSummary> GetTopOrders(int count)
    {
        return _context.Orders
            .Where(o => o.Status == OrderStatus.Completed)
            .OrderByDescending(o => o.TotalAmount)
            .Take(count)
            .Select(o => new OrderSummary
            {
                OrderId = o.Id,
                CustomerName = o.Customer.Name,
                Total = o.TotalAmount
            });
    }
}
```

### C# - Async Method
```csharp
public async Task<List<User>> GetActiveUsersAsync()
{
    using var connection = new SqlConnection(_connectionString);
    await connection.OpenAsync();
    
    var command = new SqlCommand(
        "SELECT * FROM Users WHERE IsActive = 1",
        connection
    );
    
    var users = new List<User>();
    using var reader = await command.ExecuteReaderAsync();
    
    while (await reader.ReadAsync())
    {
        users.Add(new User
        {
            Id = reader.GetInt32(0),
            Name = reader.GetString(1)
        });
    }
    
    return users;
}
```

## Ruby

### Ruby - Rails Model
```ruby
class User < ApplicationRecord
  has_many :posts, dependent: :destroy
  has_many :comments
  
  validates :email, presence: true, uniqueness: true
  validates :name, presence: true, length: { minimum: 2 }
  
  before_save :normalize_email
  
  scope :active, -> { where(active: true) }
  scope :recent, -> { order(created_at: :desc) }
  
  def full_name
    "#{first_name} #{last_name}"
  end
  
  private
  
  def normalize_email
    self.email = email.downcase.strip
  end
end
```

### Ruby - Rake Task
```ruby
namespace :db do
  desc "Clean up old records"
  task cleanup: :environment do
    puts "Starting cleanup..."
    
    deleted_count = Post.where("created_at < ?", 1.year.ago).delete_all
    puts "Deleted #{deleted_count} old posts"
    
    User.where(active: false).find_each do |user|
      user.destroy if user.posts.empty?
    end
    
    puts "Cleanup completed!"
  end
end
```

## PHP

### PHP - Laravel Controller
```php
<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with('author')
            ->where('published', true)
            ->orderBy('created_at', 'desc')
            ->paginate(10);
            
        return view('posts.index', compact('posts'));
    }
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|max:255',
            'content' => 'required',
            'category_id' => 'required|exists:categories,id'
        ]);
        
        $post = Post::create($validated);
        
        return redirect()->route('posts.show', $post)
            ->with('success', 'Post created successfully!');
    }
}
```

## Swift

### Swift - SwiftUI View
```swift
import SwiftUI

struct ContentView: View {
    @State private var items: [Item] = []
    @State private var showingAddItem = false
    
    var body: some View {
        NavigationView {
            List {
                ForEach(items) { item in
                    ItemRow(item: item)
                }
                .onDelete(perform: deleteItems)
            }
            .navigationTitle("Items")
            .toolbar {
                Button(action: { showingAddItem = true }) {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $showingAddItem) {
                AddItemView(items: $items)
            }
        }
    }
    
    func deleteItems(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
    }
}
```

## Kotlin

### Kotlin - Coroutines
```kotlin
class UserRepository(private val api: ApiService) {
    
    suspend fun fetchUsers(): Result<List<User>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getUsers()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to fetch users"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun observeUsers(): Flow<List<User>> = flow {
        while (true) {
            val users = fetchUsers().getOrNull()
            if (users != null) {
                emit(users)
            }
            delay(5000)
        }
    }
}
```


## SQL

### SQL - Complex Query
```sql
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) as month,
        product_id,
        SUM(quantity * price) as total_sales
    FROM orders
    WHERE order_date >= '2024-01-01'
    GROUP BY DATE_TRUNC('month', order_date), product_id
)
SELECT 
    p.name,
    ms.month,
    ms.total_sales,
    RANK() OVER (PARTITION BY ms.month ORDER BY ms.total_sales DESC) as rank
FROM monthly_sales ms
JOIN products p ON ms.product_id = p.id
WHERE ms.total_sales > 1000
ORDER BY ms.month DESC, rank;
```

## HTML

### HTML - Modern Form
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Form</title>
</head>
<body>
    <form id="contactForm" action="/submit" method="POST">
        <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="5" required></textarea>
        </div>
        <button type="submit">Send Message</button>
    </form>
</body>
</html>
```

## CSS

### CSS - Grid Layout
```css
.container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    padding: 2rem;
}

.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
    .container {
        grid-template-columns: 1fr;
        padding: 1rem;
    }
}
```

## Vue

### Vue - Composition API
```vue
<template>
  <div class="entry-list">
    <input 
      v-model="newEntry" 
      @keyup.enter="addEntry"
      placeholder="Add an entry..."
    >
    <ul>
      <li v-for="entry in filteredEntries" :key="entry.id">
        <input 
          type="checkbox" 
          v-model="entry.completed"
        >
        <span :class="{ completed: entry.completed }">
          {{ entry.text }}
        </span>
        <button @click="removeEntry(entry.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const newEntry = ref('');
const entries = ref([]);

const addEntry = () => {
  if (newEntry.value.trim()) {
    entries.value.push({
      id: Date.now(),
      text: newEntry.value,
      completed: false
    });
    newEntry.value = '';
  }
};

const removeEntry = (id) => {
  entries.value = entries.value.filter(t => t.id !== id);
};

const filteredEntries = computed(() => {
  return entries.value.filter(t => !t.completed);
});
</script>
```

## Rust (Advanced)

### Rust - Async Web Server
```rust
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

async fn get_user(user_id: web::Path<u32>) -> Result<HttpResponse> {
    let user = User {
        id: *user_id,
        name: "John Doe".to_string(),
        email: "john@example.com".to_string(),
    };
    Ok(HttpResponse::Ok().json(user))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/users/{id}", web::get().to(get_user))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

## Elixir

### Elixir - GenServer
```elixir
defmodule Counter do
  use GenServer

  # Client API
  def start_link(initial_value \\ 0) do
    GenServer.start_link(__MODULE__, initial_value, name: __MODULE__)
  end

  def increment do
    GenServer.call(__MODULE__, :increment)
  end

  def get_value do
    GenServer.call(__MODULE__, :get_value)
  end

  # Server Callbacks
  @impl true
  def init(initial_value) do
    {:ok, initial_value}
  end

  @impl true
  def handle_call(:increment, _from, state) do
    {:reply, state + 1, state + 1}
  end

  @impl true
  def handle_call(:get_value, _from, state) do
    {:reply, state, state}
  end
end
```

## Haskell

### Haskell - Monad Example
```haskell
import Control.Monad (when)

data User = User
  { userId :: Int
  , userName :: String
  , userEmail :: String
  } deriving (Show, Eq)

validateUser :: User -> Either String User
validateUser user
  | null (userName user) = Left "Name cannot be empty"
  | null (userEmail user) = Left "Email cannot be empty"
  | not ('@' `elem` userEmail user) = Left "Invalid email"
  | otherwise = Right user

processUsers :: [User] -> IO ()
processUsers users = do
  let validated = map validateUser users
  mapM_ printResult validated
  where
    printResult (Right user) = putStrLn $ "Valid: " ++ userName user
    printResult (Left err) = putStrLn $ "Error: " ++ err
```

## Scala

### Scala - Case Classes and Pattern Matching
```scala
sealed trait Shape
case class Circle(radius: Double) extends Shape
case class Rectangle(width: Double, height: Double) extends Shape
case class Triangle(base: Double, height: Double) extends Shape

object ShapeCalculator {
  def area(shape: Shape): Double = shape match {
    case Circle(r) => Math.PI * r * r
    case Rectangle(w, h) => w * h
    case Triangle(b, h) => 0.5 * b * h
  }
  
  def perimeter(shape: Shape): Double = shape match {
    case Circle(r) => 2 * Math.PI * r
    case Rectangle(w, h) => 2 * (w + h)
    case Triangle(_, _) => 0.0 // Simplified
  }
}
```


## YAML

### YAML - Docker Compose
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://db:5432/myapp
    depends_on:
      - db
      - redis
    volumes:
      - ./app:/app
      - node_modules:/app/node_modules

  db:
    image: postgres:14
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  node_modules:
```

## JSON

### JSON - API Response
```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "id": 1,
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "role": "admin",
        "permissions": ["read", "write", "delete"],
        "metadata": {
          "lastLogin": "2024-01-15T10:30:00Z",
          "loginCount": 42
        }
      },
      {
        "id": 2,
        "name": "Bob Smith",
        "email": "bob@example.com",
        "role": "user",
        "permissions": ["read"],
        "metadata": {
          "lastLogin": "2024-01-14T15:20:00Z",
          "loginCount": 15
        }
      }
    ]
  },
  "pagination": {
    "page": 1,
    "perPage": 10,
    "total": 2
  }
}
```

## Dockerfile

### Dockerfile - Multi-stage Build
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## Makefile

### Makefile - Build System
```makefile
.PHONY: all build test clean install

CC = gcc
CFLAGS = -Wall -Wextra -O2
LDFLAGS = -lm

SRCS = $(wildcard src/*.c)
OBJS = $(SRCS:.c=.o)
TARGET = myapp

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test:
	@echo "Running tests..."
	@./tests/run_tests.sh

clean:
	rm -f $(OBJS) $(TARGET)

install: $(TARGET)
	install -m 755 $(TARGET) /usr/local/bin/
```

## GraphQL

### GraphQL - Schema Definition
```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  published: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Comment {
  id: ID!
  text: String!
  author: User!
  post: Post!
  createdAt: DateTime!
}

type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
  posts(published: Boolean): [Post!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
  createPost(title: String!, content: String!, authorId: ID!): Post!
  updatePost(id: ID!, title: String, content: String): Post!
  deletePost(id: ID!): Boolean!
}
```

## Terraform

### Terraform - AWS Infrastructure
```hcl
terraform {
  required_version = ">= 1.0"
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
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-web-server"
  }
}
```

## Nginx

### Nginx - Configuration
```nginx
upstream backend {
    least_conn;
    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 backup;
}

server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```


## Shell

### Shell - Deployment Script
```bash
#!/bin/bash
set -euo pipefail

APP_NAME="myapp"
DEPLOY_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"

echo "Starting deployment of ${APP_NAME}..."

# Create backup
if [ -d "${DEPLOY_DIR}" ]; then
    echo "Creating backup..."
    tar -czf "${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C "${DEPLOY_DIR}" .
fi

# Pull latest code
cd "${DEPLOY_DIR}" || exit 1
git fetch origin
git reset --hard origin/main

# Install dependencies
npm ci --production

# Build application
npm run build

# Restart service
sudo systemctl restart ${APP_NAME}

echo "Deployment completed successfully!"
```

## Lua

### Lua - Configuration
```lua
local config = {
    server = {
        host = "0.0.0.0",
        port = 8080,
        workers = 4
    },
    
    database = {
        host = "localhost",
        port = 5432,
        name = "myapp",
        pool_size = 10
    },
    
    redis = {
        host = "localhost",
        port = 6379,
        db = 0
    }
}

function config:get(key)
    local keys = {}
    for k in string.gmatch(key, "[^.]+") do
        table.insert(keys, k)
    end
    
    local value = self
    for _, k in ipairs(keys) do
        value = value[k]
        if value == nil then
            return nil
        end
    end
    
    return value
end

return config
```

## Dart

### Dart - Flutter Widget
```dart
import 'package:flutter/material.dart';

class EntryList extends StatefulWidget {
  @override
  _EntryListState createState() => _EntryListState();
}

class _EntryListState extends State<EntryList> {
  final List<String> _entries = [];
  final TextEditingController _controller = TextEditingController();

  void _addEntry() {
    if (_controller.text.isNotEmpty) {
      setState(() {
        _entries.add(_controller.text);
        _controller.clear();
      });
    }
  }

  void _removeEntry(int index) {
    setState(() {
      _entries.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Entry List')),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16.0),
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: 'Enter an entry',
                suffixIcon: IconButton(
                  icon: Icon(Icons.add),
                  onPressed: _addEntry,
                ),
              ),
              onSubmitted: (_) => _addEntry(),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _entries.length,
              itemBuilder: (context, index) {
                return ListTile(
                  title: Text(_entries[index]),
                  trailing: IconButton(
                    icon: Icon(Icons.delete),
                    onPressed: () => _removeEntry(index),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
```

## Markdown

### Markdown - Documentation
```markdown
# API Documentation

## Overview

This API provides access to user and post data.

## Authentication

All requests require an API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Get User

```http
GET /api/users/:id
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | integer | User ID |

**Response:**

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Create Post

```http
POST /api/posts
```

**Body:**

```json
{
  "title": "My Post",
  "content": "Post content here"
}
```

## Rate Limiting

- 100 requests per minute
- 1000 requests per hour
```

## Prisma

### Prisma - Database Schema
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  comments  Comment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  comments  Comment[]
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([published])
}

model Comment {
  id        Int      @id @default(autoincrement())
  text      String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  createdAt DateTime @default(now())

  @@index([postId])
  @@index([authorId])
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}
```

## Vim Script

### Vim Script - Plugin Configuration
```vim
" Plugin settings
let g:airline_theme='dracula'
let g:airline_powerline_fonts = 1
let g:airline#extensions#tabline#enabled = 1

" Custom mappings
nnoremap <leader>w :w<CR>
nnoremap <leader>q :q<CR>
nnoremap <leader>f :Files<CR>
nnoremap <leader>b :Buffers<CR>

" Function to toggle line numbers
function! ToggleLineNumbers()
  if &number
    set nonumber
    set norelativenumber
  else
    set number
    set relativenumber
  endif
endfunction

nnoremap <leader>n :call ToggleLineNumbers()<CR>

" Auto commands
augroup MyAutoCommands
  autocmd!
  autocmd BufWritePre * :%s/\s\+$//e
  autocmd FileType python setlocal tabstop=4 shiftwidth=4
  autocmd FileType javascript setlocal tabstop=2 shiftwidth=2
augroup END
```
