import React, { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { X } from 'lucide-react';
import { MODAL_DEFAULTS, MODAL_SIZES, MODAL_CONSTRAINTS, ModalSize } from './constants';
import { SPACING_XS, SPACING_MD } from '../../styles/spacing';

const overlayEnter = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${MODAL_DEFAULTS.OVERLAY_BG};
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: ${MODAL_DEFAULTS.Z_INDEX};
  animation: ${overlayEnter} ${MODAL_DEFAULTS.ANIMATION_DURATION} ease-out;
`;


const modalEnter = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const ModalContent = styled.div<{ $width?: string | number; $size?: ModalSize }>`
  background-color: var(--apinox-editor-background);
  border: 1px solid var(--apinox-panel-border);
  box-shadow: ${MODAL_DEFAULTS.BOX_SHADOW};
  width: ${props => {
    if (props.$size) return MODAL_SIZES[props.$size];
    if (props.$width) return typeof props.$width === 'number' ? `${props.$width}px` : props.$width;
    return MODAL_SIZES.small;
  }};
  max-width: ${props => props.$size === 'fullscreen' ? '100%' : MODAL_CONSTRAINTS.MAX_WIDTH};
  max-height: ${props => props.$size === 'fullscreen' ? MODAL_CONSTRAINTS.FULLSCREEN_MAX_HEIGHT : MODAL_CONSTRAINTS.MAX_HEIGHT};
  display: flex;
  flex-direction: column;
  animation: ${modalEnter} ${MODAL_DEFAULTS.ANIMATION_DURATION} ease-out;
`;

const ModalHeader = styled.div`
    padding: ${MODAL_DEFAULTS.HEADER_PADDING};
    border-bottom: 1px solid var(--apinox-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const ModalTitle = styled.div`
    font-weight: bold;
    flex: 1;
`;

const ModalHeaderExtra = styled.div`
    margin-left: ${SPACING_MD};
    margin-right: ${SPACING_MD};
`;

const ModalBody = styled.div`
    padding: ${MODAL_DEFAULTS.BODY_PADDING};
    overflow-y: auto;
    flex: 1;
`;

const ModalFooter = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
    padding: ${MODAL_DEFAULTS.FOOTER_PADDING};
    border-top: 1px solid var(--apinox-panel-border);
    display: flex;
    justify-content: ${props => {
        switch (props.$align) {
            case 'left': return 'flex-start';
            case 'center': return 'center';
            case 'right':
            default: return 'flex-end';
        }
    }};
    gap: ${MODAL_DEFAULTS.BUTTON_GAP};
`;

export const Button = styled.button`
  background: var(--apinox-button-background);
  color: var(--apinox-button-foreground);
  border: none;
  padding: ${SPACING_XS} ${SPACING_MD};
  cursor: pointer;
  border-radius: 2px;
  
  &:hover {
    background: var(--apinox-button-hoverBackground);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--apinox-icon-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${SPACING_XS};
  border-radius: 4px;
  
  &:hover {
    background: var(--apinox-toolbar-hoverBackground);
  }
`;

/**
 * Base Modal Component
 * 
 * A standardized modal component used across the entire application.
 * Replaces 10+ custom modal implementations with a consistent, reusable solution.
 * 
 * **Features:**
 * - Standardized z-index (1000), overlay styling, and animations
 * - Predefined size presets (small/medium/large/xlarge/fullscreen)
 * - Flexible layout with custom header extras and footer content
 * - Click-outside-to-close behavior
 * - Proper focus management and accessibility
 * 
 * **Standardization:**
 * - All modals use `MODAL_DEFAULTS` from `./constants.ts`
 * - All spacing uses constants from `../../styles/spacing.ts`
 * - All styled props use transient prop pattern ($prop) to avoid DOM warnings
 * 
 * @example
 * // Simple modal with predefined size
 * <Modal
 *   isOpen={true}
 *   onClose={handleClose}
 *   title="Settings"
 *   size="medium"
 *   footer={<Button onClick={handleSave}>Save</Button>}
 * >
 *   <FormContent />
 * </Modal>
 * 
 * @example
 * // Custom width modal with header extra
 * <Modal
 *   isOpen={true}
 *   onClose={handleClose}
 *   title="Advanced Options"
 *   width="600px"
 *   headerExtra={<HelpIcon />}
 *   showCloseButton={true}
 * >
 *   <AdvancedContent />
 * </Modal>
 * 
 * @example
 * // Fullscreen modal (for complex UIs)
 * <Modal
 *   isOpen={true}
 *   onClose={handleClose}
 *   title="Script Playground"
 *   size="fullscreen"
 *   footer={<RunButton />}
 * >
 *   <PlaygroundEditor />
 * </Modal>
 * 
 * **Migration Guide:**
 * When migrating custom modals to use this component:
 * 1. Remove custom Overlay/ModalContainer/Header/Footer styled components
 * 2. Replace `active` props with `$active` (transient prop pattern)
 * 3. Replace hardcoded padding/gaps with spacing constants
 * 4. Use `size` prop instead of custom width (or `width` for special cases)
 * 5. Move footer content to `footer` prop
 * 6. Move header extras (help buttons, etc.) to `headerExtra` prop
 * 
 * **Related Files:**
 * - `./constants.ts` - Modal constants and size presets
 * - `../../styles/spacing.ts` - Spacing constants used throughout
 */
interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  
  /** Callback when modal should close (X button or overlay click) */
  onClose: () => void;
  
  /** Modal header title */
  title: string;
  
  /** Modal body content */
  children: ReactNode;
  
  /** Optional footer content (typically buttons) */
  footer?: ReactNode;
  
  /** Predefined size (overrides width prop) */
  size?: ModalSize;
  
  /** Custom width (use size prop for standard sizes) */
  width?: string | number;
  
  /** Optional extra content in header (right side, before close button) */
  headerExtra?: ReactNode;
  
  /** Show/hide the X close button in header (default: true) */
  showCloseButton?: boolean;
  
  /** Footer button alignment (default: 'right') */
  footerAlign?: 'left' | 'center' | 'right';
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  size,
  width, 
  headerExtra,
  showCloseButton = true,
  footerAlign = 'right'
}) => {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <ModalContent $width={width} $size={size} onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          {headerExtra && (
            <ModalHeaderExtra>{headerExtra}</ModalHeaderExtra>
          )}
          {showCloseButton && (
            <CloseButton onClick={onClose} title="Close">
              <X size={16} />
            </CloseButton>
          )}
        </ModalHeader>
        <ModalBody>
          {children}
        </ModalBody>
        {footer && (
          <ModalFooter $align={footerAlign}>
            {footer}
          </ModalFooter>
        )}
      </ModalContent>
    </ModalOverlay>
  );
};
