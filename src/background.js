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

  for (let space of spaces) {
    await messenger.spaces.create(space.name, space.url, { defaultIcons: space.icon, title: space.title });
    messenger.birdbox.updateCookieStore(space.name, space.container || "firefox-default");
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

  browser.contentScripts.register({
    allFrames: true,
    matches: ["<all_urls>"],
    runAt: "document_start",
    js: [{
      code: "(" + function() {
        Object.defineProperty(navigator, "userAgent", {
            value: navigator.userAgent.replace(/Thunderbird/g, "Firefox"),
            configurable: false,
            enumerable: true,
            writable: false
        });
      } + ")()"
    }],
  });

  browser.contentScripts.register({
    matches: ["<all_urls>"],
    runAt: "document_end",
    js: [{
      code: "(" + async function() {
        let ok = await browser.runtime.sendMessage({ action: "checkSpace" });
        if (!ok) {
          return;
        }

        new MutationObserver((mutations) => {
            let title = mutations[0].target.textContent;

            let match = title?.match(/\(\d+\)/);
            browser.runtime.sendMessage({ action: "badge", count: match?.[1] || "" });
        }).observe(
            document.querySelector("title"),
            { subtree: true, characterData: true, childList: true }
        );
      } + ")()"
    }],
  });

  // browser.contentScripts.register({
  //  matches: ["<all_urls>"],
  //  runAt: "document_end",
  //  js: [{
  //    code: "(" + async function() {
  //      let icon = document.querySelector("link[rel~='icon']");
  //      let response = await fetch(icon?.href || (window.location.origin + "/favicon.ico"));
  //      let blob = await response.blob();
  //      let reader = new FileReader();
  //      reader.onloadend = function() {
  //        browser.runtime.sendMessage({
  //          action: "icon",
  //          icon: reader.result
  //        });
  //      }
  //      reader.readAsDataURL(blob);
  //    } + ")()"
  //  }],
  // });

  browser.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action == "flush") {
      let { spaces } = await messenger.storage.local.get({ spaces: [] });

      let ownSpaces = await messenger.spaces.query({ isSelfOwned: true });
      let spaceMap = Object.fromEntries(ownSpaces.map(space => [space.name, space]));

      for (let spaceData of spaces) {
        if (spaceData.name in spaceMap) {
          await messenger.spaces.update(spaceMap[spaceData.name].id, spaceData.url, { defaultIcons: spaceData.icon, title: spaceData.title });
          delete spaceMap[spaceData.name];
        } else {
          await messenger.spaces.create(spaceData.name, spaceData.url, { defaultIcons: spaceData.icon, title: spaceData.title });
          delete spaceMap[spaceData.name];
        }

        await messenger.birdbox.updateCookieStore(spaceData.name, spaceData.container || "firefox-default");
      }

      for (let space of Object.values(spaceMap)) {
        await messenger.spaces.remove(space.id);
      }
    } else if (request.action == "checkSpace") {
      let space = await messenger.spaces.get(sender.tab.spaceId);
      return space?.isSelfOwned;
    } else if (request.action == "badge") {
      await messenger.spaces.update(sender.tab.spaceId, { badgeText: request.count });
      return true;
    }

    return undefined;
  });
}

initListeners();
loadSpaces();
