/**
 * ConditionRowEditor.tsx
 * Shared "match condition" row + immutable array helpers, used by
 * MockRulesPage and BreakpointsPage.
 */
import React from "react";
import { tokens } from "./tokens";

export interface ConditionRowValue {
  type: string;
  pattern: string;
  isRegex?: boolean;
  headerName?: string;
}

// ── Immutable array helpers ────────────────────────────────────────────────

export function addCondition<T extends ConditionRowValue>(conditions: T[]): T[] {
  return [...conditions, { type: "url", pattern: "", isRegex: false } as T];
}

export function removeCondition<T extends ConditionRowValue>(
  conditions: T[],
  index: number,
): T[] {
  return conditions.filter((_, i) => i !== index);
}

export function updateCondition<T extends ConditionRowValue>(
  conditions: T[],
  index: number,
  updates: Partial<T>,
): T[] {
  const next = [...conditions];
  next[index] = { ...next[index], ...updates };
  return next;
}

// ── Shared row chrome ──────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: "6px",
  background: tokens.surface.input,
  border: `1px solid ${tokens.border.subtle}`,
  borderRadius: tokens.radius.md,
  color: tokens.text.secondary,
  fontSize: tokens.fontSize.sm,
};

const fieldStyle: React.CSSProperties = {
  padding: `6px ${tokens.space["2"]}`,
  background: tokens.surface.input,
  border: `1px solid ${tokens.border.subtle}`,
  borderRadius: tokens.radius.md,
  color: tokens.text.secondary,
  fontSize: tokens.fontSize.sm,
};

const removeBtnStyle: React.CSSProperties = {
  padding: "6px",
  background: tokens.surface.danger,
  border: "none",
  borderRadius: tokens.radius.md,
  color: tokens.text.danger,
  fontSize: tokens.fontSize.sm,
  cursor: "pointer",
};

interface ConditionRowProps {
  condition: ConditionRowValue;
  typeOptions: { value: string; label: string }[];
  /** Width of the type select column. */
  typeColWidth?: string;
  /** Types that render the extra header/param-name input. */
  nameTypes?: string[];
  namePlaceholder?: (type: string) => string;
  patternPlaceholder?: (type: string) => string;
  onTypeChange: (type: string) => void;
  onFieldChange: (updates: Partial<ConditionRowValue>) => void;
  onRemove: () => void;
}

export const ConditionRow: React.FC<ConditionRowProps> = ({
  condition,
  typeOptions,
  typeColWidth = "130px",
  nameTypes,
  namePlaceholder,
  patternPlaceholder,
  onTypeChange,
  onFieldChange,
  onRemove,
}) => {
  const showName = nameTypes?.includes(condition.type) ?? false;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: showName
          ? `${typeColWidth} 140px 1fr 80px 40px`
          : `${typeColWidth} 1fr 80px 40px`,
        gap: "8px",
        alignItems: "center",
      }}
    >
      <select
        value={condition.type}
        onChange={(e) => onTypeChange(e.target.value)}
        style={selectStyle}
      >
        {typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {showName && (
        <input
          type="text"
          value={condition.headerName || ""}
          onChange={(e) => onFieldChange({ headerName: e.target.value })}
          placeholder={namePlaceholder ? namePlaceholder(condition.type) : ""}
          style={fieldStyle}
        />
      )}

      <input
        type="text"
        value={condition.pattern}
        onChange={(e) => onFieldChange({ pattern: e.target.value })}
        placeholder={
          patternPlaceholder
            ? patternPlaceholder(condition.type)
            : condition.type === "url"
              ? "/api/*"
              : "pattern"
        }
        style={fieldStyle}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={condition.isRegex || false}
          onChange={(e) => onFieldChange({ isRegex: e.target.checked })}
          style={{ width: "14px", height: "14px" }}
        />
        Regex
      </label>

      <button onClick={onRemove} style={removeBtnStyle}>
        ✕
      </button>
    </div>
  );
};
