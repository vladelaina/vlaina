/**
 * Serializes a ProseMirror Slice to a clean plain text format.
 * No HTML tags are included, only plain text and newlines.
 * 
 * @param slice - The ProseMirror Slice to serialize
 * @returns The serialized plain text string
 */
export function serializeSliceToText(slice: any): string {
    let result = '';

    // Recursive function to traverse all nodes
    const processNode = (node: any) => {
        // 1. Text Nodes
        if (node.isText && node.text) {
            const linkMark = node.marks?.find((m: any) => m.type.name === 'link');
            if (linkMark) {
                // Autolink check
                if (node.text === linkMark.attrs.href) {
                    result += node.text;
                } else {
                    // Custom link formatting
                    result += '[' + node.text + '](' + linkMark.attrs.href + ')';
                }
            } else {
                result += node.text;
            }
            return;
        }

        // 2. Hard Break
        if (node.type.name === 'hard_break') {
            result += '\n';
            return;
        }

        // 3. Container Nodes (Paragraph, Blockquote, ListItem, etc.)
        // We iterate over their children
        if (node.content && node.content.size > 0) {
            node.content.forEach((child: any) => {
                processNode(child);
            });

            // Add newline after block nodes to preserve separation
            if (node.isBlock) {
                result += '\n';
            }
        }
    };

    // Start traversal
    slice.content.forEach((node: any) => {
        processNode(node);
        // Ensure top-level blocks get separated if not handled inside
        if (node.isBlock && !result.endsWith('\n')) {
            result += '\n';
        }
    });

    // Cleanup: Remove multiple trailing newlines to keep it clean
    return result.replace(/\n+$/, '');
}