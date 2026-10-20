(function () {
    'use strict';

    // Bouton volant « Suggestion » — présent sur toutes les pages
    // Enregistre la suggestion dans la base locale (table suggestions)
    // avec la page d'origine pour contexte.

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        if (!window.ADWDatabase) return;

        var fab = document.createElement('button');
        fab.className = 'sugg-fab';
        fab.setAttribute('aria-label', 'Faire une suggestion');
        fab.title = 'Faire une suggestion';
        fab.textContent = '💡';
        document.body.appendChild(fab);

        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.hidden = true;
        modal.innerHTML =
            '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="suggTitle" style="max-width:520px;">' +
            '<h3 id="suggTitle">💡 Faire une suggestion</h3>' +
            '<div class="form-group">' +
            '<label for="suggMessage">Ta suggestion</label>' +
            '<textarea id="suggMessage" rows="4" style="width:100%;padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:0.96rem;color:var(--text);background:var(--surface);resize:vertical;" placeholder="Id\u00e9e d\u2019am\u00e9lioration, bug rep\u00e9r\u00e9, remarque\u2026"></textarea>' +
            '<p class="form-hint">La page actuelle est jointe automatiquement pour contexte. Les suggestions sont consultables dans la page \u00c0 faire.</p>' +
            '</div>' +
            '<div class="form-group">' +
            '<label for="suggAuthor">Ton nom (optionnel)</label>' +
            '<input type="text" id="suggAuthor" placeholder="Pour suivre qui a propos\u00e9 quoi\u2026">' +
            '</div>' +
            '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary" id="suggCancelBtn">Annuler</button>' +
            '<button type="button" class="btn btn-primary" id="suggSendBtn">Envoyer</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(modal);

        var msgInput = modal.querySelector('#suggMessage');
        var authorInput = modal.querySelector('#suggAuthor');
        var sendBtn = modal.querySelector('#suggSendBtn');

        function open() {
            msgInput.value = '';
            authorInput.value = '';
            modal.hidden = false;
            msgInput.focus();
        }

        function send() {
            var msg = msgInput.value.trim();
            if (!msg) {
                msgInput.focus();
                msgInput.style.borderColor = 'var(--danger)';
                return;
            }
            window.ADWDatabase.addSuggestion(msg, location.pathname, authorInput.value.trim() || null);
            if (window.ADWNotifications) {
                window.ADWNotifications.push('info',
                    '\uD83D\uDCA1 Suggestion enregistr\u00e9e \u2014 merci ! Elle est consultable dans \u00c0 faire.',
                    'success');
            }
            modal.hidden = true;
        }

        fab.addEventListener('click', open);
        sendBtn.addEventListener('click', send);
        msgInput.addEventListener('input', function () { msgInput.style.borderColor = ''; });
        msgInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
        });
        modal.querySelector('#suggCancelBtn').addEventListener('click', function () { modal.hidden = true; });
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
        });
    });
})();
