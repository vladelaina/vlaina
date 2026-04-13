import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedObjectiveCCases: readonly HandcraftedLanguageCase[] = [
  entry('foundation hello world', `#import <Foundation/Foundation.h>

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    NSLog(@"Hello, World!");
  }
}`),
  entry('person interface property', `#import <Foundation/Foundation.h>

@interface Person : NSObject
@property (nonatomic, copy) NSString *name;
@end`),
  entry('person implementation', `#import <Foundation/Foundation.h>

@implementation Person
- (NSString *)displayName {
  return self.name;
}
@end`),
  entry('protocol declaration', `#import <Foundation/Foundation.h>

@protocol Syncing <NSObject>
- (void)performSync;
@end`),
  entry('category declaration', `#import <Foundation/Foundation.h>

@interface NSString (Slugging)
- (NSString *)vl_slugString;
@end`),
  entry('category implementation', `#import <Foundation/Foundation.h>

@implementation NSString (Slugging)
- (NSString *)vl_slugString {
  return [self lowercaseString];
}
@end`),
  entry('class extension', `#import <Foundation/Foundation.h>

@interface TaskStore ()
@property (nonatomic, strong) NSMutableArray *items;
@end`),
  entry('singleton shared manager', `#import <Foundation/Foundation.h>

+ (instancetype)sharedManager {
  static TaskManager *manager;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    manager = [[TaskManager alloc] init];
  });
  return manager;
}`),
  entry('delegate weak property', `#import <UIKit/UIKit.h>

@interface ComposerViewController : UIViewController
@property (nonatomic, weak) id<UITextFieldDelegate> delegate;
@end`),
  entry('block property', `#import <Foundation/Foundation.h>

typedef void (^CompletionHandler)(BOOL success);

@interface Downloader : NSObject
@property (nonatomic, copy) CompletionHandler completion;
@end`),
  entry('method with two parameters', `#import <Foundation/Foundation.h>

- (void)saveTitle:(NSString *)title folder:(NSString *)folder {
  NSLog(@"%@ %@", title, folder);
}`),
  entry('class factory method', `#import <Foundation/Foundation.h>

+ (instancetype)clientWithBaseURL:(NSURL *)url {
  return [[self alloc] initWithBaseURL:url];
}`),
  entry('init with title', `#import <Foundation/Foundation.h>

- (instancetype)initWithTitle:(NSString *)title {
  self = [super init];
  if (self) {
    _title = [title copy];
  }
  return self;
}`),
  entry('ns enum typedef', `#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, SyncState) {
  SyncStateIdle,
  SyncStateRunning,
  SyncStateFailed,
};`),
  entry('ns options typedef', `#import <Foundation/Foundation.h>

typedef NS_OPTIONS(NSUInteger, NoteFlags) {
  NoteFlagsPinned = 1 << 0,
  NoteFlagsArchived = 1 << 1,
};`),
  entry('array literal', `#import <Foundation/Foundation.h>

NSArray *tags = @[@"work", @"home", @"later"];`),
  entry('mutable array add object', `#import <Foundation/Foundation.h>

NSMutableArray *items = [NSMutableArray array];
[items addObject:@"draft"];`),
  entry('dictionary literal', `#import <Foundation/Foundation.h>

NSDictionary *payload = @{@"title": @"Inbox", @"count": @3};`),
  entry('mutable dictionary set object', `#import <Foundation/Foundation.h>

NSMutableDictionary *settings = [NSMutableDictionary dictionary];
[settings setObject:@YES forKey:@"autosave"];`),
  entry('set literal', `#import <Foundation/Foundation.h>

NSSet *roles = [NSSet setWithObjects:@"owner", @"editor", nil];`),
  entry('number literal', `#import <Foundation/Foundation.h>

NSNumber *count = @42;
NSNumber *enabled = @YES;`),
  entry('string with format', `#import <Foundation/Foundation.h>

NSString *slug = [NSString stringWithFormat:@"%@-%ld", name, (long)count];`),
  entry('localized compare', `#import <Foundation/Foundation.h>

NSComparisonResult result = [left localizedCaseInsensitiveCompare:right];`),
  entry('error out parameter', `#import <Foundation/Foundation.h>

NSError *error = nil;
BOOL ok = [data writeToURL:url options:0 error:&error];`),
  entry('dynamic id type', `#import <Foundation/Foundation.h>

id target = self;
[target setValue:@"done" forKey:@"state"];`),
  entry('responds to selector', `#import <Foundation/Foundation.h>

if ([delegate respondsToSelector:@selector(reloadData)]) {
  [delegate reloadData];
}`),
  entry('notification center observer', `#import <Foundation/Foundation.h>

[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(noteDidChange:) name:@"NoteDidChange" object:nil];`),
  entry('key value coding', `#import <Foundation/Foundation.h>

[model setValue:@"Archive" forKey:@"title"];`),
  entry('observe value for key path', `#import <Foundation/Foundation.h>

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
  NSLog(@"%@", keyPath);
}`),
  entry('user defaults write', `#import <Foundation/Foundation.h>

[[NSUserDefaults standardUserDefaults] setObject:@"dark" forKey:@"theme"];`),
  entry('dispatch async main queue', `#import <Foundation/Foundation.h>

dispatch_async(dispatch_get_main_queue(), ^{
  self.ready = YES;
});`),
  entry('dispatch after deadline', `#import <Foundation/Foundation.h>

dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
  [self reload];
});`),
  entry('operation queue add operation', `#import <Foundation/Foundation.h>

NSOperationQueue *queue = [[NSOperationQueue alloc] init];
[queue addOperationWithBlock:^{
  [self runTask];
}];`),
  entry('url session data task', `#import <Foundation/Foundation.h>

NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
  NSLog(@"%@", response);
}];`),
  entry('predicate with format', `#import <Foundation/Foundation.h>

NSPredicate *predicate = [NSPredicate predicateWithFormat:@"archived == NO"];`),
  entry('regular expression pattern', `#import <Foundation/Foundation.h>

NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"[A-Z]+" options:0 error:nil];`),
  entry('encode with coder', `#import <Foundation/Foundation.h>

- (void)encodeWithCoder:(NSCoder *)coder {
  [coder encodeObject:self.title forKey:@"title"];
}`),
  entry('init with coder', `#import <Foundation/Foundation.h>

- (instancetype)initWithCoder:(NSCoder *)coder {
  self = [super init];
  if (self) {
    _title = [coder decodeObjectForKey:@"title"];
  }
  return self;
}`),
  entry('supports secure coding', `#import <Foundation/Foundation.h>

+ (BOOL)supportsSecureCoding {
  return YES;
}`),
  entry('copy with zone', `#import <Foundation/Foundation.h>

- (id)copyWithZone:(NSZone *)zone {
  return [[[self class] allocWithZone:zone] init];
}`),
  entry('fast enumeration', `#import <Foundation/Foundation.h>

for (NSString *name in names) {
  NSLog(@"%@", name);
}`),
  entry('nested message send', `#import <Foundation/Foundation.h>

NSString *token = [[NSUserDefaults standardUserDefaults] objectForKey:@"token"];`),
  entry('uikit frame make', `#import <UIKit/UIKit.h>

CGRect frame = CGRectMake(20, 40, 120, 44);`),
  entry('view controller interface', `#import <UIKit/UIKit.h>

@interface NotesViewController : UIViewController
@property (nonatomic, strong) UILabel *titleLabel;
@end`),
  entry('view did load implementation', `#import <UIKit/UIKit.h>

@implementation NotesViewController
- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor = [UIColor systemBackgroundColor];
}
@end`),
  entry('label text color', `#import <UIKit/UIKit.h>

UILabel *label = [[UILabel alloc] initWithFrame:CGRectZero];
label.textColor = [UIColor secondaryLabelColor];`),
  entry('button with type', `#import <UIKit/UIKit.h>

UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
[button setTitle:@"Save" forState:UIControlStateNormal];`),
  entry('table view datasource rows', `#import <UIKit/UIKit.h>

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
  return self.items.count;
}`),
  entry('table view cell for row', `#import <UIKit/UIKit.h>

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  return [tableView dequeueReusableCellWithIdentifier:@"Cell" forIndexPath:indexPath];
}`),
  entry('collection view cell subclass', `#import <UIKit/UIKit.h>

@interface TagCell : UICollectionViewCell
@property (nonatomic, strong) UILabel *textLabel;
@end`),
  entry('app delegate interface', `#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property (nonatomic, strong) UIWindow *window;
@end`),
  entry('bridge cast string ref', `#import <Foundation/Foundation.h>

CFStringRef raw = CFSTR("token");
NSString *value = (__bridge NSString *)raw;`),
  entry('core foundation import', `#import <CoreFoundation/CoreFoundation.h>

CFArrayRef values = CFArrayCreate(NULL, NULL, 0, &kCFTypeArrayCallBacks);`),
  entry('autoreleasepool and array', `@autoreleasepool {
  NSArray *values = @[@1, @2, @3];
  NSLog(@"%@", values);
}`),
  entry('block typedef and invocation', `#import <Foundation/Foundation.h>

typedef NSString * (^FormatterBlock)(NSString *value);
FormatterBlock formatter = ^NSString *(NSString *value) {
  return [value uppercaseString];
};`),
  entry('instancetype constructor', `#import <Foundation/Foundation.h>

- (instancetype)initWithURL:(NSURL *)url timeout:(NSTimeInterval)timeout {
  self = [super init];
  return self;
}`),
  entry('class object lookup', `#import <Foundation/Foundation.h>

Class cls = [NSObject class];
BOOL match = [self isKindOfClass:cls];`),
  entry('try catch finally', `#import <Foundation/Foundation.h>

@try {
  [store save];
} @catch (NSException *exception) {
  NSLog(@"%@", exception);
} @finally {
  NSLog(@"done");
}`),
  entry('synchronized self', `#import <Foundation/Foundation.h>

@synchronized (self) {
  [self.items addObject:item];
}`),
  entry('weak self capture', `#import <Foundation/Foundation.h>

__weak typeof(self) weakSelf = self;
self.completion = ^{
  [weakSelf reload];
};`),
  entry('block integer mutation', `#import <Foundation/Foundation.h>

__block NSInteger count = 0;
void (^increment)(void) = ^{
  count += 1;
};`),
  entry('dispatch once cache', `#import <Foundation/Foundation.h>

static NSDateFormatter *formatter;
static dispatch_once_t onceToken;
dispatch_once(&onceToken, ^{
  formatter = [[NSDateFormatter alloc] init];
});`),
  entry('module import foundation', `@import Foundation;

NSString *name = @"vlaina";`),
  entry('array generics literal', `@import Foundation;

NSArray<NSString *> *names = @[@"one", @"two"];`),
  entry('dictionary generics literal', `@import Foundation;

NSDictionary<NSString *, NSNumber *> *scores = @{@"a": @1, @"b": @2};`),
  entry('mutable array generics', `@import Foundation;

NSMutableArray<NSNumber *> *values = [NSMutableArray array];
[values addObject:@4];`),
  entry('nullable property', `@import Foundation;

@interface Draft : NSObject
@property (nonatomic, nullable, copy) NSString *subtitle;
@end`),
  entry('nonnull method parameter', `@import Foundation;

- (void)applyTitle:(nonnull NSString *)title;
`),
  entry('protocol conformance interface', `@import UIKit;

@interface NotesDataSource : NSObject <UITableViewDataSource>
@end`),
  entry('defaults nested message', `@import Foundation;

id theme = [[NSUserDefaults standardUserDefaults] objectForKey:@"theme"];`),
  entry('property dot syntax assignment', `#import <UIKit/UIKit.h>

self.titleLabel.text = @"Archive";
self.view.alpha = 0.5;`),
  entry('dynamic property', `#import <Foundation/Foundation.h>

@implementation Document
@dynamic title;
@end`),
  entry('synthesize property', `#import <Foundation/Foundation.h>

@implementation Document
@synthesize title = _title;
@end`),
  entry('nullability error pointer', `@import Foundation;

NSError * _Nullable error = nil;
BOOL ok = [data writeToFile:path atomically:YES];`),
  entry('ns assume nonnull begin', `@import Foundation;

NS_ASSUME_NONNULL_BEGIN
@interface InboxStore : NSObject
- (NSString *)titleForItem:(NSNumber *)identifier;
@end
NS_ASSUME_NONNULL_END`),
  entry('mutable string append', `#import <Foundation/Foundation.h>

NSMutableString *buffer = [NSMutableString stringWithString:@"note"];
[buffer appendString:@"-1"];`),
  entry('json serialization', `#import <Foundation/Foundation.h>

NSData *json = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];`),
  entry('json decode object', `#import <Foundation/Foundation.h>

NSDictionary *payload = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];`),
  entry('url components query item', `#import <Foundation/Foundation.h>

NSURLComponents *components = [NSURLComponents componentsWithString:@"https://example.com"];
components.queryItems = @[[NSURLQueryItem queryItemWithName:@"page" value:@"1"]];`),
  entry('index path row section', `#import <UIKit/UIKit.h>

NSIndexPath *indexPath = [NSIndexPath indexPathForRow:2 inSection:1];`),
  entry('gesture recognizer target action', `#import <UIKit/UIKit.h>

UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap:)];`),
  entry('animation with duration', `#import <UIKit/UIKit.h>

[UIView animateWithDuration:0.25 animations:^{
  self.bannerView.alpha = 1.0;
}];`),
  entry('nsvalue cgpoint', `#import <UIKit/UIKit.h>

NSValue *point = [NSValue valueWithCGPoint:CGPointMake(10, 20)];`),
  entry('uiimage named asset', `#import <UIKit/UIKit.h>

UIImage *icon = [UIImage imageNamed:@"note-star"];`),
  entry('data detector types', `#import <Foundation/Foundation.h>

NSDataDetector *detector = [NSDataDetector dataDetectorWithTypes:NSTextCheckingTypeLink error:nil];`),
  entry('url request mutable', `#import <Foundation/Foundation.h>

NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
request.HTTPMethod = @"POST";`),
  entry('pasteboard string', `#import <UIKit/UIKit.h>

[UIPasteboard generalPasteboard].string = @"copied";`),
  entry('bezier path rounded rect', `#import <UIKit/UIKit.h>

UIBezierPath *path = [UIBezierPath bezierPathWithRoundedRect:bounds cornerRadius:12];`),
  entry('layer corner radius', `#import <UIKit/UIKit.h>

self.cardView.layer.cornerRadius = 14;
self.cardView.layer.masksToBounds = YES;`),
  entry('availability check block', `#import <UIKit/UIKit.h>

if (@available(iOS 15.0, *)) {
  self.button.configuration = [UIButtonConfiguration filledButtonConfiguration];
}`),
  entry('property attributes assign', `#import <Foundation/Foundation.h>

@property (nonatomic, assign, getter=isPinned) BOOL pinned;`),
  entry('property attributes readonly', `#import <Foundation/Foundation.h>

@property (nonatomic, readonly) NSDate *createdAt;`),
  entry('method returning bool', `#import <Foundation/Foundation.h>

- (BOOL)containsIdentifier:(NSNumber *)identifier {
  return [self.ids containsObject:identifier];
}`),
  entry('method returning array generics', `@import Foundation;

- (NSArray<NSString *> *)allTitles {
  return @[@"Inbox", @"Archive"];
}`),
  entry('class property declaration', `@import Foundation;

@interface Cache : NSObject
@property (class, nonatomic, readonly) Cache *sharedCache;
@end`),
  entry('subscript dictionary access', `#import <Foundation/Foundation.h>

NSString *theme = settings[@"theme"];
settings[@"theme"] = @"dark";`),
  entry('object subscripting array', `#import <Foundation/Foundation.h>

NSString *first = items[0];`),
  entry('literal boxed expression', `#import <Foundation/Foundation.h>

NSNumber *sum = @(left + right);
NSString *label = @(identifier).stringValue;`),
  entry('available foundation parser', `@import Foundation;

NSUUID *identifier = [NSUUID UUID];
NSString *value = identifier.UUIDString;`),
  entry('completion handler parameter', `#import <Foundation/Foundation.h>

- (void)loadWithCompletion:(void (^)(NSArray *items, NSError *error))completion {
  completion(@[], nil);
}`),
];
