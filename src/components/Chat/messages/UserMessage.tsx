import { useState } from 'react';
import { LocalImage } from '../components/LocalImage';

export function UserMessage({ content }: { content: string }) {
  // Parsing ![image](url)
  const imgRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let text = content;
  
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
      images.push(match[1]);
  }
  
  text = text.replace(imgRegex, '').trim();

  return (
    <div className="flex flex-col items-end gap-2 max-w-full">
        {images.map((src, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-white dark:bg-zinc-800">
                <LocalImage 
                    src={src} 
                    alt="attachment" 
                    className="max-w-xs max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(src, '_blank')} // Might not open local path in browser, but ok for now
                />
            </div>
        ))}
        {text && (
            <div className="milkdown inline-block bg-[#F4F4F5] dark:bg-[#2C2C2C] px-5 py-3 rounded-[20px] rounded-tr-md text-gray-900 dark:text-gray-100 text-[15px] leading-7 shadow-sm border border-black/5 dark:border-white/5 text-left break-words">
                <div className="whitespace-pre-wrap">{text}</div>
            </div>
        )}
    </div>
  );
}
