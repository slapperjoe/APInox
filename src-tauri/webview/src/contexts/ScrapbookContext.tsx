/**
 * ScrapbookContext.tsx
 * 
 * Context for managing scrapbook requests (API Explorer quick requests).
 * Handles state, backend communication, and CRUD operations for scrapbook requests.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ScrapbookRequest, ScrapbookState } from '@shared/models';
import { FrontendCommand, BackendCommand } from '@shared/messages';
import { bridge } from '../utils/bridge';

interface ScrapbookContextType {
    // State
    scrapbookRequests: ScrapbookRequest[];
    selectedScrapbookRequest: ScrapbookRequest | null;
    loading: boolean;

    // Actions
    createRequest: () => Promise<void>;
    updateRequest: (id: string, updates: Partial<ScrapbookRequest>) => Promise<void>;
    deleteRequest: (id: string) => Promise<void>;
    selectRequest: (request: ScrapbookRequest | null) => void;
    refreshScrapbook: () => Promise<void>;
}

const ScrapbookContext = createContext<ScrapbookContextType | undefined>(undefined);

export const useScrapbook = () => {
    const context = useContext(ScrapbookContext);
    if (!context) {
        throw new Error('useScrapbook must be used within a ScrapbookProvider');
    }
    return context;
};

export const ScrapbookProvider = ({ children }: { children: ReactNode }) => {
    const [scrapbookRequests, setScrapbookRequests] = useState<ScrapbookRequest[]>([]);
    const [selectedScrapbookRequest, setSelectedScrapbookRequest] = useState<ScrapbookRequest | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    /**
     * Load scrapbook from backend on mount
     */
    useEffect(() => {
        loadScrapbook();
    }, []);

    /**
     * Listen for backend events
     */
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.command) {
                case BackendCommand.ScrapbookLoaded:
                    if (message.state) {
                        setScrapbookRequests(message.state.requests || []);
                        console.log('[Scrapbook] Loaded', message.state.requests?.length || 0, 'requests');
                    }
                    break;
                
                case BackendCommand.ScrapbookUpdated:
                    if (message.state) {
                        setScrapbookRequests(message.state.requests || []);
                        console.log('[Scrapbook] Updated', message.state.requests?.length || 0, 'requests');
                        
                        // Update selected request if it exists in new state
                        if (selectedScrapbookRequest) {
                            const updated = message.state.requests.find(
                                (r: ScrapbookRequest) => r.id === selectedScrapbookRequest.id
                            );
                            if (updated) {
                                setSelectedScrapbookRequest(updated);
                            } else {
                                // Request was deleted
                                setSelectedScrapbookRequest(null);
                            }
                        }
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [selectedScrapbookRequest]);

    /**
     * Load scrapbook from backend
     */
    const loadScrapbook = async () => {
        try {
            setLoading(true);
            const response = await bridge.sendMessageAsync({
                command: FrontendCommand.GetScrapbook
            });
            
            if (response?.state) {
                setScrapbookRequests(response.state.requests || []);
                // Emit loaded event for consistency
                bridge.emit({
                    command: BackendCommand.ScrapbookLoaded,
                    state: response.state
                });
            }
        } catch (error) {
            console.error('[Scrapbook] Failed to load scrapbook:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Refresh scrapbook from backend
     */
    const refreshScrapbook = useCallback(async () => {
        await loadScrapbook();
    }, []);

    /**
     * Create a new scrapbook request with defaults
     */
    const createRequest = useCallback(async () => {
        try {
            const now = new Date().toISOString();
            const newRequest: ScrapbookRequest = {
                id: crypto.randomUUID(),
                name: `Request ${new Date().toLocaleTimeString()}`,
                request: '', // Empty body
                requestType: 'soap',
                method: 'POST',
                bodyType: 'xml',
                contentType: 'application/soap+xml',
                headers: {
                    'Content-Type': 'application/soap+xml'
                },
                endpoint: '',
                createdAt: now,
                lastModified: now
            };

            const response = await bridge.sendMessageAsync({
                command: FrontendCommand.AddScrapbookRequest,
                request: newRequest
            });

            if (response?.state) {
                setScrapbookRequests(response.state.requests || []);
                // Auto-select the new request
                const created = response.state.requests.find((r: ScrapbookRequest) => r.id === newRequest.id);
                if (created) {
                    setSelectedScrapbookRequest(created);
                }
                // Emit updated event
                bridge.emit({
                    command: BackendCommand.ScrapbookUpdated,
                    state: response.state
                });
            }
        } catch (error) {
            console.error('[Scrapbook] Failed to create request:', error);
            throw error;
        }
    }, []);

    /**
     * Update an existing scrapbook request
     */
    const updateRequest = useCallback(async (id: string, updates: Partial<ScrapbookRequest>) => {
        try {
            const response = await bridge.sendMessageAsync({
                command: FrontendCommand.UpdateScrapbookRequest,
                id,
                updates
            });

            if (response?.state) {
                setScrapbookRequests(response.state.requests || []);
                // Update selected if it's the one being updated
                if (selectedScrapbookRequest?.id === id) {
                    const updated = response.state.requests.find((r: ScrapbookRequest) => r.id === id);
                    if (updated) {
                        setSelectedScrapbookRequest(updated);
                    }
                }
                // Emit updated event
                bridge.emit({
                    command: BackendCommand.ScrapbookUpdated,
                    state: response.state
                });
            }
        } catch (error) {
            console.error('[Scrapbook] Failed to update request:', error);
            throw error;
        }
    }, [selectedScrapbookRequest]);

    /**
     * Delete a scrapbook request
     */
    const deleteRequest = useCallback(async (id: string) => {
        try {
            const response = await bridge.sendMessageAsync({
                command: FrontendCommand.DeleteScrapbookRequest,
                id
            });

            if (response?.state) {
                setScrapbookRequests(response.state.requests || []);
                // Clear selection if deleted request was selected
                if (selectedScrapbookRequest?.id === id) {
                    setSelectedScrapbookRequest(null);
                }
                // Emit updated event
                bridge.emit({
                    command: BackendCommand.ScrapbookUpdated,
                    state: response.state
                });
            }
        } catch (error) {
            console.error('[Scrapbook] Failed to delete request:', error);
            throw error;
        }
    }, [selectedScrapbookRequest]);

    /**
     * Select a scrapbook request
     */
    const selectRequest = useCallback((request: ScrapbookRequest | null) => {
        setSelectedScrapbookRequest(request);
    }, []);

    return (
        <ScrapbookContext.Provider
            value={{
                scrapbookRequests,
                selectedScrapbookRequest,
                loading,
                createRequest,
                updateRequest,
                deleteRequest,
                selectRequest,
                refreshScrapbook
            }}
        >
            {children}
        </ScrapbookContext.Provider>
    );
};
