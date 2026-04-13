import { generateXmlFromSchema } from './shared/src/utils/soapUtils.js';

const simpleSchema = {
    $name: "GetWeatherRequest",
    $type: "complex",
    city: { $name: "city", $type: "string", $targetNamespace: "http://tempuri.org/" }
};

console.log("=== Generated XML ===");
const xml = generateXmlFromSchema("GetWeather", simpleSchema, "http://example.com");
console.log(xml);
console.log("\n=== Checks ===");
console.log("Contains <soapenv:Envelope:", xml.includes("<soapenv:Envelope"));
console.log("Contains <soapenv:Body:", xml.includes("<soapenv:Body"));
console.log("Contains <GetWeather:", xml.includes("<GetWeather"));
console.log("Contains <city>:", xml.includes("<city>"));
