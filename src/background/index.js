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

  if (spaceInfo[0].name == "birdbox_add") {
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
    let icon = space.ferdiumId ? browser.runtime.getURL(`/recipes/${space.ferdiumId}/icon.svg`) : space.icon;
    let spaceInfo = await messenger.spaces.create(space.name, space.url, { defaultIcons: icon, title: space.title });
    messenger.birdbox.updateCookieStore(space.name, space.container || "firefox-default");

    if (space.startup) {
      await messenger.spaces.open(spaceInfo.id);
    }
  }

  await createSpaceBrowser();

  if (lastTab) {
    await messenger.tabs.update(lastTab.id, { active: true });
  }
}

async function createSpaceBrowser() {
  await messenger.spaces.create(
    "birdbox_add",
    browser.runtime.getURL("options/browse.html"),
    {
      title: "Birdbox",
      themeIcons: [{
        light: "/images/plus_light.svg",
        dark: "/images/plus_dark.svg",
        size: 32
      }]
    }
  );
}

async function flush() {
  let { spaces } = await messenger.storage.local.get({ spaces: [] });

  let ownSpaces = await messenger.spaces.query({ isSelfOwned: true });
  let spaceMap = Object.fromEntries(ownSpaces.map(space => [space.name, space]));

  await Promise.all(spaces.map(async spaceData => {
    let icon = spaceData.ferdiumId ? browser.runtime.getURL(`/recipes/${spaceData.ferdiumId}/icon.svg`) : spaceData.icon;
    if (spaceData.name in spaceMap) {
      let spaceId = spaceMap[spaceData.name].id;
      await messenger.spaces.update(spaceId, spaceData.url, { defaultIcons: icon, title: spaceData.title });
      delete spaceMap[spaceData.name];

      let tabs = await messenger.tabs.query({ spaceId });
      await Promise.all(tabs.map(tab => {
        return messenger.tabs.sendMessage(tab.id, { action: "updateSpaceSettings", space: spaceData });
      }));
    } else {
      await messenger.spaces.create(spaceData.name, spaceData.url, { defaultIcons: icon, title: spaceData.title });
    }

    await messenger.birdbox.updateCookieStore(spaceData.name, spaceData.container || "firefox-default");
  }));

  for (let space of Object.values(spaceMap)) {
    await messenger.spaces.remove(space.id);
  }

  await createSpaceBrowser();
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
      let spaceData = spaces.find(spaceData_ => spaceData_.name == space.name);

      if (spaceData?.ferdiumId && request.loadContentScript) {
        console.log("executing script", spaceData.contentScript);
        await browser.tabs.executeScript(sender.tab.id, {
          file: "/content/ferdium_env.js"
        });

        // Some recipes will have a function at the end that is not serializable. Add a null value
        // to avoid errors.
        let webviewCode = await fetch(browser.runtime.getURL(`/recipes/${spaceData.ferdiumId}/webview.js`)).then(resp => resp.text());
        await browser.tabs.executeScript(sender.tab.id, {
          code: webviewCode + "; null;"
        });

        await browser.tabs.executeScript(sender.tab.id, {
          file: "/content/ferdium_exec.js"
        });
      }

      return space;
    } else if (request.action == "injectCSS") {
      await browser.tabs.insertCSS(sender.tab.id, {
        file: request.path
      });
    } else if (request.action == "badge") {
      await messenger.spaces.update(sender.tab.spaceId, { badgeText: (request.direct || "").toString() });
      return true;
    } else if (request.action == "openLink") {
      await messenger.windows.openDefaultBrowser(request.href);
      return true;
    } else if (request.action == "loadContentScript") {
      let space = await messenger.spaces.get(sender.tab.spaceId);
      if (!space?.isSelfOwned) {
        return null;
      }
    }

    return undefined;
  });
}

initListeners();
loadSpaces();
