"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_test_1 = require("./cli/cli.test");
const connection_string_parser_test_1 = require("./core/connection-string-parser.test");
const diff_checker_test_1 = require("./core/diff-checker.test");
const e2e_test_1 = require("./core/e2e.test");
const table_matcher_test_1 = require("./introspector/table-matcher.test");
const serializer_test_1 = require("./serializer/serializer.test");
const symbol_collection_test_1 = require("./transformer/symbol-collection.test");
const transformer_test_1 = require("./transformer/transformer.test");
(async () => {
    (0, cli_test_1.testCli)();
    (0, connection_string_parser_test_1.testConnectionStringParser)();
    (0, diff_checker_test_1.testDiffChecker)();
    (0, table_matcher_test_1.testTableMatcher)();
    (0, transformer_test_1.testTransformer)();
    (0, serializer_test_1.testSerializer)();
    (0, symbol_collection_test_1.testSymbolCollection)();
    await (0, e2e_test_1.testE2E)();
})();
//# sourceMappingURL=index.test.js.map