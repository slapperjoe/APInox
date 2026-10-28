import React from 'react';
import { HelpCircle } from 'lucide-react';
import { IconButton } from './common/Button';
import { Tooltip } from './common/Tooltip';
import { useUI } from '../contexts/UIContext';


interface ContextHelpButtonProps {
    sectionId: string;
    title?: string;
    style?: React.CSSProperties;
    size?: number;
}

export const ContextHelpButton: React.FC<ContextHelpButtonProps> = ({
    sectionId,
    title = "Help",
    style,
    size = 16
}) => {
    const { openHelp } = useUI();

    return (
        <Tooltip content={title}>
            <IconButton
                onClick={() => openHelp(sectionId)}
                style={style}
            >
                <HelpCircle size={size} />
            </IconButton>
        </Tooltip>
    );
};
