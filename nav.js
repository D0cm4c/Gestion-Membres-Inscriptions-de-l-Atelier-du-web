(function () {
    'use strict';

    // Navigation mobile : bouton ☰, sidebar en tiroir ≤ 860px (overlay, Échap, fermeture au clic).

    var DESKTOP = window.matchMedia('(min-width: 861px)');

    function getSidebar() { return document.querySelector('.sidebar'); }
    function getToggle() { return document.querySelector('.nav-toggle'); }

    function isOpen() {
        var s = getSidebar();
        return !!s && s.classList.contains('nav-open');
    }

    function closeNav() {
        var s = getSidebar();
        var t = getToggle();
        if (!s) return;
        s.classList.remove('nav-open');
        var ov = document.querySelector('.nav-overlay');
        if (ov) ov.remove();
        if (t) {
            t.setAttribute('aria-expanded', 'false');
            t.focus();
        }
    }

    function openNav() {
        var s = getSidebar();
        var t = getToggle();
        if (!s) return;
        s.classList.add('nav-open');
        if (!document.querySelector('.nav-overlay')) {
            var ov = document.createElement('div');
            ov.className = 'nav-overlay';
            ov.addEventListener('click', closeNav);
            document.body.appendChild(ov);
        }
        if (t) t.setAttribute('aria-expanded', 'true');
        var first = s.querySelector('.side-nav a');
        if (first) first.focus();
    }

    function init() {
        var t = getToggle();
        var s = getSidebar();
        if (!t || !s) return;
        t.setAttribute('aria-expanded', 'false');
        t.addEventListener('click', function () {
            isOpen() ? closeNav() : openNav();
        });
        s.addEventListener('click', function (e) {
            if (e.target.closest('a')) closeNav();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) closeNav();
        });
        if (DESKTOP.addEventListener) {
            DESKTOP.addEventListener('change', function (e) {
                if (e.matches) closeNav();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
