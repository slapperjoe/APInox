import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Settings, HelpCircle, Eye, Compass, FolderOpen as FolderIcon, FlaskConical, Network, Activity, Home, Clock } from 'lucide-react';
import { SidebarView } from '@shared/models';
import { EnvironmentSelector } from './EnvironmentSelector';
const NavItem = ({ icon: Icon, active, onClick, title }) => (_jsx("div", { onClick: onClick, style: {
        padding: '10px 0',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        color: active ? 'var(--vscode-activityBar-foreground)' : 'var(--vscode-activityBar-inactiveForeground)',
        borderLeft: active ? '2px solid var(--vscode-activityBar-activeBorder)' : '2px solid transparent',
        backgroundColor: active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'
    }, title: title, children: _jsx(Icon, { size: 24, strokeWidth: active ? 2.5 : 2 }) }));
export const SidebarRail = ({ activeView, onChangeView, onOpenSettings, onOpenHelp, activeEnvironment, environments, onChangeEnvironment }) => {
    return (_jsxs("div", { style: {
            width: 50,
            backgroundColor: 'var(--vscode-activityBar-background)',
            borderRight: '1px solid var(--vscode-activityBar-border)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 10,
            flexShrink: 0
        }, children: [_jsx(NavItem, { icon: Home, active: activeView === SidebarView.HOME, onClick: () => onChangeView(SidebarView.HOME), title: "Home" }), _jsx(NavItem, { icon: FolderIcon, active: activeView === SidebarView.PROJECTS, onClick: () => onChangeView(SidebarView.PROJECTS), title: "Projects" }), _jsx(NavItem, { icon: Compass, active: activeView === SidebarView.EXPLORER, onClick: () => onChangeView(SidebarView.EXPLORER), title: "WSDL Explorer" }), _jsx(NavItem, { icon: Eye, active: activeView === SidebarView.WATCHER, onClick: () => onChangeView(SidebarView.WATCHER), title: "File Watcher" }), _jsx(NavItem, { icon: Network, active: activeView === SidebarView.SERVER, onClick: () => onChangeView(SidebarView.SERVER), title: "Server" }), _jsx(NavItem, { icon: FlaskConical, active: activeView === SidebarView.TESTS, onClick: () => onChangeView(SidebarView.TESTS), title: "Tests" }), _jsx(NavItem, { icon: Activity, active: activeView === SidebarView.PERFORMANCE, onClick: () => onChangeView(SidebarView.PERFORMANCE), title: "Performance" }), _jsx(NavItem, { icon: Clock, active: activeView === SidebarView.HISTORY, onClick: () => onChangeView(SidebarView.HISTORY), title: "History" }), _jsx("div", { style: { flex: 1 } }), _jsx(EnvironmentSelector, { activeEnvironment: activeEnvironment, environments: environments, onChangeEnvironment: onChangeEnvironment }), _jsxs("div", { style: { paddingBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }, children: [_jsx(NavItem, { icon: Settings, onClick: onOpenSettings, title: "Settings" }), _jsx(NavItem, { icon: HelpCircle, onClick: onOpenHelp, title: "Help" })] })] }));
};
