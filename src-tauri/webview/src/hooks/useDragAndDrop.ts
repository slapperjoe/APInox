/**
 * useDragAndDrop Hook
 * 
 * Provides drag-and-drop reordering functionality for sidebar items
 * (projects, folders, interfaces - but NOT requests)
 */

import { useState, useCallback, useRef } from 'react';

export interface DragState {
    draggedItemId: string | null;
    draggedItemType: 'project' | 'folder' | 'interface' | null;
    draggedProjectName: string | null;
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
        draggedProjectName: null,
        dropTargetId: null,
        dropPosition: null
    });

    // Refs mirror the drag metadata so handleDragOver/handleDrop always read
    // the current values without stale-closure issues (state updates are async
    // and the first dragover events fire before React re-renders).
    const dragIdRef = useRef<string | null>(null);
    const dragTypeRef = useRef<string | null>(null);
    const dragProjectRef = useRef<string | null>(null);
    const dropPositionRef = useRef<'before' | 'after' | null>(null);

    const handleDragStart = useCallback((
        e: React.DragEvent,
        itemId: string,
        itemType: 'project' | 'folder' | 'interface',
        projectName?: string
    ) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
        // Update refs synchronously so dragover handlers have them immediately
        dragIdRef.current = itemId;
        dragTypeRef.current = itemType;
        dragProjectRef.current = projectName ?? null;
        dropPositionRef.current = null;
        setDragState({
            draggedItemId: itemId,
            draggedItemType: itemType,
            draggedProjectName: projectName ?? null,
            dropTargetId: null,
            dropPosition: null
        });
    }, []);

    const handleDragOver = useCallback((
        e: React.DragEvent,
        targetId: string,
        targetType: 'project' | 'folder' | 'interface'
    ) => {
        // Use refs to avoid stale-closure problems on rapid dragover events
        if (dragIdRef.current === targetId) {
            return;
        }

        // Always allow drop while dragging — the drop event must fire so that bubbled
        // parent handlers (e.g. outer project div) can catch it when types don't match here.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (dragTypeRef.current !== targetType) {
            // Types don't match at this level — let the event bubble without updating state
            return;
        }

        // Determine drop position based on mouse Y position
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const position = e.clientY < midPoint ? 'before' : 'after';

        dropPositionRef.current = position;
        setDragState(prev => ({
            ...prev,
            dropTargetId: targetId,
            dropPosition: position
        }));
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear when the pointer genuinely leaves the element.
        // dragLeave fires when crossing child element boundaries too — ignore those
        // by checking that relatedTarget is not still inside this element.
        const relatedTarget = e.relatedTarget as Node | null;
        if (relatedTarget && (e.currentTarget as HTMLElement).contains(relatedTarget)) {
            return;
        }
        setDragState(prev => ({
            ...prev,
            dropTargetId: null,
            dropPosition: null
        }));
    }, []);

    const handleDrop = useCallback((
        e: React.DragEvent,
        targetId: string,
        targetType: 'project' | 'folder' | 'interface'
    ) => {
        e.preventDefault();

        if (dragIdRef.current &&
            dragTypeRef.current === targetType &&
            dragIdRef.current !== targetId) {

            // Recalculate drop position directly from event so a cleared ref can't break the drop.
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

            onReorder(
                dragIdRef.current,
                targetId,
                position,
                targetType,
                dragProjectRef.current ?? undefined
            );

            // Only clear refs on a successful (type-matched) drop so that if the event
            // bubbles to a parent handler with a different type, that handler can still respond.
            dragIdRef.current = null;
            dragTypeRef.current = null;
            dragProjectRef.current = null;
            dropPositionRef.current = null;
        }

        // Always reset visual state
        setDragState({
            draggedItemId: null,
            draggedItemType: null,
            draggedProjectName: null,
            dropTargetId: null,
            dropPosition: null
        });
    }, [onReorder]);

    const handleDragEnd = useCallback(() => {
        dragIdRef.current = null;
        dragTypeRef.current = null;
        dragProjectRef.current = null;
        dropPositionRef.current = null;
        setDragState({
            draggedItemId: null,
            draggedItemType: null,
            draggedProjectName: null,
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
