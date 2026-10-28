import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { StatusBar, StatusBarLeft } from "../request-editor/components/RequestWorkspace.styles";
import { SPACING_MD, SPACING_SM, SPACING_XS } from "../styles/spacing";

const COLS = 16;
const ROW_HEIGHT = 20; // px per row in the virtual list
const OVERSCAN = 4; // rows rendered above and below the viewport

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--apinox-editor-background);
  color: var(--apinox-foreground);
  font-family: var(--apinox-editor-font-family);
  font-size: var(--apinox-fs-md);
`;

const ScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  user-select: text;

  thead th {
    position: sticky;
    top: 0;
    background: var(--apinox-editor-background);
    color: var(--apinox-descriptionForeground);
    font-weight: var(--fw-regular);
    padding: ${SPACING_XS} ${SPACING_SM};
    text-align: center;
    border-bottom: 1px solid var(--apinox-panel-border);
    z-index: 1;
  }

  tbody tr:nth-child(even) {
    background: var(--apinox-editor-lineHighlightBackground);
  }

  tbody tr:hover {
    background: var(--apinox-list-hoverBackground);
  }

  td {
    padding: ${SPACING_XS} ${SPACING_SM};
    white-space: pre;
  }
`;

const AddrCell = styled.td`
  color: var(--apinox-descriptionForeground);
  text-align: right;
  padding-right: ${SPACING_MD};
  width: 72px;
  min-width: 72px;
`;

const HexCell = styled.td<{ $active: boolean }>`
  text-align: center;
  width: 26px;
  min-width: 26px;
  cursor: pointer;
  color: ${(p) => (p.$active ? "var(--apinox-focusBorder)" : "inherit")};
  font-weight: ${(p) => (p.$active ? "var(--fw-bold)" : "var(--fw-regular)")};
`;

const AsciiCell = styled.td<{ $active: boolean }>`
  text-align: center;
  width: 11px;
  min-width: 11px;
  color: ${(p) => (p.$active ? "var(--apinox-focusBorder)" : "var(--apinox-descriptionForeground)")};
  font-weight: ${(p) => (p.$active ? "var(--fw-bold)" : "var(--fw-regular)")};
  cursor: pointer;
`;

const ReadBadge = styled.span`
  padding: ${SPACING_XS} ${SPACING_SM};
  background: var(--apinox-badge-background);
  border-radius: 50%;
  font-size: var(--apinox-fs-xs);
  font-weight: var(--fw-semibold);
`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accessible names for a byte cell. The visible text is two hex digits or one
 * character, which on its own gives a screen reader no context — the offset and the
 * value are both needed.
 *
 * The hex and ASCII columns render the same byte, so their names must differ: with
 * identical names a screen reader hears the same byte announced twice per row, and
 * queries for a cell by name match two elements.
 */
function hexLabel(offset: number, value: number | null): string {
  if (value === null) return `Byte ${offset}: past end of file`;
  return `Byte ${offset}: 0x${value.toString(16).padStart(2, "0").toUpperCase()}`;
}

function asciiLabel(offset: number, value: number | null): string {
  if (value === null) return `Byte ${offset}: past end of file`;
  const ch = value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : 'non-printable';
  return `Byte ${offset} as character: ${ch}`;
}

interface NotesHexEditorProps {
  data: Uint8Array;
}

export const NotesHexEditor = React.memo(({ data }: NotesHexEditorProps) => {
  const [cursor, setCursor] = useState(0);
  const [buffer, setBuffer] = useState<Uint8Array>(() => new Uint8Array(data));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBuffer(new Uint8Array(data));
    setCursor(0);
  }, [data]);

  const totalRows = Math.ceil(buffer.length / COLS);

  // Virtualise rows — only render what fits plus a small overscan
  const [visibleStart, setVisibleStart] = useState(0);
  const [viewHeight, setViewHeight] = useState(400);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setVisibleStart(Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - OVERSCAN));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const visibleCount = Math.ceil(viewHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

  /**
   * Move the cursor and keep its row inside the rendered window.
   *
   * The grid is virtualised, so a cursor that walks off the rendered rows has no
   * element to point at — `aria-activedescendant` would reference an id that does
   * not exist, and a screen reader would announce nothing. Scrolling alone is not
   * enough either: the scroll event is asynchronous, so the window is set here as
   * well.
   */
  const moveCursor = useCallback((offset: number) => {
    if (buffer.length === 0) return;
    const clamped = Math.max(0, Math.min(buffer.length - 1, offset));
    setCursor(clamped);

    const row = Math.floor(clamped / COLS);
    const el = scrollRef.current;
    if (el) {
      const top = row * ROW_HEIGHT;
      if (top < el.scrollTop || top + ROW_HEIGHT > el.scrollTop + el.clientHeight) {
        el.scrollTop = top;
      }
    }
    setVisibleStart(Math.max(0, row - OVERSCAN));
  }, [buffer.length]);

  /**
   * Grid keyboard navigation — one tab stop for the whole dump, arrow keys move the
   * cursor. Cells are not individually focusable: a 10 MiB note is half a million
   * tab stops.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          moveCursor(cursor - 1);
          break;
        case "ArrowRight":
          moveCursor(cursor + 1);
          break;
        case "ArrowUp":
          moveCursor(cursor - COLS);
          break;
        case "ArrowDown":
          moveCursor(cursor + COLS);
          break;
        case "Home":
          moveCursor(0);
          break;
        case "End":
          moveCursor(buffer.length - 1);
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [cursor, buffer.length, moveCursor]
  );

  const headerCols = Array.from({ length: COLS }, (_, i) =>
    i.toString(16).toUpperCase().padStart(2, "0")
  );

  return (
    <Wrapper>
      <ScrollArea ref={scrollRef}>
        {/* spacer to maintain correct total scroll height */}
        <div style={{ height: totalRows * ROW_HEIGHT, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: visibleStart * ROW_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            <Table
              role="grid"
              tabIndex={0}
              aria-label="Hex dump"
              aria-activedescendant={buffer.length > 0 ? `byte-${cursor}` : undefined}
              onKeyDown={handleKeyDown}
            >
              <thead>
                <tr role="row">
                  <th role="columnheader" style={{ width: 72 }}>Offset</th>
                  {headerCols.map((h) => (
                    <th key={h} role="columnheader" style={{ width: 26 }}>
                      {h}
                    </th>
                  ))}
                  <th role="columnheader" colSpan={COLS} style={{ paddingLeft: SPACING_MD, textAlign: "left" }}>
                    ASCII
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: visibleEnd - visibleStart }, (_, ri) => {
                  const row = visibleStart + ri;
                  const rowOffset = row * COLS;
                  const cells = Array.from({ length: COLS }, (__, ci) => {
                    const off = rowOffset + ci;
                    return off < buffer.length ? buffer[off] : null;
                  });
                  return (
                    <tr key={row} role="row" style={{ height: ROW_HEIGHT }}>
                      <AddrCell role="rowheader">
                        {rowOffset.toString(16).padStart(8, "0").toUpperCase()}
                      </AddrCell>
                      {cells.map((b, ci) => {
                        const off = rowOffset + ci;
                        return (
                          <HexCell
                            key={ci}
                            id={`byte-${off}`}
                            role="gridcell"
                            aria-selected={off === cursor}
                            aria-label={hexLabel(off, b)}
                            $active={off === cursor}
                            onClick={() => b !== null && moveCursor(off)}
                          >
                            {b !== null ? b.toString(16).padStart(2, "0").toUpperCase() : "  "}
                          </HexCell>
                        );
                      })}
                      {/* ASCII column */}
                      {cells.map((b, ci) => {
                        const off = rowOffset + ci;
                        const ch =
                          b !== null && b >= 0x20 && b < 0x7f
                            ? String.fromCharCode(b)
                            : b !== null
                            ? "·"
                            : " ";
                        return (
                          <AsciiCell
                            key={`a${ci}`}
                            role="gridcell"
                            aria-selected={off === cursor}
                            aria-label={asciiLabel(off, b)}
                            $active={off === cursor}
                            onClick={() => b !== null && moveCursor(off)}
                          >
                            {ch}
                          </AsciiCell>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>
      </ScrollArea>

      <StatusBar>
        <StatusBarLeft>
          <span>{buffer.length.toLocaleString()} bytes</span>
          <span>
            Offset: 0x{cursor.toString(16).padStart(4, "0").toUpperCase()} ({cursor})
          </span>
        </StatusBarLeft>
        <ReadBadge>Read-only</ReadBadge>
      </StatusBar>
    </Wrapper>
  );
});
