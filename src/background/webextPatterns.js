// https://github.com/fregante/webext-patterns
//
// MIT License
//
// Copyright (c) Federico Brigante <me@fregante.com> (https://fregante.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var webextPatterns = (function(exports) {
    "use strict";

    function escapeStringRegexp(string) {
        if (typeof string !== "string") {
            throw new TypeError("Expected a string");
        }
        return string
            .replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
            .replace(/-/g, "\\x2d");
    }

    const patternValidationRegex = /^(https?|wss?|file|ftp|\*):\/\/(\*|\*\.[^*/]+|[^*/]+)\/.*$|^file:\/\/\/.*$|^resource:\/\/(\*|\*\.[^*/]+|[^*/]+)\/.*$|^about:/;
    const isFirefox = globalThis.navigator?.userAgent.includes("Firefox/");
    const allStarsRegex = isFirefox
        ? /^(https?|wss?):[/][/][^/]+([/].*)?$/
        : /^https?:[/][/][^/]+([/].*)?$/;
    const allUrlsRegex = /^(https?|file|ftp):[/]+/;
    function assertValidPattern(matchPattern) {
        if (!isValidPattern(matchPattern)) {
            throw new Error(matchPattern + " is an invalid pattern. See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns for more info.");
        }
    }
    function isValidPattern(matchPattern) {
        return matchPattern === "<all_urls>" || patternValidationRegex.test(matchPattern);
    }
    function doesUrlMatchPatterns(url, ...patterns) {
        if (patterns.includes("<all_urls>") && allUrlsRegex.test(url)) {
            return true;
        }
        if (patterns.includes("*://*/*") && allStarsRegex.test(url)) {
            return true;
        }
        for (const pattern of patterns) {
            if (patternToRegex(pattern).test(url)) {
                return true;
            }
        }
        return false;
    }
    function findMatchingPatterns(url, ...patterns) {
        return patterns.filter(pattern => doesUrlMatchPatterns(url, pattern));
    }
    function getRawPatternRegex(matchPattern) {
        assertValidPattern(matchPattern);
        let [, protocol, host = "", pathname] = matchPattern.split(/(^[^:]+:[/][/])([^/]+)?/);
        protocol = protocol
            .replace("*", isFirefox ? "(https?|wss?)" : "https?")
            .replaceAll(/[/]/g, "[/]");
        if (host === "*") {
            host = "[^/]+";
        }
        host &&= host
            .replace(/^[*][.]/, "([^/]+.)*")
            .replaceAll(/[.]/g, "[.]")
            .replace(/[*]$/, "[^.]+");
        pathname = pathname
            .replaceAll(/[/]/g, "[/]")
            .replaceAll(/[.]/g, "[.]")
            .replaceAll(/[*]/g, ".*");
        return "^" + protocol + host + "(" + pathname + ")?$";
    }
    function patternToRegex(...matchPatterns) {
        if (matchPatterns.length === 0) {
            return /$./;
        }
        if (matchPatterns.includes("<all_urls>")) {
            return allUrlsRegex;
        }
        if (matchPatterns.includes("*://*/*")) {
            return allStarsRegex;
        }
        return new RegExp(matchPatterns.map(x => getRawPatternRegex(x)).join("|"));
    }
    const globSymbols = /([?*]+)/;
    function splitReplace(part, index) {
        if (part === "") {
            return "";
        }
        if (index % 2 === 0) {
            return escapeStringRegexp(part);
        }
        if (part.includes("*")) {
            return ".*";
        }
        return [...part].map(() => (isFirefox ? "." : ".?")).join("");
    }
    function getRawGlobRegex(glob) {
        const regexString = glob
            .split(globSymbols)
            .map(splitReplace)
            .join("");
        return ("^" + regexString + "$")
            .replace(/^[.][*]/, "")
            .replace(/[.][*]$/, "")
            .replace(/^[$]$/, ".+");
    }
    function globToRegex(...globs) {
        if (globs.length === 0) {
            return /.*/;
        }
        return new RegExp(globs.map(x => getRawGlobRegex(x)).join("|"));
    }
    function excludeDuplicatePatterns(matchPatterns) {
        if (matchPatterns.includes("<all_urls>")) {
            return ["<all_urls>"];
        }
        if (matchPatterns.includes("*://*/*")) {
            return ["*://*/*"];
        }
        return matchPatterns.filter(possibleSubset => !matchPatterns.some(possibleSuperset => possibleSubset !== possibleSuperset && patternToRegex(possibleSuperset).test(possibleSubset)));
    }

    exports.allStarsRegex = allStarsRegex;
    exports.allUrlsRegex = allUrlsRegex;
    exports.assertValidPattern = assertValidPattern;
    exports.doesUrlMatchPatterns = doesUrlMatchPatterns;
    exports.excludeDuplicatePatterns = excludeDuplicatePatterns;
    exports.findMatchingPatterns = findMatchingPatterns;
    exports.globToRegex = globToRegex;
    exports.isValidPattern = isValidPattern;
    exports.patternToRegex = patternToRegex;
    exports.patternValidationRegex = patternValidationRegex;

    return exports;
})({});

export default webextPatterns;
