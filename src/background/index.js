/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import SpaceStorage from "./spaceStorage.js";

let gSpaceStorage = new SpaceStorage();

async function onBeforeSendHeaders(e) {
  if (e.tabId == -1) {
    return undefined;
  }

  // https://bugzilla.mozilla.org/show_bug.cgi?id=1913581
  // We would love to allow filtering webRequest by spaceId
  let tab = await messenger.tabs.get(e.tabId);
  let spaceInfo = await messenger.spaces.query({ isSelfOwned: true, id: tab.spaceId });
  if (!spaceInfo.length) {
    return undefined;
  }

  if (spaceInfo[0].name == "birdbox_add") {
    return undefined;
  }

  let space = gSpaceStorage.byName(spaceInfo[0].name);

  let foundHdr = e.requestHeaders.find(hdr => hdr.name.toLowerCase() == "user-agent");
  if (!foundHdr) {
    return undefined;
  }

  if (space.useragent) {
    foundHdr.value = space.useragent;
  } else {
    foundHdr.value = foundHdr.value.replace(/Thunderbird/g, "Firefox");
  }
  return { requestHeaders: e.requestHeaders };
}

async function loadSpaces() {
  let [lastTab, ..._rest] = await messenger.tabs.query({ currentWindow: true, active: true });
  let openedSomeTab = false;

  await gSpaceStorage.init();

  await Promise.all(gSpaceStorage.map(async (spaceData) => {
    if (spaceData.startup) {
      messenger.spaces.open(spaceData.id);
      openedSomeTab = true;
    }
  }));

  await createSpaceBrowser();

  if (lastTab && openedSomeTab) {
    await messenger.tabs.update(lastTab.id, { active: true });
  }
}

async function createSpaceBrowser() {
  await messenger.spaces.create(
    "birdbox_add",
    browser.runtime.getURL("/spaces/browse.html#add"),
    {
      title: messenger.i18n.getMessage("browse.title"),
      themeIcons: [{
        light: "/images/plus_light.svg",
        dark: "/images/plus_dark.svg",
        size: 32
      }]
    }
  );
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
        browser.tabs.create({ url: browser.runtime.getURL("/spaces/browse.html") });
      }, 100);
    }
  });

  browser.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action == "addSpace") {
      await gSpaceStorage.add(request.space);
    } else if (request.action == "updateSpace") {
      await gSpaceStorage.update(request.space, request.create ?? false);
    } else if (request.action == "removeSpace") {
      await gSpaceStorage.remove(request.spaceName, request.missingOk ?? false);
    } else if (request.action == "getAllSpaces") {
      return gSpaceStorage.getAll();
    } else if (request.action == "checkSpace") {
      let space = await messenger.spaces.get(sender.tab.spaceId);
      if (!space?.isSelfOwned) {
        return null;
      }

      let spaceData = gSpaceStorage.byName(space.name);

      if (spaceData?.ferdiumId && request.loadContentScript) {
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
    } else if (request.action == "openLink") {
      await messenger.windows.openDefaultBrowser(request.href);
    } else if (request.action == "closeOtherOptions") {
      let tabs = await messenger.tabs.query({ url: messenger.runtime.getURL("/spaces/browse.html") + "*" });
      for (let tab of tabs) {
        if (tab.id != sender.tab.id) {
          await messenger.tabs.remove(tab.id);
        }
      }
    } else {
      return undefined;
    }

    return true;
  });
}

initListeners();
loadSpaces();
