import type { HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedCCases: readonly HandcraftedLanguageCase[] = [
  {
    name: '001 printf hello world',
    sample: `#include <stdio.h>

int main(void) {
  printf("hello, world\\n");
  return 0;
}`,
  },
  {
    name: '002 scanf add numbers',
    sample: `#include <stdio.h>

int add(int a, int b) {
  return a + b;
}

int main(void) {
  int left = 0;
  int right = 0;
  scanf("%d %d", &left, &right);
  printf("%d\\n", add(left, right));
  return 0;
}`,
  },
  {
    name: '003 fgets stdin line',
    sample: `#include <stdio.h>

int main(void) {
  char line[128];
  if (fgets(line, sizeof(line), stdin) != NULL) {
    puts(line);
  }
  return 0;
}`,
  },
  {
    name: '004 puts status line',
    sample: `#include <stdio.h>

int main(void) {
  puts("ready");
  return 0;
}`,
  },
  {
    name: '005 getchar until newline',
    sample: `#include <stdio.h>

int main(void) {
  int ch = 0;
  while ((ch = getchar()) != EOF && ch != '\\n') {
    putchar(ch);
  }
  return 0;
}`,
  },
  {
    name: '006 putchar uppercase letters',
    sample: `#include <ctype.h>
#include <stdio.h>

int main(void) {
  const char *text = "note";
  while (*text != '\\0') {
    putchar(toupper((unsigned char)*text));
    text++;
  }
  putchar('\\n');
  return 0;
}`,
  },
  {
    name: '007 fprintf stderr message',
    sample: `#include <stdio.h>

int main(void) {
  fprintf(stderr, "fatal: %s\\n", "missing config");
  return 1;
}`,
  },
  {
    name: '008 snprintf message buffer',
    sample: `#include <stdio.h>

int main(void) {
  char buffer[64];
  snprintf(buffer, sizeof(buffer), "id=%d state=%s", 7, "open");
  puts(buffer);
  return 0;
}`,
  },
  {
    name: '009 sscanf parse coordinate',
    sample: `#include <stdio.h>

int main(void) {
  int x = 0;
  int y = 0;
  sscanf("12,48", "%d,%d", &x, &y);
  printf("%d %d\\n", x, y);
  return 0;
}`,
  },
  {
    name: '010 qsort integer array',
    sample: `#include <stdlib.h>

static int compare_ints(const void *left, const void *right) {
  const int a = *(const int *)left;
  const int b = *(const int *)right;
  return (a > b) - (a < b);
}

int values[] = {4, 1, 7, 2};
qsort(values, 4, sizeof(int), compare_ints);`,
  },
  {
    name: '011 bsearch existing value',
    sample: `#include <stdlib.h>

static int compare_ints(const void *left, const void *right) {
  const int a = *(const int *)left;
  const int b = *(const int *)right;
  return (a > b) - (a < b);
}

int values[] = {1, 3, 5, 7, 9};
int key = 5;
int *found = bsearch(&key, values, 5, sizeof(int), compare_ints);`,
  },
  {
    name: '012 malloc string buffer',
    sample: `#include <stdlib.h>
#include <string.h>

char *copy_name(const char *name) {
  size_t length = strlen(name) + 1;
  char *copy = malloc(length);
  if (copy != NULL) {
    memcpy(copy, name, length);
  }
  return copy;
}`,
  },
  {
    name: '013 calloc histogram buckets',
    sample: `#include <stdlib.h>

int *make_histogram(size_t bucket_count) {
  return calloc(bucket_count, sizeof(int));
}`,
  },
  {
    name: '014 realloc growth buffer',
    sample: `#include <stdlib.h>

char *grow_buffer(char *buffer, size_t next_size) {
  char *resized = realloc(buffer, next_size);
  if (resized == NULL) {
    free(buffer);
    return NULL;
  }
  return resized;
}`,
  },
  {
    name: '015 free linked node',
    sample: `#include <stdlib.h>

struct Node {
  struct Node *next;
  int value;
};

void destroy_node(struct Node *node) {
  free(node);
}`,
  },
  {
    name: '016 memset zero struct',
    sample: `#include <string.h>

struct Config {
  int width;
  int height;
  int flags;
};

void reset_config(struct Config *config) {
  memset(config, 0, sizeof(*config));
}`,
  },
  {
    name: '017 memcpy packet header',
    sample: `#include <stdint.h>
#include <string.h>

void write_magic(uint8_t *buffer) {
  const uint8_t magic[4] = {0xDE, 0xAD, 0xBE, 0xEF};
  memcpy(buffer, magic, sizeof(magic));
}`,
  },
  {
    name: '018 memmove overlap left shift',
    sample: `#include <string.h>

void trim_prefix(char *text) {
  memmove(text, text + 2, strlen(text + 2) + 1);
}`,
  },
  {
    name: '019 strcmp command match',
    sample: `#include <stdio.h>
#include <string.h>

int main(void) {
  const char *command = "sync";
  if (strcmp(command, "sync") == 0) {
    puts("ok");
  }
  return 0;
}`,
  },
  {
    name: '020 strncpy fixed field',
    sample: `#include <string.h>

void set_title(char *dest, const char *src) {
  strncpy(dest, src, 31);
  dest[31] = '\\0';
}`,
  },
  {
    name: '021 strchr slash lookup',
    sample: `#include <string.h>

const char *path = "notes/archive/today.txt";
const char *slash = strchr(path, '/');`,
  },
  {
    name: '022 strstr token lookup',
    sample: `#include <string.h>

const char *line = "tag:inbox status=open";
const char *token = strstr(line, "status=");`,
  },
  {
    name: '023 strtok csv fields',
    sample: `#include <string.h>

char row[] = "alpha,beta,gamma";
char *field = strtok(row, ",");
while (field != NULL) {
  field = strtok(NULL, ",");
}`,
  },
  {
    name: '024 struct point instance',
    sample: `struct Point {
  int x;
  int y;
};

struct Point cursor = {12, 48};`,
  },
  {
    name: '025 typedef struct user',
    sample: `typedef struct {
  int id;
  const char *name;
} User;

User current = {7, "mira"};`,
  },
  {
    name: '026 enum sync state',
    sample: `enum SyncState {
  SYNC_IDLE,
  SYNC_RUNNING,
  SYNC_FAILED
};

enum SyncState state = SYNC_RUNNING;`,
  },
  {
    name: '027 union number view',
    sample: `union NumberView {
  unsigned int value;
  unsigned char bytes[4];
};

union NumberView view = {0x11223344U};`,
  },
  {
    name: '028 designated initializer config',
    sample: `struct Window {
  int width;
  int height;
  int visible;
};

struct Window window = {
  .height = 720,
  .width = 1280,
  .visible = 1,
};`,
  },
  {
    name: '029 compound literal point',
    sample: `struct Point {
  int x;
  int y;
};

int sum_point(struct Point point) {
  return point.x + point.y;
}

int total = sum_point((struct Point){3, 9});`,
  },
  {
    name: '030 function pointer callback',
    sample: `typedef int (*Reducer)(int left, int right);

int apply(Reducer reducer, int left, int right) {
  return reducer(left, right);
}`,
  },
  {
    name: '031 static call counter',
    sample: `int next_ticket(void) {
  static int current = 1000;
  current += 1;
  return current;
}`,
  },
  {
    name: '032 const char pointer return',
    sample: `const char *status_label(int status) {
  return status == 0 ? "idle" : "busy";
}`,
  },
  {
    name: '033 volatile flag polling',
    sample: `volatile int stop_requested = 0;

void wait_loop(void) {
  while (!stop_requested) {
  }
}`,
  },
  {
    name: '034 extern shared counter',
    sample: `extern int global_counter;

void bump_counter(void) {
  global_counter += 1;
}`,
  },
  {
    name: '035 file fopen read line',
    sample: `#include <stdio.h>

int main(void) {
  char line[64];
  FILE *fp = fopen("notes.txt", "r");
  if (fp == NULL) {
    return 1;
  }
  if (fgets(line, sizeof(line), fp) != NULL) {
    puts(line);
  }
  fclose(fp);
  return 0;
}`,
  },
  {
    name: '036 file fwrite binary blob',
    sample: `#include <stdio.h>

int main(void) {
  unsigned char data[3] = {1, 2, 3};
  FILE *fp = fopen("out.bin", "wb");
  if (fp == NULL) {
    return 1;
  }
  fwrite(data, sizeof(unsigned char), 3, fp);
  fclose(fp);
  return 0;
}`,
  },
  {
    name: '037 file fread header bytes',
    sample: `#include <stdio.h>

unsigned char header[8];
FILE *fp = fopen("asset.bin", "rb");
if (fp != NULL) {
  fread(header, sizeof(unsigned char), 8, fp);
  fclose(fp);
}`,
  },
  {
    name: '038 fseek rewind stream',
    sample: `#include <stdio.h>

void rewind_file(FILE *fp) {
  fseek(fp, 0L, SEEK_SET);
}`,
  },
  {
    name: '039 tmpfile scratch stream',
    sample: `#include <stdio.h>

FILE *open_scratch(void) {
  return tmpfile();
}`,
  },
  {
    name: '040 remove stale file',
    sample: `#include <stdio.h>

int clear_cache(void) {
  return remove("cache.tmp");
}`,
  },
  {
    name: '041 rename output file',
    sample: `#include <stdio.h>

int commit_output(void) {
  return rename("draft.txt", "final.txt");
}`,
  },
  {
    name: '042 perror on failure',
    sample: `#include <stdio.h>

int main(void) {
  FILE *fp = fopen("missing.txt", "r");
  if (fp == NULL) {
    perror("fopen");
    return 1;
  }
  fclose(fp);
  return 0;
}`,
  },
  {
    name: '043 errno open report',
    sample: `#include <errno.h>
#include <stdio.h>
#include <string.h>

int main(void) {
  FILE *fp = fopen("missing.txt", "r");
  if (fp == NULL) {
    fprintf(stderr, "%s\\n", strerror(errno));
  }
  return 0;
}`,
  },
  {
    name: '044 time now snapshot',
    sample: `#include <stdio.h>
#include <time.h>

int main(void) {
  time_t now = time(NULL);
  printf("%ld\\n", (long)now);
  return 0;
}`,
  },
  {
    name: '045 rand dice roll',
    sample: `#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main(void) {
  srand((unsigned int)time(NULL));
  printf("%d\\n", (rand() % 6) + 1);
  return 0;
}`,
  },
  {
    name: '046 strtol parse integer',
    sample: `#include <stdlib.h>

long parse_count(const char *value) {
  char *end = NULL;
  return strtol(value, &end, 10);
}`,
  },
  {
    name: '047 strtod parse decimal',
    sample: `#include <stdlib.h>

double parse_ratio(const char *value) {
  char *end = NULL;
  return strtod(value, &end);
}`,
  },
  {
    name: '048 exit failure path',
    sample: `#include <stdlib.h>

void abort_launch(void) {
  exit(EXIT_FAILURE);
}`,
  },
  {
    name: '049 atexit cleanup hook',
    sample: `#include <stdlib.h>

static void cleanup(void) {
}

int main(void) {
  atexit(cleanup);
  return 0;
}`,
  },
  {
    name: '050 assert positive size',
    sample: `#include <assert.h>

void reserve(int count) {
  assert(count > 0);
}`,
  },
  {
    name: '051 signal interrupt handler',
    sample: `#include <signal.h>

static void on_interrupt(int signum) {
  (void)signum;
}

int main(void) {
  signal(SIGINT, on_interrupt);
  return 0;
}`,
  },
  {
    name: '052 setjmp longjmp recover',
    sample: `#include <setjmp.h>

jmp_buf env;

void fail_now(void) {
  longjmp(env, 1);
}

int run_step(void) {
  if (setjmp(env) != 0) {
    return -1;
  }
  fail_now();
  return 0;
}`,
  },
  {
    name: '053 varargs log message',
    sample: `#include <stdarg.h>
#include <stdio.h>

void log_line(const char *fmt, ...) {
  va_list args;
  va_start(args, fmt);
  vfprintf(stderr, fmt, args);
  va_end(args);
}`,
  },
  {
    name: '054 macro min value',
    sample: `#define MIN_VALUE(a, b) ((a) < (b) ? (a) : (b))

int lower = MIN_VALUE(3, 9);`,
  },
  {
    name: '055 macro array length',
    sample: `#define ARRAY_LEN(values) (sizeof(values) / sizeof((values)[0]))

int numbers[] = {1, 2, 3, 4};
size_t count = ARRAY_LEN(numbers);`,
  },
  {
    name: '056 ifdef debug branch',
    sample: `#include <stdio.h>

void debug_log(const char *message) {
#ifdef DEBUG
  puts(message);
#else
  (void)message;
#endif
}`,
  },
  {
    name: '057 multiline swap macro',
    sample: `#define SWAP_INT(a, b) do { \\
  int temp__ = (a); \\
  (a) = (b); \\
  (b) = temp__; \\
} while (0)

int left = 1;
int right = 2;`,
  },
  {
    name: '058 bitmask feature flags',
    sample: `enum FeatureFlags {
  FEATURE_READ = 1 << 0,
  FEATURE_WRITE = 1 << 1,
  FEATURE_SYNC = 1 << 2
};

int enabled = FEATURE_READ | FEATURE_SYNC;`,
  },
  {
    name: '059 switch on menu item',
    sample: `int handle_choice(int choice) {
  switch (choice) {
    case 1:
      return 10;
    case 2:
      return 20;
    default:
      return -1;
  }
}`,
  },
  {
    name: '060 for loop accumulate',
    sample: `int sum_range(int limit) {
  int total = 0;
  int i = 0;
  for (i = 0; i < limit; ++i) {
    total += i;
  }
  return total;
}`,
  },
  {
    name: '061 while retry counter',
    sample: `int wait_retries(int remaining) {
  while (remaining > 0) {
    remaining--;
  }
  return remaining;
}`,
  },
  {
    name: '062 do while once prompt',
    sample: `int attempts = 0;
do {
  attempts++;
} while (attempts < 3);`,
  },
  {
    name: '063 nested struct address',
    sample: `struct Address {
  const char *city;
  const char *street;
};

struct Contact {
  const char *name;
  struct Address address;
};

struct Contact owner = {"Mira", {"Shanghai", "West Lake Rd"}};`,
  },
  {
    name: '064 linked list append',
    sample: `#include <stdlib.h>

struct Node {
  int value;
  struct Node *next;
};

void append(struct Node **head, int value) {
  struct Node *node = malloc(sizeof(*node));
  node->value = value;
  node->next = *head;
  *head = node;
}`,
  },
  {
    name: '065 argv print arguments',
    sample: `#include <stdio.h>

int main(int argc, char **argv) {
  int i = 0;
  for (i = 0; i < argc; ++i) {
    puts(argv[i]);
  }
  return 0;
}`,
  },
  {
    name: '066 char matrix rows',
    sample: `char board[3][3] = {
  {'x', '.', '.'},
  {'.', 'o', '.'},
  {'.', '.', 'x'}
};`,
  },
  {
    name: '067 array of callbacks',
    sample: `typedef void (*TaskFn)(void);

void sync_notes(void);
void sync_tags(void);

TaskFn tasks[] = {sync_notes, sync_tags};`,
  },
  {
    name: '068 typedef callback alias',
    sample: `typedef void (*OnMessage)(const char *message);

void emit_message(OnMessage callback, const char *message) {
  callback(message);
}`,
  },
  {
    name: '069 size_t byte scan',
    sample: `#include <stddef.h>

size_t count_zeroes(const unsigned char *buffer, size_t length) {
  size_t i = 0;
  size_t total = 0;
  for (i = 0; i < length; ++i) {
    if (buffer[i] == 0) {
      total++;
    }
  }
  return total;
}`,
  },
  {
    name: '070 wprintf wide text',
    sample: `#include <locale.h>
#include <wchar.h>

int main(void) {
  setlocale(LC_ALL, "");
  wprintf(L"%ls\\n", L"hello");
  return 0;
}`,
  },
  {
    name: '071 clock elapsed ticks',
    sample: `#include <time.h>

clock_t started = clock();
clock_t finished = clock();
double seconds = (double)(finished - started) / CLOCKS_PER_SEC;`,
  },
  {
    name: '072 difftime compare times',
    sample: `#include <time.h>

double seconds_between(time_t start, time_t end) {
  return difftime(end, start);
}`,
  },
  {
    name: '073 getenv home variable',
    sample: `#include <stdlib.h>

const char *home = getenv("HOME");`,
  },
  {
    name: '074 system shell command',
    sample: `#include <stdlib.h>

int open_editor(void) {
  return system("notepad notes.txt");
}`,
  },
  {
    name: '075 sig_atomic stop flag',
    sample: `#include <signal.h>

volatile sig_atomic_t should_stop = 0;

void on_signal(int signum) {
  (void)signum;
  should_stop = 1;
}`,
  },
  {
    name: '076 flexible array packet',
    sample: `#include <stddef.h>

struct Packet {
  size_t length;
  unsigned char data[];
};`,
  },
  {
    name: '077 designated array initializer',
    sample: `int lookup[10] = {
  [0] = 7,
  [4] = 9,
  [9] = 3,
};`,
  },
  {
    name: '078 stdint fixed width fields',
    sample: `#include <stdint.h>

struct Header {
  uint32_t magic;
  uint16_t version;
  uint16_t flags;
};`,
  },
  {
    name: '079 bool include true false',
    sample: `#include <stdbool.h>

bool enabled = true;
if (!enabled) {
  enabled = false;
}`,
  },
  {
    name: '080 math sqrt distance',
    sample: `#include <math.h>

double diagonal(double width, double height) {
  return sqrt(width * width + height * height);
}`,
  },
  {
    name: '081 modulo table printer',
    sample: `#include <stdio.h>

int main(void) {
  int i = 0;
  for (i = 1; i <= 6; ++i) {
    printf("%d %d\\n", i, i % 3);
  }
  return 0;
}`,
  },
  {
    name: '082 getc file copy loop',
    sample: `#include <stdio.h>

void copy_stream(FILE *input, FILE *output) {
  int ch = 0;
  while ((ch = getc(input)) != EOF) {
    putc(ch, output);
  }
}`,
  },
  {
    name: '083 setvbuf line buffering',
    sample: `#include <stdio.h>

int main(void) {
  char buffer[BUFSIZ];
  setvbuf(stdout, buffer, _IOLBF, sizeof(buffer));
  return 0;
}`,
  },
  {
    name: '084 sscanf parse hex',
    sample: `#include <stdio.h>

unsigned int color = 0;
sscanf("ff00aa", "%x", &color);`,
  },
  {
    name: '085 djb2 hash function',
    sample: `unsigned long hash_text(const char *text) {
  unsigned long hash = 5381;
  int ch = 0;
  while ((ch = (unsigned char)*text++) != 0) {
    hash = ((hash << 5) + hash) + (unsigned long)ch;
  }
  return hash;
}`,
  },
  {
    name: '086 recursive factorial',
    sample: `unsigned int factorial(unsigned int value) {
  if (value <= 1U) {
    return 1U;
  }
  return value * factorial(value - 1U);
}`,
  },
  {
    name: '087 ternary clamp floor',
    sample: `int floor_zero(int value) {
  return value < 0 ? 0 : value;
}`,
  },
  {
    name: '088 goto cleanup branch',
    sample: `#include <stdio.h>

int write_report(FILE *fp) {
  if (fp == NULL) {
    goto cleanup;
  }
  fputs("ok\\n", fp);
cleanup:
  return fp == NULL ? -1 : 0;
}`,
  },
  {
    name: '089 parse digit with ctype',
    sample: `#include <ctype.h>

int parse_digit(char ch) {
  if (!isdigit((unsigned char)ch)) {
    return -1;
  }
  return ch - '0';
}`,
  },
  {
    name: '090 inline add helper',
    sample: `static inline int add_fast(int left, int right) {
  return left + right;
}`,
  },
  {
    name: '091 restrict copy bytes',
    sample: `void copy_bytes(unsigned char *restrict dst, const unsigned char *restrict src, unsigned long count) {
  unsigned long i = 0;
  for (i = 0; i < count; ++i) {
    dst[i] = src[i];
  }
}`,
  },
  {
    name: '092 literal null pointer',
    sample: `#include <stddef.h>

void *cursor = NULL;`,
  },
  {
    name: '093 fputs stdout line',
    sample: `#include <stdio.h>

int main(void) {
  fputs("ready\\n", stdout);
  return 0;
}`,
  },
  {
    name: '094 feof input check',
    sample: `#include <stdio.h>

int drain(FILE *fp) {
  while (!feof(fp)) {
    fgetc(fp);
  }
  return 0;
}`,
  },
  {
    name: '095 isdigit filter chars',
    sample: `#include <ctype.h>

int count_digits(const char *text) {
  int total = 0;
  while (*text != '\\0') {
    if (isdigit((unsigned char)*text)) {
      total++;
    }
    text++;
  }
  return total;
}`,
  },
  {
    name: '096 toupper copy buffer',
    sample: `#include <ctype.h>

void uppercase(char *text) {
  while (*text != '\\0') {
    *text = (char)toupper((unsigned char)*text);
    text++;
  }
}`,
  },
  {
    name: '097 strcspn newline trim',
    sample: `#include <string.h>

void trim_newline(char *line) {
  line[strcspn(line, "\\r\\n")] = '\\0';
}`,
  },
  {
    name: '098 strspn prefix skip',
    sample: `#include <string.h>

size_t leading_spaces(const char *text) {
  return strspn(text, " \\t");
}`,
  },
  {
    name: '099 strpbrk delimiter scan',
    sample: `#include <string.h>

const char *delimiter = strpbrk("name:value", ":=");`,
  },
  {
    name: '100 initial sample add function',
    sample: `#include <stdio.h>

int add(int a, int b);

int main(void) {
  int x = 0;
  int y = 0;
  int result = 0;

  printf("Enter two integers: ");
  scanf("%d %d", &x, &y);

  result = add(x, y);

  printf("Sum = %d\\n", result);

  return 0;
}

int add(int a, int b) {
  return a + b;
}`,
  },
];
