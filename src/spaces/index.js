/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { initHash, initLocalize } from "./common.js";
import { initEditListeners, loadEditSpaces } from "./editSpace.js";
import { initAddSpaces, loadAddSpaces } from "./addSpace.js";

initLocalize();
initHash();

initEditListeners();
loadEditSpaces();

initAddSpaces();
loadAddSpaces();
