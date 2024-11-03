/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

browser.runtime.sendMessage({ action: "checkSpace", loadContentScript: true }).then((space) => {
  if (space) {
    Object.defineProperty(navigator, "userAgent", {
        value: navigator.userAgent.replace(/Thunderbird/g, "Firefox"),
        configurable: false,
        enumerable: true,
        writable: false
    });
  }
});
