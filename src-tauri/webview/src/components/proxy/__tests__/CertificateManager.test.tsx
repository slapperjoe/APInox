/**
 * CertificateManager store guard.
 *
 * The panel said "trusted in OS store" while the Debug view reported the certificate in the
 * user store only — both were true, but the panel did not say *which* store, and the two are
 * not interchangeable: CryptoAPI validates a WCF app running as a service or an IIS app pool
 * against `LocalMachine\Root` only. The panel now names the store and calls out the gap. It also pins the button pairing: `btnStyle` hard-coded `white`, which
 * measured 2.31-3.21:1 against `--apinox-accent-purple` in five of the six themes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { themes } from '@shared/styles/themes';
import { AA_NORMAL, contrastRatio } from '../../../utils/contrast';

vi.mock('../../../utils/bridge', () => ({
  invokeTauriCommand: vi.fn(async () => ({
    exists: true,
    certPath: '/cfg/ca.cer',
    keyPath: '/cfg/ca.key',
    isTrusted: true,
    inCurrentUser: true,
    inLocalMachine: false,
  })),
  bridge: { sendMessageAsync: vi.fn() },
  commandErrorText: (e: any) => String(e),
  isTauri: () => false,
}));

import { CertificateManager } from '../CertificateManager';

describe('CertificateManager', () => {
  it('names the store the CA is in and flags the one a service cannot see', async () => {
    render(<CertificateManager />);

    await screen.findByText(/Certificate is valid and trusted — CurrentUser\\Root/);
    expect(screen.getByText(/Trusted in OS store — CurrentUser\\Root/)).toBeInTheDocument();
    expect(
      screen.getByText(/IIS app pool validates against LocalMachine/),
    ).toBeInTheDocument();
  });

  for (const [themeName, theme] of Object.entries(themes)) {
    it(`the accent-purple button stays legible in ${themeName}`, async () => {
      for (const [name, value] of Object.entries(theme.variables)) {
        document.documentElement.style.setProperty(name, value);
      }

      render(<CertificateManager />);
      const button = await screen.findByText('Show Certificate Path');
      const background = theme.variables['--apinox-accent-purple'];

      const ratio = contrastRatio(background, button.style.color);
      expect(ratio).not.toBeNull();
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);

      for (const name of Object.keys(theme.variables)) {
        document.documentElement.style.removeProperty(name);
      }
    });
  }
});
