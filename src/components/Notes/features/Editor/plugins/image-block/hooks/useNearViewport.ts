import { RefObject, useEffect, useState } from 'react';
import { themeLazyLoadTokens } from '@/styles/themeTokens';

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
            rootMargin: themeLazyLoadTokens.imageBlockRootMargin,
            threshold: 0,
        });

        observer.observe(target);
        return () => observer.disconnect();
    }, [isNearViewport, targetRef]);

    return isNearViewport;
}
