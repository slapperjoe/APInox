import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styled from "styled-components";
import {
  SPACING_LG,
  SPACING_MD,
  SPACING_SM,
  SPACING_XL,
  SPACING_XS,
  SPACING_2XL,
  SPACING_3XL,
} from "../styles/spacing";
import { DEBOUNCE_MS } from "../constants";

/**
 * Markdown content styling — same shape as `HelpModal.tsx`'s `ContentArea`
 * (spacing tokens + fixed px headings), so the app's two markdown surfaces match.
 * The em-based heading hierarchy this file used was dropped app-wide in favour of
 * fixed tokens (docs/FONT_SIZE_TOKENS.md).
 */
const PreviewContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: ${SPACING_2XL} ${SPACING_3XL};
  box-sizing: border-box;
  color: var(--apinox-foreground);
  background: var(--apinox-editor-background);
  font-family: var(--apinox-ui-font-family, var(--apinox-font-family));
  font-size: var(--apinox-fs-base);
  line-height: 1.7;

  h1 {
    font-size: 24px;
    border-bottom: 1px solid var(--apinox-panel-border);
    padding-bottom: ${SPACING_SM};
    margin-bottom: ${SPACING_LG};
  }
  h2 {
    font-size: 18px;
    color: var(--apinox-textLink-foreground);
    margin-top: ${SPACING_XL};
    margin-bottom: ${SPACING_MD};
  }
  h3 {
    font-size: 16px;
    font-weight: var(--fw-bold);
    margin-top: ${SPACING_LG};
    margin-bottom: ${SPACING_SM};
  }

  p { margin-bottom: ${SPACING_MD}; }
  a { color: var(--apinox-textLink-foreground); }

  code {
    font-family: var(--apinox-editor-font-family);
    background: var(--apinox-textCodeBlock-background);
    padding: ${SPACING_XS};
    border-radius: 4px;
  }
  pre {
    background: var(--apinox-textCodeBlock-background);
    padding: ${SPACING_MD};
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: ${SPACING_MD};
  }
  pre code { background: transparent; padding: 0; }

  /* --apinox-textBlockQuote-border is the blockquote token (all six themes);
     this used to borrow the activity-bar accent. */
  blockquote {
    border-left: 3px solid var(--apinox-textBlockQuote-border);
    margin: ${SPACING_MD} 0;
    padding: ${SPACING_XS} ${SPACING_LG};
    color: var(--apinox-descriptionForeground);
  }

  table { border-collapse: collapse; width: 100%; margin: ${SPACING_MD} 0; }
  th, td { border: 1px solid var(--apinox-panel-border); padding: ${SPACING_SM} ${SPACING_MD}; }
  th { background: var(--apinox-list-hoverBackground); }

  ul, ol { padding-left: ${SPACING_LG}; }
  li { margin-bottom: ${SPACING_XS}; }

  hr { border: none; border-top: 1px solid var(--apinox-panel-border); margin: ${SPACING_LG} 0; }
  img { max-width: 100%; border-radius: 4px; }
`;

export interface NotesPreviewProps {
  content: string;
}

// Memoised like the other editor surfaces — the debounced wrapper re-renders on
// every debounce tick, and an unmemoised preview re-parses the whole document.
export const NotesPreview = React.memo(({ content }: NotesPreviewProps) => {
  return (
    <PreviewContainer>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </PreviewContainer>
  );
});

// Debounced version to avoid re-rendering on every keystroke
export interface DebouncedNotesPreviewProps {
  content: string;
  debounceMs?: number;
}

export const DebouncedNotesPreview: React.FC<DebouncedNotesPreviewProps> = ({
  content,
  debounceMs = DEBOUNCE_MS,
}) => {
  const [displayed, setDisplayed] = useState(content);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDisplayed(next), debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    schedule(content);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [content, schedule]);

  return <NotesPreview content={displayed} />;
};
