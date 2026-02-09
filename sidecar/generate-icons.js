#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
    // Use the sidecar icon.png as the source
    const pngPath = path.join(__dirname, 'icon.png');
    const outputDir = __dirname;
    
    if (!fs.existsSync(pngPath)) {
        console.error('❌ icon.png not found at:', pngPath);
        console.error('Please provide an icon.png file in the sidecar directory.');
        process.exit(1);
    }
    
    console.log('🎨 Generating icon files from', pngPath);
    
    // Generate different sized PNGs
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}.png`);
        const buffer = await sharp(pngPath)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();
        
        fs.writeFileSync(outputPath, buffer);
        pngBuffers.push(buffer);
        console.log(`  ✓ Generated ${size}x${size} PNG`);
    }
    
    // Generate ICO manually (simple multi-icon format)
    console.log('  🔨 Creating ICO file...');
    const icoBuffer = createIco(pngBuffers, sizes);
    fs.writeFileSync(path.join(outputDir, 'icon.ico'), icoBuffer);
    console.log('  ✓ Generated icon.ico');
    
    console.log('✅ All icons generated successfully!');
    console.log('📍 Using:', pngPath);
}

// Simple ICO file format creation (without external dependencies)
function createIco(pngBuffers, sizes) {
    const iconCount = pngBuffers.length;
    const headerSize = 6 + (iconCount * 16);
    let offset = headerSize;
    
    const buffers = [];
    
    // ICO header
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);      // Reserved
    header.writeUInt16LE(1, 2);      // Type: 1 = ICO
    header.writeUInt16LE(iconCount, 4); // Number of images
    buffers.push(header);
    
    // Icon directory entries
    const entries = [];
    for (let i = 0; i < iconCount; i++) {
        const size = sizes[i];
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
        entry.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
        entry.writeUInt8(0, 2);  // Color palette
        entry.writeUInt8(0, 3);  // Reserved
        entry.writeUInt16LE(1, 4);  // Color planes
        entry.writeUInt16LE(32, 6); // Bits per pixel
        entry.writeUInt32LE(pngBuffers[i].length, 8); // Image size
        entry.writeUInt32LE(offset, 12); // Image offset
        entries.push(entry);
        offset += pngBuffers[i].length;
    }
    
    buffers.push(...entries);
    buffers.push(...pngBuffers);
    
    return Buffer.concat(buffers);
}

generateIcons().catch(err => {
    console.error('❌ Error generating icons:', err);
    process.exit(1);
});
