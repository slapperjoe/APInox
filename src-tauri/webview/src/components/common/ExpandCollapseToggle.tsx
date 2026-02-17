import React from 'react';
import styled from 'styled-components';
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

interface ExpandCollapseToggleProps {
    isExpanded: boolean;
    onExpandAll: () => void;
    onCollapseAll: () => void;
}

const ToggleButton = styled.button`
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

export const ExpandCollapseToggle: React.FC<ExpandCollapseToggleProps> = ({
    isExpanded,
    onExpandAll,
    onCollapseAll
}) => {
    const handleClick = () => {
        if (isExpanded) {
            onCollapseAll();
        } else {
            onExpandAll();
        }
    };

    return (
        <ToggleButton
            onClick={handleClick}
            title={isExpanded ? "Collapse All" : "Expand All"}
        >
            {isExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
        </ToggleButton>
    );
};
