/**
 * UnifiedHistoryPanel — the "History" sub-window inside the unified explorer
 * sidebar (a sibling of Quick Requests / Scrapbook / Tests / Workflows).
 *
 * Request history used to be a top-level rail view (`SidebarView.HISTORY`
 * rendered in `Sidebar.tsx`). It was folded into the unified explorer as a
 * bottom sub-section — same shape as Quick Requests — so the rail no longer
 * carries a second request-history surface and the history lives next to the
 * projects that produced it.
 *
 * The entry list, search + advanced filters and per-row actions (replay /
 * star / delete) come from the shared `HistorySidebar` content component.
 * This wrapper supplies the sub-window chrome (section header) and hosts the
 * scroll area, exactly like `ScrapbookPanel` does for Quick Requests.
 */
import React from "react";
import styled from "styled-components";
import HistorySidebar from "../sidebar/HistorySidebar";
import { RequestHistoryEntry } from "@shared/models";
import { SidebarHeaderActions, SidebarHeaderTitle } from "../sidebar/shared/SidebarStyles";

export interface UnifiedHistoryPanelProps {
    history: RequestHistoryEntry[];
    onReplay?: (entry: RequestHistoryEntry) => void;
    onToggleStar?: (id: string) => void;
    onDelete?: (id: string) => void;
    /**
     * Fill the host's full height (flex column) and make the entry list the
     * internal scroll container. Used by the resizable History subwindow in
     * the unified explorer sidebar; off by default so existing (non-filled)
     * hosts keep the panel's natural height + outer scroll.
     */
    fill?: boolean;
    /**
     * Omit the panel's own section header. Used by the unified explorer
     * sidebar, where the accordion section header (chevron + title) lives on
     * the wrapper, so the panel doesn't render a second title row.
     */
    chromeless?: boolean;
}

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    min-height: 28px;
    user-select: none;
    margin-left: -10px;
    margin-right: -10px;
`;

export const UnifiedHistoryPanel: React.FC<UnifiedHistoryPanelProps> = ({
    history,
    onReplay,
    onToggleStar,
    onDelete,
    fill = false,
    chromeless = false,
}) => {
    const sectionHeader = (
        <SectionHeader>
            <SidebarHeaderTitle>History</SidebarHeaderTitle>
            <SidebarHeaderActions />
        </SectionHeader>
    );

    const body = (
        <HistorySidebar
            history={history}
            onReplay={onReplay}
            onToggleStar={onToggleStar}
            onDelete={onDelete}
        />
    );

    if (fill) {
        return (
            <div
                data-testid="unified-history-panel-root"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                {!chromeless && sectionHeader}
                {/* Single internal scroll container — the entry list scrolls
                    inside the subwindow so a shrunken subwindow never pushes
                    the project tree out of view (same as ScrapbookPanel). The
                    EmptyState renders fill-centered in this same bounded area
                    when history is empty. */}
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", padding: "0 10px" }}>
                    {body}
                </div>
            </div>
        );
    }

    return <>{!chromeless && sectionHeader}{body}</>;
};

export default UnifiedHistoryPanel;
