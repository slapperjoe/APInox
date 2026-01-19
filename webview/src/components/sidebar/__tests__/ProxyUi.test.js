import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProxyUi } from '../ProxyUi';
// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Play: () => _jsx("span", { "data-testid": "icon-play" }),
    Square: () => _jsx("span", { "data-testid": "icon-square" }),
    Shield: () => _jsx("span", { "data-testid": "icon-shield" }),
    Trash2: () => _jsx("span", { "data-testid": "icon-trash" }),
    FolderOpen: () => _jsx("span", { "data-testid": "icon-folder" }),
    Network: () => _jsx("span", { "data-testid": "icon-network" }),
    FileCode: () => _jsx("span", { "data-testid": "icon-file-code" }),
    FileDown: () => _jsx("span", { "data-testid": "icon-file-down" }),
    Bug: () => _jsx("span", { "data-testid": "icon-bug" }),
    Plus: () => _jsx("span", { "data-testid": "icon-plus" }),
    Edit2: () => _jsx("span", { "data-testid": "icon-edit" }),
    ToggleLeft: () => _jsx("span", { "data-testid": "icon-toggle-left" }),
    ToggleRight: () => _jsx("span", { "data-testid": "icon-toggle-right" }),
    X: () => _jsx("span", { "data-testid": "icon-x" })
}));
// Mock child modals
vi.mock('../../modals/BreakpointModal', () => ({
    BreakpointModal: ({ open, onClose, onSave }) => open ? (_jsxs("div", { "data-testid": "breakpoint-modal", children: [_jsx("button", { onClick: onClose, children: "Close" }), _jsx("button", { onClick: () => onSave({ id: 'new-bp', name: 'New BP' }), children: "Save" })] })) : null
}));
describe('ProxyUi', () => {
    const defaultProps = {
        isRunning: false,
        config: { port: 9000, target: 'http://example.com' },
        history: [],
        onStart: vi.fn(),
        onStop: vi.fn(),
        onUpdateConfig: vi.fn(),
        onClear: vi.fn(),
        onSelectEvent: vi.fn(),
        onSaveHistory: vi.fn(),
        configPath: null,
        onSelectConfigFile: vi.fn(),
        onInjectProxy: vi.fn(),
        onRestoreProxy: vi.fn(),
        breakpoints: [],
        onUpdateBreakpoints: vi.fn(),
    };
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should render basic proxy controls', () => {
        render(_jsx(ProxyUi, { ...defaultProps }));
        expect(screen.getByText('Local Port')).toBeInTheDocument();
        expect(screen.getByDisplayValue('9000')).toBeInTheDocument();
        expect(screen.getByText('Target URL')).toBeInTheDocument();
        expect(screen.getByDisplayValue('http://example.com')).toBeInTheDocument();
        expect(screen.getByTitle('Start Proxy')).toBeInTheDocument();
    });
    it('should call onUpdateConfig when inputs change', () => {
        render(_jsx(ProxyUi, { ...defaultProps }));
        // Change Port
        fireEvent.change(screen.getByDisplayValue('9000'), { target: { value: '9001' } });
        expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith({ ...defaultProps.config, port: 9001 });
        // Change Target
        fireEvent.change(screen.getByDisplayValue('http://example.com'), { target: { value: 'http://test.com' } });
        expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith({ ...defaultProps.config, target: 'http://test.com' });
    });
    it('should call onStart/onStop handlers', () => {
        const { rerender } = render(_jsx(ProxyUi, { ...defaultProps }));
        fireEvent.click(screen.getByTitle('Start Proxy'));
        expect(defaultProps.onStart).toHaveBeenCalled();
        // Rerender as running
        rerender(_jsx(ProxyUi, { ...defaultProps, isRunning: true }));
        const stopBtn = screen.getByTitle('Stop Proxy');
        expect(stopBtn).toBeInTheDocument();
        fireEvent.click(stopBtn);
        expect(defaultProps.onStop).toHaveBeenCalled();
    });
    it('should render Config Switcher controls when configPath is set', () => {
        render(_jsx(ProxyUi, { ...defaultProps, configPath: "/path/to/web.config" }));
        expect(screen.getByText('Config Switcher')).toBeInTheDocument();
        expect(screen.getByText('web.config')).toBeInTheDocument();
        expect(screen.getByTitle('Inject Proxy Address')).toBeInTheDocument();
        expect(screen.getByTitle('Restore Original Config')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Inject Proxy Address'));
        expect(defaultProps.onInjectProxy).toHaveBeenCalled();
        fireEvent.click(screen.getByTitle('Restore Original Config'));
        expect(defaultProps.onRestoreProxy).toHaveBeenCalled();
    });
    it('should render traffic history and handle selection', () => {
        const event = { id: '1', method: 'GET', url: '/api', status: 200, timestamp: 123, timestampLabel: '10:00' };
        render(_jsx(ProxyUi, { ...defaultProps, history: [event] }));
        expect(screen.getByText('Traffic (1)')).toBeInTheDocument();
        expect(screen.getByText('GET')).toBeInTheDocument();
        expect(screen.getByText('/api')).toBeInTheDocument();
        fireEvent.click(screen.getByText('/api'));
        expect(defaultProps.onSelectEvent).toHaveBeenCalledWith(event);
        // Save report button
        fireEvent.click(screen.getByTitle('Save Request Log'));
        expect(defaultProps.onSaveHistory).toHaveBeenCalled();
    });
});
