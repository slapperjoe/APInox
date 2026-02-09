import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Search, X } from 'lucide-react';
import { useSearch } from '../contexts/SearchContext';
import { useUI } from '../contexts/UIContext';
import { SearchDropdown } from './SearchDropdown';
import { SearchResult } from '../utils/workspaceSearch';
import apinoxIcon from '../assets/apinox-icon.png';

const SearchBarContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 34px;  /* Pulled up by 6px */
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
  padding: 0 16px 0 78px;  /* Left padding for traffic lights */
  -webkit-app-region: drag;  /* Enable window dragging */
`;

const AppLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  cursor: pointer;
  
  &:active {
    opacity: 0.7;
  }
`;

const LogoIcon = styled.img`
  width: 18px;
  height: 18px;
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
  white-space: nowrap;
`;

const SearchWrapper = styled.div`
  flex: 1;
  max-width: 450px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 22px;  /* Slightly smaller */
  background: rgba(30, 30, 30, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 5px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  pointer-events: auto;
  -webkit-app-region: no-drag;  /* Prevent dragging on search bar */
  
  &:focus-within {
    border-color: var(--vscode-focusBorder, #007ACC);
    box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007ACC);
    background: rgba(30, 30, 30, 0.9);
  }
  
  &:hover {
    background: rgba(30, 30, 30, 0.8);
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
  
  ${SearchWrapper}:focus-within & {
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

export const MacOSTitleBarSearch: React.FC = () => {
  console.log('🍎 MacOSTitleBarSearch component rendering');
  
  const { 
    searchQuery, 
    setSearchQuery, 
    clearSearch, 
    searchResults, 
    groupedResults,
    isSearching, 
    selectedIndex, 
    setSelectedIndex, 
    selectResult
  } = useSearch();
  const { openDebugModal } = useUI();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Show dropdown when there are results or searching
  const showDropdown = searchQuery.trim().length > 0 && (searchResults.length > 0 || isSearching);

  // Handle double-click on logo to open debug modal
  const handleLogoClick = () => {
    console.log('[MacOSTitleBarSearch] Logo clicked, clickCount:', clickCount);
    setClickCount(prev => prev + 1);
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }

    const timer = setTimeout(() => {
      if (clickCount + 1 >= 2) {
        // Double-click detected
        console.log('[MacOSTitleBarSearch] Double-click detected, opening debug modal');
        openDebugModal();
      }
      setClickCount(0);
      setClickTimer(null);
    }, 300);
    
    setClickTimer(timer);
  };

  // Wrap selectResult with logging
  const handleSelectResult = useCallback((result: SearchResult) => {
    console.log('[MacOSTitleBarSearch] Search result selected:', result);
    selectResult(result);
  }, [selectResult]);

  useEffect(() => {
    // Keyboard shortcut for search (Cmd+K on macOS)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  return (
    <>
      <SearchBarContainer>
        <AppLogo onClick={handleLogoClick} title="Double-click to open Debug Console">
          <LogoIcon src={apinoxIcon} alt="APInox" />
          <AppTitle>APInox</AppTitle>
        </AppLogo>
        
        <SearchWrapper>
          <SearchIcon>
            <Search />
          </SearchIcon>
          <SearchInput
            ref={searchInputRef}
            type="text"
            placeholder="Search workspace... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-search-input
          />
          {searchQuery && (
            <ClearButton onClick={clearSearch} title="Clear search">
              <X />
            </ClearButton>
          )}
        </SearchWrapper>
      </SearchBarContainer>
      
      {showDropdown && (
        <SearchDropdown
          groupedResults={groupedResults}
          selectedIndex={selectedIndex}
          isLoading={isSearching}
          onSelectResult={handleSelectResult}
          onClose={clearSearch}
          onChangeSelection={setSelectedIndex}
          isMacOS={true}
        />
      )}
    </>
  );
};
