import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { db } from './firebase.js';
import { showToast, setLoading } from './utils.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();
let currentUser = null;
let cart = [];

// ── Cart Persistence ────────────────────────────────────
function saveCartToLocalStorage() {
    localStorage.setItem('Alexisunplugged_cart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const saved = localStorage.getItem('Alexisunplugged_cart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
            updateCartUI();
        } catch (e) {
            console.error('Failed to load cart:', e);
        }
    }
}

function clearCart() {
    cart = [];
    saveCartToLocalStorage();
    updateCartUI();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ── Auth ────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
    currentUser = user;
    const link = document.getElementById('dashboardNavLink');
    if (link) link.style.display = user ? 'inline' : 'none';
});

// ── Cart UI ─────────────────────────────────────────────
const cartToggle = document.getElementById('cartToggle');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');

if (cartToggle) cartToggle.addEventListener('click', openCart);
if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

function openCart() {
    if (cartSidebar) cartSidebar.classList.add('open');
    if (cartOverlay) cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    if (cartSidebar) cartSidebar.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
}

function updateCartUI() {
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const checkoutEl = document.getElementById('checkoutBtn');

    if (countEl) countEl.textContent = cart.length;
    const total = cart.reduce((sum, i) => sum + i.price, 0);
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
    if (checkoutEl) checkoutEl.disabled = cart.length === 0;

    if (!itemsEl) return;

    if (cart.length === 0) {
        itemsEl.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem 0;">Your cart is empty.</p>';
        return;
    }

    itemsEl.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
        <div class="cart-item-img">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width:50px;height:50px;object-fit:cover;border-radius:10px;">` : `<i class="fas fa-file-pdf"></i>`}
        </div>
        <div class="cart-item-info">
            <h4>${escapeHtml(item.name)}</h4>
            <p>$${item.price.toFixed(2)}</p>
        </div>
        <button class="cart-remove" data-idx="${idx}"><i class="fas fa-times"></i></button>
    </div>`).join('');

    itemsEl.querySelectorAll('.cart-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            cart.splice(parseInt(btn.dataset.idx), 1);
            saveCartToLocalStorage();
            updateCartUI();
        });
    });
}

// ── Load products ───────────────────────────────────────
let currentCat = '';

async function loadProducts(reset = false) {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loader"></div>';

    try {
        let q;
        if (currentCat) {
            q = query(collection(db, 'shop'), where('category', '==', currentCat), where('published', '==', true), orderBy('createdAt', 'desc'));
        } else {
            q = query(collection(db, 'shop'), where('published', '==', true), orderBy('createdAt', 'desc'));
        }

        const snap = await getDocs(q);
        grid.innerHTML = '';

        if (snap.empty) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:3rem 0;">No products yet. Check back soon!</p>';
            return;
        }

        snap.docs.forEach(d => {
            const p = d.data();
            grid.insertAdjacentHTML('beforeend', productCard(d.id, p));
        });

        grid.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const snap2 = snap.docs.find(d => d.id === id);
                if (!snap2) return;
                const p = snap2.data();

                if (cart.find(i => i.id === id)) {
                    showToast('Already in cart.', 'warning');
                    return;
                }

                cart.push({ 
                    id, 
                    name: p.name, 
                    price: parseFloat(p.price), 
                    imageUrl: p.imageUrl || '',
                    downloadUrl: p.downloadUrl || ''
                });
                saveCartToLocalStorage();
                updateCartUI();
                showToast(`"${p.name}" added to cart`, 'success');
                openCart();
            });
        });

    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--error);padding:3rem 0;">Error loading products. Please refresh the page.</p>';
    }
}

function productCard(id, p) {
    return `
    <div class="product-card">
        ${p.imageUrl
            ? `<img class="product-img" src="${p.imageUrl}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">`
            : `<div class="product-img-placeholder"><i class="fas fa-${p.icon || 'file-pdf'}"></i></div>`}
        <div class="product-body">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.description || '')}</p>
            <div class="product-footer">
                <span class="product-price">$${parseFloat(p.price).toFixed(2)}</span>
                <button class="btn btn-primary btn-sm add-to-cart" data-id="${id}">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    </div>`;
}

// ── Filter ──────────────────────────────────────────────
document.querySelectorAll('#shopFilter .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#shopFilter .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCat = btn.dataset.cat;
        loadProducts();
    });
});

// ── Checkout ────────────────────────────────────────────
document.getElementById('checkoutBtn')?.addEventListener('click', async () => {
    if (!currentUser) {
        showToast('Please sign in to checkout.', 'error');
        signInWithPopup(auth, provider)
            .then(() => showToast('Signed in! Click Checkout again.', 'success'))
            .catch(e => showToast(e.message, 'error'));
        return;
    }

    if (!cart.length) return;

    const total = cart.reduce((sum, i) => sum + i.price, 0);
    const btn = document.getElementById('checkoutBtn');
    setLoading(btn, true);

    // ⚠️ IMPORTANT: Replace with your actual Flutterwave public key
    const FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-x';

    if (!window.FlutterwaveCheckout) {
        showToast('Payment system not loaded. Please refresh the page.', 'error');
        setLoading(btn, false);
        return;
    }

    window.FlutterwaveCheckout({
        public_key: FLUTTERWAVE_PUBLIC_KEY,
        tx_ref: 'SP_SHOP_' + Date.now(),
        amount: total,
        currency: 'USD',
        payment_options: 'card, mobilemoneyghana, ussd',
        customer: {
            email: currentUser.email,
            name: currentUser.displayName || 'Customer',
        },
        customizations: {
            title: 'Alexisunplugged Shop',
            description: cart.map(i => i.name).join(', ').substring(0, 100),
            logo: window.location.origin + '/images/logo.jpg',
        },
        callback: async (response) => {
            if (response.status === 'successful') {
                await saveOrder(response.transaction_id, response.status);
            } else {
                showToast('Payment not completed. Please try again.', 'error');
            }
            setLoading(btn, false);
        },
        onclose: () => setLoading(btn, false),
    });
});

async function saveOrder(txRef, paymentStatus) {
    try {
        for (const item of cart) {
            await addDoc(collection(db, 'orders'), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                productId: item.id,
                productName: item.name,
                totalAmount: item.price,
                txRef,
                paymentStatus,
                status: 'completed',
                downloadUrl: item.downloadUrl || '',
                createdAt: serverTimestamp(),
            });
        }
        showToast('Purchase successful! Check your email for download links.', 'success');
        clearCart();
        closeCart();
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
    } catch (e) {
        showToast('Error saving order: ' + e.message, 'error');
    }
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadCartFromLocalStorage();
    loadProducts();
    updateCartUI();

    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav-menu');
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