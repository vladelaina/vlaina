export function ChatLoading() {
    const dotAnimationDelays = [
        'var(--vlaina-duration-0)',
        'var(--vlaina-duration-100)',
        'var(--vlaina-duration-200)',
    ];

    return (
        <div className="flex h-6 w-fit items-center space-x-1.5 self-start rounded-full min-w-0 select-none">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes chat-loading-typing {
                    0%, 100% { opacity: var(--vlaina-opacity-40); transform: translateY(var(--vlaina-translate-0)); }
                    50% { opacity: var(--vlaina-opacity-100); transform: translateY(var(--vlaina-translate--2px)); }
                }
                .chat-loading-dot {
                    animation: chat-loading-typing var(--vlaina-duration-chat-typing) infinite var(--vlaina-ease-in-out);
                }
            `}} />
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="w-1.5 h-1.5 bg-[var(--vlaina-accent)] rounded-full chat-loading-dot"
                    style={{
                        animationDelay: dotAnimationDelays[i],
                    }}
                />
            ))}
        </div>
    );
}
