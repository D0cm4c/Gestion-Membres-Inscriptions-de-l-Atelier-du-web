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
    var membersCount = document.getElementById('membersCount');
    var viewGridBtn = document.getElementById('viewGridBtn');
    var viewListBtn = document.getElementById('viewListBtn');

    var currentFilter = 'all';
    var currentView = 'grid';

    var SORTS = {
        'name-asc': 'last_name COLLATE NOCASE ASC, first_name COLLATE NOCASE ASC',
        'name-desc': 'last_name COLLATE NOCASE DESC, first_name COLLATE NOCASE DESC',
        'first-name-asc': 'first_name COLLATE NOCASE ASC, last_name COLLATE NOCASE ASC',
        'first-name-desc': 'first_name COLLATE NOCASE DESC, last_name COLLATE NOCASE DESC',
        'age-asc': 'age IS NULL, age ASC',
        'age-desc': 'age IS NULL, age DESC',
        'start-desc': 'start_date IS NULL, start_date DESC',
        'start-asc': 'start_date IS NULL, start_date ASC',
        'end-asc': 'end_date IS NULL, end_date ASC',
        'end-desc': 'end_date IS NULL, end_date DESC',
        'created-desc': 'created_at DESC'
    };

    var FILTERS = {
        all: null,
        active: 'date(end_date) >= date(\'now\') OR end_date IS NULL',
        expired: 'date(end_date) < date(\'now\') AND end_date IS NOT NULL'
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
        var conditions = [];
        var params = [];

        var filter = FILTERS[currentFilter];
        if (filter) conditions.push('(' + filter + ')');

        if (query) {
            conditions.push('lower(first_name || \' \' || last_name || \' \' || COALESCE(email,\'\') || \' \' || COALESCE(phone,\'\') || \' \' || COALESCE(address,\'\')) LIKE ?');
            params.push('%' + query.toLowerCase() + '%');
        }

        var sql = 'SELECT * FROM members';
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY ' + order;
        return ADWDatabase.queryAll(sql, params);
    }

    function cardHTML(member) {
        var expired = isExpired(member);
        return '<div class="member-avatar">' + escapeHtml(initials(member)) + '</div>' +
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
            '</div>';
    }

    function rowHTML(member) {
        var expired = isExpired(member);
        return '<div class="list-cell avatar-cell"><span class="member-avatar small">' + escapeHtml(initials(member)) + '</span></div>' +
            '<div class="list-cell name-cell">' + escapeHtml(member.first_name) + ' ' + escapeHtml(member.last_name) + '</div>' +
            '<div class="list-cell">' + (member.age ? escapeHtml(member.age) + ' ans' : '—') + '</div>' +
            '<div class="list-cell">' + (member.email ? escapeHtml(member.email) : '—') + '</div>' +
            '<div class="list-cell">' + (member.phone ? escapeHtml(member.phone) : '—') + '</div>' +
            '<div class="list-cell dates-cell">' +
                '<span class="badge ' + (expired ? 'expired' : 'active-member') + '">' +
                    (expired ? 'Expirée' : 'Active') + '</span> ' +
                'du ' + escapeHtml(formatDate(member.start_date)) + ' au ' + escapeHtml(formatDate(member.end_date)) +
            '</div>';
    }

    function render() {
        var members = getMembers();
        grid.className = currentView === 'list' ? 'members-list' : 'members-grid';
        grid.innerHTML = '';
        emptyState.hidden = members.length > 0;
        membersCount.textContent = members.length + ' membre' + (members.length > 1 ? 's' : '');

        members.forEach(function (member) {
            var expired = isExpired(member);
            var item = document.createElement('div');
            item.className = (currentView === 'list' ? 'member-row' : 'member-card') + (expired ? ' expired' : '');
            item.innerHTML = currentView === 'list' ? rowHTML(member) : cardHTML(member);

            var actions = document.createElement('div');
            actions.className = currentView === 'list' ? 'list-actions' : 'card-actions';
            actions.innerHTML =
                '<button class="btn btn-secondary btn-small">✏️ Modifier</button>' +
                '<button class="btn btn-danger btn-small">🗑️ Supprimer</button>';

            actions.children[0].addEventListener('click', function () { openModal(member); });
            actions.children[1].addEventListener('click', function () {
                if (confirm('Supprimer le membre "' + member.first_name + ' ' + member.last_name + '" ?')) {
                    ADWDatabase.run('DELETE FROM members WHERE id = ?', [member.id]).then(render);
                }
            });
            item.appendChild(actions);
            grid.appendChild(item);
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

    function setView(view) {
        currentView = view;
        viewGridBtn.classList.toggle('active', view === 'grid');
        viewListBtn.classList.toggle('active', view === 'list');
        render();
    }

    addBtn.addEventListener('click', function () { openModal(null); });
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });
    searchInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);
    viewGridBtn.addEventListener('click', function () { setView('grid'); });
    viewListBtn.addEventListener('click', function () { setView('list'); });

    document.querySelectorAll('.segmented[data-filter] .seg-btn, .filters-bar [data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filters-bar [data-filter]').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            currentFilter = btn.getAttribute('data-filter');
            render();
        });
    });

    ADWDatabase.init().then(function () {
        loading.hidden = true;
        render();
    }).catch(function (err) {
        loading.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
    });
})();
