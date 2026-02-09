/**
 * useDragAndDrop Hook
 * 
 * Provides drag-and-drop reordering functionality for sidebar items
 * (projects, folders, interfaces - but NOT requests)
 */

import { useState, useCallback } from 'react';

export interface DragState {
    draggedItemId: string | null;
    draggedItemType: 'project' | 'folder' | 'interface' | null;
    dropTargetId: string | null;
    dropPosition: 'before' | 'after' | null;
}

interface UseDragAndDropProps {
    onReorder: (itemId: string, targetId: string, position: 'before' | 'after', itemType: 'project' | 'folder' | 'interface', projectName?: string) => void;
}

export function useDragAndDrop({ onReorder }: UseDragAndDropProps) {
    const [dragState, setDragState] = useState<DragState>({
        draggedItemId: null,
        draggedItemType: null,
        dropTargetId: null,
        dropPosition: null
    });

    const handleDragStart = useCallback((
        e: React.DragEvent,
        itemId: string,
        itemType: 'project' | 'folder' | 'interface'
    ) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
        setDragState({
            draggedItemId: itemId,
            draggedItemType: itemType,
            dropTargetId: null,
            dropPosition: null
        });
    }, []);

    const handleDragOver = useCallback((
        e: React.DragEvent,
        targetId: string,
        targetType: 'project' | 'folder' | 'interface'
    ) => {
        e.preventDefault();
        
        // Don't allow dropping on self
        if (dragState.draggedItemId === targetId) {
            return;
        }

        // Only allow reordering within same type
        if (dragState.draggedItemType !== targetType) {
            return;
        }

        // Determine drop position based on mouse Y position
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const position = e.clientY < midPoint ? 'before' : 'after';

        setDragState(prev => ({
            ...prev,
            dropTargetId: targetId,
            dropPosition: position
        }));
    }, [dragState.draggedItemId, dragState.draggedItemType]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear if we're leaving the entire draggable area
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !relatedTarget.hasAttribute('draggable')) {
            setDragState(prev => ({
                ...prev,
                dropTargetId: null,
                dropPosition: null
            }));
        }
    }, []);

    const handleDrop = useCallback((
        e: React.DragEvent,
        targetId: string,
        targetType: 'project' | 'folder' | 'interface'
    ) => {
        e.preventDefault();

        if (dragState.draggedItemId && 
            dragState.draggedItemType === targetType && 
            dragState.draggedItemId !== targetId &&
            dragState.dropPosition) {
            
            onReorder(
                dragState.draggedItemId,
                targetId,
                dragState.dropPosition,
                targetType
            );
        }

        setDragState({
            draggedItemId: null,
            draggedItemType: null,
            dropTargetId: null,
            dropPosition: null
        });
    }, [dragState, onReorder]);

    const handleDragEnd = useCallback(() => {
        setDragState({
            draggedItemId: null,
            draggedItemType: null,
            dropTargetId: null,
            dropPosition: null
        });
    }, []);

    return {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd
    };
}
