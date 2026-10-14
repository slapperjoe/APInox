import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorDetailBanner } from '../components/common/ErrorDetailBanner';

const REPORT = [
    'error sending request for url (https://acg-r02-bld-iis-app.myac.gov.au/BatchJobService.svc)',
    'caused by: client error (Connect)',
    'caused by: invalid peer certificate: UnknownIssuer',
    'kind: TLS — the TLS handshake was rejected — expired/self-signed certificate, a private or enterprise CA that is not in the trusted root store',
    'endpoint: https://acg-r02-bld-iis-app.myac.gov.au/BatchJobService.svc',
].join('\n');

describe('ErrorDetailBanner', () => {
    beforeEach(() => {
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    it('shows only the summary line until the detail is expanded', () => {
        render(<ErrorDetailBanner message={REPORT} />);

        expect(screen.getByTestId('error-detail-banner')).toHaveTextContent(
            'error sending request for url (https://acg-r02-bld-iis-app.myac.gov.au/BatchJobService.svc)',
        );
        // Cause chain stays hidden until asked for.
        expect(screen.queryByTestId('error-detail-banner-detail')).not.toBeInTheDocument();
        expect(screen.queryByText(/client error \(Connect\)/)).not.toBeInTheDocument();
    });

    it('reveals the full cause chain on Details, and hides it again', () => {
        render(<ErrorDetailBanner message={REPORT} />);

        fireEvent.click(screen.getByTestId('error-detail-banner-toggle'));
        const detail = screen.getByTestId('error-detail-banner-detail');
        expect(detail).toHaveTextContent('caused by: invalid peer certificate: UnknownIssuer');
        expect(detail).toHaveTextContent('kind: TLS');
        expect(detail).not.toHaveTextContent('error sending request for url'); // summary not duplicated

        fireEvent.click(screen.getByTestId('error-detail-banner-toggle'));
        expect(screen.queryByTestId('error-detail-banner-detail')).not.toBeInTheDocument();
    });

    it('copies the whole report (summary + chain), not just the summary', async () => {
        render(<ErrorDetailBanner message={REPORT} />);

        fireEvent.click(screen.getByTestId('error-detail-banner-copy'));

        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(REPORT),
        );
        expect(await screen.findByText('Copied')).toBeInTheDocument();
    });

    it('hides the Details toggle when the report has no cause lines', () => {
        render(<ErrorDetailBanner message="Request body is empty." />);

        expect(screen.queryByTestId('error-detail-banner-toggle')).not.toBeInTheDocument();
        expect(screen.getByTestId('error-detail-banner')).toHaveTextContent('Request body is empty.');
    });

    it('dismisses via the callback when provided', () => {
        const onDismiss = vi.fn();
        render(<ErrorDetailBanner message={REPORT} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByLabelText('Dismiss error'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
