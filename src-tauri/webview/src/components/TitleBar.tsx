import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useProject } from '../contexts/ProjectContext';
import { useUI } from '../contexts/UIContext';
import apinoxIcon from '../assets/apinox-icon.png';

const TitleBarContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: var(--apinox-titleBar-activeBackground);
  color: var(--apinox-titleBar-activeForeground);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  z-index: 999;
  border-bottom: 1px solid var(--apinox-titleBar-border, transparent);
`;

const DragRegion = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  -webkit-app-region: drag;
  cursor: move;
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

const TitleBarInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
`;

const InfoItem = styled.div<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 3px;
  background: ${props => props.isActive 
    ? 'var(--apinox-badge-background)' 
    : 'transparent'};
  color: ${props => props.isActive 
    ? 'var(--apinox-badge-foreground)' 
    : 'var(--apinox-descriptionForeground)'};
  font-size: 11px;
  font-weight: 500;
  opacity: ${props => props.isActive ? 1 : 0.7};
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
  const { selectedProjectName, projects } = useProject();
  const { openDebugModal } = useUI();
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

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

    return () => {
      unlisten.then(fn => fn());
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

  return (
    <TitleBarContainer>
      <DragRegion>
        <AppLogo onClick={handleLogoClick} title="Double-click to open Debug Console">
          <LogoIcon src={apinoxIcon} alt="APInox" />
          <AppTitle>APInox</AppTitle>
        </AppLogo>
        <TitleBarInfo>
          {selectedProjectName && (
            <InfoItem>
              📁 {selectedProjectName}
            </InfoItem>
          )}
        </TitleBarInfo>
      </DragRegion>
      {version && <VersionLabel>v{version}</VersionLabel>}
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
    </TitleBarContainer>
  );
};

export default TitleBar;
