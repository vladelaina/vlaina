import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

function MockInput({ className, containerClassName }: any) {
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState(false);

    const handleSend = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 2000);
        setMsg('');
    };

    return (
        <div className={cn("relative w-full max-w-2xl mx-auto", containerClassName)}>
            <div className={className}>
                <div className="flex flex-col">
                    <div className="relative px-4 pt-4 pb-2">
                        <textarea
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                            placeholder={loading ? "Type to interrupt..." : "Message..."}
                            rows={1}
                            className="w-full resize-none bg-transparent text-[15px] leading-6 text-[var(--vlaina-text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none min-h-[24px]"
                        />
                    </div>
                    <div className="flex items-center justify-between px-2 pb-2 pl-3">
                        <div className="flex items-center gap-1">
                            <button onClick={() => setSearch(!search)} className={cn("w-8 h-8 flex items-center justify-center rounded-full transition-all", search ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5")}>
                                <Icon name="common.language" className="w-4 h-4" />
                            </button>
                            <button className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                <Icon name="common.settings" className="w-4 h-4" />
                            </button>
                            <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                            <button className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                <Icon name="file.attach" className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[8px]">M</div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">GPT-4</span>
                                <Icon name="nav.chevronDown" className="w-3 h-3 text-gray-400" />
                            </button>

                            {loading ? (
                                <button onClick={() => setLoading(false)} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all bg-black dark:bg-white text-white dark:text-black hover:opacity-80 shadow-md")}>
                                    <Icon name="media.stop" className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <button onClick={handleSend} disabled={!msg} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", msg ? "bg-black dark:bg-white text-white dark:text-black shadow-md hover:scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed")}>
                                    <Icon name="common.send" className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PremiumGlass() {
    return (
        <MockInput 
            className="bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[26px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300"
        />
    );
}

export function SolidMinimalist() {
    return (
        <MockInput 
            className="bg-white dark:bg-[#222] rounded-3xl shadow-sm border border-transparent focus-within:border-gray-200 dark:focus-within:border-gray-700 transition-all"
        />
    );
}

export function NeonBorder() {
    return (
        <MockInput 
            className="bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] focus-within:shadow-[0_0_20px_rgba(59,130,246,0.2)] focus-within:border-blue-500/50 transition-all"
        />
    );
}

export function FloatingIsland() {
    return (
        <div className="flex gap-2 w-full max-w-2xl mx-auto items-end">
            <div className="flex-1 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 min-h-[56px] flex items-center">
                <input placeholder="Message..." className="w-full bg-transparent outline-none px-2" />
            </div>
            <button className="w-14 h-14 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <Icon name="common.send" size="md" />
            </button>
        </div>
    );
}

export function GhostInput() {
    return (
        <MockInput 
            className="bg-transparent hover:bg-gray-50/50 dark:hover:bg-white/5 focus-within:bg-white dark:focus-within:bg-[#1E1E1E] rounded-2xl border-b border-gray-200 dark:border-gray-800 focus-within:border-transparent focus-within:shadow-lg transition-all duration-300"
        />
    );
}
