import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { WorkflowStep } from "@shared/models";
import { AlertCircle } from "lucide-react";
import { PrimaryButton } from "../common/Button";
import { CustomSelect } from "../common/CustomSelect";
import {
  StepEditorContainer,
  StepHeader,
  StepIcon,
  StepTitle,
  StepSection,
  StepLabel,
  StepInput,
  StepInfoBox,
  StepActionRow,
  StepNameField,
} from "./StepEditorShell";

const PreviewBox = styled.div`
  padding: 12px;
  background: var(--apinox-editor-background);
  border: 1px solid var(--apinox-panel-border);
  border-radius: 4px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 12px;
  color: var(--apinox-editor-foreground);
  white-space: pre-wrap;
  word-break: break-word;
`;

interface ConditionStepEditorProps {
  step: WorkflowStep;
  onUpdate: (step: WorkflowStep) => void;
}

export const ConditionStepEditor: React.FC<ConditionStepEditorProps> = ({
  step,
  onUpdate,
}) => {
  const [name, setName] = useState(step.name);
  const [expression, setExpression] = useState(
    step.condition?.expression || "",
  );
  const [operator, setOperator] = useState(
    step.condition?.operator || "equals",
  );
  const [value, setValue] = useState(step.condition?.expectedValue || "");

  useEffect(() => {
    setName(step.name);
    setExpression(step.condition?.expression || "");
    setOperator(step.condition?.operator || "equals");
    setValue(step.condition?.expectedValue || "");
  }, [step]);

  const handleSave = () => {
    onUpdate({
      ...step,
      name,
      condition: {
        id: step.condition?.id || step.id,
        expression,
        operator: operator as any,
        expectedValue: value,
      },
    });
  };

  const getPreviewText = () => {
    if (!expression) return "No condition configured";

    const operatorText = {
      equals: "==",
      notEquals: "!=",
      contains: "contains",
      notContains: "does not contain",
      greaterThan: ">",
      lessThan: "<",
      exists: "exists",
      notExists: "does not exist",
    };

    if (operator === "exists" || operator === "notExists") {
      return `if (${expression} ${operatorText[operator]}) { continue } else { skip remaining steps }`;
    }

    return `if (${expression} ${operatorText[operator]} "${value}") { continue } else { skip remaining steps }`;
  };

  return (
    <StepEditorContainer>
      <StepHeader>
        <StepIcon $color="var(--apinox-charts-yellow)">
          <AlertCircle size={20} />
        </StepIcon>
        <StepTitle>Condition Step</StepTitle>
      </StepHeader>

      <StepNameField value={name} onChange={setName} />

      <StepSection>
        <StepLabel>Expression / Variable</StepLabel>
        <StepInput
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="e.g., {{status}} or {{responseCode}}"
        />
        <StepInfoBox>
          Reference workflow variables using {`{{variableName}}`} syntax
        </StepInfoBox>
      </StepSection>

      <StepSection>
        <StepLabel>Operator</StepLabel>
        <CustomSelect
          value={operator}
          onChange={(v) => setOperator(v as any)}
          options={[
            { value: "equals", label: "Equals" },
            { value: "notEquals", label: "Not Equals" },
            { value: "contains", label: "Contains" },
            { value: "notContains", label: "Not Contains" },
            { value: "greaterThan", label: "Greater Than" },
            { value: "lessThan", label: "Less Than" },
            { value: "exists", label: "Exists" },
            { value: "notExists", label: "Not Exists" },
          ]}
        />
      </StepSection>

      {operator !== "exists" && operator !== "notExists" && (
        <StepSection>
          <StepLabel>Compare Value</StepLabel>
          <StepInput
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value to compare against"
          />
        </StepSection>
      )}

      <StepSection>
        <StepLabel>Preview</StepLabel>
        <PreviewBox>{getPreviewText()}</PreviewBox>
        <StepInfoBox>
          Note: Branching to specific steps not yet fully implemented. If
          condition is false, remaining steps will be skipped.
        </StepInfoBox>
      </StepSection>

      <StepActionRow $pushDown>
        <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
      </StepActionRow>
    </StepEditorContainer>
  );
};
