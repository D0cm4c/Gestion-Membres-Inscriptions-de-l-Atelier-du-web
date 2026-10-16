(function () {
    'use strict';

    var STORAGE_KEY = 'atelierduweb_members';
    var grid = document.getElementById('membersGrid');
    if (!grid) return;

    var modal = document.getElementById('memberModal');
    var form = document.getElementById('memberForm');
    var addBtn = document.getElementById('addMemberBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    var modalTitle = document.getElementById('modalTitle');
    var searchInput = document.getElementById('searchInput');
    var emptyState = document.getElementById('emptyState');

    function getMembers() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveMembers(members) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function isExpired(member) {
        if (!member.endDate) return false;
        return new Date(member.endDate) < new Date(new Date().toDateString());
    }

    function initials(member) {
        return ((member.firstName || '?').charAt(0) + (member.lastName || '?').charAt(0)).toUpperCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('fr-BE');
    }

    function render() {
        var members = getMembers();
        var query = (searchInput.value || '').toLowerCase().trim();
        var filtered = members.filter(function (m) {
            if (!query) return true;
            return [m.firstName, m.lastName, m.email, m.phone, m.address]
                .some(function (v) { return v && String(v).toLowerCase().indexOf(query) !== -1; });
        });

        grid.innerHTML = '';
        emptyState.hidden = filtered.length > 0;

        filtered.forEach(function (member) {
            var expired = isExpired(member);
            var card = document.createElement('div');
            card.className = 'member-card' + (expired ? ' expired' : '');
            card.innerHTML =
                '<div class="member-avatar">' + escapeHtml(initials(member)) + '</div>' +
                '<div class="member-name">' + escapeHtml(member.firstName) + ' ' + escapeHtml(member.lastName) + '</div>' +
                '<div class="member-meta">' +
                    (member.age ? '<span>🎂 ' + escapeHtml(member.age) + ' ans</span>' : '') +
                    (member.email ? '<span>✉️ ' + escapeHtml(member.email) + '</span>' : '') +
                    (member.phone ? '<span>📞 ' + escapeHtml(member.phone) + '</span>' : '') +
                    (member.address ? '<span>📍 ' + escapeHtml(member.address) + '</span>' : '') +
                '</div>' +
                '<div class="member-dates">' +
                    '<span class="badge ' + (expired ? 'expired' : 'active-member') + '">' +
                        (expired ? 'Expirée' : 'Active') + '</span> ' +
                    'du ' + escapeHtml(formatDate(member.startDate)) +
                    ' au ' + escapeHtml(formatDate(member.endDate)) +
                '</div>' +
                '<div class="card-actions">' +
                    '<button class="btn btn-secondary btn-small" data-action="edit">✏️ Modifier</button>' +
                    '<button class="btn btn-danger btn-small" data-action="delete">🗑️ Supprimer</button>' +
                '</div>';

            card.querySelector('[data-action="edit"]').addEventListener('click', function () {
                openModal(member);
            });
            card.querySelector('[data-action="delete"]').addEventListener('click', function () {
                if (confirm('Supprimer le membre "' + member.firstName + ' ' + member.lastName + '" ?')) {
                    saveMembers(getMembers().filter(function (m) { return m.id !== member.id; }));
                    render();
                }
            });
            grid.appendChild(card);
        });
    }

    function openModal(member) {
        form.reset();
        document.getElementById('memberId').value = member ? member.id : '';
        document.getElementById('firstName').value = member ? member.firstName : '';
        document.getElementById('lastName').value = member ? member.lastName : '';
        document.getElementById('age').value = member ? (member.age || '') : '';
        document.getElementById('phone').value = member ? (member.phone || '') : '';
        document.getElementById('email').value = member ? (member.email || '') : '';
        document.getElementById('address').value = member ? (member.address || '') : '';
        document.getElementById('startDate').value = member ? (member.startDate || '') : '';
        document.getElementById('endDate').value = member ? (member.endDate || '') : '';
        modalTitle.textContent = member ? 'Modifier le membre' : 'Ajouter un membre';
        modal.hidden = false;
        document.getElementById('firstName').focus();
    }

    function closeModal() {
        modal.hidden = true;
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = document.getElementById('memberId').value;
        var data = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            age: document.getElementById('age').value,
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            address: document.getElementById('address').value.trim(),
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value
        };

        var members = getMembers();
        if (id) {
            members = members.map(function (m) {
                return m.id === id ? Object.assign({}, m, data) : m;
            });
        } else {
            data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            members.push(data);
        }
        saveMembers(members);
        closeModal();
        render();
    });

    addBtn.addEventListener('click', function () { openModal(null); });
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });
    searchInput.addEventListener('input', render);

    render();
})();
