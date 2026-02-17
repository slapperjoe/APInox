import styled from 'styled-components';

// Main Container
export const RequestWorkspaceContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--apinox-editor-background, #1e1e1e);
`;

// Toolbar (Top bar with URL, Method, Run button)
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--apinox-sideBar-background, #252526);
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  min-height: 52px;
`;

export const UrlInputWrapper = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ToolbarButton = styled.button<{ $variant?: 'primary' | 'danger' | 'default' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${props => 
    props.$variant === 'primary' ? 'var(--apinox-button-background, #0078d4)' :
    props.$variant === 'danger' ? 'var(--apinox-errorForeground, #f44336)' :
    'var(--apinox-button-secondaryBackground, #3a3d41)'
  };
  color: ${props => 
    props.$variant === 'primary' || props.$variant === 'danger' ? '#fff' : 
    'var(--apinox-button-secondaryForeground, #cccccc)'
  };
  border: 1px solid ${props => 
    props.$variant === 'primary' ? 'var(--apinox-button-background, #0078d4)' :
    props.$variant === 'danger' ? 'var(--apinox-errorForeground, #f44336)' :
    'var(--apinox-input-border, #444)'
  };
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${props => 
      props.$variant === 'primary' ? 'var(--apinox-button-hoverBackground, #106ebe)' :
      props.$variant === 'danger' ? '#d32f2f' :
      'var(--apinox-button-secondaryHoverBackground, #45494e)'
    };
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const RunButton = styled(ToolbarButton)``;
export const CancelButton = styled(ToolbarButton)``;

// Variables Dropdown
export const VariablesWrapper = styled.div`
  position: relative;
`;

export const VariablesLabel = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  color: var(--apinox-foreground, #cccccc);
  border: 1px solid var(--apinox-input-border, #444);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;

  &:hover {
    background: var(--apinox-list-hoverBackground, #2a2a2a);
    border-color: var(--apinox-focusBorder, #555);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const VariablesDropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 280px;
  max-width: 400px;
  max-height: 400px;
  background: var(--apinox-sideBar-background, #252526);
  border: 1px solid var(--apinox-input-border, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--apinox-widget-shadow, rgba(0, 0, 0, 0.3));
  overflow-y: auto;
  z-index: 1000;
`;

export const VariablesDropdownHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  font-weight: 600;
  font-size: 13px;
  color: var(--apinox-foreground, #cccccc);
`;

export const VariablesDropdownEmpty = styled.div`
  padding: 24px;
  text-align: center;
  color: var(--apinox-descriptionForeground, #999);
  font-size: 13px;
`;

export const VariablesDropdownItem = styled.div`
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--apinox-panel-border, #2d2d2d);

  &:hover {
    background: var(--apinox-list-hoverBackground, #2a2a2a);
  }

  &:last-child {
    border-bottom: none;
  }
`;

export const VariablesDropdownName = styled.div`
  font-family: 'Consolas', monospace;
  font-size: 13px;
  color: var(--apinox-foreground, #cccccc);
  margin-bottom: 2px;
`;

export const VariablesDropdownSource = styled.div`
  font-size: 11px;
  color: var(--apinox-descriptionForeground, #999);
`;

// Tabs
export const TabsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  background: var(--apinox-sideBar-background, #252526);
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  min-height: 40px;
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--apinox-scrollbarSlider-background, #555);
    border-radius: 3px;
  }
`;

export const TabButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: ${props => props.$active ? 'var(--apinox-tab-activeBackground, #1e1e1e)' : 'transparent'};
  color: ${props => props.$active ? 'var(--apinox-tab-activeForeground, #cccccc)' : 'var(--apinox-tab-inactiveForeground, #999)'};
  border: none;
  border-bottom: 2px solid ${props => props.$active ? 'var(--apinox-focusBorder, #0078d4)' : 'transparent'};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    color: var(--apinox-tab-activeForeground, #cccccc);
    background: var(--apinox-list-hoverBackground, #2a2a2a);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

export const TabMeta = styled.span`
  font-size: 11px;
  color: var(--apinox-descriptionForeground, #999);
  background: var(--apinox-badge-background, #3e3e3e);
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 4px;
`;

export const TabsRight = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CompactIconButton = styled.button<{ className?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: ${props => props.className?.includes('active') ? 'var(--apinox-button-background, #0078d4)' : 'transparent'};
  color: ${props => props.className?.includes('active') ? '#fff' : 'var(--apinox-descriptionForeground, #999)'};
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.className?.includes('active') ? 'var(--apinox-button-hoverBackground, #106ebe)' : 'var(--apinox-list-hoverBackground, #2a2a2a)'};
    color: var(--apinox-foreground, #cccccc);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

// Content Area (split view)
export const ContentArea = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
`;

export const EditorSplitContainer = styled.div<{ $layoutMode: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${props => props.$layoutMode === 'vertical' ? 'row' : 'column'};
  width: 100%;
  height: 100%;
`;

export const RequestPane = styled.div<{ $ratio: number }>`
  flex: ${props => props.$ratio};
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

export const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--apinox-sideBar-background, #252526);
  border-top: 1px solid var(--apinox-panel-border, #333);
  min-height: 32px;
  font-size: 11px;
  color: var(--apinox-descriptionForeground, #999);
  gap: 12px;
`;

export const StatusBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const StatusBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const ResponsePane = styled.div<{ $ratio: number }>`
  flex: ${props => 1 - props.$ratio};
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--apinox-editor-background, #1e1e1e);
`;

export const SplitResizer = styled.div<{ $layoutMode: 'vertical' | 'horizontal' }>`
  background: var(--apinox-panel-border, #333);
  cursor: ${props => props.$layoutMode === 'vertical' ? 'col-resize' : 'row-resize'};
  ${props => props.$layoutMode === 'vertical' ? 'width: 4px;' : 'height: 4px;'}
  transition: background 0.15s;

  &:hover {
    background: var(--apinox-focusBorder, #0078d4);
  }
`;

// Response Section
export const ResponseSection = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

export const ResponseHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--apinox-sideBar-background, #252526);
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  min-height: 48px;
`;

export const ResponseHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const ResponseTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--apinox-foreground, #cccccc);
`;

export const ResponseStats = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const StatText = styled.span`
  font-size: 12px;
  color: var(--apinox-descriptionForeground, #999);
`;

export const ResponseStatus = styled.span<{ $status?: number }>`
  font-size: 12px;
  font-weight: 600;
  color: ${props => {
    if (!props.$status) return 'var(--apinox-descriptionForeground, #999)';
    if (props.$status >= 200 && props.$status < 300) return 'var(--apinox-charts-green, #4caf50)';
    if (props.$status >= 400) return 'var(--apinox-errorForeground, #f44336)';
    return 'var(--apinox-charts-orange, #ff9800)';
  }};
`;

export const ResponseContentType = styled.span`
  font-size: 12px;
  color: var(--apinox-descriptionForeground, #999);
`;

export const ResponseHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const MiniToolbarButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: transparent;
  color: var(--apinox-foreground, #cccccc);
  border: 1px solid var(--apinox-input-border, #444);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: var(--apinox-list-hoverBackground, #2a2a2a);
    border-color: var(--apinox-focusBorder, #0078d4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

// Editor Settings Menu
export const SettingsMenuWrapper = styled.div`
  position: relative;
  z-index: 9999;
`;

export const EditorSettingsMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 280px;
  background: var(--apinox-sideBar-background, #252526);
  border: 1px solid var(--apinox-input-border, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--apinox-widget-shadow, rgba(0, 0, 0, 0.3));
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

export const MenuSection = styled.div`
  padding: 12px;
  border-bottom: 1px solid var(--apinox-panel-border, #333);

  &:last-child {
    border-bottom: none;
  }
`;

export const MenuSectionTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--apinox-descriptionForeground, #999);
  text-transform: uppercase;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

export const MenuRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
`;

export const MenuLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--apinox-foreground, #cccccc);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  svg {
    width: 14px;
    height: 14px;
    color: var(--apinox-descriptionForeground, #999);
  }
`;

export const MenuControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const MenuIconButton = styled.button<{ className?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background: ${props => props.className?.includes('active') ? 'var(--apinox-button-background, #0078d4)' : 'transparent'};
  color: ${props => props.className?.includes('active') ? '#fff' : 'var(--apinox-foreground, #cccccc)'};
  border: 1px solid ${props => props.className?.includes('active') ? 'var(--apinox-button-background, #0078d4)' : 'var(--apinox-input-border, #444)'};
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.className?.includes('active') ? 'var(--apinox-button-hoverBackground, #106ebe)' : 'var(--apinox-list-hoverBackground, #2a2a2a)'};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

export const FontSizeDisplay = styled.span`
  font-size: 13px;
  color: var(--apinox-foreground, #cccccc);
  min-width: 32px;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

export const FontSelect = styled.select`
  background: var(--apinox-editor-background, #1e1e1e);
  color: var(--apinox-foreground, #ccc);
  border: 1px solid var(--apinox-input-border, #444);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  min-width: 140px;

  &:hover {
    border-color: var(--apinox-focusBorder, #555);
  }

  &:focus {
    outline: none;
    border-color: var(--apinox-focusBorder, #0078d4);
  }

  option {
    background: var(--apinox-sideBar-background, #252526);
    color: var(--apinox-foreground, #ccc);
  }
`;

// Panel Content
export const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

// Headers Display (read-only view)
export const HeadersViewer = styled.div`
  padding: 16px;
`;

export const HeadersTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--apinox-descriptionForeground, #999);
`;

export const HeadersRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  
  &:last-child {
    border-bottom: none;
  }
`;

export const HeadersKey = styled.div`
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--apinox-foreground, #cccccc);
  font-weight: 600;
  min-width: 150px;
`;

export const HeadersValue = styled.div`
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--apinox-descriptionForeground, #999);
  flex: 1;
  word-break: break-all;
`;

// Breadcrumb
export const BreadcrumbBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--apinox-sideBar-background, #252526);
  border-bottom: 1px solid var(--apinox-panel-border, #333);
  font-size: 13px;
  color: var(--apinox-descriptionForeground, #999);
`;

export const BreadcrumbActive = styled.span`
  color: var(--apinox-foreground, #cccccc);
  font-weight: 500;
`;

// Utilities
export const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: var(--apinox-input-border, #444);
  margin: 0 4px;
`;

// Empty State (for "none" body type)
export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  color: var(--apinox-descriptionForeground, #999);
`;

export const EmptyStateText = styled.p`
  font-size: 14px;
  margin: 0;
`;
