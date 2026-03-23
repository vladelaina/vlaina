import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type LoadingVariant = {
  id: string;
  name: string;
  description: string;
  render: (props: { label: string; active?: boolean }) => React.ReactNode;
};

// --- Variant Implementations ---

const variants: LoadingVariant[] = [
  {
    id: 'ethereal-glow',
    name: 'Ethereal Glow',
    description: '文字产生如同呼吸般的深层柔光，模拟高级 AI 的思考律动。',
    render: ({ label }) => (
      <div className="relative">
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <motion.span
          className="absolute inset-0 z-0 blur-md text-blue-400/60 dark:text-blue-500/40"
          animate={{ opacity: [0, 0.8, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'orbit-dot',
    name: 'Orbiting Electron',
    description: '一个微小的粒子围绕文字起始处旋转，带有轻微的拖尾。',
    render: ({ label }) => (
      <div className="flex items-center gap-3">
        <div className="relative h-4 w-4 shrink-0">
          <motion.div
            className="absolute h-1.5 w-1.5 rounded-full bg-blue-500"
            animate={{
              x: [0, 8, 0, -8, 0],
              y: [-8, 0, 8, 0, -8],
              scale: [1, 1.2, 0.8, 1.2, 1],
              opacity: [1, 0.8, 1, 0.8, 1]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'liquid-mercury',
    name: 'Liquid Mercury',
    description: '高反射质感的液态银流动效果，边缘带有锐利的切光。',
    render: ({ label }) => (
      <span className="relative font-medium text-neutral-400">
        {label}
        <motion.span
          className="absolute inset-0 overflow-hidden bg-gradient-to-r from-transparent via-neutral-100 to-transparent bg-[length:200%_100%] text-neutral-900 dark:via-neutral-400 dark:text-white"
          initial={{ backgroundPosition: '200% 0' }}
          animate={{ backgroundPosition: '-200% 0' }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          {label}
        </motion.span>
      </span>
    )
  },
  {
    id: 'binary-whisper',
    name: 'Binary Whisper',
    description: '在文字末尾闪烁流动的二进制代码，暗示后台数据处理。',
    render: ({ label }) => (
      <div className="flex items-center justify-between w-full">
        <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate pr-4">{label}</span>
        <div className="flex gap-0.5 text-[8px] font-mono text-blue-500/40">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
            >
              {Math.round(Math.random())}
            </motion.span>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'signal-bars',
    name: 'Neural Signal',
    description: '四根微型动态条，模拟神经网络的信号传输。',
    render: ({ label }) => (
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-0.5 h-3 w-4 shrink-0">
          {[0.4, 0.7, 1, 0.6].map((h, i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-blue-500 rounded-full"
              animate={{ height: ['20%', `${h * 100}%`, '20%'] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'scanning-line',
    name: 'Scanning Line',
    description: '极细的高亮扫描线垂直扫过文字，科技感十足。',
    render: ({ label }) => (
      <div className="relative overflow-hidden">
        <span className="font-medium text-neutral-400 dark:text-neutral-600">{label}</span>
        <motion.div
          className="absolute inset-0 z-20 border-l-2 border-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
          animate={{ left: ['-10%', '110%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "circInOut" }}
        />
        <motion.span
          className="absolute inset-0 z-10 font-medium text-neutral-900 dark:text-white"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "circInOut" }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'dna-helix',
    name: 'DNA Helix',
    description: '两条交织的虚线在背景中缓缓旋转，象征逻辑构建。',
    render: ({ label }) => (
      <div className="relative flex items-center h-9 w-full">
        <div className="absolute left-0 right-0 h-4 opacity-10">
           <svg width="100%" height="100%" viewBox="0 0 200 20">
             <motion.path
               d="M 0 10 Q 25 0 50 10 Q 75 20 100 10 Q 125 0 150 10 Q 175 20 200 10"
               fill="transparent"
               stroke="currentColor"
               strokeWidth="1"
               animate={{ x: [-50, 0] }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             />
             <motion.path
               d="M 0 10 Q 25 20 50 10 Q 75 0 100 10 Q 125 20 150 10 Q 175 0 200 10"
               fill="transparent"
               stroke="currentColor"
               strokeWidth="1"
               animate={{ x: [-50, 0] }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             />
           </svg>
        </div>
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'pulse-dot-trailing',
    name: 'Comet Pulse',
    description: '起始点发射出一道彗星般的脉冲，横穿整行。',
    render: ({ label }) => (
      <div className="relative w-full">
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-full w-20 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent blur-sm"
          animate={{ left: ['-20%', '120%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeIn" }}
        />
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'typing-ghost',
    name: 'Ghost Typing',
    description: '文字末尾隐约出现不断变换的占位符。',
    render: ({ label }) => (
      <div className="flex items-center">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <motion.span
          className="ml-1 h-3.5 w-1.5 bg-blue-500/50"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      </div>
    )
  },
  {
    id: 'flicker-neon',
    name: 'Cyber Neon',
    description: '模拟霓虹灯启动时的轻微闪烁与电流声感。',
    render: ({ label }) => (
      <motion.span
        className="font-medium text-blue-600 dark:text-blue-400"
        animate={{ 
          opacity: [1, 0.4, 0.9, 0.3, 1, 0.8, 1],
          textShadow: [
            '0 0 0px rgba(59,130,246,0)',
            '0 0 8px rgba(59,130,246,0.5)',
            '0 0 0px rgba(59,130,246,0)'
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, times: [0, 0.05, 0.1, 0.15, 0.2, 0.8, 1] }}
      >
        {label}
      </motion.span>
    )
  },
  {
    id: 'elastic-step',
    name: 'Elastic Step',
    description: '扫光像是在字母间跳跃，带有弹性的物理反馈。',
    render: ({ label }) => (
      <span className="relative font-medium text-neutral-400">
        {label}
        <motion.span
          className="absolute inset-0 text-neutral-900 dark:text-white overflow-hidden"
          style={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ 
            clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 100%)'] 
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.span>
      </span>
    )
  },
  {
    id: 'ink-bleed',
    name: 'Ink Bleed',
    description: '高亮从中心扩散，如同墨水在纸上晕开。',
    render: ({ label }) => (
      <div className="relative">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <motion.div
          className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 blur-xl rounded-full"
          animate={{ scale: [0.5, 1.5, 0.5], opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
    )
  },
  {
    id: 'prism-edge',
    name: 'Prism Edge',
    description: '仅在文字的边缘产生彩虹色的折射光影。',
    render: ({ label }) => (
      <span className="relative font-medium text-neutral-800 dark:text-neutral-200">
        {label}
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 blur-[1px] opacity-30"
          animate={{ x: ['-2px', '2px', '-2px'], y: ['-1px', '1px', '-1px'] }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          {label}
        </motion.span>
      </span>
    )
  },
  {
    id: 'data-fall',
    name: 'Data Fall',
    description: '微型像素点垂直落下，覆盖在文字表面。',
    render: ({ label }) => (
      <div className="relative overflow-hidden">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-2 bg-blue-400/40"
            style={{ left: `${20 + i * 20}%`, top: '-20%' }}
            animate={{ top: ['-20%', '120%'], opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    )
  },
  {
    id: 'magnetic-clump',
    name: 'Magnetic Clump',
    description: '光块被字母吸引，停顿后再弹向下一个目标。',
    render: ({ label }) => (
      <div className="relative">
        <span className="font-medium text-neutral-400 dark:text-neutral-600">{label}</span>
        <motion.div
          className="absolute top-0 bottom-0 w-8 bg-blue-500/20 dark:bg-blue-400/30 blur-sm"
          animate={{ x: [0, 40, 45, 100, 105, 160] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.35, 0.6, 0.65, 1] }}
        />
        <motion.span
          className="absolute inset-0 text-neutral-900 dark:text-white overflow-hidden"
          animate={{ clipPath: ['inset(0 80% 0 0)', 'inset(0 40% 0 40%)', 'inset(0 0% 0 80%)', 'inset(0 80% 0 0)'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'aurora-borealis',
    name: 'Aurora Flow',
    description: '极光般绚烂的色彩在背景中交织流动。',
    render: ({ label }) => (
      <div className="relative overflow-hidden rounded-md px-1">
        <motion.div
          className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-400/20 via-blue-500/20 to-purple-500/20 blur-md"
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ backgroundSize: '200% 200%' }}
        />
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'glitch-trace',
    name: 'Glitch Trace',
    description: '偶发的数字位移与颜色分离效果。',
    render: ({ label }) => (
      <div className="relative">
        <motion.span
          className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200"
          animate={{ x: [0, -2, 2, 0], opacity: [1, 0.8, 1] }}
          transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 2 }}
        >
          {label}
        </motion.span>
        <motion.span
          className="absolute inset-0 text-red-500/50"
          animate={{ x: [-3, 3, -3], opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 2 }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'zen-rhythm',
    name: 'Zen Rhythm',
    description: '极度克制的整体缩放，如同沉稳的呼吸。',
    render: ({ label }) => (
      <motion.span
        className="font-medium text-neutral-800 dark:text-neutral-200"
        animate={{ scale: [1, 1.02, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    )
  },
  {
    id: 'orbit-ring',
    name: 'Orbit Ring',
    description: '一个环形在行内收缩扩散。',
    render: ({ label }) => (
      <div className="relative flex items-center w-full">
        <motion.div
          className="absolute left-4 h-6 w-6 border-2 border-blue-500/30 rounded-full"
          animate={{ scale: [0.5, 1.5], opacity: [1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="font-medium text-neutral-800 dark:text-neutral-200 ml-2">{label}</span>
      </div>
    )
  },
  {
    id: 'loading-gauge-micro',
    name: 'Micro Gauge',
    description: '底部 1px 的极细进度条循环加载。',
    render: ({ label }) => (
      <div className="relative w-full">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-neutral-100 dark:bg-neutral-800">
          <motion.div
            className="h-full bg-blue-500"
            animate={{ width: ['0%', '100%'], left: ['0%', '0%'], opacity: [1, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "circOut" }}
          />
        </div>
      </div>
    )
  },
  {
    id: 'star-blink',
    name: 'Star Blink',
    description: '文字背景中随机闪烁的微光。',
    render: ({ label }) => (
      <div className="relative">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 bg-yellow-400 rounded-full"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%` 
            }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
            transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>
    )
  },
  {
    id: 'echo-wave',
    name: 'Echo Wave',
    description: '文字产生多重虚影向一侧扩散。',
    render: ({ label }) => (
      <div className="relative">
        <span className="relative z-20 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <motion.span
          className="absolute inset-0 z-10 text-blue-500/20"
          animate={{ x: [0, 10], opacity: [0.5, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {label}
        </motion.span>
        <motion.span
          className="absolute inset-0 z-0 text-blue-500/10"
          animate={{ x: [0, 20], opacity: [0.3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'horizon-line',
    name: 'Horizon Line',
    description: '一条横向的细线切开文字。',
    render: ({ label }) => (
      <div className="relative overflow-hidden">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        <motion.div
          className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,1)]"
          animate={{ opacity: [0, 1, 0], scaleX: [0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </div>
    )
  },
  {
    id: 'pixel-dissolve',
    name: 'Pixel Dissolve',
    description: '微型色块在行内随机浮现。',
    render: ({ label }) => (
      <div className="relative">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-500/40"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%` 
            }}
            animate={{ rotate: [0, 90], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>
    )
  },
  {
    id: 'spring-elastic',
    name: 'Spring Elastic',
    description: '文字整体带有弹簧感的上下律动。',
    render: ({ label }) => (
      <motion.span
        className="inline-block font-medium text-neutral-800 dark:text-neutral-200"
        animate={{ y: [0, -2, 0] }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 10, 
          repeat: Infinity,
          repeatDelay: 1
        }}
      >
        {label}
      </motion.span>
    )
  },
  {
    id: 'focus-ring-text',
    name: 'Focus Ring',
    description: '高亮光圈在文字中移动，突出重点。',
    render: ({ label }) => (
      <div className="relative">
        <span className="font-medium text-neutral-400 dark:text-neutral-600">{label}</span>
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-12 bg-white dark:bg-neutral-400 rounded-full blur-md mix-blend-overlay"
          animate={{ left: ['-10%', '110%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-0 font-medium text-neutral-900 dark:text-white"
          animate={{ clipPath: ['inset(0 90% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 90%)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          {label}
        </motion.span>
      </div>
    )
  },
  {
    id: 'liquid-flow-bg',
    name: 'Liquid Background',
    description: '行背景如同液体般缓缓流动。',
    render: ({ label }) => (
      <div className="relative overflow-hidden w-full px-1">
        <motion.div
          className="absolute inset-0 bg-blue-50 dark:bg-blue-950/30"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'scanning-vnet',
    name: 'Vignette Pulse',
    description: '行首尾产生暗角呼吸效果。',
    render: ({ label }) => (
      <div className="relative w-full">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/10"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'metronome-tick',
    name: 'Metronome',
    description: '精准的机械节奏摆动。',
    render: ({ label }) => (
      <div className="flex items-center gap-3">
        <motion.div
          className="h-3 w-0.5 bg-neutral-400 rounded-full origin-bottom"
          animate={{ rotate: [-30, 30] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  },
  {
    id: 'infinity-path',
    name: 'Infinity Loop',
    description: '无穷大的光迹在后台运行。',
    render: ({ label }) => (
      <div className="relative flex items-center h-9 w-full">
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" viewBox="0 0 100 20">
            <motion.path
              d="M 10 10 C 10 0, 40 0, 50 10 C 60 20, 90 20, 90 10 C 90 0, 60 0, 50 10 C 40 20, 10 20, 10 10"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </svg>
        </div>
        <span className="relative z-10 font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      </div>
    )
  }
];

// --- Components ---

function SidebarRow({
  label,
  active = false,
  variant,
}: {
  label: string;
  active?: boolean;
  variant: LoadingVariant;
}) {
  return (
    <div className="group/chat-sidebar-row flex items-center py-[1px]">
      <div
        className={cn(
          'relative mx-1 flex min-h-10 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out border border-transparent',
          active
            ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
        )}
      >
        <div className="min-w-0 flex-1">
          {variant.render({ label, active })}
        </div>
        
        <div className="shrink-0 flex items-center">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, index }: { variant: LoadingVariant; index: number }) {
  return (
    <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[13px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {index}
            </div>
            <div className="min-w-0">
            <div className="text-[16px] font-bold text-neutral-950 dark:text-white">{variant.name}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">{variant.description}</div>
            </div>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] bg-neutral-50/50 p-4 dark:bg-black/20">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-white/5 dark:bg-zinc-950">
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-white/5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              <span>Preview</span>
              <span className="text-blue-500">Processing...</span>
            </div>
          </div>

          <div className="p-2 space-y-1">
            <SidebarRow label="Weekly Research Report" active variant={variant} />
            <div className="px-3 py-2 text-xs text-neutral-400 opacity-50">
                <div className="flex items-center gap-2">
                    <div className="h-1 w-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
                    <div className="h-1 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatSidebarLoadingLab() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-12 pb-32">
      <div className="max-w-3xl">
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 dark:bg-blue-500/10"
        >
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Next-Gen Sidebar Loading</span>
        </motion.div>
        
        <h2 className="mt-6 text-4xl font-black tracking-tight text-neutral-950 dark:text-white sm:text-5xl">
          30 New Ways to Think.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
          我们彻底抛弃了单一的扫光逻辑。这 30 个方案涵盖了从微观物理模拟到宏观抽象美学的各个维度，旨在让“加载中”不再是焦虑的等待，而是一种优雅的视觉享受。
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {variants.map((variant, index) => (
          <VariantCard key={variant.id} variant={variant} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
