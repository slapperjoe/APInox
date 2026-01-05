import { ReplacerService, ReplacementRule } from '../../services/ReplacerService';

describe('ReplacerService', () => {
    let service: ReplacerService;

    beforeEach(() => {
        service = new ReplacerService();
    });

    describe('Rule Management', () => {
        it('should add a rule', () => {
            const rule: ReplacementRule = {
                id: 'r1',
                active: true,
                name: 'Test Rule',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            };

            service.addRule(rule);

            expect(service.getRules()).toHaveLength(1);
            expect(service.getRules()[0].id).toBe('r1');
        });

        it('should update an existing rule', () => {
            const rule: ReplacementRule = {
                id: 'r1',
                active: true,
                name: 'Test Rule',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            };
            service.addRule(rule);

            service.updateRule({ ...rule, replaceWith: 'baz' });

            expect(service.getRules()[0].replaceWith).toBe('baz');
        });

        it('should remove a rule', () => {
            const rule: ReplacementRule = {
                id: 'r1',
                active: true,
                name: 'Test Rule',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            };
            service.addRule(rule);

            service.removeRule('r1');

            expect(service.getRules()).toHaveLength(0);
        });
    });

    describe('processRequest', () => {
        it('should replace matching string in request body', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Replace Foo',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            });

            const result = service.processRequest('<request>foo</request>', 'http://example.com');

            expect(result).toBe('<request>bar</request>');
        });

        it('should replace multiple occurrences', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Replace Foo',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            });

            const result = service.processRequest('foo foo foo', 'http://example.com');

            expect(result).toBe('bar bar bar');
        });

        it('should use regex when isRegex is true', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Replace Numbers',
                matchType: 'Body',
                matchPattern: '\\d+',
                replaceWith: 'NUM',
                isRegex: true
            });

            const result = service.processRequest('Order 123 has 456 items', 'http://example.com');

            expect(result).toBe('Order NUM has NUM items');
        });

        it('should not apply inactive rules', () => {
            service.addRule({
                id: 'r1',
                active: false,
                name: 'Inactive Rule',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            });

            const result = service.processRequest('<request>foo</request>', 'http://example.com');

            expect(result).toBe('<request>foo</request>');
        });

        it('should apply multiple active rules', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Replace Foo',
                matchType: 'Body',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            });
            service.addRule({
                id: 'r2',
                active: true,
                name: 'Replace Bar',
                matchType: 'Body',
                matchPattern: 'bar',
                replaceWith: 'baz',
                isRegex: false
            });

            const result = service.processRequest('foo', 'http://example.com');

            // First foo -> bar, then bar -> baz
            expect(result).toBe('baz');
        });
    });

    describe('processResponse', () => {
        it('should replace matching string in response body', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Replace Error',
                matchType: 'Body',
                matchPattern: 'ERROR',
                replaceWith: 'SUCCESS',
                isRegex: false
            });

            const result = service.processResponse('<response>ERROR</response>');

            expect(result).toBe('<response>SUCCESS</response>');
        });

        it('should handle regex in response', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Anonymize Emails',
                matchType: 'Body',
                matchPattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
                replaceWith: '[REDACTED]',
                isRegex: true
            });

            const result = service.processResponse('Contact: john@example.com');

            expect(result).toBe('Contact: [REDACTED]');
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid regex gracefully', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Bad Regex',
                matchType: 'Body',
                matchPattern: '[invalid(',
                replaceWith: 'replacement',
                isRegex: true
            });

            // Should not throw, should return original
            const result = service.processRequest('test', 'http://example.com');
            expect(result).toBe('test');
        });

        it('should not modify when matchType is Url', () => {
            service.addRule({
                id: 'r1',
                active: true,
                name: 'Url Rule',
                matchType: 'Url',
                matchPattern: 'foo',
                replaceWith: 'bar',
                isRegex: false
            });

            const result = service.processRequest('foo', 'http://example.com');

            // Url matchType rules don't apply to Body processing
            expect(result).toBe('foo');
        });
    });
});
