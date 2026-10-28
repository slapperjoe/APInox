/**
 * Hex grid keyboard access.
 *
 * The grid is virtualised and was mouse-only: 32 clickable cells per row with no
 * role, no tabindex and no key handling, so a keyboard user could not reach the
 * cursor at all. It is now a single tab stop with arrow-key navigation, and the
 * active byte is announced through `aria-activedescendant`.
 *
 * The tests guard the two things that are easy to break again:
 *   - the grid stays one tab stop (making every cell focusable would put half a
 *     million tab stops on a 10 MiB note), and
 *   - the active cell is always rendered, because `aria-activedescendant` can only
 *     reference an id that exists in the DOM.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesHexEditor } from '../NotesHexEditor';

const COLS = 16;

function bytes(length: number): Uint8Array {
  const b = new Uint8Array(length);
  for (let i = 0; i < length; i++) b[i] = 0x41 + (i % 26);
  return b;
}

function press(key: string) {
  fireEvent.keyDown(screen.getByRole('grid'), { key });
}

describe('the hex grid is keyboard reachable', () => {
  it('the grid itself is the single tab stop, not the cells', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('tabindex')).toBe('0');

    // Cells carry no tabindex: a large note would otherwise be hundreds of
    // thousands of tab stops.
    const focusableCells = document.querySelectorAll('[role="gridcell"][tabindex]');
    expect(focusableCells).toHaveLength(0);
  });

  it('cells have accessible names that include the offset and the value', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    const cell = screen.getByRole('gridcell', { name: 'Byte 0: 0x41' });
    expect(cell).toBeTruthy();
  });

  it('the active byte is announced through aria-activedescendant', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-activedescendant')).toBe('byte-0');
    expect(document.getElementById('byte-0')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('arrow keys move the cursor', () => {
  it('left/right move one byte, up/down move one row', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    press('ArrowRight');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-1');

    press('ArrowDown');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe(
      `byte-${1 + COLS}`
    );

    press('ArrowLeft');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe(
      `byte-${COLS}`
    );

    press('ArrowUp');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-0');
  });

  it('Home and End jump to the ends of the buffer', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    press('End');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-63');

    press('Home');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-0');
  });

  it('the cursor clamps at both ends instead of wrapping or leaving the buffer', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    press('ArrowLeft');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-0');

    press('End');
    press('ArrowRight');
    press('ArrowDown');
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-63');
  });

  it('the status bar reflects the cursor', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    press('ArrowDown');
    expect(screen.getByText('Offset: 0x0010 (16)')).toBeTruthy();
  });

  it('clicking a cell still moves the cursor', () => {
    render(<NotesHexEditor data={bytes(64)} />);

    fireEvent.click(screen.getByRole('gridcell', { name: 'Byte 5: 0x46' }));
    expect(screen.getByRole('grid').getAttribute('aria-activedescendant')).toBe('byte-5');
  });
});

describe('the active cell is always rendered', () => {
  /**
   * Regression guard for the virtualised window: `aria-activedescendant` is only
   * meaningful if the element it references exists. Moving the cursor far from the
   * viewport must pull the window with it.
   */
  it('the referenced id exists after the cursor moves outside the initial window', () => {
    render(<NotesHexEditor data={bytes(4000)} />);

    press('End');
    const grid = screen.getByRole('grid');
    const id = grid.getAttribute('aria-activedescendant');
    expect(id).toBe('byte-3999');
    expect(document.getElementById(id ?? '')).toBeTruthy();
  });

  it('an empty buffer references nothing rather than a cell that does not exist', () => {
    render(<NotesHexEditor data={new Uint8Array(0)} />);

    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-activedescendant')).toBeNull();

    // Keys must not move the cursor into a negative offset on an empty buffer.
    press('ArrowRight');
    press('End');
    expect(grid.getAttribute('aria-activedescendant')).toBeNull();
  });
});
