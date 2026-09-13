/**
 * trafficStyles.ts
 * Shared badge styling for proxy traffic views (TrafficViewer / TrafficDetails).
 */
import { tokens } from './tokens';

export function methodBg(method: string): { bg: string; fg: string } {
  switch (method.toUpperCase()) {
    case 'GET':    return { bg: 'rgba(58,110,58,0.2)',   fg: 'var(--apinox-testing-iconPassed, #89d185)' };
    case 'POST':   return { bg: 'rgba(14,99,156,0.2)',   fg: 'var(--apinox-focusBorder, #6db3e8)' };
    case 'PUT':    return { bg: 'rgba(122,90,30,0.2)',   fg: 'var(--apinox-testing-iconQueued, #ddb165)' };
    case 'PATCH':  return { bg: 'rgba(120,80,200,0.18)', fg: '#b89ee8' };
    case 'DELETE': return { bg: 'rgba(156,14,14,0.2)',   fg: 'var(--apinox-testing-iconFailed, #f28b82)' };
    default:       return { bg: 'rgba(60,60,60,0.15)',   fg: 'var(--apinox-descriptionForeground, #858585)' };
  }
}

export function statusStyle(status?: number) {
  if (!status) return { bg: 'rgba(60,60,60,0.2)', fg: tokens.text.muted, border: 'rgba(100,100,100,0.4)' };
  if (status < 300) return { bg: 'rgba(58,110,58,0.25)',  fg: 'var(--apinox-testing-iconPassed, #89d185)',  border: 'rgba(58,110,58,0.5)' };
  if (status < 400) return { bg: 'rgba(14,99,156,0.25)',  fg: 'var(--apinox-focusBorder, #6db3e8)',         border: 'rgba(14,99,156,0.5)' };
  if (status < 500) return { bg: 'rgba(122,90,30,0.25)',  fg: 'var(--apinox-testing-iconQueued, #ddb165)',  border: 'rgba(122,90,30,0.5)' };
  return                     { bg: 'rgba(156,14,14,0.25)', fg: 'var(--apinox-testing-iconFailed, #f28b82)', border: 'rgba(156,14,14,0.5)' };
}

/** Map a Content-Type (raw value or header record) to a Monaco language id. */
export function languageFromContentType(
  headersOrCt: Record<string, string> | string | null | undefined,
): string {
  const ct =
    typeof headersOrCt === "string"
      ? headersOrCt
      : (headersOrCt?.["content-type"] ?? headersOrCt?.["Content-Type"] ?? "");
  const lower = ct.toLowerCase();
  if (lower.includes("xml") || lower.includes("soap")) return "xml";
  if (lower.includes("json")) return "json";
  if (lower.includes("html")) return "html";
  return "plaintext";
}
