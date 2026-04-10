import React from "react";
import {
  Settings,
  HelpCircle,
  Compass,
  FolderOpen as FolderIcon,
  FlaskConical,
  Home,
  Clock,
  Workflow,
  Shuffle,
  Server,
  Eye,
  Activity,
} from "lucide-react";
import { SidebarView } from "@shared/models";
import { EnvironmentSelector } from "./EnvironmentSelector";

interface SidebarRailProps {
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  activeEnvironment?: string;
  environments?: Record<string, any>;
  onChangeEnvironment?: (env: string) => void;
  onMobileClose?: () => void;
}

const NavItem = ({ icon: Icon, active, onClick, title }: any) => (
  <div
    onClick={onClick}
    style={{
      padding: "10px 0",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      color: active
        ? "var(--apinox-activityBar-foreground)"
        : "var(--apinox-activityBar-inactiveForeground)",
      borderLeft: active
        ? "2px solid var(--apinox-activityBar-activeBorder)"
        : "2px solid transparent",
      backgroundColor: active
        ? "var(--apinox-list-activeSelectionBackground)"
        : "transparent",
    }}
    title={title}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
  </div>
);

const RailSeparator = () => (
  <div
    style={{
      margin: "6px 10px",
      borderTop: "1px solid currentColor",
      color: "var(--apinox-activityBar-foreground, #cccccc)",
      opacity: 0.25,
      flexShrink: 0,
    }}
  />
);

export const SidebarRail: React.FC<SidebarRailProps> = ({
  activeView,
  onChangeView,
  onOpenSettings,
  onOpenHelp,
  activeEnvironment,
  environments,
  onChangeEnvironment,
  onMobileClose,
}) => {
  return (
    <div
      style={{
        width: 50,
        backgroundColor: "var(--apinox-activityBar-background)",
        borderRight: "1px solid var(--apinox-activityBar-border)",
        display: "flex",
        flexDirection: "column",
        paddingTop: 10,
        flexShrink: 0,
      }}
    >
      <NavItem
        icon={Home}
        active={activeView === SidebarView.HOME}
        onClick={() => onChangeView(SidebarView.HOME)}
        title="Home"
      />
      <NavItem
        icon={FolderIcon}
        active={activeView === SidebarView.PROJECTS}
        onClick={() => onChangeView(SidebarView.PROJECTS)}
        title="Projects"
      />
      <NavItem
        icon={Compass}
        active={activeView === SidebarView.EXPLORER}
        onClick={() => onChangeView(SidebarView.EXPLORER)}
        title="WSDL Explorer"
      />
      <NavItem
        icon={FlaskConical}
        active={activeView === SidebarView.TESTS}
        onClick={() => onChangeView(SidebarView.TESTS)}
        title="Tests"
      />
      <NavItem
        icon={Workflow}
        active={activeView === SidebarView.WORKFLOWS}
        onClick={() => onChangeView(SidebarView.WORKFLOWS)}
        title="Workflows"
      />
      <NavItem
        icon={Activity}
        active={activeView === SidebarView.PERFORMANCE}
        onClick={() => onChangeView(SidebarView.PERFORMANCE)}
        title="Performance"
      />
      <NavItem
        icon={Clock}
        active={activeView === SidebarView.HISTORY}
        onClick={() => onChangeView(SidebarView.HISTORY)}
        title="History"
      />

      <RailSeparator />

      <NavItem
        icon={Shuffle}
        active={activeView === SidebarView.PROXY}
        onClick={() => onChangeView(SidebarView.PROXY)}
        title="Proxy &amp; Traffic"
      />
      <NavItem
        icon={Server}
        active={activeView === SidebarView.MOCK}
        onClick={() => onChangeView(SidebarView.MOCK)}
        title="Mock Server"
      />
      <NavItem
        icon={Eye}
        active={activeView === SidebarView.WATCHER}
        onClick={() => onChangeView(SidebarView.WATCHER)}
        title="File Watcher"
      />

      <div style={{ flex: 1 }}></div>

      <RailSeparator />

      <EnvironmentSelector
        activeEnvironment={activeEnvironment}
        environments={environments}
        onChangeEnvironment={onChangeEnvironment}
      />

      <div
        style={{
          paddingBottom: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <NavItem icon={Settings} onClick={onOpenSettings} title="Settings" />
        <NavItem icon={HelpCircle} onClick={onOpenHelp} title="Help" />
        {onMobileClose && (
          <div
            onClick={onMobileClose}
            className="touch-compact"
            style={{
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              justifyContent: "center",
              color: "var(--apinox-icon-foreground)",
            }}
            title="Close sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
