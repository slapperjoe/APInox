# Testing Tauri Rust Commands

## Setup
1. App should be running via `npm run tauri:dev`
2. Open DevTools: Right-click in app → "Inspect Element" (or Cmd+Option+I on macOS)
3. Go to Console tab

## Test Commands (Copy/Paste into Console)

### 1. Test WSDL Parsing ✅
```javascript
// Parse a public WSDL
await window.__TAURI__.core.invoke('parse_wsdl', {
  request: {
    url: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL'
  }
}).then(result => {
  console.log('✅ WSDL Parsed:', result);
  console.log('Target namespace:', result.target_namespace);
  console.log('Services found:', result.services.length);
  
  if (result.services.length > 0) {
    const service = result.services[0];
    console.log('Service name:', service.name);
    console.log('Operations:', service.operations.length);
    console.log('First 5 operations:', service.operations.slice(0, 5).map(op => op.name));
  }
}).catch(err => console.error('❌ Error:', err));
```

### 2. Test SOAP Envelope Building
```javascript
// Build a SOAP envelope for an operation
await window.__TAURI__.core.invoke('build_soap_envelope', {
  request: {
    operation: {
      name: 'CapitalCity',
      target_namespace: 'http://www.oorsprong.org/websamples.countryinfo',
      action: '',
      input: { name: 'CapitalCity' },
      output: { name: 'CapitalCityResponse' },
      original_endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
      full_schema: null,
      description: null,
      port_name: null
    },
    soapVersion: '1.1',  // camelCase!
    values: {
      'sCountryISOCode': 'US'
    }
  }
}).then(response => {
  console.log('✅ Envelope Response:', response);
  if (response.success) {
    console.log('Envelope:', response.envelope);
  } else {
    console.error('Build failed:', response.error);
  }
}).catch(err => console.error('❌ Error:', err));
```

### 3. Test SOAP Execution
```javascript
// Execute a SOAP request
await window.__TAURI__.core.invoke('execute_soap_request', {
  request: {
    operation: {
      name: 'CapitalCity',
      target_namespace: 'http://www.oorsprong.org/websamples.countryinfo',
      action: '',
      input: { name: 'CapitalCity' },
      output: { name: 'CapitalCityResponse' },
      original_endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
      full_schema: null,
      description: null,
      port_name: null
    },
    soapVersion: '1.1',
    values: {
      'sCountryISOCode': 'US'
    },
    endpoint: null,  // Use operation's original_endpoint
    username: null,
    password: null,
    passwordType: null,
    addTimestamp: false
  }
}).then(response => {
  console.log('✅ SOAP Response:', response);
  console.log('Status:', response.statusCode);
  if (response.success) {
    console.log('Body preview:', response.body?.substring(0, 200) + '...');
  } else {
    console.error('Request failed:', response.error);
    if (response.fault) {
      console.error('SOAP Fault:', response.fault);
    }
  }
}).catch(err => console.error('❌ Error:', err));
```

### 4. Test Full Workflow (Parse → Execute) ⭐ USE THIS
```javascript
// Complete workflow test - Gets operation schema from WSDL
(async () => {
  try {
    // Step 1: Parse WSDL
    console.log('Step 1: Parsing WSDL...');
    const wsdl = await window.__TAURI__.core.invoke('parse_wsdl', {
      request: {
        url: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL'
      }
    });
    console.log('✅ Parsed:', wsdl.services.length, 'services,', wsdl.services[0].operations.length, 'operations');
    
    // Step 2: Get operation with full schema
    const service = wsdl.services[0];
    const operation = service.operations.find(op => op.name === 'CapitalCity');
    console.log('Step 2: Found operation:', operation.name);
    console.log('Has full_schema:', operation.full_schema != null);
    console.log('Endpoint:', operation.original_endpoint);
    
    // Step 3: Execute (envelope is built from full_schema)
    console.log('Step 3: Executing SOAP request...');
    const response = await window.__TAURI__.core.invoke('execute_soap_request', {
      request: {
        operation: operation,  // Use the operation with full_schema from WSDL
        soapVersion: '1.1',
        values: { 'sCountryISOCode': 'US' },
        endpoint: null,
        username: null,
        password: null,
        passwordType: null,
        addTimestamp: false
      }
    });
    
    console.log('✅ Response Status:', response.statusCode);
    if (response.success && response.statusCode < 400) {
      console.log('Success! Body:', response.body?.substring(0, 500));
    } else {
      console.warn('Got error response:', response.statusCode);
      console.log('Raw response:', response.rawXml?.substring(0, 500));
      if (response.fault) {
        console.error('SOAP Fault:', response.fault);
      }
    }
  } catch (err) {
    console.error('❌ Workflow failed:', err);
  }
})();
```

### 5. Test Your Custom WSDL
```javascript
// Replace with your WSDL URL
await window.__TAURI__.core.invoke('parse_wsdl', {
  request: {
    url: 'YOUR_WSDL_URL_HERE'
  }
}).then(result => {
  console.log('✅ Your WSDL Parsed');
  console.log('Target Namespace:', result.target_namespace);
  console.log('Services:', result.services.length);
  
  // Show all operations
  result.services.forEach(service => {
    console.log(`\nService: ${service.name}`);
    console.log('Ports:', service.ports);
    console.log('Operations:', service.operations.map(op => op.name).join(', '));
  });
}).catch(err => console.error('❌ Error:', err));
```

## What to Test

### Priority 1 (Core Functionality) ✅
- [x] WSDL parsing (test #1) - **WORKING!**
- [ ] SOAP envelope building (test #2)
- [ ] SOAP execution (test #3)
- [ ] Your custom WSDL (test #5)

### Priority 2 (Integration)
- [ ] Full workflow (test #4)

### Priority 3 (Optional - you don't have cert endpoints)
- [ ] Certificate generation (skip for now)
- [ ] Test execution with assertions (skip for now)
- [ ] Workflow engine (skip for now)

## Expected Results

**✅ Success looks like:**
- WSDL parsing returns services and operations
- Envelope building returns valid XML
- SOAP execution returns HTTP 200 with XML response
- No console errors

**❌ Failures to report:**
- Any JavaScript errors in console
- Rust panics in terminal
- Timeouts or network errors
- Invalid XML generated

## Troubleshooting

**If commands fail:**
1. Check terminal output for Rust errors
2. Copy full error message from console
3. Check that Tauri API is available: `console.log(window.__TAURI__)`

**If app doesn't start:**
1. Stop: Ctrl+C
2. Rebuild: `npm run build:sidecar && npm run tauri:dev`
