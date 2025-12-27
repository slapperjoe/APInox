const soap = require('soap');
const axios = require('axios').default || require('axios'); // Handle default export

const url = 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL';

console.log('Creating client for:', url);

const options = {};
options.request = (requestUrl, data, callback, exheaders, exoptions) => {
    console.log('[CustomRequest] Called with args:');
    console.log('  requestUrl:', typeof requestUrl, requestUrl);
    console.log('  data:', typeof data);
    console.log('  callback:', typeof callback);
    console.log('  exheaders:', typeof exheaders);
    // Mimic WsdlParser.ts URL logic
    let actualUrl = requestUrl;
    if (typeof requestUrl !== 'string') {
        actualUrl = requestUrl.url || requestUrl.href || JSON.stringify(requestUrl);
        console.log(`[CustomRequest] Resolved Object URL: ${actualUrl}`);
    }

    const method = data ? 'POST' : 'GET';
    const headers = {
        ...exheaders,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'close'
    };
    return axios({
        method: method,
        url: requestUrl,
        data: data,
        headers: headers,
        proxy: false,
        responseType: 'text' // Force text response to avoid auto-JSON parsing
    }).then((response) => {
        // Adapt Axios response to what node-soap expects (request-like response)
        const soapResponse = {
            statusCode: response.status,
            headers: response.headers,
            body: response.data
        };
        console.log(`[CustomRequest] Fetch success: ${response.status} `);
        callback(null, soapResponse, response.data);
    }).catch((error) => {
        console.error(`[CustomRequest] Fetch failed: ${error.message} `);
        callback(error, error.response, error.response ? error.response.data : null);
    });
};

soap.createClient(url, options, function (err, client) {
    if (err) {
        console.error('Error creating client:', err);
        return;
    }

    const definitions = client.wsdl.definitions;
    console.log('--- DEFINITIONS KEYS ---');
    console.log(Object.keys(definitions));

    console.log('--- TARGET NAMESPACE CANDIDATES ---');
    console.log('definitions.targetNamespace:', definitions.targetNamespace);
    console.log('definitions.$targetNamespace:', definitions.$targetNamespace);

    // Inspect Services mismatch
    const description = client.describe();
    console.log('--- DESCRIBE KEYS ---');
    console.log(Object.keys(description));

    console.log('--- DEFINITIONS.SERVICES KEYS ---');
    if (definitions.services) {
        console.log(Object.keys(definitions.services));

        // Check deep check
        const firstSvc = Object.keys(definitions.services)[0];
        if (firstSvc) {
            console.log(`Ports for ${firstSvc}: `, Object.keys(definitions.services[firstSvc].ports));
            const firstPort = Object.keys(definitions.services[firstSvc].ports)[0];
            if (firstPort) {
                console.log(`Location for ${firstPort}: `, definitions.services[firstSvc].ports[firstPort].location);
            }
        }
    } else {
        console.log('definitions.services is undefined!');
    }

    console.log('--- ATTRIBUTES ---');
    if (definitions.$attributes) {
        console.log(JSON.stringify(definitions.$attributes, null, 2));
    } else {
        console.log('No $attributes found directly on definitions.');
    }

    // Check if it's on the root wsdl object properties?
    console.log('--- CLIENT.WSDL KEYS ---');
    console.log(Object.keys(client.wsdl));
});
