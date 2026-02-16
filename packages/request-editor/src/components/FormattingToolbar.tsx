import { WrapText, AlignLeft, Bug, Code } from 'lucide-react';
import styled from 'styled-components';
import { useEditorSettings } from '../contexts/EditorSettingsContext';

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary, #1e1e1e);
  border-bottom: 1px solid var(--border-color, #333);
  flex-wrap: wrap;
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: ${props => props.$active ? 'var(--accent-color, #0078d4)' : 'transparent'};
  color: ${props => props.$active ? '#fff' : 'var(--text-primary, #cccccc)'};
  border: 1px solid ${props => props.$active ? 'var(--accent-color, #0078d4)' : 'var(--border-color, #444)'};
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.$active ? 'var(--accent-hover, #106ebe)' : 'var(--bg-hover, #2a2a2a)'};
    border-color: ${props => props.$active ? 'var(--accent-hover, #106ebe)' : 'var(--border-hover, #555)'};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 20px;
  background: var(--border-color, #444);
  margin: 0 4px;
`;

const Label = styled.span`
  font-size: 13px;
  color: var(--text-secondary, #999);
  margin-right: 4px;
`;

interface FormattingToolbarProps {
  /** Show format button to apply formatting */
  showFormatButton?: boolean;
  /** Callback when format button is clicked */
  onFormat?: () => void;
  /** Is formatting in progress */
  isFormatting?: boolean;
}

export function FormattingToolbar({ 
  showFormatButton = true, 
  onFormat,
  isFormatting = false
}: FormattingToolbarProps) {
  const { 
    settings, 
    toggleInlineValues, 
    toggleAlignAttributes, 
    toggleHideCausality 
  } = useEditorSettings();

  return (
    <ToolbarContainer>
      {showFormatButton && onFormat && (
        <>
          <ToolbarButton onClick={onFormat} disabled={isFormatting}>
            <Code />
            {isFormatting ? 'Formatting...' : 'Format'}
          </ToolbarButton>
          <Separator />
        </>
      )}

      <Label>Formatting:</Label>

      <ToolbarButton
        $active={settings.alignAttributes}
        onClick={toggleAlignAttributes}
        title="Align element attributes vertically"
      >
        <WrapText />
        Align Attrs
      </ToolbarButton>

      <ToolbarButton
        $active={settings.inlineValues}
        onClick={toggleInlineValues}
        title="Format simple elements inline (e.g., <Name>John</Name>)"
      >
        <AlignLeft />
        Inline Values
      </ToolbarButton>

      <ToolbarButton
        $active={settings.hideCausality}
        onClick={toggleHideCausality}
        title="Hide VsDebuggerCausalityData from display"
      >
        <Bug />
        Hide Causality
      </ToolbarButton>
    </ToolbarContainer>
  );
}
