export function ChatLoading() {
    return (
        <div className="flex w-fit items-center space-x-1.5 py-3 mt-2 self-start rounded-full min-w-0 select-none">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes vlaina-typing {
                    0%, 100% { opacity: 0.4; transform: translateY(0); }
                    50% { opacity: 1; transform: translateY(-2px); }
                }
                .vlaina-dot {
                    animation: vlaina-typing 0.8s infinite ease-in-out;
                }
            `}} />
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full vlaina-dot"
                    style={{
                        animationDelay: `${i * 0.1}s`,
                    }}
                />
            ))}
        </div>
    );
}
