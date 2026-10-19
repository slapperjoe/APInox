import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MonacoSingleLineInput } from '../components/MonacoSingleLineInput';

describe('MonacoSingleLineInput inline decorations', () => {
    it('renders as a single-line contenteditable (no Monaco instance per row)', () => {
        render(<MonacoSingleLineInput value="hello" onChange={() => {}} />);
        const editable = document.querySelector('[contenteditable="true"]');
        expect(editable).not.toBeNull();
        expect(editable?.textContent).toBe('hello');
    });

    it('wraps {{...}} function tokens in the wildcard decoration type', () => {
        render(<MonacoSingleLineInput value="a{{uuid}}b" onChange={() => {}} />);
        const token = document.querySelector('.wildcard-tag-text');
        expect(token).not.toBeNull();
        expect(token?.textContent).toBe('{{uuid}}');
    });

    it('renders {{env}} as the environment decoration type', () => {
        render(<MonacoSingleLineInput value="{{env}}" onChange={() => {}} />);
        const token = document.querySelector('.environment-tag-text');
        expect(token?.textContent).toBe('{{env}}');
    });

    it('flags an unknown {{...}} variable with the undefined-warning underline', () => {
        render(<MonacoSingleLineInput value="{{notdefined}}" onChange={() => {}} />);
        const token = document.querySelector('.wildcard-tag-text.undefined-variable-warning');
        expect(token?.textContent).toBe('{{notdefined}}');
    });

    it('wraps ${...} chain variables in the chain decoration type', () => {
        render(<MonacoSingleLineInput value="${sessionId}" onChange={() => {}} />);
        const token = document.querySelector('.chain-variable-text');
        expect(token?.textContent).toBe('${sessionId}');
    });

    it('adds a plain-text hover tooltip to each decorated token', () => {
        render(<MonacoSingleLineInput value="{{uuid}} ${sessionId}" onChange={() => {}} />);
        const fn = document.querySelector('.wildcard-tag-text');
        expect(fn?.getAttribute('title')).toMatch(/Dynamic function/);
        const chain = document.querySelector('.chain-variable-text');
        expect(chain?.getAttribute('title')).toMatch(/Workflow variable/);
    });

    it('tooltips an unknown {{...}} variable as undefined', () => {
        render(<MonacoSingleLineInput value="{{notdefined}}" onChange={() => {}} />);
        const token = document.querySelector('.wildcard-tag-text.undefined-variable-warning');
        expect(token?.getAttribute('title')).toMatch(/Unknown variable/);
    });

    it('shows source and value for a defined chain variable when a variable list is provided', () => {
        render(
            <MonacoSingleLineInput
                value="${sessionId}"
                onChange={() => {}}
                availableVariables={[{ name: 'sessionId', value: 'abc', source: 'extracted' }]}
            />
        );
        const chain = document.querySelector('.chain-variable-text');
        expect(chain?.getAttribute('title')).toMatch(/Source: extracted/);
        expect(chain?.getAttribute('title')).toMatch(/Value: abc/);
        expect(chain?.className).not.toContain('undefined-variable-warning');
    });

    it('underlines an undefined chain variable when a variable list is provided', () => {
        render(
            <MonacoSingleLineInput
                value="${missing}"
                onChange={() => {}}
                availableVariables={[{ name: 'other', value: null, source: 'extracted' }]}
            />
        );
        const chain = document.querySelector('.chain-variable-text.undefined-variable-warning');
        expect(chain?.getAttribute('title')).toMatch(/Undefined workflow variable/);
    });

    it('shows the value for a defined env variable when an env list is provided', () => {
        render(
            <MonacoSingleLineInput
                value="{{apiKey}}"
                onChange={() => {}}
                availableEnvVariables={[{ name: 'apiKey', value: 'k1', source: 'environment' }]}
            />
        );
        const token = document.querySelector('.wildcard-tag-text');
        expect(token?.getAttribute('title')).toMatch(/Value: k1/);
        expect(token?.className).not.toContain('undefined-variable-warning');
    });

    it('shows the placeholder when the value is empty', () => {
        render(<MonacoSingleLineInput value="" placeholder="Header Name" onChange={() => {}} />);
        const editable = document.querySelector('[contenteditable="true"]');
        expect(editable?.getAttribute('data-placeholder')).toBe('Header Name');
    });
});
