import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { pickAttachment } from '../utils/attachmentPicker';

describe('pickAttachment', () => {
    beforeEach(() => {
        (invoke as any).mockReset();
        (open as any).mockReset();
    });

    it('returns null when the dialog is cancelled', async () => {
        (open as any).mockResolvedValue(null);
        expect(await pickAttachment(0)).toBeNull();
        expect(invoke).not.toHaveBeenCalled();
    });

    it('stores the path and metadata, not the bytes', async () => {
        (open as any).mockResolvedValue('/tmp/doc.pdf');
        (invoke as any).mockResolvedValue({ name: 'doc.pdf', contentType: 'application/pdf', size: 1234 });

        const att = await pickAttachment(1);

        expect(att?.fsPath).toBe('/tmp/doc.pdf');
        expect(att?.size).toBe(1234);
        expect(att?.content).toBe('');
        // Content-IDs are sequential against what is already attached.
        expect(att?.contentId).toBe('part2');
        expect(invoke).toHaveBeenCalledWith('read_attachment_file', { path: '/tmp/doc.pdf' });
    });
});
