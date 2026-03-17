import { cn } from '@/lib/utils';

type ToolbarDropdownVariant = {
  id: string;
  name: string;
  description: string;
  stageClassName: string;
  toolbarClassName: string;
  triggerClassName: string;
  menuClassName: string;
  itemClassName: string;
  activeItemClassName: string;
  shortcutClassName: string;
  iconToneClassName: string;
};

const variantDefs = [
  ['notion-air', 'Notion Air', '最接近基础 Notion 感。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_18px_36px_rgba(15,23,42,0.08)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['soft-page', 'Soft Page', '更柔和一点，像页面内菜单。', 'bg-[linear-gradient(180deg,#ffffff,#fbfbfc)]', 'bg-white border border-neutral-200/80 shadow-[0_10px_26px_rgba(15,23,42,0.05)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200/80 shadow-[0_20px_40px_rgba(15,23,42,0.08)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['clean-stock', 'Clean Stock', '最普通、最稳。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_14px_28px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['paper-light', 'Paper Light', '像纸面上一层轻菜单。', 'bg-[#fcfbf8]', 'bg-[#fffdfa] border border-[#ebe5da] shadow-[0_8px_24px_rgba(60,40,20,0.05)]', 'bg-[#fffdfa] text-neutral-900 hover:bg-[#faf6ef]', 'bg-[#fffdfa] border border-[#ebe5da] shadow-[0_16px_30px_rgba(60,40,20,0.08)]', 'hover:bg-[#faf6ef] text-[#5f564b]', 'bg-[#f3eee6] text-[#4e463d]', 'text-[#b1a796]', 'text-[#b1a796]'],
  ['mono-sheet', 'Mono Sheet', '黑白灰纯净感。', 'bg-white', 'bg-white border border-neutral-300 shadow-[0_8px_22px_rgba(24,24,27,0.04)]', 'bg-white text-neutral-950 hover:bg-neutral-100', 'bg-white border border-neutral-300 shadow-[0_16px_30px_rgba(24,24,27,0.07)]', 'hover:bg-neutral-100 text-neutral-800', 'bg-neutral-100 text-neutral-950', 'text-neutral-500', 'text-neutral-500'],
  ['subtle-float', 'Subtle Float', '多一点悬浮感，但仍然简单。', 'bg-[linear-gradient(180deg,#ffffff,#fafafa)]', 'bg-white border border-neutral-200/80 shadow-[0_12px_28px_rgba(15,23,42,0.06)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200/80 shadow-[0_22px_42px_rgba(15,23,42,0.09)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['editor-note', 'Editor Note', '更像编辑器原生扩展菜单。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_18px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_14px_26px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['calm-panel', 'Calm Panel', '更平静，信息密度适中。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_18px_32px_rgba(15,23,42,0.07)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['ash-paper', 'Ash Paper', '偏灰一点，更现代。', 'bg-[#f7f7f8]', 'bg-white border border-[#e5e7eb] shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-[#fbfbfc] text-neutral-900 hover:bg-[#f5f5f6]', 'bg-white border border-[#e5e7eb] shadow-[0_16px_30px_rgba(15,23,42,0.06)]', 'hover:bg-[#f5f5f6] text-neutral-700', 'bg-[#ededf0] text-[#4b5563]', 'text-neutral-400', 'text-neutral-400'],
  ['silent-ui', 'Silent UI', '几乎没有设计噪音。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_6px_18px_rgba(15,23,42,0.03)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_12px_24px_rgba(15,23,42,0.05)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['quiet-block', 'Quiet Block', '像一小块系统菜单。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_16px_28px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['light-board', 'Light Board', '更轻，边框更淡。', 'bg-white', 'bg-white border border-neutral-200/70 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200/70 shadow-[0_16px_30px_rgba(15,23,42,0.07)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['tiny-shadow', 'Tiny Shadow', '阴影更少，几乎贴着界面。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_4px_12px_rgba(15,23,42,0.03)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_10px_18px_rgba(15,23,42,0.05)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['page-core', 'Page Core', '比较像真正会落地的版本。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_16px_32px_rgba(15,23,42,0.07)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['warm-paper', 'Warm Paper', '带一点暖纸张感。', 'bg-[#fdfcf9]', 'bg-[#fffefa] border border-[#ece7dd] shadow-[0_8px_24px_rgba(60,40,20,0.05)]', 'bg-[#fffefa] text-neutral-900 hover:bg-[#faf6ef]', 'bg-[#fffefa] border border-[#ece7dd] shadow-[0_16px_30px_rgba(60,40,20,0.07)]', 'hover:bg-[#faf6ef] text-[#5f564b]', 'bg-[#f3eee6] text-[#4e463d]', 'text-[#b1a796]', 'text-[#b1a796]'],
  ['simple-hover', 'Simple Hover', '重点只放在 hover 态。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_15px_30px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['flat-stock', 'Flat Stock', '更平、更薄。', 'bg-white', 'bg-white border border-neutral-200 shadow-none', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_10px_20px_rgba(15,23,42,0.04)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['rounded-soft', 'Rounded Soft', '圆角稍大一点。', 'bg-white', 'bg-white border border-neutral-200 rounded-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50 rounded-[10px]', 'bg-white border border-neutral-200 rounded-[20px] shadow-[0_18px_32px_rgba(15,23,42,0.07)]', 'hover:bg-neutral-50 text-neutral-700 rounded-[10px]', 'bg-neutral-50 text-neutral-900 rounded-[10px]', 'text-neutral-400', 'text-neutral-400'],
  ['quiet-system', 'Quiet System', '更有系统菜单气质。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_14px_28px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['soft-card', 'Soft Card', '像一张柔和的小卡片。', 'bg-[linear-gradient(180deg,#ffffff,#fbfbfc)]', 'bg-white border border-neutral-200/80 shadow-[0_10px_24px_rgba(15,23,42,0.05)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200/80 shadow-[0_18px_34px_rgba(15,23,42,0.08)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['library-menu', 'Library Menu', '有点像资源库里的菜单。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_16px_28px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['editor-air', 'Editor Air', '更轻盈，更编辑器原生。', 'bg-white', 'bg-white border border-neutral-200/80 shadow-[0_8px_18px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200/80 shadow-[0_14px_26px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['calm-focus', 'Calm Focus', '当前项稍微更显眼。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_16px_30px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-emerald-50 text-emerald-700', 'text-neutral-400', 'text-neutral-400'],
  ['thin-line', 'Thin Line', '边框更细，信息更轻。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_6px_16px_rgba(15,23,42,0.03)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_12px_22px_rgba(15,23,42,0.05)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['subtle-core', 'Subtle Core', '整体收得更紧。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_18px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_14px_26px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['paper-air', 'Paper Air', '纸感 + 轻空气感。', 'bg-[#fcfbf8]', 'bg-[#fffdfa] border border-[#ebe5da] shadow-[0_8px_24px_rgba(60,40,20,0.05)]', 'bg-[#fffdfa] text-neutral-900 hover:bg-[#faf6ef]', 'bg-[#fffdfa] border border-[#ebe5da] shadow-[0_18px_32px_rgba(60,40,20,0.07)]', 'hover:bg-[#faf6ef] text-[#5f564b]', 'bg-[#f3eee6] text-[#4e463d]', 'text-[#b1a796]', 'text-[#b1a796]'],
  ['minimal-board', 'Minimal Board', '偏极简主义。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_6px_14px_rgba(15,23,42,0.03)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_10px_18px_rgba(15,23,42,0.04)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
  ['menu-foundation', 'Menu Foundation', '最适合作为基础版再微调。', 'bg-white', 'bg-white border border-neutral-200 shadow-[0_8px_22px_rgba(15,23,42,0.04)]', 'bg-white text-neutral-900 hover:bg-neutral-50', 'bg-white border border-neutral-200 shadow-[0_16px_30px_rgba(15,23,42,0.06)]', 'hover:bg-neutral-50 text-neutral-700', 'bg-neutral-50 text-neutral-900', 'text-neutral-400', 'text-neutral-400'],
] as const;

const toolbarDropdownVariants: ToolbarDropdownVariant[] = variantDefs.map(
  ([
    id,
    name,
    description,
    stageClassName,
    toolbarClassName,
    triggerClassName,
    menuClassName,
    itemClassName,
    activeItemClassName,
    shortcutClassName,
    iconToneClassName,
  ]) => ({
    id,
    name,
    description,
    stageClassName,
    toolbarClassName,
    triggerClassName,
    menuClassName,
    itemClassName,
    activeItemClassName,
    shortcutClassName,
    iconToneClassName,
  })
);

const categories = ['Translate', 'Actions', 'Tone'];
const flyoutItems = ['Translate to English', 'Translate to Japanese', 'Translate to French'];

function ToolbarShell({ variant }: { variant: ToolbarDropdownVariant }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-[16px] px-2 py-1.5', variant.toolbarClassName)}>
      <div className="inline-flex h-8 items-center rounded-[10px] px-3 text-[12px] text-neutral-600">H1</div>
      <div className="inline-flex h-8 items-center rounded-[10px] px-2 text-[12px] text-neutral-600">B</div>
      <div className={cn('inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-[12px] font-medium', variant.triggerClassName)}>
        <span className={cn('text-[13px]', variant.iconToneClassName)}>★</span>
        <span>AI</span>
      </div>
    </div>
  );
}

function RootMenu({ variant }: { variant: ToolbarDropdownVariant }) {
  return (
    <div className={cn('min-w-[190px] rounded-[16px] p-1.5', variant.menuClassName)}>
      {categories.map((label, index) => (
        <div
          key={label}
          className={cn(
            'flex h-9 items-center justify-between rounded-[10px] px-3 text-[12px] transition-colors',
            variant.itemClassName,
            index === 0 ? variant.activeItemClassName : ''
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn('text-[12px]', variant.iconToneClassName)}>✦</span>
            <span>{label}</span>
          </div>
          <span className={cn('text-[10px]', variant.shortcutClassName)}>›</span>
        </div>
      ))}
    </div>
  );
}

function FlyoutMenu({ variant }: { variant: ToolbarDropdownVariant }) {
  return (
    <div className={cn('min-w-[244px] rounded-[16px] p-1.5', variant.menuClassName)}>
      {flyoutItems.map((item, index) => (
        <div
          key={item}
          className={cn(
            'flex h-9 items-center justify-between rounded-[10px] px-3 text-[12px] transition-colors',
            variant.itemClassName,
            index === 0 ? variant.activeItemClassName : ''
          )}
        >
          <span>{item}</span>
          {index === 0 ? <span className={cn('text-[10px]', variant.shortcutClassName)}>Return</span> : null}
        </div>
      ))}
    </div>
  );
}

function VariantCard({ variant, index }: { variant: ToolbarDropdownVariant; index: number }) {
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

      <div className={cn('rounded-[24px] border p-5', variant.stageClassName)}>
        <div className="mx-auto max-w-[760px]">
          <div className="mb-4 text-[13px] leading-7 text-neutral-700">
            Select text, open the floating toolbar, click the star button, and hover a category to reveal the next menu.
          </div>
          <ToolbarShell variant={variant} />
          <div className="mt-3 flex items-start gap-2">
            <RootMenu variant={variant} />
            <FlyoutMenu variant={variant} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiToolbarDropdownLab() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">AI Toolbar Dropdown Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          Thirty simple hover-flyout directions for the star button menu
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          This pass follows a simpler Notion-like idea: one small root menu with only the top-level groups, and a separate flyout submenu that appears on hover.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {toolbarDropdownVariants.map((variant, index) => (
          <VariantCard key={variant.id} variant={variant} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
