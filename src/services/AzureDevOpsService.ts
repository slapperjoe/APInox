/**
 * AzureDevOpsService.ts
 * 
 * Service for interacting with Azure DevOps REST API.
 * Handles PAT storage, project listing, and work item comments.
 */

import axios from 'axios';
import { ISecretStorage } from '../interfaces';

const SECRET_KEY = 'dirtysoap.azuredevops.pat';

export interface AzureDevOpsProject {
    id: string;
    name: string;
    description?: string;
    url: string;
}

export interface AzureDevOpsConfig {
    orgUrl: string;
    project: string;
}

export class AzureDevOpsService {
    private secretStorage: ISecretStorage;

    constructor(secretStorage: ISecretStorage) {
        this.secretStorage = secretStorage;
    }

    /**
     * Store PAT securely
     */
    async storePat(pat: string): Promise<void> {
        await this.secretStorage.store(SECRET_KEY, pat);
    }

    /**
     * Get stored PAT
     */
    async getPat(): Promise<string | undefined> {
        return await this.secretStorage.get(SECRET_KEY);
    }

    /**
     * Delete stored PAT
     */
    async deletePat(): Promise<void> {
        await this.secretStorage.delete(SECRET_KEY);
    }

    /**
     * Check if PAT is stored
     */
    async hasPat(): Promise<boolean> {
        const pat = await this.getPat();
        return !!pat;
    }

    /**
     * Get Basic auth header value from PAT
     */
    private getAuthHeader(pat: string): string {
        const encoded = Buffer.from(`:${pat}`).toString('base64');
        return `Basic ${encoded}`;
    }

    /**
     * List projects accessible to the user
     */
    async listProjects(orgUrl: string): Promise<AzureDevOpsProject[]> {
        const pat = await this.getPat();
        if (!pat) {
            throw new Error('Azure DevOps PAT not configured');
        }

        // Normalize orgUrl
        const baseUrl = orgUrl.replace(/\/$/, '');
        const url = `${baseUrl}/_apis/projects?api-version=7.0`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': this.getAuthHeader(pat),
                    'Accept': 'application/json'
                }
            });

            return (response.data.value || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                url: p.url
            }));
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Please check your PAT.');
            }
            if (error.response?.status === 404) {
                throw new Error('Organization not found. Please check the URL.');
            }
            throw new Error(`Failed to fetch projects: ${error.message}`);
        }
    }

    /**
     * Test connection to Azure DevOps
     */
    async testConnection(orgUrl: string): Promise<{ success: boolean; message: string }> {
        try {
            const projects = await this.listProjects(orgUrl);
            return {
                success: true,
                message: `Connected! Found ${projects.length} project(s).`
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Add a comment to a work item
     */
    async addWorkItemComment(
        orgUrl: string,
        project: string,
        workItemId: number,
        text: string
    ): Promise<{ success: boolean; message: string }> {
        const pat = await this.getPat();
        if (!pat) {
            return { success: false, message: 'Azure DevOps PAT not configured' };
        }

        const baseUrl = orgUrl.replace(/\/$/, '');
        const url = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.0-preview.3`;

        try {
            await axios.post(url,
                { text },
                {
                    headers: {
                        'Authorization': this.getAuthHeader(pat),
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            return {
                success: true,
                message: `Comment added to work item #${workItemId}`
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return { success: false, message: 'Authentication failed. Please check your PAT.' };
            }
            if (error.response?.status === 404) {
                return { success: false, message: `Work item #${workItemId} not found.` };
            }
            if (error.response?.status === 403) {
                return { success: false, message: 'Access denied. PAT may lack Work Items (Write) permission.' };
            }
            return { success: false, message: `Failed to add comment: ${error.message}` };
        }
    }
}
