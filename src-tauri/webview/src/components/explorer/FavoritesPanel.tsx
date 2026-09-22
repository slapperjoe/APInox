/**
 * FavoritesPanel — the "Favorites" sub-window of the unified explorer
 * sidebar: every starred request-history entry in one place (a sibling of
 * History / Quick Requests, same accordion + fixed-height shape).
 *
 * A favorite is a NAMED shortcut: each row shows just the entry's name
 * (renamable in place from this panel — right-click → Rename) and a
 * monochrome lucide star on the right (clicking it un-stars the entry).
 * No details line, no meta — the name IS the row. Clicking the row replays
 * the request, exactly like the History list.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Star, Trash2, Pencil } from "lucide-react";
import { SidebarContextMenu, CtxMenuSection } from "../sidebar/shared/SidebarContextMenu";
import { EmptyState } from "../common/EmptyState";
import { RequestHistoryEntry } from "@shared/models";

export interface FavoritesPanelProps {
    /** Starred request-history entries (any order). */
    entries: RequestHistoryEntry[];
    /** Replay a starred entry (same handler the History list uses). */
    onReplay?: (entry: RequestHistoryEntry) => void;
    /** Un-star an entry (removes it from favorites). */
    onToggleStar?: (id: string) => void;
    /** Delete an entry from history. */
    onDelete?: (id: string) => void;
    /** Rename an entry (persisted via the history store). */
    onRename?: (id: string, name: string) => void;
}

const List = styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
`;

const Row = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    cursor: pointer;
    color: inherit;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const RowName = styled.div`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--apinox-fs-sm);
`;

/** Inline rename input shown in place of the row's name. */
const RenameInput = styled.input`
    flex: 1;
    min-width: 0;
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-focusBorder);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: var(--apinox-fs-sm);
    font-family: inherit;

    &:focus {
        outline: none;
    }
`;

/** A favorite shows just its name (the generic "Request" placeholder is
    kept here — it's the label an unnamed favorited request gets). */
const resolveName = (entry: RequestHistoryEntry): string => {
    return entry.requestName || 'Request';
};

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
    entries,
    onReplay,
    onToggleStar,
    onDelete,
    onRename,
}) => {
    // Most recent first: favorites come from all time groups, so a stable
    // recency order (not "today → older") is the useful one here.
    const sorted = useMemo(
        () => [...entries].sort((a, b) => b.timestamp - a.timestamp),
        [entries]
    );

    const [rowCtxMenu, setRowCtxMenu] = useState<{ x: number; y: number; entry: RequestHistoryEntry } | null>(null);

    // Inline rename state: the entry being renamed + the draft value.
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const renameInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    const startRename = (entry: RequestHistoryEntry) => {
        setRenamingId(entry.id);
        setRenameValue(resolveName(entry));
    };

    const commitRename = () => {
        if (renamingId) {
            onRename?.(renamingId, renameValue);
        }
        setRenamingId(null);
    };

    const cancelRename = () => setRenamingId(null);

    const rowSections = (entry: RequestHistoryEntry): CtxMenuSection[] => [
        {
            title: "Entry",
            items: [
                {
                    icon: Pencil,
                    label: "Rename",
                    onClick: () => {
                        startRename(entry);
                        setRowCtxMenu(null);
                    },
                },
                {
                    icon: Star,
                    label: "Remove from favorites",
                    onClick: () => {
                        onToggleStar?.(entry.id);
                        setRowCtxMenu(null);
                    },
                },
                {
                    icon: Trash2,
                    label: "Delete",
                    danger: true,
                    onClick: () => {
                        onDelete?.(entry.id);
                        setRowCtxMenu(null);
                    },
                },
            ],
        },
    ];

    return (
        <>
            <List data-testid="favorites-list">
                {sorted.length === 0 ? (
                    <EmptyState
                        icon={Star}
                        title="No favorites yet"
                        description="Right-click a history entry → “Add to favorites”"
                    />
                ) : (
                    sorted.map(entry => {
                        const isRenaming = renamingId === entry.id;
                        return (
                            <Row
                                key={entry.id}
                                data-testid="favorites-row"
                                onClick={() => {
                                    if (!isRenaming) onReplay?.(entry);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRowCtxMenu({ x: e.clientX, y: e.clientY, entry });
                                }}
                            >
                                {isRenaming ? (
                                    <RenameInput
                                        ref={renameInputRef}
                                        value={renameValue}
                                        data-testid="favorites-rename-input"
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={commitRename}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") commitRename();
                                            if (e.key === "Escape") cancelRename();
                                        }}
                                    />
                                ) : (
                                    <RowName title={resolveName(entry)}>
                                        {resolveName(entry)}
                                    </RowName>
                                )}
                            </Row>
                        );
                    })
                )}
            </List>

            {rowCtxMenu && (
                <SidebarContextMenu
                    x={rowCtxMenu.x}
                    y={rowCtxMenu.y}
                    sections={rowSections(rowCtxMenu.entry)}
                    onClose={() => setRowCtxMenu(null)}
                />
            )}
        </>
    );
};

export default FavoritesPanel;
