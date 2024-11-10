/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export function initLocalize(root = document) {
  for (let node of root.querySelectorAll("[data-l10n-id]")) {
    node.textContent = messenger.i18n.getMessage(node.dataset.l10nId);
  }
  for (let node of root.querySelectorAll("[data-l10n-attr-placeholder]")) {
    node.setAttribute("placeholder", messenger.i18n.getMessage(node.dataset.l10nAttrPlaceholder));
  }
  for (let node of root.querySelectorAll("[data-l10n-attr-title]")) {
    node.setAttribute("title", messenger.i18n.getMessage(node.dataset.l10nAttrTitle));
  }
}

export async function initHash() {
  let container = document.querySelector(".page-container");

  let spaces = await browser.runtime.sendMessage({ action: "getAllSpaces" });
  if (!spaces.length) {
    location.hash = "#add";
  }

  container.classList.add("notransition");
  container.classList.toggle("edit", (location.hash == "#edit"));
  requestAnimationFrame(() => {
    container.classList.remove("notransition");
  });

  window.addEventListener("hashchange", () => {
    if (location.hash) {
      container.classList.toggle("edit", (location.hash == "#edit"));
    }
  });

  browser.runtime.sendMessage({ action: "closeOtherOptions" });
}
