/**
 * GeneralTab.tsx
 * 
 * Network and UI settings for the Settings modal.
 */

import React from 'react';
import {
    DirtySoapConfig,
    ScrollableForm,
    FormGroup,
    Label,
    Input,
    Select,
    CheckboxLabel,
    SectionHeader,
} from './SettingsTypes';

interface GeneralTabProps {
    config: DirtySoapConfig;
    onChange: (section: keyof DirtySoapConfig, key: string, value: any) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ config, onChange }) => {
    return (
        <ScrollableForm>
            <SectionHeader>Network</SectionHeader>
            <FormGroup>
                <Label>Default Timeout (seconds)</Label>
                <Input
                    type="number"
                    value={config.network?.defaultTimeout ?? 30}
                    onChange={e => onChange('network', 'defaultTimeout', parseInt(e.target.value))}
                />
            </FormGroup>
            <FormGroup>
                <Label>Retry Count</Label>
                <Input
                    type="number"
                    min={0}
                    max={10}
                    value={config.network?.retryCount ?? 0}
                    onChange={e => onChange('network', 'retryCount', parseInt(e.target.value))}
                />
            </FormGroup>
            <FormGroup>
                <Label>Proxy URL (Optional)</Label>
                <Input
                    type="text"
                    placeholder="http://127.0.0.1:8080"
                    value={config.network?.proxy ?? ''}
                    onChange={e => onChange('network', 'proxy', e.target.value)}
                />
            </FormGroup>

            <SectionHeader>User Interface</SectionHeader>
            <FormGroup>
                <Label>Layout Mode</Label>
                <Select
                    value={config.ui?.layoutMode ?? 'vertical'}
                    onChange={e => onChange('ui', 'layoutMode', e.target.value)}
                >
                    <option value="vertical">Vertical (Two Columns)</option>
                    <option value="horizontal">Horizontal (Stacked)</option>
                </Select>
            </FormGroup>
            <FormGroup>
                <CheckboxLabel>
                    <input
                        type="checkbox"
                        checked={config.ui?.showLineNumbers ?? true}
                        onChange={e => onChange('ui', 'showLineNumbers', e.target.checked)}
                    />
                    Show Line Numbers in Editor
                </CheckboxLabel>
            </FormGroup>
            <FormGroup>
                <CheckboxLabel>
                    <input
                        type="checkbox"
                        checked={config.ui?.alignAttributes ?? false}
                        onChange={e => onChange('ui', 'alignAttributes', e.target.checked)}
                    />
                    Align Attributes Vertically
                </CheckboxLabel>
            </FormGroup>
            <FormGroup>
                <CheckboxLabel>
                    <input
                        type="checkbox"
                        checked={config.ui?.inlineElementValues ?? false}
                        onChange={e => onChange('ui', 'inlineElementValues', e.target.checked)}
                    />
                    Inline simple values in XML Response (Experimental)
                </CheckboxLabel>
            </FormGroup>
        </ScrollableForm>
    );
};
