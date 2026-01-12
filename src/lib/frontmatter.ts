/**
 * Lightweight Frontmatter Parser
 * 
 * A zero-dependency utility to parse and stringify basic YAML frontmatter.
 * We avoid full YAML parsers to keep the app lightweight, as we only need
 * simple key-value pairs for metadata (cover, coverY, tags, etc.).
 */

export interface Frontmatter {
    [key: string]: string | number | boolean | null | undefined;
}

export interface ParseResult {
    data: Frontmatter;
    content: string;
}

// Regex to match frontmatter block at the start of the file
// Matches --- followed by content, followed by ---
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

/**
 * Parse markdown content to extract frontmatter and body
 */
export function parseFrontmatter(text: string): ParseResult {
    const match = text.match(FRONTMATTER_REGEX);

    if (!match) {
        return {
            data: {},
            content: text,
        };
    }

    const rawYaml = match[1];
    const content = text.slice(match[0].length);
    const data: Frontmatter = {};

    // Simple line-by-line parsing
    const lines = rawYaml.split(/\r?\n/);

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.slice(0, colonIndex).trim();
        let valueStr = line.slice(colonIndex + 1).trim();

        // Remove quotes if present
        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
            (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
            valueStr = valueStr.slice(1, -1);
        }

        // Basic type inference
        let value: string | number | boolean | null = valueStr;

        if (valueStr === 'true') value = true;
        else if (valueStr === 'false') value = false;
        else if (valueStr === 'null') value = null;
        else if (!isNaN(Number(valueStr)) && valueStr !== '') {
            value = Number(valueStr);
        }

        if (key) {
            data[key] = value;
        }
    }

    return { data, content };
}

/**
 * Stringify data and content back into valid markdown with frontmatter
 */
export function stringifyFrontmatter(content: string, data: Frontmatter): string {
    const keys = Object.keys(data);

    // If no data, return content as is (stripping existing frontmatter if any effectively)
    // But wait, if we are *updating*, the passed content usually assumes 
    // we stripped the frontmatter first. 
    // If the goal is to *add* frontmatter to raw text that might already have it,
    // we should check if we should merge or replace.
    // This function assumes 'content' is the BODY content (without frontmatter).

    if (keys.length === 0) {
        return content;
    }

    const yamlLines = keys.map(key => {
        const value = data[key];
        let valueStr = '';

        if (value === null || value === undefined) valueStr = 'null';
        else if (typeof value === 'string') {
            // Quote strings if they contain special chars
            if (value.includes(':') || value.includes('#') || value.startsWith(' ')) {
                valueStr = `"${value}"`;
            } else {
                valueStr = value;
            }
        } else {
            valueStr = String(value);
        }

        return `${key}: ${valueStr}`;
    });

    return `---\n${yamlLines.join('\n')}\n---\n${content}`;
}

/**
 * Helper to update frontmatter in a full markdown file string
 */
export function updateFrontmatter(fullText: string, updates: Partial<Frontmatter>): string {
    const { data, content } = parseFrontmatter(fullText);
    const newData = { ...data, ...updates };

    // Clean up undefined/null values if we want to remove keys
    // For now, we keep them or filter? Let's filter out explicitly undefined keys if passed
    for (const key in updates) {
        if (updates[key] === undefined) {
            delete newData[key];
        }
    }

    return stringifyFrontmatter(content, newData);
}
