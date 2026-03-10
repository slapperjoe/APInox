import { useBreakpoint } from './useBreakpoint';

export interface MobileLayout {
    isPhone: boolean;
    isSmall: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    /** True for any width below the tablet split-screen threshold (< 900px) */
    isMobile: boolean;
}

export function useMobileLayout(): MobileLayout {
    const bp = useBreakpoint();
    return {
        isPhone: bp === 'phone',
        isSmall: bp === 'small',
        isTablet: bp === 'tablet',
        isDesktop: bp === 'desktop',
        isMobile: bp === 'phone' || bp === 'small',
    };
}
