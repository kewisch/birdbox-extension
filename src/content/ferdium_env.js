/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function require(module) {
  if (module == "path") {
    return {
      join: (...parts) => parts.join("/")
    };
  }

  throw new Error("Unknown module " + module);
}

var module = {};
var __dirname = "";

null; // eslint-disable-line no-unused-expressions
