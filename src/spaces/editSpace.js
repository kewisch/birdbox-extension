/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DEFAULT_IMAGE = browser.runtime.getURL("/images/addon.svg");

export function createSpaceItem(spaceData = {}) {
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
    let spaceSettings = document.getElementById("edit-space-settings");
    spaceSettings.spaceData = data;

    spaceItem.classList.add("selected");
    document.getElementById("edit-space-debug").textContent = JSON.stringify(data, null, 2);
  }
}

function getSelectedSpace() {
  return document.querySelector(".space-item.selected");
}

async function changeForm(event) {
  if (validateSpace(event.detail)) {
    let spaceElement = getSelectedSpace();
    spaceElement._spaceData = event.detail;
    updateSpaceItem(spaceElement);

    await browser.runtime.sendMessage({ action: "updateSpace", space: event.detail, create: true });
  } else {
    await browser.runtime.sendMessage({ action: "removeSpace", spaceName: event.detail.name, missingOk: true });
  }
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
    } else if (spaceElem) {
      selectSpace(spaceElem);
    }
  });
  document.getElementById("edit-space-settings").addEventListener("change", changeForm);
  document.getElementById("edit-space-delete").addEventListener("click", deleteSpace);

  if (await browser.runtime.sendMessage({ action: "debugEnabled" })) {
    document.getElementById("edit-space-debug").removeAttribute("hidden");
  }
}
