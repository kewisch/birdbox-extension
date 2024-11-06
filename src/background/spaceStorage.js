/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class SpaceStorage {
  #initialized = false;
  #spaces = [];
  #spaceByName = {};

  async init() {
    if (this.#initialized) {
      return;
    }

    let { spaces } = await messenger.storage.local.get({ spaces: [] });
    for (let space of spaces) {
      await this.add(space, false);
    }
    await this.flush();

    this.#initialized = true;
  }

  async reload() {
    this.#initialized = false;

    await this.clear(false);
    await this.init();
  }

  async flush() {
    await messenger.storage.local.set({ spaces: this.#spaces });
  }

  byName(name) {
    return this.#spaceByName[name];
  }

  map(func) {
    return this.#spaces.map(func);
  }

  getAll() {
    // Warning: this is only a shallow copy
    return [...this.#spaces];
  }

  async add(spaceData, flush = true) {
    let icon = spaceData.ferdiumId ? browser.runtime.getURL(`/recipes/${spaceData.ferdiumId}/icon.svg`) : spaceData.icon;
    let tbSpace = await messenger.spaces.create(spaceData.name, spaceData.url, { defaultIcons: icon, title: spaceData.title });
    await messenger.birdbox.updateCookieStore(spaceData.name, spaceData.container || "firefox-default");
    await messenger.birdbox.updateNotifications(spaceData.url, !!spaceData.notifications);
    spaceData.id = tbSpace.id;
    this.#spaces.push(spaceData);
    this.#spaceByName[spaceData.name] = spaceData;
    await messenger.birdbox.moveAddLast();

    if (flush) {
      await this.flush();
    }
  }

  async update(spaceData, create = false, flush = true) {
    let existingIndex = this.#spaces.findIndex(obj => obj.name == spaceData.name);
    if (existingIndex == -1) {
      if (!create) {
        throw new Error("Could not find space to update");
      }
      await this.add(spaceData);
      return;
    }

    let spaceId = this.#spaces[existingIndex].id;
    this.#spaces[existingIndex] = spaceData;
    this.#spaceByName[spaceData.name] = spaceData;

    let icon = spaceData.ferdiumId ? browser.runtime.getURL(`/recipes/${spaceData.ferdiumId}/icon.svg`) : spaceData.icon;
    await messenger.spaces.update(spaceId, spaceData.url, { defaultIcons: icon, title: spaceData.title });

    let tabs = await messenger.tabs.query({ spaceId });
    await Promise.all(tabs.map(tab => {
      return messenger.tabs.sendMessage(tab.id, { action: "updateSpaceSettings", space: spaceData });
    }));
    await messenger.birdbox.updateCookieStore(spaceData.name, spaceData.container || "firefox-default");
    await messenger.birdbox.updateNotifications(spaceData.url, !!spaceData.notifications);

    if (flush) {
      await this.flush();
    }
  }

  async remove(spaceName, missingOk = false, flush = true) {
    let existingIndex = this.#spaces.findIndex(obj => obj.name == spaceName);
    if (existingIndex == -1) {
      if (!missingOk) {
        throw new Error("Could not find space to update");
      }
      return;
    }

    await messenger.spaces.remove(this.#spaces[existingIndex].id);

    this.#spaces.splice(existingIndex, 1);
    delete this.#spaceByName[spaceName];
    if (flush) {
      await this.flush();
    }
  }

  async clear(flush = true) {
    await Promise.all(this.#spaces.map(space => messenger.spaces.remove(space.id)));
    this.#spaces = [];
    this.#spaceByName = {};
    if (flush) {
      await this.flush();
    }
  }
}
