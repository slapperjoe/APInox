/**
 * themes.ts
 * 
 * Complete theme definitions for APInox with all CSS variables.
 * Includes Dark, Light, Solarized Dark, and Solarized Light themes.
 * Variables use --apinox- prefix to distinguish from VS Code theming.
 */

export interface Theme {
    name: string;
    variables: Record<string, string>;
}

// VSCode Dark+ Theme
export const darkTheme: Theme = {
    name: 'Dark',
    variables: {
        // Font
        '--apinox-font-family': '"Segoe UI", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': 'Consolas, "Courier New", monospace',

        // Editor
        '--apinox-editor-background': '#1e1e1e',
        '--apinox-editor-foreground': '#d4d4d4',
        '--apinox-editor-selectionBackground': '#264f78',
        '--apinox-editor-inactiveSelectionBackground': '#3a3d41',
        '--apinox-editor-lineHighlightBackground': '#2a2d2e',
        '--apinox-editor-font-size': '14px',
        '--apinox-editorCursor-foreground': '#aeafad',
        '--apinox-editorWhitespace-foreground': '#404040',
        '--apinox-editorLineNumber-foreground': '#858585',
        '--apinox-editorLineNumber-activeForeground': '#c6c6c6',
        '--apinox-editorError-foreground': '#f48771',
        '--apinox-editorWarning-foreground': '#cca700',
        '--apinox-editorInfo-foreground': '#75beff',
        '--apinox-editorWidget-background': '#252526',
        '--apinox-editorWidget-foreground': '#cccccc',
        '--apinox-editorWidget-border': '#454545',

        // Sidebar
        '--apinox-sideBar-background': '#252526',
        '--apinox-sideBar-foreground': '#cccccc',
        '--apinox-sideBarTitle-foreground': '#bbbbbb',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#cccccc',
        '--apinox-sideBarSectionHeader-border': 'rgba(204, 204, 204, 0.2)',

        // Lists and Trees
        '--apinox-list-hoverBackground': '#2a2d2e',
        '--apinox-list-activeSelectionBackground': '#37373d',
        '--apinox-list-activeSelectionForeground': '#ffffff',
        '--apinox-list-inactiveSelectionBackground': '#37373d',
        '--apinox-list-inactiveSelectionForeground': '#ffffff',
        '--apinox-list-focusBackground': '#062f4a',
        '--apinox-list-focusForeground': '#ffffff',

        // Buttons
        '--apinox-button-background': '#0e639c',
        '--apinox-button-foreground': '#ffffff',
        '--apinox-button-hoverBackground': '#1177bb',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': '#3a3d41',
        '--apinox-button-secondaryForeground': '#cccccc',
        '--apinox-button-secondaryHoverBackground': '#45494e',

        // Inputs
        '--apinox-input-background': '#3c3c3c',
        '--apinox-input-foreground': '#cccccc',
        '--apinox-input-border': '#3c3c3c',
        '--apinox-input-placeholderForeground': '#8b949e',
        '--apinox-inputOption-activeBackground': '#007acc4d',
        '--apinox-inputOption-activeForeground': '#ffffff',
        '--apinox-inputValidation-errorBackground': '#5a1d1d',
        '--apinox-inputValidation-errorBorder': '#be1100',
        '--apinox-inputValidation-errorForeground': '#f48771',
        '--apinox-inputValidation-warningBackground': '#352a05',
        '--apinox-inputValidation-warningBorder': '#b89500',
        '--apinox-inputValidation-warningForeground': '#cca700',
        '--apinox-inputValidation-infoBackground': '#063b49',
        '--apinox-inputValidation-infoBorder': '#007acc',
        '--apinox-inputValidation-infoForeground': '#75beff',

        // Dropdowns
        '--apinox-dropdown-background': '#3c3c3c',
        '--apinox-dropdown-foreground': '#cccccc',
        '--apinox-dropdown-border': '#3c3c3c',
        '--apinox-dropdown-listBackground': '#252526',

        // Panels and Borders
        '--apinox-panel-background': '#1e1e1e',
        '--apinox-panel-border': '#80808059',
        '--apinox-panelTitle-activeBorder': '#e7e7e7',
        '--apinox-panelTitle-activeForeground': '#e7e7e7',
        '--apinox-panelTitle-inactiveForeground': '#e7e7e799',

        // Surface / Border tokens (used by proxy/traffic components)
        '--apinox-surface-elevated': '#2d2d30',
        '--apinox-border-default': '#3e3e42',
        '--apinox-border-subtle': '#555555',

        // Status Bar
        '--apinox-statusBar-background': '#007acc',
        '--apinox-statusBar-foreground': '#ffffff',
        '--apinox-statusBar-noFolderBackground': '#68217a',
        '--apinox-statusBar-debuggingBackground': '#cc6633',

        // Activity Bar
        '--apinox-activityBar-background': '#333333',
        '--apinox-activityBar-foreground': '#ffffff',
        '--apinox-activityBar-inactiveForeground': '#c5c5c5',
        '--apinox-activityBar-border': '#252526',
        '--apinox-activityBar-activeBorder': '#007fd4',
        '--apinox-activityBarBadge-background': '#007acc',
        '--apinox-activityBarBadge-foreground': '#ffffff',

        // Badges and Notifications
        '--apinox-badge-background': '#4d4d4d',
        '--apinox-badge-foreground': '#ffffff',
        '--apinox-notifications-background': '#252526',
        '--apinox-notifications-border': '#303031',
        '--apinox-notificationCenter-border': '#303031',
        '--apinox-notificationToast-border': '#303031',
        '--apinox-notificationsInfoIcon-foreground': '#75beff',

        // Scrollbars
        '--apinox-scrollbar-shadow': '#000000',
        '--apinox-scrollbarSlider-background': '#79797966',
        '--apinox-scrollbarSlider-hoverBackground': '#646464b3',
        '--apinox-scrollbarSlider-activeBackground': '#bfbfbf66',

        // Focus and Borders
        '--apinox-focusBorder': '#007fd4',
        '--apinox-contrastBorder': '#6fc3df00',
        '--apinox-contrastActiveBorder': '#f38518',

        // Text and Links
        '--apinox-foreground': '#cccccc',
        '--apinox-descriptionForeground': '#8b949e',
        '--apinox-disabledForeground': '#656565',
        '--apinox-errorForeground': '#f48771',
        '--apinox-textLink-foreground': '#3794ff',
        '--apinox-textLink-activeForeground': '#3794ff',
        '--apinox-textCodeBlock-background': '#0a0a0a66',
        '--apinox-textPreformat-foreground': '#d7ba7d',
        '--apinox-textBlockQuote-background': '#7f7f7f1a',
        '--apinox-textBlockQuote-border': '#007acc80',

        // Menus
        '--apinox-menu-background': '#3c3c3c',
        '--apinox-menu-foreground': '#cccccc',
        '--apinox-menu-border': '#454545',
        '--apinox-menu-selectionBackground': '#094771',
        '--apinox-menu-selectionForeground': '#ffffff',
        '--apinox-menu-separatorBackground': '#606060',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(90, 93, 94, 0.31)',
        '--apinox-toolbar-activeBackground': 'rgba(99, 102, 103, 0.4)',

        // Icons
        '--apinox-icon-foreground': '#c5c5c5',

        // Charts
        '--apinox-charts-foreground': '#cccccc',
        '--apinox-charts-green': '#89d185',
        '--apinox-charts-blue': '#75beff',
        '--apinox-charts-purple': '#c586c0',
        '--apinox-charts-orange': '#d18616',
        '--apinox-charts-red': '#f48771',
        '--apinox-charts-yellow': '#cca700',

        // Widget (overlays, modals)
        '--apinox-widget-shadow': 'rgba(0, 0, 0, 0.36)',
        '--apinox-widget-border': '#303031',

        // Syntax-related (for Monaco)
        '--apinox-editorBracketHighlight-foreground1': '#ffd700',
        '--apinox-editorBracketHighlight-foreground2': '#da70d6',
        '--apinox-editorBracketHighlight-foreground3': '#179fff',
        '--apinox-editorBracketHighlight-foreground4': '#4ec9b0',
        '--apinox-editorBracketHighlight-foreground5': '#c586c0',
        '--apinox-editorBracketHighlight-foreground6': '#dcdcaa',

        // Testing and Debugging
        '--apinox-testing-iconPassed': '#73c991',
        '--apinox-testing-iconFailed': '#f48771',
        '--apinox-testing-iconQueued': '#cca700',
        '--apinox-debugIcon-breakpointForeground': '#e51400',
        '--apinox-debugTokenExpression-name': '#c586c0',
        
        // Diff Editor
        '--apinox-diffEditor-insertedTextBackground': '#9bb955aa',
        '--apinox-diffEditor-removedTextBackground': '#ff000033',
        
        // Tabs
        '--apinox-tab-activeBackground': '#1e1e1e',
        '--apinox-tab-activeForeground': '#ffffff',
        '--apinox-tab-inactiveForeground': '#969696',
        
        // Progress Bar
        '--apinox-progressBar-background': '#0e70c0',
        
        // Symbol Icons
        '--apinox-symbolIcon-classForeground': '#ee9d28',
        '--apinox-symbolIcon-fieldForeground': '#75beff',
        '--apinox-symbolIcon-propertyForeground': '#75beff',
        '--apinox-symbolIcon-variableForeground': '#75beff',
        '--apinox-symbolIcon-stringForeground': '#ce9178',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': '#181818',
        '--apinox-text-faint': '#555555',
        '--apinox-surface-danger': '#5a2e2e',
        '--apinox-surface-danger-dark': '#6b1010',
        '--apinox-surface-success-dark': '#106b21',
        '--apinox-surface-tag': '#1e4a7a',
        '--apinox-text-danger': '#ff6b6b',
        '--apinox-text-tag': '#90caf9',
    },
};

// VSCode Light+ Theme
export const lightTheme: Theme = {
    name: 'Light',
    variables: {
        // Font
        '--apinox-font-family': '"Segoe UI", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': 'Consolas, "Courier New", monospace',

        // Editor
        '--apinox-editor-background': '#ffffff',
        '--apinox-editor-foreground': '#000000',
        '--apinox-editor-selectionBackground': '#add6ff',
        '--apinox-editor-inactiveSelectionBackground': '#e5ebf1',
        '--apinox-editor-lineHighlightBackground': '#f0f0f0',
        '--apinox-editorCursor-foreground': '#000000',
        '--apinox-editorWhitespace-foreground': '#d3d3d3',

        // Sidebar
        '--apinox-sideBar-background': '#f3f3f3',
        '--apinox-sideBar-foreground': '#3b3b3b',
        '--apinox-sideBarTitle-foreground': '#383838',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#3b3b3b',
        '--apinox-sideBarSectionHeader-border': 'rgba(97, 97, 97, 0.2)',

        // Lists and Trees
        '--apinox-list-hoverBackground': '#e8e8e8',
        '--apinox-list-activeSelectionBackground': '#0060c0',
        '--apinox-list-activeSelectionForeground': '#ffffff',
        '--apinox-list-inactiveSelectionBackground': '#e4e6f1',
        '--apinox-list-inactiveSelectionForeground': '#000000',
        '--apinox-list-focusBackground': '#d6ebff',
        '--apinox-list-focusForeground': '#000000',

        // Buttons
        '--apinox-button-background': '#007acc',
        '--apinox-button-foreground': '#ffffff',
        '--apinox-button-hoverBackground': '#0062a3',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': '#e7e7e7',
        '--apinox-button-secondaryForeground': '#000000',
        '--apinox-button-secondaryHoverBackground': '#d7d7d7',

        // Inputs
        '--apinox-input-background': '#ffffff',
        '--apinox-input-foreground': '#000000',
        '--apinox-input-border': '#cecece',
        '--apinox-input-placeholderForeground': '#767676',
        '--apinox-inputOption-activeBackground': '#007acc4d',
        '--apinox-inputOption-activeForeground': '#000000',

        // Dropdowns
        '--apinox-dropdown-background': '#ffffff',
        '--apinox-dropdown-foreground': '#000000',
        '--apinox-dropdown-border': '#cecece',
        '--apinox-dropdown-listBackground': '#ffffff',

        // Panels and Borders
        '--apinox-panel-background': '#ffffff',
        '--apinox-panel-border': '#80808059',
        '--apinox-panelTitle-activeBorder': '#424242',
        '--apinox-panelTitle-activeForeground': '#424242',
        '--apinox-panelTitle-inactiveForeground': '#424242b3',

        // Surface / Border tokens (used by proxy/traffic components)
        '--apinox-surface-elevated': '#ebebeb',
        '--apinox-border-default': '#d4d4d4',
        '--apinox-border-subtle': '#c0c0c0',
        '--apinox-statusBar-foreground': '#ffffff',
        '--apinox-statusBar-noFolderBackground': '#68217a',
        '--apinox-statusBar-debuggingBackground': '#cc6633',

        // Activity Bar
        '--apinox-activityBar-background': '#2c2c2c',
        '--apinox-activityBar-foreground': '#ffffff',
        '--apinox-activityBar-inactiveForeground': '#b0b0b0',
        '--apinox-activityBarBadge-background': '#007acc',
        '--apinox-activityBarBadge-foreground': '#ffffff',

        // Badges and Notifications
        '--apinox-badge-background': '#c4c4c4',
        '--apinox-badge-foreground': '#333333',
        '--apinox-notificationCenter-border': '#d4d4d4',
        '--apinox-notificationToast-border': '#d4d4d4',

        // Scrollbars
        '--apinox-scrollbar-shadow': '#dddddd',
        '--apinox-scrollbarSlider-background': '#64646466',
        '--apinox-scrollbarSlider-hoverBackground': '#646464b3',
        '--apinox-scrollbarSlider-activeBackground': '#00000099',

        // Focus and Borders
        '--apinox-focusBorder': '#0090f1',
        '--apinox-contrastBorder': '#6fc3df00',
        '--apinox-contrastActiveBorder': '#f38518',

        // Text and Links
        '--apinox-foreground': '#3b3b3b',
        '--apinox-descriptionForeground': '#717171',
        '--apinox-disabledForeground': '#717171',
        '--apinox-errorForeground': '#a1260d',
        '--apinox-textLink-foreground': '#006ab1',
        '--apinox-textLink-activeForeground': '#006ab1',
        '--apinox-textCodeBlock-background': '#dcdcdc66',
        '--apinox-textPreformat-foreground': '#a31515',
        '--apinox-textBlockQuote-background': '#7f7f7f1a',
        '--apinox-textBlockQuote-border': '#007acc80',

        // Menus
        '--apinox-menu-background': '#ffffff',
        '--apinox-menu-foreground': '#3b3b3b',
        '--apinox-menu-border': '#d4d4d4',
        '--apinox-menu-selectionBackground': '#0060c0',
        '--apinox-menu-selectionForeground': '#ffffff',
        '--apinox-menu-separatorBackground': '#d4d4d4',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(184, 184, 184, 0.31)',
        '--apinox-toolbar-activeBackground': 'rgba(166, 166, 166, 0.4)',

        // Icons
        '--apinox-icon-foreground': '#424242',

        // Charts
        '--apinox-charts-green': '#388a34',
        '--apinox-charts-blue': '#0e639c',
        '--apinox-charts-purple': '#6f4fa7',
        '--apinox-charts-orange': '#ba6233',

        // Widget (overlays, modals)
        '--apinox-widget-shadow': 'rgba(0, 0, 0, 0.16)',
        '--apinox-widget-border': '#c8c8c8',

        // Syntax-related (for Monaco)
        '--apinox-editorBracketHighlight-foreground1': '#0431fa',
        '--apinox-editorBracketHighlight-foreground2': '#319331',
        '--apinox-editorBracketHighlight-foreground3': '#7b3814',
        '--apinox-editorBracketHighlight-foreground4': '#0e7c7c',
        '--apinox-editorBracketHighlight-foreground5': '#af00db',
        '--apinox-editorBracketHighlight-foreground6': '#811f3f',

        // Testing-related
        '--apinox-testing-iconPassed': '#388a34',
        '--apinox-testing-iconFailed': '#d73a49',
        '--apinox-testing-iconQueued': '#9a6700',
        
        // Tabs
        '--apinox-tab-activeBackground': '#ffffff',
        '--apinox-tab-activeForeground': '#000000',
        '--apinox-tab-inactiveForeground': '#717171',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': '#e8e8e8',
        '--apinox-text-faint': '#aaaaaa',
        '--apinox-surface-danger': '#fce8e8',
        '--apinox-surface-danger-dark': '#c62828',
        '--apinox-surface-success-dark': '#2e7d32',
        '--apinox-surface-tag': '#deeaf7',
        '--apinox-text-danger': '#c62828',
        '--apinox-text-tag': '#1565c0',
    },
};

// Solarized Dark Theme
export const solarizedDarkTheme: Theme = {
    name: 'Solarized Dark',
    variables: {
        // Font
        '--apinox-font-family': '"Segoe UI", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': 'Consolas, "Courier New", monospace',

        // Solarized Dark Palette
        // base03:  #002b36, base02:  #073642, base01:  #586e75, base00:  #657b83
        // base0:   #839496, base1:   #93a1a1, base2:   #eee8d5, base3:   #fdf6e3
        // yellow:  #b58900, orange:  #cb4b16, red:     #dc322f, magenta: #d33682
        // violet:  #6c71c4, blue:    #268bd2, cyan:    #2aa198, green:   #859900

        // Editor
        '--apinox-editor-background': '#002b36',
        '--apinox-editor-foreground': '#839496',
        '--apinox-editor-selectionBackground': '#073642',
        '--apinox-editor-inactiveSelectionBackground': '#003847',
        '--apinox-editor-lineHighlightBackground': '#073642',
        '--apinox-editorCursor-foreground': '#839496',
        '--apinox-editorWhitespace-foreground': '#073642',

        // Sidebar
        '--apinox-sideBar-background': '#073642',
        '--apinox-sideBar-foreground': '#93a1a1',
        '--apinox-sideBarTitle-foreground': '#93a1a1',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#93a1a1',
        '--apinox-sideBarSectionHeader-border': 'rgba(147, 161, 161, 0.2)',

        // Lists and Trees
        '--apinox-list-hoverBackground': '#073642',
        '--apinox-list-activeSelectionBackground': '#586e75',
        '--apinox-list-activeSelectionForeground': '#fdf6e3',
        '--apinox-list-inactiveSelectionBackground': '#073642',
        '--apinox-list-inactiveSelectionForeground': '#93a1a1',
        '--apinox-list-focusBackground': '#268bd2',
        '--apinox-list-focusForeground': '#fdf6e3',

        // Buttons
        '--apinox-button-background': '#268bd2',
        '--apinox-button-foreground': '#fdf6e3',
        '--apinox-button-hoverBackground': '#2aa198',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': '#586e75',
        '--apinox-button-secondaryForeground': '#eee8d5',
        '--apinox-button-secondaryHoverBackground': '#657b83',

        // Inputs
        '--apinox-input-background': '#073642',
        '--apinox-input-foreground': '#93a1a1',
        '--apinox-input-border': '#586e75',
        '--apinox-input-placeholderForeground': '#586e75',
        '--apinox-inputOption-activeBackground': '#268bd24d',
        '--apinox-inputOption-activeForeground': '#fdf6e3',

        // Dropdowns
        '--apinox-dropdown-background': '#073642',
        '--apinox-dropdown-foreground': '#93a1a1',
        '--apinox-dropdown-border': '#586e75',
        '--apinox-dropdown-listBackground': '#002b36',

        // Panels and Borders
        '--apinox-panel-background': '#002b36',
        '--apinox-panel-border': '#586e7559',
        '--apinox-panelTitle-activeBorder': '#268bd2',
        '--apinox-panelTitle-activeForeground': '#93a1a1',
        '--apinox-panelTitle-inactiveForeground': '#586e75',

        // Surface / Border tokens (used by proxy/traffic components)
        '--apinox-surface-elevated': '#073642',
        '--apinox-border-default': '#586e75',
        '--apinox-border-subtle': '#657b83',

        // Status Bar
        '--apinox-statusBar-background': '#268bd2',
        '--apinox-statusBar-foreground': '#fdf6e3',
        '--apinox-statusBar-noFolderBackground': '#6c71c4',
        '--apinox-statusBar-debuggingBackground': '#cb4b16',

        // Activity Bar
        '--apinox-activityBar-background': '#073642',
        '--apinox-activityBar-foreground': '#93a1a1',
        '--apinox-activityBar-inactiveForeground': '#839496',
        '--apinox-activityBarBadge-background': '#268bd2',
        '--apinox-activityBarBadge-foreground': '#fdf6e3',

        // Badges and Notifications
        '--apinox-badge-background': '#268bd2',
        '--apinox-badge-foreground': '#fdf6e3',
        '--apinox-notificationCenter-border': '#586e75',
        '--apinox-notificationToast-border': '#586e75',

        // Scrollbars
        '--apinox-scrollbar-shadow': '#000000',
        '--apinox-scrollbarSlider-background': '#586e7566',
        '--apinox-scrollbarSlider-hoverBackground': '#586e75b3',
        '--apinox-scrollbarSlider-activeBackground': '#93a1a166',

        // Focus and Borders
        '--apinox-focusBorder': '#268bd2',
        '--apinox-contrastBorder': '#6fc3df00',
        '--apinox-contrastActiveBorder': '#cb4b16',

        // Text and Links
        '--apinox-foreground': '#839496',
        '--apinox-descriptionForeground': '#586e75',
        '--apinox-disabledForeground': '#586e75',
        '--apinox-errorForeground': '#dc322f',
        '--apinox-textPreformat-foreground': '#b58900',
        '--apinox-textBlockQuote-background': '#07364266',
        '--apinox-textBlockQuote-border': '#268bd280',

        // Menus
        '--apinox-menu-background': '#073642',
        '--apinox-menu-foreground': '#93a1a1',
        '--apinox-menu-border': '#586e75',
        '--apinox-menu-selectionBackground': '#268bd2',
        '--apinox-menu-selectionForeground': '#fdf6e3',
        '--apinox-menu-separatorBackground': '#586e75',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(88, 110, 117, 0.31)',
        '--apinox-toolbar-activeBackground': 'rgba(88, 110, 117, 0.4)',

        // Icons
        '--apinox-icon-foreground': '#93a1a1',

        // Charts
        '--apinox-charts-green': '#859900',
        '--apinox-charts-blue': '#268bd2',
        '--apinox-charts-purple': '#6c71c4',
        '--apinox-charts-orange': '#a95a38',

        // Widget (overlays, modals)
        '--apinox-widget-shadow': 'rgba(0, 0, 0, 0.5)',
        '--apinox-widget-border': '#586e75',

        // Syntax-related (for Monaco)
        '--apinox-editorBracketHighlight-foreground1': '#b58900',
        '--apinox-editorBracketHighlight-foreground2': '#d33682',
        '--apinox-editorBracketHighlight-foreground3': '#268bd2',
        '--apinox-editorBracketHighlight-foreground4': '#2aa198',
        '--apinox-editorBracketHighlight-foreground5': '#6c71c4',
        '--apinox-editorBracketHighlight-foreground6': '#859900',

        // Testing-related
        '--apinox-testing-iconPassed': '#859900',
        '--apinox-testing-iconFailed': '#dc322f',
        '--apinox-testing-iconQueued': '#b58900',
        
        // Tabs
        '--apinox-tab-activeBackground': '#073642',
        '--apinox-tab-activeForeground': '#93a1a1',
        '--apinox-tab-inactiveForeground': '#586e75',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': '#001f29',
        '--apinox-text-faint': '#3a5258',
        '--apinox-surface-danger': '#3a1515',
        '--apinox-surface-danger-dark': '#5a0000',
        '--apinox-surface-success-dark': '#0d4d1f',
        '--apinox-surface-tag': '#0d3655',
        '--apinox-text-danger': '#dc322f',
        '--apinox-text-tag': '#7ec8f7',
    },
};

// Solarized Light Theme
export const solarizedLightTheme: Theme = {
    name: 'Solarized Light',
    variables: {
        // Font
        '--apinox-font-family': '"Segoe UI", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': 'Consolas, "Courier New", monospace',

        // Editor
        '--apinox-editor-background': '#fdf6e3',
        '--apinox-editor-foreground': '#657b83',
        '--apinox-editor-selectionBackground': '#eee8d5',
        '--apinox-editor-inactiveSelectionBackground': '#f5f0dc',
        '--apinox-editor-lineHighlightBackground': '#eee8d5',
        '--apinox-editorCursor-foreground': '#657b83',
        '--apinox-editorWhitespace-foreground': '#eee8d5',

        // Sidebar
        '--apinox-sideBar-background': '#eee8d5',
        '--apinox-sideBar-foreground': '#586e75',
        '--apinox-sideBarTitle-foreground': '#586e75',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#586e75',
        '--apinox-sideBarSectionHeader-border': 'rgba(88, 110, 117, 0.2)',

        // Lists and Trees
        '--apinox-list-hoverBackground': '#e8e2cd',
        '--apinox-list-activeSelectionBackground': '#93a1a1',
        '--apinox-list-activeSelectionForeground': '#002b36',
        '--apinox-list-inactiveSelectionBackground': '#eee8d5',
        '--apinox-list-inactiveSelectionForeground': '#586e75',
        '--apinox-list-focusBackground': '#268bd2',
        '--apinox-list-focusForeground': '#fdf6e3',

        // Buttons
        '--apinox-button-background': '#268bd2',
        '--apinox-button-foreground': '#fdf6e3',
        '--apinox-button-hoverBackground': '#2aa198',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': '#93a1a1',
        '--apinox-button-secondaryForeground': '#002b36',
        '--apinox-button-secondaryHoverBackground': '#839496',

        // Inputs
        '--apinox-input-background': '#eee8d5',
        '--apinox-input-foreground': '#586e75',
        '--apinox-input-border': '#93a1a1',
        '--apinox-input-placeholderForeground': '#93a1a1',
        '--apinox-inputOption-activeBackground': '#268bd24d',
        '--apinox-inputOption-activeForeground': '#002b36',

        // Dropdowns
        '--apinox-dropdown-background': '#eee8d5',
        '--apinox-dropdown-foreground': '#586e75',
        '--apinox-dropdown-border': '#93a1a1',
        '--apinox-dropdown-listBackground': '#fdf6e3',

        // Panels and Borders
        '--apinox-panel-background': '#fdf6e3',
        '--apinox-panel-border': '#93a1a159',
        '--apinox-panelTitle-activeBorder': '#268bd2',
        '--apinox-panelTitle-activeForeground': '#586e75',
        '--apinox-panelTitle-inactiveForeground': '#93a1a1',

        // Surface / Border tokens (used by proxy/traffic components)
        '--apinox-surface-elevated': '#eee8d5',
        '--apinox-border-default': '#93a1a1',
        '--apinox-border-subtle': '#adb6b3',

        // Status Bar
        '--apinox-statusBar-background': '#268bd2',
        '--apinox-statusBar-foreground': '#fdf6e3',
        '--apinox-statusBar-noFolderBackground': '#6c71c4',
        '--apinox-statusBar-debuggingBackground': '#cb4b16',

        // Activity Bar
        '--apinox-activityBar-background': '#eee8d5',
        '--apinox-activityBar-foreground': '#586e75',
        '--apinox-activityBar-inactiveForeground': '#7b8790',
        '--apinox-activityBarBadge-background': '#268bd2',
        '--apinox-activityBarBadge-foreground': '#fdf6e3',

        // Badges and Notifications
        '--apinox-badge-background': '#268bd2',
        '--apinox-badge-foreground': '#fdf6e3',
        '--apinox-notificationCenter-border': '#93a1a1',
        '--apinox-notificationToast-border': '#93a1a1',

        // Scrollbars
        '--apinox-scrollbar-shadow': '#cccccc',
        '--apinox-scrollbarSlider-background': '#93a1a166',
        '--apinox-scrollbarSlider-hoverBackground': '#93a1a1b3',
        '--apinox-scrollbarSlider-activeBackground': '#586e7599',

        // Focus and Borders
        '--apinox-focusBorder': '#268bd2',
        '--apinox-contrastBorder': '#6fc3df00',
        '--apinox-contrastActiveBorder': '#cb4b16',

        // Text and Links
        '--apinox-foreground': '#657b83',
        '--apinox-descriptionForeground': '#93a1a1',
        '--apinox-disabledForeground': '#93a1a1',
        '--apinox-errorForeground': '#dc322f',
        '--apinox-textLink-foreground': '#268bd2',
        '--apinox-textLink-activeForeground': '#2aa198',
        '--apinox-textCodeBlock-background': '#eee8d5',
        '--apinox-textPreformat-foreground': '#b58900',
        '--apinox-textBlockQuote-background': '#eee8d566',
        '--apinox-textBlockQuote-border': '#268bd280',

        // Menus
        '--apinox-menu-background': '#fdf6e3',
        '--apinox-menu-foreground': '#586e75',
        '--apinox-menu-border': '#93a1a1',
        '--apinox-menu-selectionBackground': '#268bd2',
        '--apinox-menu-selectionForeground': '#fdf6e3',
        '--apinox-menu-separatorBackground': '#93a1a1',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(147, 161, 161, 0.31)',
        '--apinox-toolbar-activeBackground': 'rgba(147, 161, 161, 0.4)',

        // Icons
        '--apinox-icon-foreground': '#586e75',

        // Charts
        '--apinox-charts-green': '#859900',
        '--apinox-charts-blue': '#268bd2',
        '--apinox-charts-purple': '#6c71c4',
        '--apinox-charts-orange': '#b15d39',

        // Widget (overlays, modals)
        '--apinox-widget-shadow': 'rgba(0, 0, 0, 0.16)',
        '--apinox-widget-border': '#93a1a1',

        // Syntax-related (for Monaco)
        '--apinox-editorBracketHighlight-foreground1': '#b58900',
        '--apinox-editorBracketHighlight-foreground2': '#d33682',
        '--apinox-editorBracketHighlight-foreground3': '#268bd2',
        '--apinox-editorBracketHighlight-foreground4': '#2aa198',
        '--apinox-editorBracketHighlight-foreground5': '#6c71c4',
        '--apinox-editorBracketHighlight-foreground6': '#859900',

        // Testing-related
        '--apinox-testing-iconPassed': '#859900',
        '--apinox-testing-iconFailed': '#dc322f',
        '--apinox-testing-iconQueued': '#b58900',
        
        // Tabs
        '--apinox-tab-activeBackground': '#eee8d5',
        '--apinox-tab-activeForeground': '#586e75',
        '--apinox-tab-inactiveForeground': '#93a1a1',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': '#f0e9d0',
        '--apinox-text-faint': '#99a9a5',
        '--apinox-surface-danger': '#fce0e0',
        '--apinox-surface-danger-dark': '#c62828',
        '--apinox-surface-success-dark': '#2e7d32',
        '--apinox-surface-tag': '#d0e8f7',
        '--apinox-text-danger': '#c62828',
        '--apinox-text-tag': '#1565c0',
    },
};

// Zed Dark Theme (One Dark Pro / Zed-inspired warm-blue palette)
export const zedDarkTheme: Theme = {
    name: 'Zed Dark',
    variables: {
        // Font — monospace-forward like Zed
        '--apinox-font-family': '"JetBrains Mono", "Fira Code", "Cascadia Code", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': '"JetBrains Mono", "Fira Code", Consolas, monospace',
        '--apinox-editor-font-size': '14px',

        // Editor
        '--apinox-editor-background': '#212337',
        '--apinox-editor-foreground': '#c8d3f5',
        '--apinox-editor-selectionBackground': '#2f3354',
        '--apinox-editor-inactiveSelectionBackground': '#2a2e4a',
        '--apinox-editor-lineHighlightBackground': '#2a2e4a',
        '--apinox-editorCursor-foreground': '#82aaff',
        '--apinox-editorWhitespace-foreground': '#3b3f5c',
        '--apinox-editorLineNumber-foreground': '#464b6e',
        '--apinox-editorLineNumber-activeForeground': '#82aaff',
        '--apinox-editorError-foreground': '#ff757f',
        '--apinox-editorWarning-foreground': '#ffc777',
        '--apinox-editorInfo-foreground': '#82aaff',
        '--apinox-editorWidget-background': '#1e2030',
        '--apinox-editorWidget-foreground': '#c8d3f5',
        '--apinox-editorWidget-border': 'rgba(255,255,255,0.08)',

        // Sidebar
        '--apinox-sideBar-background': '#1a1b2e',
        '--apinox-sideBar-foreground': '#c8d3f5',
        '--apinox-sideBarTitle-foreground': '#737aa2',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#737aa2',
        '--apinox-sideBarSectionHeader-border': 'rgba(255,255,255,0.06)',

        // Lists and Trees
        '--apinox-list-hoverBackground': '#2a2e4a',
        '--apinox-list-activeSelectionBackground': '#2f3354',
        '--apinox-list-activeSelectionForeground': '#c8d3f5',
        '--apinox-list-inactiveSelectionBackground': '#252840',
        '--apinox-list-inactiveSelectionForeground': '#c8d3f5',
        '--apinox-list-focusBackground': '#2f3354',
        '--apinox-list-focusForeground': '#c8d3f5',

        // Buttons
        '--apinox-button-background': '#82aaff',
        '--apinox-button-foreground': '#1e2030',
        '--apinox-button-hoverBackground': '#9ab8ff',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': '#2f3354',
        '--apinox-button-secondaryForeground': '#c8d3f5',
        '--apinox-button-secondaryHoverBackground': '#3a3f60',

        // Inputs
        '--apinox-input-background': '#2a2e4a',
        '--apinox-input-foreground': '#c8d3f5',
        '--apinox-input-border': 'rgba(255,255,255,0.08)',
        '--apinox-input-placeholderForeground': '#737aa2',
        '--apinox-inputOption-activeBackground': '#82aaff33',
        '--apinox-inputOption-activeForeground': '#c8d3f5',
        '--apinox-inputValidation-errorBackground': '#4a1a20',
        '--apinox-inputValidation-errorBorder': '#ff757f',
        '--apinox-inputValidation-errorForeground': '#ff757f',
        '--apinox-inputValidation-warningBackground': '#3d2e10',
        '--apinox-inputValidation-warningBorder': '#ffc777',
        '--apinox-inputValidation-warningForeground': '#ffc777',
        '--apinox-inputValidation-infoBackground': '#1a2a4a',
        '--apinox-inputValidation-infoBorder': '#82aaff',
        '--apinox-inputValidation-infoForeground': '#82aaff',

        // Dropdowns
        '--apinox-dropdown-background': '#2a2e4a',
        '--apinox-dropdown-foreground': '#c8d3f5',
        '--apinox-dropdown-border': 'rgba(255,255,255,0.08)',
        '--apinox-dropdown-listBackground': '#1e2030',

        // Panels and Borders
        '--apinox-panel-background': '#1e2030',
        '--apinox-panel-border': 'rgba(255,255,255,0.07)',
        '--apinox-panelTitle-activeBorder': '#82aaff',
        '--apinox-panelTitle-activeForeground': '#c8d3f5',
        '--apinox-panelTitle-inactiveForeground': '#737aa299',

        // Surface / Border tokens
        '--apinox-surface-elevated': '#252840',
        '--apinox-border-default': 'rgba(255,255,255,0.1)',
        '--apinox-border-subtle': 'rgba(255,255,255,0.06)',

        // Status Bar
        '--apinox-statusBar-background': '#1a1b2e',
        '--apinox-statusBar-foreground': '#737aa2',
        '--apinox-statusBar-noFolderBackground': '#6c71c4',
        '--apinox-statusBar-debuggingBackground': '#cc6633',

        // Activity Bar
        '--apinox-activityBar-background': '#1a1b2e',
        '--apinox-activityBar-foreground': '#c8d3f5',
        '--apinox-activityBar-inactiveForeground': '#737aa2',
        '--apinox-activityBar-border': '#1a1b2e',
        '--apinox-activityBar-activeBorder': '#82aaff',
        '--apinox-activityBarBadge-background': '#82aaff',
        '--apinox-activityBarBadge-foreground': '#1e2030',

        // Title Bar
        '--apinox-titleBar-activeBackground': '#1e2030',
        '--apinox-titleBar-activeForeground': '#c8d3f5',
        '--apinox-titleBar-inactiveBackground': '#1a1b2e',
        '--apinox-titleBar-border': 'rgba(255,255,255,0.07)',

        // Badges
        '--apinox-badge-background': '#82aaff',
        '--apinox-badge-foreground': '#1e2030',
        '--apinox-notifications-background': '#1e2030',
        '--apinox-notifications-border': 'rgba(255,255,255,0.08)',
        '--apinox-notificationCenter-border': 'rgba(255,255,255,0.08)',
        '--apinox-notificationToast-border': 'rgba(255,255,255,0.08)',
        '--apinox-notificationsInfoIcon-foreground': '#82aaff',

        // Scrollbars
        '--apinox-scrollbar-shadow': '#00000040',
        '--apinox-scrollbarSlider-background': '#737aa240',
        '--apinox-scrollbarSlider-hoverBackground': '#737aa280',
        '--apinox-scrollbarSlider-activeBackground': '#82aaff60',

        // Focus and Borders
        '--apinox-focusBorder': '#82aaff',
        '--apinox-contrastBorder': 'transparent',
        '--apinox-contrastActiveBorder': '#82aaff',

        // Text and Links
        '--apinox-foreground': '#c8d3f5',
        '--apinox-descriptionForeground': '#737aa2',
        '--apinox-disabledForeground': '#464b6e',
        '--apinox-errorForeground': '#ff757f',
        '--apinox-textLink-foreground': '#82aaff',
        '--apinox-textLink-activeForeground': '#9ab8ff',
        '--apinox-textCodeBlock-background': '#2a2e4a',
        '--apinox-textPreformat-foreground': '#c3e88d',
        '--apinox-textBlockQuote-background': '#2a2e4a',
        '--apinox-textBlockQuote-border': '#82aaff80',

        // Menus
        '--apinox-menu-background': '#1e2030',
        '--apinox-menu-foreground': '#c8d3f5',
        '--apinox-menu-border': 'rgba(255,255,255,0.1)',
        '--apinox-menu-selectionBackground': '#2f3354',
        '--apinox-menu-selectionForeground': '#c8d3f5',
        '--apinox-menu-separatorBackground': 'rgba(255,255,255,0.08)',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(130,170,255,0.1)',
        '--apinox-toolbar-activeBackground': 'rgba(130,170,255,0.18)',

        // Icons
        '--apinox-icon-foreground': '#737aa2',

        // Charts
        '--apinox-charts-foreground': '#c8d3f5',
        '--apinox-charts-green': '#c3e88d',
        '--apinox-charts-blue': '#82aaff',
        '--apinox-charts-purple': '#c792ea',
        '--apinox-charts-orange': '#ff966c',
        '--apinox-charts-red': '#ff757f',
        '--apinox-charts-yellow': '#ffc777',

        // Widget
        '--apinox-widget-shadow': 'rgba(0,0,0,0.5)',
        '--apinox-widget-border': 'rgba(255,255,255,0.1)',

        // Syntax
        '--apinox-editorBracketHighlight-foreground1': '#ffd700',
        '--apinox-editorBracketHighlight-foreground2': '#c792ea',
        '--apinox-editorBracketHighlight-foreground3': '#82aaff',
        '--apinox-editorBracketHighlight-foreground4': '#4fd6be',
        '--apinox-editorBracketHighlight-foreground5': '#ff966c',
        '--apinox-editorBracketHighlight-foreground6': '#c3e88d',

        // Testing
        '--apinox-testing-iconPassed': '#c3e88d',
        '--apinox-testing-iconFailed': '#ff757f',
        '--apinox-testing-iconQueued': '#ffc777',
        '--apinox-debugIcon-breakpointForeground': '#ff757f',
        '--apinox-debugTokenExpression-name': '#c792ea',

        // Diff
        '--apinox-diffEditor-insertedTextBackground': '#c3e88d22',
        '--apinox-diffEditor-removedTextBackground': '#ff757f22',

        // Tabs
        '--apinox-tab-activeBackground': '#212337',
        '--apinox-tab-activeForeground': '#c8d3f5',
        '--apinox-tab-inactiveForeground': '#737aa2',

        // Progress Bar
        '--apinox-progressBar-background': '#82aaff',

        // Symbol Icons
        '--apinox-symbolIcon-classForeground': '#ffc777',
        '--apinox-symbolIcon-fieldForeground': '#82aaff',
        '--apinox-symbolIcon-propertyForeground': '#82aaff',
        '--apinox-symbolIcon-variableForeground': '#82aaff',
        '--apinox-symbolIcon-stringForeground': '#c3e88d',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': '#161728',
        '--apinox-text-faint': '#3b3f5c',
        '--apinox-surface-danger': '#3a1a20',
        '--apinox-surface-danger-dark': '#5a0010',
        '--apinox-surface-success-dark': '#0d4d1f',
        '--apinox-surface-tag': '#1a2a4a',
        '--apinox-text-danger': '#ff757f',
        '--apinox-text-tag': '#82aaff',
    },
};

// DankShell Light Transparent Theme
// Colors sourced from ~/.config/zed/themes/dank-zed-theme.json "DankShell Light Transparent"
export const dankShellLightTheme: Theme = {
    name: 'DankShell Light',
    variables: {
        // Font
        '--apinox-font-family': '"JetBrains Mono", "Fira Code", system-ui, sans-serif',
        '--apinox-font-size': '13px',
        '--apinox-font-weight': '400',
        '--apinox-editor-font-family': '"JetBrains Mono", "Fira Code", Consolas, monospace',
        '--apinox-editor-font-size': '14px',

        // Editor — #f5fafcB6 with alpha stripped to solid for CSS var use
        '--apinox-editor-background': 'rgba(245,250,252,0.71)',
        '--apinox-editor-foreground': '#171d1e',
        '--apinox-editor-selectionBackground': '#009eaf3D',
        '--apinox-editor-inactiveSelectionBackground': '#009eaf20',
        '--apinox-editor-lineHighlightBackground': 'rgba(233,239,240,0.4)',
        '--apinox-editorCursor-foreground': '#009eaf',
        '--apinox-editorWhitespace-foreground': '#dbe4e633',
        '--apinox-editorLineNumber-foreground': '#3f484a',
        '--apinox-editorLineNumber-activeForeground': '#0097a7',
        '--apinox-editorError-foreground': '#b3261e',
        '--apinox-editorWarning-foreground': '#c8ba00',
        '--apinox-editorInfo-foreground': '#0097a7',
        '--apinox-editorWidget-background': 'rgba(227,233,235,0.71)',
        '--apinox-editorWidget-foreground': '#171d1e',
        '--apinox-editorWidget-border': '#dbe4e6',

        // Sidebar
        '--apinox-sideBar-background': 'rgba(233,239,240,0.71)',
        '--apinox-sideBar-foreground': '#171d1e',
        '--apinox-sideBarTitle-foreground': '#3f484a',
        '--apinox-sideBarSectionHeader-background': '#00000000',
        '--apinox-sideBarSectionHeader-foreground': '#3f484a',
        '--apinox-sideBarSectionHeader-border': 'rgba(63,72,74,0.15)',

        // Lists and Trees
        '--apinox-list-hoverBackground': 'rgba(233,239,240,0.5)',
        '--apinox-list-activeSelectionBackground': 'rgba(227,233,235,0.71)',
        '--apinox-list-activeSelectionForeground': '#171d1e',
        '--apinox-list-inactiveSelectionBackground': 'rgba(219,228,230,0.5)',
        '--apinox-list-inactiveSelectionForeground': '#171d1e',
        '--apinox-list-focusBackground': '#009eaf3D',
        '--apinox-list-focusForeground': '#171d1e',

        // Buttons
        '--apinox-button-background': '#0097a7',
        '--apinox-button-foreground': '#ffffff',
        '--apinox-button-hoverBackground': '#00bcd4',
        '--apinox-button-border': 'transparent',
        '--apinox-button-secondaryBackground': 'rgba(219,228,230,0.71)',
        '--apinox-button-secondaryForeground': '#171d1e',
        '--apinox-button-secondaryHoverBackground': 'rgba(227,233,235,0.71)',

        // Inputs
        '--apinox-input-background': 'rgba(245,250,252,0.71)',
        '--apinox-input-foreground': '#171d1e',
        '--apinox-input-border': '#dbe4e6',
        '--apinox-input-placeholderForeground': '#3f484a99',
        '--apinox-inputOption-activeBackground': '#009eaf20',
        '--apinox-inputOption-activeForeground': '#171d1e',
        '--apinox-inputValidation-errorBackground': '#f9dedc',
        '--apinox-inputValidation-errorBorder': '#b3261e',
        '--apinox-inputValidation-errorForeground': '#b3261e',
        '--apinox-inputValidation-warningBackground': '#fdf6d0',
        '--apinox-inputValidation-warningBorder': '#c8ba00',
        '--apinox-inputValidation-warningForeground': '#7a6e00',
        '--apinox-inputValidation-infoBackground': '#e0f2f1',
        '--apinox-inputValidation-infoBorder': '#0097a7',
        '--apinox-inputValidation-infoForeground': '#0097a7',

        // Dropdowns
        '--apinox-dropdown-background': 'rgba(245,250,252,0.9)',
        '--apinox-dropdown-foreground': '#171d1e',
        '--apinox-dropdown-border': '#dbe4e6',
        '--apinox-dropdown-listBackground': 'rgba(233,239,240,0.95)',

        // Panels and Borders
        '--apinox-panel-background': 'rgba(245,250,252,0.71)',
        '--apinox-panel-border': 'rgba(219,228,230,0.8)',
        '--apinox-panelTitle-activeBorder': '#0097a7',
        '--apinox-panelTitle-activeForeground': '#171d1e',
        '--apinox-panelTitle-inactiveForeground': '#3f484a99',

        // Surface / Border tokens
        '--apinox-surface-elevated': 'rgba(227,233,235,0.71)',
        '--apinox-border-default': '#dbe4e6',
        '--apinox-border-subtle': 'rgba(219,228,230,0.6)',

        // Status Bar
        '--apinox-statusBar-background': 'rgba(233,239,240,0.71)',
        '--apinox-statusBar-foreground': '#3f484a',
        '--apinox-statusBar-noFolderBackground': '#6c71c4',
        '--apinox-statusBar-debuggingBackground': '#cc6633',

        // Activity Bar
        '--apinox-activityBar-background': 'rgba(233,239,240,0.71)',
        '--apinox-activityBar-foreground': '#171d1e',
        '--apinox-activityBar-inactiveForeground': '#3f484a',
        '--apinox-activityBar-border': 'rgba(219,228,230,0.5)',
        '--apinox-activityBar-activeBorder': '#0097a7',
        '--apinox-activityBarBadge-background': '#0097a7',
        '--apinox-activityBarBadge-foreground': '#ffffff',

        // Title Bar
        '--apinox-titleBar-activeBackground': 'rgba(233,239,240,0.71)',
        '--apinox-titleBar-activeForeground': '#171d1e',
        '--apinox-titleBar-inactiveBackground': 'rgba(233,239,240,0.71)',
        '--apinox-titleBar-border': 'rgba(219,228,230,0.5)',

        // Badges
        '--apinox-badge-background': '#0097a7',
        '--apinox-badge-foreground': '#ffffff',
        '--apinox-notifications-background': 'rgba(245,250,252,0.9)',
        '--apinox-notifications-border': '#dbe4e6',
        '--apinox-notificationCenter-border': '#dbe4e6',
        '--apinox-notificationToast-border': '#dbe4e6',
        '--apinox-notificationsInfoIcon-foreground': '#0097a7',

        // Scrollbars
        '--apinox-scrollbar-shadow': 'rgba(0,0,0,0.1)',
        '--apinox-scrollbarSlider-background': 'rgba(63,72,74,0.31)',
        '--apinox-scrollbarSlider-hoverBackground': 'rgba(63,72,74,0.75)',
        '--apinox-scrollbarSlider-activeBackground': 'rgba(0,151,167,0.6)',

        // Focus and Borders
        '--apinox-focusBorder': '#0097a7',
        '--apinox-contrastBorder': 'transparent',
        '--apinox-contrastActiveBorder': '#0097a7',

        // Text and Links
        '--apinox-foreground': '#171d1e',
        '--apinox-descriptionForeground': '#3f484a',
        '--apinox-disabledForeground': '#3f484a60',
        '--apinox-errorForeground': '#b3261e',
        '--apinox-textLink-foreground': '#0097a7',
        '--apinox-textLink-activeForeground': '#00bcd4',
        '--apinox-textCodeBlock-background': 'rgba(233,239,240,0.5)',
        '--apinox-textPreformat-foreground': '#007d0b',
        '--apinox-textBlockQuote-background': 'rgba(233,239,240,0.5)',
        '--apinox-textBlockQuote-border': '#0097a780',

        // Menus
        '--apinox-menu-background': 'rgba(245,250,252,0.95)',
        '--apinox-menu-foreground': '#171d1e',
        '--apinox-menu-border': '#dbe4e6',
        '--apinox-menu-selectionBackground': 'rgba(227,233,235,0.71)',
        '--apinox-menu-selectionForeground': '#171d1e',
        '--apinox-menu-separatorBackground': '#dbe4e6',

        // Toolbar
        '--apinox-toolbar-hoverBackground': 'rgba(0,151,167,0.08)',
        '--apinox-toolbar-activeBackground': 'rgba(0,151,167,0.15)',

        // Icons
        '--apinox-icon-foreground': '#171d1e',

        // Charts
        '--apinox-charts-foreground': '#171d1e',
        '--apinox-charts-green': '#007d0b',
        '--apinox-charts-blue': '#009eaf',
        '--apinox-charts-purple': '#7b1fa2',
        '--apinox-charts-orange': '#e65100',
        '--apinox-charts-red': '#b3261e',
        '--apinox-charts-yellow': '#c8ba00',

        // Widget
        '--apinox-widget-shadow': 'rgba(0,0,0,0.15)',
        '--apinox-widget-border': '#dbe4e6',

        // Syntax
        '--apinox-editorBracketHighlight-foreground1': '#c8ba00',
        '--apinox-editorBracketHighlight-foreground2': '#7b1fa2',
        '--apinox-editorBracketHighlight-foreground3': '#009eaf',
        '--apinox-editorBracketHighlight-foreground4': '#007d0b',
        '--apinox-editorBracketHighlight-foreground5': '#e65100',
        '--apinox-editorBracketHighlight-foreground6': '#0097a7',

        // Testing
        '--apinox-testing-iconPassed': '#007d0b',
        '--apinox-testing-iconFailed': '#b3261e',
        '--apinox-testing-iconQueued': '#c8ba00',
        '--apinox-debugIcon-breakpointForeground': '#b3261e',
        '--apinox-debugTokenExpression-name': '#7b1fa2',

        // Diff
        '--apinox-diffEditor-insertedTextBackground': '#007d0b1A',
        '--apinox-diffEditor-removedTextBackground': '#9e00371A',

        // Tabs
        '--apinox-tab-activeBackground': 'rgba(245,250,252,0.71)',
        '--apinox-tab-activeForeground': '#171d1e',
        '--apinox-tab-inactiveForeground': '#3f484a',

        // Progress Bar
        '--apinox-progressBar-background': '#0097a7',

        // Symbol Icons
        '--apinox-symbolIcon-classForeground': '#c8ba00',
        '--apinox-symbolIcon-fieldForeground': '#009eaf',
        '--apinox-symbolIcon-propertyForeground': '#009eaf',
        '--apinox-symbolIcon-variableForeground': '#009eaf',
        '--apinox-symbolIcon-stringForeground': '#007d0b',

        // Proxy/Mock UI Colors
        '--apinox-surface-deep': 'rgba(219,228,230,0.5)',
        '--apinox-text-faint': '#3f484a60',
        '--apinox-surface-danger': 'rgba(249,222,220,0.7)',
        '--apinox-surface-danger-dark': '#b3261e',
        '--apinox-surface-success-dark': '#007d0b',
        '--apinox-surface-tag': 'rgba(224,242,241,0.8)',
        '--apinox-text-danger': '#b3261e',
        '--apinox-text-tag': '#0097a7',
    },
};

export const themes = {
    dark: darkTheme,
    light: lightTheme,
    'solarized-dark': solarizedDarkTheme,
    'solarized-light': solarizedLightTheme,
    'zed-dark': zedDarkTheme,
    'dankshell-light': dankShellLightTheme,
};

export type ThemeName = keyof typeof themes;
