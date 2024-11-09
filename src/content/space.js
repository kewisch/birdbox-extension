/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function main() {
 let spaceData = await browser.runtime.sendMessage({ action: "checkSpace" });
  if (!spaceData) {
    return;
  }

  browser.runtime.onMessage.addListener(async (data) => {
    if (data.action == "updateSpaceSettings") {
      spaceData = data.space;
    }
  });

  window.addEventListener("click", (event) => {
    let anchor = event.target.closest("a");
    if (!anchor) {
      return;
    }
    let url = new URL(anchor.getAttribute("href"), window.location);

    if (window.origin != url.origin && !spaceData.internalLinks?.some(host => url.hostname.endsWith(host))) {
      browser.runtime.sendMessage({ action: "openLink", href: url.href });
      event.preventDefault();
    }
  }, { capture: true });
}

main();
