import * as fs from 'fs';
import * as path from 'path';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { ApinoxProject } from '../../shared/src/models';
import { DiagnosticService } from './services/DiagnosticService';

export class SoapUIExporter {
    private outputChannel: any = null;

    constructor(outputChannel?: any) {
        this.outputChannel = outputChannel;
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
        }
        DiagnosticService.getInstance().log('BACKEND', `[SoapUIExporter] ${message}`);
    }

    public async exportProject(project: ApinoxProject, filePath: string) {
        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            format: true
        });

        // Map internal structure to SoapUI XML structure
        const soapUiObj = {
            "con:soapui-project": {
                "@_name": project.name,
                "@_soapui-version": "5.7.0",
                "@_xmlns:con": "http://eviware.com/soapui/config",
                "@_xmlns:dirty": "http://github.com/Dev1/APInox",
                "con:interface": project.interfaces.map(iface => ({
                    "@_name": iface.name,
                    "@_type": iface.type || "wsdl",
                    "@_bindingName": iface.bindingName,
                    "@_soapVersion": iface.soapVersion,
                    "@_definition": iface.definition,
                    "con:operation": iface.operations.map(op => ({
                        "@_isOneWay": "false",
                        "@_action": op.action,
                        "@_name": op.name,
                        "@_bindingOperationName": op.name,
                        "@_type": "Request-Response",
                        "@_inputName": "",
                        "@_receiveAuthProfile": "",
                        "@_sendsAttachments": "false",
                        "@_anonymous": "optional",
                        "dirty:inputSchema": op.input ? JSON.stringify(op.input) : undefined, // Save schema for diffing
                        "dirty:targetNamespace": op.targetNamespace, // Save namespace
                        "con:call": op.requests.map(req => ({
                            "@_name": req.name,
                            "con:endpoint": req.endpoint, // Save endpoint
                            "con:request": {
                                "@_mediaType": req.contentType || "text/xml",
                                "@_method": req.method || "POST",
                                "#text": req.request
                            },
                            "con:assertion": req.assertions ? req.assertions.map(a => ({
                                "@_type": a.type,
                                "@_name": a.name || a.type,
                                "@_id": a.id,
                                "con:configuration": {
                                    "token": a.configuration?.token,
                                    "ignoreCase": a.configuration?.ignoreCase,
                                    "sla": a.configuration?.sla,
                                    // XPath specific (simplified for now)
                                    "path": a.configuration?.xpath,
                                    "content": a.configuration?.expectedContent
                                }
                            })) : [],
                            "dirty:headers": req.headers ? Object.entries(req.headers).map(([k, v]) => ({
                                "@_key": k,
                                "@_value": v
                            })) : [],
                            "dirty:requestContent": req.request, // Save raw content here too
                            "dirty:extractors": req.extractors ? req.extractors.map(e => ({
                                "@_type": e.type,
                                "@_source": e.source,
                                "@_path": e.path,
                                "@_variable": e.variable,
                                "@_id": e.id,
                                "@_defaultValue": e.defaultValue
                            })) : undefined,
                            "dirty:wsSecurity": req.wsSecurity ? {
                                "@_type": req.wsSecurity.type,
                                "@_username": req.wsSecurity.username,
                                "@_password": req.wsSecurity.password,
                                "@_passwordType": req.wsSecurity.passwordType,
                                "@_hasNonce": req.wsSecurity.hasNonce,
                                "@_hasCreated": req.wsSecurity.hasCreated,
                                "@_privateKeyPath": req.wsSecurity.privateKeyPath,
                                "@_publicCertPath": req.wsSecurity.publicCertPath
                            } : undefined,
                            "dirty:attachments": req.attachments ? req.attachments.map(att => ({
                                "@_id": att.id,
                                "@_name": att.name,
                                "@_fsPath": att.fsPath,
                                "@_contentId": att.contentId,
                                "@_contentType": att.contentType,
                                "@_type": att.type,
                                "@_size": att.size
                            })) : undefined,
                            "dirty:restConfig": req.restConfig ? {
                                "queryParams": req.restConfig.queryParams ? Object.entries(req.restConfig.queryParams).map(([k, v]) => ({
                                    "@_key": k,
                                    "@_value": v
                                })) : undefined,
                                "pathParams": req.restConfig.pathParams ? Object.entries(req.restConfig.pathParams).map(([k, v]) => ({
                                    "@_key": k,
                                    "@_value": v
                                })) : undefined,
                                "auth": req.restConfig.auth ? {
                                    "@_type": req.restConfig.auth.type,
                                    "@_username": req.restConfig.auth.username,
                                    "@_password": req.restConfig.auth.password,
                                    "@_token": req.restConfig.auth.token,
                                    "@_apiKeyIn": req.restConfig.auth.apiKeyIn,
                                    "@_apiKeyName": req.restConfig.auth.apiKeyName,
                                    "oauth2Config": req.restConfig.auth.oauth2Config ? {
                                        "@_authUrl": req.restConfig.auth.oauth2Config.authUrl,
                                        "@_tokenUrl": req.restConfig.auth.oauth2Config.tokenUrl,
                                        "@_clientId": req.restConfig.auth.oauth2Config.clientId,
                                        "@_clientSecret": req.restConfig.auth.oauth2Config.clientSecret,
                                        "@_scope": req.restConfig.auth.oauth2Config.scope
                                    } : undefined
                                } : undefined
                            } : undefined,
                            "dirty:graphqlConfig": req.graphqlConfig ? {
                                "@_variables": req.graphqlConfig.variables ? JSON.stringify(req.graphqlConfig.variables) : undefined,
                                "@_operationName": req.graphqlConfig.operationName
                            } : undefined
                        }))
                    }))
                }))
                ,
                "con:testSuite": (project.testSuites || []).map(suite => ({
                    "@_name": suite.name,
                    "@_id": suite.id,
                    "con:testCase": suite.testCases.map(tc => ({
                        "@_name": tc.name,
                        "@_id": tc.id,
                        "con:testStep": tc.steps.map(step => ({
                            "@_name": step.name,
                            "@_type": step.type,
                            "@_id": step.id,
                            "con:config": {
                                "request": step.config.request ? {
                                    "@_name": step.config.request.name,
                                    "con:endpoint": step.config.request.endpoint,
                                    "con:request": {
                                        "@_mediaType": step.config.request.contentType || "text/xml",
                                        "@_method": step.config.request.method || "POST",
                                        "#text": step.config.request.request
                                    },
                                    "con:assertion": step.config.request.assertions ? step.config.request.assertions.map(a => ({
                                        "@_type": a.type,
                                        "@_name": a.name || a.type,
                                        "@_id": a.id,
                                        "con:configuration": {
                                            "token": a.configuration?.token,
                                            "ignoreCase": a.configuration?.ignoreCase,
                                            "sla": a.configuration?.sla,
                                            "path": a.configuration?.xpath,
                                            "content": a.configuration?.expectedContent
                                        }
                                    })) : [],
                                    "dirty:headers": step.config.request.headers ? Object.entries(step.config.request.headers).map(([k, v]) => ({
                                        "@_key": k,
                                        "@_value": v
                                    })) : undefined,
                                    "dirty:extractors": step.config.request.extractors ? step.config.request.extractors.map(e => ({
                                        "@_type": e.type,
                                        "@_source": e.source,
                                        "@_path": e.path,
                                        "@_variable": e.variable,
                                        "@_id": e.id,
                                        "@_defaultValue": e.defaultValue
                                    })) : undefined,
                                    "dirty:wsSecurity": step.config.request.wsSecurity ? {
                                        "@_type": step.config.request.wsSecurity.type,
                                        "@_username": step.config.request.wsSecurity.username,
                                        "@_password": step.config.request.wsSecurity.password,
                                        "@_passwordType": step.config.request.wsSecurity.passwordType,
                                        "@_hasNonce": step.config.request.wsSecurity.hasNonce,
                                        "@_hasCreated": step.config.request.wsSecurity.hasCreated,
                                        "@_privateKeyPath": step.config.request.wsSecurity.privateKeyPath,
                                        "@_publicCertPath": step.config.request.wsSecurity.publicCertPath
                                    } : undefined,
                                    "dirty:attachments": step.config.request.attachments ? step.config.request.attachments.map(att => ({
                                        "@_id": att.id,
                                        "@_name": att.name,
                                        "@_fsPath": att.fsPath,
                                        "@_contentId": att.contentId,
                                        "@_contentType": att.contentType,
                                        "@_type": att.type,
                                        "@_size": att.size
                                    })) : undefined,
                                    "dirty:restConfig": step.config.request.restConfig ? {
                                        "queryParams": step.config.request.restConfig.queryParams ? Object.entries(step.config.request.restConfig.queryParams).map(([k, v]) => ({
                                            "@_key": k,
                                            "@_value": v
                                        })) : undefined,
                                        "pathParams": step.config.request.restConfig.pathParams ? Object.entries(step.config.request.restConfig.pathParams).map(([k, v]) => ({
                                            "@_key": k,
                                            "@_value": v
                                        })) : undefined,
                                        "auth": step.config.request.restConfig.auth ? {
                                            "@_type": step.config.request.restConfig.auth.type,
                                            "@_username": step.config.request.restConfig.auth.username,
                                            "@_password": step.config.request.restConfig.auth.password,
                                            "@_token": step.config.request.restConfig.auth.token,
                                            "@_apiKeyIn": step.config.request.restConfig.auth.apiKeyIn,
                                            "@_apiKeyName": step.config.request.restConfig.auth.apiKeyName,
                                            "oauth2Config": step.config.request.restConfig.auth.oauth2Config ? {
                                                "@_authUrl": step.config.request.restConfig.auth.oauth2Config.authUrl,
                                                "@_tokenUrl": step.config.request.restConfig.auth.oauth2Config.tokenUrl,
                                                "@_clientId": step.config.request.restConfig.auth.oauth2Config.clientId,
                                                "@_clientSecret": step.config.request.restConfig.auth.oauth2Config.clientSecret,
                                                "@_scope": step.config.request.restConfig.auth.oauth2Config.scope
                                            } : undefined
                                        } : undefined
                                    } : undefined,
                                    "dirty:graphqlConfig": step.config.request.graphqlConfig ? {
                                        "@_variables": step.config.request.graphqlConfig.variables ? JSON.stringify(step.config.request.graphqlConfig.variables) : undefined,
                                        "@_operationName": step.config.request.graphqlConfig.operationName
                                    } : undefined
                                } : undefined,
                                "delay": step.config.delayMs !== undefined ? { "@_ms": step.config.delayMs } : undefined,
                                "transfer": step.config.sourceStepId ? {
                                    "@_sourceStepId": step.config.sourceStepId,
                                    "@_sourceProperty": step.config.sourceProperty,
                                    "@_sourcePath": step.config.sourcePath,
                                    "@_targetStepId": step.config.targetStepId,
                                    "@_targetProperty": step.config.targetProperty,
                                    "@_targetPath": step.config.targetPath
                                } : undefined,
                                "script": step.config.scriptName || step.config.scriptContent ? (() => {
                                    if (step.config.scriptContent) {
                                        this.log(`Saving script content for ${step.name}. Length: ${step.config.scriptContent.length}`);
                                    } else {
                                        this.log(`No script content found for ${step.name}`);
                                    }
                                    return {
                                        "@_name": step.config.scriptName,
                                        "#text": step.config.scriptContent
                                    };
                                })() : undefined
                            }
                        }))
                    }))
                }))
                ,
                // Folders - user-created organizational structure
                "dirty:folder": (project.folders || []).map(folder => this.serializeFolder(folder))
            }
        };

        const xmlContent = builder.build(soapUiObj);
        fs.writeFileSync(filePath, xmlContent);
        this.log(`Project exported to ${filePath}`);
    }

    private serializeFolder(folder: any): any {
        return {
            "@_id": folder.id,
            "@_name": folder.name,
            "@_expanded": folder.expanded !== false,
            "dirty:request": (folder.requests || []).map((req: any) => ({
                "@_id": req.id,
                "@_name": req.name,
                "@_requestType": req.requestType || 'rest',
                "@_method": req.method || 'GET',
                "@_bodyType": req.bodyType,
                "con:endpoint": req.endpoint,
                "con:request": {
                    "@_mediaType": req.contentType || "application/json",
                    "#text": req.request || ""
                },
                "dirty:headers": req.headers ? Object.entries(req.headers).map(([k, v]) => ({
                    "@_key": k,
                    "@_value": v
                })) : [],
                "dirty:extractors": req.extractors ? req.extractors.map((e: any) => ({
                    "@_type": e.type,
                    "@_source": e.source,
                    "@_path": e.path,
                    "@_variable": e.variable,
                    "@_id": e.id,
                    "@_defaultValue": e.defaultValue
                })) : undefined,
                "dirty:wsSecurity": req.wsSecurity ? {
                    "@_type": req.wsSecurity.type,
                    "@_username": req.wsSecurity.username,
                    "@_password": req.wsSecurity.password,
                    "@_passwordType": req.wsSecurity.passwordType,
                    "@_hasNonce": req.wsSecurity.hasNonce,
                    "@_hasCreated": req.wsSecurity.hasCreated,
                    "@_privateKeyPath": req.wsSecurity.privateKeyPath,
                    "@_publicCertPath": req.wsSecurity.publicCertPath
                } : undefined,
                "dirty:attachments": req.attachments ? req.attachments.map((att: any) => ({
                    "@_id": att.id,
                    "@_name": att.name,
                    "@_fsPath": att.fsPath,
                    "@_contentId": att.contentId,
                    "@_contentType": att.contentType,
                    "@_type": att.type,
                    "@_size": att.size
                })) : undefined,
                "dirty:restConfig": req.restConfig ? {
                    "queryParams": req.restConfig.queryParams ? Object.entries(req.restConfig.queryParams).map(([k, v]) => ({
                        "@_key": k,
                        "@_value": v
                    })) : undefined,
                    "pathParams": req.restConfig.pathParams ? Object.entries(req.restConfig.pathParams).map(([k, v]) => ({
                        "@_key": k,
                        "@_value": v
                    })) : undefined,
                    "auth": req.restConfig.auth ? {
                        "@_type": req.restConfig.auth.type,
                        "@_username": req.restConfig.auth.username,
                        "@_password": req.restConfig.auth.password,
                        "@_token": req.restConfig.auth.token,
                        "@_apiKeyIn": req.restConfig.auth.apiKeyIn,
                        "@_apiKeyName": req.restConfig.auth.apiKeyName,
                        "oauth2Config": req.restConfig.auth.oauth2Config ? {
                            "@_authUrl": req.restConfig.auth.oauth2Config.authUrl,
                            "@_tokenUrl": req.restConfig.auth.oauth2Config.tokenUrl,
                            "@_clientId": req.restConfig.auth.oauth2Config.clientId,
                            "@_clientSecret": req.restConfig.auth.oauth2Config.clientSecret,
                            "@_scope": req.restConfig.auth.oauth2Config.scope
                        } : undefined
                    } : undefined
                } : undefined,
                "dirty:graphqlConfig": req.graphqlConfig ? {
                    "@_variables": req.graphqlConfig.variables ? JSON.stringify(req.graphqlConfig.variables) : undefined,
                    "@_operationName": req.graphqlConfig.operationName
                } : undefined
            })),
            "dirty:folder": (folder.folders || []).map((f: any) => this.serializeFolder(f))
        };
    }

    public async importProject(filePath: string): Promise<ApinoxProject> {
        this.log(`Importing project from: ${filePath}`);
        let xmlContent = '';
        try {
            xmlContent = fs.readFileSync(filePath, 'utf8');
        } catch (e: any) {
            this.log(`Failed to read file ${filePath}: ${e.message}`);
            throw e;
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            isArray: (name) => {
                return ["con:interface", "con:operation", "con:call", "con:request", "con:assertion", "con:testSuite", "con:testCase", "con:testStep", "dirty:folder", "dirty:request"].indexOf(name) !== -1;
            }
        });
        const result = parser.parse(xmlContent);
        const projectRoot = result["con:soapui-project"];

        if (!projectRoot) {
            this.log(`Invalid SoapUI project structure. Root 'con:soapui-project' not found in ${filePath}`);
            // Check what WAS parsed?
            this.log(`Parsed keys: ${Object.keys(result).join(', ')}`);
            throw new Error("Invalid SoapUI project file");
        }

        let name = projectRoot["@_name"];
        this.log(`Original project name from XML: ${name}`);

        // If name looks like a path (contains slashes) or is empty, use filename
        if (!name || name.includes('/') || name.includes('\\')) {
            const newName = path.basename(filePath, path.extname(filePath));
            this.log(`Project name looks like path. Renaming to: ${newName}`);
            name = newName;
        } else {
            this.log(`Keeping original project name: ${name}`);
        }

        const project: ApinoxProject = {
            name: name,
            interfaces: [],
            testSuites: []
        };

        if (projectRoot["con:interface"]) {
            const interfaces = Array.isArray(projectRoot["con:interface"]) ? projectRoot["con:interface"] : [projectRoot["con:interface"]];

            project.interfaces = interfaces.map((iface: any) => ({
                name: iface["@_name"],
                type: iface["@_type"],
                bindingName: iface["@_bindingName"],
                soapVersion: iface["@_soapui-version"],
                definition: iface["@_definition"],
                operations: iface["con:operation"] ? (Array.isArray(iface["con:operation"]) ? iface["con:operation"] : [iface["con:operation"]]).map((op: any) => ({
                    name: op["@_name"],
                    action: op["@_action"],
                    input: op["dirty:inputSchema"] ? JSON.parse(op["dirty:inputSchema"]) : undefined, // Restore schema
                    targetNamespace: op["dirty:targetNamespace"], // Restore namespace
                    requests: op["con:call"] ? (Array.isArray(op["con:call"]) ? op["con:call"] : [op["con:call"]]).map((req: any) => ({
                        name: req["@_name"],
                        endpoint: req["con:endpoint"], // Load endpoint
                        contentType: (req["con:request"] && req["con:request"]["@_mediaType"]) || "application/soap+xml",
                        method: req["con:request"] && req["con:request"]["@_method"],
                        request: (() => {
                            // Check for dirty:requestContent first
                            const dirtyContent = req["dirty:requestContent"];
                            if (dirtyContent) return dirtyContent;

                            const r = req["con:request"];
                            if (!r) return "";
                            let content = "";
                            if (Array.isArray(r)) {
                                content = r[0]["#text"] || r[0];
                            } else if (typeof r === 'object' && r["#text"]) {
                                content = r["#text"];
                            } else if (typeof r === 'string') {
                                content = r;
                            }
                            // Strip \r (and potentially literal '\r' if user sees them as text)
                            return content ? content.replace(/\\r/g, '').replace(/\r/g, '') : "";
                        })(),
                        assertions: req["con:assertion"] ? (Array.isArray(req["con:assertion"]) ? req["con:assertion"] : [req["con:assertion"]]).map((a: any) => ({
                            type: a["@_type"],
                            name: a["@_name"],
                            id: a["@_id"],
                            configuration: a["con:configuration"] ? {
                                token: a["con:configuration"]["token"],
                                ignoreCase: a["con:configuration"]["ignoreCase"] === 'true' || a["con:configuration"]["ignoreCase"] === true,
                                sla: a["con:configuration"]["sla"],
                                xpath: a["con:configuration"]["path"],
                                expectedContent: a["con:configuration"]["content"]
                            } : {}
                        })) : [],
                        headers: req["dirty:headers"] ? (Array.isArray(req["dirty:headers"]) ? req["dirty:headers"] : [req["dirty:headers"]]).reduce((acc: any, curr: any) => {
                            acc[curr["@_key"]] = curr["@_value"];
                            return acc;
                        }, {}) : {},
                        extractors: req["dirty:extractors"] ? (Array.isArray(req["dirty:extractors"]) ? req["dirty:extractors"] : [req["dirty:extractors"]]).map((e: any) => ({
                            type: e["@_type"],
                            source: e["@_source"],
                            path: e["@_path"],
                            variable: e["@_variable"],
                            id: e["@_id"],
                            defaultValue: e["@_defaultValue"]
                        })) : undefined,
                        wsSecurity: req["dirty:wsSecurity"] ? {
                            type: req["dirty:wsSecurity"]["@_type"],
                            username: req["dirty:wsSecurity"]["@_username"],
                            password: req["dirty:wsSecurity"]["@_password"],
                            passwordType: req["dirty:wsSecurity"]["@_passwordType"],
                            hasNonce: req["dirty:wsSecurity"]["@_hasNonce"],
                            hasCreated: req["dirty:wsSecurity"]["@_hasCreated"],
                            privateKeyPath: req["dirty:wsSecurity"]["@_privateKeyPath"],
                            publicCertPath: req["dirty:wsSecurity"]["@_publicCertPath"]
                        } : undefined,
                        attachments: req["dirty:attachments"] ? (Array.isArray(req["dirty:attachments"]) ? req["dirty:attachments"] : [req["dirty:attachments"]]).map((att: any) => ({
                            id: att["@_id"],
                            name: att["@_name"],
                            fsPath: att["@_fsPath"],
                            contentId: att["@_contentId"],
                            contentType: att["@_contentType"],
                            type: att["@_type"],
                            size: att["@_size"]
                        })) : undefined,
                        restConfig: req["dirty:restConfig"] ? {
                            queryParams: req["dirty:restConfig"]["queryParams"] ? (Array.isArray(req["dirty:restConfig"]["queryParams"]) ? req["dirty:restConfig"]["queryParams"] : [req["dirty:restConfig"]["queryParams"]]).reduce((acc: any, curr: any) => {
                                acc[curr["@_key"]] = curr["@_value"];
                                return acc;
                            }, {}) : undefined,
                            pathParams: req["dirty:restConfig"]["pathParams"] ? (Array.isArray(req["dirty:restConfig"]["pathParams"]) ? req["dirty:restConfig"]["pathParams"] : [req["dirty:restConfig"]["pathParams"]]).reduce((acc: any, curr: any) => {
                                acc[curr["@_key"]] = curr["@_value"];
                                return acc;
                            }, {}) : undefined,
                            auth: req["dirty:restConfig"]["auth"] ? {
                                type: req["dirty:restConfig"]["auth"]["@_type"],
                                username: req["dirty:restConfig"]["auth"]["@_username"],
                                password: req["dirty:restConfig"]["auth"]["@_password"],
                                token: req["dirty:restConfig"]["auth"]["@_token"],
                                apiKeyIn: req["dirty:restConfig"]["auth"]["@_apiKeyIn"],
                                apiKeyName: req["dirty:restConfig"]["auth"]["@_apiKeyName"],
                                oauth2Config: req["dirty:restConfig"]["auth"]["oauth2Config"] ? {
                                    authUrl: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_authUrl"],
                                    tokenUrl: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_tokenUrl"],
                                    clientId: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientId"],
                                    clientSecret: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientSecret"],
                                    scope: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_scope"]
                                } : undefined
                            } : undefined
                        } : undefined,
                        graphqlConfig: req["dirty:graphqlConfig"] ? {
                            variables: req["dirty:graphqlConfig"]["@_variables"] ? JSON.parse(req["dirty:graphqlConfig"]["@_variables"]) : undefined,
                            operationName: req["dirty:graphqlConfig"]["@_operationName"]
                        } : undefined
                    })) : []
                })) : []
            }));
        }

        if (projectRoot["con:testSuite"]) {
            const suites = Array.isArray(projectRoot["con:testSuite"]) ? projectRoot["con:testSuite"] : [projectRoot["con:testSuite"]];
            project.testSuites = suites.map((suite: any) => ({
                id: suite["@_id"] || `suite-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
                name: suite["@_name"],
                testCases: suite["con:testCase"] ? (Array.isArray(suite["con:testCase"]) ? suite["con:testCase"] : [suite["con:testCase"]]).map((tc: any) => ({
                    id: tc["@_id"] || `tc-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
                    name: tc["@_name"],
                    steps: tc["con:testStep"] ? (Array.isArray(tc["con:testStep"]) ? tc["con:testStep"] : [tc["con:testStep"]]).map((step: any) => {
                        const cfg = step["con:config"] || {};
                        const type = step["@_type"]; // 'request', 'delay', etc.

                        // Parse Config based on Type
                        const parsedConfig: Record<string, unknown> = {};

                        if (type === 'request' && cfg["request"]) {
                            const r = cfg["request"];
                            parsedConfig.request = {
                                name: r["@_name"],
                                endpoint: r["con:endpoint"],
                                contentType: r["con:request"] && r["con:request"]["@_mediaType"],
                                method: r["con:request"] && r["con:request"]["@_method"],
                                request: r["con:request"] && (r["con:request"]["#text"] || r["con:request"]),
                                assertions: r["con:assertion"] ? (Array.isArray(r["con:assertion"]) ? r["con:assertion"] : [r["con:assertion"]]).map((a: any) => ({
                                    type: a["@_type"],
                                    name: a["@_name"],
                                    id: a["@_id"],
                                    configuration: a["con:configuration"] // Map props individually if strictness needed
                                })) : [],
                                headers: r["dirty:headers"] ? (Array.isArray(r["dirty:headers"]) ? r["dirty:headers"] : [r["dirty:headers"]]).reduce((acc: any, curr: any) => {
                                    acc[curr["@_key"]] = curr["@_value"];
                                    return acc;
                                }, {}) : undefined,
                                extractors: r["dirty:extractors"] ? (Array.isArray(r["dirty:extractors"]) ? r["dirty:extractors"] : [r["dirty:extractors"]]).map((e: any) => ({
                                    type: e["@_type"],
                                    source: e["@_source"],
                                    path: e["@_path"],
                                    variable: e["@_variable"],
                                    id: e["@_id"],
                                    defaultValue: e["@_defaultValue"]
                                })) : undefined,
                                wsSecurity: r["dirty:wsSecurity"] ? {
                                    type: r["dirty:wsSecurity"]["@_type"],
                                    username: r["dirty:wsSecurity"]["@_username"],
                                    password: r["dirty:wsSecurity"]["@_password"],
                                    passwordType: r["dirty:wsSecurity"]["@_passwordType"],
                                    hasNonce: r["dirty:wsSecurity"]["@_hasNonce"],
                                    hasCreated: r["dirty:wsSecurity"]["@_hasCreated"],
                                    privateKeyPath: r["dirty:wsSecurity"]["@_privateKeyPath"],
                                    publicCertPath: r["dirty:wsSecurity"]["@_publicCertPath"]
                                } : undefined,
                                attachments: r["dirty:attachments"] ? (Array.isArray(r["dirty:attachments"]) ? r["dirty:attachments"] : [r["dirty:attachments"]]).map((att: any) => ({
                                    id: att["@_id"],
                                    name: att["@_name"],
                                    fsPath: att["@_fsPath"],
                                    contentId: att["@_contentId"],
                                    contentType: att["@_contentType"],
                                    type: att["@_type"],
                                    size: att["@_size"]
                                })) : undefined,
                                restConfig: r["dirty:restConfig"] ? {
                                    queryParams: r["dirty:restConfig"]["queryParams"] ? (Array.isArray(r["dirty:restConfig"]["queryParams"]) ? r["dirty:restConfig"]["queryParams"] : [r["dirty:restConfig"]["queryParams"]]).reduce((acc: any, curr: any) => {
                                        acc[curr["@_key"]] = curr["@_value"];
                                        return acc;
                                    }, {}) : undefined,
                                    pathParams: r["dirty:restConfig"]["pathParams"] ? (Array.isArray(r["dirty:restConfig"]["pathParams"]) ? r["dirty:restConfig"]["pathParams"] : [r["dirty:restConfig"]["pathParams"]]).reduce((acc: any, curr: any) => {
                                        acc[curr["@_key"]] = curr["@_value"];
                                        return acc;
                                    }, {}) : undefined,
                                    auth: r["dirty:restConfig"]["auth"] ? {
                                        type: r["dirty:restConfig"]["auth"]["@_type"],
                                        username: r["dirty:restConfig"]["auth"]["@_username"],
                                        password: r["dirty:restConfig"]["auth"]["@_password"],
                                        token: r["dirty:restConfig"]["auth"]["@_token"],
                                        apiKeyIn: r["dirty:restConfig"]["auth"]["@_apiKeyIn"],
                                        apiKeyName: r["dirty:restConfig"]["auth"]["@_apiKeyName"],
                                        oauth2Config: r["dirty:restConfig"]["auth"]["oauth2Config"] ? {
                                            authUrl: r["dirty:restConfig"]["auth"]["oauth2Config"]["@_authUrl"],
                                            tokenUrl: r["dirty:restConfig"]["auth"]["oauth2Config"]["@_tokenUrl"],
                                            clientId: r["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientId"],
                                            clientSecret: r["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientSecret"],
                                            scope: r["dirty:restConfig"]["auth"]["oauth2Config"]["@_scope"]
                                        } : undefined
                                    } : undefined
                                } : undefined,
                                graphqlConfig: r["dirty:graphqlConfig"] ? {
                                    variables: r["dirty:graphqlConfig"]["@_variables"] ? JSON.parse(r["dirty:graphqlConfig"]["@_variables"]) : undefined,
                                    operationName: r["dirty:graphqlConfig"]["@_operationName"]
                                } : undefined
                            };
                        } else if (type === 'delay' && cfg["delay"]) {
                            parsedConfig.delayMs = parseInt(cfg["delay"]["@_ms"] || "0");
                        } else if (type === 'transfer' && cfg["transfer"]) {
                            const t = cfg["transfer"];
                            parsedConfig.sourceStepId = t["@_sourceStepId"];
                            parsedConfig.sourceProperty = t["@_sourceProperty"];
                            parsedConfig.sourcePath = t["@_sourcePath"];
                            parsedConfig.targetStepId = t["@_targetStepId"];
                            parsedConfig.targetProperty = t["@_targetProperty"];
                            parsedConfig.targetPath = t["@_targetPath"];
                        } else if (type === 'script' && cfg["script"]) {
                            parsedConfig.scriptName = cfg["script"]["@_name"];
                            // Handle script content (could be simple string or object with #text)
                            const s = cfg["script"];
                            if (typeof s === 'string') {
                                parsedConfig.scriptContent = s;
                            } else if (s["#text"]) {
                                parsedConfig.scriptContent = s["#text"];
                            }
                            this.log(`Loaded script step '${step["@_name"]}': Content found: ${!!parsedConfig.scriptContent}, Raw type: ${typeof s}`);
                        }

                        return {
                            id: step["@_id"] || `step-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
                            name: step["@_name"],
                            type: type,
                            config: parsedConfig
                        };
                    }) : []
                })) : []
            }));
        }

        // Parse folders (user-created organizational structure)
        if (projectRoot["dirty:folder"]) {
            const folders = Array.isArray(projectRoot["dirty:folder"]) ? projectRoot["dirty:folder"] : [projectRoot["dirty:folder"]];
            project.folders = folders.map((f: any) => this.deserializeFolder(f));
        }

        return project;
    }

    private deserializeFolder(folder: any): any {
        return {
            id: folder["@_id"],
            name: folder["@_name"],
            expanded: folder["@_expanded"] !== 'false' && folder["@_expanded"] !== false,
            requests: folder["dirty:request"] ? (Array.isArray(folder["dirty:request"]) ? folder["dirty:request"] : [folder["dirty:request"]]).map((req: any) => ({
                id: req["@_id"],
                name: req["@_name"],
                requestType: req["@_requestType"] || 'rest',
                method: req["@_method"] || 'GET',
                bodyType: req["@_bodyType"],
                endpoint: req["con:endpoint"],
                contentType: req["con:request"]?.["@_mediaType"] || "application/json",
                request: req["con:request"]?.["#text"] || "",
                headers: req["dirty:headers"] ? (Array.isArray(req["dirty:headers"]) ? req["dirty:headers"] : [req["dirty:headers"]]).reduce((acc: any, curr: any) => {
                    acc[curr["@_key"]] = curr["@_value"];
                    return acc;
                }, {}) : {},
                extractors: req["dirty:extractors"] ? (Array.isArray(req["dirty:extractors"]) ? req["dirty:extractors"] : [req["dirty:extractors"]]).map((e: any) => ({
                    type: e["@_type"],
                    source: e["@_source"],
                    path: e["@_path"],
                    variable: e["@_variable"],
                    id: e["@_id"],
                    defaultValue: e["@_defaultValue"]
                })) : undefined,
                wsSecurity: req["dirty:wsSecurity"] ? {
                    type: req["dirty:wsSecurity"]["@_type"],
                    username: req["dirty:wsSecurity"]["@_username"],
                    password: req["dirty:wsSecurity"]["@_password"],
                    passwordType: req["dirty:wsSecurity"]["@_passwordType"],
                    hasNonce: req["dirty:wsSecurity"]["@_hasNonce"],
                    hasCreated: req["dirty:wsSecurity"]["@_hasCreated"],
                    privateKeyPath: req["dirty:wsSecurity"]["@_privateKeyPath"],
                    publicCertPath: req["dirty:wsSecurity"]["@_publicCertPath"]
                } : undefined,
                attachments: req["dirty:attachments"] ? (Array.isArray(req["dirty:attachments"]) ? req["dirty:attachments"] : [req["dirty:attachments"]]).map((att: any) => ({
                    id: att["@_id"],
                    name: att["@_name"],
                    fsPath: att["@_fsPath"],
                    contentId: att["@_contentId"],
                    contentType: att["@_contentType"],
                    type: att["@_type"],
                    size: att["@_size"]
                })) : undefined,
                restConfig: req["dirty:restConfig"] ? {
                    queryParams: req["dirty:restConfig"]["queryParams"] ? (Array.isArray(req["dirty:restConfig"]["queryParams"]) ? req["dirty:restConfig"]["queryParams"] : [req["dirty:restConfig"]["queryParams"]]).reduce((acc: any, curr: any) => {
                        acc[curr["@_key"]] = curr["@_value"];
                        return acc;
                    }, {}) : undefined,
                    pathParams: req["dirty:restConfig"]["pathParams"] ? (Array.isArray(req["dirty:restConfig"]["pathParams"]) ? req["dirty:restConfig"]["pathParams"] : [req["dirty:restConfig"]["pathParams"]]).reduce((acc: any, curr: any) => {
                        acc[curr["@_key"]] = curr["@_value"];
                        return acc;
                    }, {}) : undefined,
                    auth: req["dirty:restConfig"]["auth"] ? {
                        type: req["dirty:restConfig"]["auth"]["@_type"],
                        username: req["dirty:restConfig"]["auth"]["@_username"],
                        password: req["dirty:restConfig"]["auth"]["@_password"],
                        token: req["dirty:restConfig"]["auth"]["@_token"],
                        apiKeyIn: req["dirty:restConfig"]["auth"]["@_apiKeyIn"],
                        apiKeyName: req["dirty:restConfig"]["auth"]["@_apiKeyName"],
                        oauth2Config: req["dirty:restConfig"]["auth"]["oauth2Config"] ? {
                            authUrl: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_authUrl"],
                            tokenUrl: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_tokenUrl"],
                            clientId: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientId"],
                            clientSecret: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_clientSecret"],
                            scope: req["dirty:restConfig"]["auth"]["oauth2Config"]["@_scope"]
                        } : undefined
                    } : undefined
                } : undefined,
                graphqlConfig: req["dirty:graphqlConfig"] ? {
                    variables: req["dirty:graphqlConfig"]["@_variables"] ? JSON.parse(req["dirty:graphqlConfig"]["@_variables"]) : undefined,
                    operationName: req["dirty:graphqlConfig"]["@_operationName"]
                } : undefined
            })) : [],
            folders: folder["dirty:folder"] ? (Array.isArray(folder["dirty:folder"]) ? folder["dirty:folder"] : [folder["dirty:folder"]]).map((f: any) => this.deserializeFolder(f)) : []
        };
    }

    public async exportWorkspace(projects: any[], filePath: string) {
        // Debug logging - use console.log for immediate output
        console.log(`[SoapUIExporter] [ExportWorkspace] Received ${projects.length} project(s)`);
        projects.forEach((p, idx) => {
            console.log(`[SoapUIExporter]   Project ${idx}: name="${p.name}", interfaces=${p.interfaces?.length || 0}, testSuites=${p.testSuites?.length || 0}, folders=${p.folders?.length || 0}`);
            if (p.interfaces && p.interfaces.length > 0) {
                p.interfaces.forEach((iface: any, ifaceIdx: number) => {
                    console.log(`[SoapUIExporter]     Interface ${ifaceIdx}: name="${iface.name}", operations=${iface.operations?.length || 0}`);
                    if (iface.operations && iface.operations.length > 0) {
                        iface.operations.forEach((op: any, opIdx: number) => {
                            console.log(`[SoapUIExporter]       Operation ${opIdx}: name="${op.name}", requests=${op.requests?.length || 0}`);
                        });
                    }
                });
            }
        });
        
        // Create a simple JSON workspace with all project data embedded
        // All XML content (SOAP requests, etc.) is automatically escaped by JSON.stringify
        const workspace = {
            version: "1.0",
            name: path.basename(filePath, path.extname(filePath)),
            exportedAt: new Date().toISOString(),
            projects: projects.map(p => ({
                name: p.name,
                interfaces: p.interfaces || [],
                testSuites: p.testSuites || [],
                folders: p.folders || [],
                // Store original fileName for reference (won't be used on import)
                _originalPath: p.fileName
            }))
        };

        console.log(`[SoapUIExporter] [ExportWorkspace] Workspace structure preview: ${JSON.stringify(workspace, null, 2).substring(0, 500)}...`);

        // JSON.stringify automatically handles escaping of:
        // - XML content in request bodies
        // - Special characters in strings
        // - Nested objects and arrays
        const jsonContent = JSON.stringify(workspace, null, 2);
        
        console.log(`[SoapUIExporter] [ExportWorkspace] JSON content length: ${jsonContent.length} bytes`);
        
        // If .apinox extension, use compressed format
        if (filePath.endsWith('.apinox')) {
            const zlib = require('zlib');
            const compressed = zlib.gzipSync(jsonContent);
            console.log(`[SoapUIExporter] [ExportWorkspace] Compressed size: ${compressed.length} bytes`);
            fs.writeFileSync(filePath, compressed);
            this.log(`Workspace exported to ${filePath} (compressed, ${projects.length} project(s))`);
        } else {
            // Plain JSON for .json extension
            fs.writeFileSync(filePath, jsonContent);
            this.log(`Workspace exported to ${filePath} (JSON, ${projects.length} project(s))`);
        }
    }

    public async importWorkspace(filePath: string): Promise<ApinoxProject[]> {
        // Check if it's a directory (project folder) or a file (workspace export)
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
            // It's a project folder - load as single project
            this.log(`Loading single project from folder: ${filePath}`);
            const { FolderProjectStorage } = require('./FolderProjectStorage');
            const storage = new FolderProjectStorage();
            const project = await storage.loadProject(filePath);
            (project as any).fileName = filePath;
            return [project];
        }
        
        // It's a file - check extension to determine format
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.apinox') {
            // Compressed APInox workspace format
            const zlib = require('zlib');
            const compressed = fs.readFileSync(filePath);
            const jsonContent = zlib.gunzipSync(compressed).toString('utf8');
            const workspace = JSON.parse(jsonContent);
            
            this.log(`Imported APInox workspace: ${workspace.name} (${workspace.projects.length} project(s))`);
            return workspace.projects;
        } else if (ext === '.json') {
            // Plain JSON workspace format
            const jsonContent = fs.readFileSync(filePath, 'utf8');
            const workspace = JSON.parse(jsonContent);
            
            this.log(`Imported JSON workspace: ${workspace.name} (${workspace.projects.length} project(s))`);
            return workspace.projects;
        } else {
            // Legacy XML workspace format (with project references)
            const xmlContent = fs.readFileSync(filePath, 'utf8');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                isArray: (name) => name === "con:project"
            });
            const result = parser.parse(xmlContent);
            const wsRoot = result["con:soapui-workspace"];
            if (!wsRoot) throw new Error("Invalid SoapUI workspace file");

            const projects: ApinoxProject[] = [];
            const workspaceDir = path.dirname(filePath);

            if (wsRoot["con:project"]) {
                const projectRefs = Array.isArray(wsRoot["con:project"]) ? wsRoot["con:project"] : [wsRoot["con:project"]];

                for (const ref of projectRefs) {
                    // SoapUI 5.8.0+ style: <con:project name="X">path</con:project> -> path is in #text
                    // Older/Other style: <con:project ref="path" /> ? (Unconfirmed, keeps backward compat if possible)
                    let refPath = ref["#text"];
                    if (!refPath) refPath = ref["@_ref"]; // Fallback or alternative format

                    if (!refPath && typeof ref === 'string') {
                        refPath = ref; // Handle case where it might be just a string without attributes
                    }

                    if (!refPath) {
                        this.log(`Skipping project reference: Unable to determine path from ${JSON.stringify(ref)}`);
                        continue;
                    }

                    const projectPath = path.resolve(workspaceDir, refPath);

                    if (fs.existsSync(projectPath)) {
                        try {
                            const project = await this.importProject(projectPath);
                            (project as any).fileName = projectPath;
                            projects.push(project);
                        } catch (e: any) {
                            this.log(`Error loading project from ${projectPath}: ${e.message}`);
                            if (e.stack) this.log(e.stack);
                        }
                    }
                }
            }
            return projects;
        }
    }
}
