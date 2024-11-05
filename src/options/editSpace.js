/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import psl from "../background/libs/psl.min.js";

function createSpaceItem(spaceData = {}) {
  if (!spaceData.name) {
    spaceData.name = crypto.randomUUID().replace(/-/g, "_");
  }
  if (!spaceData.icon && !spaceData.ferdiumId) {
    spaceData.icon = "/images/addon.svg";
  }

  let spacesList = document.getElementById("edit-spaces-list");
  let spaceElementFragment = document.getElementById("space-card-template").content.cloneNode(true);

  let spaceElement = spaceElementFragment.querySelector(".card");
  spaceElement._spaceData = spaceData;
  spaceElement.classList.add("existing-space");
  updateSpaceItem(spaceElement);

  spacesList.insertBefore(spaceElementFragment, document.getElementById("edit-new-space"));

  return spaceElement;
}

function updateSpaceItem(spaceElement) {
  let spaceData = spaceElement._spaceData;
  spaceElement.title = spaceData.title ?? "";
  spaceElement.querySelector(".name").textContent = spaceData.title ?? "";

  let icon = spaceData.ferdiumId ? browser.runtime.getURL(`/recipes/${spaceData.ferdiumId}/icon.svg`) : spaceData.icon;
  spaceElement.querySelector("img").src = icon;
}

async function selectSpace(spaceItem) {
  document.querySelector(".space-item.selected")?.classList.remove("selected");
  if (spaceItem) {
    let data = spaceItem._spaceData;

    spaceItem.classList.add("selected");
    document.getElementById("edit-space-name").value = data.title ?? "";
    document.getElementById("edit-space-url").value = data.url ?? "";
    document.getElementById("edit-space-useragent").value = data.useragent ?? "";
    document.getElementById("edit-space-container").value = data.container ?? "firefox-default";
    document.getElementById("edit-space-notifications").checked = data.url ? await messenger.birdbox.checkNotificationPermission(data.url) : false;
    document.getElementById("edit-space-startup").checked = data.startup;
    document.getElementById("edit-space-internal-links").value = data.internalLinks?.join("\n") ?? "";
    document.getElementById("edit-space-internal-links").placeholder = data.url ? new URL(data.url).hostname : "";

    document.getElementById("edit-space-url").disabled = !!data.ferdiumId;
    if (data.ferdiumId) {
      document.getElementById("edit-settings-form").dataset.ferdiumId = data.ferdiumId;
    } else {
      delete document.getElementById("edit-settings-form").dataset.ferdiumId;
    }
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
  } else if (event.target.name == "notifications") {
    messenger.birdbox.updateNotifications(spaceData.url, event.target.checked);
  }

  await flush();
}

async function fetchMetadata(spaceElement) {
  if (!spaceElement._spaceData.url) {
    return;
  }

  let resp = await fetch(spaceElement._spaceData.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });

  let data = await resp.text();
  let parser = new DOMParser();
  let doc = parser.parseFromString(data, "text/html");
  let icon = doc.querySelector("link[rel~='icon']");
  let titleElement = document.getElementById("edit-space-name");

  let iconUrl = new URL(icon?.getAttribute("href") ?? "/favicon.ico", spaceElement._spaceData.url);
  resp = await fetch(iconUrl, { cache: "no-cache", signal: AbortSignal.timeout(5000) });
  data = await resp.blob();
  let imageData = await new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onloadend = function() {
      if (reader.error) {
        resolve("/images/addon.svg");
      } else {
        resolve(reader.result);
      }
    };

    reader.readAsDataURL(data);
  });

  if (!titleElement.value) {
    titleElement.value = doc.querySelector("title")?.textContent ?? "";
    spaceElement._spaceData.title = titleElement.value;
  }

  spaceElement.querySelector("img").src = imageData;
  spaceElement._spaceData.icon = imageData;
}

function validateSpace(space) {
  return !!space.url;
}

async function flush() {
  let spaces = [...document.querySelectorAll(".space-item.existing-space")];
  let data = spaces.map(space => space._spaceData).filter(validateSpace);

  await messenger.storage.local.set({ spaces: data });
  await browser.runtime.sendMessage({ action: "flush" });
}

async function deleteSpace() {
  let spaceElement = getSelectedSpace();
  spaceElement._spaceData = {};
  await flush();

  let nextSpace = spaceElement.previousElementSibling || spaceElement.nextElementSibling;
  if (nextSpace?.classList.contains("existing-space")) {
    await selectSpace(nextSpace);
  }

  spaceElement.remove();

  if (document.querySelectorAll("#edit-spaces-list > .space-item.existing-space").length == 0) {
    await selectSpace(createSpaceItem());
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
    await flush();
  } else {
    await fetchMetadata(spaceElement);
  }
}

async function initEditSpaces() {
  // Initialize Listeners
  document.getElementById("edit-spaces-list").addEventListener("click", (event) => {
    let spaceElem = event.target.closest(".space-item, .card");
    if (spaceElem?.classList.contains("new-space")) {
      document.querySelector(".page-container").classList.toggle('active');
    } else {
      selectSpace(spaceElem);
    }
  });
  document.getElementById("edit-settings-form").addEventListener("change", changeForm);
  document.getElementById("edit-settings-form").addEventListener("submit", (e) => event.preventDefault());
  document.getElementById("edit-space-delete").addEventListener("click", deleteSpace);
  document.getElementById("edit-space-refresh-icon").addEventListener("click", refreshIcon);
  document.getElementById("edit-space-useragent").placeholder = navigator.userAgent.replace(/Thunderbird/g, "Firefox");

  // Initialize Spaces
  let { spaces } = await messenger.storage.local.get({ spaces: [] });
  spaces.forEach(createSpaceItem);
  if (!spaces.length) {
    createSpaceItem();
  }
  await selectSpace(document.querySelector(".space-item.existing-space"));
}

initEditSpaces();
