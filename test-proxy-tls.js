// Test .NET WCF TLS Connection to APInox Proxy
// This script helps diagnose why .NET WCF clients fail to connect

const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROXY_PORT = 9000;
const PROXY_HOST = 'localhost';

console.log('='.repeat(60));
console.log('APInox Proxy TLS Diagnostics');
console.log('='.repeat(60));
console.log();

// Check certificate exists
const certPath = path.join(os.tmpdir(), 'apinox-proxy.cer');
const keyPath = path.join(os.tmpdir(), 'apinox-proxy.key');

console.log('1. Checking certificate files...');
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('   ❌ Certificate files not found!');
    console.error(`   Expected at: ${certPath}`);
    process.exit(1);
}
console.log(`   ✅ Certificate found: ${certPath}`);
console.log(`   ✅ Key found: ${keyPath}`);
console.log();

// Read certificate details
console.log('2. Reading certificate details...');
try {
    const certPem = fs.readFileSync(certPath, 'utf8');
    const forge = require('node-forge');
    const cert = forge.pki.certificateFromPem(certPem);
    
    console.log(`   Subject: ${cert.subject.getField('CN').value}`);
    console.log(`   Issuer: ${cert.issuer.getField('CN').value}`);
    console.log(`   Valid from: ${cert.validity.notBefore}`);
    console.log(`   Valid to: ${cert.validity.notAfter}`);
    
    const extensions = cert.extensions;
    const basicConstraints = extensions.find(e => e.name === 'basicConstraints');
    const keyUsage = extensions.find(e => e.name === 'keyUsage');
    const extKeyUsage = extensions.find(e => e.name === 'extKeyUsage');
    const san = extensions.find(e => e.name === 'subjectAltName');
    
    console.log(`   Is CA: ${basicConstraints?.cA || false}`);
    if (keyUsage) {
        console.log(`   Key Usage: digitalSignature=${keyUsage.digitalSignature}, keyEncipherment=${keyUsage.keyEncipherment}`);
    }
    if (extKeyUsage) {
        console.log(`   Extended Key Usage: serverAuth=${extKeyUsage.serverAuth}, clientAuth=${extKeyUsage.clientAuth}`);
    }
    if (san) {
        console.log(`   SAN: ${san.altNames?.map(a => a.value || a.ip).join(', ')}`);
    }
} catch (e) {
    console.error(`   ⚠️  Could not parse certificate: ${e.message}`);
}
console.log();

// Test TLS connection with different protocols
console.log('3. Testing TLS connections to proxy...');
console.log(`   Target: https://${PROXY_HOST}:${PROXY_PORT}`);
console.log();

async function testConnection(protocol, ciphers) {
    return new Promise((resolve) => {
        const options = {
            host: PROXY_HOST,
            port: PROXY_PORT,
            method: 'GET',
            path: '/',
            rejectUnauthorized: false,
            secureProtocol: protocol,
            ciphers: ciphers,
            servername: PROXY_HOST
        };
        
        const req = https.request(options, (res) => {
            const socket = res.socket;
            resolve({
                success: true,
                protocol: socket.getProtocol(),
                cipher: socket.getCipher()
            });
            res.resume();
        });
        
        req.on('error', (err) => {
            resolve({
                success: false,
                error: err.message,
                code: err.code
            });
        });
        
        req.setTimeout(3000, () => {
            req.destroy();
            resolve({ success: false, error: 'Timeout' });
        });
        
        req.end();
    });
}

// Test protocols that .NET supports
const protocols = [
    { name: 'TLS 1.2 (SSLv23)', id: 'SSLv23_method' },
    { name: 'TLS 1.2', id: 'TLSv1_2_method' },
    { name: 'TLS 1.3', id: 'TLSv1_3_method' }
];

// Cipher suites that .NET WCF typically uses
const dotnetCiphers = [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'AES256-GCM-SHA384',
    'AES128-GCM-SHA256'
].join(':');

(async () => {
    for (const proto of protocols) {
        process.stdout.write(`   Testing ${proto.name}... `);
        const result = await testConnection(proto.id, dotnetCiphers);
        
        if (result.success) {
            console.log(`✅ SUCCESS - Protocol: ${result.protocol}, Cipher: ${result.cipher.name}`);
        } else {
            console.log(`❌ FAILED - ${result.code || 'Error'}: ${result.error}`);
        }
    }
    
    console.log();
    console.log('4. Testing with .NET-compatible cipher suites...');
    const result = await testConnection('TLSv1_2_method', dotnetCiphers);
    
    if (result.success) {
        console.log('   ✅ Connection successful with .NET-compatible ciphers');
        console.log(`      Protocol: ${result.protocol}`);
        console.log(`      Cipher: ${result.cipher.name}`);
    } else {
        console.log('   ❌ Connection failed with .NET-compatible ciphers');
        console.log(`      Error: ${result.error}`);
        console.log();
        console.log('   This suggests the proxy is not accepting .NET WCF clients.');
        console.log('   The proxy may need to enable additional cipher suites or TLS settings.');
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('Diagnostics complete');
    console.log('='.repeat(60));
    console.log();
    console.log('If all tests pass but .NET WCF still fails, check:');
    console.log('  1. Your .NET app is using https://localhost:9000 (not http://)');
    console.log('  2. Certificate is in LocalMachine\\Root store (not CurrentUser)');
    console.log('  3. .NET app has SecurityProtocol set: ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12');
    console.log('  4. WCF binding security mode is set correctly');
})();
