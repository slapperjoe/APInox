/**
 * useReorderDrag.tsx
 *
 * Drag-and-drop reordering for the unified explorer sidebar (operations
 * within a project, requests within an operation). Centralizes the
 * drag payload encoding, the drop-gap indicator state, and the per-row
 * drag handlers that were previously inlined six times in
 * UnifiedExplorerSidebar.
 */
import React, { useCallback, useState } from "react";

const DRAG_MIME = "application/x-tree-drag";

export interface DragPayload {
  type: string;
  projectName: string;
  fromIndex: number;
  operationName?: string;
}

export function makeDragData(payload: DragPayload): string {
  return JSON.stringify(payload);
}

export function readDragData(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

/** Scope of one reorderable list (a project's operations, an operation's requests). */
export interface ReorderScope {
  type: "operation" | "request";
  projectName: string;
  operationName?: string;
}

export interface ReorderDropGap extends ReorderScope {
  index: number;
}

function matchesScope(payload: DragPayload, scope: ReorderScope): boolean {
  return (
    payload.type === scope.type &&
    payload.projectName === scope.projectName &&
    (scope.type === "operation" || payload.operationName === scope.operationName)
  );
}

/** Half-row heuristic: a drop above the row's vertical midpoint inserts before it. */
function targetIndexFromEvent(e: React.DragEvent<HTMLElement>, baseIndex: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  return e.clientY < midY ? baseIndex : baseIndex + 1;
}

export function useReorderDrag() {
  const [dropGap, setDropGap] = useState<ReorderDropGap | null>(null);
  const clearDropGap = useCallback(() => setDropGap(null), []);

  /** Handlers for a draggable TreeItem row within `scope` at `baseIndex`. */
  const rowHandlers = (
    scope: ReorderScope,
    baseIndex: number,
    onReorder: (fromIndex: number, targetIndex: number) => void
  ) => ({
    onDragStart: (e: React.DragEvent<HTMLElement>) => {
      e.dataTransfer.setData(DRAG_MIME, makeDragData({ ...scope, fromIndex: baseIndex }));
      e.currentTarget.style.opacity = "0.3";
      e.currentTarget.style.fontSize = "10px";
    },
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropGap({ ...scope, index: targetIndexFromEvent(e, baseIndex) });
    },
    onDrop: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      clearDropGap();
      const payload = readDragData(e);
      if (payload && matchesScope(payload, scope)) {
        onReorder(payload.fromIndex, targetIndexFromEvent(e, baseIndex));
      }
    },
    onDragEnd: (e: React.DragEvent<HTMLElement>) => {
      e.currentTarget.style.opacity = "";
      e.currentTarget.style.fontSize = "";
      clearDropGap();
    },
  });

  /** Handlers for a drop-gap indicator row that inserts at a fixed `targetIndex`. */
  const gapRowHandlers = (
    scope: ReorderScope,
    targetIndex: number,
    onReorder: (fromIndex: number, targetIndex: number) => void
  ) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearDropGap();
      const payload = readDragData(e);
      if (payload && matchesScope(payload, scope)) {
        onReorder(payload.fromIndex, targetIndex);
      }
    },
  });

  return { dropGap, clearDropGap, rowHandlers, gapRowHandlers };
}

/** Visual drop-gap row: 24px tall with a 2px accent line at the drop position. */
export const ReorderGapRow: React.FC<{
  paddingLeft: number;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}> = ({ paddingLeft, onDragOver, onDrop }) => (
  <div
    style={{ height: 24, display: "flex", alignItems: "center", paddingLeft }}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <div style={{ flex: 1, height: 2, background: "var(--apinox-tab-active-border, #4a9eff)", borderRadius: 1 }} />
  </div>
);
