import React from 'react';
import { createPortal } from 'react-dom';
import { Type, Braces, WrapText, AlignLeft, ListOrdered, Map, Minus, Plus, Layout as LayoutIcon } from 'lucide-react';
import * as S from './RequestWorkspace.styles';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import type { MonoFont } from '../utils/fontDetection';

interface MenuPosition {
  top: number;
  right: number;
  maxHeight: number;
}

export interface EditorSettingsMenuProps {
  menuPosition: MenuPosition;
  settingsMenuRef: React.RefObject<HTMLDivElement>;
  installedFonts: MonoFont[];
  layoutMode: 'vertical' | 'horizontal';
  showLayoutToggle: boolean;
  onToggleLayout: () => void;
  onFormatXml: () => void;
  onClose: () => void;
}

export const EditorSettingsMenu: React.FC<EditorSettingsMenuProps> = ({
  menuPosition,
  settingsMenuRef,
  installedFonts,
  layoutMode,
  showLayoutToggle,
  onToggleLayout,
  onFormatXml,
  onClose: _onClose,
}) => {
  const editorSettings = useEditorSettings();

  return createPortal(
    <div
      ref={settingsMenuRef}
      style={{
        position: 'fixed',
        top: `${menuPosition.top}px`,
        right: `${menuPosition.right}px`,
        zIndex: 999999,
      }}
    >
      {/* maxHeight + overflow on the menu itself so fixed-position portal isn't clipped */}
      <S.EditorSettingsMenu style={{
        maxHeight: `${menuPosition.maxHeight}px`,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as any,
      }}>
        {/* Font Settings */}
        <S.MenuSection>
          <S.MenuSectionTitle>Font Settings</S.MenuSectionTitle>

          <S.MenuRow>
            <S.MenuLabel>
              <Type size={14} />
              Font Family
            </S.MenuLabel>
            <S.FontSelect
              value={editorSettings.settings.fontFamily}
              onChange={(e) => editorSettings.updateSettings({ fontFamily: e.target.value })}
            >
              {installedFonts.length > 0 ? (
                installedFonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.name}
                  </option>
                ))
              ) : (
                <option value='Consolas, "Courier New", monospace'>Consolas</option>
              )}
            </S.FontSelect>
          </S.MenuRow>

          <S.MenuRow>
            <S.MenuLabel>
              <Type size={14} />
              Font Size
            </S.MenuLabel>
            <S.MenuControls>
              <S.MenuIconButton
                onClick={() => editorSettings.updateSettings({ fontSize: Math.max(8, editorSettings.settings.fontSize - 1) })}
                disabled={editorSettings.settings.fontSize <= 8}
                title="Decrease"
              >
                <Minus size={12} />
              </S.MenuIconButton>
              <S.FontSizeDisplay>{editorSettings.settings.fontSize}px</S.FontSizeDisplay>
              <S.MenuIconButton
                onClick={() => editorSettings.updateSettings({ fontSize: Math.min(24, editorSettings.settings.fontSize + 1) })}
                disabled={editorSettings.settings.fontSize >= 24}
                title="Increase"
              >
                <Plus size={12} />
              </S.MenuIconButton>
            </S.MenuControls>
          </S.MenuRow>
        </S.MenuSection>

        {/* Formatting Options */}
        <S.MenuSection>
          <S.MenuSectionTitle>Formatting Options</S.MenuSectionTitle>

          <S.MenuRow>
            <S.MenuLabel>
              <Braces size={14} />
              Format XML
            </S.MenuLabel>
            <S.MenuIconButton onClick={onFormatXml} title="Format XML Now">
              Format
            </S.MenuIconButton>
          </S.MenuRow>

          <S.MenuRow>
            <S.MenuLabel>
              <WrapText size={14} />
              Align Attributes
            </S.MenuLabel>
            <S.MenuIconButton
              onClick={() => editorSettings.toggleAlignAttributes()}
              className={editorSettings.settings.alignAttributes ? 'active' : ''}
              title={editorSettings.settings.alignAttributes ? 'On' : 'Off'}
            >
              {editorSettings.settings.alignAttributes ? 'On' : 'Off'}
            </S.MenuIconButton>
          </S.MenuRow>

          <S.MenuRow>
            <S.MenuLabel>
              <AlignLeft size={14} />
              Inline Values
            </S.MenuLabel>
            <S.MenuIconButton
              onClick={() => editorSettings.toggleInlineValues()}
              className={editorSettings.settings.inlineValues ? 'active' : ''}
              title={editorSettings.settings.inlineValues ? 'On' : 'Off'}
            >
              {editorSettings.settings.inlineValues ? 'On' : 'Off'}
            </S.MenuIconButton>
          </S.MenuRow>

          <S.MenuRow>
            <S.MenuLabel>
              <Braces size={14} />
              Hide Causality
            </S.MenuLabel>
            <S.MenuIconButton
              onClick={() => editorSettings.toggleHideCausality()}
              className={editorSettings.settings.hideCausality ? 'active' : ''}
              title={editorSettings.settings.hideCausality ? 'On' : 'Off'}
            >
              {editorSettings.settings.hideCausality ? 'On' : 'Off'}
            </S.MenuIconButton>
          </S.MenuRow>
        </S.MenuSection>

        {/* View Options */}
        <S.MenuSection>
          <S.MenuSectionTitle>View Options</S.MenuSectionTitle>

          <S.MenuRow>
            <S.MenuLabel>
              <ListOrdered size={14} />
              Line Numbers
            </S.MenuLabel>
            <S.MenuIconButton
              onClick={() => editorSettings.toggleLineNumbers()}
              className={editorSettings.settings.showLineNumbers ? 'active' : ''}
              title={editorSettings.settings.showLineNumbers ? 'On' : 'Off'}
            >
              {editorSettings.settings.showLineNumbers ? 'On' : 'Off'}
            </S.MenuIconButton>
          </S.MenuRow>

          <S.MenuRow>
            <S.MenuLabel>
              <Map size={14} />
              Minimap
            </S.MenuLabel>
            <S.MenuIconButton
              onClick={() => editorSettings.toggleMinimap()}
              className={editorSettings.settings.showMinimap ? 'active' : ''}
              title={editorSettings.settings.showMinimap ? 'On' : 'Off'}
            >
              {editorSettings.settings.showMinimap ? 'On' : 'Off'}
            </S.MenuIconButton>
          </S.MenuRow>

          {showLayoutToggle && (
            <S.MenuRow>
              <S.MenuLabel>
                <LayoutIcon size={14} />
                Split Layout
              </S.MenuLabel>
              <S.MenuIconButton
                onClick={onToggleLayout}
                title={layoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}
              >
                {layoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}
              </S.MenuIconButton>
            </S.MenuRow>
          )}
        </S.MenuSection>
      </S.EditorSettingsMenu>
    </div>,
    document.body
  );
};
