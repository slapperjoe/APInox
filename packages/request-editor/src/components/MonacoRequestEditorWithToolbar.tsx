import { forwardRef, useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import { MonacoRequestEditor as BaseMonacoRequestEditor } from './MonacoRequestEditor';
import type { MonacoRequestEditorHandle } from './MonacoRequestEditor';
import { EditorSettingsProvider, useEditorSettings, EditorSettings } from '../contexts/EditorSettingsContext';
import { FormattingToolbar } from './FormattingToolbar';
import { formatXml } from '../utils/xmlFormatter';

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

interface MonacoRequestEditorWithToolbarProps {
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
  /** Show formatting toolbar */
  showToolbar?: boolean;
  /** Initial editor settings */
  initialSettings?: Partial<EditorSettings>;
  /** Callback when settings change (for persistence) */
  onSettingsChange?: (settings: EditorSettings) => void;
  /** Apply formatting automatically when settings change */
  autoFormat?: boolean;
}

// Internal component that uses settings context
const EditorWithToolbarInternal = forwardRef<MonacoRequestEditorHandle, Omit<MonacoRequestEditorWithToolbarProps, 'initialSettings' | 'onSettingsChange'>>(
  ({ 
    value, 
    onChange, 
    language = 'xml',
    showToolbar = true,
    autoFormat = true,
    ...otherProps 
  }, ref) => {
    const { settings } = useEditorSettings();
    const [isFormatting, setIsFormatting] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    // Update internal value when external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Apply formatting when settings change (if autoFormat is enabled and language is XML)
    useEffect(() => {
      if (!autoFormat || language !== 'xml' || !internalValue) return;
      
      const formatted = formatXml(
        internalValue,
        settings.alignAttributes,
        settings.inlineValues,
        settings.hideCausality
      );
      
      if (formatted !== internalValue) {
        setInternalValue(formatted);
        onChange(formatted);
      }
    }, [settings.alignAttributes, settings.inlineValues, settings.hideCausality]);

    const handleFormat = useCallback(() => {
      if (language !== 'xml' || !internalValue) return;
      
      setIsFormatting(true);
      setTimeout(() => {
        const formatted = formatXml(
          internalValue,
          settings.alignAttributes,
          settings.inlineValues,
          settings.hideCausality
        );
        setInternalValue(formatted);
        onChange(formatted);
        setIsFormatting(false);
      }, 0);
    }, [internalValue, settings, language, onChange]);

    const handleEditorChange = useCallback((newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    }, [onChange]);

    return (
      <EditorWrapper>
        {showToolbar && language === 'xml' && (
          <FormattingToolbar 
            showFormatButton={true}
            onFormat={handleFormat}
            isFormatting={isFormatting}
          />
        )}
        <EditorContent>
          <BaseMonacoRequestEditor
            ref={ref}
            value={internalValue}
            onChange={handleEditorChange}
            language={language}
            showLineNumbers={settings.showLineNumbers}
            fontSize={settings.fontSize}
            fontFamily={settings.fontFamily}
            {...otherProps}
          />
        </EditorContent>
      </EditorWrapper>
    );
  }
);

EditorWithToolbarInternal.displayName = 'EditorWithToolbarInternal';

// Main exported component with settings provider
export const MonacoRequestEditorWithToolbar = forwardRef<MonacoRequestEditorHandle, MonacoRequestEditorWithToolbarProps>(
  ({ initialSettings, onSettingsChange, ...props }, ref) => {
    return (
      <EditorSettingsProvider 
        initialSettings={initialSettings}
        onSettingsChange={onSettingsChange}
      >
        <EditorWithToolbarInternal ref={ref} {...props} />
      </EditorSettingsProvider>
    );
  }
);

MonacoRequestEditorWithToolbar.displayName = 'MonacoRequestEditorWithToolbar';
