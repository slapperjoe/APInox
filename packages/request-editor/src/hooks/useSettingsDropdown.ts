/**
 * useSettingsDropdown.ts
 * Shared behaviour for the editor-settings dropdown: tracks open state,
 * computes the popup position from the anchor button's rect, and closes
 * on outside mousedown.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface SettingsMenuPosition {
  top: number;
  right: number;
  /** Max height derived from the space below the anchor button. */
  maxHeight?: number;
}

interface UseSettingsDropdownOptions {
  /** Include a maxHeight derived from available space below the button. */
  includeMaxHeight?: boolean;
  /** Minimum menu height when including maxHeight. */
  minHeight?: number;
  /** Pixels reserved below the button (gap + chrome) for the maxHeight calc. */
  reserveBottom?: number;
}

export function useSettingsDropdown(
  menuRef: RefObject<HTMLDivElement | null>,
  options: UseSettingsDropdownOptions = {},
) {
  const { includeMaxHeight = true, minHeight = 200, reserveBottom = 20 } = options;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<SettingsMenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, menuRef]);

  const toggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const next: SettingsMenuPosition = {
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      };
      if (includeMaxHeight) {
        const spaceBelow = window.innerHeight - rect.bottom - 4 - reserveBottom;
        next.maxHeight = Math.max(minHeight, spaceBelow);
      }
      setPosition(next);
    }
    setOpen((prev) => !prev);
  }, [open, includeMaxHeight, minHeight, reserveBottom]);

  return { open, setOpen, position, toggle, buttonRef };
}
