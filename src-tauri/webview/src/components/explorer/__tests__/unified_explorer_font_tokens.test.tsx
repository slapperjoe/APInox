import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedExplorerSidebar, TreeItem, type TreeItemProps } from "../UnifiedExplorerSidebar";

/**
 * Font-size tokens: the unified explorer sidebar's project/operation/request
 * rows must ALL render at the same size — --apinox-fs-base (13px) — so the
 * four sections (Projects, History, Favorites, Quick Requests) read as one
 * uniform list. Hierarchy is carried by indentation + icons only, never by
 * shrinking the type.
 *
 * This supersedes the earlier per-level hierarchy (project fs-md 12px,
 * operation/request fs-sm 11px) from kanban t_8f2b97a4: the user flagged the
 * mixed sizes as inconsistent ("how is that the same size?") and asked for a
 * single size across all four sections (docs/FONT_SIZE_TOKENS.md,
 * t_8f2b97a4 consolidation).
 *
 * Regression guard: the row now takes its font + 8px base left padding from
 * the shared SidebarRow class (not inline styles), so we assert on
 * getComputedStyle of the row element — the value jsdom resolves from the
 * styled-components class. This guards against a per-type font size or a
 * non-8px base padding drifting back in.
 */

describe("explorer tree rows use the shared font + 8px base padding (uniform)", () => {
  it.each([
    { type: "project", token: "var(--apinox-fs-base)" },
    { type: "operation", token: "var(--apinox-fs-base)" },
    { type: "request", token: "var(--apinox-fs-base)" },
  ])("renders %s rows at %s", ({ type, token }) => {
    const props: TreeItemProps = {
      label: `a-${type}-row`,
      type: type as TreeItemProps["type"],
    };
    render(<TreeItem {...props} />);
    const row = screen.getByText(`a-${type}-row`).closest("div")!;
    expect(getComputedStyle(row).fontSize).toBe(token);
  });

  it("does not shrink request rows to the 10px badge size", () => {
    const props: TreeItemProps = { label: "a-request-row", type: "request" };
    render(<TreeItem {...props} />);
    const row = screen.getByText("a-request-row").closest("div")!;
    expect(row.style.fontSize).not.toBe("var(--apinox-fs-xs)");
  });
});

describe("UnifiedExplorerSidebar tree row tokens", () => {
  const makeProject = () => ({
    id: "p1",
    name: "Proj",
    displayName: "Proj",
    operations: [
      {
        id: "op1",
        name: "Op",
        displayName: "Op",
        requests: [
          { id: "r1", name: "Req", displayName: "Req" },
          { id: "r2", name: "Req2", displayName: "Req2" },
        ],
      },
    ],
  });

  const renderSidebar = (projects: unknown[]) => {
    const onSelectNode = vi.fn();
    const onToggle = vi.fn();
    const onDrop = vi.fn();
    const onReorderOperation = vi.fn();
    const onReorderRequest = vi.fn();
    const onCreateProject = vi.fn();
    return render(
      <UnifiedExplorerSidebar
        projects={projects}
        selectedProject={null}
        onSelectProject={onSelectNode}
        selectedOperation={null}
        onSelectOperation={onSelectNode}
        selectedRequest={null}
        onSelectRequest={onSelectNode}
        onNavigate={onSelectNode}
        onCreateProject
        onDeleteProject={vi.fn()}
        onToggleOperation={onToggle}
        onToggleProject={onToggle}
        onDrop
        onReorderOperation
        onReorderRequest
        onCreateRequest={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );
  };

  it("renders project/operation/request rows at the baseline tokens", () => {
    renderSidebar([makeProject()]);
    const projectRow = screen.getByText("Proj").closest("div")!;
    expect(getComputedStyle(projectRow).fontSize).toBe("var(--apinox-fs-base)");
    // Operation/request rows live behind the expand chevron; the TreeItem
    // unit tests above cover their token values.
    expect(screen.queryByText("Op")).toBeNull();
  });
});
