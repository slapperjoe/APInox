import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";

const COLS = 16;
const ROW_HEIGHT = 20; // px per row in the virtual list

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--apinox-editor-background, #1e1e1e);
  color: var(--apinox-foreground, #ccc);
  font-family: var(--apinox-editor-font-family, "JetBrains Mono", monospace);
  font-size: 12px;
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
    background: var(--apinox-editor-background, #1e1e1e);
    color: rgba(204, 204, 204, 0.4);
    font-weight: 400;
    padding: 2px 4px;
    text-align: center;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
    z-index: 1;
  }

  tbody tr:nth-child(even) {
    background: rgba(255, 255, 255, 0.025);
  }

  tbody tr:hover {
    background: rgba(0, 122, 204, 0.08);
  }

  td {
    padding: 1px 3px;
    white-space: pre;
  }
`;

const AddrCell = styled.td`
  color: rgba(204, 204, 204, 0.4);
  text-align: right;
  padding-right: 12px !important;
  width: 72px;
  min-width: 72px;
`;

const HexCell = styled.td<{ $active: boolean }>`
  text-align: center;
  width: 26px;
  min-width: 26px;
  cursor: default;
  color: ${(p) => (p.$active ? "#007acc" : "inherit")};
  font-weight: ${(p) => (p.$active ? 700 : 400)};
`;

const AsciiCell = styled.td<{ $active: boolean }>`
  text-align: center;
  width: 11px;
  min-width: 11px;
  color: ${(p) => (p.$active ? "#007acc" : "rgba(204,204,204,0.5)")};
  font-weight: ${(p) => (p.$active ? 700 : 400)};
  cursor: default;
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 3px 12px;
  font-size: 11px;
  flex-shrink: 0;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
  background: var(--apinox-statusBar-background, #007acc);
  color: var(--apinox-statusBar-foreground, #fff);
`;

const ReadOnlyBadge = styled.span`
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
`;

// ─────────────────────────────────────────────────────────────────────────────

interface NotesHexEditorProps {
  data: Uint8Array;
  readOnly?: boolean;
  onByteChange?: (offset: number, value: number) => void;
}

export const NotesHexEditor: React.FC<NotesHexEditorProps> = ({
  data,
  readOnly = false,
  onByteChange,
}) => {
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
      setVisibleStart(Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - 4));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const visibleCount = Math.ceil(viewHeight / ROW_HEIGHT) + 8;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

  const handleCellClick = (offset: number) => setCursor(offset);

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
            <Table>
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Offset</th>
                  {headerCols.map((h) => (
                    <th key={h} style={{ width: 26 }}>
                      {h}
                    </th>
                  ))}
                  <th colSpan={COLS} style={{ paddingLeft: 12, textAlign: "left" }}>
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
                    <tr key={row} style={{ height: ROW_HEIGHT }}>
                      <AddrCell>
                        {rowOffset.toString(16).padStart(8, "0").toUpperCase()}
                      </AddrCell>
                      {cells.map((b, ci) => {
                        const off = rowOffset + ci;
                        return (
                          <HexCell
                            key={ci}
                            $active={off === cursor}
                            onClick={() => b !== null && handleCellClick(off)}
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
                            $active={off === cursor}
                            onClick={() => b !== null && handleCellClick(off)}
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
        <span>{buffer.length.toLocaleString()} bytes</span>
        <span>
          Offset: 0x{cursor.toString(16).padStart(4, "0").toUpperCase()} ({cursor})
        </span>
        {readOnly && <ReadOnlyBadge>READ ONLY</ReadOnlyBadge>}
        {!readOnly && onByteChange && (
          <span style={{ color: "rgba(255,255,255,0.6)" }}>read-only view</span>
        )}
      </StatusBar>
    </Wrapper>
  );
};
