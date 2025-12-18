import { SoapClient } from './src/soapClient';

async function verify() {
    const url = 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL';
    const client = new SoapClient();

    console.log('Parsing WSDL...');
    const services = await client.parseWsdl(url);
    console.log('Services found:', services.length);
    console.log('Service Name:', services[0].name);

    console.log('Executing Request (FullCountryInfo)...');
    const result = await client.executeRequest(url, 'FullCountryInfo', { sCountryISOCode: 'US' });
    console.log('Result Success:', result.success);
    if (result.success) {
        console.log('Country Name:', result.result.FullCountryInfoResult.sName);
    } else {
        console.error('Error:', result.error);
    }
}

verify().catch(console.error);
