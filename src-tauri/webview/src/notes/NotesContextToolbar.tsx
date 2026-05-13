import React from "react";
import styled from "styled-components";
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
  padding: 8px 0;
  border-right: 1px solid var(--apinox-panel-border, rgba(128, 128, 128, 0.2));
  background: var(--apinox-sideBar-background, #1e1e1e);
  gap: 4px;
  overflow-y: auto;
`;

const SectionLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--apinox-descriptionForeground, rgba(204,204,204,0.5));
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  margin: 6px 0;
  user-select: none;
`;

const IconBtn = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--apinox-foreground, #ccc);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--apinox-list-hoverBackground, rgba(255,255,255,0.08));
    color: var(--apinox-foreground, #fff);
  }

  &:hover > span {
    opacity: 1;
  }
`;

const Tooltip = styled.span`
  position: absolute;
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
  padding: 3px 8px;
  background: var(--apinox-tooltip-background, #333);
  color: var(--apinox-tooltip-foreground, #fff);
  font-size: 11px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  z-index: 100;
  transition: opacity 0.1s;
`;

interface ContextToolbarProps {
  context: string;
  onAction: (action: string) => void;
}

const ICON_SIZE = 16;

export const NotesContextToolbar: React.FC<ContextToolbarProps> = ({
  context,
  onAction,
}) => {
  const type = context || "Paragraph";

  let title = "Text";
  let items: { icon: React.ReactNode; label: string; action: string }[] = [];

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
      { icon: <ImageIcon size={ICON_SIZE} />, label: "Image", action: "insert-image" },
    ];
  }

  return (
    <Toolbar>
      <SectionLabel>{title}</SectionLabel>
      {items.map((item) => (
        <IconBtn key={item.label} onClick={() => onAction(item.action)} title={item.label}>
          {item.icon}
          <Tooltip>{item.label}</Tooltip>
        </IconBtn>
      ))}
    </Toolbar>
  );
};
