let editingUserId = null;

// ==================== عرض المستخدمين ====================
async function renderUsers() {
    const users = (await getUsers()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const tbody = document.getElementById('usersTableBody');

    if(users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">لا يوجد مستخدمين</td></tr>';
        return;
    }

    let html = '';
    users.forEach(u => {
        const isMe = u.id == currentSession.id;
        const roleBadge = u.role === 'admin'
            ? '<span class="badge bg-warning text-dark">👑 مدير</span>'
            : '<span class="badge bg-secondary">👤 كاشير</span>';
        const statusBadge = u.active
            ? '<span class="badge bg-success">فعّال</span>'
            : '<span class="badge bg-danger">موقوف</span>';

        html += '<tr>';
        html += '<td><strong>' + u.name + '</strong>' + (isMe ? ' <span class="text-muted small">(أنت)</span>' : '') + '</td>';
        html += '<td dir="ltr" class="text-muted">' + u.username + '</td>';
        html += '<td>' + roleBadge + '</td>';
        html += '<td>' + statusBadge + '</td>';
        html += '<td>' + formatDate(u.createdAt) + '</td>';
        html += '<td><div class="action-buttons">';
        html += '<button class="btn btn-sm btn-warning" onclick="openResetPassword(' + u.id + ')" title="إعادة تعيين كلمة المرور"><i class="fas fa-key"></i></button>';
        if(!isMe) {
            html += '<button class="btn btn-sm ' + (u.active ? 'btn-outline-secondary' : 'btn-outline-success') + '" onclick="toggleUserActive(' + u.id + ', ' + (!u.active) + ')" title="' + (u.active ? 'إيقاف' : 'تفعيل') + '"><i class="fas fa-' + (u.active ? 'ban' : 'check') + '"></i></button>';
            html += '<button class="btn btn-sm btn-danger" onclick="removeUser(' + u.id + ')" title="حذف"><i class="fas fa-trash"></i></button>';
        }
        html += '</div></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

// ==================== إضافة/تعديل ====================
function openUserModal() {
    editingUserId = null;
    document.getElementById('userModalTitle').innerText = '➕ إضافة مستخدم جديد';
    document.getElementById('userId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = 'cashier';
    document.getElementById('userPasswordField').style.display = 'block';
}

async function saveUser() {
    const name = document.getElementById('userName').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    if(!name || !username) { showNotification('الرجاء ملء الاسم واسم المستخدم ❌', 'error'); return; }
    if(!password || password.length < 6) { showNotification('كلمة المرور لازم تكون 6 أحرف على الأقل ❌', 'error'); return; }

    const result = await addUser({ name, username, password, role });
    if(!result.success) { showNotification(result.message, 'error'); return; }

    showNotification('تم إضافة المستخدم بنجاح 🎉', 'success');
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    renderUsers();
}

// ==================== تفعيل/إيقاف/حذف ====================
async function toggleUserActive(id, newState) {
    const result = await updateUserRoleOrStatus(id, { active: newState });
    if(!result.success) { showNotification(result.message, 'error'); return; }
    showNotification(newState ? 'تم تفعيل الحساب ✅' : 'تم إيقاف الحساب 🚫', 'success');
    renderUsers();
}

async function removeUser(id) {
    if(!confirm('⚠️ هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
    const result = await deleteUserById(id);
    if(!result.success) { showNotification(result.message, 'error'); return; }
    showNotification('تم حذف المستخدم 🗑️', 'success');
    renderUsers();
}

// ==================== إعادة تعيين كلمة المرور ====================
function openResetPassword(id) {
    document.getElementById('resetUserId').value = id;
    document.getElementById('newPassword').value = '';
    new bootstrap.Modal(document.getElementById('resetPassModal')).show();
}

async function submitResetPassword() {
    const id = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    if(!newPassword || newPassword.length < 6) { showNotification('كلمة المرور لازم تكون 6 أحرف على الأقل ❌', 'error'); return; }

    await resetUserPassword(id, newPassword);
    showNotification('تم تغيير كلمة المرور بنجاح 🔑', 'success');
    bootstrap.Modal.getInstance(document.getElementById('resetPassModal')).hide();
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', renderUsers);
