/**
 * ProxyModal.tsx
 * Shared modal chrome for the proxy pages (Mock rules, Breakpoints,
 * Replace rules, File watcher). Replaces per-page hand-rolled fixed
 * overlays + panel divs.
 */
import React, { ReactNode } from "react";
import styled from "styled-components";
import { tokens } from "./tokens";

const Overlay = styled.div<{ $dim: number; $zIndex: number; $padding: string }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, ${(p) => p.$dim});
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${(p) => p.$zIndex};
  padding: ${(p) => p.$padding};
`;

export const ModalPanel = styled.div<{
  $width?: string;
  $maxWidth?: string;
  $maxHeight?: string;
  $scroll?: boolean;
  $bordered?: boolean;
  $shadow?: boolean;
  $columnGap?: string;
  $radius?: string;
  $panelPadding?: string;
}>`
  background: ${tokens.surface.panel};
  padding: ${(p) => p.$panelPadding ?? "24px"};
  border-radius: ${(p) => p.$radius ?? tokens.radius.lg};
  width: ${(p) => p.$width ?? "520px"};
  max-width: ${(p) => p.$maxWidth ?? "100%"};
  ${(p) => (p.$maxHeight ? `max-height: ${p.$maxHeight};` : "")}
  ${(p) => (p.$scroll ? "overflow: auto;" : "")}
  ${(p) => (p.$bordered ? `border: 1px solid ${tokens.border.default};` : "")}
  ${(p) => (p.$shadow ? "box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);" : "")}
  ${(p) =>
    p.$columnGap
      ? `display: flex;
    flex-direction: column;
    gap: ${p.$columnGap};`
      : ""}
`;

interface ProxyModalProps {
  children: ReactNode;
  /** Backdrop opacity (0–1). */
  dim?: number;
  zIndex?: number;
  /** Overlay padding. */
  padding?: string;
  /** Panel width. */
  width?: string;
  maxWidth?: string;
  maxHeight?: string;
  /** Panel scrolls when content overflows. */
  scroll?: boolean;
  bordered?: boolean;
  shadow?: boolean;
  /** Panel becomes a flex column with this gap. */
  columnGap?: string;
  radius?: string;
  /** Panel padding (default 24px; use "0" for self-padding content). */
  panelPadding?: string;
  /** Called when the backdrop (not the panel) is clicked. */
  onBackdropClick?: () => void;
}

export const ProxyModal: React.FC<ProxyModalProps> = ({
  children,
  dim = 0.8,
  zIndex = 1000,
  padding = tokens.space["6"],
  width,
  maxWidth,
  maxHeight,
  scroll,
  bordered,
  shadow,
  columnGap,
  radius,
  panelPadding,
  onBackdropClick,
}) => (
  <Overlay
    $dim={dim}
    $zIndex={zIndex}
    $padding={padding}
    onClick={onBackdropClick}
  >
    <ModalPanel
      onClick={(e) => e.stopPropagation()}
      $width={width}
      $maxWidth={maxWidth}
      $maxHeight={maxHeight}
      $scroll={scroll}
      $bordered={bordered}
      $shadow={shadow}
      $columnGap={columnGap}
      $radius={radius}
      $panelPadding={panelPadding}
    >
      {children}
    </ModalPanel>
  </Overlay>
);
