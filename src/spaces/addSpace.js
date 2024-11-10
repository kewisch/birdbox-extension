/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const POPUP_WIDTH = 500;

import { createSpaceItem } from "./editSpace.js";

function unselect() {
  document.querySelector("#add-mode .card.selected")?.classList.remove("selected");
  document.getElementById("add-space-popup")?.classList.remove("attached");
}

async function clickAddSpace() {
  let details = document.getElementById("add-space-details");
  if (!details.validate()) {
    return;
  }

  let space = document.querySelector(".card.selected")?._spaceData;
  if (space) {
    let { teamId, targetUrl } = details.targetUrl;
    let icon = space.icon || browser.runtime.getURL(`/recipes/${space.id}/icon.svg`);

    let data = {
      name: crypto.randomUUID().replace(/-/g, "_"),
      title: details.field("space-name"),
      url: targetUrl,
      icon: icon,
      container: details.field("space-container"),
      notifications: details.field("space-notifications"),
      startup: details.field("space-startup"),
      useragent: details.field("space-useragent"),
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
  popup.classList.add("attached");
  document.getElementById("add-space-details").spaceData = {
    ferdiumId: card._spaceData.id,
    title: card._spaceData.name,
    ferdiumConfig: card._spaceData.config
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
