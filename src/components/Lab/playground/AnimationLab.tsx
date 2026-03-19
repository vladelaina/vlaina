import { cn } from '@/lib/utils';

type DropdownVariant = {
  id: string;
  name: string;
  description: string;
  shellClassName: string;
  editorClassName: string;
  triggerClassName: string;
  menuClassName: string;
  sectionTitleClassName: string;
  itemClassName: string;
  badgeClassName: string;
  chrome: 'flat' | 'split' | 'chip' | 'inline' | 'stacked';
};

const variantDefs = [
  ['paper-key', 'Paper Key', '最克制的白底细边框。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-100 text-neutral-500', 'flat'],
  ['soft-pop', 'Soft Pop', '更柔和，像苹果菜单的轻弹层。', 'bg-[linear-gradient(180deg,#ffffff,#fbfbfc)]', 'border border-neutral-200/80 bg-white rounded-[20px]', 'border border-neutral-200/80 bg-white shadow-[0_8px_16px_rgba(15,23,42,0.03)] text-neutral-800', 'border border-white bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-100 text-neutral-500', 'flat'],
  ['ink-pill', 'Ink Pill', '黑色触发器，白色菜单。', 'bg-white', 'border border-neutral-200 bg-white', 'bg-neutral-950 text-white', 'border border-neutral-200 bg-white shadow-[0_20px_38px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-950 text-white', 'chip'],
  ['glass-fold', 'Glass Fold', '轻玻璃感，但不花哨。', 'bg-[linear-gradient(180deg,#ffffff,#f5f6f8)]', 'border border-white/90 bg-white/90 backdrop-blur-sm', 'border border-white bg-white/85 text-neutral-800 backdrop-blur-sm', 'border border-white bg-white/92 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-md', 'text-neutral-400', 'hover:bg-white text-neutral-700', 'bg-white text-neutral-500', 'flat'],
  ['compact-slate', 'Compact Slate', '更像紧凑工具条控件。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-neutral-50 text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.05)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-200 text-neutral-600', 'inline'],
  ['split-rail', 'Split Rail', '左分类右列表，层级清晰。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-950 text-white', 'split'],
  ['note-sheet', 'Note Sheet', '像记事卡片里的内嵌选择器。', 'bg-[#fbfaf8]', 'border border-[#e9e4da] bg-[#fffdfa]', 'border border-[#e7e2d8] bg-[#fffdfa] text-neutral-800', 'border border-[#e7e2d8] bg-[#fffdfa] shadow-[0_16px_34px_rgba(60,40,20,0.08)]', 'text-[#b1a796]', 'hover:bg-[#faf6ef] text-neutral-800', 'bg-[#f1ede4] text-[#6b6256]', 'flat'],
  ['mono-shelf', 'Mono Shelf', '黑白灰纯净分层。', 'bg-white', 'border border-neutral-300 bg-white', 'border border-neutral-300 bg-white text-neutral-900', 'border border-neutral-300 bg-white shadow-[0_18px_32px_rgba(24,24,27,0.06)]', 'text-neutral-500', 'hover:bg-neutral-100 text-neutral-900', 'bg-neutral-900 text-white', 'flat'],
  ['editor-chip', 'Editor Chip', '像正文里的智能标签展开。', 'bg-white', 'border border-neutral-200 bg-white', 'bg-white text-neutral-800 border border-neutral-200', 'border border-neutral-200 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.06)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-emerald-50 text-emerald-700', 'chip'],
  ['quiet-float', 'Quiet Float', '空间感更强，但仍然很轻。', 'bg-[linear-gradient(180deg,#fff,#f8f8fa)]', 'border border-neutral-200/80 bg-white', 'border border-neutral-200/80 bg-white text-neutral-800', 'border border-neutral-200/80 bg-white shadow-[0_24px_46px_rgba(15,23,42,0.09)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-100 text-neutral-500', 'flat'],
  ['slim-inline', 'Slim Inline', '像文本下的一条内联扩展。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_12px_22px_rgba(15,23,42,0.05)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-950 text-white', 'inline'],
  ['pearl-menu', 'Pearl Menu', '更圆、更润，按钮感更明显。', 'bg-white', 'border border-neutral-200/80 bg-white rounded-[24px]', 'border border-neutral-200 bg-white text-neutral-800 rounded-full', 'border border-white bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] rounded-[22px]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800 rounded-[14px]', 'bg-neutral-100 text-neutral-600 rounded-full', 'flat'],
  ['grid-signal', 'Grid Signal', '强调分类块面。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-blue-50 text-blue-700', 'split'],
  ['calm-stack', 'Calm Stack', '更像顶部选择头，下面静态展开。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-100 text-neutral-500', 'stacked'],
  ['ink-underline', 'Ink Underline', '用底部高亮线强调当前项。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.07)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-900 text-white', 'inline'],
  ['card-slot', 'Card Slot', '像一张被抽出来的小卡。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-900', 'border border-neutral-200 bg-white shadow-[0_22px_46px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-amber-50 text-amber-700', 'flat'],
  ['ash-sheet', 'Ash Sheet', '灰白层次更稳重。', 'bg-[#f7f7f8]', 'border border-[#e6e6e8] bg-white', 'border border-[#e6e6e8] bg-[#fbfbfc] text-neutral-800', 'border border-[#e6e6e8] bg-white shadow-[0_14px_26px_rgba(15,23,42,0.05)]', 'text-neutral-400', 'hover:bg-[#f5f5f6] text-neutral-800', 'bg-[#ededf0] text-[#666a73]', 'flat'],
  ['focus-chip', 'Focus Chip', '触发器更像 AI 功能芯片。', 'bg-white', 'border border-neutral-200 bg-white', 'bg-neutral-950 text-white', 'border border-neutral-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-emerald-50 text-emerald-700', 'chip'],
  ['quiet-grid', 'Quiet Grid', '右侧选项更规整。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.07)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-100 text-neutral-500', 'split'],
  ['air-pocket', 'Air Pocket', '四周留白更大，更高级。', 'bg-[linear-gradient(180deg,#ffffff,#fafafa)]', 'border border-neutral-200/80 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_26px_54px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-100 text-neutral-500', 'flat'],
  ['sidebar-choice', 'Sidebar Choice', '左边导航像系统设置。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_20px_38px_rgba(15,23,42,0.08)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-900 text-white', 'split'],
  ['editor-drawer', 'Editor Drawer', '像编辑器里抽出的轻抽屉。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-neutral-50 text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-violet-50 text-violet-700', 'stacked'],
  ['calm-tab', 'Calm Tab', '分类像小标签页。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.07)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-950 text-white', 'split'],
  ['frost-chip', 'Frost Chip', '非常轻的 frosted 感。', 'bg-[linear-gradient(180deg,#fff,#f6f7fa)]', 'border border-white bg-white/90 backdrop-blur-sm', 'border border-white bg-white/80 text-neutral-800 backdrop-blur-sm', 'border border-white bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.09)] backdrop-blur-md', 'text-neutral-400', 'hover:bg-white text-neutral-800', 'bg-white text-neutral-500', 'chip'],
  ['stone-list', 'Stone List', '更偏列表感，密度适中。', 'bg-white', 'border border-neutral-300 bg-white', 'border border-neutral-300 bg-white text-neutral-900', 'border border-neutral-300 bg-white shadow-[0_16px_30px_rgba(24,24,27,0.06)]', 'text-neutral-500', 'hover:bg-neutral-100 text-neutral-900', 'bg-neutral-200 text-neutral-700', 'flat'],
  ['language-board', 'Language Board', '语言选择感更强。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_18px_34px_rgba(15,23,42,0.07)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-sky-50 text-sky-700', 'split'],
  ['quiet-mono', 'Quiet Mono', '信息很少，黑灰白最纯。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_14px_26px_rgba(15,23,42,0.05)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-950 text-white', 'inline'],
  ['paper-tab', 'Paper Tab', '纸片标签展开的感觉。', 'bg-[#fcfbf8]', 'border border-[#e9e4da] bg-[#fffdfa]', 'border border-[#e7e2d8] bg-[#fffdfa] text-neutral-800', 'border border-[#e7e2d8] bg-[#fffdfa] shadow-[0_16px_34px_rgba(60,40,20,0.08)]', 'text-[#b1a796]', 'hover:bg-[#faf6ef] text-neutral-800', 'bg-[#f1ede4] text-[#6b6256]', 'split'],
  ['smart-sheet', 'Smart Sheet', '更像 AI 智能菜单。', 'bg-white', 'border border-neutral-200 bg-white', 'bg-neutral-950 text-white', 'border border-neutral-200 bg-white shadow-[0_22px_42px_rgba(15,23,42,0.09)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-emerald-50 text-emerald-700', 'stacked'],
  ['thread-panel', 'Thread Panel', '像消息线程里的轻选择器。', 'bg-white', 'border border-neutral-200 bg-white', 'border border-neutral-200 bg-white text-neutral-800', 'border border-neutral-200 bg-white shadow-[0_18px_34px_rgba(15,23,42,0.07)]', 'text-neutral-400', 'hover:bg-neutral-50 text-neutral-800', 'bg-neutral-100 text-neutral-500', 'stacked'],
] as const satisfies readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  DropdownVariant['chrome']
][];

const dropdownVariants: DropdownVariant[] = variantDefs.map(
  ([
    id,
    name,
    description,
    shellClassName,
    editorClassName,
    triggerClassName,
    menuClassName,
    sectionTitleClassName,
    itemClassName,
    badgeClassName,
    chrome,
  ]) => ({
    id,
    name,
    description,
    shellClassName,
    editorClassName,
    triggerClassName,
    menuClassName,
    sectionTitleClassName,
    itemClassName,
    badgeClassName,
    chrome,
  })
);

const translateItems = ['English', 'Japanese', 'French'];
const actionItems = ['Polish', 'Fix grammar', 'Shorten'];

function TriggerRow({ variant }: { variant: DropdownVariant }) {
  return (
    <div
      className={cn(
        'inline-flex h-10 min-w-[220px] items-center justify-between gap-3 rounded-[14px] px-3.5 text-[13px] font-medium shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]',
        variant.triggerClassName
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold', variant.badgeClassName)}>
          AI
        </span>
        <span>Translate</span>
      </div>
      <span className="text-[12px] text-neutral-400">v</span>
    </div>
  );
}

function CategoryColumn({ variant }: { variant: DropdownVariant }) {
  return (
    <div className="grid gap-1.5">
      {['Translate', 'Actions', 'Tone'].map((label, index) => (
        <div
          key={label}
          className={cn(
            'flex h-9 items-center justify-between rounded-[12px] px-3 text-[12px] font-medium',
            index === 0 ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-50',
            variant.chrome === 'chip' && index === 0 ? 'rounded-full' : ''
          )}
        >
          <span>{label}</span>
          <span className={cn('text-[12px]', index === 0 ? 'text-white/70' : 'text-neutral-400')}>›</span>
        </div>
      ))}
    </div>
  );
}

function OptionList({ variant, title, items }: { variant: DropdownVariant; title: string; items: string[] }) {
  return (
    <div className="grid gap-1.5">
      <div className={cn('px-1 text-[10px] font-semibold uppercase tracking-[0.16em]', variant.sectionTitleClassName)}>
        {title}
      </div>
      {items.map((item, index) => (
        <div
          key={item}
          className={cn(
            'flex h-9 items-center justify-between rounded-[12px] px-3 text-[12px] transition-colors',
            index === 0 ? 'bg-neutral-50 text-neutral-900' : '',
            variant.itemClassName
          )}
        >
          <span>{item}</span>
          {index === 0 ? <span className="text-[10px] text-neutral-400">Return</span> : null}
        </div>
      ))}
    </div>
  );
}

function MenuBody({ variant }: { variant: DropdownVariant }) {
  if (variant.chrome === 'split') {
    return (
      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3">
        <CategoryColumn variant={variant} />
        <OptionList variant={variant} title="Translate" items={translateItems} />
      </div>
    );
  }

  if (variant.chrome === 'inline') {
    return (
      <div className="grid gap-3">
        <div className="flex gap-2">
          {['Translate', 'Actions', 'Tone'].map((label, index) => (
            <div
              key={label}
              className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-[11px] font-medium',
                index === 0 ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'
              )}
            >
              {label}
            </div>
          ))}
        </div>
        <OptionList variant={variant} title="Languages" items={translateItems} />
      </div>
    );
  }

  if (variant.chrome === 'stacked') {
    return (
      <div className="grid gap-3">
        <OptionList variant={variant} title="Translate" items={translateItems} />
        <OptionList variant={variant} title="Actions" items={actionItems} />
      </div>
    );
  }

  if (variant.chrome === 'chip') {
    return (
      <div className="grid gap-3">
        <div className="flex gap-2">
          {['Translate', 'Actions', 'Tone'].map((label, index) => (
            <div
              key={label}
              className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-[11px] font-medium',
                index === 0 ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'
              )}
            >
              {label}
            </div>
          ))}
        </div>
        <OptionList variant={variant} title="Languages" items={translateItems} />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <OptionList variant={variant} title="Translate" items={translateItems} />
    </div>
  );
}

function VariantCard({ variant, index }: { variant: DropdownVariant; index: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-mono font-bold text-neutral-500">
          {index}
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-neutral-900">{variant.name}</h3>
          <p className="mt-1 text-[12px] leading-5 text-neutral-500">{variant.description}</p>
        </div>
      </div>

      <div className={cn('rounded-[24px] border p-5', variant.shellClassName)}>
        <div className="mx-auto grid max-w-[780px] gap-4">
          <div className={cn('rounded-[20px] p-5', variant.editorClassName)}>
            <div className="mb-3 text-[13px] leading-7 text-neutral-700">
              Highlight a sentence, open AI, then choose a language or action from the dropdown.
            </div>
            <TriggerRow variant={variant} />
            <div className={cn('mt-3 rounded-[18px] p-3.5', variant.menuClassName)}>
              <MenuBody variant={variant} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnimationLab() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Dropdown Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          Thirty dropdown directions for language and AI command selection
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          This pass only studies the dropdown control itself: trigger, category structure, menu density, and option presentation for things like translation language and AI actions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {dropdownVariants.map((variant, index) => (
          <VariantCard key={variant.id} variant={variant} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
