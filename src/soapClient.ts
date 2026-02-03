import * as soap from "soap";
import {
  ApiService,
  SchemaNode,
  ApiRequest,
} from "../shared/src/models";
import { HttpClient } from "./services/HttpClient";
import { WsdlParser } from "./WsdlParser";
import { DiagnosticService } from "./services/DiagnosticService";
import { SettingsManager } from "./utils/SettingsManager";
import { IConfigService } from "./interfaces";

export class SoapClient {
  private client: soap.Client | null = null;
  private currentRequest: any = null;
  private outputChannel: any = null;
  private settingsManager: SettingsManager;
  private wsdlParser: WsdlParser;
  private httpClient: HttpClient;
  private configService?: IConfigService;

  constructor(settingsManager: SettingsManager, outputChannel?: any, configService?: IConfigService) {
    this.outputChannel = outputChannel;
    this.settingsManager = settingsManager;
    this.configService = configService;
    // Initial setup - settings will be refreshed on parseWsdl
    this.wsdlParser = new WsdlParser(outputChannel);
    this.httpClient = new HttpClient(settingsManager, outputChannel);
  }

  public getOutputChannel(): any {
    return this.outputChannel;
  }

  public log(message: string, data?: any) {
    // Also pipe to diagnostic service
    DiagnosticService.getInstance().log(
      "BACKEND",
      `[SoapClient] ${message} `,
      data,
    );

    if (this.outputChannel) {
      this.outputChannel.appendLine(
        `[${new Date().toLocaleTimeString()}] ${message} `,
      );
      if (data) {
        this.outputChannel.appendLine(
          typeof data === "string" ? data : JSON.stringify(data, null, 2),
        );
      }
    }
  }

  private getProxySettings() {
    // 1. Check Extension Config
    const config = this.settingsManager.getConfig();
    let proxyUrl = config.network?.proxy;
    let strictSSL = config.network?.strictSSL;

    // 2. Check platform config service (VS Code, Tauri, etc.)
    if (!proxyUrl && this.configService) {
      proxyUrl = this.configService.getProxyUrl();
    }

    // If extension setting is undefined, fall back to platform config.
    // If that is undefined, default true.
    if (strictSSL === undefined && this.configService) {
      strictSSL = this.configService.getStrictSSL();
    }
    if (strictSSL === undefined) {
      strictSSL = true;
    }

    return { proxyUrl, strictSSL };
  }

  async parseWsdl(url: string, localWsdlDir?: string): Promise<ApiService[]> {
    // Refresh settings
    const { proxyUrl, strictSSL } = this.getProxySettings();

    this.log(
      `Configuring WSDL Parser - Proxy: ${proxyUrl || "None"}, StrictSSL: ${strictSSL} `,
    );

    // Re-create parser with latest settings
    this.wsdlParser = new WsdlParser(this.outputChannel, {
      proxyUrl,
      strictSSL,
    });

    const services = await this.wsdlParser.parseWsdl(url, localWsdlDir);
    this.client = this.wsdlParser.getClient();
    return services;
  }

  public getOperationSchema(
    operationName: string,
    portName?: string,
  ): SchemaNode | null {
    return this.wsdlParser.getOperationSchema(operationName, portName);
  }

  cancelRequest() {
    // Cancel unified HttpClient request
    this.httpClient.cancelRequest();

    // Cancel node-soap request
    if (this.currentRequest) {
      try {
        if (typeof this.currentRequest.abort === "function") {
          this.currentRequest.abort();
        }
      } catch (e) {
        console.error("Error cancelling request:", e);
      }
      this.currentRequest = null;
    }
  }

  async executeRequest(
    url: string,
    operation: string,
    args: any,
    headers?: any,
    wsSecurity?: any,
    attachments?: any,
  ): Promise<any> {
    const isRawMode = typeof args === "string" && args.trim().startsWith("<");

    if (!this.client && !isRawMode) {
      this.client = await soap.createClientAsync(url);
    }

    const xmlPayload =
      typeof args === "string"
        ? args
        : (this.client as any)?.wsdl?.objectToDocumentXML
          ? (this.client as any).wsdl.objectToDocumentXML(
            operation,
            args,
            "",
            (this.client as any).wsdl.definitions?.$targetNamespace,
          )
          : JSON.stringify(args);

    return this.executeRawRequest(operation, xmlPayload, headers, url, wsSecurity, attachments);
  }

  public async executeHttpRequest(request: ApiRequest): Promise<any> {
    return this.httpClient.execute(request);
  }

  private async executeRawRequest(
    operation: string,
    xml: string,
    headers: any,
    endpointOverride?: string,
    wsSecurity?: any,
    attachments?: any,
  ): Promise<any> {
    let endpoint = endpointOverride || "";
    let soapAction = "";

    if (this.client) {
      // 1. Find Endpoint from WSDL if missing
      const definitions = (this.client as any).wsdl.definitions;
      if (!endpoint) {
        for (const serviceName in definitions.services) {
          const service = definitions.services[serviceName];
          for (const portName in service.ports) {
            const port = service.ports[portName];
            if (port.location) {
              endpoint = port.location;
              break;
            }
          }
          if (endpoint) break;
        }
      }
      if (!endpoint) {
        endpoint = (this.client as any).wsdl.options.endpoint;
      }

      // 2. Find SOAPAction from WSDL
      for (const bindingName in definitions.bindings) {
        const binding = definitions.bindings[bindingName];
        if (binding.operations && binding.operations[operation]) {
          soapAction = binding.operations[operation].soapAction;
          break;
        }
      }
    }

    if (!endpoint) {
      return {
        success: false,
        error:
          "Invalid URL: Endpoint is missing. Please set the Endpoint in the request configuration.",
        rawResponse: null,
        rawRequest: xml,
        timeTaken: 0,
      };
    }

    // Apply WS-Security if configured
    if (wsSecurity && wsSecurity.type !== 'none') {
      xml = this.applyWSSecurity(xml, wsSecurity);
    }

    // Apply attachments if configured
    if (attachments && attachments.length > 0) {
      return this.executeWithAttachments(endpoint, operation, xml, attachments, headers, soapAction);
    }

    // 3. Prepare Headers
    const requestHeaders: any = {
      "Content-Type": "text/xml;charset=UTF-8",
      ...headers,
    };
    if (soapAction) {
      requestHeaders["SOAPAction"] = soapAction;
    }

    this.log(`Methods: POST ${endpoint} `);
    this.log("Headers:", requestHeaders);
    this.log("Body:", xml);

    const response = await this.httpClient.execute({
      name: operation,
      request: xml,
      endpoint,
      headers: requestHeaders,
      requestType: "soap",
      contentType: requestHeaders["Content-Type"],
    } as ApiRequest);

    return response;
  }

  /**
   * Apply WS-Security header to SOAP envelope
   */
  private applyWSSecurity(xml: string, wsSecurityConfig: any): string {
    try {
      if (wsSecurityConfig.type === 'usernameToken') {
        const { username, password, passwordType, hasNonce, hasCreated } = wsSecurityConfig;
        
        if (!username || !password) {
          this.log('[WS-Security] Username or password missing, skipping security header');
          return xml;
        }

        // Create WSSecurity instance from soap package
        const wsSecurity = new soap.WSSecurity(username, password, {
          hasNonce: hasNonce !== false,
          hasTimeStamp: hasCreated !== false,
          passwordType: passwordType || 'PasswordDigest',
        });

        // Generate the security header XML
        const securityHeaderXml = (wsSecurity as any).toXML();
        
        // Inject into SOAP envelope
        xml = this.injectSecurityHeader(xml, securityHeaderXml);
        
        this.log('[WS-Security] Applied UsernameToken security header');
      } else if (wsSecurityConfig.type === 'certificate') {
        this.log('[WS-Security] Certificate-based security not yet implemented');
        // Future: Implement WSSecurityCert
      }
    } catch (error) {
      this.log('[WS-Security] Error applying security:', error);
    }

    return xml;
  }

  /**
   * Inject WS-Security header into SOAP envelope
   */
  private injectSecurityHeader(soapXml: string, securityHeaderXml: string): string {
    // Check if soap:Header already exists
    const headerRegex = /<(soap|SOAP-ENV|soapenv|s):Header[^>]*>/i;
    const headerMatch = soapXml.match(headerRegex);

    if (headerMatch) {
      // Insert security header inside existing soap:Header
      const insertPosition = headerMatch.index! + headerMatch[0].length;
      return (
        soapXml.slice(0, insertPosition) +
        '\n' + securityHeaderXml +
        soapXml.slice(insertPosition)
      );
    } else {
      // Create new soap:Header after soap:Envelope opening tag
      const envelopeRegex = /<(soap|SOAP-ENV|soapenv|s):Envelope[^>]*>/i;
      const envelopeMatch = soapXml.match(envelopeRegex);

      if (envelopeMatch) {
        const prefix = envelopeMatch[1];
        const insertPosition = envelopeMatch.index! + envelopeMatch[0].length;
        const headerXml = `\n<${prefix}:Header>\n${securityHeaderXml}\n</${prefix}:Header>`;
        return (
          soapXml.slice(0, insertPosition) +
          headerXml +
          soapXml.slice(insertPosition)
        );
      }
    }

    // Fallback: couldn't parse envelope structure
    this.log('[WS-Security] Warning: Could not parse SOAP envelope structure');
    return soapXml;
  }

  /**
   * Execute SOAP request with attachments (Base64 inline, SwA, or MTOM)
   */
  private async executeWithAttachments(
    endpoint: string,
    operation: string,
    xml: string,
    attachments: any[],
    headers: any,
    soapAction: string,
  ): Promise<any> {
    const fs = require('fs');
    const FormData = require('form-data');

    // Separate attachments by type
    const base64Attachments = attachments.filter((a: any) => a.type === 'Base64');
    const multipartAttachments = attachments.filter((a: any) => a.type === 'SwA' || a.type === 'MTOM');

    // Apply Base64 inline encoding
    let processedXml = xml;
    for (const attachment of base64Attachments) {
      try {
        if (fs.existsSync(attachment.fsPath)) {
          const fileBuffer = fs.readFileSync(attachment.fsPath);
          const base64Content = fileBuffer.toString('base64');
          // Replace cid: references with base64 content
          processedXml = processedXml.replace(
            new RegExp(`cid:${attachment.contentId}`, 'g'),
            base64Content
          );
          this.log(`[Attachments] Inlined Base64: ${attachment.name} (${attachment.contentId})`);
        } else {
          this.log(`[Attachments] Warning: File not found: ${attachment.fsPath}`);
        }
      } catch (error) {
        this.log(`[Attachments] Error reading file ${attachment.name}:`, error);
      }
    }

    // If no multipart attachments, use regular request
    if (multipartAttachments.length === 0) {
      const requestHeaders: any = {
        "Content-Type": "text/xml;charset=UTF-8",
        ...headers,
      };
      if (soapAction) {
        requestHeaders["SOAPAction"] = soapAction;
      }

      return this.httpClient.execute({
        name: operation,
        request: processedXml,
        endpoint,
        headers: requestHeaders,
        requestType: "soap",
        contentType: requestHeaders["Content-Type"],
      } as ApiRequest);
    }

    // Build multipart request for SwA/MTOM
    const form = new FormData();

    // Add SOAP envelope as first part
    form.append('soap-envelope', processedXml, {
      contentType: 'text/xml; charset=utf-8',
      filename: 'envelope.xml',
    });

    // Add binary attachments
    for (const attachment of multipartAttachments) {
      try {
        if (fs.existsSync(attachment.fsPath)) {
          const fileStream = fs.createReadStream(attachment.fsPath);
          form.append(attachment.contentId, fileStream, {
            filename: attachment.name,
            contentType: attachment.contentType || 'application/octet-stream',
          });
          this.log(`[Attachments] Added multipart: ${attachment.name} (${attachment.contentId})`);
        } else {
          this.log(`[Attachments] Warning: File not found: ${attachment.fsPath}`);
        }
      } catch (error) {
        this.log(`[Attachments] Error attaching file ${attachment.name}:`, error);
      }
    }

    // Prepare multipart headers
    const multipartHeaders: any = {
      ...headers,
      ...form.getHeaders(),
    };
    if (soapAction) {
      multipartHeaders["SOAPAction"] = soapAction;
    }

    this.log(`[Attachments] Sending multipart request with ${multipartAttachments.length} attachments`);
    this.log("Multipart Headers:", multipartHeaders);

    // Use HttpClient with FormData body
    return this.httpClient.execute({
      name: operation,
      request: form,
      endpoint,
      headers: multipartHeaders,
      requestType: "soap",
      contentType: multipartHeaders["content-type"],
    } as any);
  }

  /**
   * Execute a multipart SOAP request with attachments (SwA)
   */
  async executeMultipartRequest(
    endpoint: string,
    operation: string,
    xml: string,
    formData: any,
    headers?: any,
  ): Promise<any> {
    if (!endpoint) {
      return {
        success: false,
        error: "Invalid URL: Endpoint is missing.",
        rawResponse: null,
        rawRequest: xml,
        timeTaken: 0,
      };
    }

    // Get SOAPAction from WSDL if client exists
    let soapAction = "";
    if (this.client) {
      const definitions = (this.client as any).wsdl.definitions;
      for (const bindingName in definitions.bindings) {
        const binding = definitions.bindings[bindingName];
        if (binding.operations && binding.operations[operation]) {
          soapAction = binding.operations[operation].soapAction;
          break;
        }
      }
    }

    // Prepare Headers - FormData sets its own Content-Type with boundary
    const requestHeaders: any = {
      ...formData.getHeaders(),
      ...headers,
    };
    if (soapAction) {
      requestHeaders["SOAPAction"] = soapAction;
    }

    this.log(`Multipart POST ${endpoint}`);
    this.log("Headers:", requestHeaders);

    return await this.httpClient.execute({
      name: operation,
      request: formData,
      endpoint,
      headers: requestHeaders,
      requestType: "soap",
    } as ApiRequest);
  }
}
