/**
 * CertificateManager guards.
 *
 * The panel said "trusted in OS store" while the Debug view reported the certificate in the
 * user store only — both were true, but the panel did not say *which* store, and the two are
 * not interchangeable: CryptoAPI validates a WCF app running as a service or an IIS app pool
 * against `LocalMachine\Root` only. The panel now names the store and calls out the gap.
 *
 * The second guard is that the panel offers the fix itself. It used to tell the user to click
 * "Fix Certificate Location", which lives in the Debug view — reachable only by double-clicking
 * the title-bar logo, so a user reading the Options panel has no way to get there.
 *
 * The third is the button pairing: `btnStyle` hard-coded `white`, which measured 2.31-3.21:1
 * against `--apinox-accent-purple` in five of the six themes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { themes } from '@shared/styles/themes';
import { AA_NORMAL, contrastRatio } from '../../../utils/contrast';

const userStoreOnly = {
  exists: true,
  certPath: '/cfg/ca.cer',
  keyPath: '/cfg/ca.key',
  isTrusted: true,
  thumbprint: 'AABBCCDDEEFF',
  inCurrentUser: true,
  inLocalMachine: false,
};

const afterMove = { ...userStoreOnly, inCurrentUser: false, inLocalMachine: true };

let infoCalls = 0;

const commands: Record<string, any> = {
  // The shape the Rust command returns: `success`, `details`, `manualSteps`.
  moveCertificateToLocalMachine: {
    success: true,
    details: 'Certificate moved to LocalMachine\\Root (via the elevation prompt).',
    manualSteps: [],
  },
};

vi.mock('../../../utils/bridge', () => ({
  bridge: {
    sendMessageAsync: vi.fn(async (message: any) => {
      if (commands[message.command]) return commands[message.command];
      infoCalls += 1;
      return infoCalls === 1 ? userStoreOnly : afterMove;
    }),
  },
  commandErrorText: (e: any) => String(e),
  isTauri: () => false,
}));

import { CertificateManager } from '../CertificateManager';

describe('CertificateManager', () => {
  // The mock returns the pre-move state on the first read and the post-move state after, so the
  // counter has to start clean for each case.
  beforeEach(() => {
    infoCalls = 0;
  });

  it('names the store the CA is in and flags the one a service cannot see', async () => {
    render(<CertificateManager />);

    await screen.findByText(/Certificate is valid and trusted — CurrentUser\\Root/);
    expect(screen.getByText(/Trusted in OS store — CurrentUser\\Root/)).toBeInTheDocument();
    expect(
      screen.getByText(/IIS app pool validates against LocalMachine/),
    ).toBeInTheDocument();
  });

  it('offers the move itself, because a user reading this panel cannot reach the Debug view', async () => {
    render(<CertificateManager />);

    await screen.findByText(/Trusted in OS store — CurrentUser\\Root/);
    expect(screen.queryByText(/Fix Certificate Location/)).not.toBeInTheDocument();

    const button = screen.getByText('Move to machine store');
    fireEvent.click(button);

    // The result is what the machine store confirmed, not what the script's exit code said, and
    // the stores are re-read so the panel cannot still show the pre-move state.
    await screen.findByText(/moved to LocalMachine\\Root \(via the elevation prompt\)/);
    expect(screen.getByText(/Trusted in OS store — LocalMachine\\Root/)).toBeInTheDocument();
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
