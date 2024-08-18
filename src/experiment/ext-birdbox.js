/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { ExtensionCommon: { makeWidgetId, ExtensionAPI } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");

var { ExtensionUtils: { ExtensionError } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs");

var { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");

var { PrivateBrowsingUtils } = ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");

var { ContextualIdentityService } = ChromeUtils.importESModule("resource://gre/modules/ContextualIdentityService.sys.mjs");

var { XPCOMUtils } = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "containersEnabled",
  "privacy.userContext.enabled"
); /* global containersEnabled */

function adaptSpace(space, window, cookieStoreId, extension) {
  let userContextId = getUserContextIdForCookieStoreId(
    extension,
    cookieStoreId
  );

  space.open = function(where) {
    const tab = window.openTab(
      "contentTab",
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1913621
      { url: this.url, duplicate: true, userContextId, linkHandler: null },
      where
    );
    tab.spaceButtonId = this.name;
    window.gSpacesToolbar.currentSpace = this;
    space.button.classList.add("current");
    return tab;
  };
}


// From https://searchfox.org/mozilla-central/source/toolkit/components/extensions/parent/ext-tabs-base.js
function getUserContextIdForCookieStoreId(
  extension,
  cookieStoreId,
  isPrivateBrowsing
) {
  if (!extension.hasPermission("cookies")) {
    throw new ExtensionError(
      `No permission for cookieStoreId: ${cookieStoreId}`
    );
  }

  if (!isValidCookieStoreId(cookieStoreId)) {
    throw new ExtensionError(`Illegal cookieStoreId: ${cookieStoreId}`);
  }

  if (isPrivateBrowsing && !isPrivateCookieStoreId(cookieStoreId)) {
    throw new ExtensionError(
      "Illegal to set non-private cookieStoreId in a private window"
    );
  }

  if (!isPrivateBrowsing && isPrivateCookieStoreId(cookieStoreId)) {
    throw new ExtensionError(
      "Illegal to set private cookieStoreId in a non-private window"
    );
  }

  if (isContainerCookieStoreId(cookieStoreId)) {
    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
      // Container tabs are not supported in perma-private browsing mode - bug 1320757
      throw new ExtensionError(
        "Contextual identities are unavailable in permanent private browsing mode"
      );
    }
    if (!containersEnabled) {
      throw new ExtensionError("Contextual identities are currently disabled");
    }
    let userContextId = getContainerForCookieStoreId(cookieStoreId);
    if (!userContextId) {
      throw new ExtensionError(
        `No cookie store exists with ID ${cookieStoreId}`
      );
    }
    if (!extension.canAccessContainer(userContextId)) {
      throw new ExtensionError(`Cannot access ${cookieStoreId}`);
    }
    return userContextId;
  }

  return Services.scriptSecurityManager.DEFAULT_USER_CONTEXT_ID;
}


// From https://searchfox.org/mozilla-central/source/toolkit/components/extensions/parent/ext-toolkit.js
function getContainerForCookieStoreId(storeId) {
  if (!isContainerCookieStoreId(storeId)) {
    return null;
  }

  let containerId = storeId.substring("firefox-container-".length);

  if (ContextualIdentityService.getPublicIdentityFromId(containerId)) {
    return parseInt(containerId, 10);
  }

  return null;
}
function isDefaultCookieStoreId(storeId) {
  return storeId == "firefox-default";
}
function isPrivateCookieStoreId(storeId) {
  return storeId == "firefox-private";
}
function isContainerCookieStoreId(storeId) {
  return storeId?.startsWith("firefox-container-");
}
function isValidCookieStoreId(storeId) {
  return (
    isDefaultCookieStoreId(storeId) ||
    isPrivateCookieStoreId(storeId) ||
    isContainerCookieStoreId(storeId)
  );
}

async function waitForSpaces(window) {
  return new Promise(resolve => {
    if (window.gSpacesToolbar.isLoaded) {
      resolve();
    } else {
      window.addEventListener("spaces-toolbar-ready", resolve, {
        once: true,
      });
    }
  });
}

this.birdbox = class extends ExtensionAPI {
  cookieStorePersist = {};

  onStartup() {
    ExtensionSupport.registerWindowListener("ext-birdbox", {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      onLoadWindow: async (window) => {
        await waitForSpaces(window);

        let prefix = makeWidgetId(this.extension.id) + "-spacesButton-";
        for (let space of window.gSpacesToolbar.spaces) {
          if (space.name.startsWith(prefix)) {
            let spaceNameSuffix = space.name.substring(prefix.length);

            if (spaceNameSuffix in this.cookieStorePersist) {
              adaptSpace(space, window, this.cookieStorePersist[spaceNameSuffix], this.extension);
            }
          }
        }
      }
    });
  }

  onShutdown() {
    ExtensionSupport.unregisterWindowListener("ext-birdbox");
  }

  getAPI(context) {
    return {
      birdbox: {
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1913580
        async updateCookieStore(spaceName, cookieStoreId) {
          await Promise.all([...ExtensionSupport.openWindows].map(async window => {
            if (window.location.href != "chrome://messenger/content/messenger.xhtml") {
              return;
            }
            await waitForSpaces(window);

            let widgetId = makeWidgetId(context.extension.id);
            let space = window.gSpacesToolbar.spaces.find(spc => spc.name == `${widgetId}-spacesButton-${spaceName}`);
            adaptSpace(space, window, cookieStoreId, context.extension);
          }));
        },

        async updateNotifications(uriSpec, enabled) {
          let uri = Services.io.newURI(uriSpec);
          let principal = Services.scriptSecurityManager.createContentPrincipal(uri, {});

          if (enabled) {
            Services.perms.addFromPrincipal(principal, "desktop-notification", Services.perms.ALLOW_ACTION);
          } else {
            Services.perms.removeFromPrincipal(principal, "desktop-notification");
          }
        },

        async checkNotificationPermission(uriSpec) {
          let uri = Services.io.newURI(uriSpec);
          let principal = Services.scriptSecurityManager.createContentPrincipal(uri, {});
          return !!Services.perms.testExactPermissionFromPrincipal(principal, "desktop-notification");
        }
      },
    };
  }
};
