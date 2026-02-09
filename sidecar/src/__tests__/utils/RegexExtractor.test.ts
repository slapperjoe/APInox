import { RegexExtractor } from '../../utils/RegexExtractor';

describe('RegexExtractor', () => {
    describe('extract', () => {
        it('should extract value from JSON using capture group', () => {
            const json = '{"token":"abc123","user":"john"}';
            const result = RegexExtractor.extract(json, '"token":"([^"]+)"');
            expect(result).toBe('abc123');
        });

        it('should extract from HTML tag', () => {
            const html = '<title>My Page Title</title>';
            const result = RegexExtractor.extract(html, '<title>(.*?)</title>');
            expect(result).toBe('My Page Title');
        });

        it('should extract email address', () => {
            const text = 'Contact us at support@example.com for help';
            const result = RegexExtractor.extract(text, '[\\w.+-]+@[\\w-]+\\.[\\w.-]+');
            expect(result).toBe('support@example.com');
        });

        it('should extract number', () => {
            const text = 'Price: 42.50 USD';
            const result = RegexExtractor.extract(text, '\\d+');
            expect(result).toBe('42');
        });

        it('should extract decimal number', () => {
            const text = 'Price: 42.50 USD';
            const result = RegexExtractor.extract(text, '\\d+\\.\\d+');
            expect(result).toBe('42.50');
        });

        it('should extract text between markers', () => {
            const text = 'Some START important data END more text';
            const result = RegexExtractor.extract(text, 'START(.*?)END');
            expect(result).toBe(' important data ');
        });

        it('should use full match when no capture group', () => {
            const text = 'The UUID is 550e8400-e29b-41d4-a716-446655440000';
            const result = RegexExtractor.extract(text, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
            expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return null when no match found', () => {
            const text = 'No token here';
            const result = RegexExtractor.extract(text, '"token":"([^"]+)"');
            expect(result).toBeNull();
        });

        it('should return null for empty text', () => {
            const result = RegexExtractor.extract('', '"token":"([^"]+)"');
            expect(result).toBeNull();
        });

        it('should return null for empty pattern', () => {
            const result = RegexExtractor.extract('some text', '');
            expect(result).toBeNull();
        });

        it('should handle invalid regex gracefully', () => {
            const result = RegexExtractor.extract('text', '[invalid(');
            expect(result).toBeNull();
        });
    });

    describe('extractAll', () => {
        it('should extract all matches', () => {
            const xml = '<id>1</id><id>2</id><id>3</id>';
            const results = RegexExtractor.extractAll(xml, '<id>(\\d+)</id>');
            expect(results).toEqual(['1', '2', '3']);
        });

        it('should extract all email addresses', () => {
            const text = 'Contact alice@example.com or bob@test.org';
            const results = RegexExtractor.extractAll(text, '[\\w.+-]+@[\\w-]+\\.[\\w.-]+');
            expect(results).toEqual(['alice@example.com', 'bob@test.org']);
        });

        it('should return empty array when no matches', () => {
            const results = RegexExtractor.extractAll('no matches', 'pattern');
            expect(results).toEqual([]);
        });

        it('should return empty array for empty text', () => {
            const results = RegexExtractor.extractAll('', 'pattern');
            expect(results).toEqual([]);
        });

        it('should handle invalid regex gracefully', () => {
            const results = RegexExtractor.extractAll('text', '[invalid(');
            expect(results).toEqual([]);
        });
    });

    describe('isValidPattern', () => {
        it('should return true for valid pattern', () => {
            expect(RegexExtractor.isValidPattern('\\d+')).toBe(true);
            expect(RegexExtractor.isValidPattern('"token":"([^"]+)"')).toBe(true);
            expect(RegexExtractor.isValidPattern('[a-z]+')).toBe(true);
        });

        it('should return false for invalid pattern', () => {
            expect(RegexExtractor.isValidPattern('[')).toBe(false);
            expect(RegexExtractor.isValidPattern('[invalid(')).toBe(false);
            expect(RegexExtractor.isValidPattern('(?')).toBe(false);
        });
    });

    describe('getCommonPatterns', () => {
        it('should return common pattern definitions', () => {
            const patterns = RegexExtractor.getCommonPatterns();
            
            expect(patterns.jsonField).toBeDefined();
            expect(patterns.email).toBeDefined();
            expect(patterns.number).toBeDefined();
            expect(patterns.url).toBeDefined();
            
            // Verify structure
            expect(patterns.jsonField.pattern).toBeDefined();
            expect(patterns.jsonField.description).toBeDefined();
            expect(patterns.jsonField.example).toBeDefined();
        });

        it('should have working patterns', () => {
            const patterns = RegexExtractor.getCommonPatterns();
            
            // Test email pattern
            const email = RegexExtractor.extract(
                'Contact: user@example.com',
                patterns.email.pattern
            );
            expect(email).toBe('user@example.com');
            
            // Test number pattern
            const number = RegexExtractor.extract(
                'Price: 42',
                patterns.number.pattern
            );
            expect(number).toBe('42');
        });
    });

    describe('real-world scenarios', () => {
        it('should extract JWT token from JSON response', () => {
            const response = '{"status":"success","data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9","expires":3600}}';
            const token = RegexExtractor.extract(response, '"token":"([^"]+)"');
            expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        });

        it('should extract session ID from HTML', () => {
            const html = '<html><head><meta name="session-id" content="abc123xyz"/></head></html>';
            const sessionId = RegexExtractor.extract(html, 'session-id" content="([^"]+)"');
            expect(sessionId).toBe('abc123xyz');
        });

        it('should extract error code from plain text log', () => {
            const log = '[ERROR] Operation failed with code: ERR-500-INTERNAL';
            const errorCode = RegexExtractor.extract(log, 'code: (ERR-\\d+-[A-Z]+)');
            expect(errorCode).toBe('ERR-500-INTERNAL');
        });

        it('should extract all user IDs from list response', () => {
            const response = `<users>
                <user id="1" name="Alice"/>
                <user id="2" name="Bob"/>
                <user id="3" name="Charlie"/>
            </users>`;
            const userIds = RegexExtractor.extractAll(response, 'user id="(\\d+)"');
            expect(userIds).toEqual(['1', '2', '3']);
        });
    });
});
