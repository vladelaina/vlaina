import { entry, type HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedKotlinCases: readonly HandcraftedLanguageCase[] = [
  entry('println main', `fun main() {
  println("hello")
}`),
  entry('top level function return', `fun slug(value: String): String {
  return value.trim().lowercase()
}`),
  entry('package import suspend', `package app.notes

import kotlinx.coroutines.delay

suspend fun loadNote(id: String): String {
  delay(1)
  return id
}`),
  entry('class mutable list property', `class NoteStore {
  val items: MutableList<String> = mutableListOf()
}`),
  entry('data class note', `data class Note(val id: String, val title: String)`),
  entry('data class defaults', `data class Draft(
  val id: String,
  val archived: Boolean = false,
)`),
  entry('enum class state', `enum class SyncState {
  Idle,
  Running,
  Done,
}`),
  entry('enum class with constructor', `enum class Priority(val weight: Int) {
  Low(1),
  High(2),
}`),
  entry('sealed class hierarchy', `sealed class LoadState {
  data class Success(val value: String) : LoadState()
  data object Loading : LoadState()
}`),
  entry('sealed interface result', `sealed interface SaveResult {
  data class Ok(val id: String) : SaveResult
  data class Failed(val message: String) : SaveResult
}`),
  entry('object singleton', `object AppConfig {
  val appName = "vlaina"
}`),
  entry('companion object factory', `class Token private constructor(val value: String) {
  companion object {
    fun create(value: String): Token {
      return Token(value)
    }
  }
}`),
  entry('fun interface callback', `fun interface NoteAction {
  fun run(id: String)
}`),
  entry('annotation class marker', `annotation class StableApi(val name: String)`),
  entry('jvm inline value class', `@JvmInline
value class UserId(val value: String)`),
  entry('primary constructor class', `class NoteCard(val id: String, val title: String) {
  fun label(): String {
    return "$id:$title"
  }
}`),
  entry('open class override', `open class Writer {
  open fun save(value: String): String {
    return value
  }
}

class AuditWriter : Writer() {
  override fun save(value: String): String {
    return value.uppercase()
  }
}`),
  entry('interface default method', `interface Renderable {
  fun render(): String {
    return "ok"
  }
}`),
  entry('extension function string', `fun String.slug(): String {
  return trim().lowercase().replace(" ", "-")
}`),
  entry('generic extension list', `fun <T> List<T>.headOrNull(): T? {
  return firstOrNull()
}`),
  entry('nullable elvis', `fun title(note: Note?): String {
  return note?.title ?: "draft"
}`),
  entry('safe call chain', `fun city(user: User?): String {
  return user?.profile?.city ?: "unknown"
}`),
  entry('not null assertion', `fun length(value: String?): Int {
  return value!!.length
}`),
  entry('smart cast is', `fun render(value: Any): String {
  return if (value is String) value.uppercase() else value.toString()
}`),
  entry('when expression value', `fun label(value: Int): String = when (value) {
  1 -> "one"
  2 -> "two"
  else -> "other"
}`),
  entry('when expression subjectless', `fun status(note: Note): String = when {
  note.title.isBlank() -> "blank"
  else -> "ready"
}`),
  entry('range until loop', `fun sum(limit: Int): Int {
  var total = 0
  for (index in 0 until limit) {
    total += index
  }
  return total
}`),
  entry('for in list', `fun join(values: List<String>): String {
  val parts = mutableListOf<String>()
  for (value in values) {
    parts += value.uppercase()
  }
  return parts.joinToString(",")
}`),
  entry('mutable map property', `class Cache {
  val items: MutableMap<String, Int> = mutableMapOf()
}`),
  entry('mutable set builder', `fun tags(): MutableSet<String> {
  return mutableSetOf("notes", "draft")
}`),
  entry('list chain filter map', `fun visible(values: List<String>): List<String> {
  return values.filter { it.isNotBlank() }.map { it.lowercase() }
}`),
  entry('sequence map filter', `fun values(input: List<Int>): List<Int> {
  return input.asSequence().filter { it > 0 }.map { it * 2 }.toList()
}`),
  entry('runCatching getOrElse', `fun parse(raw: String): Int {
  return runCatching { raw.toInt() }.getOrElse { 0 }
}`),
  entry('by lazy property', `class Session {
  val token by lazy { "note-token" }
}`),
  entry('lateinit var service', `class Controller {
  lateinit var repository: NoteRepository
}`),
  entry('typealias handler', `typealias NoteHandler = (String) -> Unit`),
  entry('inline reified function', `inline fun <reified T> cast(value: Any): T? {
  return value as? T
}`),
  entry('coroutine scope launch', `import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

suspend fun syncAll(ids: List<String>) {
  coroutineScope {
    ids.forEach { id ->
      launch {
        println(id)
      }
    }
  }
}`),
  entry('suspend function delay', `import kotlinx.coroutines.delay

class Loader {
  suspend fun load(): List<String> {
    delay(1)
    return listOf("a", "b")
  }
}`),
  entry('flow of collect', `import kotlinx.coroutines.flow.flowOf

suspend fun firstLabel(): String {
  var value = ""
  flowOf("draft", "done").collect { item ->
    value = item
  }
  return value
}`),
  entry('build list block', `fun names(): List<String> {
  return buildList {
    add("draft")
    add("done")
  }
}`),
  entry('build map block', `fun mapping(): Map<String, Int> {
  return buildMap {
    put("draft", 1)
    put("done", 2)
  }
}`),
  entry('destructuring pair', `fun pairLabel(): String {
  val (left, right) = "a" to "b"
  return "$left-$right"
}`),
  entry('data class destructuring', `data class Row(val id: String, val title: String)

fun label(row: Row): String {
  val (id, title) = row
  return "$id:$title"
}`),
  entry('take if chain', `fun normalized(value: String): String? {
  return value.takeIf { it.isNotBlank() }?.trim()
}`),
  entry('require not null', `fun safeTitle(value: String?): String {
  return requireNotNull(value)
}`),
  entry('check not null', `fun safeId(value: String?): String {
  return checkNotNull(value)
}`),
  entry('string template expression', `fun banner(title: String, count: Int): String {
  return "\${title.lowercase()}:$count"
}`),
  entry('nested class with companion', `class Parser {
  class Result(val value: String)

  companion object {
    fun ok(): Result {
      return Result("ok")
    }
  }
}`),
  entry('generic class property', `class Box<T>(val value: T) {
  fun unwrap(): T {
    return value
  }
}`),
  entry('interface generic method', `interface Repository<T> {
  fun findById(id: String): T?
}`),
  entry('object with listOf', `object NoteCatalog {
  val defaults = listOf("draft", "done")
}`),
  entry('class private set', `class Counter {
  var value: Int = 0
    private set
}`),
  entry('property delegate lazy map', `class Settings {
  val values by lazy { mapOf("theme" to "light") }
}`),
  entry('enum when exhaustive', `enum class Role {
  Reader,
  Editor,
}

fun permissions(role: Role): Int = when (role) {
  Role.Reader -> 1
  Role.Editor -> 2
}`),
  entry('sealed object branches', `sealed class SyncMode {
  data object Fast : SyncMode()
  data object Full : SyncMode()
}`),
  entry('extension nullable receiver', `fun String?.orDraft(): String {
  return this ?: "draft"
}`),
  entry('operator function plus', `data class Vector(val x: Int, val y: Int) {
  operator fun plus(other: Vector): Vector {
    return Vector(x + other.x, y + other.y)
  }
}`),
  entry('infix function', `class QueryBuilder {
  infix fun field(name: String): String {
    return name
  }
}`),
  entry('tailrec factorial', `tailrec fun factorial(value: Int, acc: Int = 1): Int {
  return if (value <= 1) acc else factorial(value - 1, acc * value)
}`),
  entry('suspend extension function', `suspend fun String.persist(): String {
  return lowercase()
}`),
  entry('android package import', `package app.mobile

import androidx.lifecycle.ViewModel

class NoteViewModel : ViewModel() {
  val title = "draft"
}`),
  entry('ktor package import', `package app.http

import io.ktor.http.HttpStatusCode

fun ok(): HttpStatusCode {
  return HttpStatusCode.OK
}`),
  entry('java time import', `package app.time

import java.time.Instant

fun now(): Instant {
  return Instant.now()
}`),
  entry('mutable list inference', `class Feed {
  val items = mutableListOf("a", "b")
}`),
  entry('map of literal', `fun states(): Map<String, Int> {
  return mapOf("draft" to 1, "done" to 2)
}`),
  entry('set of literal', `fun roles(): Set<String> {
  return setOf("reader", "editor")
}`),
  entry('empty list function', `fun emptyNames(): List<String> {
  return emptyList()
}`),
  entry('first or null chain', `fun firstReady(values: List<String>): String? {
  return values.firstOrNull { it.isNotBlank() }
}`),
  entry('get or null usage', `fun first(values: List<String>): String? {
  return values.getOrNull(0)
}`),
  entry('coroutine launch string', `import kotlinx.coroutines.launch
import kotlinx.coroutines.coroutineScope

suspend fun emit(value: String) {
  coroutineScope {
    launch {
      println("$value")
    }
  }
}`),
  entry('async block', `import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

suspend fun compute(): String {
  return coroutineScope {
    async { "ok" }.await()
  }
}`),
  entry('class init block', `class Draft(title: String) {
  val label: String

  init {
    label = title.trim()
  }
}`),
  entry('secondary constructor', `class User {
  val id: String

  constructor(id: String) {
    this.id = id
  }
}`),
  entry('companion const val', `class Routes {
  companion object {
    const val Notes = "/notes"
  }
}`),
  entry('object nullable property', `object CurrentNote {
  var id: String? = null
}`),
  entry('safe cast as', `fun title(value: Any): String? {
  return (value as? Note)?.title
}`),
  entry('when sealed interface', `sealed interface Result {
  data class Ok(val value: String) : Result
  data class Error(val message: String) : Result
}

fun label(result: Result): String = when (result) {
  is Result.Ok -> result.value
  is Result.Error -> result.message
}`),
  entry('for each lambda', `fun printAll(values: List<String>) {
  values.forEach { value ->
    println(value)
  }
}`),
  entry('fold aggregation', `fun total(values: List<Int>): Int {
  return values.fold(0) { acc, value -> acc + value }
}`),
  entry('group by lambda', `fun grouped(values: List<String>): Map<Int, List<String>> {
  return values.groupBy { it.length }
}`),
  entry('associate lambda', `fun indexed(values: List<String>): Map<String, Int> {
  return values.associate { it to it.length }
}`),
  entry('filter not null chain', `fun titles(values: List<String?>): List<String> {
  return values.filterNotNull().map { it.lowercase() }
}`),
  entry('mutable state of property', `class EditorState {
  val title = mutableStateOf("draft")
}`),
  entry('data object loading', `sealed interface PageState {
  data object Loading : PageState
  data object Ready : PageState
}`),
  entry('companion generic factory', `class Envelope<T>(val value: T) {
  companion object {
    fun <T> of(value: T): Envelope<T> {
      return Envelope(value)
    }
  }
}`),
  entry('object cache map', `object MemoStore {
  val values = mutableMapOf<String, String>()
}`),
  entry('enum property function', `enum class Accent(val code: String) {
  Blue("#0ea5e9"),
  Green("#22c55e");

  fun value(): String {
    return code
  }
}`),
  entry('interface override val', `interface HasTitle {
  val title: String
}

class NoteTitle(override val title: String) : HasTitle`),
  entry('reified cast helper', `inline fun <reified T> Any.castOrNull(): T? {
  return this as? T
}`),
  entry('nullable generic return', `fun <T> firstValue(values: List<T>): T? {
  return values.firstOrNull()
}`),
  entry('top level property and function', `val defaultTitle = "draft"

fun title(): String {
  return defaultTitle
}`),
  entry('typealias function type', `typealias Formatter = (String) -> String`),
  entry('fun interface consumer', `fun interface Consumer {
  fun accept(value: String)
}`),
  entry('object with when', `object Severity {
  fun label(level: Int): String = when (level) {
    0 -> "low"
    else -> "high"
  }
}`),
  entry('package import object config', `package app.config

import kotlin.collections.Map

object Flags {
  val values: Map<String, Boolean> = mapOf("sync" to true)
}`),
  entry('type alias model map', `typealias Counters = MutableMap<String, Int>`),
  entry('nullable property class', `class Message {
  var subtitle: String? = null
}`),
  entry('list of numbers top level', `val counters = listOf(1, 2, 3)`),
  entry('take unless helper', `fun visible(value: String): String? {
  return value.takeUnless { it.isBlank() }
}`),
];
