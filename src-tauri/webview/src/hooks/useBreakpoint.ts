import { useState, useEffect } from 'react';

export type Breakpoint = 'phone' | 'small' | 'tablet' | 'desktop';

const QUERIES: Record<Breakpoint, string> = {
    phone: '(max-width: 599px)',
    small: '(min-width: 600px) and (max-width: 899px)',
    tablet: '(min-width: 900px) and (max-width: 1199px)',
    desktop: '(min-width: 1200px)',
};

function getActiveBreakpoint(): Breakpoint {
    for (const [key, query] of Object.entries(QUERIES)) {
        if (window.matchMedia(query).matches) {
            return key as Breakpoint;
        }
    }
    return 'desktop';
}

export function useBreakpoint(): Breakpoint {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>(getActiveBreakpoint);

    useEffect(() => {
        const listeners = Object.entries(QUERIES).map(([_key, query]) => {
            const mql = window.matchMedia(query);
            const handler = () => setBreakpoint(getActiveBreakpoint());
            mql.addEventListener('change', handler);
            return { mql, handler };
        });

        return () => {
            listeners.forEach(({ mql, handler }) => mql.removeEventListener('change', handler));
        };
    }, []);

    return breakpoint;
}
