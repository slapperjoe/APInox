/**
 * Font Detection Utility
 * Detects which fonts are actually installed on the user's system
 */

export interface MonoFont {
    name: string;
    value: string;
    downloadUrl?: string;
}

export const MONOSPACE_FONTS: MonoFont[] = [
    { 
        name: 'Consolas', 
        value: 'Consolas, "Courier New", monospace'
    },
    { 
        name: 'Courier New', 
        value: '"Courier New", Courier, monospace'
    },
    { 
        name: 'Fira Code', 
        value: '"Fira Code", monospace',
        downloadUrl: 'https://github.com/tonsky/FiraCode/releases'
    },
    { 
        name: 'JetBrains Mono', 
        value: '"JetBrains Mono", monospace',
        downloadUrl: 'https://www.jetbrains.com/lp/mono/'
    },
    { 
        name: 'Source Code Pro', 
        value: '"Source Code Pro", monospace',
        downloadUrl: 'https://adobe-fonts.github.io/source-code-pro/'
    },
    { 
        name: 'Monaco', 
        value: 'Monaco, monospace'
    },
    { 
        name: 'Menlo', 
        value: 'Menlo, Monaco, monospace'
    },
    { 
        name: 'Cascadia Code', 
        value: '"Cascadia Code", monospace',
        downloadUrl: 'https://github.com/microsoft/cascadia-code/releases'
    },
    { 
        name: 'SF Mono', 
        value: '"SF Mono", Monaco, monospace'
    },
    { 
        name: 'Roboto Mono', 
        value: '"Roboto Mono", monospace',
        downloadUrl: 'https://fonts.google.com/specimen/Roboto+Mono'
    },
    { 
        name: 'Ubuntu Mono', 
        value: '"Ubuntu Mono", monospace',
        downloadUrl: 'https://fonts.google.com/specimen/Ubuntu+Mono'
    },
    { 
        name: 'Lucida Console', 
        value: '"Lucida Console", Monaco, monospace'
    }
];

/**
 * Check if a font is installed by measuring text width
 * Uses a canvas to compare widths of text rendered in the test font vs fallback
 */
function isFontInstalled(fontName: string): boolean {
    // Create a canvas element for text measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
        return false;
    }

    // Test string with varied characters
    const testString = 'mmmmmmmmmmlli';
    const fontSize = '72px';
    
    // Measure with fallback font
    context.font = `${fontSize} monospace`;
    const fallbackWidth = context.measureText(testString).width;
    
    // Measure with test font
    context.font = `${fontSize} "${fontName}", monospace`;
    const testWidth = context.measureText(testString).width;
    
    // If widths differ, the font is installed
    return Math.abs(testWidth - fallbackWidth) > 0.1;
}

/**
 * Get list of installed fonts from the available fonts list
 */
export function getInstalledFonts(): MonoFont[] {
    const installed = MONOSPACE_FONTS.filter(font => {
        // Extract the primary font name from the value
        const match = font.value.match(/^["']?([^,"']+)["']?/);
        if (!match) return false;
        
        const primaryFontName = match[1];
        return isFontInstalled(primaryFontName);
    });
    
    return installed;
}

/**
 * Get fonts that are in the list but not installed
 */
export function getMissingFonts(): MonoFont[] {
    const installed = new Set(getInstalledFonts().map(f => f.name));
    return MONOSPACE_FONTS.filter(f => !installed.has(f.name));
}
