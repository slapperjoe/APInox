import type { FC } from "react";
import { EmptyState as PackageEmptyState } from "../../request-editor/core";
import type { EmptyStateProps } from "../../request-editor/core";

/**
 * Webview EmptyState — re-export of the request-editor package component.
 * `fill` is pinned so the webview keeps its full-height layout; consumers
 * are unchanged.
 */
export const EmptyState: FC<EmptyStateProps> = (props) => (
    <PackageEmptyState {...props} fill />
);
