import { getFirestore, collection, query, orderBy, where, getDocs, doc, getDoc, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { db } from './firebase.js';

const auth = getAuth();
const PAGE_SIZE = 9;

let lastVisible = null;
let currentCategory = '';

// ── Auth ────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
    const link = document.getElementById('dashboardNavLink');
    if (link) link.style.display = user ? 'inline' : 'none';
});

// ── Category filter ─────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.cat;
        lastVisible = null;
        loadPosts(true);
    });
});

// ── Load posts ──────────────────────────────────────────
async function loadPosts(reset = false) {
    const grid = document.getElementById('blogGrid');
    const loadMoreWrap = document.getElementById('loadMoreWrap');

    if (reset) {
        grid.innerHTML = '<div class="loader"></div>';
        lastVisible = null;
    }

    try {
        let q;
        const base = collection(db, 'blog');

        if (currentCategory) {
            q = lastVisible
                ? query(base, where('category', '==', currentCategory), where('published', '==', true), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE))
                : query(base, where('category', '==', currentCategory), where('published', '==', true), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        } else {
            q = lastVisible
                ? query(base, where('published', '==', true), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE))
                : query(base, where('published', '==', true), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        }

        const snap = await getDocs(q);

        if (reset) grid.innerHTML = '';

        if (snap.empty && reset) {
            grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);grid-column:1/-1;padding:3rem 0;">No posts yet. Check back soon!</p>';
            loadMoreWrap.style.display = 'none';
            return;
        }

        lastVisible = snap.docs[snap.docs.length - 1];

        snap.docs.forEach(d => {
            const post = d.data();
            grid.insertAdjacentHTML('beforeend', postCard(d.id, post));
        });

        loadMoreWrap.style.display = snap.docs.length === PAGE_SIZE ? 'block' : 'none';

        // Attach click events
        grid.querySelectorAll('.blog-card[data-id]').forEach(card => {
            card.addEventListener('click', () => loadPost(card.dataset.id));
        });

    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p style="text-align:center;color:var(--error);grid-column:1/-1;padding:3rem 0;">Error loading posts.</p>';
    }
}

function postCard(id, post) {
    const date = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const imgHtml = post.imageUrl
        ? `<img class="blog-card-img" src="${post.imageUrl}" alt="${post.title}" loading="lazy">`
        : `<div class="blog-card-img-placeholder"><i class="fas fa-feather-alt"></i></div>`;

    return `
    <div class="blog-card" data-id="${id}">
        ${imgHtml}
        <div class="blog-card-body">
            <div class="blog-card-meta">
                ${post.category ? `<span class="blog-card-tag">${categoryLabel(post.category)}</span>` : ''}
                <span>${date}</span>
                ${post.readTime ? `<span><i class="fas fa-clock"></i> ${post.readTime} min read</span>` : ''}
            </div>
            <h3>${post.title}</h3>
            <p>${post.excerpt || post.content?.substring(0, 120) || ''}...</p>
        </div>
    </div>`;
}

function categoryLabel(cat) {
    const map = { love: 'Love & Relationships', career: 'Career & Purpose', healing: 'Healing', astrology: 'Astrology', mindset: 'Mindset' };
    return map[cat] || cat;
}

// ── Load single post ────────────────────────────────────
async function loadPost(id) {
    document.getElementById('listView').style.display = 'none';
    document.getElementById('postView').style.display = 'block';
    document.getElementById('postHeader').innerHTML = '<div class="loader"></div>';
    document.getElementById('postContent').innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const snap = await getDoc(doc(db, 'blog', id));
        if (!snap.exists()) throw new Error('Post not found');
        const post = snap.data();
        const date = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

        document.getElementById('postHeader').innerHTML = `
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}" style="width:100%;max-height:400px;object-fit:cover;border-radius:20px;margin-bottom:2rem;">` : ''}
            <div class="blog-card-meta" style="justify-content:center;">
                ${post.category ? `<span class="blog-card-tag">${categoryLabel(post.category)}</span>` : ''}
                <span>${date}</span>
                ${post.readTime ? `<span><i class="fas fa-clock"></i> ${post.readTime} min read</span>` : ''}
            </div>
            <h1 style="font-size:clamp(1.8rem,4vw,3rem);margin-top:1rem;">${post.title}</h1>
        `;

        // Render content – supports plain text or simple HTML
        document.getElementById('postContent').innerHTML = post.contentHtml || `<p>${(post.content || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;

        document.title = post.title + ' | Alexisunplugged Blog';
    } catch (e) {
        document.getElementById('postHeader').innerHTML = '<p style="color:var(--error)">Post not found.</p>';
    }
}

document.getElementById('backToList')?.addEventListener('click', () => {
    document.getElementById('postView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';
    document.title = 'Blog | Alexisunplugged';
});

document.getElementById('loadMoreBtn')?.addEventListener('click', () => loadPosts(false));

// Mobile nav
document.addEventListener('DOMContentLoaded', () => {
    loadPosts(true);

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
