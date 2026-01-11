/**
 * CollectionList - Sidebar component for displaying REST API collections
 * Similar to ProjectList but for REST/GraphQL requests organized in collections
 */

import React from 'react';
import { Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Trash2, FileJson } from 'lucide-react';
import { RestCollection, RestFolder, ApiRequest } from '@shared/models';
import { HeaderButton, OperationItem } from './shared/SidebarStyles';

export interface CollectionListProps {
    collections: RestCollection[];

    // Selection
    selectedCollectionId: string | null;
    setSelectedCollectionId: (id: string | null) => void;
    selectedRequest: ApiRequest | null;
    setSelectedRequest: (req: ApiRequest | null) => void;
    setResponse: (res: any) => void;

    // Actions
    onAddCollection: () => void;
    onAddRequest: (collectionId: string, folderId?: string) => void;
    onAddFolder: (collectionId: string, parentFolderId?: string) => void;
    onDeleteCollection?: (collection: RestCollection) => void;
    onDeleteFolder?: (folder: RestFolder, collectionId: string) => void;
    onDeleteRequest?: (req: ApiRequest) => void;
    onRenameCollection?: (collection: RestCollection, newName: string) => void;

    // Toggle expansion
    toggleCollectionExpand: (collectionId: string) => void;
    toggleFolderExpand: (collectionId: string, folderId: string) => void;

    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
}

const RequestItem: React.FC<{
    request: ApiRequest;
    isSelected: boolean;
    onClick: () => void;
    onDelete?: () => void;
    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
}> = ({ request, isSelected, onClick, onDelete, deleteConfirm, setDeleteConfirm }) => {
    const methodColors: Record<string, string> = {
        'GET': 'var(--vscode-charts-green)',
        'POST': 'var(--vscode-charts-blue)',
        'PUT': 'var(--vscode-charts-orange)',
        'PATCH': 'var(--vscode-charts-yellow)',
        'DELETE': 'var(--vscode-charts-red)',
    };

    const method = request.method || 'GET';
    const isDeleting = deleteConfirm === request.id;

    return (
        <OperationItem
            style={{
                paddingLeft: 28,
                backgroundColor: isDeleting
                    ? 'var(--vscode-inputValidation-errorBackground)'
                    : isSelected
                        ? 'var(--vscode-list-activeSelectionBackground)'
                        : undefined,
                color: isDeleting
                    ? 'var(--vscode-errorForeground)'
                    : isSelected
                        ? 'var(--vscode-list-activeSelectionForeground)'
                        : undefined,
                animation: isDeleting ? 'shake 0.3s ease-in-out' : undefined
            }}
            onClick={isDeleting ? () => {
                onDelete?.();
                setDeleteConfirm(null);
            } : onClick}
        >
            <FileJson size={14} style={{ marginRight: 6, opacity: 0.7 }} />
            <span style={{
                fontSize: 10,
                fontWeight: 600,
                marginRight: 6,
                color: methodColors[method] || 'var(--vscode-foreground)'
            }}>
                {method}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {request.name}
            </span>
            {onDelete && !isDeleting && (
                <Trash2
                    size={12}
                    style={{ opacity: 0.5, marginLeft: 4 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(request.id || null);
                    }}
                />
            )}
        </OperationItem>
    );
};

const FolderItem: React.FC<{
    folder: RestFolder;
    collectionId: string;
    level: number;
    selectedRequest: ApiRequest | null;
    onSelectRequest: (req: ApiRequest) => void;
    onToggleExpand: () => void;
    onAddRequest?: () => void;
    onDeleteRequest?: (req: ApiRequest) => void;
    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
}> = ({
    folder,
    level,
    selectedRequest,
    onSelectRequest,
    onToggleExpand,
    onDeleteRequest,
    deleteConfirm,
    setDeleteConfirm
}) => {
        const isExpanded = folder.expanded ?? true;

        return (
            <div>
                <OperationItem
                    style={{ paddingLeft: 12 + (level * 12) }}
                    onClick={onToggleExpand}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {isExpanded ? <FolderOpen size={14} style={{ marginLeft: 4 }} /> : <Folder size={14} style={{ marginLeft: 4 }} />}
                    <span style={{ marginLeft: 6, fontWeight: 500 }}>{folder.name}</span>
                </OperationItem>

                {isExpanded && (
                    <>
                        {/* Nested folders */}
                        {folder.folders?.map(subFolder => (
                            <FolderItem
                                key={subFolder.id}
                                folder={subFolder}
                                collectionId=""
                                level={level + 1}
                                selectedRequest={selectedRequest}
                                onSelectRequest={onSelectRequest}
                                onToggleExpand={() => { }}
                                onDeleteRequest={onDeleteRequest}
                                deleteConfirm={deleteConfirm}
                                setDeleteConfirm={setDeleteConfirm}
                            />
                        ))}

                        {/* Requests in folder */}
                        {folder.requests.map(req => (
                            <RequestItem
                                key={req.id}
                                request={req}
                                isSelected={selectedRequest?.id === req.id}
                                onClick={() => onSelectRequest(req)}
                                onDelete={() => onDeleteRequest?.(req)}
                                deleteConfirm={deleteConfirm}
                                setDeleteConfirm={setDeleteConfirm}
                            />
                        ))}
                    </>
                )}
            </div>
        );
    };

export const CollectionList: React.FC<CollectionListProps> = ({
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    selectedRequest,
    setSelectedRequest,
    setResponse,
    onAddCollection,
    onAddRequest,
    onDeleteCollection,
    onDeleteRequest,
    toggleCollectionExpand,
    toggleFolderExpand,
    deleteConfirm,
    setDeleteConfirm
}) => {
    const handleSelectRequest = (req: ApiRequest) => {
        setSelectedRequest(req);
        setResponse(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
                padding: '5px 10px',
                flexShrink: 0
            }}>
                <div style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: 'var(--vscode-sideBarTitle-foreground)',
                    flex: 1
                }}>
                    Collections
                </div>
                <HeaderButton onClick={onAddCollection} title="New Collection">
                    <Plus size={16} />
                </HeaderButton>
            </div>

            {/* Collections List */}
            <div style={{ padding: 10, flex: 1, overflowY: 'auto' }}>
                {collections.length === 0 && (
                    <div style={{
                        opacity: 0.6,
                        fontStyle: 'italic',
                        textAlign: 'center',
                        padding: 20,
                        fontSize: 12
                    }}>
                        No REST collections yet.
                        <br />
                        Click + to create one.
                    </div>
                )}

                {collections.map(collection => {
                    const isExpanded = collection.expanded ?? true;
                    const isSelected = selectedCollectionId === collection.id;
                    const isDeleting = deleteConfirm === collection.id;

                    return (
                        <div key={collection.id}>
                            {/* Collection Header */}
                            <OperationItem
                                style={{
                                    fontWeight: 'bold',
                                    backgroundColor: isDeleting
                                        ? 'var(--vscode-inputValidation-errorBackground)'
                                        : isSelected
                                            ? 'var(--vscode-list-activeSelectionBackground)'
                                            : undefined,
                                    color: isDeleting
                                        ? 'var(--vscode-errorForeground)'
                                        : undefined,
                                    animation: isDeleting ? 'shake 0.3s ease-in-out' : undefined
                                }}
                                onClick={isDeleting ? () => {
                                    onDeleteCollection?.(collection);
                                    setDeleteConfirm(null);
                                } : () => {
                                    toggleCollectionExpand(collection.id);
                                    setSelectedCollectionId(collection.id);
                                }}
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <Folder size={14} style={{ marginLeft: 4 }} />
                                <span style={{ marginLeft: 6, flex: 1 }}>{collection.name}</span>

                                {!isDeleting && (
                                    <>
                                        <div
                                            title="Add Request"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddRequest(collection.id);
                                            }}
                                            style={{ display: 'flex', alignItems: 'center' }}
                                        >
                                            <Plus size={12} style={{ opacity: 0.5, marginLeft: 4 }} />
                                        </div>
                                        {onDeleteCollection && (
                                            <Trash2
                                                size={12}
                                                style={{ opacity: 0.5, marginLeft: 4 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirm(collection.id);
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </OperationItem>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <>
                                    {/* Folders */}
                                    {collection.folders?.map(folder => (
                                        <FolderItem
                                            key={folder.id}
                                            folder={folder}
                                            collectionId={collection.id}
                                            level={1}
                                            selectedRequest={selectedRequest}
                                            onSelectRequest={handleSelectRequest}
                                            onToggleExpand={() => toggleFolderExpand(collection.id, folder.id)}
                                            onDeleteRequest={onDeleteRequest}
                                            deleteConfirm={deleteConfirm}
                                            setDeleteConfirm={setDeleteConfirm}
                                        />
                                    ))}

                                    {/* Top-level requests in collection */}
                                    {collection.requests.map(req => (
                                        <RequestItem
                                            key={req.id}
                                            request={req}
                                            isSelected={selectedRequest?.id === req.id}
                                            onClick={() => handleSelectRequest(req)}
                                            onDelete={() => onDeleteRequest?.(req)}
                                            deleteConfirm={deleteConfirm}
                                            setDeleteConfirm={setDeleteConfirm}
                                        />
                                    ))}

                                    {/* Empty state within collection */}
                                    {collection.requests.length === 0 && (!collection.folders || collection.folders.length === 0) && (
                                        <div style={{
                                            paddingLeft: 28,
                                            opacity: 0.5,
                                            fontSize: 11,
                                            fontStyle: 'italic'
                                        }}>
                                            No requests yet
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
