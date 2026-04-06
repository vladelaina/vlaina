import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedPythonCases: readonly HandcraftedLanguageCase[] = [
  entry('print hello world', `print("hello world")`),
  entry('simple def return', `def add(left, right):
    return left + right`),
  entry('typed def return', `def slugify(value: str) -> str:
    return value.strip().lower()`),
  entry('from import helper', `from pathlib import Path

print(Path('notes').exists())`),
  entry('import os getenv', `import os

value = os.getenv('APP_ENV', 'dev')`),
  entry('import json loads', `import json

payload = json.loads('{"ok": true}')`),
  entry('import re sub', `import re

slug = re.sub(r'\s+', '-', title.strip())`),
  entry('class init method', `class Note:
    def __init__(self, title: str) -> None:
        self.title = title`),
  entry('class method render', `class Card:
    def render(self) -> str:
        return self.title`),
  entry('dataclass note', `from dataclasses import dataclass

@dataclass
class Note:
    title: str
    archived: bool = False`),
  entry('typed list alias', `from typing import List

names: List[str] = ['a', 'b']`),
  entry('typed dict alias', `from typing import Dict

counts: Dict[str, int] = {'draft': 1}`),
  entry('optional return', `from typing import Optional

def find_title(row: dict) -> Optional[str]:
    return row.get('title')`),
  entry('union parameter pipe', `def stringify(value: int | str) -> str:
    return str(value)`),
  entry('list comprehension lower', `names = [user.name.lower() for user in users]`),
  entry('dict comprehension map', `counts = {item.id: item.total for item in items}`),
  entry('set comprehension tags', `tags = {item.tag for item in rows if item.tag}`),
  entry('generator expression sum', `total = sum(item.count for item in rows)`),
  entry('lambda sort key', `rows.sort(key=lambda row: row['title'])`),
  entry('with open read text', `with open('notes.txt', 'r', encoding='utf-8') as handle:
    text = handle.read()`),
  entry('pathlib read text', `from pathlib import Path

text = Path('note.md').read_text(encoding='utf-8')`),
  entry('if name main', `if __name__ == '__main__':
    print('ready')`),
  entry('enumerate loop', `for index, value in enumerate(items, start=1):
    print(index, value)`),
  entry('zip loop pairs', `for left, right in zip(xs, ys):
    print(left + right)`),
  entry('for else search', `for item in items:
    if item.id == target:
        break
else:
    raise ValueError('missing')`),
  entry('try except value error', `try:
    amount = int(raw)
except ValueError:
    amount = 0`),
  entry('try except finally', `try:
    return load_note()
except OSError:
    return None
finally:
    logger.info('done')`),
  entry('raise runtime error', `raise RuntimeError('invalid state')`),
  entry('assert statement', `assert title, 'title is required'`),
  entry('f string format', `message = f"note:{note_id}"`),
  entry('multiline f string', `message = f"{title}\n{slug}\n{updated_at}"`),
  entry('decorator route', `@app.get('/notes')
def list_notes():
    return {'items': []}`),
  entry('decorator cached property', `from functools import cached_property

class Config:
    @cached_property
    def path(self) -> str:
        return '/tmp'`),
  entry('staticmethod classmethod', `class Slugger:
    @staticmethod
    def normalize(value: str) -> str:
        return value.strip()

    @classmethod
    def from_title(cls, value: str):
        return cls()`),
  entry('property getter setter', `class Counter:
    @property
    def value(self) -> int:
        return self._value

    @value.setter
    def value(self, next_value: int) -> None:
        self._value = next_value`),
  entry('async def await call', `async def load_title(client) -> str:
    response = await client.fetch('/notes/1')
    return response['title']`),
  entry('async for stream', `async def read(stream):
    async for chunk in stream:
        print(chunk)`),
  entry('async with session', `async def load(session):
    async with session.get('/health') as response:
        return await response.text()`),
  entry('yield generator fn', `def lines(rows):
    for row in rows:
        yield row['title']`),
  entry('yield from helper', `def all_items():
    yield from load_items()`),
  entry('match case status', `def label(status: str) -> str:
    match status:
        case 'draft':
            return 'Draft'
        case _:
            return 'Other'`),
  entry('walrus operator line', `while chunk := handle.read(1024):
    pieces.append(chunk)`),
  entry('none true false literals', `state = None
ready = True
failed = False`),
  entry('tuple unpack values', `title, slug = row['title'], row['slug']`),
  entry('star unpack values', `first, *rest = items`),
  entry('slice and len', `preview = text[:20]
count = len(preview)`),
  entry('append extend pop', `values.append('draft')
values.extend(['published'])
last = values.pop()`),
  entry('collections counter', `from collections import Counter

counts = Counter(tags)`),
  entry('defaultdict list', `from collections import defaultdict

items_by_tag = defaultdict(list)`),
  entry('deque appendleft', `from collections import deque

queue = deque(['a'])
queue.appendleft('b')`),
  entry('itertools chain use', `from itertools import chain

values = list(chain(pinned, recent))`),
  entry('functools lru cache', `from functools import lru_cache

@lru_cache(maxsize=64)
def load_value(key: str) -> str:
    return key.upper()`),
  entry('contextlib suppress', `from contextlib import suppress

with suppress(FileNotFoundError):
    Path('missing.txt').unlink()`),
  entry('datetime now utc', `from datetime import datetime, timezone

now = datetime.now(timezone.utc)`),
  entry('decimal quantize', `from decimal import Decimal

total = Decimal('12.50').quantize(Decimal('0.01'))`),
  entry('fractions fraction', `from fractions import Fraction

value = Fraction(1, 3)`),
  entry('subprocess run text', `import subprocess

result = subprocess.run(['git', 'status'], check=True, text=True, capture_output=True)`),
  entry('tempfile named temp', `from tempfile import NamedTemporaryFile

with NamedTemporaryFile('w+', delete=False) as handle:
    handle.write('demo')`),
  entry('uuid hex token', `from uuid import uuid4

token = uuid4().hex`),
  entry('logging info call', `import logging

logger = logging.getLogger(__name__)
logger.info('ready')`),
  entry('pytest test function', `def test_adds_values():
    assert 2 + 2 == 4`),
  entry('pytest raises context', `import pytest

with pytest.raises(ValueError):
    int('x')`),
  entry('unittest testcase', `import unittest

class NoteTests(unittest.TestCase):
    def test_title(self):
        self.assertEqual('a'.upper(), 'A')`),
  entry('django model field', `from django.db import models

class Note(models.Model):
    title = models.CharField(max_length=255)`),
  entry('django queryset filter', `notes = Note.objects.filter(archived=False).order_by('-updated_at')`),
  entry('django view request', `from django.http import JsonResponse

def health(request):
    return JsonResponse({'ok': True})`),
  entry('fastapi endpoint', `from fastapi import FastAPI

app = FastAPI()

@app.get('/health')
def health() -> dict[str, bool]:
    return {'ok': True}`),
  entry('pydantic base model', `from pydantic import BaseModel

class NotePayload(BaseModel):
    title: str
    archived: bool = False`),
  entry('sqlalchemy select chain', `statement = select(Note).where(Note.archived.is_(False)).order_by(Note.updated_at.desc())`),
  entry('pandas dataframe usage', `import pandas as pd

df = pd.DataFrame(rows)
print(df.head())`),
  entry('numpy zeros shape', `import numpy as np

matrix = np.zeros((3, 3))`),
  entry('matplotlib plot line', `import matplotlib.pyplot as plt

plt.plot(xs, ys)
plt.show()`),
  entry('path exists check', `from pathlib import Path

if Path('notes').exists():
    print('yes')`),
  entry('os path join', `import os

path = os.path.join('notes', 'draft.md')`),
  entry('json dump file', `import json

with open('note.json', 'w', encoding='utf-8') as handle:
    json.dump(payload, handle)`),
  entry('csv dict reader', `import csv

with open('notes.csv', newline='', encoding='utf-8') as handle:
    rows = list(csv.DictReader(handle))`),
  entry('sqlite3 execute query', `import sqlite3

connection = sqlite3.connect(':memory:')
connection.execute('select 1')`),
  entry('httpx async client', `import httpx

async def fetch() -> str:
    async with httpx.AsyncClient() as client:
        response = await client.get('https://example.com')
        return response.text`),
  entry('requests get json', `import requests

response = requests.get('https://example.com/api')
payload = response.json()`),
  entry('argparse parser', `import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--title')`),
  entry('click command decorator', `import click

@click.command()
def main() -> None:
    click.echo('ready')`),
  entry('rich print usage', `from rich import print

print('[bold green]ready[/bold green]')`),
  entry('namedtuple create', `from collections import namedtuple

Point = namedtuple('Point', ['x', 'y'])`),
  entry('enum class values', `from enum import Enum

class Status(Enum):
    DRAFT = 'draft'
    PUBLISHED = 'published'`),
  entry('strenum class values', `from enum import StrEnum

class Mode(StrEnum):
    LIST = 'list'
    BOARD = 'board'`),
  entry('protocol typing', `from typing import Protocol

class Renderable(Protocol):
    def render(self) -> str: ...`),
  entry('type alias list', `type NoteRow = dict[str, str]`),
  entry('generic typevar fn', `from typing import TypeVar

T = TypeVar('T')

def first(items: list[T]) -> T:
    return items[0]`),
  entry('cast helper typing', `from typing import cast

payload = cast(dict[str, str], value)`),
  entry('literal type alias', `from typing import Literal

Mode = Literal['list', 'board']`),
  entry('final constant typing', `from typing import Final

APP_NAME: Final = 'vlaina'`),
  entry('overload declarations', `from typing import overload

@overload
def label(value: int) -> str: ...

@overload
def label(value: str) -> str: ...`),
  entry('annotations future import', `from __future__ import annotations

class Node:
    parent: Node | None = None`),
  entry('comprehension with if', `visible = [row for row in rows if row['visible']]`),
  entry('sorted key reverse', `items = sorted(rows, key=lambda row: row['updated_at'], reverse=True)`),
  entry('any all builtins', `has_draft = any(row['state'] == 'draft' for row in rows)
all_ready = all(row['ready'] for row in rows)`),
  entry('map filter list', `titles = list(map(str.upper, filter(None, titles)))`),
  entry('sum min max builtins', `total = sum(counts)
smallest = min(counts)
largest = max(counts)`),
  entry('dictionary get setdefault', `value = payload.get('title', 'Inbox')
items = grouped.setdefault('draft', [])`),
  entry('instance check', `if isinstance(value, str):
    print(value.upper())`),
];
