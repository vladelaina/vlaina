import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type SidebarMode = 'files' | 'outline';
type VariantId =
  | 'header-ghost'
  | 'header-pair'
  | 'search-tail'
  | 'section-label'
  | 'content-seam'
  | 'footer-whisper';

interface VariantDefinition {
  id: VariantId;
  name: string;
  note: string;
  verdict: string;
}

const VARIANTS: VariantDefinition[] = [
  {
    id: 'header-ghost',
    name: 'Header Ghost',
    note: '放在顶部右侧，但不做按钮感，只保留极轻的图标切换。',
    verdict: '最克制，但发现性仍然偏弱，更像熟悉后使用的入口。'
  },
  {
    id: 'header-pair',
    name: 'Header Pair',
    note: '顶部右侧直接放 Files / Outline 两个词，只有文字权重变化。',
    verdict: '比图标清楚，但仍然低调，比较像原生面板模式切换。'
  },
  {
    id: 'search-tail',
    name: 'Search Tail',
    note: '把模式切换吸收到搜索条右端，让顶部保持完全安静。',
    verdict: '整体很顺，但会让一部分用户把它理解成搜索过滤器。'
  },
  {
    id: 'section-label',
    name: 'Section Label',
    note: '直接让区块标题承担切换角色，不额外制造新控件。',
    verdict: '语义最自然，视觉负担很低，是我这一轮最看好的方向。'
  },
  {
    id: 'content-seam',
    name: 'Content Seam',
    note: '把切换放到内容头部右侧，像一个非常轻的局部开关。',
    verdict: '平衡很好，存在感足够低，又比顶部方案更贴近内容本身。'
  },
  {
    id: 'footer-whisper',
    name: 'Footer Whisper',
    note: '沉到最底部，只作为一个安静的辅助入口。',
    verdict: '视觉最干净，但大概率还是会过于隐蔽。'
  }
];

const FILE_ITEMS = [
  { name: 'Brand positioning', meta: 'Pinned' },
  { name: 'Cover interaction notes', meta: 'Today' },
  { name: 'Motion references', meta: 'Yesterday' },
  { name: 'Launch writing draft', meta: 'Mar 20' },
];

const OUTLINE_ITEMS = [
  'Overview',
  'Visual direction',
  'Spacing & motion',
  'Sidebar experiments',
  'Open questions',
];

function ModeTextPair({
  mode,
  onChange,
  subtle = false,
  compact = false,
}: {
  mode: SidebarMode;
  onChange: (mode: SidebarMode) => void;
  subtle?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-1.5' : 'gap-2')}>
      {([
        ['files', 'Files'],
        ['outline', 'Outline'],
      ] as const).map(([value, label]) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              'transition-colors',
              compact ? 'text-[10px]' : 'text-[11px]',
              subtle ? 'font-medium' : 'font-semibold',
              active ? 'text-[#3c3c3c]' : 'text-[#a4a4a4] hover:text-[#737373]'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FilesView() {
  return (
    <div className="flex flex-col gap-0.5">
      {FILE_ITEMS.map((item, index) => (
        <button
          key={item.name}
          type="button"
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
            index === 1 ? 'bg-[#f5f5f5]' : 'hover:bg-[#f7f7f7]'
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8c8c8c]">
            <Icon name="file.text" size="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-[#3f3f3f]">{item.name}</span>
            <span className="block truncate text-[10px] text-[#9a9a9a]">{item.meta}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function OutlineView() {
  return (
    <div className="flex flex-col gap-0.5">
      {OUTLINE_ITEMS.map((item, index) => (
        <button
          key={item}
          type="button"
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
            index === 3 ? 'bg-[#f5f5f5]' : 'hover:bg-[#f7f7f7]'
          )}
        >
          <span className="w-5 text-right text-[10px] font-medium text-[#a4a4a4]">{index + 1}</span>
          <span className="truncate text-[12px] font-medium text-[#3f3f3f]">{item}</span>
        </button>
      ))}
    </div>
  );
}

function SidebarPreview({ variant }: { variant: VariantDefinition }) {
  const [mode, setMode] = useState<SidebarMode>('files');

  return (
    <div className="rounded-[24px] border border-[#e8e8e8] bg-white p-2 shadow-[0_12px_36px_rgba(0,0,0,0.04)]">
      <div className="flex h-[560px] flex-col overflow-hidden rounded-[20px] border border-[#efefef] bg-[#fbfbfb]">
        <div className="flex items-center gap-3 border-b border-[#efefef] px-3 py-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ececec] text-[11px] font-semibold text-[#595959]">
            V
            <span className="absolute -right-[5px] bottom-[1px] text-[#8f8f8f]">
              <Icon name="nav.chevronDown" size="xs" className="h-[9px] w-[9px]" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-[#3f3f3f]">Vladelaina</div>
            <div className="truncate text-[10px] text-[#a1a1a1]">Notes workspace</div>
          </div>

          {variant.id === 'header-ghost' ? (
            <button
              type="button"
              onClick={() => setMode(mode === 'files' ? 'outline' : 'files')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#a3a3a3] transition-colors hover:text-[#5f5f5f]"
            >
              <Icon name={mode === 'files' ? 'common.list' : 'file.folderOpen'} size="sm" />
            </button>
          ) : null}

          {variant.id === 'header-pair' ? (
            <ModeTextPair mode={mode} onChange={setMode} subtle />
          ) : null}

          {variant.id !== 'header-ghost' && variant.id !== 'header-pair' ? (
            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-[#a3a3a3] transition-colors hover:text-[#5f5f5f]">
              <Icon name="common.search" size="sm" />
            </button>
          ) : null}
        </div>

        <div className="border-b border-[#f1f1f1] px-2 py-1.5">
          <button
            type="button"
            className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#6f6f6f] transition-colors hover:bg-[#f3f3f3]"
          >
            <Icon name="common.sparkle" size="md" className="text-[#8d8d8d]" />
            <span className="truncate">Chat</span>
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#ececec] bg-white px-3 py-2 text-[#a0a0a0]">
            <Icon name="common.search" size="sm" />
            <span className="min-w-0 flex-1 text-[12px]">Search notes...</span>

            {variant.id === 'search-tail' ? (
              <div className="flex items-center gap-1 border-l border-[#ededed] pl-2">
                <button
                  type="button"
                  onClick={() => setMode('files')}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    mode === 'files' ? 'text-[#4a4a4a]' : 'text-[#b1b1b1] hover:text-[#7a7a7a]'
                  )}
                >
                  F
                </button>
                <button
                  type="button"
                  onClick={() => setMode('outline')}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    mode === 'outline' ? 'text-[#4a4a4a]' : 'text-[#b1b1b1] hover:text-[#7a7a7a]'
                  )}
                >
                  O
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-3">
          <div className="flex items-center justify-between px-2 pb-2">
            {variant.id === 'section-label' ? (
              <button
                type="button"
                onClick={() => setMode(mode === 'files' ? 'outline' : 'files')}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8f8f] transition-colors hover:text-[#5f5f5f]"
              >
                <span>{mode === 'files' ? 'Files' : 'Outline'}</span>
                <Icon name="nav.chevronDown" size="xs" className="h-3 w-3" />
              </button>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a9a9a]">
                {mode === 'files' ? 'Files' : 'Outline'}
              </span>
            )}

            {variant.id === 'content-seam' ? (
              <ModeTextPair mode={mode} onChange={setMode} compact />
            ) : (
              <span className="text-[10px] text-[#b0b0b0]">
                {mode === 'files' ? '4 notes' : '5 headings'}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-[18px] bg-[#fcfcfc] px-1 py-1">
            {mode === 'files' ? <FilesView /> : <OutlineView />}
          </div>
        </div>

        {variant.id === 'footer-whisper' ? (
          <div className="flex items-center justify-end border-t border-[#f0f0f0] px-3 py-2">
            <ModeTextPair mode={mode} onChange={setMode} compact subtle />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VariantCard({ variant }: { variant: VariantDefinition }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1 px-1">
        <h3 className="text-[16px] font-semibold tracking-tight text-[#2d2d2d]">{variant.name}</h3>
        <p className="text-[13px] leading-6 text-[#7a7a7a]">{variant.note}</p>
      </div>
      <SidebarPreview variant={variant} />
      <p className="px-1 text-[12px] leading-6 text-[#6a6a6a]">{variant.verdict}</p>
    </div>
  );
}

export function NotesSidebarModeLab() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-12 pb-24 pt-8">
      <div className="rounded-[28px] border border-[#e9e9e9] bg-white px-8 py-8 shadow-[0_12px_36px_rgba(0,0,0,0.03)]">
        <div className="flex max-w-4xl flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ececec] bg-[#fafafa] px-3 py-1 text-[11px] font-medium text-[#727272]">
            <Icon name="misc.lab" size="sm" />
            Notes Sidebar Modes
          </div>
          <div>
            <h2 className="text-[34px] font-semibold tracking-[-0.03em] text-[#222222]">
              更轻一点的 Files / Outline 入口
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#707070]">
              这一轮我把方向收紧了，不再做有按钮感的方案，而是只看更隐性的表达方式。重点不是“放哪最显眼”，而是“放哪既能被注意到，又不破坏侧边栏现在的安静气质”。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-14 xl:grid-cols-2">
        {VARIANTS.map((variant) => (
          <VariantCard key={variant.id} variant={variant} />
        ))}
      </div>
    </div>
  );
}
