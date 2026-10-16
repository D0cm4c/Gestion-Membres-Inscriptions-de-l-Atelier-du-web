(function () {
    'use strict';

    var THEME_KEY = 'atelierduweb_theme';

    function applyTheme(mode) {
        document.documentElement.setAttribute('data-theme', mode);
        var btn = document.getElementById('themeToggle');
        if (btn) {
            btn.textContent = mode === 'dark' ? '☀️' : '🌙';
            btn.setAttribute('aria-label', mode === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre');
        }
    }

    function savedTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    // Appliquer immédiatement (avant le rendu, pour éviter le flash)
    applyTheme(savedTheme() || 'auto');

    // Bouton de toggle (présent sur chaque page)
    function initToggle() {
        var btn = document.getElementById('themeToggle');
        if (!btn || btn.getAttribute('data-theme-init')) return;
        btn.setAttribute('data-theme-init', '1');

        applyTheme(savedTheme() || 'auto');

        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme');
            var isDark = current === 'dark' ||
                (current === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            var next = isDark ? 'light' : 'dark';
            applyTheme(next);
            try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* best effort */ }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggle);
    } else {
        initToggle();
    }
})();
