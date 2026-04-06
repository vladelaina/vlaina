import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedPHPCases: readonly HandcraftedLanguageCase[] = [
  entry('php open tag echo string', `<?php
echo "hello";`),
  entry('php variable assignment echo', `<?php
$name = 'vlaina';
echo $name;`),
  entry('php short echo tag', `<?= $title ?>`),
  entry('php namespace declaration', `<?php
namespace App\\Http\\Controllers;`),
  entry('php require once bootstrap', `<?php
require_once __DIR__ . '/bootstrap.php';`),
  entry('php include config file', `<?php
include __DIR__ . '/config.php';`),
  entry('php function typed params', `<?php
function add(int $left, int $right): int {
    return $left + $right;
}`),
  entry('php function nullable return', `<?php
function findTitle(array $row): ?string {
    return $row['title'] ?? null;
}`),
  entry('php variadic join helper', `<?php
function join_paths(string ...$parts): string {
    return implode('/', $parts);
}`),
  entry('php default argument value', `<?php
function greet(string $name = 'guest'): string {
    return "Hello {$name}";
}`),
  entry('php closure use capture', `<?php
$prefix = 'note-';
$format = function (string $id) use ($prefix): string {
    return $prefix . $id;
};`),
  entry('php arrow function array map', `<?php
$names = array_map(fn ($item) => strtoupper($item), $rows);`),
  entry('php associative array literal', `<?php
$config = [
    'host' => 'localhost',
    'port' => 3306,
];`),
  entry('php nested array access', `<?php
$value = $payload['data']['title'] ?? 'untitled';`),
  entry('php foreach over rows', `<?php
foreach ($rows as $row) {
    echo $row['title'];
}`),
  entry('php foreach key value', `<?php
foreach ($counts as $name => $count) {
    echo $name . ':' . $count;
}`),
  entry('php if elseif else', `<?php
if ($status === 'draft') {
    echo 'draft';
} elseif ($status === 'published') {
    echo 'published';
} else {
    echo 'archived';
}`),
  entry('php match expression', `<?php
$label = match ($status) {
    'draft' => 'Draft',
    'published' => 'Published',
    default => 'Archived',
};`),
  entry('php null coalescing chain', `<?php
$title = $input['title'] ?? $defaults['title'] ?? 'Inbox';`),
  entry('php nullsafe call', `<?php
$name = $user?->profile?->displayName();`),
  entry('php ternary assignment', `<?php
$state = $active ? 'enabled' : 'disabled';`),
  entry('php switch statement', `<?php
switch ($kind) {
    case 'note':
        echo 'note';
        break;
    default:
        echo 'other';
}`),
  entry('php while loop', `<?php
while (($line = fgets($stream)) !== false) {
    echo trim($line);
}`),
  entry('php do while loop', `<?php
$i = 0;
do {
    $i++;
} while ($i < 3);`),
  entry('php for loop counter', `<?php
for ($i = 0; $i < 3; $i++) {
    echo $i;
}`),
  entry('php class with constructor', `<?php
class NoteService {
    public function __construct(private Client $client) {}
}`),
  entry('php readonly property', `<?php
class NoteRecord {
    public function __construct(public readonly string $id) {}
}`),
  entry('php promoted properties', `<?php
class SessionConfig {
    public function __construct(
        private string $key,
        private int $ttl,
    ) {}
}`),
  entry('php public method typed', `<?php
class Slugger {
    public function fromTitle(string $title): string {
        return strtolower($title);
    }
}`),
  entry('php private helper method', `<?php
class TokenStore {
    private function normalize(string $value): string {
        return trim($value);
    }
}`),
  entry('php static factory method', `<?php
class NoteId {
    public static function fromString(string $value): self {
        return new self($value);
    }
}`),
  entry('php final class marker', `<?php
final class HtmlRenderer {
    public function render(): string {
        return '<p>ok</p>';
    }
}`),
  entry('php abstract class contract', `<?php
abstract class Command {
    abstract public function handle(array $input): int;
}`),
  entry('php interface definition', `<?php
interface CacheStore {
    public function get(string $key): mixed;
}`),
  entry('php implements interface', `<?php
class MemoryStore implements CacheStore {
    public function get(string $key): mixed {
        return null;
    }
}`),
  entry('php trait with method', `<?php
trait FormatsTitle {
    public function titleCase(string $value): string {
        return ucwords($value);
    }
}`),
  entry('php use trait in class', `<?php
class Presenter {
    use FormatsTitle;
}`),
  entry('php enum backed string', `<?php
enum Status: string {
    case Draft = 'draft';
    case Published = 'published';
}`),
  entry('php enum pure cases', `<?php
enum ViewMode {
    case List;
    case Board;
}`),
  entry('php enum methods', `<?php
enum Role: string {
    case Admin = 'admin';

    public function isAdmin(): bool {
        return $this === self::Admin;
    }
}`),
  entry('php attribute route', `<?php
#[Route('/notes')]
final class NoteController {}
`),
  entry('php attribute on property', `<?php
class NoteDto {
    #[SerializedName('note_title')]
    public string $title;
}`),
  entry('php named arguments call', `<?php
renderCard(title: 'Inbox', body: 'Zero');`),
  entry('php union type parameter', `<?php
function stringify(int|string $value): string {
    return (string) $value;
}`),
  entry('php intersection type parameter', `<?php
function sync(Countable&Traversable $items): void {
    foreach ($items as $item) {
        echo $item;
    }
}`),
  entry('php nullable property', `<?php
class Draft {
    public ?string $title = null;
}`),
  entry('php typed constant', `<?php
const APP_ENV = 'local';`),
  entry('php class constant', `<?php
class Limits {
    public const MAX_ITEMS = 50;
}`),
  entry('php magic constants', `<?php
$path = __DIR__ . '/' . basename(__FILE__);`),
  entry('php use import class', `<?php
use App\\Support\\Str;

$value = Str::slug('Inbox Zero');`),
  entry('php grouped use imports', `<?php
use App\\Http\\{Request, Response};`),
  entry('php alias import', `<?php
use App\\Contracts\\CacheStore as Store;`),
  entry('php namespace and class', `namespace App\\Jobs;

class SyncNotes {}
`),
  entry('php function no tag with dollars', `function open_note(string $id): array {
    return ['id' => $id];
}`),
  entry('php method chain with dollars', `$query = $db->table('notes')->where('archived', false)->get();`),
  entry('php pdo prepare execute', `$stmt = $pdo->prepare('select * from notes where id = :id');
$stmt->execute(['id' => $id]);`),
  entry('php laravel collect chain', `$titles = collect($rows)->pluck('title')->filter()->values();`),
  entry('php eloquent where first', `$note = Note::where('slug', $slug)->first();`),
  entry('php laravel request input', `$title = $request->input('title', 'Inbox');`),
  entry('php laravel config helper', `$driver = config('cache.default');`),
  entry('php blade style escaped echo', `<?php echo e($title); ?>`),
  entry('php heredoc assignment', `<?php
$message = <<<PHP
Hello {$name}
PHP;`),
  entry('php nowdoc assignment', `<?php
$template = <<<'TXT'
Hello {{name}}
TXT;`),
  entry('php json decode assoc', `<?php
$payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);`),
  entry('php array filter callback', `<?php
$visible = array_filter($rows, fn ($row) => $row['visible'] === true);`),
  entry('php usort spaceship', `<?php
usort($rows, fn ($left, $right) => $left['order'] <=> $right['order']);`),
  entry('php array reduce carry', `<?php
$total = array_reduce($items, fn ($carry, $item) => $carry + $item['count'], 0);`),
  entry('php explode implode helpers', `<?php
$slug = implode('-', explode(' ', strtolower(trim($title))));`),
  entry('php preg replace trim', `<?php
$slug = preg_replace('/\s+/', '-', trim($title));`),
  entry('php date immutable create', `<?php
$time = new DateTimeImmutable('now', new DateTimeZone('UTC'));`),
  entry('php exception throw', `<?php
throw new RuntimeException('missing note');`),
  entry('php try catch finally', `<?php
try {
    $service->sync();
} catch (Throwable $error) {
    report($error);
} finally {
    fclose($stream);
}`),
  entry('php anonymous class', `<?php
$logger = new class () implements LoggerInterface {
    public function info(string $message, array $context = []): void {}
};`),
  entry('php static anonymous function', `<?php
$map = static function (array $row): string {
    return $row['title'];
};`),
  entry('php reference parameter', `<?php
function increment(int &$value): void {
    $value++;
}`),
  entry('php generator yield', `<?php
function lines(iterable $rows): Generator {
    foreach ($rows as $row) {
        yield $row['title'];
    }
}`),
  entry('php yield from helper', `<?php
function allRows(): Generator {
    yield from fetch_rows();
}`),
  entry('php instanceof check', `<?php
if ($note instanceof DraftNote) {
    echo $note->title;
}`),
  entry('php array destructuring', `<?php
['title' => $title, 'slug' => $slug] = $payload;`),
  entry('php list destructuring', `<?php
[$first, $second] = $items;`),
  entry('php isset and empty', `<?php
if (!isset($payload['title']) || empty($payload['title'])) {
    echo 'missing';
}`),
  entry('php strict comparison', `<?php
if ($status === 'draft' && $count !== 0) {
    echo 'ok';
}`),
  entry('php declare strict types', `<?php
declare(strict_types=1);`),
  entry('php file put contents', `<?php
file_put_contents($path, json_encode($payload));`),
  entry('php fopen fwrite fclose', `<?php
$handle = fopen($path, 'w');
fwrite($handle, $content);
fclose($handle);`),
  entry('php session array access', `<?php
$_SESSION['user_id'] = $user->id;`),
  entry('php post input read', `<?php
$email = $_POST['email'] ?? '';`),
  entry('php server request uri', `<?php
$uri = $_SERVER['REQUEST_URI'] ?? '/';`),
  entry('php superglobal files', `<?php
$tmp = $_FILES['avatar']['tmp_name'] ?? null;`),
  entry('php filter input helper', `<?php
$page = filter_input(INPUT_GET, 'page', FILTER_VALIDATE_INT) ?? 1;`),
  entry('php spl fixed array', `<?php
$items = new SplFixedArray(3);`),
  entry('php arrayobject usage', `<?php
$bag = new ArrayObject(['title' => 'Inbox']);`),
  entry('php composer autoload require', `<?php
require __DIR__ . '/vendor/autoload.php';`),
  entry('php symfony response object', `<?php
return new JsonResponse(['ok' => true]);`),
  entry('php laravel return response json', `<?php
return response()->json(['status' => 'ok']);`),
  entry('php query builder order by', `<?php
$rows = DB::table('notes')->orderByDesc('updated_at')->limit(10)->get();`),
  entry('php static property access', `<?php
$value = Settings::$defaultLocale;`),
  entry('php self constant access', `<?php
class Mode {
    private const DEFAULT = 'list';

    public function value(): string {
        return self::DEFAULT;
    }
}`),
  entry('php parent method call', `<?php
class CachedClient extends BaseClient {
    public function send(array $payload): array {
        return parent::send($payload);
    }
}`),
  entry('php trait conflict resolution', `<?php
class CombinedLogger {
    use FileLogger, StdoutLogger {
        FileLogger::log insteadof StdoutLogger;
    }
}`),
];
