import SwaggerParser = require('@apidevtools/swagger-parser');
import { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { ApiService, ServiceOperation, ApinoxProject, ApinoxFolder, ApiRequest, HttpMethod, RequestType, BodyType, ApiInterface, ApiOperation } from '../shared/src/models';
import { v4 as uuidv4 } from 'uuid';

export class OpenApiParser {
    private outputChannel: any = null;

    constructor(outputChannel?: any) {
        this.outputChannel = outputChannel;
    }

    private log(message: string, data?: any) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [OpenApiParser] ${message}`);
            if (data) {
                this.outputChannel.appendLine(JSON.stringify(data, null, 2));
            }
        } else {
            console.log(`[OpenApiParser] ${message}`, data || '');
        }
    }

    public async parse(urlOrPath: string): Promise<ApinoxProject> {
        this.log(`Attempting to parse OpenAPI spec: ${urlOrPath}`);

        try {
            const api = await SwaggerParser.validate(urlOrPath);
            this.log('OpenAPI spec validated successfully.');

            const title = api.info.title || 'Untitled API';
            const version = api.info.version || '1.0.0';
            const description = api.info.description || '';

            // Common base URL detection
            let baseUrl = '';
            if (this.isOpenApiV3(api)) {
                if (api.servers && api.servers.length > 0) {
                    baseUrl = api.servers[0].url;
                }
            } else if (this.isOpenApiV2(api)) {
                const scheme = (api.schemes && api.schemes[0]) ? api.schemes[0] : 'http';
                const host = api.host || '';
                const basePath = api.basePath || '';
                if (host) {
                    baseUrl = `${scheme}://${host}${basePath}`;
                } else {
                    baseUrl = basePath;
                }
            }

            // Map standard HTTP methods
            const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

            // We will map Tags to Folders AND Interfaces
            const folders: Record<string, ApinoxFolder> = {};
            const interfaces: Record<string, ApiInterface> = {};

            // Default folder/interface for untagged ops
            const defaultId = uuidv4();
            folders['default'] = {
                id: defaultId,
                name: 'Default',
                requests: [],
            };
            interfaces['default'] = {
                id: defaultId,
                name: 'Default',
                type: 'openapi',
                definition: urlOrPath,
                bindingName: 'REST',
                soapVersion: 'N/A',
                operations: []
            };

            const paths = api.paths || {};
            for (const pathKey of Object.keys(paths)) {
                const pathItem = paths[pathKey];

                for (const method of methods) {
                    const opKey = method.toLowerCase();
                    if (pathItem && (pathItem as any)[opKey]) {
                        const operation = (pathItem as any)[opKey] as OpenAPIV2.OperationObject | OpenAPIV3.OperationObject;

                        const reqName = operation.summary || operation.operationId || `${method} ${pathKey}`;
                        const reqId = operation.operationId || uuidv4();

                        // Determine Target Group (Folder & Interface)
                        let targetKey = 'default';
                        if (operation.tags && operation.tags.length > 0) {
                            const tagName = operation.tags[0]; // Just take first tag for now
                            if (!folders[tagName]) {
                                const tagId = uuidv4();
                                folders[tagName] = {
                                    id: tagId,
                                    name: tagName,
                                    requests: [],
                                };
                                interfaces[tagName] = {
                                    id: tagId,
                                    name: tagName,
                                    type: 'openapi',
                                    definition: urlOrPath,
                                    bindingName: 'REST',
                                    soapVersion: 'N/A',
                                    operations: []
                                };
                            }
                            targetKey = tagName;
                        }

                        // Create Request Object (For folders)
                        const request: ApiRequest = {
                            id: reqId,
                            name: reqName,
                            requestType: 'rest',
                            method: method,
                            endpoint: baseUrl ? `${baseUrl}${pathKey}` : pathKey,
                            headers: {},
                            bodyType: 'json',
                            request: '',
                            // restConfig: { auth: { type: 'inherit' } } 
                        };

                        // Create Operation Object (For interfaces)
                        const apiOperation: ApiOperation = {
                            id: reqId,
                            name: reqName,
                            action: method,
                            targetNamespace: baseUrl,
                            originalEndpoint: baseUrl ? `${baseUrl}${pathKey}` : pathKey,
                            requests: [{ ...request, endpoint: baseUrl ? `${baseUrl}${pathKey}` : pathKey }]
                        };

                        folders[targetKey].requests.push(request);
                        interfaces[targetKey].operations.push(apiOperation);
                    }
                }
            }

            // Convert map to array, excluding empty default if unused
            const finalFolders = Object.values(folders).filter(f => f.name !== 'Default' || f.requests.length > 0);
            const finalInterfaces = Object.values(interfaces).filter(i => i.name !== 'Default' || i.operations.length > 0);

            // Construct Project
            const project: ApinoxProject = {
                id: uuidv4(),
                name: title,
                description: `${version} - ${description}`,
                interfaces: finalInterfaces,
                folders: finalFolders,
                testSuites: [],
                // settings: {}, // Removed
                dirty: false
            };

            return project;
        } catch (err: any) {
            this.log('Error parsing OpenAPI spec:', err);
            throw err;
        }
    }

    private isOpenApiV3(api: any): api is OpenAPIV3.Document {
        return !!api.openapi;
    }

    private isOpenApiV2(api: any): api is OpenAPIV2.Document {
        return !!api.swagger;
    }
}
