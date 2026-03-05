import { HttpsProxyAgent } from 'https-proxy-agent';
import { WsdlParserOptions } from './types';

type LogFn = (message: string) => void;

/**
 * Builds the node-soap wsdl_options object for HTTP proxy and SSL certificate validation.
 *
 * Priority for proxy URL: options.proxyUrl > HTTPS_PROXY > HTTP_PROXY env vars.
 * strictSSL defaults to true (secure) and must be explicitly set to false to disable.
 */
export function buildSoapHttpOptions(options: WsdlParserOptions, log: LogFn): any {
    const soapOptions: any = {};
    const strictSSL = options.strictSSL !== false;

    const proxyUrl =
        options.proxyUrl ||
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy;

    if (proxyUrl) {
        log(`Using proxy: ${proxyUrl}`);
        log(`Strict SSL: ${strictSSL}`);
        const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: strictSSL });
        soapOptions.wsdl_options = { agent };
    } else if (!strictSSL) {
        log(`No proxy set, but Strict SSL is DISABLED.`);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const agent = new (require('https').Agent)({ rejectUnauthorized: false });
        soapOptions.wsdl_options = { agent };
    }

    return soapOptions;
}
