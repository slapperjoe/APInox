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
 *   This script attempts to connect to a WSDL endpoint using the 'soap' and 'axios' libraries,
 *   closely mimicking how the extension behaves. It respects HTTP_PROXY and HTTPS_PROXY
 *   environment variables.
 * 
 * Requirements:
 *   Run `npm install` in the root or ensure 'soap', 'axios', 'https-proxy-agent' are available.
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

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
console.log(`Proxy Environment Variable: ${proxyUrl || 'Not Set'}`);

async function testConnection() {
    const options = {};
    if (proxyUrl) {
        console.log('Configuring Proxy Agent...');
        const agent = url.startsWith('https') ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
        options.request = axios.create({
            httpsAgent: agent,
            httpAgent: agent,
            proxy: false // Critical for axios + agent
        });
    }

    try {
        console.log('Attempting soap.createClientAsync...');
        const client = await soap.createClientAsync(url, options);
        console.log('SUCCESS: Client created.');
        console.log('Services:', Object.keys(client.describe()));
    } catch (error) {
        console.error('FAILURE:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Body:', error.response.data);
        }
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
    }
}

testConnection();
