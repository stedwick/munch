(() => {
  'use strict';

  const preferenceKey = 'munch-orchard-theme';
  const root = document.documentElement;
  const device = matchMedia('(prefers-color-scheme: dark)');
  const browserColor = document.querySelector('meta[name="theme-color"]');
  let choice;
  let toggle;

  try {
    const saved = localStorage.getItem(preferenceKey);
    if (saved === 'dark' || saved === 'light') choice = saved;
  } catch {
    // A session can still change the appearance when storage is unavailable.
  }

  function renderTheme() {
    const theme = choice ?? (device.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    browserColor.content = theme === 'dark' ? '#0b1626' : '#e7edcf';
    toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  renderTheme();
  device.addEventListener('change', renderTheme);
  document.addEventListener('DOMContentLoaded', () => {
    toggle = document.querySelector('[data-theme-toggle]');
    renderTheme();
    toggle.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      renderTheme();
      try {
        localStorage.setItem(preferenceKey, choice);
      } catch {
        // Keep the choice for the current page.
      }
    });
  });
})();
