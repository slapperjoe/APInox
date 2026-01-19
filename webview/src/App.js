import { jsx as _jsx } from "react/jsx-runtime";
// import React from 'react'; // React 17+ JSX transform doesn't need React in scope
import { ThemeProvider } from './contexts/ThemeContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider } from './contexts/UIContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TestRunnerProvider } from './contexts/TestRunnerContext';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { MockProxyProvider } from './contexts/MockProxyContext';
import MainContent from './components/MainContent';
export default function App() {
    return (_jsx(ThemeProvider, { children: _jsx(ProjectProvider, { children: _jsx(SelectionProvider, { children: _jsx(UIProvider, { children: _jsx(NavigationProvider, { children: _jsx(TestRunnerProvider, { children: _jsx(PerformanceProvider, { children: _jsx(MockProxyProvider, { children: _jsx(MainContent, {}) }) }) }) }) }) }) }) }));
}
