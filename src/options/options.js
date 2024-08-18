function createSpaceItem(spaceData = {}) {
  if (!spaceData.name) {
    spaceData.name = crypto.randomUUID().replace(/-/g, "_");
  }
  if (!spaceData.icon) {
    spaceData.icon = "/images/addon.svg";
  }

  let spacesList = document.getElementById("spaces-list");
  let spaceElementFragment = document.getElementById("space-element-template").content.cloneNode(true);

  let spaceElement = spaceElementFragment.querySelector(".space-item");
  spaceElement._spaceData = spaceData;
  updateSpaceItem(spaceElement);

  spacesList.insertBefore(spaceElementFragment, spacesList.querySelector(".space-item.new-space"));

  return spaceElement;
}

function updateSpaceItem(spaceElement) {
  let spaceData = spaceElement._spaceData;
  spaceElement.title = spaceData.title ?? "";
  spaceElement.querySelector("img").src = spaceData.icon;
}

async function selectSpace(spaceItem) {
  if (spaceItem?.classList.contains("new-space")) {
    spaceItem = createSpaceItem();
  }

  document.querySelector(".space-item.selected")?.classList.remove("selected");
  if (spaceItem) {
    let data = spaceItem._spaceData;

    spaceItem.classList.add("selected");
    document.getElementById("title").value = data.title ?? "";
    document.getElementById("url").value = data.url ?? "";
    document.getElementById("container").value = data.container ?? "firefox-default";
    document.getElementById("notifications").checked = await messenger.birdbox.checkNotificationPermission(data.url);
  }
}

function getSelectedSpace() {
  return document.querySelector(".space-item.selected");
}

async function changeForm(event) {
  let spaceElement = getSelectedSpace();
  let space = spaceElement._spaceData;

  if (event.target.type == "checkbox") {
    space[event.target.id] = event.target.checked;
  } else {
    space[event.target.id] = event.target.value.trim();
  }

  if (event.target.id == "url") {
    try {
      await fetchMetadata(spaceElement);
    } catch (e) {
      console.error(e);
    }
  } else if (event.target.id == "notifications") {
    messenger.birdbox.updateNotifications(space.url, event.target.checked);
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
  let titleElement = document.getElementById("title");

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

  if (document.querySelectorAll("#spaces-list > .space-item.existing-space").length == 0) {
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

async function main() {
  // Initialize Listeners
  document.getElementById("spaces-list").addEventListener("click", (event) => {
    selectSpace(event.target.closest(".space-item"));
  });
  document.getElementById("settings-form").addEventListener("change", changeForm);
  document.getElementById("settings-form").addEventListener("submit", (e) => event.preventDefault());
  document.getElementById("delete").addEventListener("click", deleteSpace);
  document.getElementById("refresh-icon").addEventListener("click", refreshIcon);
  document.getElementById("useragent").placeholder = navigator.userAgent.replace(/Thunderbird/g, "Firefox");


  // Initialize Spaces
  let { spaces } = await messenger.storage.local.get({ spaces: [] });
  spaces.forEach(createSpaceItem);
  if (!spaces.length) {
    createSpaceItem();
  }
  await selectSpace(document.querySelector(".space-item.existing-space"));
}

main();
