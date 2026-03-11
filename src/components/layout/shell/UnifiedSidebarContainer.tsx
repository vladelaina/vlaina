import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';

interface UnifiedSidebarContainerProps {
  children: ReactNode;
  width: number;
  collapsed: boolean;
  backgroundColor?: string;
}

export function UnifiedSidebarContainer({
  children,
  width,
  collapsed,
  backgroundColor = NOTES_COLORS.sidebarBg,
}: UnifiedSidebarContainerProps) {
  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 0 : width,
        opacity: 1
      }}
      transition={SPRING_PREMIUM}
      className="flex-shrink-0 flex flex-col overflow-hidden select-none relative z-20 neko-scrollbar"
      style={{ backgroundColor }}
    >
      {children}
    </motion.aside>
  );
}
