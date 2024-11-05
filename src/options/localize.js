/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

for (let node of document.querySelectorAll("[data-l10n-id]")) {
  node.textContent = messenger.i18n.getMessage(node.dataset.l10nId);
}
for (let node of document.querySelectorAll("[data-l10n-attr-placeholder]")) {
  node.setAttribute("placeholder", messenger.i18n.getMessage(node.dataset.l10nAttrPlaceholder));
}
for (let node of document.querySelectorAll("[data-l10n-attr-title]")) {
  node.setAttribute("title", messenger.i18n.getMessage(node.dataset.l10nAttrTitle));
}
