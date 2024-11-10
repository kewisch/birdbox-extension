/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global module */

(async function() {
  if (!module.exports) {
    return;
  }

  let spaceData = await browser.runtime.sendMessage({ action: "checkSpace" });
  if (!spaceData) {
    return;
  }

  browser.runtime.onMessage.addListener(async (data) => {
    if (data.action == "updateSpaceSettings") {
      spaceData = data.space;
    }
  });

  // Here are the ferdium settings shared with the webview
  const settings = {
    id: spaceData.name,
    spellcheckerLanguage: false,
    isDarkModeEnabled: false,
    isProgressbarEnabled: false,
    darkReaderSettings: {
      brightness: 100,
      contrast: 90,
      sepia: 10
    },
    team: spaceData.teamId,
    url: spaceData.url,
    hasCustomIcon: false,
    onlyShowFavoritesInUnreadCount: false,
    trapLinkClicks:  false
  };

  // This is the main Ferdium object we'll pass to the webview
  let _looper = null;
  let ferdium = {
    setBadge(direct, indirect) {
      browser.runtime.sendMessage({ action: "badge", direct, indirect });
    },

    setDialogTitle(title) {
      // Not spewing a warning here since this is usually called on a loop
    },

    injectCSS(...paths) {
      for (let path of paths) {
        let fullPath = browser.runtime.getURL(`/recipes/${spaceData.recipeId}/${path}`);
        browser.runtime.sendMessage({ action: "injectCSS", path: fullPath });
      }
    },

    injectJSUnsafe(...paths) {
      for (let path of paths) {
        let fullPath = browser.runtime.getURL(`/recipes/${spaceData.recipeId}/${path}`);
        let script = document.createElement("script");
        script.src = fullPath;
        document.documentElement.appendChild(script);
      }
    },

    loop(func) {
      clearTimeout(_looper);
      _looper = setInterval(func, 1000);
    },

    onNotify(func) {
      console.warn(`Warning: Service ${spaceData.recipeId} is trying to call onNotify, but it is not yet implemented`);
    },

    handleDarkMode(func) {
      console.warn(`Warning: Service ${spaceData.recipeId} is trying to call handleDarkMode, but it is not yet implemented`);
    },

    clearStorageData(id, areas) {
      console.warn(`Warning: Service ${spaceData.recipeId} is trying to call clearStorageData, but it is not yet implemented`);
    },

    async releaseServiceWorkers() {
      let registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        registration.unregister();
      }
    },

    safeParseInt(num) {
      try {
        return parseInt(num, 10);
      } catch (e) {
        return 0;
      }
    },

    isImage(link) {
      // The code in this function is licensed under the MIT License and is ferdium code
      if (link === undefined) {
        return false;
      }

      let { role } = link.dataset;

      if (role !== undefined) {
        let roles = ["img"];
        return roles.includes(role);
      }

      let url = link.getAttribute("href");

      let regex = /\.(jpg|jpeg|png|webp|avif|gif|svg)($|\?|:)/;

      return regex.test(url.split(/[#?]/)[0]);
    },

    openNewWindow(url) {
      browser.runtime.sendMessage({ action: "openLink", href: url });
    },

    setAvatarImage(avatarUrl) {
      console.warn(`Warning: Service ${spaceData.recipeId} is trying to call setAvatarImage, but it is not yet implemented`);
    },

    initialize(func) {
      console.warn(`Warning: Service ${spaceData.recipeId} is trying to call initialize, but it is not yet implemented`);
    },

    ipcRenderer: {
      on: function() { // eslint-disable-line id-length
        console.warn(`Warning: Service ${spaceData.recipeId} is trying to call ipcRenderer.on, but it is not yet implemented`);
      }
    }
  };
  Object.freeze(ferdium);

  // Now let the recipe take over
  module.exports(ferdium, settings);
})();

null; // eslint-disable-line no-unused-expressions
