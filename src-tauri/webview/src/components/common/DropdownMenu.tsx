import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { MoreVertical } from 'lucide-react';

interface DropdownMenuItem {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

interface DropdownMenuProps {
    icon?: React.ReactNode;
    items: DropdownMenuItem[];
    title?: string;
}

const MenuButton = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-foreground);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 3px;
    transition: background 0.15s;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }

    svg {
        width: 16px;
        height: 16px;
    }
`;

const MenuContainer = styled.div`
    position: relative;
`;

const MenuDropdown = styled.div`
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 180px;
    background: var(--apinox-sideBar-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px var(--apinox-widget-shadow);
    z-index: 1000;
    overflow: hidden;
`;

const MenuItem = styled.button<{ $disabled?: boolean }>`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: ${props => props.$disabled ? 'var(--apinox-descriptionForeground)' : 'var(--apinox-foreground)'};
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    text-align: left;
    font-size: 13px;
    transition: background 0.1s;
    opacity: ${props => props.$disabled ? 0.5 : 1};

    &:hover:not(:disabled) {
        background: var(--apinox-list-hoverBackground);
    }

    svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }
`;

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ icon, items, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleItemClick = (item: DropdownMenuItem) => {
        if (!item.disabled) {
            item.onClick();
            setIsOpen(false);
        }
    };

    return (
        <MenuContainer ref={containerRef}>
            <MenuButton 
                onClick={() => setIsOpen(!isOpen)}
                title={title}
            >
                {icon || <MoreVertical />}
            </MenuButton>
            {isOpen && (
                <MenuDropdown>
                    {items.map((item, index) => (
                        <MenuItem
                            key={index}
                            onClick={() => handleItemClick(item)}
                            $disabled={item.disabled}
                            disabled={item.disabled}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </MenuItem>
                    ))}
                </MenuDropdown>
            )}
        </MenuContainer>
    );
};
