import type { HandcraftedLanguageCase } from './languageDetectionHandcrafted';

export const handcraftedRubyCases: readonly HandcraftedLanguageCase[] = [
  {
    name: 'gem require markdown render',
    sample: `require 'redcarpet'
markdown = Redcarpet.new("Hello World!")
puts markdown.to_html`,
  },
  {
    name: 'require relative service object',
    sample: `require_relative 'services/report_builder'

builder = ReportBuilder.new(user)
puts builder.call`,
  },
  {
    name: 'module class shell',
    sample: `module Billing
  class Invoice
  end
end`,
  },
  {
    name: 'attr reader initializer',
    sample: `class NotePresenter
  attr_reader :note

  def initialize(note)
    @note = note
  end
end`,
  },
  {
    name: 'attr accessor with keyword setup',
    sample: `class SessionConfig
  attr_accessor :timeout

  def initialize(timeout: 30)
    @timeout = timeout
  end
end`,
  },
  {
    name: 'rails scope recent',
    sample: `class Note < ApplicationRecord
  scope :recent, -> { order(created_at: :desc) }
end`,
  },
  {
    name: 'rails associations',
    sample: `class Project < ApplicationRecord
  has_many :tasks, dependent: :destroy
  belongs_to :owner
end`,
  },
  {
    name: 'rails validations',
    sample: `class User < ApplicationRecord
  validates :email, presence: true, uniqueness: true
end`,
  },
  {
    name: 'rails callback',
    sample: `class Profile < ApplicationRecord
  before_save :normalize_name
end`,
  },
  {
    name: 'rails after commit job',
    sample: `class Export < ApplicationRecord
  after_commit :enqueue_delivery
end`,
  },
  {
    name: 'block each puts',
    sample: `items.each do |item|
  puts item
end`,
  },
  {
    name: 'map symbol proc',
    sample: `names = users.map(&:name)
puts names.join(', ')`,
  },
  {
    name: 'select active users',
    sample: `active_users = users.select { |user| user.active? }
puts active_users.count`,
  },
  {
    name: 'legacy hash rocket',
    sample: `options = { :status => :draft, :public => true }
puts options[:status]`,
  },
  {
    name: 'keyword hash style',
    sample: `payload = { status: :published, retries: 3 }
puts payload[:status]`,
  },
  {
    name: 'case when branch',
    sample: `case status
when :draft
  puts 'draft'
when :published
  puts 'published'
end`,
  },
  {
    name: 'begin rescue ensure',
    sample: `begin
  process!
rescue StandardError => error
  warn error.message
ensure
  cleanup
end`,
  },
  {
    name: 'file read lines',
    sample: `content = File.read('notes.txt')
puts content.lines.first`,
  },
  {
    name: 'json parse payload',
    sample: `require 'json'
payload = JSON.parse(response.body)
puts payload['title']`,
  },
  {
    name: 'net http get',
    sample: `require 'net/http'
body = Net::HTTP.get(URI('https://example.com/health'))
puts body`,
  },
  {
    name: 'open struct title',
    sample: `require 'ostruct'
note = OpenStruct.new(title: 'Inbox Zero')
puts note.title`,
  },
  {
    name: 'struct value object',
    sample: `Note = Struct.new(:title, :archived)
entry = Note.new('Launch', false)
puts entry.title`,
  },
  {
    name: 'lambda formatter',
    sample: `formatter = ->(value) { value.strip.upcase }
puts formatter.call(' demo ')`,
  },
  {
    name: 'keyword arguments render',
    sample: `def render_card(title:, body:)
  "#{title}: #{body}"
end`,
  },
  {
    name: 'module function helper',
    sample: `module SlugHelper
  module_function

  def slugify(value)
    value.downcase.tr(' ', '-')
  end
end`,
  },
  {
    name: 'private helper methods',
    sample: `class Tokenizer
  def call(value)
    normalize(value)
  end

  private

  def normalize(value)
    value.strip
  end
end`,
  },
  {
    name: 'each with object index',
    sample: `counts = words.each_with_object(Hash.new(0)) do |word, memo|
  memo[word] += 1
end`,
  },
  {
    name: 'times loop',
    sample: `3.times do |index|
  puts index
end`,
  },
  {
    name: 'upto iteration',
    sample: `1.upto(3) do |value|
  puts value
end`,
  },
  {
    name: 'unless guard clause',
    sample: `puts 'ready' unless queue.empty?`,
  },
  {
    name: 'nil and empty checks',
    sample: `if note.nil? || note.title.empty?
  warn 'missing title'
end`,
  },
  {
    name: 'gemspec shell',
    sample: `Gem::Specification.new do |spec|
  spec.name = 'vlaina'
  spec.version = '0.1.0'
end`,
  },
  {
    name: 'rake task namespace',
    sample: `namespace :notes do
  task sync: :environment do
    puts 'syncing'
  end
end`,
  },
  {
    name: 'sinatra route',
    sample: `get '/health' do
  content_type :json
  { ok: true }.to_json
end`,
  },
  {
    name: 'sidekiq worker',
    sample: `class DigestJob
  include Sidekiq::Worker

  def perform(note_id)
    puts note_id
  end
end`,
  },
  {
    name: 'rspec example',
    sample: `RSpec.describe NotePresenter do
  it 'renders title' do
    expect(subject.call).to include('Launch')
  end
end`,
  },
  {
    name: 'minitest case',
    sample: `class NoteTest < Minitest::Test
  def test_title
    assert_equal 'demo', build_note.title
  end
end`,
  },
  {
    name: 'sorbet sig params',
    sample: `sig { params(title: String).returns(String) }
def normalize(title)
  title.strip
end`,
  },
  {
    name: 'singleton class methods',
    sample: `class Registry
  class << self
    def fetch(key)
      store[key]
    end
  end
end`,
  },
  {
    name: 'active support concern',
    sample: `module Sluggable
  extend ActiveSupport::Concern

  included do
    before_validation :assign_slug
  end
end`,
  },
  {
    name: 'service object call',
    sample: `class PublishNote
  def call(note)
    note.update!(published_at: Time.current)
  end
end`,
  },
  {
    name: 'pattern matching in hash',
    sample: `case payload
in { status: 'ok', data: }
  puts data
end`,
  },
  {
    name: 'safe navigation chain',
    sample: `puts user&.profile&.display_name`,
  },
  {
    name: 'env fetch default',
    sample: `port = ENV.fetch('APP_PORT', '3000')
puts port`,
  },
  {
    name: 'option parser flags',
    sample: `OptionParser.new do |opts|
  opts.on('--dry-run') { puts 'preview' }
end.parse!`,
  },
  {
    name: 'csv foreach rows',
    sample: `require 'csv'
CSV.foreach('notes.csv', headers: true) do |row|
  puts row['title']
end`,
  },
  {
    name: 'erb render binding',
    sample: `require 'erb'
template = ERB.new('Hello <%= name %>')
puts template.result(binding)`,
  },
  {
    name: 'date formatting',
    sample: `require 'date'
puts Date.today.strftime('%Y-%m-%d')`,
  },
  {
    name: 'time iso8601',
    sample: `require 'time'
puts Time.now.utc.iso8601`,
  },
  {
    name: 'uri parse host',
    sample: `require 'uri'
uri = URI.parse('https://example.com/notes')
puts uri.host`,
  },
  {
    name: 'set unique values',
    sample: `require 'set'
tags = Set.new(%w[inbox review done])
puts tags.include?('review')`,
  },
  {
    name: 'array new with block',
    sample: `values = Array.new(3) { |index| index * 2 }
puts values.inspect`,
  },
  {
    name: 'group by role',
    sample: `grouped = users.group_by { |user| user.role }
puts grouped.keys.inspect`,
  },
  {
    name: 'transform values hash',
    sample: `normalized = payload.transform_values { |value| value.to_s.strip }
puts normalized.inspect`,
  },
  {
    name: 'delegate macro',
    sample: `class Membership < ApplicationRecord
  delegate :email, to: :user
end`,
  },
  {
    name: 'scope published status',
    sample: `class Article < ApplicationRecord
  scope :published, -> { where(status: :published) }
end`,
  },
  {
    name: 'enum status mapping',
    sample: `class Article < ApplicationRecord
  enum status: { draft: 0, published: 1 }
end`,
  },
  {
    name: 'serialize json settings',
    sample: `class Preference < ApplicationRecord
  serialize :settings, JSON
end`,
  },
  {
    name: 'mailer class',
    sample: `class NoteMailer < ApplicationMailer
  def digest(user)
    mail(to: user.email, subject: 'Daily digest')
  end
end`,
  },
  {
    name: 'application job class',
    sample: `class CleanupJob < ApplicationJob
  queue_as :default

  def perform(note_id)
    Note.find(note_id).destroy!
  end
end`,
  },
  {
    name: 'perform later invocation',
    sample: `CleanupJob.perform_later(note.id)
puts 'queued'`,
  },
  {
    name: 'pathname join',
    sample: `require 'pathname'
root = Pathname.new('/tmp')
puts root.join('notes').to_s`,
  },
  {
    name: 'dir glob each',
    sample: `Dir.glob('app/models/*.rb').each do |file|
  puts file
end`,
  },
  {
    name: 'yaml load file',
    sample: `require 'yaml'
config = YAML.load_file('config/app.yml')
puts config['name']`,
  },
  {
    name: 'bundler require groups',
    sample: `require 'bundler/setup'
Bundler.require(:default, :development)
puts 'booted'`,
  },
  {
    name: 'rspec shared examples',
    sample: `RSpec.shared_examples 'a cacheable record' do
  it 'responds to cache_key' do
    expect(subject.cache_key).to be_present
  end
end`,
  },
  {
    name: 'factory bot definition',
    sample: `FactoryBot.define do
  factory :note do
    title { 'Launch' }
  end
end`,
  },
  {
    name: 'rspec let helper',
    sample: `RSpec.describe PublishNote do
  let(:note) { build(:note) }
end`,
  },
  {
    name: 'rspec subject helper',
    sample: `RSpec.describe PublishNote do
  subject(:service) { described_class.new }
end`,
  },
  {
    name: 'rspec around hook',
    sample: `RSpec.describe Note do
  around do |example|
    Timecop.freeze { example.run }
  end
end`,
  },
  {
    name: 'described class call',
    sample: `result = described_class.new.call(note)
expect(result).to be_truthy`,
  },
  {
    name: 'hash new default zero',
    sample: `counts = Hash.new(0)
counts[:draft] += 1`,
  },
  {
    name: 'memoization with or equals',
    sample: `def client
  @client ||= ApiClient.new
end`,
  },
  {
    name: 'public send invocation',
    sample: `field = :title
puts note.public_send(field)`,
  },
  {
    name: 'send private helper',
    sample: `record.send(:normalize_title)
puts record.title`,
  },
  {
    name: 'freeze constant array',
    sample: `STATUSES = %w[draft queued done].freeze
puts STATUSES.first`,
  },
  {
    name: 'heredoc sql body',
    sample: `sql = <<~SQL
  select id, title
  from notes
SQL
puts sql`,
  },
  {
    name: 'retry network request',
    sample: `attempts = 0
begin
  attempts += 1
  fetch_remote!
rescue Timeout::Error
  retry if attempts < 3
end`,
  },
  {
    name: 'thread spawn join',
    sample: `thread = Thread.new do
  puts 'syncing'
end
thread.join`,
  },
  {
    name: 'mutex synchronize',
    sample: `mutex = Mutex.new
mutex.synchronize do
  puts 'locked'
end`,
  },
  {
    name: 'queue push pop',
    sample: `queue = Queue.new
queue << 'job-1'
puts queue.pop`,
  },
  {
    name: 'open3 capture3',
    sample: `require 'open3'
stdout, stderr, status = Open3.capture3('ruby -v')
puts stdout if status.success?`,
  },
  {
    name: 'system bundle exec',
    sample: `system('bundle exec rspec')
puts 'done'`,
  },
  {
    name: 'abort missing token',
    sample: `abort('missing token') if ENV['API_TOKEN'].nil?`,
  },
  {
    name: 'warn deprecation message',
    sample: `warn('deprecated endpoint')
puts 'fallback'`,
  },
  {
    name: 'format interpolated string',
    sample: `name = 'vlaina'
puts format('hello %s', name)`,
  },
  {
    name: 'tap config block',
    sample: `config = {}.tap do |memo|
  memo[:retries] = 3
end`,
  },
  {
    name: 'yield if block given',
    sample: `def instrument
  yield(self) if block_given?
end`,
  },
  {
    name: 'define method dynamic',
    sample: `define_method(:published?) do
  status == 'published'
end`,
  },
  {
    name: 'class eval attr accessor',
    sample: `Note.class_eval do
  attr_accessor :summary
end`,
  },
  {
    name: 'prepend instrumentation',
    sample: `class ApiClient
  prepend RequestLogging
end`,
  },
  {
    name: 'include enumerable',
    sample: `class TagCollection
  include Enumerable

  def each(&block)
    tags.each(&block)
  end
end`,
  },
  {
    name: 'forwardable delegators',
    sample: `require 'forwardable'
class NotePresenter
  extend Forwardable
  def_delegators :note, :title, :archived?
end`,
  },
  {
    name: 'array compact blank reject',
    sample: `values = params[:tags].to_a.compact.reject(&:blank?)
puts values.inspect`,
  },
  {
    name: 'inject sum block',
    sample: `total = prices.inject(0) { |sum, price| sum + price }
puts total`,
  },
  {
    name: 'fetch with symbol default',
    sample: `state = payload.fetch(:state, :draft)
puts state`,
  },
  {
    name: 'dig nested hash',
    sample: `puts payload.dig(:meta, :title)`,
  },
  {
    name: 'reject bang cleanup',
    sample: `items.reject! { |item| item.archived? }
puts items.count`,
  },
  {
    name: 'map with index',
    sample: `labels = notes.map.with_index { |note, index| "#{index}: #{note.title}" }
puts labels.first`,
  },
  {
    name: 'sort by created at',
    sample: `sorted = notes.sort_by(&:created_at)
puts sorted.last.title`,
  },
  {
    name: 'zip two arrays',
    sample: `pairs = ids.zip(titles)
puts pairs.inspect`,
  },
  {
    name: 'regexp match question mark',
    sample: `if /note-\d+/.match?(slug)
  puts slug
end`,
  },
  {
    name: 'scan words',
    sample: `words = body.scan(/\w+/)
puts words.size`,
  },
  {
    name: 'sub and gsub chain',
    sample: `normalized = title.sub(/^\s+/, '').gsub(/\s+/, ' ')
puts normalized`,
  },
  {
    name: 'shellwords split command',
    sample: `require 'shellwords'
parts = Shellwords.split('bundle exec rake notes:sync')
puts parts.first`,
  },
  {
    name: 'pathname exist check',
    sample: `path = Pathname.new('tmp/cache')
puts path.exist?`,
  },
  {
    name: 'logger info message',
    sample: `logger.info("syncing #{note.id}")
puts 'logged'`,
  },
  {
    name: 'dry transaction style call',
    sample: `result = operation.call(input)
puts result.success?`,
  },
  {
    name: 'application record default scope',
    sample: `class Comment < ApplicationRecord
  default_scope { order(created_at: :asc) }
end`,
  },
  {
    name: 'delegate missing to object',
    sample: `class Wrapper
  delegate_missing_to :target
end`,
  },
  {
    name: 'active support blank present',
    sample: `if note.title.present?
  puts note.title
end`,
  },
  {
    name: 'constantize service name',
    sample: `service = "PublishNote".constantize.new
puts service.call(note)`,
  },
  {
    name: 'cache fetch block',
    sample: `Rails.cache.fetch("note/#{note.id}") do
  note.reload.attributes
end`,
  },
  {
    name: 'mailer deliver later',
    sample: `NoteMailer.digest(user).deliver_later
puts 'enqueued'`,
  },
  {
    name: 'application controller render json',
    sample: `class NotesController < ApplicationController
  def index
    render json: Note.recent
  end
end`,
  },
  {
    name: 'params require permit',
    sample: `def note_params
  params.require(:note).permit(:title, :body)
end`,
  },
  {
    name: 'helper number to human size',
    sample: `include ActiveSupport::NumberHelper
puts number_to_human_size(2048)`,
  },
  {
    name: 'erb trim mode',
    sample: `renderer = ERB.new(template, trim_mode: '-')
puts renderer.result(binding)`,
  },
  {
    name: 'pathname basename extname',
    sample: `path = Pathname.new('/tmp/report.csv')
puts [path.basename.to_s, path.extname].join(':')`,
  },
  {
    name: 'enum each pair',
    sample: `STATUSES.each_pair do |name, value|
  puts "#{name}=#{value}"
end`,
  },
];
