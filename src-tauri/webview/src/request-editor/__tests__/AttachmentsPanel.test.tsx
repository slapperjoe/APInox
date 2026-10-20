import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttachmentsPanel } from '../components/AttachmentsPanel';

vi.mock('../utils/attachmentPicker', () => ({ pickAttachment: vi.fn() }));

import { pickAttachment } from '../utils/attachmentPicker';

describe('AttachmentsPanel', () => {
    beforeEach(() => {
        (pickAttachment as any).mockReset();
    });

    it('shows the picked file with its real size', async () => {
        (pickAttachment as any).mockResolvedValue({
            id: 'a1',
            name: 'doc.pdf',
            contentType: 'application/pdf',
            type: 'SwA',
            enabled: true,
            content: '',
            contentId: 'part1',
            fsPath: '/tmp/doc.pdf',
            size: 1234,
        });

        const onChange = vi.fn();
        render(<AttachmentsPanel attachments={[]} onChange={onChange} />);
        fireEvent.click(screen.getByText('Add File'));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const added = onChange.mock.calls[0][0][0];
        expect(added.name).toBe('doc.pdf');
        expect(added.size).toBe(1234);
        expect(added.fsPath).toBe('/tmp/doc.pdf');
    });

    it('does not write when the picker is cancelled', async () => {
        (pickAttachment as any).mockResolvedValue(null);

        const onChange = vi.fn();
        render(<AttachmentsPanel attachments={[]} onChange={onChange} />);
        fireEvent.click(screen.getByText('Add File'));

        await new Promise((r) => setTimeout(r, 0));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('numbers the Content-ID against what is already attached', async () => {
        (pickAttachment as any).mockResolvedValue(null);

        render(
            <AttachmentsPanel
              attachments={[{
                id: 'a1',
                name: 'one.txt',
                contentType: 'text/plain',
                type: 'SwA',
                enabled: true,
                content: '',
                contentId: 'part1',
                fsPath: '/tmp/one.txt',
                size: 1,
              }]}
              onChange={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByText('Add File'));

        await new Promise((r) => setTimeout(r, 0));
        expect(pickAttachment).toHaveBeenCalledWith(1);
    });
});
