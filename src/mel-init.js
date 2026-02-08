(function () {
  function init() {
    const melSetup = document.querySelector('mel-setup');

    if (!melSetup) {
      return;
    }

    const jsFile = melSetup.getAttribute('src') || 'src/index.js';
    const cssFile = melSetup.getAttribute('css') || 'src/style/mel.css';

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssFile;
    document.head.appendChild(link);

    const s = document.createElement('script');
    s.src = jsFile;
    s.onerror = () => console.error('Failed to load:', jsFile);
    document.head.appendChild(s);

    melSetup.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
