import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, ChevronDown, ChevronRight, Copy } from 'lucide-react';

import { SPACING_SM, SPACING_XS } from '../../styles/spacing';

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Banner = styled.div<{ $expanded?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING_XS};
  padding: ${SPACING_SM} ${SPACING_SM};
  background: var(--apinox-error-background, rgba(244, 135, 113, 0.12));
  color: var(--apinox-errorForeground, #f48771);
  border-bottom: 1px solid var(--apinox-error-border, rgba(244, 135, 113, 0.4));
  font-size: var(--apinox-fs-md, 12px);
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING_SM};
`;

const SummaryText = styled.span<{ $wrap?: boolean }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  ${props => (props.$wrap ? 'white-space: pre-wrap; word-break: break-word;' : 'white-space: nowrap;')}
`;

const IconWrapper = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
`;

const Button = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 3px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.92em;
  line-height: 1;
  padding: 3px 6px;
  opacity: 0.85;

  &:hover {
    opacity: 1;
  }
`;

const DetailBlock = styled.pre`
  margin: 0;
  padding: ${SPACING_SM};
  max-height: 220px;
  overflow: auto;
  background: var(--apinox-editor-background, rgba(0, 0, 0, 0.25));
  border: 1px solid var(--apinox-error-border, rgba(244, 135, 113, 0.35));
  border-radius: 3px;
  color: var(--apinox-errorForeground, #f48771);
  font-family: var(--apinox-editor-font-family, monospace);
  font-size: 0.95em;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ErrorDetailBannerProps {
  /**
   * Failure report. The FIRST line is shown as the summary; every further line
   * (the `caused by:` chain and the classification the backend appends) is the
   * detail behind the toggle.
   */
  message: string;
  /** Called when the user dismisses the banner. Omit to hide the dismiss button. */
  onDismiss?: () => void;
  /** `data-testid` for the banner root (default `error-detail-banner`). */
  testId?: string;
  /** Rendered before the summary (defaults to a warning triangle). */
  icon?: React.ReactNode;
  /** Label for the "show detail" button (default `Details`). */
  detailsLabel?: string;
}

/**
 * Shows a request failure with its underlying cause on demand.
 *
 * A transport failure arrives as a multi-line report — the summary
 * (`error sending request for url (...)`) plus the flattened cause chain and
 * the classified kind. The summary stays a single line so the banner never
 * grows; the full report is one click away and copyable.
 */
export const ErrorDetailBanner: React.FC<ErrorDetailBannerProps> = ({
  message,
  onDismiss,
  testId = 'error-detail-banner',
  icon,
  detailsLabel = 'Details',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => message.split('\n'), [message]);
  const summary = lines[0] ?? '';
  const detail = useMemo(() => lines.slice(1).join('\n').trim(), [lines]);
  const hasDetail = detail.length > 0;

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        // Fallback for environments without the async clipboard API.
        const textarea = document.createElement('textarea');
        textarea.value = message;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Copying is a convenience — never let it break the banner.
      setCopied(false);
    }
  }, [message]);

  return (
    <Banner role="alert" data-testid={testId} $expanded={expanded}>
      <SummaryRow>
        <IconWrapper>{icon ?? <AlertTriangle size={14} />}</IconWrapper>
        <SummaryText title={hasDetail ? undefined : message}>{summary}</SummaryText>
        {hasDetail && (
          <Button
            type="button"
            data-testid={`${testId}-toggle`}
            aria-expanded={expanded}
            onClick={() => setExpanded(prev => !prev)}
            title={expanded ? 'Hide details' : 'Show full error chain'}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {detailsLabel}
          </Button>
        )}
        <Button
          type="button"
          data-testid={`${testId}-copy`}
          onClick={handleCopy}
          title="Copy the full error"
        >
          <Copy size={12} />
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onDismiss && (
          <Button type="button" onClick={onDismiss} aria-label="Dismiss error" title="Dismiss">
            ×
          </Button>
        )}
      </SummaryRow>
      {expanded && hasDetail && (
        <DetailBlock data-testid={`${testId}-detail`}>{detail}</DetailBlock>
      )}
    </Banner>
  );
};

export default ErrorDetailBanner;
