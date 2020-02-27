var test = require('unit.js');
var gls = require('../js/index').files;

describe('testing glsfiles', function () {
    it('can read a text file', function () {
        let text = gls.readFile('test/glsfiles-test01.txt');
        let expected = `Line one #comment
Line two #blank line

Line three #last line`;
        test.assert.equal(text, expected);
    });
    it('can read a file as a list', function() {
        let list = gls.readListFile('test/glsfiles-test01.txt');
        let expected = [`Line one #comment`, `Line two #blank line`,``, `Line three #last line`];
        test.value(list, function(it, i) {
            list[i] === expected[i]
        });
    });
    it('can read a file as a script', function() {
        let list = gls.readScriptFile('test/glsfiles-test01.txt');
        let expected = [`Line one`, `Line two`,`Line three`];
        test.value(list, function(it, i) {
            list[i] === expected[i]
        });
        it('can read a file as a script', function() {
            let list = gls.readScriptFile('test/glsfiles-test01.txt');
            let expected = [`Line one`, `Line two`,`Line three`];
            test.value(list, function(it, i) {
                list[i] === expected[i]
            });
        });
});