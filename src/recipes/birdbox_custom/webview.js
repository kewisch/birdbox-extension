module.exports = (Ferdium, settings) => {
  let titleElement = document.querySelector("title");
  if (titleElement) {
    new MutationObserver((mutations) => {
        let title = mutations[0].target.textContent;

        let match = title?.match(/\(\d+\)/);
        Ferdium.setBadge(match?.[1] || 0, 0);
    }).observe(
        titleElement,
        { subtree: true, characterData: true, childList: true }
    );
  }
};
