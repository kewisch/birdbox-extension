/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const POPUP_WIDTH = 500;

async function addSpace(data) {
  // This is hurting my eyes more every time I see it
  let { spaces } = await messenger.storage.local.get({ spaces: [] });
  data.name = crypto.randomUUID().replace(/-/g, "_");
  spaces.push(data);
  await messenger.storage.local.set({ spaces });
  await browser.runtime.sendMessage({ action: "flush" });
}

function unselect() {
  document.querySelector(".card.selected")?.classList.remove("selected");
  document.getElementById("popup")?.classList.remove("attached");
}

function resetPopup() {
  let customServer = document.getElementById("custom-server");
  customServer.value = "";
  customServer.style.paddingInlineStart = "";
  customServer.style.paddingInlineEnd = "";

  let customServerContainer = document.getElementById("custom-server-container");
  customServerContainer.classList.remove("suffix", "prefix");

  document.getElementById("container").selectedIndex = 0;
  document.getElementById("startup").checked = false;
}

async function main() {
  let spaces = await fetch("/recipes/spaces.json").then(resp => resp.json());

  let cardTemplate = document.getElementById("space-card-template");
  let cards = document.getElementById("cards");

  spaces.sort((a, b) => a.name.localeCompare(b.name));

  for (let space of spaces) {
    let card = cardTemplate.content.cloneNode(true);
    card.querySelector("img").src = space.icon;
    card.querySelector(".name").textContent = space.name;
    card.querySelector(".card")._spaceData = space;
    cards.appendChild(card);
  }

  cards.addEventListener("click", async (event) => {
    let popup = document.getElementById("popup");
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

    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${left}px`;
    card.classList.add("selected");

    // Setup data
    let space = card._spaceData;
    let hasCustom = space.config.hasCustomUrl || space.config.hasTeamId;
    popup._spaceData = space;
    resetPopup();

    let customServerLabel = document.querySelector("label[for='custom-server']");
    let customServer = document.getElementById("custom-server");
    let customServerContainer = document.getElementById("custom-server-container");
    let urlPrefix = document.getElementById("url-prefix");
    let urlSuffix = document.getElementById("url-suffix");

    document.getElementById("name").value = space.name;
    customServerContainer.classList.toggle("hidden", !hasCustom);
    customServerLabel.classList.toggle("hidden", !hasCustom);
    customServerContainer.classList.toggle("suffix", Boolean(space.config.hasTeamId && space.config.urlInputSuffix));
    customServerContainer.classList.toggle("prefix", Boolean(space.config.hasTeamId && space.config.urlInputPrefix));

    popup.classList.add("attached");

    if (space.config.hasTeamId) {
      customServerLabel.textContent = "Team:";
      customServer.placeholder = "Team";
    } else {
      customServerLabel.textContent = "Custom Server:";
      customServer.placeholder = "Service URL (https://...)";
    }


    urlPrefix.textContent = space.config.urlInputPrefix;
    urlSuffix.textContent = space.config.urlInputSuffix;

    if (space.config.hasTeamId && space.config.urlInputSuffix) {
      customServer.style.paddingInlineEnd = `${urlSuffix.clientWidth + 5}px`;
    }
    if (space.config.hasTeamId && space.config.urlInputPrefix) {
      customServer.style.paddingInlineStart = `${urlPrefix.clientWidth + 5}px`;
    }
  });

  document.getElementById("add").addEventListener("click", () => {
    let space = document.querySelector(".card.selected")?._spaceData;
    if (space) {
      let targetUrl = space.config.serviceURL;
      let customServer = document.getElementById("custom-server").value;
      if (space.config.hasTeamId) {
        targetUrl = space.config.serviceURL.replace(/{teamId}/g, customServer);
      } else if (space.config.hasCustomUrl) {
        targetUrl = customServer;
      }

      addSpace({
        title: document.getElementById("name").value,
        url: targetUrl,
        icon: space.icon,
        container: document.getElementById("container").value,
        startup: document.getElementById("startup").checked,
      });
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key == "Escape") {
      unselect();
    }
  });
}

main();
