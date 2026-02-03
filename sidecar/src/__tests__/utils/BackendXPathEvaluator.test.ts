import { BackendXPathEvaluator } from '../../utils/BackendXPathEvaluator';

describe('BackendXPathEvaluator', () => {
    describe('evaluate', () => {
        const simpleXml = `
            <root>
                <name>John</name>
                <age>30</age>
            </root>
        `;

        const soapEnvelope = `
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <GetUserResponse xmlns="http://example.com">
                        <Name>Jane Doe</Name>
                        <Email>jane@example.com</Email>
                        <Orders>
                            <Order>
                                <Id>1001</Id>
                                <Total>99.99</Total>
                            </Order>
                            <Order>
                                <Id>1002</Id>
                                <Total>150.00</Total>
                            </Order>
                        </Orders>
                    </GetUserResponse>
                </soap:Body>
            </soap:Envelope>
        `;

        it('should extract simple element value', () => {
            const result = BackendXPathEvaluator.evaluate(simpleXml, '/root/name');
            expect(result).toBe('John');
        });

        it('should extract nested element value', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, '/Envelope/Body/GetUserResponse/Name');
            expect(result).toBe('Jane Doe');
        });

        it('should handle double-slash recursive search', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, '//Name');
            expect(result).toBe('Jane Doe');
        });

        it('should extract array element by index', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, '//Orders/Order[1]/Id');
            expect(result).toBe('1001');
        });

        it('should extract second array element', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, '//Orders/Order[2]/Id');
            expect(result).toBe('1002');
        });

        it('should return null for non-existent path', () => {
            const result = BackendXPathEvaluator.evaluate(simpleXml, '/root/missing');
            expect(result).toBeNull();
        });

        it('should return null for empty xml', () => {
            const result = BackendXPathEvaluator.evaluate('', '/root/name');
            expect(result).toBeNull();
        });

        it('should return null for empty xpath', () => {
            const result = BackendXPathEvaluator.evaluate(simpleXml, '');
            expect(result).toBeNull();
        });

        it('should handle count() > 0 existence check (exists)', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, 'count(//Name) > 0');
            expect(result).toBe('true');
        });

        it('should handle count() > 0 existence check (not exists)', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, 'count(//Missing) > 0');
            expect(result).toBe('false');
        });

        it('should strip namespace prefixes', () => {
            // The parser is configured to remove namespace prefixes
            const namespaceXml = `
                <m:Envelope xmlns:m="http://example.com">
                    <m:Body>
                        <m:Value>test123</m:Value>
                    </m:Body>
                </m:Envelope>
            `;
            const result = BackendXPathEvaluator.evaluate(namespaceXml, '//Value');
            expect(result).toBe('test123');
        });

        it('should handle out of bounds array index', () => {
            const result = BackendXPathEvaluator.evaluate(soapEnvelope, '//Orders/Order[99]/Id');
            expect(result).toBeNull();
        });

        it('should handle malformed xml gracefully', () => {
            const result = BackendXPathEvaluator.evaluate('<root><unclosed>', '/root/unclosed');
            // fast-xml-parser may still parse partially - just verify no exception
            expect(typeof result === 'string' || result === null).toBe(true);
        });
    });
});
