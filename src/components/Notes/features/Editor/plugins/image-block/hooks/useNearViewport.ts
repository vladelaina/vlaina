import { RefObject, useEffect, useState } from 'react';

const IMAGE_PREFETCH_ROOT_MARGIN = '900px 0px';

export function useNearViewport(targetRef: RefObject<Element | null>): boolean {
    const [isNearViewport, setIsNearViewport] = useState(() => (
        typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
    ));

    useEffect(() => {
        if (isNearViewport) {
            return;
        }

        const target = targetRef.current;
        if (!target) {
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            setIsNearViewport(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setIsNearViewport(true);
                observer.disconnect();
            }
        }, {
            root: null,
            rootMargin: IMAGE_PREFETCH_ROOT_MARGIN,
            threshold: 0,
        });

        observer.observe(target);
        return () => observer.disconnect();
    }, [isNearViewport, targetRef]);

    return isNearViewport;
}
