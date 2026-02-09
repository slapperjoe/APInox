/**
 * RestAuthPanel - Authentication configuration for REST requests
 * Supports Basic Auth, Bearer Token, and API Key
 */

import React from 'react';
import styled from 'styled-components';
import { RestAuthConfig, RestAuthType } from '@shared/models';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM, SPACING_MD } from '../styles/spacing';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--apinox-foreground);
    background: var(--apinox-editor-background);
    padding: 15px;
    gap: 15px;
    overflow-y: auto;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const Label = styled.label`
    font-size: 12px;
    color: var(--apinox-descriptionForeground);
    display: block;
    margin-bottom: ${SPACING_XS}px;
`;

const Select = styled.select`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: ${SPACING_SM}px 12px;
    border-radius: ${SPACING_XS}px;
    font-size: 13px;
    width: 100%;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const InputRow = styled.div`
    display: flex;
    gap: ${SPACING_SM}px;
    align-items: flex-start;
`;

const InputGroup = styled.div`
    flex: 1;
`;

const Hint = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    margin-top: ${SPACING_XS}px;
    opacity: 0.8;
`;

const SectionHeading = styled.h4`
    margin: 0;
`;

const NoAuthPlaceholder = styled.div`
    opacity: 0.6;
    font-style: italic;
    padding: ${SPACING_MD}px;
    text-align: center;
    border: 1px dashed var(--apinox-panel-border);
    border-radius: ${SPACING_XS}px;
`;

interface RestAuthPanelProps {
    auth?: RestAuthConfig;
    onChange: (auth: RestAuthConfig) => void;
    readOnly?: boolean;
}

export const RestAuthPanel: React.FC<RestAuthPanelProps> = ({
    auth,
    onChange,
    readOnly = false
}) => {
    const currentAuth: RestAuthConfig = auth || { type: 'none' };

    const updateAuth = (updates: Partial<RestAuthConfig>) => {
        onChange({ ...currentAuth, ...updates });
    };

    const authTypes: { value: RestAuthType; label: string; description: string }[] = [
        { value: 'none', label: 'No Auth', description: 'No authentication required' },
        { value: 'basic', label: 'Basic Auth', description: 'Username and password (Base64 encoded)' },
        { value: 'bearer', label: 'Bearer Token', description: 'OAuth2 or JWT token in Authorization header' },
        { value: 'apiKey', label: 'API Key', description: 'API key in header or query parameter' },
    ];

    return (
        <Container>
            <Section>
                <div>
                    <Label>Authentication Type</Label>
                    <Select
                        value={currentAuth.type}
                        onChange={(e) => updateAuth({ type: e.target.value as RestAuthType })}
                        disabled={readOnly}
                    >
                        {authTypes.map(at => (
                            <option key={at.value} value={at.value}>{at.label}</option>
                        ))}
                    </Select>
                    <Hint>{authTypes.find(at => at.value === currentAuth.type)?.description}</Hint>
                </div>
            </Section>

            {currentAuth.type === 'basic' && (
                <Section>
                    <SectionHeading>Basic Authentication</SectionHeading>
                    <InputRow>
                        <InputGroup>
                            <Label>Username</Label>
                            <MonacoSingleLineInput
                                value={currentAuth.username || ''}
                                onChange={(val) => updateAuth({ username: val })}
                                placeholder="username"
                            />
                        </InputGroup>
                        <InputGroup>
                            <Label>Password</Label>
                            <MonacoSingleLineInput
                                value={currentAuth.password || ''}
                                onChange={(val) => updateAuth({ password: val })}
                                placeholder="password"
                            />
                        </InputGroup>
                    </InputRow>
                    <Hint>
                        Credentials will be Base64 encoded and sent as: Authorization: Basic &lt;credentials&gt;
                    </Hint>
                </Section>
            )}

            {currentAuth.type === 'bearer' && (
                <Section>
                    <SectionHeading>Bearer Token</SectionHeading>
                    <div>
                        <Label>Token</Label>
                        <MonacoSingleLineInput
                            value={currentAuth.token || ''}
                            onChange={(val) => updateAuth({ token: val })}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        />
                    </div>
                    <Hint>
                        Token will be sent as: Authorization: Bearer &lt;token&gt;
                    </Hint>
                </Section>
            )}

            {currentAuth.type === 'apiKey' && (
                <Section>
                    <SectionHeading>API Key</SectionHeading>
                    <InputRow>
                        <InputGroup>
                            <Label>Key Name</Label>
                            <MonacoSingleLineInput
                                value={currentAuth.apiKeyName || ''}
                                onChange={(val) => updateAuth({ apiKeyName: val })}
                                placeholder="X-API-Key"
                            />
                        </InputGroup>
                        <InputGroup>
                            <Label>Key Value</Label>
                            <MonacoSingleLineInput
                                value={currentAuth.token || ''}
                                onChange={(val) => updateAuth({ token: val })}
                                placeholder="your-api-key-here"
                            />
                        </InputGroup>
                    </InputRow>
                    <div>
                        <Label>Add To</Label>
                        <Select
                            value={currentAuth.apiKeyIn || 'header'}
                            onChange={(e) => updateAuth({ apiKeyIn: e.target.value as 'header' | 'query' })}
                            disabled={readOnly}
                        >
                            <option value="header">Header</option>
                            <option value="query">Query Parameter</option>
                        </Select>
                    </div>
                    <Hint>
                        {currentAuth.apiKeyIn === 'query'
                            ? `Key will be added as query param: ?${currentAuth.apiKeyName || 'key'}=<value>`
                            : `Key will be sent in header: ${currentAuth.apiKeyName || 'X-API-Key'}: <value>`
                        }
                    </Hint>
                </Section>
            )}

            {currentAuth.type === 'none' && (
                <NoAuthPlaceholder>
                    No authentication configured for this request.
                </NoAuthPlaceholder>
            )}
        </Container>
    );
};
