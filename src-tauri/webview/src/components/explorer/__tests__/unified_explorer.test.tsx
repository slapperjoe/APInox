import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';

describe('UnifiedExplorerSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar without crashing', () => {
    render(<UnifiedExplorerSidebar projects={[]} />);
    expect(screen.getByText('No projects yet')).toBeTruthy();
  });
});
