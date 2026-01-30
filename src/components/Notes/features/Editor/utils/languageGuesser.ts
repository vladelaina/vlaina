// Simple heuristic language guesser
// Lightweight alternative to highlight.js auto-detect

export function guessLanguage(code: string): string | null {
    const text = code.trim();
    if (!text) return null;

    // 1. HTML / XML
    if (/^<!DOCTYPE html>/i.test(text) || /<\w+[^>]*>[\s\S]*<\/\w+>/.test(text)) return 'html';
    
    // 2. JavaScript / TypeScript / JSX
    const hasJSKeywords = /\b(const|let|var|function|import|export|class|=>|console\.log)\b/.test(text);
    if (hasJSKeywords) {
        if (text.includes('interface ') || text.includes('type ') || /:\s*[A-Z]\w+/.test(text)) return 'typescript';
        if (text.includes('<div>') || text.includes('<App')) return 'tsx';
        return 'javascript';
    }

    // 3. Python
    if (/\b(def|class|import|from|if\s+.*:|print\(|elif|else:)\b/.test(text) && !text.includes('{')) return 'python';

    // 4. Rust
    if (/\b(fn|let|mut|impl|struct|enum|pub|use|mod|match)\b/.test(text) && text.includes('::')) return 'rust';

    // 5. Go
    if (/\b(package|func|import|type|struct|chan|go)\b/.test(text) && !text.includes(';')) return 'go';

    // 6. CSS
    if (/(\.|#)\w+\s*\{[\s\S]*?\}/.test(text) && text.includes(':')) return 'css';

    // 7. SQL
    if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|CREATE TABLE)\b/i.test(text)) return 'sql';

    // 8. JSON
    if (/^\{[\s\S]*\}$/.test(text) || /^\[[\s\S]*\]$/.test(text)) {
        try {
            JSON.parse(text);
            return 'json';
        } catch {}
    }

    // 9. Bash
    if (text.startsWith('#!') || /\b(echo|ls|cd|grep|sudo|apt|npm|yarn)\b/.test(text)) return 'bash';

    // 10. Java
    if (/\b(public class|public static void main|System\.out\.println)\b/.test(text)) return 'java';

    // 11. PHP
    if (text.includes('<?php') || /\$\w+\s*=/.test(text) || text.includes('echo ')) return 'php';

    // 12. C#
    if (/\b(using System|namespace|public class|Console\.WriteLine)\b/.test(text)) return 'csharp';

    // 13. Swift
    if (/\b(import SwiftUI|var body: some View|func |let |var )\b/.test(text) && !text.includes('function')) return 'swift';

    // 14. Kotlin
    if (/\b(fun main|val |var |data class|suspend fun)\b/.test(text)) return 'kotlin';

    // 15. Dart
    if (/\b(void main|import 'package:|Widget build)\b/.test(text)) return 'dart';

    // 16. Ruby
    if (/\b(def |end|require |class |module |puts |attr_accessor)\b/.test(text) && !text.includes('{')) return 'ruby';

    return null;
}