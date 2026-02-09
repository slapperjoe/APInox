import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Modal, Button } from './Modal';
import { ApinoxProject } from '@shared/models';

const ProjectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
`;

const ProjectItem = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--apinox-panel-border);
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: var(--apinox-list-hoverBackground);
  }
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  cursor: pointer;
`;

const ProjectInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const ProjectName = styled.div`
  font-weight: 500;
  color: var(--apinox-foreground);
`;

const ProjectPath = styled.div`
  font-size: 0.85em;
  color: var(--apinox-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SelectionControls = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
`;

const LinkButton = styled.button`
  background: transparent;
  border: none;
  color: var(--apinox-textLink-foreground);
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  font-size: 0.9em;
  &:hover {
    color: var(--apinox-textLink-activeForeground);
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: var(--apinox-descriptionForeground);
`;

interface ExportWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ApinoxProject[];
  onExport: (projects: ApinoxProject[]) => void;
}

export const ExportWorkspaceModal: React.FC<ExportWorkspaceModalProps> = ({
  isOpen,
  onClose,
  projects,
  onExport
}) => {
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const projectsWithPaths = useMemo(() => {
    return projects.filter(p => p.fileName && p.fileName.trim() !== '');
  }, [projects]);

  const handleToggle = (name: string) => {
    setSelectedNames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedNames(new Set(projectsWithPaths.map(p => p.name)));
  };

  const handleDeselectAll = () => {
    setSelectedNames(new Set());
  };

  const handleExport = () => {
    const selectedProjects = projectsWithPaths.filter(p => selectedNames.has(p.name));
    onExport(selectedProjects);
    setSelectedNames(new Set());
    onClose();
  };

  const handleCancel = () => {
    setSelectedPaths(new Set());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Export Workspace"
      width={600}
      footer={
        <>
          <Button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: '1px solid var(--apinox-button-secondaryForeground)',
              color: 'var(--apinox-button-secondaryForeground)'
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={selectedNames.size === 0}>
            Export ({selectedNames.size})
          </Button>
        </>
      }
    >
      {projectsWithPaths.length === 0 ? (
        <EmptyMessage>
          No projects loaded in workspace
        </EmptyMessage>
      ) : (
        <>
          <SelectionControls>
            <LinkButton onClick={handleSelectAll}>Select All</LinkButton>
            <LinkButton onClick={handleDeselectAll}>Deselect All</LinkButton>
          </SelectionControls>
          <ProjectList>
            {projectsWithPaths.map(project => (
              <ProjectItem key={project.name}>
                <Checkbox
                  checked={selectedNames.has(project.name)}
                  onChange={() => handleToggle(project.name)}
                />
                <ProjectInfo>
                  <ProjectName>{project.name}</ProjectName>
                  <ProjectPath>{project.fileName}</ProjectPath>
                </ProjectInfo>
              </ProjectItem>
            ))}
          </ProjectList>
        </>
      )}
    </Modal>
  );
};
