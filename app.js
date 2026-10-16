(function () {
    'use strict';

    var grid = document.getElementById('membersGrid');
    if (!grid) return;

    var modal = document.getElementById('memberModal');
    var form = document.getElementById('memberForm');
    var addBtn = document.getElementById('addMemberBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    var modalTitle = document.getElementById('modalTitle');
    var searchInput = document.getElementById('searchInput');
    var emptyState = document.getElementById('emptyState');
    var sortSelect = document.getElementById('sortSelect');
    var loading = document.getElementById('loadingState');

    var SORTS = {
        'name-asc': 'last_name COLLATE NOCASE ASC, first_name COLLATE NOCASE ASC',
        'name-desc': 'last_name COLLATE NOCASE DESC, first_name COLLATE NOCASE DESC',
        'age-asc': 'age IS NULL, age ASC',
        'age-desc': 'age IS NULL, age DESC',
        'start-desc': 'start_date IS NULL, start_date DESC',
        'end-asc': 'end_date IS NULL, end_date ASC'
    };

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function isExpired(member) {
        if (!member.end_date) return false;
        return new Date(member.end_date) < new Date(new Date().toDateString());
    }

    function initials(member) {
        return ((member.first_name || '?').charAt(0) + (member.last_name || '?').charAt(0)).toUpperCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('fr-BE');
    }

    function getMembers() {
        var order = SORTS[sortSelect.value] || SORTS['name-asc'];
        var query = (searchInput.value || '').trim();
        var sql = 'SELECT * FROM members';
        var params = [];
        if (query) {
            sql += ' WHERE lower(first_name || \' \' || last_name || \' \' || COALESCE(email,\'\') || \' \' || COALESCE(phone,\'\') || \' \' || COALESCE(address,\'\')) LIKE ?';
            params.push('%' + query.toLowerCase() + '%');
        }
        sql += ' ORDER BY ' + order;
        return ADWDatabase.queryAll(sql, params);
    }

    function render() {
        var members = getMembers();
        grid.innerHTML = '';
        emptyState.hidden = members.length > 0;

        members.forEach(function (member) {
            var expired = isExpired(member);
            var card = document.createElement('div');
            card.className = 'member-card' + (expired ? ' expired' : '');
            card.innerHTML =
                '<div class="member-avatar">' + escapeHtml(initials(member)) + '</div>' +
                '<div class="member-name">' + escapeHtml(member.first_name) + ' ' + escapeHtml(member.last_name) + '</div>' +
                '<div class="member-meta">' +
                    (member.age ? '<span>🎂 ' + escapeHtml(member.age) + ' ans</span>' : '') +
                    (member.email ? '<span>✉️ ' + escapeHtml(member.email) + '</span>' : '') +
                    (member.phone ? '<span>📞 ' + escapeHtml(member.phone) + '</span>' : '') +
                    (member.address ? '<span>📍 ' + escapeHtml(member.address) + '</span>' : '') +
                '</div>' +
                '<div class="member-dates">' +
                    '<span class="badge ' + (expired ? 'expired' : 'active-member') + '">' +
                        (expired ? 'Expirée' : 'Active') + '</span> ' +
                    'du ' + escapeHtml(formatDate(member.start_date)) +
                    ' au ' + escapeHtml(formatDate(member.end_date)) +
                '</div>' +
                '<div class="card-actions">' +
                    '<button class="btn btn-secondary btn-small" data-action="edit">✏️ Modifier</button>' +
                    '<button class="btn btn-danger btn-small" data-action="delete">🗑️ Supprimer</button>' +
                '</div>';

            card.querySelector('[data-action="edit"]').addEventListener('click', function () {
                openModal(member);
            });
            card.querySelector('[data-action="delete"]').addEventListener('click', function () {
                if (confirm('Supprimer le membre "' + member.first_name + ' ' + member.last_name + '" ?')) {
                    ADWDatabase.run('DELETE FROM members WHERE id = ?', [member.id]).then(render);
                }
            });
            grid.appendChild(card);
        });
    }

    function openModal(member) {
        form.reset();
        document.getElementById('memberId').value = member ? member.id : '';
        document.getElementById('firstName').value = member ? member.first_name : '';
        document.getElementById('lastName').value = member ? member.last_name : '';
        document.getElementById('age').value = member ? (member.age || '') : '';
        document.getElementById('phone').value = member ? (member.phone || '') : '';
        document.getElementById('email').value = member ? (member.email || '') : '';
        document.getElementById('address').value = member ? (member.address || '') : '';
        document.getElementById('startDate').value = member ? (member.start_date || '') : '';
        document.getElementById('endDate').value = member ? (member.end_date || '') : '';
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

        var promise;
        if (id) {
            promise = ADWDatabase.run(
                'UPDATE members SET first_name = ?, last_name = ?, age = ?, phone = ?, email = ?, address = ?, start_date = ?, end_date = ? WHERE id = ?',
                [data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null, id]
            );
        } else {
            var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            promise = ADWDatabase.run(
                'INSERT INTO members (id, first_name, last_name, age, phone, email, address, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null]
            );
        }
        promise.then(function () {
            closeModal();
            render();
        });
    });

    addBtn.addEventListener('click', function () { openModal(null); });
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });
    searchInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);

    ADWDatabase.init().then(function () {
        loading.hidden = true;
        render();
    }).catch(function (err) {
        loading.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
    });
})();
