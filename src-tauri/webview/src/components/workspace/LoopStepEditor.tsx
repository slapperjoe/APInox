import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { EmptyState } from "../common/EmptyState";
import { WorkflowStep } from "@shared/models";
import { SPACING_SM, SPACING_MD } from "../../styles/spacing";
import {
  Repeat,
  Clock,
  AlertCircle,
  Code,
  GitBranch,
  Plus,
} from "lucide-react";
import { PrimaryButton, SecondaryButton } from "../common/Button";
import { DelayStepEditor } from "./DelayStepEditor";
import { ConditionStepEditor } from "./ConditionStepEditor";
import { ScriptStepEditor } from "./ScriptStepEditor";
import { RequestStepEditor } from "./RequestStepEditor";
import {
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
import { v4 as uuidv4 } from "uuid";
import { CustomSelect } from "../common/CustomSelect";

const Container = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
`;

const LeftPanel = styled.div`
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: ${SPACING_MD};
  padding: ${SPACING_MD};
  border-right: 1px solid var(--apinox-panel-border);
  overflow-y: auto;
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StepsList = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--apinox-panel-border);
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
`;

const StepItem = styled.div<{ $isSelected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${SPACING_SM};
  padding: ${SPACING_SM};
  border-bottom: 1px solid var(--apinox-panel-border);
  cursor: pointer;
  background: ${(props) =>
    props.$isSelected
      ? "var(--apinox-list-activeSelectionBackground)"
      : "transparent"};

  &:hover {
    background: ${(props) =>
      props.$isSelected
        ? "var(--apinox-list-activeSelectionBackground)"
        : "var(--apinox-list-hoverBackground)"};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const StepIconWrapper = styled.div`
  display: flex;
  align-items: center;
  opacity: 0.7;
`;

const StepDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const StepName = styled.div`
  font-size: var(--apinox-fs-base);
  font-weight: var(--fw-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StepType = styled.div`
  font-size: var(--apinox-fs-sm);
  opacity: 0.6;
  text-transform: uppercase;
`;

const EmptySteps = styled.div`
  padding: ${SPACING_MD};
  text-align: center;
  opacity: 0.6;
  font-size: var(--apinox-fs-md);
`;

const AddStepDropdown = styled.div`
  position: relative;
  width: 100%;
`;

const DropdownButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--apinox-button-secondaryBackground);
  color: var(--apinox-button-secondaryForeground);
  border: 1px dashed var(--apinox-panel-border);
  cursor: pointer;
  font-size: var(--apinox-fs-base);
  width: 100%;
  justify-content: center;

  &:hover {
    background: var(--apinox-button-secondaryHoverBackground);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--apinox-dropdown-background);
  border: 1px solid var(--apinox-dropdown-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  margin-top: 2px;
`;

const DropdownItem = styled.div`
  padding: 8px 12px;
  font-size: var(--apinox-fs-base);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--apinox-dropdown-foreground);

  &:hover {
    background: var(--apinox-list-hoverBackground);
  }
`;


interface LoopStepEditorProps {
  step: WorkflowStep;
  onUpdate: (step: WorkflowStep) => void;
}

export const LoopStepEditor: React.FC<LoopStepEditorProps> = ({
  step,
  onUpdate,
}) => {
  const [name, setName] = useState(step.name);
  const [loopType, setLoopType] = useState(step.loop?.type || "count");
  const [count, setCount] = useState(step.loop?.count || 1);
  const [listVariable, setListVariable] = useState(
    step.loop?.listVariable || "",
  );
  const [iteratorVariable, setIteratorVariable] = useState(
    step.loop?.iteratorVariable || "i",
  );
  const [maxIterations, setMaxIterations] = useState(
    step.loop?.maxIterations || 100,
  );
  const [selectedNestedStepIndex, setSelectedNestedStepIndex] = useState<
    number | null
  >(null);
  const [addStepDropdownOpen, setAddStepDropdownOpen] = useState(false);

  useEffect(() => {
    setName(step.name);
    setLoopType(step.loop?.type || "count");
    setCount(step.loop?.count || 1);
    setListVariable(step.loop?.listVariable || "");
    setIteratorVariable(step.loop?.iteratorVariable || "i");
    setMaxIterations(step.loop?.maxIterations || 100);
    setSelectedNestedStepIndex(null);
  }, [step]);

  const handleSave = () => {
    onUpdate({
      ...step,
      name,
      loop: {
        type: loopType as any,
        count: loopType === "count" ? count : undefined,
        listVariable: loopType === "list" ? listVariable : undefined,
        iteratorVariable,
        maxIterations,
      },
    });
  };

  const handleAddNestedStep = (type: WorkflowStep["type"]) => {
    const newStep: WorkflowStep = {
      id: uuidv4(),
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
      type,
      order: step.loopSteps?.length || 0,
      extractors: [],
    };

    if (type === "delay") {
      newStep.delayMs = 1000;
    } else if (type === "condition") {
      newStep.condition = {
        id: uuidv4(),
        expression: "",
        operator: "equals",
        expectedValue: "",
      };
    } else if (type === "loop") {
      newStep.loop = {
        type: "count",
        count: 1,
        maxIterations: 100,
        iteratorVariable: "i",
      };
      newStep.loopSteps = [];
    } else if (type === "script") {
      newStep.script = "// Your JavaScript code here\n";
    }

    onUpdate({
      ...step,
      loopSteps: [...(step.loopSteps || []), newStep],
    });

    setAddStepDropdownOpen(false);
    setSelectedNestedStepIndex(step.loopSteps?.length || 0); // Select the newly added step
  };

  const handleUpdateNestedStep = (updatedNestedStep: WorkflowStep) => {
    if (selectedNestedStepIndex === null) return;

    const updatedLoopSteps = [...(step.loopSteps || [])];
    updatedLoopSteps[selectedNestedStepIndex] = updatedNestedStep;

    onUpdate({
      ...step,
      loopSteps: updatedLoopSteps,
    });
  };

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case "delay":
        return <Clock size={14} />;
      case "condition":
        return <AlertCircle size={14} />;
      case "loop":
        return <Repeat size={14} />;
      case "script":
        return <Code size={14} />;
      default:
        return <GitBranch size={14} />;
    }
  };

  const renderNestedStepEditor = () => {
    if (selectedNestedStepIndex === null || !step.loopSteps) return null;

    const nestedStep = step.loopSteps[selectedNestedStepIndex];
    if (!nestedStep) return null;

    switch (nestedStep.type) {
      case "request":
        return (
          <RequestStepEditor
            step={nestedStep}
            onUpdate={handleUpdateNestedStep}
          />
        );
      case "delay":
        return (
          <DelayStepEditor
            step={nestedStep}
            onUpdate={handleUpdateNestedStep}
          />
        );
      case "condition":
        return (
          <ConditionStepEditor
            step={nestedStep}
            onUpdate={handleUpdateNestedStep}
          />
        );
      case "loop":
        return (
          <LoopStepEditor step={nestedStep} onUpdate={handleUpdateNestedStep} />
        );
      case "script":
        return (
          <ScriptStepEditor
            step={nestedStep}
            onUpdate={handleUpdateNestedStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Container>
      <LeftPanel>
        <StepHeader>
          <StepIcon $color="var(--apinox-charts-blue)">
            <Repeat size={20} />
          </StepIcon>
          <StepTitle>Loop Configuration</StepTitle>
        </StepHeader>

        <StepNameField value={name} onChange={setName} />

        <StepSection>
          <StepLabel>Loop Type</StepLabel>
          <CustomSelect
            value={loopType}
            onChange={(v) => setLoopType(v as any)}
            options={[
              { value: "count", label: "Fixed Count" },
              { value: "list", label: "Iterate List" },
              { value: "while", label: "While Condition" },
            ]}
          />
        </StepSection>

        {loopType === "count" && (
          <StepSection>
            <StepLabel>Number of Iterations</StepLabel>
            <StepInput
              type="number"
              min="1"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              placeholder="Number of times to loop"
            />
          </StepSection>
        )}

        {loopType === "list" && (
          <StepSection>
            <StepLabel>List Variable</StepLabel>
            <StepInput
              type="text"
              value={listVariable}
              onChange={(e) => setListVariable(e.target.value)}
              placeholder="e.g., {{items}} or {{users}}"
            />
            <StepInfoBox>
              Specify a workflow variable containing an array to iterate over
            </StepInfoBox>
          </StepSection>
        )}

        {loopType === "while" && (
          <StepInfoBox>
            While loops require condition configuration. This will be available
            in a future update.
          </StepInfoBox>
        )}

        <StepSection>
          <StepLabel>Iterator Variable Name</StepLabel>
          <StepInput
            type="text"
            value={iteratorVariable}
            onChange={(e) => setIteratorVariable(e.target.value)}
            placeholder="Variable name for current iteration"
          />
          <StepInfoBox>
            This variable will be available in subsequent steps:{" "}
            {`{{${iteratorVariable}}}`}
          </StepInfoBox>
        </StepSection>

        <StepSection>
          <StepLabel>Maximum Iterations (Safety Limit)</StepLabel>
          <StepInput
            type="number"
            min="1"
            max="10000"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 100)}
            placeholder="Maximum iterations allowed"
          />
          <StepInfoBox>
            Loop will stop after this many iterations to prevent infinite loops
          </StepInfoBox>
        </StepSection>

        <StepSection>
          <StepLabel>Steps in Loop ({(step.loopSteps || []).length})</StepLabel>
          <StepsList>
            {!step.loopSteps || step.loopSteps.length === 0 ? (
              <EmptySteps>
                No steps in loop yet.
                <br />
                Add steps in the workflow builder.
              </EmptySteps>
            ) : (
              step.loopSteps.map((nestedStep, index) => (
                <StepItem
                  key={nestedStep.id}
                  $isSelected={selectedNestedStepIndex === index}
                  onClick={() => setSelectedNestedStepIndex(index)}
                >
                  <StepIconWrapper>{getStepIcon(nestedStep.type)}</StepIconWrapper>
                  <StepDetails>
                    <StepName>{nestedStep.name}</StepName>
                    <StepType>{nestedStep.type}</StepType>
                  </StepDetails>
                </StepItem>
              ))
            )}
          </StepsList>
          <StepInfoBox>
            Click a step to view/edit it on the right. Add/remove steps in the
            workflow builder.
          </StepInfoBox>
        </StepSection>

        <StepActionRow>
          <PrimaryButton onClick={handleSave}>Save Loop Config</PrimaryButton>
        </StepActionRow>
      </LeftPanel>

      <RightPanel>
        {selectedNestedStepIndex !== null &&
        step.loopSteps &&
        step.loopSteps[selectedNestedStepIndex] ? (
          renderNestedStepEditor()
        ) : (
          <EmptyState title="Select a step from the list to view and edit it" description="or add a new step to the loop">
            <AddStepDropdown>
              <DropdownButton
                onClick={() => setAddStepDropdownOpen(!addStepDropdownOpen)}
              >
                <Plus size={14} />
                Add Step to Loop
              </DropdownButton>
              {addStepDropdownOpen && (
                <DropdownMenu>
                  <DropdownItem onClick={() => handleAddNestedStep("request")}>
                    <Plus size={12} />
                    Request
                  </DropdownItem>
                  <DropdownItem onClick={() => handleAddNestedStep("delay")}>
                    <Plus size={12} />
                    Delay
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => handleAddNestedStep("condition")}
                  >
                    <Plus size={12} />
                    Condition
                  </DropdownItem>
                  <DropdownItem onClick={() => handleAddNestedStep("loop")}>
                    <Plus size={12} />
                    Nested Loop
                  </DropdownItem>
                  <DropdownItem onClick={() => handleAddNestedStep("script")}>
                    <Plus size={12} />
                    Script
                  </DropdownItem>
                </DropdownMenu>
              )}
            </AddStepDropdown>
          </EmptyState>
        )}
      </RightPanel>
    </Container>
  );
};
