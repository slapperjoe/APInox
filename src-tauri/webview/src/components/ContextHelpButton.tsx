import React from 'react';
import { HelpCircle } from 'lucide-react';
import { IconButton } from './common/Button';
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
        <IconButton
            onClick={() => openHelp(sectionId)}
            title={title}
            style={style}
        >
            <HelpCircle size={size} />
        </IconButton>
    );
};
