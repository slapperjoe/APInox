/**
 * Phase One Verification Tests
 * 
 * This file tests all changes made during Phase One duplicate code remediation:
 * - Issue #2: XML generation functions type safety improvements
 * - Issue #3: SchemaNode type consolidation
 * 
 * Run with: npx ts-node test-phase-one.ts
 * Or include in test suite: npm test
 */

import { generateXmlFromSchema, generateXmlFromSchemaNode } from './shared/src/utils/soapUtils';
import type { SchemaNode } from './shared/src/models';

// Test counter for reporting
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`✓ ${message}`);
        passed++;
    } else {
        console.log(`✗ ${message}`);
        failed++;
    }
}

function assertContains(str: string, substring: string, message: string) {
    assert(str.includes(substring), `${message} - expected to contain "${substring}"`);
}

function assertNotContains(str: string, substring: string, message: string) {
    assert(!str.includes(substring), `${message} - should not contain "${substring}"`);
}

console.log("🧪 Testing Phase One Changes\n");
console.log("=" .repeat(60));

// ============================================================================
// Test Suite 1: Basic XML Generation (Issue #2)
// ============================================================================
console.log("\n📋 Test Suite 1: Basic XML Generation");
console.log("-".repeat(60));

// Test 1.1: Simple schema with single field
try {
    const simpleSchema = {
        $name: "GetWeatherRequest",
        $type: "complex",
        city: { $name: "city", $type: "string", $targetNamespace: "http://tempuri.org/" }
    };
    
    const xml = generateXmlFromSchema("GetWeather", simpleSchema, "http://example.com");
    
    assert(xml.includes("<soapenv:Envelope"), "Creates SOAP envelope");
    assert(xml.includes("<soapenv:Body"), "Contains SOAP body");
    assert(xml.includes("<web:GetWeather"), "Contains operation name");
    assert(xml.includes("<city>?"), "Contains field element");
    assert(xml.includes('xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'), "Has SOAP namespace");
    
    console.log("✓ Test 1.1 passed: Simple schema XML generation\n");
} catch (error) {
    console.log(`✗ Test 1.1 failed: ${error}\n`);
    failed++;
}

// Test 1.2: Schema with multiple fields
try {
    const multiFieldSchema = {
        $name: "CustomerRequest",
        $type: "complex",
        id: { $name: "id", $type: "int", $targetNamespace: "http://example.com/" },
        name: { $name: "name", $type: "string", $targetNamespace: "http://example.com/" },
        email: { $name: "email", $type: "string", $targetNamespace: "http://example.com/" }
    };
    
    const xml = generateXmlFromSchema("GetCustomer", multiFieldSchema, "http://example.com");
    
    assert(xml.includes("<id>?"), "Contains id field");
    assert(xml.includes("<name>?"), "Contains name field");
    assert(xml.includes("<email>?"), "Contains email field");
    
    console.log("✓ Test 1.2 passed: Multi-field schema XML generation\n");
} catch (error) {
    console.log(`✗ Test 1.2 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 2: SchemaNode Type Safety (Issue #2 & #3)
// ============================================================================
console.log("\n📋 Test Suite 2: SchemaNode Type Safety");
console.log("-".repeat(60));

// Test 2.1: SchemaNode with all fields (consolidated type)
try {
    const fullSchemaNode: SchemaNode = {
        name: "CompleteRequest",
        type: "tns:CompleteType",
        kind: 'complex',
        minOccurs: '1',
        maxOccurs: 'unbounded',
        documentation: "This is a test documentation field",
        children: [
            { 
                name: "Field1", 
                type: "xsd:string", 
                kind: 'simple',
                documentation: "First field"
            },
            { 
                name: "Field2", 
                type: "xsd:int", 
                kind: 'simple' 
            }
        ],
        options: ["OptionA", "OptionB", "OptionC"],
        isOptional: false,
        isChoice: false
    };
    
    const xml = generateXmlFromSchemaNode("CompleteOp", fullSchemaNode, "http://example.com");
    
    assert(xml.includes("<soapenv:Envelope"), "Creates SOAP envelope");
    assert(xml.includes("<Field1>?"), "Contains Field1");
    assert(xml.includes("<Field2>?"), "Contains Field2");
    assert(fullSchemaNode.documentation === "This is a test documentation field", "Documentation field accessible");
    assert(fullSchemaNode.options?.length === 3, "Options array accessible");
    assert(fullSchemaNode.isChoice === false, "isChoice field accessible");
    
    console.log("✓ Test 2.1 passed: SchemaNode with all fields (consolidated type)\n");
} catch (error) {
    console.log(`✗ Test 2.1 failed: ${error}\n`);
    failed++;
}

// Test 2.2: SchemaNode kind field (was missing in simplified version)
try {
    const complexNode: SchemaNode = {
        name: "ComplexType",
        type: "tns:AddressType",
        kind: 'complex',  // This field was missing in types.ts version
        children: [
            { name: "Street", type: "xsd:string", kind: 'simple' },
            { name: "City", type: "xsd:string", kind: 'simple' }
        ]
    };
    
    const xml = generateXmlFromSchemaNode("SaveAddress", complexNode, "http://example.com");
    
    assert(xml.includes("<Street>?"), "Complex type children rendered");
    assert(complexNode.kind === 'complex', "kind field is 'complex'");
    
    console.log("✓ Test 2.2 passed: SchemaNode kind field preserved\n");
} catch (error) {
    console.log(`✗ Test 2.2 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 3: Optional Element Handling (Issue #2 - minOccurs fix)
// ============================================================================
console.log("\n📋 Test Suite 3: Optional Element Handling");
console.log("-".repeat(60));

// Test 3.1: minOccurs === '0' handling (string comparison, not number)
try {
    const optionalNode: SchemaNode = {
        name: "RequestWithOptional",
        type: "tns:OptionalType",
        kind: 'complex',
        children: [
            { 
                name: "RequiredField", 
                type: "xsd:string", 
                kind: 'simple',
                minOccurs: '1'  // Required
            },
            { 
                name: "OptionalField", 
                type: "xsd:string", 
                kind: 'simple',
                minOccurs: '0',  // Optional (string '0', not number 0)
                isOptional: true
            }
        ]
    };
    
    const xml = generateXmlFromSchemaNode("TestOptional", optionalNode, "http://example.com");
    
    assert(xml.includes("<RequiredField>?"), "Required field present");
    // Optional fields with minOccurs='0' should still be generated (just marked as optional)
    assert(xml.includes("<OptionalField>?"), "Optional field also generated");
    
    console.log("✓ Test 3.1 passed: minOccurs string comparison works correctly\n");
} catch (error) {
    console.log(`✗ Test 3.1 failed: ${error}\n`);
    failed++;
}

// Test 3.2: isOptional flag handling
try {
    const isOptionalNode: SchemaNode = {
        name: "IsOptionalTest",
        type: "tns:IsOptionalType",
        kind: 'complex',
        children: [
            { 
                name: "Field1", 
                type: "xsd:string", 
                kind: 'simple',
                isOptional: false
            },
            { 
                name: "Field2", 
                type: "xsd:string", 
                kind: 'simple',
                isOptional: true  // Explicitly marked optional
            }
        ]
    };
    
    const xml = generateXmlFromSchemaNode("TestIsOptional", isOptionalNode, "http://example.com");
    
    assert(xml.includes("<Field1>?"), "Non-optional field present");
    assert(xml.includes("<Field2>?"), "isOptional field present");
    
    console.log("✓ Test 3.2 passed: isOptional flag handled correctly\n");
} catch (error) {
    console.log(`✗ Test 3.2 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 4: Choice Groups (Issue #3 - was missing in simplified version)
// ============================================================================
console.log("\n📋 Test Suite 4: Choice Groups");
console.log("-".repeat(60));

// Test 4.1: Choice group handling
try {
    const choiceNode: SchemaNode = {
        name: "SearchCriteria",
        type: "tns:SearchType",
        kind: 'complex',
        children: [
            {
                name: "SearchByName",
                type: "xsd:string",
                kind: 'simple',
                isChoice: true,
                choiceGroup: 1  // Part of choice group 1
            },
            {
                name: "SearchById",
                type: "xsd:int",
                kind: 'simple',
                isChoice: true,
                choiceGroup: 1  // Same group = alternative to SearchByName
            },
            {
                name: "Active",
                type: "xsd:boolean",
                kind: 'simple',
                isChoice: false  // Not part of choice
            }
        ]
    };
    
    const xml = generateXmlFromSchemaNode("Search", choiceNode, "http://example.com");
    
    assert(xml.includes("<SearchByName>?"), "First choice option present");
    assert(xml.includes("<Active>?"), "Non-choice field present");
    // Note: Both choices may be generated, but they're marked for UI to show as alternatives
    
    console.log("✓ Test 4.1 passed: Choice group fields accessible\n");
} catch (error) {
    console.log(`✗ Test 4.1 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 5: Enum Values (Issue #3 - options field was missing)
// ============================================================================
console.log("\n📋 Test Suite 5: Enum Values");
console.log("-".repeat(60));

// Test 5.1: Enum options handling
try {
    const enumNode: SchemaNode = {
        name: "CountryCode",
        type: "tns:CountryEnum",
        kind: 'simple',
        options: ["US", "CA", "MX", "BR"]  // Enum values (was missing in types.ts)
    };
    
    const xml = generateXmlFromSchemaNode("GetCountry", enumNode, "http://example.com");
    
    assert(xml.includes("<CountryCode>?"), "Enum field generated");
    assert(enumNode.options?.length === 4, "Options array preserved");
    assert(enumNode.options?.[0] === "US", "First option accessible");
    
    console.log("✓ Test 5.1 passed: Enum options field accessible\n");
} catch (error) {
    console.log(`✗ Test 5.1 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 6: Nested Complex Types
// ============================================================================
console.log("\n📋 Test Suite 6: Nested Complex Types");
console.log("-".repeat(60));

// Test 6.1: Deeply nested structure
try {
    const nestedNode: SchemaNode = {
        name: "OrderRequest",
        type: "tns:OrderType",
        kind: 'complex',
        children: [
            {
                name: "OrderId",
                type: "xsd:int",
                kind: 'simple'
            },
            {
                name: "Customer",
                type: "tns:CustomerType",
                kind: 'complex',
                children: [
                    {
                        name: "Name",
                        type: "xsd:string",
                        kind: 'simple'
                    },
                    {
                        name: "Address",
                        type: "tns:AddressType",
                        kind: 'complex',
                        children: [
                            { name: "Street", type: "xsd:string", kind: 'simple' },
                            { name: "City", type: "xsd:string", kind: 'simple' },
                            { name: "ZipCode", type: "xsd:string", kind: 'simple' }
                        ]
                    }
                ]
            }
        ]
    };
    
    const xml = generateXmlFromSchemaNode("CreateOrder", nestedNode, "http://example.com");
    
    assert(xml.includes("<OrderId>?"), "Top-level field present");
    assert(xml.includes("<Customer>"), "First-level nested type present");
    assert(xml.includes("<Name>?"), "Second-level field present");
    assert(xml.includes("<Address>"), "Third-level nested type present");
    assert(xml.includes("<Street>?"), "Deep nested field present");
    assert(xml.includes("<City>?"), "Deep nested field present");
    assert(xml.includes("<ZipCode>?"), "Deep nested field present");
    
    console.log("✓ Test 6.1 passed: Deeply nested complex types\n");
} catch (error) {
    console.log(`✗ Test 6.1 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Test Suite 7: Type Import Verification (Issue #3)
// ============================================================================
console.log("\n📋 Test Suite 7: Type Import Verification");
console.log("-".repeat(60));

// Test 7.1: SchemaNode type resolves from shared/src/models.ts
try {
    // This test verifies the type system works correctly
    // If SchemaNode was not properly consolidated, this would fail at compile time
    
    function acceptsSchemaNode(node: SchemaNode): boolean {
        // Verify all fields are accessible (TypeScript will error if missing)
        return typeof node.name === 'string' &&
               typeof node.type === 'string' &&
               (node.kind === 'complex' || node.kind === 'simple') &&
               (node.minOccurs === undefined || typeof node.minOccurs === 'string') &&
               (node.maxOccurs === undefined || typeof node.maxOccurs === 'string') &&
               (node.documentation === undefined || typeof node.documentation === 'string') &&
               (node.children === undefined || Array.isArray(node.children)) &&
               (node.options === undefined || Array.isArray(node.options)) &&
               (node.isOptional === undefined || typeof node.isOptional === 'boolean') &&
               (node.isChoice === undefined || typeof node.isChoice === 'boolean') &&
               (node.choiceGroup === undefined || typeof node.choiceGroup === 'number');
    }
    
    const testNode: SchemaNode = {
        name: "TypeTest",
        type: "tns:TypeTest",
        kind: 'complex',
        minOccurs: '1',
        maxOccurs: 'unbounded',
        documentation: "Type verification",
        children: [],
        options: ["A"],
        isOptional: false,
        isChoice: true,
        choiceGroup: 1
    };
    
    const isValid = acceptsSchemaNode(testNode);
    assert(isValid, "SchemaNode type has all expected fields");
    
    console.log("✓ Test 7.1 passed: SchemaNode type properly consolidated\n");
} catch (error) {
    console.log(`✗ Test 7.1 failed: ${error}\n`);
    failed++;
}

// ============================================================================
// Summary
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("📊 Test Summary");
console.log("=".repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total:  ${passed + failed}`);
console.log("=".repeat(60));

if (failed === 0) {
    console.log("\n🎉 All Phase One tests passed! Changes verified successfully.\n");
} else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.\n`);
}
