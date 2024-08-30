browser.runtime.sendMessage({ action: "checkSpace" }).then((space) => {
  if (space) {
    Object.defineProperty(navigator, "userAgent", {
        value: navigator.userAgent.replace(/Thunderbird/g, "Firefox"),
        configurable: false,
        enumerable: true,
        writable: false
    });
  }
});
