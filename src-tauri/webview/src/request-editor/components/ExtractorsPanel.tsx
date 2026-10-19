import React, { useMemo, memo } from "react";
import styled from "styled-components";
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton } from './common/PanelShell';
import { Trash2, Pencil, Variable, Plus } from "lucide-react";
import { CustomXPathEvaluator } from "../utils/xpathEvaluator";
import { RequestExtractor } from "../types";
import { debugLog, debugError } from "../utils/logger";
import { SPACING_XS, SPACING_SM, SPACING_LG } from "../styles/spacing";
const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${SPACING_SM};
  margin-bottom: ${SPACING_XS};
`;

const ExtractorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING_SM};
`;

const ExtractorItem = styled.div`
  display: flex;
  padding: ${SPACING_SM};
  border: 1px solid var(--apinox-panel-border);
  background-color: var(--apinox-list-hoverBackground);
  margin-bottom: ${SPACING_SM};
  border-radius: ${SPACING_XS};
  align-items: flex-start;
  gap: ${SPACING_LG};
`;

const ExtractorInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${SPACING_XS};
`;

const InfoRow = styled.div`
  display: flex;
  gap: ${SPACING_SM};
  align-items: baseline;
`;

const Label = styled.span`
  font-weight: bold;
  color: var(--apinox-textLink-foreground);
  min-width: 80px;
  font-size: 0.9em;
`;

const Value = styled.code`
  background: var(--apinox-textCodeBlock-background);
  padding: 2px ${SPACING_XS};
  border-radius: 3px;
  font-family: monospace;
  word-break: break-all;
  font-size: 0.9em;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING_XS};
`;

const ToolbarTitle = styled.div`
  font-weight: 600;
  font-size: 0.95em;
  display: flex;
  align-items: center;
  gap: ${SPACING_SM};
  color: var(--apinox-foreground);
`;


const VariableValue = styled(Value)`
  color: var(--apinox-debugTokenExpression-name);
`;

const DefaultLabel = styled(Label)`
  color: var(--apinox-editorInfo-foreground);
`;

const DefaultValue = styled(Value)`
  color: var(--apinox-editorInfo-foreground);
`;

const PreviewLabel = styled(Label)`
  color: var(--apinox-testing-iconPassed);
`;

const PreviewValue = styled(Value)`
  border-color: var(--apinox-testing-iconPassed);
  border: 1px solid transparent;
  background-color: var(--apinox-editor-inactiveSelectionBackground);
`;

const DeleteButton = styled(PanelIconButton)`
  color: var(--apinox-errorForeground);
`;

interface ExtractorsPanelProps {
  extractors: RequestExtractor[];
  onChange: (extractors: RequestExtractor[]) => void;
  onEdit?: (extractor: RequestExtractor, index: number) => void;
  rawResponse?: string;
}

const ExtractorsPanelBase: React.FC<ExtractorsPanelProps> = ({
  extractors,
  onChange,
  onEdit,
  rawResponse,
}) => {
  const handleDelete = (index: number) => {
    const newExtractors = [...extractors];
    newExtractors.splice(index, 1);
    onChange(newExtractors);
  };

  const handleAdd = () => {
    const newExtractor: RequestExtractor = {
      id: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: "XPath",
      variable: "",
      source: "body",
      path: "",
    };
    onChange([...extractors, newExtractor]);
  };

  debugLog("[ExtractorsPanel] Rendering. Extractors:", extractors.length);

  // Perf (review item 4): evaluate each extractor once per (extractors,
  // rawResponse) change instead of on every render. Previously CustomXPathEvaluator
  // ran over the whole response for every extractor on every parent re-render
  // (O(extractors x response) per keystroke elsewhere). The memoized previews
  // recompute only when the extractors or the response actually change.
  const previews = useMemo(() => {
    return extractors.map((ex) => {
      if (rawResponse && ex.source === "body") {
        try {
          if (ex.type === "Regex") {
            // Regex extraction is handled by the backend; show the pattern note.
            return "(Regex extraction - run step to see result)";
          }
          const pathValue = ex.path;
          if (pathValue) {
            return CustomXPathEvaluator.evaluate(rawResponse, pathValue);
          }
        } catch (e) {
          debugError("[ExtractorsPanel] Evaluation Error", e);
          return "Error evaluating expression";
        }
      }
      return null;
    });
  }, [extractors, rawResponse]);

  return (
    <PanelContainer>
      <Toolbar>
        <ToolbarTitle>
          <Variable size={16} />
          Context Variables extracted from this Step
        </ToolbarTitle>
        <PanelIconButton onClick={handleAdd} title="Add Extractor">
          <Plus size={16} />
        </PanelIconButton>
      </Toolbar>
      <ExtractorList>
        {extractors.length === 0 ? (
          <EmptyState title="No extractors defined" description="Click + to add one, or select text in the Response panel." />
        ) : (
          extractors.map((ex, index) => {
            const currentValue = previews[index];

            return (
              <ExtractorItem key={ex.id || index}>
                <ExtractorInfo>
                  <InfoRow>
                    <Label>Variable:</Label>
                    <VariableValue>{ex.variable}</VariableValue>
                  </InfoRow>
                  <InfoRow>
                    <Label>Source:</Label>
                    <span>{ex.source}</span>
                  </InfoRow>
                  {ex.type && (
                    <InfoRow>
                      <Label>Type:</Label>
                      <span>{ex.type}</span>
                    </InfoRow>
                  )}
                  <InfoRow>
                    <Label>{ex.type === "Regex" ? "Pattern:" : "Path:"}</Label>
                    <Value>{ex.path}</Value>
                  </InfoRow>
                  {ex.defaultValue && (
                    <InfoRow>
                      <DefaultLabel>Default:</DefaultLabel>
                      <DefaultValue>{ex.defaultValue}</DefaultValue>
                    </InfoRow>
                  )}
                  {currentValue !== null && (
                    <InfoRow>
                      <PreviewLabel>Preview:</PreviewLabel>
                      <PreviewValue>
                        {currentValue || "(No Match)"}
                      </PreviewValue>
                    </InfoRow>
                  )}
                </ExtractorInfo>
                <ButtonGroup>
                  {onEdit && (
                    <PanelIconButton
                      onClick={() => onEdit(ex, index)}
                      title="Edit Extractor"
                    >
                      <Pencil size={16} />
                    </PanelIconButton>
                  )}
                  <DeleteButton
                    onClick={() => handleDelete(index)}
                    title="Delete Extractor"
                  >
                    <Trash2 size={16} />
                  </DeleteButton>
                </ButtonGroup>
              </ExtractorItem>
            );
          })
        )}
      </ExtractorList>
    </PanelContainer>
  );
};

// Perf (review item 3/4): memoize the panel so parent re-renders that do not
// change its props skip the subtree (and the memoized previews above).
export const ExtractorsPanel = memo(ExtractorsPanelBase);
