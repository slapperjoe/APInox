/**
 * StepEditorShell.tsx
 * Shared layout primitives for the workflow step editors
 * (Request / Condition / Delay / Loop / Script). Each editor keeps its own
 * fields and save logic; the chrome (container, header, step-name field,
 * label/input/info styles, action row) lives here.
 */
import React from "react";
import styled from "styled-components";
import { SPACING_SM, SPACING_MD } from "../../styles/spacing";

export const StepEditorContainer = styled.div<{ $scroll?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING_MD};
  padding: ${SPACING_MD};
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: ${(p) => (p.$scroll ? "auto" : "hidden")};
  box-sizing: border-box;
`;

export const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING_SM};
  padding-bottom: ${SPACING_SM};
  border-bottom: 1px solid var(--apinox-panel-border);
`;

export const StepIcon = styled.div<{ $color: string }>`
  color: ${(p) => p.$color};
`;

export const StepTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: var(--fw-semibold);
`;

export const StepSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING_SM};
`;

export const StepFlexSection = styled(StepSection)`
  flex: 1;
  min-height: 0;
`;

export const StepLabel = styled.label`
  font-size: var(--apinox-fs-md);
  font-weight: var(--fw-semibold);
  opacity: 0.8;
  display: block;
`;

export const StepInput = styled.input`
  background: var(--apinox-input-background);
  color: var(--apinox-input-foreground);
  border: 1px solid var(--apinox-input-border);
  padding: 8px 8px;
  border-radius: 4px;
  font-size: var(--apinox-fs-base);
  font-family: var(--apinox-font-family);
  width: 100%;

  &:focus {
    outline: 1px solid var(--apinox-focusBorder);
  }
`;

export const StepInfoBox = styled.div<{ $inline?: boolean }>`
  padding: ${SPACING_SM};
  background: var(--apinox-textCodeBlock-background);
  border: 1px solid var(--apinox-panel-border);
  border-radius: 4px;
  font-size: var(--apinox-fs-sm);
  opacity: 0.8;
  line-height: 1.4;
  ${(p) =>
    p.$inline
      ? `display: flex;
    align-items: center;
    gap: ${SPACING_SM};`
      : ""}

  code {
    background: var(--apinox-textCodeBlock-background);
    padding: 2px 4px;
    border-radius: 2px;
    font-family: "Consolas", "Courier New", monospace;
  }
`;

/** Plain (borderless) hint text under an input. */
export const StepHint = styled.div`
  margin-top: 4px;
  font-size: var(--apinox-fs-sm);
  color: var(--apinox-descriptionForeground);
`;

export const StepActionRow = styled.div<{
  $pushDown?: boolean;
  $bordered?: boolean;
  $right?: boolean;
}>`
  display: flex;
  gap: ${SPACING_SM};
  ${(p) => (p.$right ? "justify-content: flex-end;" : "")}
  ${(p) => (p.$pushDown ? "margin-top: auto;" : "")}
  ${(p) =>
    p.$bordered
      ? `padding-top: ${SPACING_MD};
    border-top: 1px solid var(--apinox-panel-border);`
      : ""}
`;

/**
 * Standard "Step Name" field: label + text input in a section.
 */
export const StepNameField: React.FC<{
  value: string | undefined;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <StepSection>
    <StepLabel>Step Name</StepLabel>
    <StepInput
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter step name"
    />
  </StepSection>
);
