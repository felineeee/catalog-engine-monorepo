"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testTableMatcher = void 0;
const assert_1 = require("assert");
const test_utils_1 = require("../test.utils");
const table_matcher_1 = require("./table-matcher");
const testTableMatcher = () => {
    void (0, test_utils_1.describe)('table-matcher', () => {
        void (0, test_utils_1.it)('should match tables without schemas', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo').match(undefined, 'foo'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('.foo').match(undefined, 'foo'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('*.foo').match(undefined, 'foo'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('public.foo').match(undefined, 'foo'), false);
        });
        void (0, test_utils_1.it)('should match tables with schemas', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo').match('public', 'foo'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('.foo').match('public', 'foo'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('*.foo').match('public', 'foo'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('public.foo').match('public', 'foo'), true);
        });
        void (0, test_utils_1.it)('should be able to match tables containing "." without schemas', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo.bar').match(undefined, 'foo.bar'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('.foo.bar').match(undefined, 'foo.bar'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('*.foo.bar').match(undefined, 'foo.bar'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('public.foo.bar').match(undefined, 'foo.bar'), false);
        });
        void (0, test_utils_1.it)('should be able to match tables containing "." with schemas', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo.bar').match('public', 'foo.bar'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('.foo.bar').match('public', 'foo.bar'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('*.foo.bar').match('public', 'foo.bar'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('public.foo.bar').match('public', 'foo.bar'), true);
        });
        void (0, test_utils_1.it)('should match case-insensitively', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('FoO_bAr').match(undefined, 'foo_bar'), true);
        });
        void (0, test_utils_1.it)('should support logical OR', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('(foo|bar)').match(undefined, 'foo'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('(foo|bar)').match(undefined, 'bar'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('(foo|bar)').match(undefined, 'baz'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_(bar|baz)').match(undefined, 'foo_bar'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_(bar|baz)').match(undefined, 'foo_baz'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_(bar|baz)').match(undefined, 'foo_qux'), false);
        });
        void (0, test_utils_1.it)('should support simple brace expansion', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_{1,2}').match(undefined, 'foo_1'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_{1,2}').match(undefined, 'foo_2'), true);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('foo_{1,2}').match(undefined, 'foo_3'), false);
        });
        void (0, test_utils_1.it)('should support negation', () => {
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('!foo_(bar|baz)').match(undefined, 'foo_bar'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('!foo_(bar|baz)').match(undefined, 'foo_baz'), false);
            (0, assert_1.strictEqual)(new table_matcher_1.TableMatcher('!foo_(bar|baz)').match(undefined, 'foo_qux'), true);
        });
    });
};
exports.testTableMatcher = testTableMatcher;
//# sourceMappingURL=table-matcher.test.js.map