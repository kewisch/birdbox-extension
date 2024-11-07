/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class FerdiumBase {
  constructor(ferdiumId) {
    this.id = ferdiumId;
  }

  send() {
    console.warn(`Warning: background send() function not implemented for ${this.id}`);
  }
}

export default class FerdiumBackground {
  #backgroundCache = {};

  async get(ferdiumId) {
    if (ferdiumId in this.#backgroundCache) {
      return this.#backgroundCache[ferdiumId];
    }

    window.module = {};

    let { promise, resolve, reject } = Promise.withResolvers();

    let script = document.createElement("script");
    script.src = browser.runtime.getURL(`/recipes/${ferdiumId}/index.js`);
    script.id = "background-" + ferdiumId;
    script.addEventListener("load", resolve);
    document.head.appendChild(script);

    await promise;

    var background;
    if (window.module) {
      let ferdiumClass = window.module.exports(FerdiumBase);
      delete window.module;
      background = new ferdiumClass(ferdiumId);

      if ("events" in background) {
        console.warn(`Warning: custom events not implemented for ${ferdiumId}`);
      }
    } else {
      background = new FerdiumBase(ferdiumId);
    }

    this.#backgroundCache[ferdiumId] = background;
    return background;
  }
}
