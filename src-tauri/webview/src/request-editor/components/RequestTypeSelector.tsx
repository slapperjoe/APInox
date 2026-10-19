/**
 * RequestTypeSelector - Unified component for selecting request type, method, and content type
 * Consolidates all protocol-specific options into one component
 */

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { RequestType, BodyType, HttpMethod } from '../types';

const Select = styled.select`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }

    &:disabled {
        background: var(--apinox-button-secondaryBackground);
        color: var(--apinox-button-secondaryForeground);
        border-color: var(--apinox-button-secondaryHoverBackground);
        cursor: not-allowed;
    }
`;

const Label = styled.span`
    font-size: 10px;
    color: var(--apinox-descriptionForeground);
    text-transform: uppercase;
    font-weight: var(--fw-medium);
`;

const MethodSelect = styled.select<{ $method: string }>`
    background: ${props => {
        switch (props.$method) {
            case 'GET': return 'var(--apinox-charts-green)';
            case 'POST': return 'var(--apinox-charts-blue)';
            case 'PUT': return 'var(--apinox-charts-orange)';
            case 'PATCH': return 'var(--apinox-charts-yellow)';
            case 'DELETE': return 'var(--apinox-charts-red)';
            default: return 'var(--apinox-input-background)';
        }
    }};
    color: ${props => {
        // Use white/light text for colored backgrounds for better contrast
        switch (props.$method) {
            case 'GET':
            case 'POST':
            case 'PUT':
            case 'PATCH':
            case 'DELETE':
                return '#ffffff';
            default:
                return 'var(--apinox-foreground)';
        }
    }};
    border: none;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: var(--fw-semibold);
    cursor: pointer;
    min-width: 70px;
    text-align: center;

    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }

    &:disabled {
        background: var(--apinox-button-secondaryBackground);
        color: var(--apinox-button-secondaryForeground);
        border: 1px solid var(--apinox-button-secondaryHoverBackground);
        cursor: not-allowed;
    }
    
    /* Style dropdown options */
    option {
        background: var(--apinox-dropdown-background);
        color: var(--apinox-dropdown-foreground);
    }
`;

/**
 * Content-Type trigger button. A captured/edited Content-Type can be a long
 * string (`application/soap+xml; action="urn:..."` — cloned SOAP 1.2
 * requests), so the trigger keeps a fixed narrow width and ellipsizes; the
 * full value lives in the title tooltip and the open list.
 */
const CtTrigger = styled.button<{ $compact: boolean }>`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 4px 22px 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    width: ${(props) => (props.$compact ? 130 : 170)}px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
    position: relative;

    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }

    &:disabled {
        background: var(--apinox-button-secondaryBackground);
        color: var(--apinox-button-secondaryForeground);
        border-color: var(--apinox-button-secondaryHoverBackground);
        cursor: not-allowed;
    }
`;

const CtTriggerLabel = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
`;

/**
 * Content-Type popup. Rendered fixed-positioned (viewport coordinates) so
 * it is never clipped by the toolbar; it sizes to its content — at least the
 * trigger width, capped at the window edge — so a long option stays fully
 * readable.
 */
const CtPopup = styled.div`
    position: fixed;
    background: var(--apinox-dropdown-listBackground, var(--apinox-dropdown-background));
    border: 1px solid var(--apinox-dropdown-border);
    box-shadow: 0 4px 12px var(--apinox-widget-shadow, rgba(0, 0, 0, 0.36));
    z-index: 1000;
`;

const CtOption = styled.div<{ $selected?: boolean }>`
    padding: 6px 10px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: ${(props) => (props.$selected ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent')};
    color: ${(props) => (props.$selected ? 'var(--apinox-list-activeSelectionForeground)' : 'var(--apinox-dropdown-foreground)')};

    &:hover {
        background: ${(props) => (props.$selected ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)')};
    }
`;

interface RequestTypeSelectorProps {
    requestType?: RequestType;
    bodyType?: BodyType;
    method?: HttpMethod | string;
    /** Effective Content-Type for display (callers must pass the *resolved* value, never a bare request.contentType — see SOAP_INTERFACE_CONTENT_TYPE_SPEC.md §5.3). Pass '' for "SOAP default (no explicit request value)". */
    contentType?: string;
    /** The interface-level (project) Content-Type override; when set, its value is shown as "override: X" in the dropdown. */
    interfaceOverride?: string;
    /** The SOAP-version default (e.g. 'text/xml; charset=utf-8') — label for the "SOAP default" option. */
    soapDefaultLabel?: string;
    onRequestTypeChange: (type: RequestType) => void;
    onBodyTypeChange: (type: BodyType) => void;
    onMethodChange: (method: HttpMethod | string) => void;
    onContentTypeChange?: (contentType: string) => void;
    readOnly?: boolean;
    compact?: boolean; // For toolbar mode
}

export const RequestTypeSelector: React.FC<RequestTypeSelectorProps> = ({
    requestType = 'soap',
    bodyType,
    method = 'POST',
    contentType = '',
    interfaceOverride,
    soapDefaultLabel,
    onRequestTypeChange,
    onBodyTypeChange,
    onMethodChange,
    onContentTypeChange,
    readOnly = false,
    compact = false
}) => {
    const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    const soapMethods = ['POST', 'GET'];

    const bodyTypes: { value: BodyType; label: string }[] = [
        { value: 'json', label: 'JSON' },
        { value: 'xml', label: 'XML' },
        { value: 'text', label: 'Text' },
        { value: 'form-data', label: 'Form' },
        { value: 'none', label: 'None' }
    ];

    const soapContentTypes = [
        { value: 'application/soap+xml', label: 'application/soap+xml' },
        { value: 'text/xml', label: 'text/xml' },
        { value: 'application/xml', label: 'application/xml' }
    ];

    // A captured/edited Content-Type (e.g. `application/soap+xml;
    // charset=utf-8; action="urn:..."`) is not one of the fixed options.
    // Include the current value as its own option so the <select> can render
    // it instead of silently falling back to the first option and so picking
    // it again keeps the string verbatim.
    const contentTypeOptions = soapContentTypes.some(ct => ct.value === contentType)
        ? soapContentTypes
        : [
            ...(contentType ? [{ value: contentType, label: contentType }] : []),
            ...soapContentTypes
        ];

    // Default body type based on request type
    const effectiveBodyType = bodyType || (
        requestType === 'rest' ? 'json' :
            'xml'
    );

    const effectiveMethod = method || (requestType === 'soap' ? 'POST' : 'GET');
    const methodList = requestType === 'soap' ? soapMethods : httpMethods;

    // Content-Type custom dropdown state (the native <select> stretched the
    // toolbar to fit a long captured value and its popup can't be sized on
    // WebKit). Closes on outside mousedown / Escape / scroll / resize.
    const [ctOpen, setCtOpen] = useState(false);
    const ctButtonRef = useRef<HTMLButtonElement | null>(null);
    const ctPopupRef = useRef<HTMLDivElement | null>(null);
    const [ctPos, setCtPos] = useState<{ top: number; left: number; minWidth: number; maxWidth: number } | null>(null);

    useEffect(() => {
        if (!ctOpen) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (ctButtonRef.current?.contains(t) || ctPopupRef.current?.contains(t)) return;
            setCtOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtOpen(false); };
        const onClose = () => setCtOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onClose);
        window.addEventListener('scroll', onClose, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('scroll', onClose, true);
        };
    }, [ctOpen]);

    const toggleContentType = () => {
        if (readOnly) return;
        if (!ctOpen && ctButtonRef.current) {
            const rect = ctButtonRef.current.getBoundingClientRect();
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - 48));
            setCtPos({
                top: rect.bottom + 4,
                left,
                minWidth: rect.width,
                maxWidth: Math.max(200, window.innerWidth - left - 16),
            });
        }
        setCtOpen(prev => !prev);
    };

    const pickContentType = (value: string) => {
        onContentTypeChange?.(value);
        setCtOpen(false);
    };

    return (
        <>
            {/* Request Type */}
            {!compact && <Label>Type</Label>}
            <Select
                value={requestType}
                onChange={(e) => onRequestTypeChange(e.target.value as RequestType)}
                disabled={readOnly}
                title="Request Type"
                style={{ minWidth: compact ? 60 : 70 }}
            >
                <option value="soap">SOAP</option>
                <option value="rest">REST</option>
            </Select>

            {/* Method */}
            <MethodSelect
                $method={effectiveMethod}
                value={effectiveMethod}
                onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
                disabled={readOnly}
                title="HTTP Method"
            >
                {methodList.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
        </MethodSelect>

            {/* Content Type - for SOAP only. Custom dropdown: fixed narrow
                trigger (ellipsized long value) + content-sized popup. */}
            {requestType === 'soap' && onContentTypeChange && (
                <>
                    <CtTrigger
                        ref={ctButtonRef}
                        $compact={compact}
                        type="button"
                        disabled={readOnly}
                        title={contentType || `SOAP default${soapDefaultLabel ? ` (${soapDefaultLabel})` : ''}`}
                        aria-label="Content Type"
                        aria-haspopup="listbox"
                        aria-expanded={ctOpen}
                        onClick={toggleContentType}
                    >
                        <CtTriggerLabel>
                            {contentType === ''
                                ? `SOAP default ${soapDefaultLabel ? `(${soapDefaultLabel})` : ''}${interfaceOverride ? ` — override: ${interfaceOverride}` : ''}`
                                : contentType}
                        </CtTriggerLabel>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="6"
                            viewBox="0 0 10 6"
                            style={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: `translateY(-50%) rotate(${ctOpen ? '180deg' : '0deg'})`,
                                transition: 'transform 0.15s ease',
                                flexShrink: 0,
                                fill: 'currentColor',
                                opacity: 0.7,
                            }}
                        >
                            <path d="M0 0L5 6L10 0" />
                        </svg>
                    </CtTrigger>
                    {ctOpen && ctPos && (
                        <CtPopup
                            ref={ctPopupRef}
                            role="listbox"
                            aria-label="Content Type"
                            style={{
                                top: `${ctPos.top}px`,
                                left: `${ctPos.left}px`,
                                minWidth: `${ctPos.minWidth}px`,
                                maxWidth: `${ctPos.maxWidth}px`,
                            }}
                        >
                            <CtOption
                                role="option"
                                aria-selected={contentType === ''}
                                $selected={contentType === ''}
                                title={`SOAP default ${soapDefaultLabel ? `(${soapDefaultLabel})` : ''}${interfaceOverride ? ` — override: ${interfaceOverride}` : ''}`}
                                onClick={() => pickContentType('')}
                            >
                                SOAP default {soapDefaultLabel ? `(${soapDefaultLabel})` : ''}{interfaceOverride ? ` — override: ${interfaceOverride}` : ''}
                            </CtOption>
                            {contentTypeOptions.map(ct => (
                                <CtOption
                                    key={ct.value}
                                    role="option"
                                    aria-selected={contentType === ct.value}
                                    $selected={contentType === ct.value}
                                    title={ct.label}
                                    onClick={() => pickContentType(ct.value)}
                                >
                                    {ct.label}
                                </CtOption>
                            ))}
                        </CtPopup>
                    )}
                </>
            )}

            {/* Body Type - for REST only */}
            {requestType === 'rest' && (
                <>
                    {!compact && <Label>Body</Label>}
                    <Select
                        value={effectiveBodyType}
                        onChange={(e) => onBodyTypeChange(e.target.value as BodyType)}
                        disabled={readOnly}
                        title="Body Type"
                        style={{ minWidth: compact ? 50 : 70 }}
                    >
                        {bodyTypes.map(bt => (
                            <option key={bt.value} value={bt.value}>{bt.label}</option>
                        ))}
                    </Select>
                </>
            )}
        </>
    );
};
