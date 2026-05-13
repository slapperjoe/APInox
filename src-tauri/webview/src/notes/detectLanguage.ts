import { NoteLanguage } from "@shared/models";

export interface DetectedLanguage {
  language: NoteLanguage;
  isMarkdown: boolean;
  isBinary: boolean;
}

const EXT_MAP: Record<string, NoteLanguage> = {
  md: "markdown",
  markdown: "markdown",
  xml: "xml",
  wsdl: "xml",
  xsd: "xml",
  xslt: "xml",
  svg: "xml",
  html: "html",
  htm: "html",
  json: "json",
  jsonc: "json",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cs: "csharp",
  py: "python",
  css: "css",
  scss: "css",
  less: "css",
  rs: "rust",
  txt: "plaintext",
  log: "plaintext",
  csv: "plaintext",
};

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff",
  "pdf", "zip", "gz", "tar", "7z", "rar",
  "exe", "dll", "so", "dylib",
  "p12", "pfx", "der", "cert", "cer",
  "bin", "dat", "db", "sqlite",
  "mp3", "mp4", "wav", "ogg",
  "woff", "woff2", "ttf", "otf",
]);

/** Detect language from file extension. Returns null if extension unknown. */
function detectByExtension(filePath: string): DetectedLanguage | null {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const ext = filePath.slice(dotIndex + 1).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    return { language: "binary", isMarkdown: false, isBinary: true };
  }

  const lang = EXT_MAP[ext];
  if (!lang) return null;

  return { language: lang, isMarkdown: lang === "markdown", isBinary: false };
}

/** Sniff the first few lines of text content to guess language. */
function detectByContent(content: string): DetectedLanguage {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 12);

  let markdownScore = 0;
  let codeScore = 0;

  for (const line of lines) {
    // Markdown signals
    if (/^#{1,6}\s/.test(line)) markdownScore += 3;
    else if (/^\*\*|^__/.test(line)) markdownScore += 2;
    else if (/^[-*+]\s/.test(line)) markdownScore += 2;
    else if (/^>\s/.test(line)) markdownScore += 2;
    else if (/^!\[/.test(line)) markdownScore += 2;
    else if (/^\[.*\]\(/.test(line)) markdownScore += 1;
    else if (/^```/.test(line)) markdownScore += 1;

    // Code signals
    else if (/^<[a-zA-Z?!]/.test(line)) codeScore += 3;  // XML/HTML
    else if (/^\{/.test(line)) codeScore += 2;            // JSON/JS
    else if (/^using\s|^namespace\s/.test(line)) codeScore += 3;  // C#
    else if (/^import\s|^from\s/.test(line)) codeScore += 2;      // TS/JS/Python
    else if (/^\/\/|^\/\*|^#!/.test(line)) codeScore += 2;        // Comments
    else if (/^fn\s|^pub\s|^use\s/.test(line)) codeScore += 2;    // Rust
    else if (/^def\s|^class\s|^import\s/.test(line)) codeScore += 2; // Python
  }

  if (markdownScore === 0 && codeScore === 0) {
    return { language: "plaintext", isMarkdown: false, isBinary: false };
  }

  if (markdownScore >= codeScore) {
    return { language: "markdown", isMarkdown: true, isBinary: false };
  }

  return { language: "plaintext", isMarkdown: false, isBinary: false };
}

/**
 * Determine editor language from file path and optional content.
 * Priority: binary extension → known extension → content sniff → markdown default.
 */
export function detectLanguage(
  filePath: string | null,
  content?: string,
  isBinaryFromServer?: boolean
): DetectedLanguage {
  // Server-side binary flag takes highest priority
  if (isBinaryFromServer) {
    return { language: "binary", isMarkdown: false, isBinary: true };
  }

  if (filePath) {
    const byExt = detectByExtension(filePath);
    if (byExt) return byExt;
  }

  if (content !== undefined && content.length > 0) {
    return detectByContent(content);
  }

  // Default: new unnamed buffer → plain text
  return { language: "plaintext", isMarkdown: false, isBinary: false };
}
