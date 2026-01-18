/**
 * DayCountModal - Custom day count selection modal
 * 
 * A searchable modal for selecting a custom number of days to display.
 */

import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';

interface DayCountModalProps {
    isOpen: boolean;
    inputValue: string;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    onSelectCount: (count: number) => void;
}

export function DayCountModal({
    isOpen,
    inputValue,
    onInputChange,
    onSubmit,
    onClose,
    onSelectCount,
}: DayCountModalProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100001 }}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-100 rounded-xl shadow-2xl w-80 overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200">
                    <Search className="size-4 text-zinc-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onSubmit();
                            } else if (e.key === 'Escape') {
                                onClose();
                            }
                        }}
                        placeholder="Set number of days..."
                        className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
                    />
                </div>

                {/* Options List */}
                <div className="max-h-80 overflow-y-auto">
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((count) => (
                        <button
                            key={count}
                            onClick={() => onSelectCount(count)}
                            className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 transition-colors"
                        >
                            {count}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-zinc-200 flex items-center gap-4 text-xs text-zinc-400">
                    <span>↑↓ Navigate</span>
                    <span>↵ Select</span>
                    <span>Esc Close</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
