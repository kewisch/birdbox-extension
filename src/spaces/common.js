/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const DEFAULT_IMAGE = browser.runtime.getURL("/images/addon.svg");

export function initLocalize() {
  for (let node of document.querySelectorAll("[data-l10n-id]")) {
    node.textContent = messenger.i18n.getMessage(node.dataset.l10nId);
  }
  for (let node of document.querySelectorAll("[data-l10n-attr-placeholder]")) {
    node.setAttribute("placeholder", messenger.i18n.getMessage(node.dataset.l10nAttrPlaceholder));
  }
  for (let node of document.querySelectorAll("[data-l10n-attr-title]")) {
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

export function setupCustomServer(idPrefix, space) {
  let config = space.config || space.ferdiumConfig;
  let customServerLabel = document.querySelector(`label[for='${idPrefix}-space-custom-server']`);
  let customServer = document.getElementById(`${idPrefix}-space-custom-server`);
  let customServerContainer = document.getElementById(`${idPrefix}-space-custom-server-field`);
  let urlPrefix = document.getElementById(`${idPrefix}-space-url-prefix`);
  let urlSuffix = document.getElementById(`${idPrefix}-space-url-suffix`);
  let hasCustom = config.hasCustomUrl || config.hasTeamId;

  customServerContainer.classList.toggle("hidden", !hasCustom);
  customServerLabel.classList.toggle("hidden", !hasCustom);
  customServerContainer.classList.toggle("suffix", Boolean(config.hasTeamId && config.urlInputSuffix));
  customServerContainer.classList.toggle("prefix", Boolean(config.hasTeamId && config.urlInputPrefix));

  if (hasCustom) {
    customServer.setAttribute("required", "true");
    customServer.setAttribute("minlength", "1");
  } else {
    customServer.removeAttribute("required");
    customServer.removeAttribute("minlength");
  }

  if (config.hasTeamId) {
    customServerLabel.textContent = messenger.i18n.getMessage("browse.team.label");
    customServer.placeholder = messenger.i18n.getMessage("browse.team.placeholder");
  } else {
    customServerLabel.textContent = messenger.i18n.getMessage("browse.customServer.label");
    customServer.placeholder = messenger.i18n.getMessage("browse.customServer.placeholder");
  }

  urlPrefix.textContent = config.urlInputPrefix;
  urlSuffix.textContent = config.urlInputSuffix;

  if (config.hasTeamId && config.urlInputSuffix) {
    customServer.style.paddingInlineEnd = `${urlSuffix.clientWidth + 5}px`;
  }
  if (config.hasTeamId && config.urlInputPrefix) {
    customServer.style.paddingInlineStart = `${urlPrefix.clientWidth + 5}px`;
  }

  if (config.hasCustomUrl && !config.hasTeamId && config.serviceURL) {
    customServer.value = config.serviceURL;
  }
}

export function getTargetUrl(idPrefix, spaceData) {
  if (!spaceData) {
    return null;
  }
  let config = spaceData.config || spaceData.ferdiumConfig;

  let targetUrl = config.serviceURL;
  let teamId = null;
  let customServer = document.getElementById(`${idPrefix}-space-custom-server`).value;
  if (config.hasTeamId) {
    targetUrl = config.serviceURL.replace(/{teamId}/g, customServer);
    teamId = customServer;
  } else if (config.hasCustomUrl) {
    targetUrl = customServer;

    if (targetUrl && !targetUrl.includes("://")) {
      targetUrl = "https://" + targetUrl;
    }
  }

  return { teamId, targetUrl };
}
