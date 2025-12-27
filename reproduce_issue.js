const { XMLParser } = require('fast-xml-parser');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <m:CountryNameResponse xmlns:m="http://www.oorsprong.org/websamples.countryinfo">
      <m:CountryNameResult>Australia</m:CountryNameResult>
    </m:CountryNameResponse>
  </soap:Body>
</soap:Envelope>`;

const xpath = "/soap:Envelope[1]/soap:Body[1]/m:CountryNameResponse[1]/m:CountryNameResult[1]";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: false
});

const jsonObj = parser.parse(xml);
console.log("JSON Structure:", JSON.stringify(jsonObj, null, 2));

// Simulate Evaluator Logic
const path = xpath.startsWith('/') ? xpath.substring(1) : xpath;
const segments = path.split('/');

let current = jsonObj;

for (const segment of segments) {
    if (!current) {
        console.log("Stopped at null current for segment:", segment);
        break;
    }

    const match = segment.match(/^([^\[]+)(?:\[(\d+)\])?$/);
    const tagName = match[1];
    const index = match[2] ? parseInt(match[2], 10) - 1 : 0;

    console.log(`Processing Segment: ${segment} -> Tag: ${tagName}, Index: ${index}`);

    const localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
    console.log("Local Name:", localName);

    let foundKey;
    if (current[tagName]) {
        foundKey = tagName;
    } else {
        const keys = Object.keys(current);
        foundKey = keys.find(k => {
            if (k === localName) return true;
            if (k.endsWith(':' + localName)) return true;
            return false;
        });
    }

    console.log("Found Key:", foundKey);

    if (!foundKey) {
        console.log("Failed to find key for", tagName);
        break;
    }

    const val = current[foundKey];
    console.log("Value:", val);

    if (Array.isArray(val)) {
        current = val[index];
    } else {
        if (index === 0) {
            current = val;
        } else {
            console.log("Index out of bounds for non-array");
            current = null;
        }
    }
}

console.log("Final Result:", current);
