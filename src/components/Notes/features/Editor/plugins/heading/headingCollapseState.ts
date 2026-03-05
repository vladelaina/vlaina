export type CollapseMetaActionType = 'toggle' | 'expand' | 'collapse';

export interface CollapseMetaAction {
    type: CollapseMetaActionType;
    headingPos: number;
}

const isCollapseMetaActionType = (value: unknown): value is CollapseMetaActionType => {
    return value === 'toggle' || value === 'expand' || value === 'collapse';
};

export const parseCollapseMetaAction = (meta: unknown): CollapseMetaAction | null => {
    if (!meta || typeof meta !== 'object') return null;

    const candidate = meta as { type?: unknown; headingPos?: unknown };
    if (!isCollapseMetaActionType(candidate.type)) return null;
    if (typeof candidate.headingPos !== 'number' || !Number.isFinite(candidate.headingPos)) return null;

    return {
        type: candidate.type,
        headingPos: candidate.headingPos,
    };
};

export const applyCollapseAction = (
    current: Set<number>,
    action: CollapseMetaAction,
): Set<number> => {
    const next = new Set<number>(current);
    switch (action.type) {
        case 'toggle':
            if (next.has(action.headingPos)) {
                next.delete(action.headingPos);
            } else {
                next.add(action.headingPos);
            }
            break;
        case 'expand':
            next.delete(action.headingPos);
            break;
        case 'collapse':
            next.add(action.headingPos);
            break;
    }
    return next;
};

export const remapCollapsedHeadings = (
    current: Set<number>,
    tr: { docChanged?: boolean; mapping?: { map: (pos: number, assoc?: number) => number } },
    doc: { nodeAt: (pos: number) => { type?: { name?: string } } | null },
): Set<number> => {
    if (!tr.docChanged || !tr.mapping || current.size === 0) return new Set<number>(current);
    const { mapping } = tr;

    const mapped = new Set<number>();
    current.forEach((pos) => {
        const mappedPos = mapping.map(pos, -1);
        const node = doc.nodeAt(mappedPos);
        if (node?.type?.name === 'heading') {
            mapped.add(mappedPos);
        }
    });

    return mapped;
};
