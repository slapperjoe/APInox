import { describe, it, expect } from 'vitest';
import { completionRangeAndText } from '../utils/templateCompletion';

// Fake model: columns are 1-based like Monaco; getValueInRange slices the line.
const model = (line: string) => ({
    getValueInRange: (r: any) => line.slice(r.startColumn - 1, r.endColumn - 1),
});

describe('completionRangeAndText', () => {
    it('spans the typed partial from just after the opening braces', () => {
        // caret after `{{ses` → column 6
        const { range, insertText } = completionRangeAndText(model('{{ses'), { lineNumber: 1, column: 6 }, 3, 'sessionId', '}}');
        expect(range.startColumn).toBe(3);
        expect(range.endColumn).toBe(6);
        expect(insertText).toBe('sessionId}}');
    });

    it('does not double-close when the caret is inside an already-closed template', () => {
        const { insertText } = completionRangeAndText(model('{{ses}}'), { lineNumber: 1, column: 6 }, 3, 'ses', '}}');
        expect(insertText).toBe('ses');
    });

    it('handles hyphenated names where word boundaries would break', () => {
        const { range, insertText } = completionRangeAndText(model('{{my-var'), { lineNumber: 1, column: 9 }, 6, 'my-var', '}}');
        expect(range.startColumn).toBe(3);
        expect(insertText).toBe('my-var}}');
    });

    it('closes ${...} with a single brace', () => {
        const { insertText } = completionRangeAndText(model('${tok'), { lineNumber: 1, column: 6 }, 3, 'token', '}');
        expect(insertText).toBe('token}');
    });
});
