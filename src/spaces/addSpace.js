/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const POPUP_WIDTH = 500;

import { createSpaceItem } from "./editSpace.js";

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
    let targetUrl = space.config.serviceURL;
    let teamId = null;
    let customServer = document.getElementById("add-space-custom-server").value;
    if (space.config.hasTeamId) {
      targetUrl = space.config.serviceURL.replace(/{teamId}/g, customServer);
      teamId = customServer;
    } else if (space.config.hasCustomUrl) {
      targetUrl = customServer;
    }

    let data = {
      name: crypto.randomUUID().replace(/-/g, "_"),
      title: document.getElementById("add-space-name").value,
      url: targetUrl,
      icon: space.icon,
      container: document.getElementById("add-space-container").value,
      startup: document.getElementById("add-space-startup").checked,
      ferdiumId: space.id,
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
  let space = card._spaceData;
  let hasCustom = space.config.hasCustomUrl || space.config.hasTeamId;
  popup._spaceData = space;
  resetPopup();

  let customServerLabel = document.querySelector("label[for='add-space-custom-server']");
  let customServer = document.getElementById("add-space-custom-server");
  let customServerContainer = document.getElementById("add-space-custom-server-field");
  let urlPrefix = document.getElementById("add-space-url-prefix");
  let urlSuffix = document.getElementById("add-space-url-suffix");

  document.getElementById("add-space-name").value = space.name;
  customServerContainer.classList.toggle("hidden", !hasCustom);
  customServerLabel.classList.toggle("hidden", !hasCustom);
  customServerContainer.classList.toggle("suffix", Boolean(space.config.hasTeamId && space.config.urlInputSuffix));
  customServerContainer.classList.toggle("prefix", Boolean(space.config.hasTeamId && space.config.urlInputPrefix));

  if (hasCustom) {
    customServer.setAttribute("required", "true");
    customServer.setAttribute("minlength", "1");
  } else {
    customServer.removeAttribute("required");
    customServer.removeAttribute("minlength");
  }

  popup.classList.add("attached");

  if (space.config.hasTeamId) {
    customServerLabel.textContent = messenger.i18n.getMessage("browse.team.label");
    customServer.placeholder = messenger.i18n.getMessage("browse.team.placeholder");
  } else {
    customServerLabel.textContent = messenger.i18n.getMessage("browse.customServer.label");
    customServer.placeholder = messenger.i18n.getMessage("browse.customServer.placeholder");
  }

  urlPrefix.textContent = space.config.urlInputPrefix;
  urlSuffix.textContent = space.config.urlInputSuffix;

  if (space.config.hasTeamId && space.config.urlInputSuffix) {
    customServer.style.paddingInlineEnd = `${urlSuffix.clientWidth + 5}px`;
  }
  if (space.config.hasTeamId && space.config.urlInputPrefix) {
    customServer.style.paddingInlineStart = `${urlPrefix.clientWidth + 5}px`;
  }

  let ferdium = await loadFerdiumBackground(space.id);
  customServer._ferdiumValidate = ferdium.validateUrl?.bind(ferdium);
}

async function loadFerdiumBackground(ferdiumId) {
  window.module = {};

  let { promise, resolve, reject } = Promise.withResolvers();


  let script = document.createElement("script");
  script.src = browser.runtime.getURL(`/recipes/${ferdiumId}/index.js`);
  script.id = "background-" + ferdiumId;
  script.addEventListener("load", resolve);
  document.head.appendChild(script);

  await promise;

  var base = class {};

  if (window.module) {
    let ferdiumClass = window.module.exports(base);
    delete window.module;
    return new ferdiumClass();
  }
  return new base();
}

async function validateCustomServer() {
  let popup = document.getElementById("add-space-popup");
  let urlPrefix = document.getElementById("add-space-url-prefix");
  let urlSuffix = document.getElementById("add-space-url-suffix");
  let customServer = document.getElementById("add-space-custom-server");
  let url = urlPrefix.textContent + customServer.value + urlSuffix.textContent;

  if (url && !url.includes("://")) {
    url = "https://" + url;
  }

  let errors = [];
  if (customServer._ferdiumValidate) {
    let valid = await customServer._ferdiumValidate(url);
    if (!valid) {
      errors.push(`Not a valid ${popup._spaceData.name} URL`);
    }
  } else {
    try {
      new URL(url); // eslint-disable-line no-new
    } catch (e) {
      errors.push("Invalid URL: " + url);
    }
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

async function initAddSpaces() {
  let spaces = await fetch("/recipes/spaces.json").then(resp => resp.json());

  let cardTemplate = document.getElementById("space-card-template");
  let cards = document.getElementById("add-space-cards");

  spaces.sort((a, b) => a.name.localeCompare(b.name));

  let customCard = cardTemplate.content.cloneNode(true);
  customCard.querySelector("img").src = browser.runtime.getURL("/images/addon.svg");
  customCard.querySelector(".name").textContent = messenger.i18n.getMessage("browse.customService.label");
  customCard.querySelector(".card")._spaceData = {
    name: messenger.i18n.getMessage("browse.customService.label"),
    icon: browser.runtime.getURL("/images/addon.svg"),
    config: {
      hasCustomUrl: true
    }
  };
  cards.appendChild(customCard);

  for (let space of spaces) {
    let card = cardTemplate.content.cloneNode(true);
    card.querySelector("img").src = browser.runtime.getURL(`/recipes/${space.id}/icon.svg`);
    card.querySelector(".name").textContent = space.name;
    card.querySelector(".card")._spaceData = space;
    cards.appendChild(card);
  }

  cards.addEventListener("click", clickCard);
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

initAddSpaces();
