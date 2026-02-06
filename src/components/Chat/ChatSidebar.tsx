import { useState } from 'react';
import { MdAdd, MdMoreVert, MdEdit, MdDelete } from 'react-icons/md';

interface ChatSidebarProps {
  isPeeking?: boolean;
}

export function ChatSidebar({ isPeeking = false }: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<'assistants' | 'topics'>('assistants');

  return (
    <div className={`h-full flex flex-col bg-[var(--neko-bg-primary)] ${isPeeking ? 'opacity-95' : ''}`}>
      {/* Tab Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-3 py-2 gap-1">
        <button
          onClick={() => setActiveTab('assistants')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative ${
            activeTab === 'assistants'
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          助手
          {activeTab === 'assistants' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('topics')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative ${
            activeTab === 'topics'
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          话题
          {activeTab === 'topics' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Action Bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
          <MdAdd className="w-4 h-4" />
          {activeTab === 'assistants' ? '新建助手' : '新建话题'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'assistants' ? (
          <>
            <AssistantItem
              name="默认助手"
              description="通用对话助手"
              isActive={true}
            />
            <AssistantItem
              name="代码助手"
              description="专注于编程问题"
              isActive={false}
            />
            <AssistantItem
              name="写作助手"
              description="帮助改进文本"
              isActive={false}
            />
          </>
        ) : (
          <>
            <TopicItem
              title="新对话"
              time="刚刚"
              preview="你好，有什么可以帮助你的吗？"
              isActive={true}
            />
            <TopicItem
              title="关于 React Hooks"
              time="2小时前"
              preview="useEffect 的依赖数组应该..."
              isActive={false}
            />
            <TopicItem
              title="项目规划讨论"
              time="昨天"
              preview="我们需要考虑以下几个方面..."
              isActive={false}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface AssistantItemProps {
  name: string;
  description: string;
  isActive: boolean;
}

function AssistantItem({ name, description, isActive }: AssistantItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            {description}
          </div>
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <MdMoreVert className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}

interface TopicItemProps {
  title: string;
  time: string;
  preview: string;
  isActive: boolean;
}

function TopicItem({ title, time, preview, isActive }: TopicItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
          {title}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <MdEdit className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded">
            <MdDelete className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {time}
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
        {preview}
      </div>
    </div>
  );
}
