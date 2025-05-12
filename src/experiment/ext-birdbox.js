/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { ExtensionCommon: { ExtensionAPI } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
var { ExtensionUtils: { ExtensionError } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs");
var { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");

this.birdbox = class extends ExtensionAPI {
  getAPI(context) {
    return {
      birdbox: {
        async updateNotifications(uriSpec, enabled) {
          let uri;
          try {
            uri = Services.io.newURI(uriSpec);
          } catch (e) {
            throw new ExtensionError("Invalid URI: " + uriSpec, { cause: e });
          }
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
        },

        // https://bugzilla.mozilla.org/show_bug.cgi?id=1929197
        async moveAddLast() {
          for (let window of ExtensionSupport.openWindows) {
            let container = window.document.getElementById("spacesToolbarAddonsContainer");
            let addButton = window.document.getElementById("birdbox_mozilla_kewis_ch-spacesButton-birdbox_add");
            if (container && addButton) {
              container.appendChild(addButton);
            }
          }
        }
      },
    };
  }
};
