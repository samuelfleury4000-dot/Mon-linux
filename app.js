const API_BASE = '/api';

function getSession() {
    return JSON.parse(localStorage.getItem('casinoSession') || 'null');
}

function saveSession(session) {
    localStorage.setItem('casinoSession', JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem('casinoSession');
}

function getToken() {
    const session = getSession();
    return session ? session.token : null;
}

async function apiFetch(path, options = {}) {
    options.headers = options.headers || {};
    options.headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (options.body && typeof options.body !== 'string') options.body = JSON.stringify(options.body);
    const res = await fetch(API_BASE + path, options);
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
}

async function requireLogin() {
    const session = getSession();
    if (!session || !session.token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function renderHeader() {
    const header = document.getElementById('appHeader');
    if (!header) return;
    const session = getSession();
    if (session && session.userId) {
        header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;background:#081622;padding:14px 20px;border-radius:14px;margin-bottom:16px;">
            <div>Connecté en tant que <strong>${session.userId}</strong></div>
            <div><button onclick="logout()" style="padding:10px 14px;border:none;border-radius:10px;background:#1fa2ff;color:white;cursor:pointer;">Déconnexion</button></div>
        </div>`;
    } else {
        header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;background:#081622;padding:14px 20px;border-radius:14px;margin-bottom:16px;">
            <div>Vous n'êtes pas connecté.</div>
            <div><button onclick="window.location.href='login.html'" style="padding:10px 14px;border:none;border-radius:10px;background:#1fa2ff;color:white;cursor:pointer;">Connexion</button></div>
        </div>`;
    }
}

async function logout() {
    const token = getToken();
    if (token) await apiFetch('/auth/logout', { method: 'POST', body: {} });
    clearSession();
    window.location.href = 'login.html';
}

async function loadProfile() {
    const profileEl = document.getElementById('profileInfo');
    if (!profileEl) return;
    const response = await apiFetch('/auth/profile', { method: 'GET' });
    if (response.ok && response.data.success) {
        const user = response.data.user;
        profileEl.innerHTML = `<strong>${user.id}</strong><br>Solde : ${user.balance.toFixed(2)} $<br>Rôle : ${user.role}`;
    } else {
        profileEl.innerText = 'Impossible de charger le profil.';
    }
}

window.addEventListener('DOMContentLoaded', renderHeader);
