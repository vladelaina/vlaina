const ZOOM_COVER_MULTIPLIER = 1.001;

interface Size {
    width: number;
    height: number;
}

export function resolveCoverZoom(containerSize: Size, mediaSize: Size): number | null {
    if (
        !Number.isFinite(containerSize.width) ||
        !Number.isFinite(containerSize.height) ||
        !Number.isFinite(mediaSize.width) ||
        !Number.isFinite(mediaSize.height) ||
        containerSize.width <= 0 ||
        containerSize.height <= 0 ||
        mediaSize.width <= 0 ||
        mediaSize.height <= 0
    ) {
        return null;
    }

    const fitRatio = Math.min(
        containerSize.width / mediaSize.width,
        containerSize.height / mediaSize.height,
    );

    const displayedWidthAtZoom1 = mediaSize.width * fitRatio;
    const displayedHeightAtZoom1 = mediaSize.height * fitRatio;

    const widthScale = containerSize.width / displayedWidthAtZoom1;
    const heightScale = containerSize.height / displayedHeightAtZoom1;

    return Math.max(widthScale, heightScale) * ZOOM_COVER_MULTIPLIER;
}

export function resolveDisplayedMediaSizeAtZoom1(containerSize: Size, mediaSize: Size): Size | null {
    if (
        !Number.isFinite(containerSize.width) ||
        !Number.isFinite(containerSize.height) ||
        !Number.isFinite(mediaSize.width) ||
        !Number.isFinite(mediaSize.height) ||
        containerSize.width <= 0 ||
        containerSize.height <= 0 ||
        mediaSize.width <= 0 ||
        mediaSize.height <= 0
    ) {
        return null;
    }

    const fitRatio = Math.min(
        containerSize.width / mediaSize.width,
        containerSize.height / mediaSize.height,
    );

    return {
        width: mediaSize.width * fitRatio,
        height: mediaSize.height * fitRatio,
    };
}
