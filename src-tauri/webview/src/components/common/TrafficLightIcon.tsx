import React from "react";

/**
 * TrafficLight icon — lucide-style (24x24, stroke=currentColor, round caps).
 *
 * lucide-react@0.263.1 (pinned) ships no traffic-light glyph, so this
 * hand-drawn variant follows the lucide icon conventions: 2px stroke,
 * rounded linecap/linejoin, 24x24 grid. Used by the sidebar rail for the
 * Proxy & Traffic view.
 */
export const TrafficLightIcon: React.FC<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}> = ({ size = 24, strokeWidth = 2, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="6" y="2" width="12" height="20" rx="6" />
    <circle cx="12" cy="7" r="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="17" r="2.5" />
  </svg>
);
