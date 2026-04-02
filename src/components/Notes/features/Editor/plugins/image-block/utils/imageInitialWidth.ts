const MIN_IMAGE_WIDTH_PERCENT = 20;
const MAX_INITIAL_IMAGE_WIDTH_PERCENT = 72;
const IMAGE_WIDTH_DECIMALS = 2;

export function resolveInitialImageWidthPercent(
    naturalWidth: number,
    containerWidth: number,
): number | null {
    if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) return null;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return null;

    const naturalPercent = (naturalWidth / containerWidth) * 100;
    const boundedPercent = Math.min(MAX_INITIAL_IMAGE_WIDTH_PERCENT, naturalPercent);
    return Math.max(MIN_IMAGE_WIDTH_PERCENT, boundedPercent);
}

export function resolveInitialImageWidth(
    naturalWidth: number,
    containerWidth: number,
): string | null {
    const percent = resolveInitialImageWidthPercent(naturalWidth, containerWidth);
    if (percent === null) return null;
    const rounded = Number(percent.toFixed(IMAGE_WIDTH_DECIMALS));
    return `${rounded}%`;
}
