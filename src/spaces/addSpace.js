/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const POPUP_WIDTH = 500;

import { createSpaceItem } from "./editSpace.js";
import { setupCustomServer, getTargetUrl, DEFAULT_IMAGE } from "./common.js";

function unselect() {
  document.querySelector("#add-mode .card.selected")?.classList.remove("selected");
  document.getElementById("add-space-popup")?.classList.remove("attached");
}

function resetPopup() {
  let customServer = document.getElementById("add-space-custom-server");
  customServer.value = "";
  customServer.style.paddingInlineStart = "";
  customServer.style.paddingInlineEnd = "";

  document.getElementById("add-space-url-prefix").textContent = "";
  document.getElementById("add-space-url-suffix").textContent = "";

  let customServerContainer = document.getElementById("add-space-custom-server-field");
  customServerContainer.classList.remove("suffix", "prefix");

  document.getElementById("add-space-container").selectedIndex = 0;
  document.getElementById("add-space-notifications").checked = true;
  document.getElementById("add-space-startup").checked = false;
  document.getElementById("add-space-popup").classList.remove("showfailure");
}

async function clickAddSpace() {
  if (!document.getElementById("add-space-popup").checkValidity()) {
    document.getElementById("add-space-popup").classList.add("showfailure");
    return;
  }
  let space = document.querySelector(".card.selected")?._spaceData;
  if (space) {
    let { teamId, targetUrl } = getTargetUrl("add", space);

    let icon = space.icon;
    if (!icon) {
      icon = space.id ? browser.runtime.getURL(`/recipes/${space.id}/icon.svg`) : DEFAULT_IMAGE;
    }

    let data = {
      name: crypto.randomUUID().replace(/-/g, "_"),
      title: document.getElementById("add-space-name").value,
      url: targetUrl,
      icon: icon,
      container: document.getElementById("add-space-container").value,
      notifications: document.getElementById("add-space-notifications").checked,
      startup: document.getElementById("add-space-startup").checked,
      ferdiumId: space.id,
      ferdiumConfig: space.config,
      teamId: teamId,
    };

    await browser.runtime.sendMessage({ action: "addSpace", space: data });
    createSpaceItem(data);
    unselect();
  }
}

async function clickCard(event) {
  let popup = document.getElementById("add-space-popup");
  let card = event.target.closest(".card");
  if (!card || !card._spaceData) {
    return;
  }
  unselect();


  // Positioning
  let rect = card.getBoundingClientRect();
  let left = rect.left;

  if (rect.left + POPUP_WIDTH > window.innerWidth) {
    left = rect.right - POPUP_WIDTH;
  }

  let scrollTop = document.getElementById("add-mode").scrollTop;

  popup.style.top = `${rect.bottom + scrollTop}px`;
  popup.style.left = `${left}px`;
  card.classList.add("selected");

  // Setup data
  resetPopup();
  popup._spaceData = card._spaceData;
  popup.classList.add("attached");
  setupCustomServer("add", popup._spaceData);
  document.getElementById("add-space-name").value = popup._spaceData.name;
}

async function validateCustomServer() {
  let customServer = document.getElementById("add-space-custom-server");
  if (!customServer.hasAttribute("required")) {
    return;
  }

  let spaceData = document.getElementById("add-space-popup")._spaceData;
  let { targetUrl } = getTargetUrl("add", spaceData);
  let errors = [];

  let valid = await browser.runtime.sendMessage({
    action: "validateFerdiumUrl",
    ferdiumId: spaceData.ferdiumId,
    url: targetUrl
  });

  if (valid === null) {
    // null means no validator, just use a simple URL validation
    try {
      new URL(targetUrl); // eslint-disable-line no-new
    } catch (e) {
      errors.push("Invalid URL: " + targetUrl);
    }
  } else if (!valid) {
    errors.push(`Not a valid ${spaceData.name} URL`);
  }

  customServer.setCustomValidity(errors);
  customServer.reportValidity();
}

function debounce(func, delay) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}


export async function loadAddSpaces() {
  let spaces = await fetch("/recipes/spaces.json").then(resp => resp.json());
  let featured = await fetch("/recipes/featured.json").then(resp => resp.json());

  let cardTemplate = document.getElementById("space-card-template");
  let allCardsContainer = document.getElementById("add-space-all-cards");
  let featuredCardsContainer = document.getElementById("add-space-featured-cards");
  let cardMap = {};

  spaces.sort((a, b) => a.name.localeCompare(b.name));

  for (let space of spaces) {
    let card = cardTemplate.content.cloneNode(true);
    card.querySelector("img").src = space.icon || browser.runtime.getURL(`/recipes/${space.id}/icon.svg`);
    card.querySelector(".name").textContent = space.name;
    card.querySelector(".card")._spaceData = space;

    cardMap[space.id] = card.firstElementChild;
    allCardsContainer.appendChild(card);
  }

  for (let spaceId of featured) {
    let card = cardMap[spaceId].cloneNode(true);
    card._spaceData = cardMap[spaceId]._spaceData;
    featuredCardsContainer.appendChild(card);
  }
}

export async function initAddSpaces() {
  document.getElementById("add-space-all-cards").addEventListener("click", clickCard);
  document.getElementById("add-space-featured-cards").addEventListener("click", clickCard);
  document.getElementById("add-space-add-button").addEventListener("click", clickAddSpace);
  document.getElementById("add-space-custom-server").addEventListener("input", debounce(validateCustomServer, 500));
  document.getElementById("add-space-popup").addEventListener("submit", (e) => event.preventDefault());
  document.getElementById("add-mode").addEventListener("click", (event) => {
    if (!event.target.closest("#add-space-popup, .card.selected")) {
      unselect();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key == "Escape") {
      unselect();
    }
  });
  document.getElementById("edit-spaces-button").addEventListener("click", () => {
    location.hash = "#edit";
  });
}
