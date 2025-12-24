const selfsigned = require('selfsigned');
console.log('Starting standalone cert generation (Async/Await)...');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const opts = { days: 365, keySize: 2048, extensions: [{ name: 'basicConstraints', cA: true }] };

(async () => {
    try {
        console.log('Calling generate...');
        const start = Date.now();
        const pems = await selfsigned.generate(attrs, opts);
        const end = Date.now();
        console.log(`Generate completed after ${end - start}ms`);
        console.log('Generation Success!');
        console.log('Cert length:', pems.cert.length);
        console.log('Key length:', pems.private.length);
    } catch (e) {
        console.error('Async Error:', e);
    }
})();
