import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ListChecks } from "lucide-react";
import { WorkflowStep } from "@shared/models";
import { PrimaryButton } from "../common/Button";
import { CustomSelect } from "../common/CustomSelect";
import {
  StepEditorContainer,
  StepHeader,
  StepIcon,
  StepTitle,
  StepSection,
  StepLabel,
  StepInfoBox,
  StepActionRow,
  StepNameField,
} from "./StepEditorShell";

const PreviewBox = styled.div`
  padding: 12px;
  background: var(--apinox-editor-background);
  border: 1px solid var(--apinox-panel-border);
  border-radius: 4px;
  font-size: var(--apinox-fs-md);
  color: var(--apinox-editor-foreground);
  white-space: pre-wrap;
  word-break: break-word;
`;

const PreviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: var(--apinox-fs-base);
`;

const PreviewMeta = styled.span`
  font-size: 11px;
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
`;

const VariablesInput = styled.textarea`
  background: var(--apinox-input-background);
  color: var(--apinox-input-foreground);
  border: 1px solid var(--apinox-input-border);
  padding: 8px;
  border-radius: 4px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: var(--apinox-fs-md);
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
`;

const Hint = styled.div`
  font-size: 11px;
  color: var(--apinox-descriptionForeground);
  margin-top: 4px;
`;

/** Global test cases available to a 'testCase' workflow step. */
export interface TestCaseStepOption {
  id: string;
  name: string;
  steps?: Array<{ id: string; name: string; type: string }>;
  variables?: Record<string, string>;
}

interface TestCaseStepEditorProps {
  step: WorkflowStep;
  /** Global test cases available for reference. */
  testCases: TestCaseStepOption[];
  onUpdate: (step: WorkflowStep) => void;
}

/**
 * Editor for a workflow `testCase` step. The persisted step carries only
 * `testCaseId` + `testCaseVariables`; the referenced case's `steps` are
 * embedded into the run payload at run time (never persisted). Variables show
 * the referenced case's defaults with the saved overrides on top, and only the
 * DIFF from those defaults is persisted — so later edits to the case's own
 * defaults still apply to steps that never overrode them.
 */
export const TestCaseStepEditor: React.FC<TestCaseStepEditorProps> = ({
  step,
  testCases,
  onUpdate,
}) => {
  const [name, setName] = useState(step.name);
  const [testCaseId, setTestCaseId] = useState(step.testCaseId || "");

  const mergeVariablesJson = (caseId: string, overrides: Record<string, string> | undefined) =>
    JSON.stringify(
      {
        ...(testCases.find((c) => c.id === caseId)?.variables || {}),
        ...(overrides || {}),
      },
      null,
      2,
    );

  const [varsJson, setVarsJson] = useState(() =>
    mergeVariablesJson(step.testCaseId || "", step.testCaseVariables),
  );

  useEffect(() => {
    setName(step.name);
    setTestCaseId(step.testCaseId || "");
    setVarsJson(mergeVariablesJson(step.testCaseId || "", step.testCaseVariables));
    // testCases is a stable global list; only re-sync when the step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const referenced = testCases.find((c) => c.id === testCaseId);
  const referencedSteps = referenced?.steps || [];

  const handleSelectCase = (value: string) => {
    setTestCaseId(value);
    // Re-base the shown variables on the newly selected case's defaults.
    setVarsJson(mergeVariablesJson(value, step.testCaseVariables));
  };

  const handleSave = () => {
    const defaults = referenced?.variables || {};
    // Both the try and the catch assign, so the initial value was dead.
    let overrides: Record<string, string>;
    try {
      const edited = JSON.parse(varsJson || "{}") as Record<string, unknown>;
      overrides = {};
      for (const [k, v] of Object.entries(edited)) {
        if (!(k in defaults) || defaults[k] !== String(v)) {
          overrides[k] = String(v);
        }
      }
    } catch {
      // Invalid JSON — keep the previously saved overrides.
      overrides = step.testCaseVariables || {};
    }
    onUpdate({ ...step, name, testCaseId, testCaseVariables: overrides });
  };

  return (
    <StepEditorContainer>
      <StepHeader>
        <StepIcon $color="var(--apinox-charts-blue)">
          <ListChecks size={20} />
        </StepIcon>
        <StepTitle>Test Case Step</StepTitle>
      </StepHeader>

      <StepNameField value={name} onChange={setName} />

      <StepSection>
        <StepLabel>Test Case</StepLabel>
        {/* Themed CustomSelect — a native <select>'s popup ignores the app skin. */}
        <CustomSelect
          value={testCaseId}
          placeholder="Select a test case..."
          onChange={handleSelectCase}
          options={[
            { value: "", label: "Select a test case..." },
            ...testCases.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <StepInfoBox>
          Runs the referenced case's steps in order. Its variables are scoped to
          this step; variables it extracts become available to later workflow
          steps. References are cycle-checked on save.
        </StepInfoBox>
      </StepSection>

      <StepSection>
        <StepLabel>Override Variables (JSON)</StepLabel>
        <VariablesInput
          value={varsJson}
          onChange={(e) => setVarsJson(e.target.value)}
          rows={8}
          placeholder='{"variable": "value"}'
        />
        <Hint>
          {referenced
            ? "Values override the referenced case's own variables (which override its suite's and the environment). Only changed values are saved as overrides; references are cycle-checked on save."
            : "Values override the referenced case's own variables. References are cycle-checked on save."}
        </Hint>
      </StepSection>

      <StepSection>
        <StepLabel>
          Test Case steps{referenced ? ` (${referencedSteps.length})` : ""}
        </StepLabel>
        <PreviewBox>
          {!referenced
            ? "Select a test case to preview its steps."
            : referencedSteps.length === 0
              ? "This test case has no steps yet."
              : referencedSteps.map((s, i) => (
                  <PreviewRow key={s.id || i}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </span>
                    <PreviewMeta>{s.type}</PreviewMeta>
                  </PreviewRow>
                ))}
        </PreviewBox>
        {referenced && referencedSteps.length > 0 && (
          <Hint>Read-only — edit these steps in the TESTS view.</Hint>
        )}
      </StepSection>

      <StepActionRow $pushDown>
        <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
      </StepActionRow>
    </StepEditorContainer>
  );
};
