import React, { useState } from "react";
import styled, { css } from "styled-components";
import { EmptyState } from "../common/EmptyState";
import { shake } from "../common/Button";
import {
  FilePlus,
  FolderOpen,
  Trash2,
  Edit2,
  FileText,
  Binary,
  Code2,
  MoreVertical,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { SidebarContextMenu, CtxMenuSection, CtxMenuItem } from "./shared/SidebarContextMenu";
import { NoteEntry } from "@shared/models";
import {
  SidebarHeader,
  SidebarHeaderTitle,
  SidebarHeaderActions,
  RowActions,
} from "./shared/SidebarStyles";
import { HeaderButton } from "../common/Button";
import { Tooltip } from "../common/Tooltip";
import { useNotes, noteDirtyKind } from "../../notes/NotesContext";

// ─── Styled ───────────────────────────────────────────────────────────────────

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
`;

const Item = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: var(--apinox-fs-base);
  background: ${(p) => p.$active ? "var(--apinox-list-activeSelectionBackground, #37373d)" : "transparent"};
  color: ${(p) => p.$active ? "var(--apinox-list-activeSelectionForeground, #ffffff)" : "var(--apinox-foreground, #cccccc)"};
  user-select: none;

  &:hover {
    background: ${(p) => p.$active
      ? "var(--apinox-list-activeSelectionBackground, #37373d)"
      : "var(--apinox-list-hoverBackground, #2a2d2e)"};
  }
`;

const ItemName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SmallBtn = styled.button<{ $confirming?: boolean }>`
  display: flex;
  align-items: center;
  padding: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${(p) => p.$confirming ? "var(--apinox-errorForeground, #f48771)" : "var(--apinox-foreground, #cccccc)"};
  cursor: pointer;
  opacity: 0.7;
  animation: ${(p) => p.$confirming ? css`${shake} 0.4s ease-in-out` : "none"};

  &:hover {
    background: var(--apinox-list-hoverBackground, #2a2d2e);
    opacity: 1;
  }
`;

const DirtyDot = styled.span<{ $kind: "external" | "managed" }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $kind }) =>
    $kind === "external"
      ? "var(--apinox-charts-orange, #d18616)"
      : "var(--apinox-disabledForeground, #656565)"};
  flex-shrink: 0;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function langIcon(entry: NoteEntry): React.ReactNode {
  if (entry.isBinary) return <Binary size={14} />;
  const h = entry.language;
  if (h === "markdown") return <FileText size={14} />;
  if (h === "xml" || h === "html") return <Code2 size={14} />;
  return <FileText size={14} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NotesList: React.FC = () => {
  const {
    notes,
    activeNote,
    openNote,
    newNote,
    openFileDialog,
    deleteNote,
    renameNote,
  } = useNotes();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) await renameNote(id, renameValue.trim());
    setRenamingId(null);
  };

  const startRename = (e: React.MouseEvent, entry: NoteEntry) => {
    e.stopPropagation();
    setRenamingId(entry.id);
    setRenameValue(entry.name);
  };

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: NoteEntry } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, entry: NoteEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, entry: NoteEntry) => {
    e.stopPropagation();
    if (deleteConfirm === entry.id) {
      // Second click: actually delete
      await deleteNote(entry.id);
      setDeleteConfirm(null);
    } else {
      // First click: enter confirmation mode
      setDeleteConfirm(entry.id);
    }
  };

  const handleOpenInExplorer = async (entry: NoteEntry) => {
    closeCtxMenu();
    if (entry.filePath) {
      // Open the parent folder in explorer
      const { open } = await import('@tauri-apps/plugin-shell');
      const { join, dirname } = await import('path');
      open(join(dirname(entry.filePath)));
    }
  };

  return (
    <Panel>
      <SidebarHeader>
        <SidebarHeaderTitle>Notes</SidebarHeaderTitle>
        <SidebarHeaderActions>
          <Tooltip content="New note">
            <HeaderButton onClick={() => newNote()}>
            <FilePlus size={16} />
            </HeaderButton>
          </Tooltip>
          <Tooltip content="Open file…">
            <HeaderButton onClick={openFileDialog}>
            <FolderOpen size={16} />
            </HeaderButton>
          </Tooltip>
        </SidebarHeaderActions>
      </SidebarHeader>

      <List>
        {notes.length === 0 && (
          <EmptyState icon={FileText} title="No notes yet" description="Use the buttons above to create or open notes." />
        )}

        {notes.map((entry) => {
          const isActive = activeNote?.entry.id === entry.id;
          const dirtyKind = isActive && activeNote ? noteDirtyKind(activeNote) : null;

          return (
            <Item
              key={entry.id}
              $active={isActive}
              onClick={() => openNote(entry)}
              onContextMenu={(e) => handleContextMenu(e, entry)}
            >
              {langIcon(entry)}

              {renamingId === entry.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  style={{
                    flex: 1,
                    background: "var(--apinox-input-background, #3c3c3c)",
                    color: "var(--apinox-foreground, #cccccc)",
                    border: "1px solid var(--apinox-focusBorder, #007fd4)",
                    borderRadius: 3,
                    fontSize: 'var(--apinox-fs-md)',
                    padding: "1px 4px",
                  }}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit(entry.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => setRenamingId(null)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <ItemName title={entry.filePath}>{entry.name}</ItemName>
              )}

              {dirtyKind && (
                <DirtyDot
                  $kind={dirtyKind}
                  title={dirtyKind === "external" ? "Unsaved changes" : "Modified — auto-saving"}
                />
              )}

              <RowActions $parent={Item} $gap="2px">
                <SmallBtn onClick={(e) => startRename(e, entry)} title="Rename">
                  <Edit2 size={12} />
                </SmallBtn>
                <SmallBtn onClick={(e) => handleDelete(e, entry)} title={deleteConfirm === entry.id ? "Click again to Confirm Delete" : "Delete"} $confirming={deleteConfirm === entry.id}>
                  <Trash2 size={12} />
                </SmallBtn>
              </RowActions>
            </Item>
          );
        })}
      </List>

      {/* Context Menu */}
      {ctxMenu && (
        <SidebarContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          sections={[{
            title: 'Actions',
            items: [
              { icon: Pencil, label: 'Rename', onClick: (e: any) => { e?.stopPropagation?.(); startRename(e as any, ctxMenu.entry); closeCtxMenu(); } },
              { icon: Trash2, label: 'Delete', danger: true, onClick: () => { handleDelete({ stopPropagation: () => {} } as any, ctxMenu.entry); closeCtxMenu(); } },
              { icon: ExternalLink, label: 'Show in Explorer', onClick: () => handleOpenInExplorer(ctxMenu.entry) },
            ],
          }] as CtxMenuSection[]}
          onClose={closeCtxMenu}
        />
      )}
    </Panel>
  );
};
