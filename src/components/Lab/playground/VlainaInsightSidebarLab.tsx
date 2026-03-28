import React from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, Search, Plus, User, Settings, Bell, Archive, Layout, Star, Sparkles, BookOpen, Folder
} from 'lucide-react';

/**
 * vlaina Color Architecture Lab
 * Inspired by the Magic Scholar Logo
 */

// ==========================================
// THEME 1: AURA FROST (极光晨霜)
// ==========================================
const AuraFrostSidebar = () => {
  return (
    <div className="h-full bg-[#F4F7FB] p-5 flex flex-col font-sans text-left rounded-[48px] shadow-[0_20px_50px_-10px_rgba(101,193,186,0.15)] border border-[#E2EAF4]">
      {/* User & Actions */}
      <div className="flex items-center justify-between mb-10">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white shadow-[0_4px_10px_rgba(206,222,240,0.5)] border border-[#E2EAF4] flex items-center justify-center">
               <User size={18} className="text-[#849CBF]" />
            </div>
            <div className="text-[13px] font-bold text-[#4A5D7A]">Vladimir</div>
         </div>
         <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-[#E2EAF4] flex items-center justify-center text-[#849CBF] hover:text-[#E25895] cursor-pointer transition-colors relative">
            <Bell size={16} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-[#E25895] rounded-full" />
         </div>
      </div>

      {/* Search */}
      <div className="h-11 bg-white/60 rounded-2xl flex items-center px-4 mb-8 border border-[#E2EAF4] backdrop-blur-sm">
        <Search size={16} className="text-[#A3B8D7]" />
        <span className="ml-3 text-[12px] font-medium text-[#A3B8D7]">Search spells & notes...</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-2">
         <div className="text-[10px] font-black text-[#A3B8D7] uppercase tracking-[0.2em] px-3 mb-4">Grimoire</div>
         
         {/* Active Item */}
         <div className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-[16px] shadow-[0_8px_20px_-6px_rgba(229,212,239,0.5)] border border-[#F1D3E6]/30 cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E2EAF4] to-[#E5D4EF] flex items-center justify-center">
               <Sparkles size={14} className="text-[#65C1BA]" />
            </div>
            <span className="text-[13px] font-bold text-[#4A5D7A] flex-1">Architecture.md</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#65C1BA]" />
         </div>

         {/* Inactive Items */}
         <div className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] hover:bg-white/50 cursor-pointer text-[#849CBF] hover:text-[#4A5D7A] transition-colors">
            <div className="w-8 h-8 rounded-xl bg-transparent flex items-center justify-center">
               <BookOpen size={16} />
            </div>
            <span className="text-[13px] font-semibold flex-1">Design System Logs</span>
         </div>
         <div className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] hover:bg-white/50 cursor-pointer text-[#849CBF] hover:text-[#4A5D7A] transition-colors">
            <div className="w-8 h-8 rounded-xl bg-transparent flex items-center justify-center">
               <Star size={16} />
            </div>
            <span className="text-[13px] font-semibold flex-1">Starred Assets</span>
         </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 flex justify-between items-center">
         <Settings size={20} className="text-[#A3B8D7] hover:text-[#4A5D7A] cursor-pointer" />
         <div className="w-14 h-14 bg-gradient-to-r from-[#65C1BA] to-[#38A8A2] rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(101,193,186,0.3)] cursor-pointer hover:scale-105 transition-transform">
            <Plus size={24} className="text-white" />
         </div>
      </div>
    </div>
  );
};

// ==========================================
// THEME 2: MIDNIGHT CLOAK (午夜披风)
// ==========================================
const MidnightCloakSidebar = () => {
  return (
    <div className="h-full bg-gradient-to-b from-[#1A1D29] to-[#262A3B] p-6 flex flex-col font-sans text-left rounded-[48px] shadow-2xl border border-[#3A405A]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-12">
         <div className="w-12 h-12 bg-[#2C3049] rounded-[18px] border border-[#434A6A] flex items-center justify-center shadow-inner">
            <span className="text-[#D8A65E] font-black text-xl italic font-serif">V</span>
         </div>
         <div className="flex flex-col">
            <span className="text-[14px] font-black text-[#F4F7FB] tracking-wide">VLAINA</span>
            <span className="text-[9px] font-bold text-[#849CBF] uppercase tracking-[0.3em]">Knowledge Base</span>
         </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-8">
         <div className="space-y-2">
            <div className="text-[10px] font-black text-[#5E688A] uppercase tracking-[0.2em] px-2 mb-4">Active Study</div>
            
            <div className="flex items-center gap-3 px-4 py-3 bg-[#2C3049]/80 rounded-[16px] border border-[#D8A65E]/20 shadow-[0_4px_15px_rgba(0,0,0,0.2)] cursor-pointer group">
               <FileText size={16} className="text-[#D8A65E]" />
               <span className="text-[13px] font-bold text-[#E2EAF4] flex-1 group-hover:text-white transition-colors">Core_Architecture</span>
            </div>
            
            <div className="flex items-center gap-3 px-4 py-3 rounded-[16px] cursor-pointer text-[#849CBF] hover:text-[#E2EAF4] hover:bg-[#2C3049]/40 transition-colors">
               <Folder size={16} />
               <span className="text-[13px] font-medium flex-1">Character Lore</span>
            </div>
         </div>
      </div>

      {/* Floating Action / Footer */}
      <div className="mt-auto bg-[#1A1D29] rounded-[24px] p-2 flex items-center justify-between border border-[#3A405A] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
         <div className="w-12 h-12 rounded-[18px] flex items-center justify-center text-[#849CBF] hover:text-white cursor-pointer"><Search size={18}/></div>
         <div className="w-12 h-12 rounded-[18px] flex items-center justify-center text-[#849CBF] hover:text-white cursor-pointer"><Settings size={18}/></div>
         <div className="w-12 h-12 bg-gradient-to-br from-[#D8A65E] to-[#C28B40] rounded-[18px] flex items-center justify-center text-[#1A1D29] shadow-[0_0_15px_rgba(216,166,94,0.4)] cursor-pointer"><Plus size={20}/></div>
      </div>
    </div>
  );
};

// ==========================================
// THEME 3: PRISMATIC VEIL (星芒琉璃)
// ==========================================
const PrismaticVeilSidebar = () => {
  return (
    <div className="h-full relative p-5 flex flex-col font-sans text-left rounded-[48px] overflow-hidden">
      {/* Glass Background */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl z-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#CEDEF0]/30 via-[#F1C6E7]/20 to-[#FFF3F0]/40 z-0" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#65C1BA]/10 blur-[40px] rounded-full z-0" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F5C04F]/10 blur-[50px] rounded-full z-0" />
      <div className="absolute inset-0 border-[1.5px] border-white/60 rounded-[48px] z-10 pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, black, transparent)'}} />

      {/* Content */}
      <div className="relative z-20 flex-1 flex flex-col">
         {/* User */}
         <div className="flex items-center gap-3 mb-10 p-2">
            <div className="w-10 h-10 rounded-full bg-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-white flex items-center justify-center backdrop-blur-md">
               <User size={18} className="text-[#65C1BA]" />
            </div>
            <span className="text-[14px] font-black text-[#2C3049]">vlaina.</span>
         </div>

         {/* Search */}
         <div className="h-12 bg-white/50 rounded-[20px] flex items-center px-5 mb-8 border border-white/80 shadow-[inset_0_2px_5px_rgba(255,255,255,0.8)] backdrop-blur-md">
            <Search size={16} className="text-[#A3B8D7]" />
            <span className="ml-3 text-[12px] font-semibold text-[#849CBF]">Search the void...</span>
         </div>

         {/* List */}
         <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 bg-white/70 rounded-[20px] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white backdrop-blur-lg">
               <FileText size={16} className="text-[#E25895]" />
               <span className="text-[13px] font-bold text-[#2C3049] flex-1">Concept Arts</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-[20px] hover:bg-white/30 cursor-pointer text-[#849CBF] transition-colors">
               <Layout size={16} />
               <span className="text-[13px] font-semibold text-[#4A5D7A] flex-1">Moodboards</span>
            </div>
         </div>

         {/* Bottom Action */}
         <div className="mt-auto flex justify-center">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.08)] border border-white cursor-pointer hover:scale-110 transition-transform">
               <Plus size={24} className="text-[#2C3049]" />
            </div>
         </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN EXHIBITION COMPONENT
// ==========================================
export function VlainaInsightSidebarLab() {
  return (
    <div className="w-full min-h-screen bg-[#FBFBFC] p-10 pb-40 font-sans text-center">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-24 flex flex-col items-center">
          <h1 className="text-5xl font-black text-[#2C3049] tracking-tighter mb-4">The Magic Scholar Palettes</h1>
          <p className="text-[#849CBF] text-lg font-medium max-w-2xl">
            彻底抛弃了廉价的灰色。这三种侧边栏色彩架构直接提取自 vlaina 的灵魂基因：极光、午夜与星芒。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center justify-items-center">
           
           {/* Card 1 */}
           <div className="flex flex-col items-center gap-8 w-full">
              <div className="w-[320px] h-[700px]">
                 <AuraFrostSidebar />
              </div>
              <div className="text-left w-[320px]">
                 <h3 className="text-2xl font-black text-[#4A5D7A] mb-2">Aura Frost</h3>
                 <p className="text-[13px] text-[#849CBF] leading-relaxed">
                   冰蓝与浅紫的交织。告别死板的白灰，用空气感和冷调色彩让界面呼吸。灵感来自角色的渐变发色。
                 </p>
              </div>
           </div>

           {/* Card 2 */}
           <div className="flex flex-col items-center gap-8 w-full">
              <div className="w-[320px] h-[700px] scale-105 z-10 relative">
                 <MidnightCloakSidebar />
                 <div className="absolute -bottom-10 inset-x-0 h-20 bg-gradient-to-t from-[#1A1D29]/20 to-transparent blur-xl -z-10" />
              </div>
              <div className="text-left w-[320px]">
                 <h3 className="text-2xl font-black text-[#2C3049] mb-2">Midnight Cloak</h3>
                 <p className="text-[13px] text-[#849CBF] leading-relaxed">
                   极其沉浸的暗调设计。午夜蓝底色配合书本的暗金色高亮，带来无与伦比的专注感与奢华感。
                 </p>
              </div>
           </div>

           {/* Card 3 */}
           <div className="flex flex-col items-center gap-8 w-full">
              <div className="w-[320px] h-[700px]">
                 <PrismaticVeilSidebar />
              </div>
              <div className="text-left w-[320px]">
                 <h3 className="text-2xl font-black text-[#4A5D7A] mb-2">Prismatic Veil</h3>
                 <p className="text-[13px] text-[#849CBF] leading-relaxed">
                   光与玻璃的魔法。底层透出法杖与灯泡的粉黄蓝光晕，用毛玻璃和白色细线切割空间。
                 </p>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
