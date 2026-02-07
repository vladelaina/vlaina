export function UserMessage({ content }: { content: string }) {
  return (
    <div className="milkdown inline-block bg-[#F4F4F5] dark:bg-[#2C2C2C] px-5 py-3 rounded-[20px] rounded-tr-md text-gray-900 dark:text-gray-100 text-[15px] leading-7 shadow-sm border border-black/5 dark:border-white/5 text-left break-words max-w-full">
        <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}
