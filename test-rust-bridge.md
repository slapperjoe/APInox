# Test Rust Backend Routing

Open the app and paste this into the DevTools console:

```javascript
// Test 1: WSDL Loading through bridge (should route to Rust)
const testBridgeWsdl = async () => {
    console.log('===== TEST: WSDL Loading via Bridge =====');
    
    // Listen for the response
    const unlisten = bridge.on Message((msg) => {
        if (msg.command === 'wsdlParsed') {
            console.log('✅ Got wsdlParsed event!');
            console.log('Services:', msg.services?.length);
            console.log('First service:', msg.services?.[0]?.name);
            unlisten();
        }
    });
    
    // Send loadWsdl command (should route to Rust parse_wsdl)
    bridge.sendMessage({
        command: 'loadWsdl',
        url: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL'
    });
};

// Test 2: Direct Tauri command (bypass bridge)
const testDirectRust = async () => {
    console.log('===== TEST: Direct Rust Command =====');
    
    const result = await window.__TAURI__.core.invoke('parse_wsdl', {
        request: { url: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL' }
    });
    
    console.log('✅ Direct Rust result:', result);
    console.log('Services:', result.services?.length);
};

// Run tests
(async () => {
    await testBridgeWsdl();
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s
    await testDirectRust();
})();
```

Expected output:
- First test should log "Command 'loadWsdl' handled by Rust backend"
- Should get wsdlParsed event with services array
- Second test should show direct Rust response with services

If you see "falling back to Node.js sidecar" - the routing failed and needs debugging.
