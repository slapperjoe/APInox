import React, { useState } from "react";
import styled, { keyframes, css } from "styled-components";

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
`;
import {
  FilePlus,
  FolderOpen,
  Trash2,
  Edit2,
  FileText,
  Binary,
  Code2,
  MoreVertical,
} from "lucide-react";
import { NoteEntry } from "@shared/models";
import {
  SidebarHeader,
  SidebarHeaderTitle,
  SidebarHeaderActions,
  HeaderButton,
} from "./shared/SidebarStyles";
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
  gap: 6px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 13px;
  background: ${(p) => p.$active ? "var(--apinox-list-activeSelectionBackground, rgba(0,122,204,0.25))" : "transparent"};
  color: ${(p) => p.$active ? "var(--apinox-list-activeSelectionForeground, #fff)" : "var(--apinox-foreground, #ccc)"};
  user-select: none;

  &:hover {
    background: ${(p) => p.$active
      ? "var(--apinox-list-activeSelectionBackground, rgba(0,122,204,0.25))"
      : "var(--apinox-list-hoverBackground, rgba(255,255,255,0.06))"};
  }

  .item-actions {
    opacity: 0;
  }
  &:hover .item-actions {
    opacity: 1;
  }
`;

const ItemName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 2px;
  flex-shrink: 0;
`;

const SmallBtn = styled.button<{ $confirming?: boolean }>`
  display: flex;
  align-items: center;
  padding: 2px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: ${(p) => p.$confirming ? "var(--apinox-errorForeground, #f44)" : "var(--apinox-foreground, #aaa)"};
  cursor: pointer;
  opacity: 0.7;
  animation: ${(p) => p.$confirming ? css`${shake} 0.4s ease-in-out` : "none"};

  &:hover {
    background: var(--apinox-list-hoverBackground, rgba(255,255,255,0.1));
    opacity: 1;
  }
`;

const DirtyDot = styled.span<{ $kind: "external" | "managed" }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $kind }) =>
    $kind === "external"
      ? "var(--apinox-charts-orange, #e8965e)"
      : "var(--apinox-disabledForeground, #888)"};
  flex-shrink: 0;
`;

const EmptyHint = styled.div`
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--apinox-descriptionForeground, rgba(204,204,204,0.4));
  line-height: 1.6;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function langIcon(entry: NoteEntry): React.ReactNode {
  if (entry.isBinary) return <Binary size={13} />;
  const h = entry.language;
  if (h === "markdown") return <FileText size={13} />;
  if (h === "xml" || h === "html") return <Code2 size={13} />;
  return <FileText size={13} />;
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

  return (
    <Panel>
      <SidebarHeader>
        <SidebarHeaderTitle>Notes</SidebarHeaderTitle>
        <SidebarHeaderActions>
          <HeaderButton onClick={() => newNote()} title="New note">
            <FilePlus size={15} />
          </HeaderButton>
          <HeaderButton onClick={openFileDialog} title="Open file…">
            <FolderOpen size={15} />
          </HeaderButton>
        </SidebarHeaderActions>
      </SidebarHeader>

      <List>
        {notes.length === 0 && (
          <EmptyHint>
            No notes yet.
            <br />
            Click <strong><FilePlus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> to create one, or <strong><FolderOpen size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> to open a file.
          </EmptyHint>
        )}

        {notes.map((entry) => {
          const isActive = activeNote?.entry.id === entry.id;
          const dirtyKind = isActive && activeNote ? noteDirtyKind(activeNote) : null;

          return (
            <Item
              key={entry.id}
              $active={isActive}
              onClick={() => openNote(entry)}
            >
              {langIcon(entry)}

              {renamingId === entry.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  style={{
                    flex: 1,
                    background: "var(--apinox-input-background, #3c3c3c)",
                    color: "var(--apinox-foreground, #ccc)",
                    border: "1px solid var(--apinox-focusBorder, #007acc)",
                    borderRadius: 3,
                    fontSize: 12,
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

              <ItemActions className="item-actions">
                <SmallBtn onClick={(e) => startRename(e, entry)} title="Rename">
                  <Edit2 size={12} />
                </SmallBtn>
                <SmallBtn onClick={(e) => handleDelete(e, entry)} title={deleteConfirm === entry.id ? "Click again to Confirm Delete" : "Delete"} $confirming={deleteConfirm === entry.id}>
                  <Trash2 size={12} />
                </SmallBtn>
              </ItemActions>
            </Item>
          );
        })}
      </List>
    </Panel>
  );
};
