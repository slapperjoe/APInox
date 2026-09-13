/**
 * PanelShell.tsx
 * Shared chrome for the list/field panels (headers, assertions, extractors,
 * query params, form data, security, attachments, ...).
 */
import styled from "styled-components";
import { SPACING_XS, SPACING_SM } from "../../styles/spacing";

/** Standard scrollable panel body. */
export const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--apinox-foreground);
  background: var(--apinox-editor-background);
  padding: ${SPACING_SM};
  gap: ${SPACING_SM};
  overflow-y: auto;
`;

/** Transparent icon action button (row actions, add/remove). */
export const PanelIconButton = styled.button`
  background: transparent;
  border: none;
  color: var(--apinox-icon-foreground);
  cursor: pointer;
  padding: ${SPACING_XS};
  border-radius: 3px;
  display: flex;
  align-items: center;

  &:hover:not(:disabled) {
    background: var(--apinox-toolbar-hoverBackground);
    color: var(--apinox-foreground);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

/** Row that stretches to fill the panel's cross axis. */
export const PanelFlexColumn = styled.div`
  flex: 1;
`;
