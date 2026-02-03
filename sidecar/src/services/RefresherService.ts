import { ApinoxProject, ApiInterface, WsdlDiff, ApiOperation, ServiceOperation } from '../../shared/src/models';
import { SoapClient } from '../soapClient';

export class RefresherService {
    constructor(private soapClient: SoapClient) { }

    public async refreshWsdl(interfaceId: string, project: ApinoxProject): Promise<WsdlDiff | null> {
        // Find the interface
        const iface = project.interfaces.find(i => i.id === interfaceId || i.name === interfaceId);
        if (!iface) {
            this.soapClient.log(`Interface not found: ${interfaceId}`);
            return null;
        }

        const wsdlUrl = iface.definition;
        if (!wsdlUrl) {
            this.soapClient.log('No WSDL definition URL found for interface.');
            return null;
        }

        this.soapClient.log(`Refreshing WSDL for ${iface.name} from ${wsdlUrl}...`);

        try {
            // Fetch new WSDL with cache busting
            const cacheBustedUrl = wsdlUrl.includes('?')
                ? `${wsdlUrl}&t=${Date.now()}`
                : `${wsdlUrl}?t=${Date.now()}`;

            const newServices = await this.soapClient.parseWsdl(cacheBustedUrl);

            // Find matching service/port in new definition
            let matchedService: any = null;
            let matchedOperations: ServiceOperation[] = [];

            // Attempt to look up by binding name
            for (const svc of newServices) {
                if (svc.ports.includes(iface.bindingName)) {
                    matchedOperations = svc.operations.filter(op => op.portName === iface.bindingName);
                    if (matchedOperations.length > 0) {
                        matchedService = svc;
                        break;
                    }
                }
                // Fallback: match by Service Name
                if (svc.name === iface.bindingName && matchedOperations.length === 0) {
                    matchedOperations = svc.operations;
                    matchedService = svc;
                    break;
                }
            }

            if (!matchedOperations || matchedOperations.length === 0) {
                this.soapClient.log(`Could not find matching binding/port '${iface.bindingName}' in refreshed WSDL.`);
                this.soapClient.log(`Available Services: ${newServices.map(s => s.name).join(', ')}`);
                return null;
            }

            // Calculate Diff
            const diff: WsdlDiff = {
                projectId: project.id!,
                interfaceId: iface.id || iface.name,
                interfaceName: iface.name,
                newWsdlUrl: wsdlUrl,
                addedOperations: [],
                removedOperations: [],
                modifiedOperations: []
            };

            const existingOps = iface.operations;
            const newOps = matchedOperations;

            // Added & Modified
            newOps.forEach(newOp => {
                const existingOp = existingOps.find(oldOp => oldOp.name === newOp.name);
                if (!existingOp) {
                    diff.addedOperations.push(newOp);
                } else {
                    // Check for modification
                    const changes: string[] = [];

                    // DEBUG: Log inputs
                    this.soapClient.log(`Comparing inputs for ${newOp.name}`);
                    this.soapClient.log(`Existing: ${JSON.stringify(existingOp.input)}`);
                    this.soapClient.log(`New: ${JSON.stringify(newOp.input)}`);

                    // Check Input Schema details
                    const inputChanges = this.diffInput(existingOp.input, newOp.input);
                    if (inputChanges.length > 0) {
                        this.soapClient.log(`Input Schema mismatch for ${newOp.name}: ${JSON.stringify(inputChanges)}`);
                        changes.push(...inputChanges);
                    } else {
                        this.soapClient.log(`Input Schema MATCHED for ${newOp.name}`);
                    }

                    // Check Target Namespace
                    this.soapClient.log(`Checking Namespace: Old='${existingOp.targetNamespace}', New='${newOp.targetNamespace}'`);

                    // Check Target Namespace
                    if (existingOp.targetNamespace !== newOp.targetNamespace) {
                        changes.push(`Namespace changed to ${newOp.targetNamespace}`);
                    }

                    if (changes.length > 0) {
                        diff.modifiedOperations.push({
                            operation: newOp,
                            changes: changes
                        });
                    }
                }
            });

            // Removed: present in Existing but not in New
            existingOps.forEach(oldOp => {
                const exists = newOps.find(newOp => newOp.name === oldOp.name);
                if (!exists) {
                    this.soapClient.log(`Operation '${oldOp.name}' REMOVED.`);
                    // Convert ApiOperation to ServiceOperation-like structure for the Diff
                    // ServiceOperation is simpler
                    diff.removedOperations.push({
                        name: oldOp.name,
                        input: oldOp.input, // This might be complex object
                        output: {}, // Not strictly needed for display
                        description: 'Removed',
                        targetNamespace: oldOp.targetNamespace
                    });
                }
            });

            this.soapClient.log(`Diff calculated: ${diff.addedOperations.length} added, ${diff.removedOperations.length} removed, ${diff.modifiedOperations.length} modified.`);
            return diff;

        } catch (error: any) {
            this.soapClient.log(`Error refreshing WSDL: ${error.message}`);
            throw error;
        }
    }

    public applyDiff(diff: WsdlDiff, project: ApinoxProject): ApinoxProject {
        // Clone project
        const newProject = JSON.parse(JSON.stringify(project)) as ApinoxProject;
        const iface = newProject.interfaces.find(i => (i.id && i.id === diff.interfaceId) || i.name === diff.interfaceId);

        if (!iface) return project;

        // Apply Additions
        diff.addedOperations.forEach(op => {
            const newOp: ApiOperation = {
                id: crypto.randomUUID(),
                name: op.name,
                action: '', // WsdlParser might not give soapAction easily, or it's in extra props? 
                // parseWsdl in WsdlParser.ts doesn't seem to extract soapAction explicitly in ServiceOperation, 
                // but let's check.
                // It does input/output/portName/targetNamespace.
                input: op.input,
                targetNamespace: op.targetNamespace,
                originalEndpoint: op.originalEndpoint,
                requests: [] // Create default request
            };

            // Generate default request
            // We need to use logic similar to Import or WsdlParser?
            // Or can we reuse getInitialXml if we had it?
            // Ideally we should generate a default request.
            // But we don't have getInitialXml here easily (it's in frontend utils/soapUtils usually, or backend?)
            // It is in `webview/src/utils/soapUtils`. We can't use it here easily without bringing it to shared or backend.
            // Actually `WsdlParser` doesn't generate XML, it generates schema.
            // The frontend generates XML.
            // Backend usually just passes the schema.
            // Wait, `useMessageHandler` does XML generation!
            // So here we just add the Operation structure. The user can generate requests later or we add an empty one?
            // `useMessageHandler` -> `getInitialXml`.
            // If we add the operation here, it will have *no* requests initially.
            // That's fine. The user can "Add Request" later.
            // OR, we can try to generate a skeleton if we move getInitialXml to shared?
            // For now, let's create an empty request list.

            // Actually, looking at `useMessageHandler.ts` around line 178, it generates the initial request.
            // We should probably replicate that logic or move it.
            // But this runs in Extension Host (Node), `getInitialXml` is in Webview (Browser/React).
            // `soap-client` library can describe?
            // For now, we will add the operation with NO requests. 
            // The user can manually add a request, which should trigger generation if we implement "Add Request" well.

            iface.operations.push(newOp);
        });

        // Apply Removals
        diff.removedOperations.forEach(op => {
            const idx = iface.operations.findIndex(o => o.name === op.name);
            if (idx !== -1) {
                iface.operations.splice(idx, 1);
            }
        });

        // Apply Modifications
        diff.modifiedOperations.forEach(mod => {
            const existingOp = iface.operations.find(o => o.name === mod.operation.name);
            if (existingOp) {
                // Update schema definitions
                existingOp.input = mod.operation.input;
                existingOp.targetNamespace = mod.operation.targetNamespace;
                // Note: We do NOT automatically update existing Requests (XML bodies)
                // because that could destroy user work. The user must manually regenerate
                // or creating a new request will use the new schema.
            }
        });

        return newProject;
    }

    private diffInput(oldInput: any, newInput: any, prefix = ''): string[] {
        const changes: string[] = [];

        if (oldInput === newInput) return changes;
        if (!oldInput && newInput) return ['Input Schema Added'];
        if (oldInput && !newInput) return ['Input Schema Removed'];

        // If types match and are objects, deep compare keys
        if (typeof oldInput === 'object' && typeof newInput === 'object') {
            const keysOld = Object.keys(oldInput);
            const keysNew = Object.keys(newInput);

            // Check for added keys
            keysNew.forEach(key => {
                if (!keysOld.includes(key)) {
                    changes.push(prefix ? `Added param '${prefix}.${key}'` : `Added param '${key}'`);
                }
            });

            // Check for removed keys
            keysOld.forEach(key => {
                if (!keysNew.includes(key)) {
                    changes.push(prefix ? `Removed param '${prefix}.${key}'` : `Removed param '${key}'`);
                }
            });

            // Check for type changes in common keys
            keysNew.filter(k => keysOld.includes(k)).forEach(key => {
                const oldVal = oldInput[key];
                const newVal = newInput[key];

                // If leaf node (string type), compare values
                if (typeof oldVal !== 'object' && typeof newVal !== 'object') {
                    if (oldVal !== newVal) {
                        changes.push(prefix ? `Changed type of '${prefix}.${key}'` : `Changed type of '${key}'`);
                    }
                } else if (typeof oldVal === 'object' && typeof newVal === 'object') {
                    // Recurse
                    changes.push(...this.diffInput(oldVal, newVal, prefix ? `${prefix}.${key}` : key));
                } else {
                    // One became object, one wasn't
                    changes.push(prefix ? `Changed structure of '${prefix}.${key}'` : `Changed structure of '${key}'`);
                }
            });

            // if (changes.length === 0 && JSON.stringify(oldInput) !== JSON.stringify(newInput)) {
            //     // Fallback if deep Equal fails but keys look same (e.g. array vs object?)
            //     changes.push('Input Schema modified');
            // }

            return changes;
        }

        // Fallback for non-objects
        if (oldInput !== newInput) {
            return ['Input Schema changed'];
        }

        return changes;
    }

    private deepEqual(a: any, b: any): boolean {
        // Kept for other legacy calls if any, but diffInput replaces most usage
        if (a === b) return true;
        if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) return false;
        }

        return true;
    }
}
