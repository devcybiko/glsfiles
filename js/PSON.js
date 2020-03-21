/*

PSON - read/write a simplified JSON that supports comments

{ - begin an object - must stand on its own line
} - ends an object - must stand on its own line
[ - begins an array - must stand on its own line
] - ends an array - must stand on its own line
( - begins a list - an ordered set of key-value pairs
) - ends a list 

key:value
   - a one-line key-value pair. no quoting, all on one line
   - no commas or semicolons to end the value, no special characters but slash and backslash
   - key has the usual variable naming conventions
   - value begins with the first non-space character (if you want spaces use '\ ')
   - value ends on the end of line
   - UNLESS the line ends with a backslash '\'
   - NOTE: all values in papason are returned as strings
// - inserts a comment anywhere and continues to end of line
   - if you want to insert the literal '//' prepend each slash with \
NOTES:
   - indentation and whitespaces are ignored
   - Lists are implemented as arrays of key-value pairs
   - key-value pairs are implemented as an array of 2 values (key,value)

parse() - reads text PSON and returns a JS object where all values are strings
stringify() - serializes an object into PSON. All objects are ignored. 
            - All non-strings are converted to strings

        // expand escaped characters
        // remove comments
        // allow for end-of-line escapes that continue on to the next line
        // keep newlines and spaces 
        // - except on line continuations (indented continuation lines remove pre-spaces, but not post-spaces)
        // - except at EOLN for key:value pairs (if you want spaces add '\ ' for each space)
        // NOTE: If you want spaces at the end of a line, add a trailing comment //

*/

const is = require('./glschars');
const dbg = require('./glsdebug');
var Map = require("collections/map");

const USEMAP = false;

dbg.off();
//dbg.set(dbg.VERBOSE)

module.exports = {
    _getLine: function (lines, i) {
        dbg.begin()
        dbg.verbose(i);
        if (i >= lines.length) throw `ERROR: Unexpected EOF at line ${i}`;
        let line = "";
        for (let j = i; j < lines.length; j++) {
            line += lines[j];
            i = j;
            if (line.endsWith("\\")) {
                line = line.substring(0, line.length - 1);
                continue;
            }
            if (line.length > 0) break;
        }
        dbg.verbose(`${i}: ${line}`);
        dbg.end()
        i++;
        return [line, i];
    },
    _split: function (s, c) {
        let result = [];
        s = s.trim();
        let word = "";
        for (let i = 0; i < s.length; i++) {
            if (s[i] === '\\') { // allows escaping the split character
                word += s[i];
                i++;
                word += s[i];
            } else if (s[i] === c) {
                result.push(word);
                word = "";
            } else {
                word += s[i];
            }
        }
        if (word) result.push(word);
        return result;
    },
    _escape: function (s) {
        dbg.begin();
        s = s.trim();
        let t = "";
        for (let i = 0; s[i]; i++) {
            if (s[i] === '\\') {
                let c = s[++i];
                let escaped = is.escapeable(c);
                if (!escaped && !c) c = '\\';
                if (escaped) c = escaped;
                t += c;
            } else {
                t += s[i];
            }
        }
        dbg.end();
        return t;
    },
    _preprocessLines: function (lines) {
        dbg.begin();
        let result = [];
        for (let longLine of lines) {
            let line = longLine.trim();
            if (line.startsWith("//")) line = "";
            comment = line.indexOf(" //");
            if (comment > -1) line = line.substring(0, comment);
            result.push(line);
        }
        dbg.end();
        return result;
    },
    _parseKeyValue: function (line, lines, i) {
        dbg.begin();
        dbg.verbose(i);
        let colon = line.indexOf(':');
        let key, value;
        if (colon > 0) {
            key = line.substring(0, colon);
            value = line.substring(colon + 1).trim();
        } else if (colon === -1) {
            key = line;
            value = '';
        } else {
            throw Error(`line ${i + 1}: missing colon in "${line}"`); // throw an error if we MUST have a colon
        }
        dbg.verbose({value: value});
        if (value === '{' || value === '[' || value === '(') {
            let [obj, next] = this._parseMain(value, lines, i); // multi-line object
            dbg.verbose({next, i, value});
            value = obj;
            i = next;
        } else if (value[0] === '{' || value[0] === '[' || value[0] === '(') {
            let [obj, next] = this._parseMain(value, lines, i); // single-line object
            value = obj;
            dbg.verbose({next, i, value});
            i = next;
        } else {
            value = this._escape(value);
        }
        dbg.terse({key, value, i});
        dbg.end();
        return [ key, value, i ];
    },
    // _parseKeyValues: function (currentLine, lines, i) {
    //     dbg.begin();
    //     let [ key, value, next ] = this._parseKeyValue(currentLine, lines, i);
    //     i = next;
    //     i++;
    //     dbg.verbose(next);
    //     dbg.verbose(i);
    //     dbg.end();
    //     return [ key, value, i ];
    // },
    _parseObject: function (currentLine, lines, i) { // parses one object and returns that object and index
        dbg.begin();
        let obj = USEMAP ? new Map() : {};
        if (currentLine.endsWith('}')) { // handle one-line entry
            let line = currentLine.substring(1, currentLine.length - 1);
            let items = this._split(line, ',').map(item => this._escape(item.trim()));
            for (let j = 0; j < items.length; j++) {
                let [ key, value, next ] = this._parseKeyValue(items[j], lines, i);
                USEMAP ? obj.set(key, value) : obj[key] = value;
            }
            dbg.end();
            return [ obj, i ];
        }
        while (true) {
            let [line, next] = this._getLine(lines, i);
            i = next;
            if (line === '}') {
                break;
            } else if (is.var(line[0])) {
                let [key, value, next] = this._parseKeyValue(line, lines, i);
                USEMAP ? obj.set(key, value) : obj[key] = value;
                i = next
            } else {
                throw `line: ${i + 1}: parse error in "${line}"`;
            }
        }
        dbg.end();
        return [ obj, i ]
    },
    _parseArray: function (currentLine, lines, i) { // parses one object and returns that object and index
        dbg.begin();
        let obj = [];
        if (currentLine.endsWith(']')) { // handle one-line entry
            let line = currentLine.substring(1, currentLine.length - 1);
            let items = this._split(line, ',').map(item => this._escape(item.trim()));
            return [ items, i ]
        }
        while (true) {
            let [line, next] = this._getLine(lines, i);
            i = next;
            if (line === ']') {
                break;
            } else if (line[0] === '{' || line[0] === '[' || line[0] === '(') {
                let [newObj, next] = this._parseMain(line, lines, i);
                obj.push(newObj);
                i = next;
            } else { // must be text
                obj.push(this._escape(line));
            }
        }
        dbg.end();
        return [ obj, i ]
    },
    _parseList: function (currentLine, lines, i) { // parses one object and returns that object and index
        dbg.begin();
        let obj = [];
        obj._isList = true; // this little hack will allow us to distinguish a list from an array
        if (currentLine.endsWith(')')) { // handle one-line entry
            let line = currentLine.substring(1, currentLine.length - 1);
            let items = this._split(line, ',').map(item => this._escape(item.trim()));
            for (let j = 0; j < items.length; j++) {
                let [ key, value, next ] = this._parseKeyValue(items[j], lines, i);
                obj.push([key, value]);
            }
            dbg.verbose(obj);
            dbg.verbose(i);
            dbg.end();
            return [ obj, i ];
        }
        while (true) {
            let [line, next] = this._getLine(lines, i);
            i = next;
            if (line === ')') {
                break;
            } else if (is.var(line[0])) {
                let [key, value, next] = this._parseKeyValue(line, lines, i);
                obj.push([key, value]);
                i = next;
            } else {
                throw `line: ${i + 1}: parse error in "${line}"`;
            }
        }
        dbg.verbose(obj);
        dbg.verbose(i);
        dbg.end();
        return [ obj, i ]
    },



    _parseMain: function (currentLine, lines, i) { // the full string and an index into the string, returns {object, i}
        dbg.begin();
        let result = {};
        if (currentLine[0] === '{') {
            result = this._parseObject(currentLine, lines, i);
        } else if (currentLine[0] === '[') {
            result = this._parseArray(currentLine, lines, i);
        } else if (currentLine[0] === '(') {
            result = this._parseList(currentLine, lines, i);
        } else {
            throw `line ${i + 1}: Expected {, [, or ( in "${currentLine}"`;
        }
        dbg.verbose(result);
        dbg.end();
        return result;
    },

    // expects a string which is a PSON string
    // returns an object
    parse: function (s = "{}") {
        is._escapeChars['s'] = ' '; // create special escape character for space
        dbg.begin();
        let lines = s.trim().split('\n');
        lines = this._preprocessLines(lines);
        let [line, i] = this._getLine(lines, 0);
        let [obj, next] = this._parseMain(line, lines, i);
        dbg.end();
        return obj;
    },
    stringify: function(obj) {
    }
}