import * as fs from 'fs';
import * as path from 'path';

export class ConfigSwitcherService {

    /**
     * Injects the proxy URL into the given config file.
     * Backs up the original file to {fileName}.original
     */
    public inject(filePath: string, proxyBaseUrl: string): { success: boolean, message: string } {
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
            // We want to replace the protocol/host/port part with proxyBaseUrl.

            // Regex explanation:
            // address="  -> Literal match
            // (http|https) -> Capture protocol (Group 1)
            // ://        -> Literal
            // [^/"]+     -> Match host:port until first slash or quote
            // (/.*?)?    -> Match path (optional) (Group 2)
            // "          -> End quote

            // NOTE: This is aggressive. It replaces ALL http/https addresses in `address` attributes.
            const regex = /address="(http|https):\/\/[^/"]+(\/.*?)?"/g;

            // proxyBaseUrl should be like "http://localhost:9000"
            // We want result: address="http://localhost:9000/path"

            let matchCount = 0;
            const newContent = content.replace(regex, (match, protocol, path) => {
                matchCount++;
                const cleanPath = path || '';
                return `address="${proxyBaseUrl}${cleanPath}"`;
            });

            if (matchCount === 0) {
                return { success: false, message: 'No suitable endpoint addresses found to replace.' };
            }

            // 4. Write modified content
            fs.writeFileSync(filePath, newContent, 'utf8');

            return { success: true, message: `Successfully injected proxy into ${matchCount} endpoints. Backup created.` };

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
