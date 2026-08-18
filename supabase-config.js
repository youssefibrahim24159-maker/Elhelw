// ==================== إعدادات الاتصال بقاعدة البيانات ====================
const SUPABASE_URL = 'https://guxytwmzecmdxigkdlgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1eHl0d216ZWNtZHhpZ2tkbGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTY3MDgsImV4cCI6MjEwMjIzMjcwOH0.vFpOBjCL1vXZBxmvpsmbousmd368IBjf8gxbn0XA5Yc';

let _supabaseClient = null;
function getSupabaseClient() {
    if(!_supabaseClient) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _supabaseClient;
}
