import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase.js';

async function renderNotification() {
    const container = document.getElementById('siteNotif');
    if (!container) return;

    try {
        const snap = await getDoc(doc(db, 'settings', 'notification'));
        if (!snap.exists() || !snap.data().active) return;

        const { message, style, color } = snap.data();
        const cls = style === 'sticky' ? 'notif-sticky-banner' : 'notif-banner';

        container.innerHTML = `
        <div class="${cls} ${color || 'purple'}" id="siteNotifBanner">
            <span>${message}</span>
            <button class="banner-close" id="notifDismiss">&times;</button>
        </div>`;

        document.getElementById('notifDismiss')?.addEventListener('click', () => {
            container.innerHTML = '';
        });
    } catch (e) {
        // Silently fail — notification is non-critical
    }
}

renderNotification();
