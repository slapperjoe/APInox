/**
 * splitPane.tsx
 * Shared request/response split-pane primitives for the proxy views
 * (TrafficDetails / FileWatcherPage): pane chrome, divider, and the
 * drag-to-resize algorithm (natural size = line count * line height +
 * pane chrome overhead, clamped to the container).
 */
import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { tokens } from "./tokens";

export const SPLIT_LINE_HEIGHT = 19;
export const SPLIT_PANE_OVERHEAD = 101;

export const EditorPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid ${tokens.border.default};
  &:last-child {
    border-bottom: none;
  }
`;

export const SplitDivider = styled.div<{ $dragging: boolean }>`
  height: 5px;
  background: ${(p) =>
    p.$dragging ? tokens.status.accentDark : tokens.surface.elevated};
  cursor: ns-resize;
  flex-shrink: 0;
  transition: background 0.15s;
  user-select: none;
  &:hover {
    background: ${tokens.status.accentDark};
  }
`;

/**
 * Natural top-pane height for the given line count: content lines plus
 * chrome, clamped to a fraction of the container height.
 */
export function naturalPanePx(
  lineCount: number,
  containerHeight: number,
  ratio: number,
): number | undefined {
  if (containerHeight <= 0) return undefined;
  return Math.min(
    (lineCount + 3) * SPLIT_LINE_HEIGHT + SPLIT_PANE_OVERHEAD,
    containerHeight * ratio,
  );
}

interface UseSplitPaneDragOptions {
  /** Minimum top-pane height while dragging. */
  minPx?: number;
  /** Maximum top-pane height as a fraction of the container. */
  maxRatio?: number;
}

/**
 * Drag-to-resize state for a vertical split. The consumer derives
 * `effectivePx = userPx ?? calculatedPx` and passes it as `startPx`
 * when the drag begins.
 */
export function useSplitPaneDrag(
  containerHeight: number,
  options: UseSplitPaneDragOptions = {},
) {
  const { minPx = 60, maxRatio = 0.85 } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [userPx, setUserPx] = useState<number | null>(null);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent, startPx: number) => {
      e.preventDefault();
      const startY = e.clientY;
      setIsDragging(true);

      const onMove = (ev: MouseEvent) => {
        const max =
          containerHeight > 0 ? containerHeight * maxRatio : 9999;
        setUserPx(
          Math.max(minPx, Math.min(startPx + (ev.clientY - startY), max)),
        );
      };
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [containerHeight, minPx, maxRatio],
  );

  return { isDragging, userPx, setUserPx, handleDividerMouseDown };
}
