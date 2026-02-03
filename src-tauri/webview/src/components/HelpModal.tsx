import React, { useState } from 'react';
import styled from 'styled-components';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import { Modal } from './modals/Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../styles/spacing';

const ModalBody = styled.div`
    display: flex;
    overflow: hidden;
    height: calc(80vh - 120px);
`;

const Sidebar = styled.div`
    width: 200px;
    background-color: var(--apinox-sideBar-background);
    border-right: 1px solid var(--apinox-panel-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
`;

const Tab = styled.button<{ $active: boolean }>`
    background: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-list-activeSelectionForeground)' : 'var(--apinox-foreground)'};
    border: none;
    padding: ${SPACING_SM} ${SPACING_MD};
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    font-size: 13px;

    &:hover {
        background: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;

const ChildTab = styled(Tab)`
    padding-left: 30px;
    font-size: 12px;
`;

const GroupLabel = styled.div`
    padding: ${SPACING_SM} ${SPACING_MD} ${SPACING_XS};
    font-size: 11px;
    text-transform: uppercase;
    color: var(--apinox-descriptionForeground);
    letter-spacing: 0.5px;
`;

const ContentArea = styled.div`
    flex: 1;
    padding: ${SPACING_LG} 30px;
    overflow-y: auto;
    background-color: var(--apinox-editor-background);

    h1 { border-bottom: 1px solid var(--apinox-panel-border); padding-bottom: ${SPACING_SM}; margin-bottom: ${SPACING_LG}; font-size: 24px; }
    h2 { margin-top: 25px; margin-bottom: ${SPACING_MD}; font-size: 18px; color: var(--apinox-textLink-foreground); }
    h3 { margin-top: ${SPACING_LG}; margin-bottom: ${SPACING_SM}; font-size: 16px; font-weight: bold; }
    p { margin-bottom: ${SPACING_MD}; line-height: 1.5; }
    ul { margin-left: ${SPACING_LG}; margin-bottom: ${SPACING_MD}; }
    li { margin-bottom: ${SPACING_XS}; }
    code { background: var(--apinox-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
    pre { background: var(--apinox-textCodeBlock-background); padding: ${SPACING_MD}; border-radius: 4px; overflow-x: auto; margin-bottom: ${SPACING_MD}; }
    img { max-width: 100%; height: auto; border: 1px solid var(--apinox-panel-border); margin: ${SPACING_SM} 0; border-radius: 4px; }
`;

import { HELP_SECTIONS } from '../data/helpContent';

interface HelpModalProps {
  onClose: () => void;
  initialSectionId?: string | null;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose, initialSectionId }) => {
  const allSections = React.useMemo(
    () => HELP_SECTIONS.flatMap(section => [section, ...(section.children ?? [])]),
    []
  );
  const [activeTabId, setActiveTabId] = useState(initialSectionId || HELP_SECTIONS[0].id);

  // If initialSectionId changes while modal is open (rare but possible), update tab
  React.useEffect(() => {
    if (initialSectionId) {
      setActiveTabId(initialSectionId);
    }
  }, [initialSectionId]);

  const activeSection = allSections.find(s => s.id === activeTabId) || HELP_SECTIONS[0];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="APInox Help"
      size="large"
      showCloseButton={true}
    >
      <ModalBody>
        <Sidebar>
          {HELP_SECTIONS.map(section => (
            <React.Fragment key={section.id}>
              <GroupLabel>{section.label}</GroupLabel>
              <Tab
                $active={activeTabId === section.id}
                onClick={() => setActiveTabId(section.id)}
              >
                <section.icon size={16} />
                {section.label}
              </Tab>
              {(section.children ?? []).map(child => (
                <ChildTab
                  key={child.id}
                  $active={activeTabId === child.id}
                  onClick={() => setActiveTabId(child.id)}
                >
                  <child.icon size={14} />
                  {child.label}
                </ChildTab>
              ))}
            </React.Fragment>
          ))}
        </Sidebar>
        <ContentArea>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeSection.content}</ReactMarkdown>
        </ContentArea>
      </ModalBody>
    </Modal>
  );
};
