import { initLocalize } from "./common.js";
import psl from "../background/libs/psl.min.js";

function debounce(func, delay) {
  let timeoutId;

  return function(...args) {
    let self = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(self, args);
    }, delay);
  };
}

class DetailElement extends HTMLElement {
  #spaceData = null;
  #disconnectors = [];

  constructor() {
    super();

    let template = document.getElementById("space-details").content.cloneNode(true);
    let shadowRoot = this.attachShadow({ mode: "open" });

    for (let node of template.querySelectorAll("[id]")) {
      node.setAttribute("id", `${this.id}-${node.id}`);
    }
    for (let node of template.querySelectorAll("[for]")) {
      node.setAttribute("for", `${this.id}-${node.getAttribute("for")}`);
    }

    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "details.css";

    initLocalize(template);

    shadowRoot.appendChild(link);
    shadowRoot.appendChild(template);

    shadowRoot.querySelector(".space-useragent").placeholder = navigator.userAgent.replace(/Thunderbird/g, "Firefox");
  }

  set spaceData(val) {
    this.#spaceData = val;
    this.reset();
    this.setupCustomServer();


    this.shadowRoot.querySelector(".space-name").value = val.title ?? "";
    this.shadowRoot.querySelector(".space-useragent").value = val.useragent ?? "";
    this.shadowRoot.querySelector(".space-notifications").checked = val.notifications ?? true;
    this.shadowRoot.querySelector(".space-startup").checked = val.startup ?? false;
    this.shadowRoot.querySelector(".internal-links").checked = val.internalLinks?.join("\n") ?? "";

    this.shadowRoot.querySelector(".space-useragent-type").value = val.useragent ? "custom" : "auto";
  }

  get spaceData() {
    return this.#spaceData;
  }

  #onSubmit(event) {
    event.preventDefault();
  }

  #onChangeUseragentType(event) {
    event.target.setAttribute("value", event.target.value);
  }

  #onChangeSettings(event) {
    if (event.target.name) {
      if (event.target.name == "useragent" || event.target.name == "useragent-type") {
        let type = this.shadowRoot.querySelector(".space-useragent-type").value;
        let agent = this.shadowRoot.querySelector(".space-useragent").value;
        this.#spaceData.useragent = type == "custom" ? agent || null : null;
      } else if (event.target.type == "checkbox") {
        this.#spaceData[event.target.name] = event.target.checked;
      } else {
        this.#spaceData[event.target.name] = event.target.value.trim();
      }
    }

    this.dispatchEvent(new CustomEvent("change", {
      bubbles: true,
      cancelable: true,
      detail: this.#spaceData
    }));
  }

  field(name) {
    let node = this.shadowRoot.querySelector("." + name);
    if (name == "space-useragent") {
      let type = this.shadowRoot.querySelector(".space-useragent-type").value;
      return type == "custom" ? node.value : null;
    } else if (node.type == "checkbox") {
      return node.checked;
    } else {
      return node.value;
    }
  }

  validate() {
    let valid = this.shadowRoot.querySelector(".space-settings").checkValidity();
    if (!valid) {
      this.shadowRoot.querySelector(".space-settings").classList.add("showfailure");
    }
    return valid;
  }

  get showfailure() {
    return this.shadowRoot.querySelector(".space-settings").classList.contains("showfailure");
  }

  set showfailure(val) {
    this.shadowRoot.querySelector(".space-settings").classList.toggle("showfailure", val);
  }

  #listener(selector, eventName, method) {
    let boundMethod = method.bind(this);
    this.shadowRoot.querySelector(selector).addEventListener(eventName, boundMethod);
    this.#disconnectors.push(() => {
      this.shadowRoot.querySelector(selector).removeEventListener(eventName, boundMethod);
    });
  }

  connectedCallback() {
    this.#listener(".custom-server", "input", debounce(this.#validateCustomServer));
    this.#listener(".space-settings", "submit", this.#onSubmit);
    this.#listener(".space-settings", "change", this.#onChangeSettings);
    this.#listener(".space-useragent-type", "change", this.#onChangeUseragentType);
    this.#listener(".internal-links", "change", this.#validateInternalLinks);
  }

  disconnectedCallback() {
    for (let method of this.#disconnectors) {
      method();
    }
  }

  reset() {
    let customServer = this.shadowRoot.querySelector(".custom-server");
    customServer.value = "";
    customServer.style.paddingInlineStart = "";
    customServer.style.paddingInlineEnd = "";

    this.shadowRoot.querySelector(".url-prefix").textContent = "";
    this.shadowRoot.querySelector(".url-suffix").textContent = "";

    let customServerContainer = this.shadowRoot.querySelector(".custom-server-field");
    customServerContainer.classList.remove("suffix", "prefix");

    this.shadowRoot.querySelector(".space-container").selectedIndex = 0;
    this.shadowRoot.querySelector(".space-notifications").checked = true;
    this.shadowRoot.querySelector(".space-startup").checked = false;
    this.shadowRoot.querySelector(".space-settings").classList.remove("showfailure");
  }

  setupCustomServer() {
    let config = this.#spaceData.recipeConfig;
    let customServerLabel = this.shadowRoot.querySelector(".custom-server-label");
    let customServer = this.shadowRoot.querySelector(".custom-server");
    let customServerContainer = this.shadowRoot.querySelector(".custom-server-field");
    let urlPrefix = this.shadowRoot.querySelector(".url-prefix");
    let urlSuffix = this.shadowRoot.querySelector(".url-suffix");
    let hasCustom = config.hasCustomUrl || config.hasTeamId;

    customServerContainer.classList.toggle("hidden", !hasCustom);
    customServerLabel.classList.toggle("hidden", !hasCustom);
    customServerContainer.classList.toggle("suffix", Boolean(config.hasTeamId && config.urlInputSuffix));
    customServerContainer.classList.toggle("prefix", Boolean(config.hasTeamId && config.urlInputPrefix));

    if (hasCustom) {
      customServer.setAttribute("required", "true");
      customServer.setAttribute("minlength", "1");
    } else {
      customServer.removeAttribute("required");
      customServer.removeAttribute("minlength");
    }

    if (config.hasTeamId) {
      customServerLabel.textContent = messenger.i18n.getMessage("browse.team.label");
      customServer.placeholder = messenger.i18n.getMessage("browse.team.placeholder");
    } else {
      customServerLabel.textContent = messenger.i18n.getMessage("browse.customServer.label");
      customServer.placeholder = messenger.i18n.getMessage("browse.customServer.placeholder");
    }

    urlPrefix.textContent = config.urlInputPrefix;
    urlSuffix.textContent = config.urlInputSuffix;

    if (config.hasTeamId && config.urlInputSuffix) {
      customServer.style.paddingInlineEnd = `${urlSuffix.clientWidth + 5}px`;
    }
    if (config.hasTeamId && config.urlInputPrefix) {
      customServer.style.paddingInlineStart = `${urlPrefix.clientWidth + 5}px`;
    }

    if (this.#spaceData.teamId) {
      customServer.value = this.#spaceData.teamId;
    } else if (this.#spaceData.url) {
      customServer.value = this.#spaceData.url;
    } else if (config.hasCustomUrl && !config.hasTeamId && config.serviceURL) {
      customServer.value = config.serviceURL;
    } else {
      customServer.value = "";
    }
  }

  async #validateCustomServer() {
    let customServer = this.shadowRoot.querySelector(".custom-server");
    if (!customServer.hasAttribute("required")) {
      return;
    }

    let { targetUrl, teamId } = this.targetUrl;
    let errors = [];

    let valid = await browser.runtime.sendMessage({
      action: "validateFerdiumUrl",
      recipeId: this.#spaceData.recipeId,
      url: targetUrl
    });

    if (valid === null) {
      // null means no validator, just use a simple URL validation
      try {
        let url = new URL(targetUrl);
        if (url.protocol != "http" && url.protocol != "https") {
          errors.push("Invalid service URL: " + targetUrl);
        }
      } catch (e) {
        errors.push("Invalid service URL: " + targetUrl);
      }
    } else if (!valid) {
      errors.push(`Not a valid ${this.#spaceData.recipeId} URL`);
    }

    customServer.setCustomValidity(errors);
    customServer.reportValidity();

    if (!errors.length) {
      this.#spaceData.url = targetUrl;
      this.#spaceData.teamId = teamId;
    }
  }

  #validateInternalLinks() {
    let linkElement = this.shadowRoot.querySelector(".internal-links");
    let errors = [];
    let lines = new Set(linkElement.value.split("\n").reduce((acc, val) => {
      if (val.startsWith("http:") || val.startsWith("https:")) {
        let url = new URL(val);
        if (psl.isValid(url.hostname)) {
          acc.push(url.hostname);
        } else {
          errors.push("Invalid Domain: " + url.hostname);
        }
      } else if (psl.isValid(val)) {
        acc.push(val);
      } else if (val.trim() != "") {
        errors.push("Invalid Domain: " + val);
      }
      return acc;
    }, []));

    this.#spaceData.internalLinks = [...lines];

    let customErrors = errors.join("\n");
    linkElement.setCustomValidity(customErrors);
    linkElement.reportValidity();
    linkElement.title = customErrors;

    if (!customErrors) {
      linkElement.value = this.#spaceData.internalLinks.join("\n");
    }
  }

  get targetUrl() {
    let config = this.#spaceData.recipeConfig;

    let targetUrl = config.serviceURL;
    let teamId = null;
    let customServer = this.shadowRoot.querySelector(".custom-server").value;
    if (config.hasTeamId) {
      targetUrl = config.serviceURL.replace(/{teamId}/g, customServer);
      teamId = customServer;
    } else if (config.hasCustomUrl) {
      targetUrl = customServer;

      if (targetUrl && !targetUrl.includes("://")) {
        targetUrl = "https://" + targetUrl;
      }
    }

    return { teamId, targetUrl };
  }
}
customElements.define("space-details", DetailElement);
