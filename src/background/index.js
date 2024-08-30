/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function onBeforeSendHeaders(e) {
  if (e.tabId == -1) {
    return undefined;
  }

  // https://bugzilla.mozilla.org/show_bug.cgi?id=1913581
  let tab = await messenger.tabs.get(e.tabId);
  let spaceInfo = await messenger.spaces.query({ isSelfOwned: true, id: tab.spaceId });
  if (!spaceInfo.length) {
    return undefined;
  }

  // TODO this isn't really performant, see if we can change this to a lookup
  let { spaces } = await messenger.storage.local.get({ spaces: [] });
  let thisSpace = spaces.find(spc => spc.name == spaceInfo[0].name);

  let foundHdr = e.requestHeaders.find(hdr => hdr.name.toLowerCase() == "user-agent");
  if (!foundHdr) {
    return undefined;
  }

  if (thisSpace.useragent) {
    foundHdr.value = thisSpace.useragent;
  } else {
    foundHdr.value = foundHdr.value.replace(/Thunderbird/g, "Firefox");
  }
  return { requestHeaders: e.requestHeaders };
}

async function loadSpaces() {
  let { spaces } = await messenger.storage.local.get({ spaces: [] });

  let [lastTab, ..._rest] = await messenger.tabs.query({ currentWindow: true, active: true });

  for (let space of spaces) {
    let spaceInfo = await messenger.spaces.create(space.name, space.url, { defaultIcons: space.icon, title: space.title });
    messenger.birdbox.updateCookieStore(space.name, space.container || "firefox-default");

    if (space.startup) {
      await messenger.spaces.open(spaceInfo.id);
    }
  }

  if (lastTab) {
    await messenger.tabs.update(lastTab.id, { active: true });
  }
}

async function flush() {
  let { spaces } = await messenger.storage.local.get({ spaces: [] });

  let ownSpaces = await messenger.spaces.query({ isSelfOwned: true });
  let spaceMap = Object.fromEntries(ownSpaces.map(space => [space.name, space]));

  await Promise.all(spaces.map(async spaceData => {
    if (spaceData.name in spaceMap) {
      let spaceId = spaceMap[spaceData.name].id;
      await messenger.spaces.update(spaceId, spaceData.url, { defaultIcons: spaceData.icon, title: spaceData.title });
      delete spaceMap[spaceData.name];

      let tabs = await messenger.tabs.query({ spaceId });
      await Promise.all(tabs.map(tab => {
        return messenger.tabs.sendMessage(tab.id, { action: "updateSpaceSettings", space: spaceData });
      }));
    } else {
      await messenger.spaces.create(spaceData.name, spaceData.url, { defaultIcons: spaceData.icon, title: spaceData.title });
    }

    await messenger.birdbox.updateCookieStore(spaceData.name, spaceData.container || "firefox-default");
  }));

  for (let space of Object.values(spaceMap)) {
    await messenger.spaces.remove(space.id);
  }
}


function initListeners() {
  browser.webRequest.onBeforeSendHeaders.addListener(
    onBeforeSendHeaders,
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
  );

  messenger.runtime.onInstalled.addListener(({ reason }) => {
    if (reason == "install") {
      setTimeout(() => {
        browser.runtime.openOptionsPage();
      }, 100);
    }
  });

  browser.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action == "flush") {
      return flush();
    } else if (request.action == "checkSpace") {
      let space = await messenger.spaces.get(sender.tab.spaceId);
      if (!space?.isSelfOwned) {
        return null;
      }

      let { spaces } = await messenger.storage.local.get({ spaces: [] });
      return spaces.find(spaceData => spaceData.name == space.name);
    } else if (request.action == "badge") {
      await messenger.spaces.update(sender.tab.spaceId, { badgeText: request.count });
      return true;
    } else if (request.action == "openLink") {
      await messenger.windows.openDefaultBrowser(request.href);
      return true;
    }

    return undefined;
  });
}

initListeners();
loadSpaces();
