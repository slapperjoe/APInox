import * as fs from 'fs';
import * as path from 'path';

export class ConfigSwitcherService {

    /**
     * Injects the proxy URL into the given config file.
     * Backs up the original file to {fileName}.original
     */
    public inject(filePath: string, proxyBaseUrl: string): { success: boolean, message: string, originalUrl?: string } {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, message: 'File not found.' };
            }

            const backupPath = filePath + '.original';

            // 1. Create Backup if not exists
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(filePath, backupPath);
            }

            // 2. Read content
            let content = fs.readFileSync(filePath, 'utf8');

            // 3. Replace endpoint addresses
            // Strategy: Look for address="..." attributes in <endpoint> tags.
            const regex = /address="(http|https):\/\/[^/"]+(\/.*?)?"/g;

            let matchCount = 0;
            let capturedUrl = '';

            const newContent = content.replace(regex, (match, protocol, path) => {
                matchCount++;
                // Reconstruct the original matched URL base (approximate, since regex matches the whole attribute value logic)
                // Actually my regex `address="(http...` matches the whole attribute. 
                // Let's rely on capturing the FULL url inside the quotes if possible.
                // Adjusted regex for capturing: /address="((http|https):\/\/[^"]+)"/g

                // Wait, the previous regex was: /address="(http|https):\/\/[^/"]+(\/.*?)?"/g
                // Let's refine it to be safer and capture the original full URL for the first match.

                // We want to replace the HOST:PORT but keep the PATH if we are proxying...
                // BUT the user request says: "config switcher inject should be able to use the value replaced to update the target."
                // Usually the target is the BASE URL.
                // If the config has multiple endpoints with different paths, we can't easily set ONE target.
                // Assumption: They all point to the same service base.

                // Let's capture the first full match.

                return match;
            });

            // RERUN with better logic:
            // capturing the first match's base URL.

            // New Regex to capture the URL inside quotes
            const urlRegex = /address="((http|https):\/\/[^"]+)"/g;

            const proxyPort = 9000; // Deduce from config or pass in? Hardcoded for now based on ProxyService default.

            // Capture the original URL to return it
            // Regex to match address="http(s)://..."
            // We want to capture the protocol to verify if we should inject https://localhost
            const match = content.match(/address="(https?):\/\/[^"]+"/);
            if (!match) {
                throw new Error("No suitable endpoint address found in web.config to proxy.");
            }

            const protocol = match[1]; // 'http' or 'https'
            const originalUrl = match[0].split('"')[1]; // This captures the first full URL found.

            const proxyBase = `${protocol}://localhost:${proxyPort}`;

            // Replace all occurrences of address="http(s)://..." with address="proxyBase/..."
            // We need to preserve the path!
            // Regex: address="(https?:\/\/[^"\/]+)(\/[^"]*)?"
            // Replace with: address="proxyBase$2"

            const newContent2 = content.replace(/address="(https?:\/\/[^"\/]+)(\/[^"]*)?"/g, (match, baseUrl, path) => {
                matchCount++; // Increment for each replacement
                if (!capturedUrl) capturedUrl = baseUrl + (path || ''); // Capture the first full URL before modification
                return `address="${proxyBase}${path || ''}"`;
            });

            if (content === newContent2) {
                throw new Error("Regex failed to replace address. Check format.");
            }

            if (matchCount === 0) {
                return { success: false, message: 'No suitable endpoint addresses found to replace.' };
            }

            // 4. Write modified content
            fs.writeFileSync(filePath, newContent2, 'utf8');

            return {
                success: true,
                message: `Successfully injected proxy into ${matchCount} endpoints. Backup created.`,
                originalUrl: capturedUrl // Return the first captured URL as the likely target
            };

        } catch (error: any) {
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    /**
     * Restores the config file from {fileName}.original
     */
    public restore(filePath: string): { success: boolean, message: string } {
        try {
            const backupPath = filePath + '.original';

            if (!fs.existsSync(backupPath)) {
                return { success: false, message: 'Backup file (.original) not found. Cannot restore.' };
            }

            // 1. Restore file
            fs.copyFileSync(backupPath, filePath);

            // 2. Delete backup
            fs.unlinkSync(backupPath);

            return { success: true, message: 'Successfully restored original configuration.' };

        } catch (error: any) {
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    public isProxied(filePath: string): boolean {
        const backupPath = filePath + '.original';
        return fs.existsSync(backupPath);
    }
}
