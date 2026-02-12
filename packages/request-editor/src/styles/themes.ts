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

        // Status Bar
        '--apinox-statusBar-background': '#007acc',
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
        '--apinox-errorForeground': '#dc322f',
        '--apinox-textLink-foreground': '#268bd2',
        '--apinox-textLink-activeForeground': '#2aa198',
        '--apinox-textCodeBlock-background': '#073642',
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
    },
};

export const themes = {
    dark: darkTheme,
    light: lightTheme,
    'solarized-dark': solarizedDarkTheme,
    'solarized-light': solarizedLightTheme,
};

export type ThemeName = keyof typeof themes;
