// ============================================================================
// WS-SECURITY TYPES
// ============================================================================
export var WSSecurityType;
(function (WSSecurityType) {
    WSSecurityType["None"] = "none";
    WSSecurityType["UsernameToken"] = "usernameToken";
    WSSecurityType["Certificate"] = "certificate";
})(WSSecurityType || (WSSecurityType = {}));
export var PasswordType;
(function (PasswordType) {
    PasswordType["PasswordText"] = "PasswordText";
    PasswordType["PasswordDigest"] = "PasswordDigest";
})(PasswordType || (PasswordType = {}));
export var SidebarView;
(function (SidebarView) {
    SidebarView["HOME"] = "home";
    SidebarView["PROJECTS"] = "projects";
    SidebarView["COLLECTIONS"] = "collections";
    SidebarView["EXPLORER"] = "explorer";
    SidebarView["TESTS"] = "tests";
    SidebarView["WATCHER"] = "watcher";
    SidebarView["SERVER"] = "server";
    SidebarView["PERFORMANCE"] = "performance";
    SidebarView["HISTORY"] = "history";
})(SidebarView || (SidebarView = {}));
