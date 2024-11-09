/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import psl from "../background/libs/psl.min.js";
import { setupCustomServer, getTargetUrl, DEFAULT_IMAGE } from "./common.js";

export function createSpaceItem(spaceData = {}) {
  if (!spaceData.name) {
    spaceData.name = crypto.randomUUID().replace(/-/g, "_");
  }
  if (!spaceData.icon) {
    spaceData.icon = DEFAULT_IMAGE;
  }

  let spacesList = document.getElementById("edit-spaces-list");
  let spaceElementFragment = document.getElementById("space-card-template").content.cloneNode(true);

  let spaceElement = spaceElementFragment.querySelector(".card");
  spaceElement._spaceData = spaceData;
  spaceElement.classList.add("existing-space");
  updateSpaceItem(spaceElement);

  spacesList.insertBefore(spaceElementFragment, document.getElementById("edit-new-space"));
  let editSettings = document.getElementById("edit-settings");
  if (editSettings.classList.contains("no-spaces")) {
    selectSpace(document.querySelector(".space-item.existing-space"));
    editSettings.classList.remove("no-spaces");
  }

  return spaceElement;
}

function updateSpaceItem(spaceElement) {
  let spaceData = spaceElement._spaceData;
  spaceElement.title = spaceData.title ?? "";
  spaceElement.querySelector(".name").textContent = spaceData.title ?? "";

  let icon = spaceData.icon || DEFAULT_IMAGE;
  spaceElement.querySelector("img").src = icon;
}

async function selectSpace(spaceItem) {
  document.querySelector(".space-item.selected")?.classList.remove("selected");
  document.getElementById("edit-space-debug").textContent = "";

  if (spaceItem) {
    let data = spaceItem._spaceData;

    spaceItem.classList.add("selected");
    document.getElementById("edit-space-name").value = data.title ?? "";
    document.getElementById("edit-space-useragent").value = data.useragent ?? "";
    document.getElementById("edit-space-container").value = data.container ?? "firefox-default";
    document.getElementById("edit-space-notifications").checked = data.url ? await messenger.birdbox.checkNotificationPermission(data.url) : false;
    document.getElementById("edit-space-startup").checked = data.startup;
    document.getElementById("edit-space-internal-links").value = data.internalLinks?.join("\n") ?? "";
    document.getElementById("edit-space-internal-links").placeholder = data.url ? new URL(data.url).hostname : "";
    document.getElementById("edit-space-debug").textContent = JSON.stringify(data, null, 2);

    setupCustomServer("edit", data);
    if (data.teamId) {
      document.getElementById("edit-space-custom-server").value = data.teamId ?? "";
    } else {
      document.getElementById("edit-space-custom-server").value = data.url ?? "";
    }

    document.getElementById("edit-settings-form").classList.toggle("custom-service", data.ferdiumId == "birdbox_custom");
  }
}

function getSelectedSpace() {
  return document.querySelector(".space-item.selected");
}

function parseInternalLinks(spaceData, value) {
  let errors = [];
  let lines = new Set(value.split("\n").reduce((acc, val) => {
    if (val.startsWith("http:") || val.startsWith("https:")) {
      let url = new URL(val);
      if (psl.isValid(url.hostname)) {
        acc.push(url.hostname);
      } else {
        errors.push("Invalid Domain: " + url.hostname);
      }
    } else if (psl.isValid(val)) {
      acc.push(val);
    } else if (val.trim() != "") {
      errors.push("Invalid Domain: " + val);
    }
    return acc;
  }, []));

  spaceData.internalLinks = [...lines];

  let linkElement = document.getElementById("edit-space-internal-links");
  let customErrors = errors.join("\n");
  linkElement.setCustomValidity(customErrors);
  linkElement.reportValidity();
  linkElement.title = customErrors;

  if (!customErrors) {
    linkElement.value = spaceData.internalLinks.join("\n");
  }
  return lines;
}

async function changeForm(event) {
  let spaceElement = getSelectedSpace();
  let spaceData = spaceElement._spaceData;

  if (event.target.name == "internal-links") {
    parseInternalLinks(spaceData, event.target.value.trim());
  } else if (event.target.name == "custom-server") {
    let { targetUrl, teamId } = getTargetUrl("edit", spaceData);
    spaceData.url = targetUrl;
    spaceData.teamId = teamId;
  } else if (event.target.type == "checkbox") {
    spaceData[event.target.name] = event.target.checked;
  } else {
    spaceData[event.target.name] = event.target.value.trim();
  }

  if (event.target.name == "url") {
    try {
      await fetchMetadata(spaceElement);
    } catch (e) {
      console.error(e);
    }

    document.getElementById("edit-space-notifications").checked = event.target.url ? await messenger.birdbox.checkNotificationPermission(event.target.url) : null;
    document.getElementById("edit-space-internal-links").setAttribute("placeholder", event.target.value);
  }

  if (validateSpace(spaceData)) {
    await browser.runtime.sendMessage({ action: "updateSpace", space: spaceData, create: true });
  } else {
    await browser.runtime.sendMessage({ action: "removeSpace", spaceName: spaceData.name, missingOk: true });
  }
}

async function fetchMetadata(spaceElement) {
  if (!spaceElement._spaceData.url) {
    return;
  }

  let imageData = DEFAULT_IMAGE;
  let pageTitle = "";
  try {
    let resp = await fetch(spaceElement._spaceData.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    let data = await resp.text();
    let parser = new DOMParser();
    let doc = parser.parseFromString(data, "text/html");
    let icon = doc.querySelector("link[rel~='icon']");

    pageTitle = doc.querySelector("title")?.textContent ?? "";

    let iconUrl = new URL(icon?.getAttribute("href") ?? "/favicon.ico", spaceElement._spaceData.url);
    resp = await fetch(iconUrl, { cache: "no-cache", signal: AbortSignal.timeout(5000) });
    data = await resp.blob();
    imageData = await new Promise((resolve, reject) => {
      if (!resp.ok) {
        resolve(DEFAULT_IMAGE);
        return;
      }

      let reader = new FileReader();
      reader.onloadend = function() {
        if (reader.error) {
          reject(reader.error);
        } else {
          resolve(reader.result);
        }
      };

      reader.readAsDataURL(data);
    });
  } catch (e) {
    // Pass on any other read errors
  }


  let titleElement = document.getElementById("edit-space-name");
  if (!titleElement.value) {
    titleElement.value = pageTitle;
    spaceElement._spaceData.title = titleElement.value;
  }

  spaceElement.querySelector("img").src = imageData;
  spaceElement._spaceData.icon = imageData;
}

function validateSpace(space) {
  return !!space.url;
}

async function deleteSpace() {
  let spaceElement = getSelectedSpace();
  await browser.runtime.sendMessage({ action: "removeSpace", spaceName: spaceElement._spaceData.name });

  let nextSpace = spaceElement.previousElementSibling || spaceElement.nextElementSibling;
  if (nextSpace?.classList.contains("existing-space")) {
    await selectSpace(nextSpace);
  }

  spaceElement.remove();

  if (document.querySelectorAll("#edit-spaces-list > .space-item.existing-space").length == 0) {
    document.getElementById("edit-settings").classList.add("no-spaces");
  }
}

async function refreshIcon() {
  let spaceElement = getSelectedSpace();

  let [space, ..._otherSpaces] = await messenger.spaces.query({ isSelfOwned: true, name: spaceElement._spaceData.name });
  if (!space) {
    return;
  }

  let tabs = await messenger.tabs.query({ spaceId: space.id });
  if (tabs.length) {
    spaceElement._spaceData.icon = tabs[0].favIconUrl;
    updateSpaceItem(spaceElement);
  } else {
    await fetchMetadata(spaceElement);
  }
  await browser.runtime.sendMessage({ action: "updateSpace", space: spaceElement._spaceData });
}

export async function loadEditSpaces() {
  // Initialize Spaces
  let spaces = await browser.runtime.sendMessage({ action: "getAllSpaces" });
  spaces.forEach(createSpaceItem);

 await selectSpace(document.querySelector(".space-item.existing-space"));
}

export async function initEditListeners() {
  // Initialize Listeners
  document.getElementById("edit-spaces-list").addEventListener("click", (event) => {
    let spaceElem = event.target.closest(".space-item, .card");
    if (spaceElem?.classList.contains("new-space")) {
      location.hash = "#add";
    } else {
      selectSpace(spaceElem);
    }
  });
  document.getElementById("edit-settings-form").addEventListener("change", changeForm);
  document.getElementById("edit-settings-form").addEventListener("submit", (e) => event.preventDefault());
  document.getElementById("edit-space-delete").addEventListener("click", deleteSpace);
  document.getElementById("edit-space-refresh-icon").addEventListener("click", refreshIcon);
  document.getElementById("edit-space-useragent").placeholder = navigator.userAgent.replace(/Thunderbird/g, "Firefox");

  if (await browser.runtime.sendMessage({ action: "debugEnabled" })) {
    document.getElementById("edit-space-debug").removeAttribute("hidden");
  }
}
