import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useProject } from '../contexts/ProjectContext';
import { useUI } from '../contexts/UIContext';
import { useSearch } from '../contexts/SearchContext';
import { SearchDropdown } from './SearchDropdown';
import apinoxIcon from '../assets/apinox-icon.png';
import { Search, X, FileText, Folder, Box, Layers, TestTube, ChevronRight } from 'lucide-react';

const TitleBarContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px; /* Increased from 32px to match macOS titlebar height */
  background: var(--apinox-titleBar-activeBackground);
  color: var(--apinox-titleBar-activeForeground);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  z-index: 999;
  border-bottom: 1px solid var(--apinox-titleBar-border, transparent);
  pointer-events: auto;
`;

const DragRegion = styled.div<{ $isMacOS?: boolean; $isMaximized?: boolean }>`
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  -webkit-app-region: drag;
  min-width: 0;
  
  /* On macOS, add left padding for native traffic lights */
  /* When maximized, reduce padding since traffic lights auto-hide */
  padding-left: ${props => {
    if (!props.$isMacOS) return '12px';
    return props.$isMaximized ? '12px' : '90px';
  }};
  
  /* Smooth transition when toggling maximize */
  transition: padding-left 0.2s ease;
  
  /* All children should not be draggable */
  > * {
    -webkit-app-region: no-drag;
  }
`;

const AppLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  
  &:active {
    opacity: 0.7;
  }
`;

const LogoIcon = styled.img`
  width: 20px;
  height: 20px;
  object-fit: contain;
  border: none;
  background: transparent;
`;

const AppTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
  letter-spacing: 0.3px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const SearchContainer = styled.div`
  flex: 1;
  max-width: 450px;
  min-width: 250px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 26px; /* Increased from 24px for better visual alignment */
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
  border-radius: 4px;
  -webkit-app-region: no-drag;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  
  &:focus-within {
    border-color: var(--vscode-focusBorder, #007ACC);
    box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007ACC);
  }
`;

const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.65;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
  
  svg {
    width: 14px;
    height: 14px;
  }
  
  ${SearchContainer}:focus-within & {
    opacity: 1;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--vscode-input-foreground);
  font-size: 12px;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.4;
  
  &::placeholder {
    color: var(--vscode-input-placeholderForeground);
    opacity: 0.65;
  }
`;

const ClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 2px;
  cursor: pointer;
  opacity: 0.6;
  flex-shrink: 0;
  border-radius: 3px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
  
  &:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.2));
  }
  
  &:active {
    background: var(--vscode-toolbar-activeBackground, rgba(128, 128, 128, 0.3));
  }
  
  svg {
    width: 12px;
    height: 12px;
  }
`;

const LastSearchBreadcrumb = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--vscode-foreground);
  font-size: 11px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.15s ease;
  -webkit-app-region: no-drag;
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  &:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.2));
    border-color: var(--vscode-widget-border, rgba(128, 128, 128, 0.3));
  }
  
  &:active {
    background: var(--vscode-toolbar-activeBackground, rgba(128, 128, 128, 0.3));
  }
`;

const BreadcrumbIcon = styled.span`
  display: flex;
  align-items: center;
  opacity: 0.7;
  flex-shrink: 0;
  
  svg {
    width: 12px;
    height: 12px;
  }
`;

const BreadcrumbText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const VersionLabel = styled.div`
  font-size: 10px;
  color: var(--apinox-descriptionForeground);
  opacity: 0.6;
  padding: 0 8px;
  -webkit-app-region: no-drag;
`;

const WindowControls = styled.div`
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
`;

const WindowButton = styled.button<{ isClose?: boolean }>`
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--apinox-titleBar-activeForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.1s;
  pointer-events: auto;

  &:hover {
    background: ${props => 
      props.isClose 
        ? '#e81123' 
        : 'var(--apinox-toolbar-hoverBackground)'
    };
    color: ${props => props.isClose ? '#fff' : 'inherit'};
  }

  &:active {
    background: ${props => 
      props.isClose 
        ? '#c50e1f' 
        : 'var(--apinox-toolbar-activeBackground, rgba(128, 128, 128, 0.3))'
    };
  }

  svg {
    width: 10px;
    height: 10px;
  }
`;

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [version, setVersion] = useState<string>('');
  const [platformOS, setPlatformOS] = useState<'macos' | 'windows' | 'linux' | 'unknown'>('unknown');
  const { projects } = useProject();
  const { openDebugModal } = useUI();
  const { 
    searchQuery, 
    setSearchQuery, 
    clearSearch, 
    searchResults, 
    groupedResults,
    isSearching, 
    selectedIndex, 
    setSelectedIndex, 
    selectResult,
    lastSelectedResult,
    navigateToLastResult
  } = useSearch();
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Show dropdown when there are results or searching
  const showDropdown = searchQuery.trim().length > 0 && (searchResults.length > 0 || isSearching);

  // Handle double-click on logo to open debug modal
  const handleLogoClick = () => {
    setClickCount(prev => prev + 1);
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }

    const timer = setTimeout(() => {
      if (clickCount + 1 >= 2) {
        // Double-click detected
        openDebugModal();
      }
      setClickCount(0);
      setClickTimer(null);
    }, 300);
    
    setClickTimer(timer);
  };

  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for resize events
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    // Get app version
    invoke<string>('get_app_version').then(setVersion).catch(err => {
      console.error('Failed to get app version:', err);
    });
    
    // Detect platform
    invoke<string>('get_platform_os').then(os => {
      setPlatformOS(os as any);
    }).catch(err => {
      console.error('Failed to detect platform:', err);
    });

    // Keyboard shortcut for search (Ctrl+K or Cmd+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then(fn => fn());
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
      console.log('[TitleBar] Window minimized');
    } catch (error) {
      console.error('[TitleBar] Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      console.log('[TitleBar] Window maximize toggled');
    } catch (error) {
      console.error('[TitleBar] Failed to toggle maximize:', error);
    }
  };

  const handleClose = async () => {
    // Check for unsaved changes
    const hasDirtyProjects = projects.some(p => p.dirty);
    
    if (hasDirtyProjects) {
      // Confirm before closing with unsaved changes
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    
    // Use our custom quit command to properly shutdown
    try {
      await invoke('quit_app');
    } catch (error) {
      console.error('Failed to quit app:', error);
    }
  };

  // Get icon for result type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'request':
        return <FileText />;
      case 'operation':
        return <Layers />;
      case 'interface':
        return <Box />;
      case 'folder':
        return <Folder />;
      case 'test-suite':
      case 'test-case':
        return <TestTube />;
      default:
        return <FileText />;
    }
  };

  return (
    <>
      <TitleBarContainer>
        <DragRegion $isMacOS={platformOS === 'macos'} $isMaximized={isMaximized} data-tauri-drag-region>
          <AppLogo onClick={handleLogoClick} title="Double-click to open Debug Console">
            <LogoIcon src={apinoxIcon} alt="APInox" />
            <AppTitle>APInox</AppTitle>
          </AppLogo>
          
          <SearchContainer>
            <SearchIcon>
              <Search />
            </SearchIcon>
            <SearchInput
              ref={searchInputRef}
              type="text"
              placeholder="Search workspace... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-search-input
            />
            {searchQuery && (
              <ClearButton onClick={clearSearch} title="Clear search">
                <X />
              </ClearButton>
            )}
          </SearchContainer>
          
          {lastSelectedResult && (
            <LastSearchBreadcrumb 
              onClick={navigateToLastResult}
              title={`Go back to: ${lastSelectedResult.name}\n${lastSelectedResult.breadcrumb}`}
            >
              <BreadcrumbIcon>
                {getResultIcon(lastSelectedResult.type)}
              </BreadcrumbIcon>
              <BreadcrumbText>{lastSelectedResult.name}</BreadcrumbText>
              <ChevronRight size={10} opacity={0.5} />
            </LastSearchBreadcrumb>
          )}
        </DragRegion>
        {version && <VersionLabel>v{version}</VersionLabel>}
        {platformOS !== 'macos' && (
          <WindowControls>
            <WindowButton onClick={handleMinimize} title="Minimize">
              <svg viewBox="0 0 10 1" fill="currentColor">
                <rect width="10" height="1" />
              </svg>
            </WindowButton>
            <WindowButton onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
              {isMaximized ? (
                <svg viewBox="0 0 10 10" fill="currentColor">
                  <path d="M2,0 L2,2 L0,2 L0,10 L8,10 L8,8 L10,8 L10,0 Z M3,1 L9,1 L9,7 L8,7 L8,2 L3,2 Z M1,3 L7,3 L7,9 L1,9 Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 10 10" fill="currentColor">
                  <path d="M0,0 L0,10 L10,10 L10,0 Z M1,1 L9,1 L9,9 L1,9 Z" />
                </svg>
              )}
            </WindowButton>
            <WindowButton onClick={handleClose} isClose title="Close">
              <svg viewBox="0 0 10 10" fill="currentColor">
                <path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </WindowButton>
          </WindowControls>
        )}
      </TitleBarContainer>
      
      {showDropdown && (
        <SearchDropdown
          groupedResults={groupedResults}
          selectedIndex={selectedIndex}
          isLoading={isSearching}
          onSelectResult={selectResult}
          onClose={clearSearch}
          onChangeSelection={setSelectedIndex}
          isMacOS={false}
        />
      )}
    </>
  );
};

export default TitleBar;
