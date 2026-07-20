"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDiffChecker = void 0;
const assert_1 = require("assert");
const test_utils_1 = require("../test.utils");
const diff_checker_1 = require("./diff-checker");
const testDiffChecker = () => {
    void (0, test_utils_1.describe)('diff-checker', () => {
        (0, assert_1.strictEqual)(new diff_checker_1.DiffChecker().diff('Foo\nBar\nBaz', 'Foo\nBar\nBaz'), undefined);
        (0, assert_1.strictEqual)(new diff_checker_1.DiffChecker().diff('Foo\nBar\nBaz', 'Foo\nQux\nBaz'), '@@ -1,3 +1,3 @@\n Foo\n-Bar\n+Qux\n Baz\n');
    });
};
exports.testDiffChecker = testDiffChecker;
//# sourceMappingURL=diff-checker.test.js.map