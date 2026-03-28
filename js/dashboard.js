import { getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase.js';
import { showToast, setLoading } from './utils.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();

// ── Auth gate ───────────────────────────────────────────
const authGate     = document.getElementById('authGate');
const dashWrap     = document.getElementById('dashboardWrap');
const dashNavLink  = document.getElementById('dashboardNavLink');

onAuthStateChanged(auth, user => {
    if (user) {
        authGate.style.display  = 'none';
        dashWrap.style.display  = 'block';
        if (dashNavLink) dashNavLink.style.display = 'inline';
        initDashboard(user);
    } else {
        authGate.style.display  = 'flex';
        dashWrap.style.display  = 'none';
    }
});

document.getElementById('signInBtn')?.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => showToast(e.message, 'error'));
});

document.getElementById('signOutBtn')?.addEventListener('click', e => {
    e.preventDefault();
    signOut(auth).then(() => showToast('Signed out.'));
});

// ── Panel nav ───────────────────────────────────────────
document.querySelectorAll('.dashboard-nav a[data-panel]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.dashboard-nav a').forEach(a => a.classList.remove('active'));
        document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
        link.classList.add('active');
        document.getElementById('panel-' + link.dataset.panel)?.classList.add('active');
    });
});

// Mobile menu
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav    = document.querySelector('.nav-menu');
    toggle?.addEventListener('click', e => {
        e.stopPropagation();
        nav.classList.toggle('active');
        toggle.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        nav.classList.remove('active');
        toggle?.classList.remove('active');
        document.body.classList.remove('menu-open');
    }));
});

// ── Init ────────────────────────────────────────────────
async function initDashboard(user) {
    // Set user info in sidebar
    document.getElementById('userPhoto').src  = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User') + '&background=9b7bff&color=fff&size=70';
    document.getElementById('userName').textContent  = user.displayName || 'Seeker';
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('greetName').textContent = (user.displayName || 'Seeker').split(' ')[0];

    // Load profile
    await loadProfile(user);

    // Load data
    const [bookings, orders] = await Promise.all([
        loadBookings(user.uid),
        loadOrders(user.uid)
    ]);

    // Stats
    const totalSpent = [
        ...bookings.map(b => b.totalAmount || 0),
        ...orders.map(o => o.totalAmount || 0)
    ].reduce((a, b) => a + b, 0);

    document.getElementById('statBookings').textContent = bookings.length;
    document.getElementById('statOrders').textContent   = orders.length;
    document.getElementById('statSpent').textContent    = '$' + totalSpent.toFixed(0);

    renderUpcoming(bookings);
    renderAllBookings(bookings);
    renderOrders(orders);
}

// ── Bookings ────────────────────────────────────────────
async function loadBookings(uid) {
    try {
        const q = query(collection(db, 'bookings'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error(e);
        return [];
    }
}

function statusBadge(status) {
    const map = { pending: 'badge-warning', confirmed: 'badge-success', cancelled: 'badge-error' };
    return `<span class="badge ${map[status] || 'badge-info'}">${status || 'pending'}</span>`;
}

function formatDT(dt) {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return '—'; }
}

function renderUpcoming(bookings) {
    const container = document.getElementById('upcomingBookings');
    const upcoming  = bookings.filter(b => b.status !== 'cancelled').slice(0, 5);

    if (!upcoming.length) {
        container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No upcoming bookings. <a href="booking.html" style="color:var(--accent)">Book a reading</a>.</div>`;
        return;
    }

    container.innerHTML = `
    <table class="data-table">
        <thead><tr><th>Service</th><th>Duration</th><th>Date & Time</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
        ${upcoming.map(b => `
            <tr>
                <td>${b.service?.name || '—'}</td>
                <td>${b.duration?.label || '—'}</td>
                <td>${formatDT(b.dateTime)}</td>
                <td>$${b.totalAmount || 0}</td>
                <td>${statusBadge(b.status)}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

function renderAllBookings(bookings) {
    const container = document.getElementById('allBookings');

    if (!bookings.length) {
        container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No bookings yet.</div>`;
        return;
    }

    container.innerHTML = `
    <table class="data-table">
        <thead><tr><th>Service</th><th>Duration</th><th>Date & Time</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
        ${bookings.map(b => `
            <tr>
                <td>${b.service?.name || '—'}</td>
                <td>${b.duration?.label || '—'}</td>
                <td>${formatDT(b.dateTime)}</td>
                <td>$${b.totalAmount || 0}</td>
                <td>${statusBadge(b.status)}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ── Orders ──────────────────────────────────────────────
async function loadOrders(uid) {
    try {
        const q = query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error(e);
        return [];
    }
}

function renderOrders(orders) {
    const container = document.getElementById('allOrders');

    if (!orders.length) {
        container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No orders yet. <a href="shop.html" style="color:var(--accent)">Visit the shop</a>.</div>`;
        return;
    }

    container.innerHTML = orders.map(o => `
    <div class="order-card">
        <div class="order-card-info">
            <h4>${o.productName || 'Product'}</h4>
            <p>${formatDT(o.createdAt?.toDate?.() || o.createdAt)} &nbsp;·&nbsp; $${o.totalAmount || 0}</p>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
            ${statusBadge(o.status || 'completed')}
            ${o.downloadUrl ? `<a href="${o.downloadUrl}" class="btn btn-sm btn-outline" target="_blank"><i class="fas fa-download"></i> Download</a>` : ''}
        </div>
    </div>`).join('');
}

// ── Profile ─────────────────────────────────────────────
async function loadProfile(user) {
    try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        document.getElementById('profileName').value  = data.displayName || user.displayName || '';
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileDob').value   = data.dob || '';
    } catch (e) { /* no profile doc yet */ }
}

document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('saveProfileBtn');
    setLoading(btn, true);

    try {
        await setDoc(doc(db, 'users', user.uid), {
            displayName: document.getElementById('profileName').value.trim(),
            phone:       document.getElementById('profilePhone').value.trim(),
            dob:         document.getElementById('profileDob').value,
            updatedAt:   serverTimestamp()
        }, { merge: true });
        showToast('Profile saved!', 'success');
    } catch (e) {
        showToast('Error saving profile: ' + e.message, 'error');
    } finally {
        setLoading(btn, false);
    }
});
