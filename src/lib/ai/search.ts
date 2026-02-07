import { isTauri } from "@/lib/storage/adapter";

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

/**
 * Perform a web search using DuckDuckGo via Rust backend (to bypass CORS).
 */
export async function performWebSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log('[Search] Initializing web search for:', query);
    
    if (isTauri()) {
        try {
            console.log('[Search] Invoking Tauri command: search_web');
            const { invoke } = await import('@tauri-apps/api/core');
            // Tauri invoke doesn't support signal out of box, but command is fast enough.
            const results = await invoke<SearchResult[]>('search_web', { query });
            console.log(`[Search] Tauri search success. Found ${results.length} results.`);
            return results;
        } catch (e) {
            console.error('[Search] Tauri command failed:', e);
            return [];
        }
    } else {
        console.warn('[Search] Running in browser mode. CORS might block this request.');
        return fallbackBrowserSearch(query, signal);
    }
}

async function fallbackBrowserSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    // This is for dev environment only.
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(response.statusText);
        const html = await response.text();
        return parseDuckDuckGoHTML(html);
    } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
            console.log('[Search] Aborted');
            throw e;
        }
        console.warn('[Search] Browser fetch failed (likely CORS). Return mock data for UI testing.');
        return [
            {
                title: "Local Dev Search Placeholder",
                url: "http://localhost",
                snippet: `Search for "${query}" failed due to browser CORS. This will work in the Tauri app.`
            }
        ];
    }
}

function parseDuckDuckGoHTML(html: string): SearchResult[] {
    const results: SearchResult[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const items = doc.querySelectorAll('.result');
    items.forEach((item, index) => {
        if (index > 4) return;
        
        const titleLink = item.querySelector('.result__a');
        const snippet = item.querySelector('.result__snippet');
        
        if (titleLink && snippet) {
            results.push({
                title: titleLink.textContent?.trim() || '',
                url: titleLink.getAttribute('href') || '',
                snippet: snippet.textContent?.trim() || ''
            });
        }
    });
    
    return results;
}

export function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) return "No relevant information found on the web.";
    
    return results.map((r, i) => {
        return `[${i + 1}] "${r.title}"\nURL: ${r.url}\nSummary: ${r.snippet}`;
    }).join('\n\n');
}
