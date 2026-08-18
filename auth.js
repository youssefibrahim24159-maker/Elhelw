// ==================== نظام الدخول والصلاحيات ====================
// ملاحظة: التطبيق شغال بالكامل من المتصفح (بدون سيرفر)، فالحماية هنا
// تنظيمية لمنع الدخول العشوائي وتوزيع الصلاحيات بين المدير والموظفين،
// مش حماية بمستوى بنكي - أي حد عنده خبرة تقنية بالمتصفح يقدر يتخطاها.

// ==================== مفتاح المبرمج + نظام الترخيص/الاشتراك ====================
// السر ده بيُستخدم في توليد والتحقق من أكواد الاشتراك (License Codes).
// أي كود اشتراك بتولده من "صفحة المبرمج" (dev-console.html) بيتوقع بالسر ده،
// وبيتحقق منه محليًا في نسخة العميل من غير ما يحتاج إنترنت خالص.
//
// ⚠️ غيّر القيمة دي قبل ما تدي أي نسخة لأي عميل، وخليها حاجة معروفة عندك
// إنت بس - ونفس القيمة لازم تكون موجودة في auth.js بتاع صفحة المبرمج (dev-console.html)
// عشان الأكواد اللي بتولدها تشتغل صح مع النسخة اللي هتديها للعميل.
const LICENSE_SECRET = 'CHANGE-ME-ELHELW-LICENSE-SECRET-2026';

// كلمة مرور دخولك انت بس لصفحة المبرمج (منفصلة تمامًا عن حسابات العملاء)
const DEV_CONSOLE_PASSWORD = 'CHANGE-ME-DEV-CONSOLE-PASSWORD';

function hashPassword(password) {
    // تجزئة بسيطة عشان كلمة المرور ما تتخزنش صريحة في localStorage
    let hash = 0;
    const str = 'elhelw_salt_v1_' + password;
    for(let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36) + '_' + str.length;
}

function simpleSign(str) {
    let hash = 0;
    const s = LICENSE_SECRET + '::' + str;
    for(let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36).toUpperCase();
}

// ==================== معرّف الجهاز ====================
// كل جهاز/متصفح بياخد معرّف عشوائي ثابت أول مرة يتفتح فيها البرنامج.
// ملحوظة: لو حد مسح بيانات المتصفح (Clear browsing data) هيتغيّر المعرّف
// ويحتاج كود اشتراك جديد لنفس الجهاز.
function getDeviceId() {
    let id = localStorage.getItem('deviceId');
    if(!id) {
        id = 'DEV-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        localStorage.setItem('deviceId', id);
    }
    return id;
}

// ==================== توليد والتحقق من كود الاشتراك ====================
// شكل الكود: EXPIRY(base36)-SIGNATURE — بيتولد من صفحة المبرمج، ويتحقق منه محليًا
function generateLicenseCode(deviceId, expiryTimestamp) {
    const expiryPart = Math.floor(expiryTimestamp / 1000).toString(36).toUpperCase();
    const sig = simpleSign(deviceId + ':' + expiryPart).slice(0, 8);
    return expiryPart + '-' + sig;
}

function verifyLicenseCode(deviceId, code) {
    const parts = (code || '').trim().toUpperCase().split('-');
    if(parts.length < 2) return { valid: false, message: 'صيغة الكود غير صحيحة' };
    const expiryPart = parts[0];
    const sig = parts.slice(1).join('-');
    const expectedSig = simpleSign(deviceId + ':' + expiryPart).slice(0, 8);
    if(sig !== expectedSig) return { valid: false, message: 'الكود غير صحيح على هذا الجهاز' };
    const expiryTimestamp = parseInt(expiryPart, 36) * 1000;
    if(isNaN(expiryTimestamp)) return { valid: false, message: 'الكود تالف' };
    return { valid: true, expiryTimestamp: expiryTimestamp };
}

function saveSubscription(code) {
    localStorage.setItem('subscription', JSON.stringify({ code: code, deviceId: getDeviceId() }));
}

function getSubscription() {
    try { return JSON.parse(localStorage.getItem('subscription')); } catch(e) { return null; }
}

// بيتحقق من التوقيع كل مرة بدل ما يثق بالتخزين وحده (منع التلاعب المباشر بالقيمة)
function checkSubscriptionStatus() {
    const sub = getSubscription();
    if(!sub || !sub.code) return { valid: false, expired: false, message: 'لا يوجد اشتراك مفعّل على هذا الجهاز' };
    const check = verifyLicenseCode(getDeviceId(), sub.code);
    if(!check.valid) return { valid: false, expired: false, message: check.message };
    if(Date.now() > check.expiryTimestamp) return { valid: false, expired: true, message: 'انتهى الاشتراك', expiryTimestamp: check.expiryTimestamp };
    return { valid: true, expired: false, expiryTimestamp: check.expiryTimestamp };
}

function isSubscriptionValid() {
    return checkSubscriptionStatus().valid;
}

function subscriptionDaysLeft() {
    const status = checkSubscriptionStatus();
    if(!status.valid || !status.expiryTimestamp) return 0;
    return Math.max(0, Math.ceil((status.expiryTimestamp - Date.now()) / 86400000));
}

function activateLicense(code) {
    const check = verifyLicenseCode(getDeviceId(), code);
    if(!check.valid) return { success: false, message: check.message };
    if(Date.now() > check.expiryTimestamp) return { success: false, message: 'هذا الكود منتهي بالفعل - اطلب كود جديد' };
    saveSubscription(code);
    return { success: true };
}

async function getUsers() {
    const session = getCurrentSession();
    if(!session) return [];
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('app_users')
        .select('id, name, username, role, active, created_at')
        .eq('client_id', session.clientId);
    if(error) { console.error(error); return []; }
    return data.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active, createdAt: u.created_at }));
}

// ==================== إنشاء حساب متجر جديد (مدير جديد + عميل جديد) ====================
// تحقق إن الجهاز ده مسموحله يعمل حساب متجر جديد (مش سبق استخدم قبل كده من غير إذن)
async function checkDeviceCanCreateShop() {
    const supabase = getSupabaseClient();
    const deviceId = getDeviceId();
    const { data: history } = await supabase.from('device_history').select('shop_count').eq('device_id', deviceId).maybeSingle();
    if(history && history.shop_count > 0) {
        return { allowed: false, message: 'هذا الجهاز سبق استخدامه لإنشاء حساب من قبل - تواصل مع المبرمج للسماح له بإنشاء حساب جديد' };
    }
    return { allowed: true };
}

// بتحدد حالة الجهاز: عنده حساب شغال دلوقتي ولا اتحذف حسابه القديم ولازم إذن المبرمج تاني
// بتتنادى من login.html قبل ما تقرر تعرض شاشة الدخول العادية أو ترجعه لشاشة كود التفعيل
async function getDeviceAccessState() {
    const supabase = getSupabaseClient();
    const deviceId = getDeviceId();

    const { data: activeDevice, error: e1 } = await supabase.from('client_devices').select('id').eq('device_id', deviceId).limit(1).maybeSingle();
    if(e1) console.error('getDeviceAccessState (client_devices):', e1);
    if(activeDevice) return 'ok'; // الجهاز مرتبط بحساب موجود فعلاً

    const { data: history, error: e2 } = await supabase.from('device_history').select('shop_count').eq('device_id', deviceId).maybeSingle();
    if(e2) console.error('getDeviceAccessState (device_history):', e2);
    if(history && history.shop_count > 0) return 'revoked'; // كان عنده حساب واتمسح من المبرمج

    return 'ok'; // جهاز جديد لسه ما استخدمش خالص
}

async function setupAdmin(shopName, name, username, password) {
    const supabase = getSupabaseClient();

    const deviceCheck = await checkDeviceCanCreateShop();
    if(!deviceCheck.allowed) return { success: false, message: deviceCheck.message };

    const { data: existing } = await supabase.from('app_users').select('id').eq('username', username.trim()).maybeSingle();
    if(existing) return { success: false, message: 'اسم المستخدم موجود بالفعل - جرب اسم تاني' };

    const { data: client, error: clientError } = await supabase.from('clients')
        .insert({ name: shopName.trim() })
        .select().single();
    if(clientError) return { success: false, message: 'حصل خطأ أثناء إنشاء المتجر: ' + clientError.message };

    const { data: user, error: userError } = await supabase.from('app_users')
        .insert({
            client_id: client.id,
            name: name.trim(),
            username: username.trim(),
            password_hash: hashPassword(password),
            role: 'admin',
            active: true
        })
        .select().single();
    if(userError) return { success: false, message: 'حصل خطأ أثناء إنشاء الحساب: ' + userError.message };

    // تسجيل دائم إن الجهاز ده استخدم لعمل حساب - مش هيتأثر لو المتجر اتمسح بعدين
    const deviceId = getDeviceId();
    const { data: existingHistory } = await supabase.from('device_history').select('shop_count').eq('device_id', deviceId).maybeSingle();
    if(existingHistory) {
        await supabase.from('device_history').update({
            shop_count: (existingHistory.shop_count || 0) + 1,
            last_client_name: shopName.trim(),
            last_used: new Date().toISOString()
        }).eq('device_id', deviceId);
    } else {
        await supabase.from('device_history').insert({
            device_id: deviceId,
            shop_count: 1,
            last_client_name: shopName.trim()
        });
    }

    return { success: true, user: user, clientId: client.id };
}

// ==================== إدارة المستخدمين (للمدير) ====================
async function addUser(user) {
    const session = getCurrentSession();
    if(!session) return { success: false, message: 'لازم تسجل دخول أولاً' };
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase.from('app_users').select('id').eq('username', user.username.trim()).maybeSingle();
    if(existing) return { success: false, message: 'اسم المستخدم موجود بالفعل' };

    const { data, error } = await supabase.from('app_users')
        .insert({
            client_id: session.clientId,
            name: user.name.trim(),
            username: user.username.trim(),
            password_hash: hashPassword(user.password),
            role: user.role === 'admin' ? 'admin' : 'cashier',
            active: true
        })
        .select().single();

    if(error) return { success: false, message: 'حصل خطأ: ' + error.message };
    return { success: true, user: data };
}

async function updateUserRoleOrStatus(id, updates) {
    const session = getCurrentSession();
    const supabase = getSupabaseClient();

    // لازم يفضل مدير واحد فعّال على الأقل بنفس المتجر
    if(updates.role === 'cashier' || updates.active === false) {
        const { data: admins } = await supabase.from('app_users')
            .select('id').eq('client_id', session.clientId).eq('role', 'admin').eq('active', true).neq('id', id);
        if(!admins || admins.length === 0) {
            return { success: false, message: 'لازم يفضل مدير واحد فعّال على الأقل بالنظام' };
        }
    }

    const dbUpdates = {};
    if(updates.role !== undefined) dbUpdates.role = updates.role;
    if(updates.active !== undefined) dbUpdates.active = updates.active;

    const { error } = await supabase.from('app_users').update(dbUpdates).eq('id', id).eq('client_id', session.clientId);
    if(error) return { success: false, message: error.message };
    return { success: true };
}

async function resetUserPassword(id, newPassword) {
    const session = getCurrentSession();
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('app_users')
        .update({ password_hash: hashPassword(newPassword) })
        .eq('id', id).eq('client_id', session.clientId);
    if(error) return { success: false, message: error.message };
    return { success: true };
}

// المستخدم بيغيّر كلمة السر بتاعته هو بنفسه (لازم يعرف كلمة السر الحالية)
async function changeOwnPassword(currentPassword, newPassword) {
    const session = getCurrentSession();
    if(!session) return { success: false, message: 'لازم تسجل دخول أولاً' };
    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase.from('app_users').select('password_hash').eq('id', session.id).maybeSingle();
    if(error || !user) return { success: false, message: 'حصل خطأ - حاول تاني' };
    if(user.password_hash !== hashPassword(currentPassword)) return { success: false, message: 'كلمة المرور الحالية غير صحيحة' };
    if(!newPassword || newPassword.length < 6) return { success: false, message: 'كلمة المرور الجديدة لازم تكون 6 أحرف على الأقل' };

    const { error: updateError } = await supabase.from('app_users').update({ password_hash: hashPassword(newPassword) }).eq('id', session.id);
    if(updateError) return { success: false, message: updateError.message };
    return { success: true };
}

async function deleteUserById(id) {
    const session = getCurrentSession();
    const supabase = getSupabaseClient();

    const { data: target } = await supabase.from('app_users').select('role').eq('id', id).eq('client_id', session.clientId).maybeSingle();
    if(!target) return { success: false, message: 'المستخدم غير موجود' };

    if(target.role === 'admin') {
        const { data: admins } = await supabase.from('app_users')
            .select('id').eq('client_id', session.clientId).eq('role', 'admin').eq('active', true).neq('id', id);
        if(!admins || admins.length === 0) {
            return { success: false, message: 'لازم يفضل مدير واحد فعّال على الأقل بالنظام' };
        }
    }

    const { error } = await supabase.from('app_users').delete().eq('id', id).eq('client_id', session.clientId);
    if(error) return { success: false, message: error.message };
    return { success: true };
}

// ==================== تسجيل الدخول / الخروج ====================
async function login(username, password) {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase.from('app_users')
        .select('id, client_id, name, username, password_hash, role, active')
        .eq('username', username.trim())
        .maybeSingle();

    if(error) return { success: false, message: 'حصل خطأ في الاتصال: ' + error.message };
    if(!user) return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };

    const hashed = hashPassword(password);
    if(user.password_hash !== hashed) return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    if(!user.active) return { success: false, message: 'هذا الحساب موقوف - راجع المدير' };

    // تحقق من حالة المتجر نفسه (لو المبرمج وقفه)
    const { data: client } = await supabase.from('clients').select('suspended').eq('id', user.client_id).maybeSingle();
    if(client && client.suspended) {
        return { success: false, message: 'تم إيقاف الاشتراك مؤقتًا - يرجى التواصل مع المبرمج' };
    }

    // تحقق من حالة الجهاز، وسجّله تلقائيًا لو أول مرة يدخل بيه هذا المتجر
    const deviceCheck = await checkAndRegisterDevice(user.client_id);
    if(!deviceCheck.allowed) {
        return { success: false, message: deviceCheck.message };
    }

    const session = {
        id: user.id,
        clientId: user.client_id,
        name: user.name,
        username: user.username,
        role: user.role,
        loginTime: new Date().toISOString()
    };
    localStorage.setItem('currentSession', JSON.stringify(session));
    return { success: true, session: session };
}

// ==================== إدارة أجهزة العميل ====================
async function checkAndRegisterDevice(clientId) {
    const supabase = getSupabaseClient();
    const deviceId = getDeviceId();

    const { data: existing, error: existingError } = await supabase.from('client_devices')
        .select('active').eq('client_id', clientId).eq('device_id', deviceId).maybeSingle();

    if(existingError) {
        console.error('checkAndRegisterDevice (existing lookup):', existingError);
        return { allowed: false, message: 'تعذر التحقق من الجهاز - حاول تاني، ولو استمرت المشكلة تأكد إن قاعدة البيانات محدّثة' };
    }

    if(existing) {
        if(!existing.active) {
            return { allowed: false, message: 'تم إيقاف هذا الجهاز من قِبل المبرمج - تواصل معه' };
        }
        await supabase.from('client_devices').update({ last_seen: new Date().toISOString() }).eq('client_id', clientId).eq('device_id', deviceId);
        return { allowed: true };
    }

    // جهاز جديد - تحقق من الحد الأقصى المسموح به لهذا المتجر قبل التسجيل
    const { data: client, error: clientError } = await supabase.from('clients').select('max_devices').eq('id', clientId).maybeSingle();
    if(clientError) {
        console.error('checkAndRegisterDevice (max_devices lookup):', clientError);
        return { allowed: false, message: 'تعذر التحقق من حد الأجهزة - حاول تاني، ولو استمرت المشكلة تأكد إن قاعدة البيانات محدّثة' };
    }
    const maxDevices = (client && client.max_devices !== null && client.max_devices !== undefined) ? client.max_devices : 1;

    const { count, error: countError } = await supabase.from('client_devices')
        .select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('active', true);
    if(countError) {
        console.error('checkAndRegisterDevice (count):', countError);
        return { allowed: false, message: 'تعذر التحقق من عدد الأجهزة الحالية - حاول تاني، ولو استمرت المشكلة تأكد إن قاعدة البيانات محدّثة' };
    }

    if((count || 0) >= maxDevices) {
        console.warn('checkAndRegisterDevice: blocked - active count', count, '>= max', maxDevices, 'for client', clientId);
        return { allowed: false, message: 'تم الوصول للحد الأقصى لعدد الأجهزة المسموح بها (' + maxDevices + ') - تواصل مع المبرمج' };
    }
    console.log('checkAndRegisterDevice: registering new device - active count', count, 'max', maxDevices);

    // أول دخول من الجهاز ده لنفس المتجر - يتسجل تلقائيًا
    const { error: insertError } = await supabase.from('client_devices').insert({ client_id: clientId, device_id: deviceId, active: true });
    if(insertError) {
        console.error('checkAndRegisterDevice (insert):', insertError);
        return { allowed: false, message: 'تعذر تسجيل هذا الجهاز (' + insertError.message + ') - تأكد إن قاعدة البيانات محدّثة بالكامل' };
    }
    return { allowed: true };
}

function logout() {
    localStorage.removeItem('currentSession');
    window.location.href = 'login.html';
}

function getCurrentSession() {
    try {
        const session = JSON.parse(localStorage.getItem('currentSession'));
        // جلسة قديمة أو تالفة (من قبل ربط النظام بقاعدة البيانات، أو معطوبة) -
        // بدون clientId مفيش طريقة نجيب بيها بيانات صح، فنعتبرها غير صالحة
        if(!session || !session.clientId || !session.id) {
            localStorage.removeItem('currentSession');
            return null;
        }
        return session;
    } catch(e) {
        localStorage.removeItem('currentSession');
        return null;
    }
}

// ==================== حماية الصفحات ====================
// تتنادى فورًا في أول كل صفحة (جوه <head>) قبل ما المحتوى يتعرض.
// بتعتمد على الجلسة المحفوظة محليًا فورًا (منع فلاش المحتوى)، وبعد
// تحميل الصفحة بتتنادى revalidateSession للتأكد من قاعدة البيانات.
function requireAuth(minRole) {
    if(!isSubscriptionValid()) {
        window.location.href = 'login.html';
        return null;
    }
    const session = getCurrentSession();
    if(!session) {
        window.location.href = 'login.html';
        return null;
    }
    if(minRole === 'admin' && session.role !== 'admin') {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

// تحقق حقيقي من قاعدة البيانات (الحساب لسه موجود وفعّال) - تتنادى بعد تحميل الصفحة
async function revalidateSession(minRole) {
    const session = getCurrentSession();
    if(!session) { window.location.href = 'login.html'; return; }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase.from('app_users')
        .select('active, role')
        .eq('id', session.id)
        .maybeSingle();

    if(error) return; // مشكلة اتصال مؤقتة - سيبه شغال بالنسخة المحفوظة محليًا
    if(!user || !user.active) {
        localStorage.removeItem('currentSession');
        window.location.href = 'login.html';
        return;
    }

    // تحقق إن المتجر مش موقّف والجهاز ده لسه مسموح له (ممكن المبرمج يكون وقفهم وهو شغال)
    const { data: client } = await supabase.from('clients').select('suspended').eq('id', session.clientId).maybeSingle();
    if(client && client.suspended) {
        localStorage.removeItem('currentSession');
        window.location.href = 'login.html';
        return;
    }
    const { data: device } = await supabase.from('client_devices').select('active').eq('client_id', session.clientId).eq('device_id', getDeviceId()).maybeSingle();
    if(device && !device.active) {
        localStorage.removeItem('currentSession');
        window.location.href = 'login.html';
        return;
    }

    if(minRole === 'admin' && user.role !== 'admin') {
        window.location.href = 'index.html';
    }
}

// ==================== شريط المستخدم الحالي ====================
function renderUserBar(session, position) {
    if(!session) return;
    const bar = document.createElement('div');
    bar.className = 'user-session-bar' + (position === 'center' ? ' user-session-bar-center' : '');

    let daysHtml = '';
    if(session.role === 'admin') {
        const daysLeft = subscriptionDaysLeft();
        const warn = daysLeft <= 7;
        daysHtml = '<span class="badge ' + (warn ? 'bg-danger' : 'bg-dark') + '" title="أيام متبقية على الاشتراك">' +
            '<i class="fas fa-calendar-check"></i> ' + daysLeft + ' يوم</span>';
    }

    bar.innerHTML =
        '<span class="user-session-name"><i class="fas fa-user-circle"></i> ' + session.name +
        ' <span class="badge ' + (session.role === 'admin' ? 'bg-warning text-dark' : 'bg-secondary') + '">' +
        (session.role === 'admin' ? 'مدير' : 'كاشير') + '</span> ' + daysHtml + '</span>' +
        '<button class="btn btn-sm btn-outline-secondary" onclick="openChangePasswordModal()" title="تغيير كلمة المرور"><i class="fas fa-key"></i></button>' +
        '<button class="btn btn-sm btn-outline-danger" onclick="if(confirm(\'تسجيل الخروج؟\')) logout()"><i class="fas fa-sign-out-alt"></i> خروج</button>';
    document.body.appendChild(bar);

    injectChangePasswordModal();

    if(session.role !== 'admin') {
        document.querySelectorAll('.admin-only-link').forEach(el => el.style.display = 'none');
    }
}

// ==================== نافذة تغيير كلمة المرور الذاتية ====================
function injectChangePasswordModal() {
    if(document.getElementById('changePasswordModal')) return;
    const modalHtml = `
        <div class="modal fade" id="changePasswordModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-dark text-warning">
                        <h5 class="modal-title"><i class="fas fa-key"></i> تغيير كلمة المرور</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger" id="cpError" style="display:none;"></div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">كلمة المرور الحالية</label>
                            <input type="password" id="cpCurrent" class="form-control" dir="ltr">
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">كلمة المرور الجديدة</label>
                            <input type="password" id="cpNew" class="form-control" dir="ltr" placeholder="6 أحرف على الأقل">
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">تأكيد كلمة المرور الجديدة</label>
                            <input type="password" id="cpConfirm" class="form-control" dir="ltr">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button class="btn btn-primary" onclick="submitChangePassword()"><i class="fas fa-save"></i> حفظ</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openChangePasswordModal() {
    document.getElementById('cpCurrent').value = '';
    document.getElementById('cpNew').value = '';
    document.getElementById('cpConfirm').value = '';
    document.getElementById('cpError').style.display = 'none';
    new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

async function submitChangePassword() {
    const current = document.getElementById('cpCurrent').value;
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;
    const errEl = document.getElementById('cpError');
    errEl.style.display = 'none';

    if(!current || !newPass) { errEl.textContent = 'الرجاء ملء كل الحقول'; errEl.style.display = 'block'; return; }
    if(newPass !== confirmPass) { errEl.textContent = 'كلمتا المرور الجديدتان غير متطابقتين'; errEl.style.display = 'block'; return; }

    const result = await changeOwnPassword(current, newPass);
    if(!result.success) { errEl.textContent = result.message; errEl.style.display = 'block'; return; }

    bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
    if(typeof showNotification === 'function') {
        showNotification('تم تغيير كلمة المرور بنجاح 🔑', 'success');
    } else {
        alert('تم تغيير كلمة المرور بنجاح');
    }
}
