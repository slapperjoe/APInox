import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { RequestAttachment } from "../types";

interface AttachmentInfo {
  name: string;
  contentType: string;
  size: number;
}

function newId(existingCount: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${existingCount}`;
}

/**
 * Pick a file and read its metadata.
 *
 * The attachment stores the PATH, not the bytes: the file is read again at send
 * time (src-tauri/src/soap/attachments.rs), so a large file never enters the
 * persisted project blob and a file edited after attaching is not stale. The
 * command returns metadata only for the same reason.
 */
export async function pickAttachment(existingCount: number): Promise<RequestAttachment | null> {
  const selected = await open({ multiple: false, directory: false });
  if (!selected || typeof selected !== "string") return null;

  const info = (await invoke("read_attachment_file", { path: selected })) as AttachmentInfo;

  return {
    id: newId(existingCount),
    name: info.name,
    contentType: info.contentType,
    type: "SwA",
    enabled: true,
    content: "",
    contentId: `part${existingCount + 1}`,
    fsPath: selected,
    size: info.size,
  };
}
