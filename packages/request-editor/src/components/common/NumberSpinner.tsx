import styled from 'styled-components';
import { SPACING_XS } from '../../styles/spacing';

const SpinnerContainer = styled.div`
    display: flex;
    align-items: center;
    background: var(--apinox-input-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: 2px;
`;

const SpinnerButton = styled.div`
    padding: ${SPACING_XS} 8px;
    cursor: pointer;
    border-color: var(--apinox-input-border);
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--apinox-foreground);
    
    &:hover {
        background: var(--apinox-toolbar-hoverBackground);
    }
    
    &.decrement {
        border-right: 1px solid var(--apinox-input-border);
    }
    
    &.increment {
        border-left: 1px solid var(--apinox-input-border);
    }
`;

const SpinnerInput = styled.input`
    flex: 1;
    width: 60px;
    padding: ${SPACING_XS};
    background: transparent;
    color: var(--apinox-input-foreground);
    border: none;
    text-align: center;
    appearance: textfield;
    
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    
    &:focus {
        outline: none;
    }
`;

interface NumberSpinnerProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
}

export const NumberSpinner: React.FC<NumberSpinnerProps> = ({
    value,
    onChange,
    min = 1,
    max = 65535,
    step = 1,
    defaultValue = 9000
}) => {
    const handleDecrement = () => {
        const newValue = Math.max(min, (value || defaultValue) - step);
        onChange(newValue);
    };

    const handleIncrement = () => {
        const newValue = Math.min(max, (value || defaultValue) + step);
        onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value);
        if (isNaN(parsed)) {
            onChange(defaultValue);
        } else {
            onChange(Math.min(max, Math.max(min, parsed)));
        }
    };

    return (
        <SpinnerContainer>
            <SpinnerButton className="decrement" onClick={handleDecrement}>
                −
            </SpinnerButton>
            <SpinnerInput
                type="number"
                value={value}
                onChange={handleChange}
                min={min}
                max={max}
            />
            <SpinnerButton className="increment" onClick={handleIncrement}>
                +
            </SpinnerButton>
        </SpinnerContainer>
    );
};
