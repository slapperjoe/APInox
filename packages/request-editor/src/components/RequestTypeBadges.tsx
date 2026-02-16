/**
 * Read-only badge components for displaying request metadata
 * Used when request is in readonly mode (e.g., sample requests)
 */

import React from 'react';
import styled from 'styled-components';

// Common badge styling
const BaseBadge = styled.span`
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  display: inline-block;
  min-width: 60px;
`;

// Request Type Badge (SOAP/REST/GraphQL)
const TypeBadgeStyled = styled(BaseBadge)<{ $type: string }>`
  background: ${props => {
    switch (props.$type) {
      case 'soap': return 'var(--apinox-charts-blue)';
      case 'rest': return 'var(--apinox-charts-green)';
      case 'graphql': return 'var(--apinox-charts-purple)';
      default: return 'var(--apinox-badge-background)';
    }
  }};
  color: #ffffff;
`;

// HTTP Method Badge (GET/POST/PUT/DELETE/etc.)
const MethodBadgeStyled = styled(BaseBadge)<{ $method: string }>`
  background: ${props => {
    switch (props.$method.toUpperCase()) {
      case 'GET': return 'var(--apinox-charts-green)';
      case 'POST': return 'var(--apinox-charts-blue)';
      case 'PUT': return 'var(--apinox-charts-orange)';
      case 'PATCH': return 'var(--apinox-charts-yellow)';
      case 'DELETE': return 'var(--apinox-charts-red)';
      default: return 'var(--apinox-badge-background)';
    }
  }};
  color: #ffffff;
  min-width: 70px;
`;

// Body Type Badge (XML/JSON/etc.)
const BodyTypeBadgeStyled = styled(BaseBadge)`
  background: var(--apinox-editor-inactiveSelectionBackground);
  color: var(--apinox-foreground);
  border: 1px solid var(--apinox-widget-border);
  font-weight: 500;
  min-width: 50px;
`;

// Content Type Badge (for SOAP content-type)
const ContentTypeBadgeStyled = styled(BaseBadge)`
  background: var(--apinox-editor-inactiveSelectionBackground);
  color: var(--apinox-foreground);
  border: 1px solid var(--apinox-widget-border);
  font-weight: 400;
  font-size: 10px;
  min-width: auto;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Container for grouping badges
export const BadgeGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
`;

// Component interfaces
interface RequestTypeBadgeProps {
  type: 'soap' | 'rest' | 'graphql';
}

interface MethodBadgeProps {
  method: string;
}

interface BodyTypeBadgeProps {
  bodyType: string;
}

interface ContentTypeBadgeProps {
  contentType: string;
}

// Exported components
export const RequestTypeBadge: React.FC<RequestTypeBadgeProps> = ({ type }) => (
  <TypeBadgeStyled $type={type} title="Request Type">
    {type.toUpperCase()}
  </TypeBadgeStyled>
);

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method }) => (
  <MethodBadgeStyled $method={method} title="HTTP Method">
    {method.toUpperCase()}
  </MethodBadgeStyled>
);

export const BodyTypeBadge: React.FC<BodyTypeBadgeProps> = ({ bodyType }) => (
  <BodyTypeBadgeStyled title="Body Type">
    {bodyType.toUpperCase()}
  </BodyTypeBadgeStyled>
);

export const ContentTypeBadge: React.FC<ContentTypeBadgeProps> = ({ contentType }) => (
  <ContentTypeBadgeStyled title={contentType}>
    {contentType}
  </ContentTypeBadgeStyled>
);
