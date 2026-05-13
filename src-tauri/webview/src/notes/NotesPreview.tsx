import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styled from "styled-components";

const PreviewContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 24px 32px;
  box-sizing: border-box;
  color: var(--apinox-foreground, #ccc);
  background: var(--apinox-editor-background, #1e1e1e);
  font-family: var(--apinox-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 14px;
  line-height: 1.7;

  h1, h2, h3, h4, h5, h6 {
    color: var(--apinox-foreground, #fff);
    margin-top: 1.4em;
    margin-bottom: 0.4em;
  }
  h1 { font-size: 1.8em; border-bottom: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3)); padding-bottom: 0.2em; }
  h2 { font-size: 1.4em; }
  h3 { font-size: 1.15em; }

  p { margin: 0.6em 0; }

  a { color: var(--apinox-textLink-foreground, #4ec9b0); }

  code {
    font-family: var(--apinox-editor-font-family, "JetBrains Mono", monospace);
    font-size: 0.88em;
    background: var(--apinox-textCodeBlock-background, rgba(128,128,128,0.15));
    padding: 1px 5px;
    border-radius: 3px;
  }

  pre {
    background: var(--apinox-textCodeBlock-background, rgba(0,0,0,0.3));
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
  }

  pre code {
    background: transparent;
    padding: 0;
  }

  blockquote {
    border-left: 3px solid var(--apinox-activityBar-activeBorder, #007acc);
    margin: 0.8em 0;
    padding: 0.2em 1em;
    color: var(--apinox-descriptionForeground, rgba(204,204,204,0.7));
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
  }
  th, td {
    border: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3));
    padding: 6px 12px;
  }
  th { background: var(--apinox-list-hoverBackground, rgba(128,128,128,0.1)); }

  ul, ol { padding-left: 1.6em; }
  li { margin: 0.2em 0; }

  hr { border: none; border-top: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3)); margin: 1.4em 0; }

  img { max-width: 100%; border-radius: 4px; }
`;

interface NotesPreviewProps {
  content: string;
}

export const NotesPreview: React.FC<NotesPreviewProps> = ({ content }) => {
  return (
    <PreviewContainer>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </PreviewContainer>
  );
};

// Debounced version to avoid re-rendering on every keystroke
interface DebouncedNotesPreviewProps {
  content: string;
  debounceMs?: number;
}

export const DebouncedNotesPreview: React.FC<DebouncedNotesPreviewProps> = ({
  content,
  debounceMs = 400,
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
