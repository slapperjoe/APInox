
const soap = require('soap');

const url = 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL';

async function run() {
    console.log(`Loading WSDL: ${url}`);
    try {
        const client = await soap.createClientAsync(url);
        const description = client.describe();

        console.log('--- Client Description ---');
        console.log(JSON.stringify(description, null, 2));

        console.log('--- Service Keys ---');
        Object.keys(description).forEach(key => console.log(key));

        // Emulate WsdlParser logic
        const services = [];
        for (const serviceName in description) {
            console.log(`Processing Service: ${serviceName}`);
            services.push({ name: serviceName });
        }

        console.log(`\nTotal Services Found: ${services.length}`);
        if (services.length > 1) {
            const names = services.map(s => s.name);
            const unique = new Set(names);
            if (unique.size !== names.length) {
                console.log("FAIL: Duplicates detected in services array (Same Name).");
            } else {
                console.log("Multiple services found, but names are unique.");
            }
        } else {
            console.log("Single service found.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
