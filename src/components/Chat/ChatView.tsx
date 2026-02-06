export function ChatView() {
  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-zinc-800">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">💬</div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              开始对话
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              选择一个助手或创建新的对话主题
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <textarea
              placeholder="输入消息..."
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            >
              发送
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              📎 附件
            </button>
            <span>·</span>
            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              🔍 搜索
            </button>
            <span>·</span>
            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              🧠 知识库
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
