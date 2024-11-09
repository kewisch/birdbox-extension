/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function main() {
  let space = await browser.runtime.sendMessage({ action: "checkSpace", loadContentScript: true });
  if (!space) {
    return;
  }

  Object.defineProperty(navigator, "userAgent", {
      value: space.useragent || navigator.userAgent.replace(/Thunderbird/g, "Firefox"),
      configurable: false,
      enumerable: true,
      writable: false
  });
}

main();
