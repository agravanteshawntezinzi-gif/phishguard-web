// --- PHISHGUARD ADMIN SECURITY LOCK ---

// 1. Check if the user is authorized. If not, kick them out immediately.
function verifyAccess() {
    const authStatus = localStorage.getItem('pg_admin_auth');
    const authExpiry = localStorage.getItem('pg_admin_expiry');

    if (authStatus !== 'true' || !authExpiry || Date.now() > parseInt(authExpiry)) {
        performLogout();
    }
}

// 2. Reset the 1-hour timeout whenever the user interacts with the page
function resetActivityTimer() {
    if (localStorage.getItem('pg_admin_auth') === 'true') {
        localStorage.setItem('pg_admin_expiry', Date.now() + 3600000); // 1 Hour
    }
}

// 3. Logout function
function performLogout() {
    localStorage.removeItem('pg_admin_auth');
    localStorage.removeItem('pg_admin_expiry');
    window.location.replace('index.html'); // Replace prevents back-button bypass
}

// 4. Listen for logouts in other tabs
window.addEventListener('storage', function(e) {
    if (e.key === 'pg_admin_auth' && e.newValue === null) {
        window.location.replace('index.html');
    }
});

// Run verification immediately
verifyAccess();

// Track activity to reset the timer
window.onload = resetActivityTimer;
document.onmousemove = resetActivityTimer;
document.onkeypress = resetActivityTimer;