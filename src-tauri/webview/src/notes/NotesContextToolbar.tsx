import React from "react";
import { IconButton } from "../components/common/Button";
import { SectionLabel } from "../components/common/SectionLabel";
import { Tooltip } from "../components/common/Tooltip";
import styled from "styled-components";
import { SPACING_BASE, SPACING_MD, SPACING_SM } from "../styles/spacing";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Plus,
  List,
  Indent,
  Outdent,
  CheckSquare,
  Quote,
  Image as ImageIcon,
} from "lucide-react";

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
  min-width: 44px;
  height: 100%;
  padding: ${SPACING_SM} 0;
  border-right: 1px solid var(--apinox-panel-border);
  background: var(--apinox-sideBar-background);
  gap: ${SPACING_BASE}px;
  overflow-y: auto;
`;

/** Vertical rail label. The orientation is layout for this narrow toolbar, not a
 *  styling fork — it wraps the shared `SectionLabel` so the tokens stay single
 *  source (item 8 allows `as="h3"` / `as="div"` only). */
const VerticalLabel = styled(SectionLabel)`
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  margin: ${SPACING_MD} 0;
  user-select: none;
`;

interface NotesContextToolbarProps {
  context: string;
  onAction: (action: string) => void;
}

const ICON_SIZE = 16;

export const NotesContextToolbar = React.memo(({
  context,
  onAction,
}: NotesContextToolbarProps) => {
  const type = context || "Paragraph";

  let title = "Text";
  // Every branch below assigns, so the empty initialiser was dead.
  let items: { icon: React.ReactNode; label: string; action: string }[];

  if (type.includes("Header") || type.includes("ATXHeading")) {
    title = "Header";
    items = [
      { icon: <Heading1 size={ICON_SIZE} />, label: "H1", action: "H1" },
      { icon: <Heading2 size={ICON_SIZE} />, label: "H2", action: "H2" },
      { icon: <Heading3 size={ICON_SIZE} />, label: "H3", action: "H3" },
    ];
  } else if (type.includes("Table")) {
    title = "Table";
    items = [
      { icon: <Plus size={ICON_SIZE} />, label: "Add Row", action: "Add Row" },
    ];
  } else if (type.includes("List")) {
    title = "List";
    items = [
      { icon: <Indent size={ICON_SIZE} />, label: "Indent", action: "Indent" },
      { icon: <Outdent size={ICON_SIZE} />, label: "Outdent", action: "Unindent" },
      { icon: <CheckSquare size={ICON_SIZE} />, label: "Task", action: "Task Checkbox" },
    ];
  } else if (type.includes("Quote")) {
    title = "Quote";
    items = [
      { icon: <Quote size={ICON_SIZE} />, label: "Quote", action: "Quote" },
    ];
  } else {
    items = [
      { icon: <Bold size={ICON_SIZE} />, label: "Bold", action: "Bold" },
      { icon: <Italic size={ICON_SIZE} />, label: "Italic", action: "Italic" },
      { icon: <List size={ICON_SIZE} />, label: "List", action: "Make List" },
      { icon: <Heading1 size={ICON_SIZE} />, label: "Header", action: "H1" },
      { icon: <Table size={ICON_SIZE} />, label: "Table", action: "Add Row" },
      { icon: <ImageIcon size={ICON_SIZE} />, label: "Image", action: "Image" },
    ];
  }

  return (
    <Toolbar>
      <VerticalLabel>{title}</VerticalLabel>
      {items.map((item) => (
        <Tooltip key={item.label} content={item.label} side="right">
          <IconButton onClick={() => onAction(item.action)}>
            {item.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Toolbar>
  );
});
