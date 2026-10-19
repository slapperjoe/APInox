import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

describe('MonacoSingleLineInput autocomplete popup', () => {
    const editable = () => document.querySelector('[contenteditable="true"]') as HTMLElement;

    // Put text in the contenteditable with the caret at `caretOffset`, then
    // fire the input event the component's detection runs on.
    function typeAtCaret(el: HTMLElement, text: string, caretOffset: number) {
        el.textContent = text;
        const sel = window.getSelection();
        const node = el.firstChild;
        if (!sel || !node) return;
        const range = document.createRange();
        range.setStart(node, caretOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        fireEvent.input(el);
    }

    it('opens when typing {{ with env variables and functions', () => {
        render(
            <MonacoSingleLineInput
                value=""
                onChange={() => {}}
                availableEnvVariables={[{ name: 'apiKey', value: 'k1', source: 'environment' }]}
            />
        );
        typeAtCaret(editable(), '{{', 2);
        const popup = document.querySelector('[data-testid="single-line-autocomplete"]');
        expect(popup).not.toBeNull();
        expect(popup?.textContent).toContain('apiKey');
        expect(popup?.textContent).toContain('uuid');
    });

    it('Enter accepts the active suggestion and closes the template', () => {
        const onChange = vi.fn();
        render(<MonacoSingleLineInput value="" onChange={onChange} />);
        const el = editable();
        typeAtCaret(el, '{{uu', 4);
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onChange).toHaveBeenLastCalledWith('{{uuid}}');
    });

    it('arrow keys move the active row before Enter', () => {
        const onChange = vi.fn();
        render(
            <MonacoSingleLineInput
                value=""
                onChange={onChange}
                availableEnvVariables={[{ name: 'apiKey', value: 'k1', source: 'environment' }]}
            />
        );
        const el = editable();
        typeAtCaret(el, '{{', 2);
        fireEvent.keyDown(el, { key: 'ArrowDown' });
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onChange).toHaveBeenLastCalledWith('{{uuid}}');
    });

    it('mouse click inserts the word AND the closing braces', () => {
        const onChange = vi.fn();
        render(<MonacoSingleLineInput value="" onChange={onChange} />);
        const el = editable();
        typeAtCaret(el, '{{uu', 4);
        const row = document.querySelector('[data-testid="autocomplete-item-uuid"]');
        expect(row).not.toBeNull();
        fireEvent.mouseDown(row!);
        expect(onChange).toHaveBeenLastCalledWith('{{uuid}}');
    });

    it('does not double-close an already-closed template', () => {
        const onChange = vi.fn();
        render(<MonacoSingleLineInput value="" onChange={onChange} />);
        const el = editable();
        typeAtCaret(el, '{{uu}}', 4); // caret between the partial and the existing `}}`
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onChange).toHaveBeenLastCalledWith('{{uuid}}');
    });

    it('${...} popup lists chain variables and closes with one brace', () => {
        const onChange = vi.fn();
        render(
            <MonacoSingleLineInput
                value=""
                onChange={onChange}
                availableVariables={[{ name: 'sessionId', value: 'abc', source: 'extracted' }]}
            />
        );
        const el = editable();
        typeAtCaret(el, '${', 2);
        const popup = document.querySelector('[data-testid="single-line-autocomplete"]');
        expect(popup).not.toBeNull();
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onChange).toHaveBeenLastCalledWith('${sessionId}');
    });

    it('Escape closes the popup; Enter then falls through to onEnter', () => {
        const onChange = vi.fn();
        const onEnter = vi.fn();
        render(<MonacoSingleLineInput value="" onChange={onChange} onEnter={onEnter} />);
        const el = editable();
        typeAtCaret(el, '{{', 2);
        expect(document.querySelector('[data-testid="single-line-autocomplete"]')).not.toBeNull();
        fireEvent.keyDown(el, { key: 'Escape' });
        expect(document.querySelector('[data-testid="single-line-autocomplete"]')).toBeNull();
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onEnter).toHaveBeenCalled();
    });

    it('no popup when the caret is not inside an open template', () => {
        render(<MonacoSingleLineInput value="" onChange={() => {}} />);
        typeAtCaret(editable(), 'hello', 5);
        expect(document.querySelector('[data-testid="single-line-autocomplete"]')).toBeNull();
    });
});
