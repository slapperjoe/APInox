import { forwardRef, useCallback, useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Type, Minus, Plus, WrapText, AlignLeft, Braces, ListOrdered, Map, Code } from 'lucide-react';
import { MonacoRequestEditor as BaseMonacoRequestEditor } from './MonacoRequestEditor';
import type { MonacoRequestEditorHandle } from './MonacoRequestEditor';
import { HeadersPanel } from './HeadersPanel';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import { formatXml } from '../utils/xmlFormatter';
import { getInstalledFonts, type MonoFont } from '../utils/fontDetection';
import { useSettingsDropdown } from '../hooks/useSettingsDropdown';
import { Tooltip } from '../../components/common/Tooltip';
import {
  TabsHeader,
  TabButton,
  TabMeta,
  TabsRight,
  CompactIconButton,
  EditorSettingsMenu,
  MenuSection,
  MenuSectionTitle,
  MenuRow,
  MenuLabel,
  MenuControls,
  MenuIconButton,
  FontSizeDisplay,
  FontSelect,
} from './RequestWorkspace.styles';
import styled from 'styled-components';

const EditorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const EditorContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

export interface ExtraTab {
  /** Unique tab identifier */
  id: string;
  /** Tab label shown in the tab bar */
  label: string;
  /** Render function for the tab content */
  render: () => ReactNode;
  /** Optional badge count (shown as a pill next to the label) */
  badge?: number;
}

export interface MonacoRequestEditorWithToolbarProps {
  /** Current editor content */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Focus callback */
  onFocus?: () => void;
  /** Elements to auto-fold (e.g., 'VsDebuggerCausalityData') */
  autoFoldElements?: string[];
  /** Request ID for tracking (helps prevent cursor jumps) */
  requestId?: string;
  /** Force update key (increment to force re-render) */
  forceUpdateKey?: number;
  /** Debug log ID */
  logId?: string;
  /** Available variables for autocomplete */
  availableVariables?: Array<{ name: string; value: string | null; source: string }>;
  /** Show tab bar with gear icon (default: true) */
  showToolbar?: boolean;
  /** Settings come from the shared EditorSettingsContext — the app-level provider
      backed by `config.ui`. Owning a provider here was the second store. */
  /** Apply formatting automatically when settings change */
  autoFormat?: boolean;
  /** Current headers value — enables the Headers tab */
  headers?: Record<string, string>;
  /** Callback when headers change */
  onHeadersChange?: (headers: Record<string, string>) => void;
  /** Content-Type to show when the request has no Content-Type header yet — the value the app would default to. Falls back to 'application/soap+xml' when omitted. */
  contentType?: string;
  /** Additional tabs injected by the parent */
  extraTabs?: ExtraTab[];
}

type InternalTab = 'body' | 'headers' | string;

// Uses the shared EditorSettingsContext rather than owning a provider — the app-level
// provider is the single store.
export const MonacoRequestEditorWithToolbar = forwardRef<MonacoRequestEditorHandle, MonacoRequestEditorWithToolbarProps>(
  ({
    value,
    onChange,
    language = 'xml',
    showToolbar = true,
    autoFormat = true,
    headers,
    onHeadersChange,
    contentType,
    extraTabs = [],
    forceUpdateKey: externalForceUpdateKey,
    ...otherProps
  }, ref) => {
    const { settings, updateSettings, toggleAlignAttributes, toggleInlineValues, toggleHideCausality, toggleLineNumbers, toggleMinimap } = useEditorSettings();

    const [activeTab, setActiveTab] = useState<InternalTab>('body');
    const [installedFonts, setInstalledFonts] = useState<MonoFont[]>([]);
    const [internalValue, setInternalValue] = useState(value);
    const [localForceUpdateKey, setLocalForceUpdateKey] = useState(0);

    const settingsMenuRef = useRef<HTMLDivElement>(null);
    const {
      open: showSettings,
      setOpen: setShowSettings,
      position: menuPosition,
      toggle: handleToggleSettings,
      buttonRef: settingsButtonRef,
    } = useSettingsDropdown(settingsMenuRef);
    const editorRef = useRef<MonacoRequestEditorHandle | null>(null);

    // Detect installed fonts on mount
    useEffect(() => {
      setInstalledFonts(getInstalledFonts());
    }, []);

    // Update internal value when external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Apply formatting when settings change (auto-format, XML only, Body tab)
    useEffect(() => {
      if (!autoFormat || language !== 'xml' || !internalValue || activeTab !== 'body') return;
      const formatted = formatXml(internalValue, settings.alignAttributes, settings.inlineValues, settings.hideCausality);
      if (formatted !== internalValue) {
        setInternalValue(formatted);
        onChange(formatted);
      }
      // Force the base Monaco editor to sync its model — it ignores value prop changes
      // unless requestId or forceUpdateKey changes, so we bump our local key here.
      setLocalForceUpdateKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.alignAttributes, settings.inlineValues, settings.hideCausality]);


    const handleFormatNow = useCallback(() => {
      if (language !== 'xml') return;
      const current = (ref as React.RefObject<MonacoRequestEditorHandle>)?.current?.getValue?.() ?? internalValue;
      const formatted = formatXml(current, settings.alignAttributes, settings.inlineValues, settings.hideCausality);
      setInternalValue(formatted);
      onChange(formatted);
      setShowSettings(false);
    }, [language, internalValue, settings, onChange, ref, setShowSettings]);

    const handleEditorChange = useCallback((newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    }, [onChange]);

    // Merge the forwarded ref with our internal ref
    const setRefs = useCallback((node: MonacoRequestEditorHandle | null) => {
      editorRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<MonacoRequestEditorHandle | null>).current = node;
    }, [ref]);

    const renderTabContent = () => {
      if (activeTab === 'body') {
        return (
          <BaseMonacoRequestEditor
            ref={setRefs}
            value={internalValue}
            onChange={handleEditorChange}
            language={language}
            showLineNumbers={settings.showLineNumbers}
            showMinimap={settings.showMinimap}
            fontSize={settings.fontSize}
            fontFamily={settings.fontFamily}
            {...otherProps}
            forceUpdateKey={(externalForceUpdateKey ?? 0) + localForceUpdateKey}
          />
        );
      }

      if (activeTab === 'headers') {
        return (
          <HeadersPanel
            headers={headers ?? {}}
            onChange={onHeadersChange ?? (() => {})}
            contentType={contentType}
          />
        );
      }

      const extra = extraTabs.find(t => t.id === activeTab);
      return extra ? extra.render() : null;
    };

    return (
      <EditorWrapper>
        {showToolbar && (
          <TabsHeader>
            <TabButton $active={activeTab === 'body'} onClick={() => setActiveTab('body')}>
              Body
            </TabButton>
            <TabButton $active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
              Headers
              {headers && Object.keys(headers).length > 0 && (
                <TabMeta>{Object.keys(headers).length}</TabMeta>
              )}
            </TabButton>
            {extraTabs.map(tab => (
              <TabButton key={tab.id} $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <TabMeta>{tab.badge}</TabMeta>
                )}
              </TabButton>
            ))}
            <TabsRight>
              <Tooltip content="Editor Settings">
                <CompactIconButton
                  ref={settingsButtonRef}
                  onClick={handleToggleSettings}
                  className={showSettings ? 'active' : ''}
                >
                  <Settings size={14} />
                </CompactIconButton>
              </Tooltip>
            </TabsRight>
          </TabsHeader>
        )}

        <EditorContent>
          {renderTabContent()}
        </EditorContent>

        {/* Settings popup via portal */}
        {showSettings && menuPosition && createPortal(
          <div
            ref={settingsMenuRef}
            style={{ position: 'fixed', top: `${menuPosition.top}px`, right: `${menuPosition.right}px`, zIndex: 999999 }}
          >
            <EditorSettingsMenu style={{ maxHeight: `${menuPosition.maxHeight}px`, overflowY: 'auto' }}>

              {/* Font Settings */}
              <MenuSection>
                <MenuSectionTitle>Font Settings</MenuSectionTitle>
                <MenuRow>
                  <MenuLabel><Type size={14} /> Font Family</MenuLabel>
                  <FontSelect
                    value={settings.fontFamily}
                    onChange={e => updateSettings({ fontFamily: e.target.value })}
                  >
                    {installedFonts.length > 0 ? (
                      installedFonts.map(font => (
                        <option key={font.value} value={font.value}>{font.name}</option>
                      ))
                    ) : (
                      <option value='Consolas, "Courier New", monospace'>Consolas</option>
                    )}
                  </FontSelect>
                </MenuRow>
                <MenuRow>
                  <MenuLabel><Type size={14} /> Font Size</MenuLabel>
                  <MenuControls>
                    <Tooltip content="Decrease font size">
                      <MenuIconButton
                        onClick={() => updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) })}
                        disabled={settings.fontSize <= 8}
                      >
                        <Minus size={12} />
                      </MenuIconButton>
                    </Tooltip>
                    <FontSizeDisplay>{settings.fontSize}px</FontSizeDisplay>
                    <Tooltip content="Increase font size">
                      <MenuIconButton
                        onClick={() => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })}
                        disabled={settings.fontSize >= 24}
                      >
                        <Plus size={12} />
                      </MenuIconButton>
                    </Tooltip>
                  </MenuControls>
                </MenuRow>
              </MenuSection>

              {/* Formatting Options */}
              {language === 'xml' && (
                <MenuSection>
                  <MenuSectionTitle>Formatting Options</MenuSectionTitle>
                  <MenuRow>
                    <MenuLabel><Code size={14} /> Format XML</MenuLabel>
                    <MenuIconButton onClick={handleFormatNow} title="Format XML Now">Format</MenuIconButton>
                  </MenuRow>
                  <MenuRow>
                    <MenuLabel><WrapText size={14} /> Align Attributes</MenuLabel>
                    <MenuIconButton
                      onClick={toggleAlignAttributes}
                      className={settings.alignAttributes ? 'active' : ''}
                    >
                      {settings.alignAttributes ? 'On' : 'Off'}
                    </MenuIconButton>
                  </MenuRow>
                  <MenuRow>
                    <MenuLabel><AlignLeft size={14} /> Inline Values</MenuLabel>
                    <MenuIconButton
                      onClick={toggleInlineValues}
                      className={settings.inlineValues ? 'active' : ''}
                    >
                      {settings.inlineValues ? 'On' : 'Off'}
                    </MenuIconButton>
                  </MenuRow>
                  <MenuRow>
                    <MenuLabel><Braces size={14} /> Hide Causality</MenuLabel>
                    <MenuIconButton
                      onClick={toggleHideCausality}
                      className={settings.hideCausality ? 'active' : ''}
                    >
                      {settings.hideCausality ? 'On' : 'Off'}
                    </MenuIconButton>
                  </MenuRow>
                </MenuSection>
              )}

              {/* View Options */}
              <MenuSection>
                <MenuSectionTitle>View Options</MenuSectionTitle>
                <MenuRow>
                  <MenuLabel><ListOrdered size={14} /> Line Numbers</MenuLabel>
                  <MenuIconButton
                    onClick={toggleLineNumbers}
                    className={settings.showLineNumbers ? 'active' : ''}
                  >
                    {settings.showLineNumbers ? 'On' : 'Off'}
                  </MenuIconButton>
                </MenuRow>
                <MenuRow>
                  <MenuLabel><Map size={14} /> Minimap</MenuLabel>
                  <MenuIconButton
                    onClick={toggleMinimap}
                    className={settings.showMinimap ? 'active' : ''}
                  >
                    {settings.showMinimap ? 'On' : 'Off'}
                  </MenuIconButton>
                </MenuRow>
              </MenuSection>

            </EditorSettingsMenu>
          </div>,
          document.body
        )}
      </EditorWrapper>
    );
  }
);

MonacoRequestEditorWithToolbar.displayName = 'MonacoRequestEditorWithToolbar';
