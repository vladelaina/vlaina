export function serializeSliceToText(slice: any): string {
    let result = '';

    const processNode = (node: any) => {
        if (node.isText && node.text) {
            const linkMark = node.marks?.find((m: any) => m.type.name === 'link');
            if (linkMark) {
                if (node.text === linkMark.attrs.href) {
                    result += node.text;
                } else {
                    result += '[' + node.text + '](' + linkMark.attrs.href + ')';
                }
            } else {
                result += node.text;
            }
            return;
        }

        if (node.type.name === 'hard_break') {
            result += '\n';
            return;
        }

        if (node.content && node.content.size > 0) {
            node.content.forEach((child: any) => {
                processNode(child);
            });

            if (node.isBlock) {
                result += '\n';
            }
        }
    };

    slice.content.forEach((node: any) => {
        processNode(node);
        if (node.isBlock && !result.endsWith('\n')) {
            result += '\n';
        }
    });

    return result.replace(/\n+$/, '');
}