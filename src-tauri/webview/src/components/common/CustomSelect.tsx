import React, { useState, useRef, useEffect } from 'react';

export interface CustomSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: CustomSelectOption[];
    disabled?: boolean;
    style?: React.CSSProperties;
    placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    style,
    placeholder,
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);
    const displayLabel = selectedOption?.label ?? placeholder ?? value;

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', width: '100%', ...style }}
        >
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => !disabled && setOpen(prev => !prev)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 28px 6px 8px',
                    background: 'var(--apinox-dropdown-background)',
                    color: disabled
                        ? 'var(--apinox-disabledForeground, var(--apinox-dropdown-foreground))'
                        : 'var(--apinox-dropdown-foreground)',
                    border: '1px solid var(--apinox-dropdown-border)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    textAlign: 'left',
                    fontSize: 'inherit',
                    fontFamily: 'var(--apinox-font-family, inherit)',
                    position: 'relative',
                    boxSizing: 'border-box',
                    minHeight: 28,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={disabled}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {displayLabel}
                </span>
                {/* Chevron */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: `translateY(-50%) rotate(${open ? '180deg' : '0deg'})`,
                        transition: 'transform 0.15s ease',
                        flexShrink: 0,
                        fill: 'var(--apinox-dropdown-foreground)',
                        opacity: 0.7,
                    }}
                >
                    <path d="M0 0L5 6L10 0" />
                </svg>
            </button>

            {/* Dropdown list */}
            {open && (
                <>
                    {/* Click-away backdrop */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                        onMouseDown={() => setOpen(false)}
                    />
                    <div
                        role="listbox"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 2px)',
                            left: 0,
                            right: 0,
                            background: 'var(--apinox-dropdown-listBackground, var(--apinox-dropdown-background))',
                            border: '1px solid var(--apinox-dropdown-border)',
                            boxShadow: '0 4px 12px var(--apinox-widget-shadow, rgba(0,0,0,0.3))',
                            zIndex: 1000,
                            maxHeight: 220,
                            overflowY: 'auto',
                        }}
                    >
                        {options.map(option => {
                            const isSelected = option.value === value;
                            return (
                                <div
                                    key={option.value}
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseDown={() => {
                                        if (!option.disabled) {
                                            onChange(option.value);
                                            setOpen(false);
                                        }
                                    }}
                                    style={{
                                        padding: '6px 10px',
                                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                                        opacity: option.disabled ? 0.5 : 1,
                                        background: isSelected
                                            ? 'var(--apinox-list-activeSelectionBackground)'
                                            : 'transparent',
                                        color: isSelected
                                            ? 'var(--apinox-list-activeSelectionForeground)'
                                            : 'var(--apinox-dropdown-foreground)',
                                        fontSize: 'inherit',
                                        fontFamily: 'var(--apinox-font-family, inherit)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                    onMouseEnter={e => {
                                        if (!option.disabled && !isSelected) {
                                            (e.currentTarget as HTMLDivElement).style.background =
                                                'var(--apinox-list-hoverBackground)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) {
                                            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                                        }
                                    }}
                                >
                                    {option.label}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
