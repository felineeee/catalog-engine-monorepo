"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSymbolCollection = void 0;
const assert_1 = require("assert");
const ast_1 = require("../ast");
const test_utils_1 = require("../test.utils");
const symbol_collection_1 = require("./symbol-collection");
const testSymbolCollection = () => {
    void (0, test_utils_1.describe)('symbol-collection', () => {
        const symbols = new symbol_collection_1.SymbolCollection();
        const symbol = {
            node: new ast_1.IdentifierNode('FooBar'),
            type: symbol_collection_1.SymbolType.DEFINITION,
        };
        symbols.set('foo-bar', symbol);
        symbols.set('foo__bar__', symbol);
        symbols.set('__foo__bar__', symbol);
        symbols.set('Foo, Bar!', symbol);
        symbols.set('Foo$Bar', symbol);
        (0, assert_1.deepStrictEqual)(symbols.symbolNames, {
            'foo-bar': 'FooBar',
            foo__bar__: 'FooBar2',
            __foo__bar__: '_FooBar',
            'Foo, Bar!': 'FooBar3',
            Foo$Bar: 'Foo$Bar',
        });
    });
};
exports.testSymbolCollection = testSymbolCollection;
//# sourceMappingURL=symbol-collection.test.js.map