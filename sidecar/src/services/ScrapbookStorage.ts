/**
 * ScrapbookStorage.ts
 * 
 * Service for managing scrapbook requests (API Explorer quick requests).
 * Stores requests in ~/.apinox/scrapbook.json for persistence across sessions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ScrapbookRequest, ScrapbookState } from '../../../shared/src/models';
import { DiagnosticService } from './DiagnosticService';

export class ScrapbookStorage {
    private scrapbookPath: string;

    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const configDir = path.join(homeDir, '.apinox');
        
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        this.scrapbookPath = path.join(configDir, 'scrapbook.json');
        this.log(`ScrapbookStorage initialized: ${this.scrapbookPath}`);
    }

    private log(message: string) {
        DiagnosticService.getInstance().log('BACKEND', `[ScrapbookStorage] ${message}`);
    }

    /**
     * Load scrapbook from disk
     */
    public loadScrapbook(): ScrapbookState {
        try {
            if (!fs.existsSync(this.scrapbookPath)) {
                this.log('Scrapbook file does not exist, returning empty state');
                return { requests: [] };
            }

            const content = fs.readFileSync(this.scrapbookPath, 'utf8');
            const state = JSON.parse(content) as ScrapbookState;
            
            this.log(`Loaded scrapbook with ${state.requests.length} request(s)`);
            return state;
        } catch (error: any) {
            this.log(`Error loading scrapbook: ${error.message}. Returning empty state.`);
            return { requests: [] };
        }
    }

    /**
     * Save scrapbook to disk
     */
    public saveScrapbook(state: ScrapbookState): void {
        try {
            const content = JSON.stringify(state, null, 2);
            fs.writeFileSync(this.scrapbookPath, content, 'utf8');
            this.log(`Saved scrapbook with ${state.requests.length} request(s)`);
        } catch (error: any) {
            this.log(`Error saving scrapbook: ${error.message}`);
            throw new Error(`Failed to save scrapbook: ${error.message}`);
        }
    }

    /**
     * Add a new request to scrapbook
     */
    public addRequest(request: ScrapbookRequest): ScrapbookState {
        const state = this.loadScrapbook();
        
        // Ensure timestamps are set
        const now = new Date().toISOString();
        const newRequest: ScrapbookRequest = {
            ...request,
            createdAt: request.createdAt || now,
            lastModified: now
        };
        
        state.requests.push(newRequest);
        this.saveScrapbook(state);
        
        this.log(`Added request: ${newRequest.name} (${newRequest.id})`);
        return state;
    }

    /**
     * Update an existing request
     */
    public updateRequest(id: string, updates: Partial<ScrapbookRequest>): ScrapbookState {
        const state = this.loadScrapbook();
        const index = state.requests.findIndex(r => r.id === id);
        
        if (index === -1) {
            throw new Error(`Request with id ${id} not found`);
        }
        
        // Update request and set lastModified
        state.requests[index] = {
            ...state.requests[index],
            ...updates,
            id, // Preserve ID
            lastModified: new Date().toISOString()
        };
        
        this.saveScrapbook(state);
        this.log(`Updated request: ${state.requests[index].name} (${id})`);
        return state;
    }

    /**
     * Delete a request
     */
    public deleteRequest(id: string): ScrapbookState {
        const state = this.loadScrapbook();
        const index = state.requests.findIndex(r => r.id === id);
        
        if (index === -1) {
            throw new Error(`Request with id ${id} not found`);
        }
        
        const deletedRequest = state.requests[index];
        state.requests.splice(index, 1);
        this.saveScrapbook(state);
        
        this.log(`Deleted request: ${deletedRequest.name} (${id})`);
        return state;
    }

    /**
     * Get a specific request by ID
     */
    public getRequest(id: string): ScrapbookRequest | null {
        const state = this.loadScrapbook();
        const request = state.requests.find(r => r.id === id);
        return request || null;
    }

    /**
     * Get all requests
     */
    public getAllRequests(): ScrapbookRequest[] {
        const state = this.loadScrapbook();
        return state.requests;
    }
}
