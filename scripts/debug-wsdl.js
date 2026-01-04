/**
 * WSDL Connectivity Diagnostic (Node.js)
 * 
 * Usage:
 *   node debug-wsdl.js <URL>
 * 
 * Example:
 *   node debug-wsdl.js "https://example.com/service?wsdl"
 * 
 * Description:
 *   This script attempts to connect to a WSDL endpoint using the 'soap' and 'axios' libraries.
 *   IT EXPLICITLY DISABLES SSL VALIDATION to test if self-signed certs are the blocker.
 */

const soap = require('soap');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

const url = process.argv[2];

if (!url) {
    console.error('Usage: node debug-wsdl.js <URL>');
    process.exit(1);
}

console.log('--- WSDL Connectivity Diagnostic (Node.js) ---');
console.log(`Target URL: ${url}`);
console.log('(!) WARNING: SSL Certificate Validation is DISABLED for this test.');

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
console.log(`Proxy Environment Variable: ${proxyUrl || 'Not Set'}`);

async function testConnection() {
    // Shared options to disable SSL checks
    const sslOptions = { rejectUnauthorized: false };

    // Config for Proxy Agent
    const agentOptions = { ...sslOptions };

    // Config for direct connection (if no proxy)
    const httpsAgent = new (require('https').Agent)(sslOptions);

    const options = {};

    if (proxyUrl) {
        console.log('Configuring Proxy Agent (Insecure)...');
        const agent = url.startsWith('https')
            ? new HttpsProxyAgent(proxyUrl, agentOptions)
            : new HttpProxyAgent(proxyUrl);

        options.request = axios.create({
            httpsAgent: agent,
            httpAgent: agent,
            proxy: false
        });
    } else {
        console.log('Configuring Direct Connection (Insecure)...');
        // If no proxy, we must still tell axios/soap to allow insecure
        options.request = axios.create({
            httpsAgent: httpsAgent,
            proxy: false
        });
        // Note: node-soap might use its own request logic if options.request isn't passed,
        // but passing a pre-configured axios instance is the most reliable way to inject agents.
    }

    try {
        console.log('Attempting soap.createClientAsync...');
        const client = await soap.createClientAsync(url, options);
        console.log('SUCCESS: Client created.');
        const services = client.describe();
        console.log('Services found:', Object.keys(services));
        // console.log(JSON.stringify(services, null, 2));
    } catch (error) {
        console.error('FAILURE:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Body:', error.response.data);
        }
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
        console.error('Stack:', error.stack);
    }
}

testConnection();
