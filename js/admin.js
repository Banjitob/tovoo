import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase.js';
import { showToast, setLoading } from './utils.js';

const auth = getAuth();
const loginPage = document.getElementById('adminLoginPage');
const adminDash = document.getElementById('adminDash');

// ── Check auth state on page load ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
    
    if (user) {
        // Check if user is admin (from admins collection)
        try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            console.log('Admin doc exists:', adminDoc.exists());
            
            if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
                // User is admin - show dashboard
                console.log('User is admin, showing dashboard');
                loginPage.style.display = 'none';
                adminDash.style.display = 'block';
                initAdmin();
            } else {
                // User is not admin - sign out and show login with error
                console.log('User is NOT admin, signing out');
                await signOut(auth);
                loginPage.style.display = 'flex';
                adminDash.style.display = 'none';
                const errorEl = document.getElementById('loginError');
                if (errorEl) {
                    errorEl.textContent = 'You do not have admin privileges.';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            console.error('Error checking admin status:', err);
            await signOut(auth);
            loginPage.style.display = 'flex';
            adminDash.style.display = 'none';
            const errorEl = document.getElementById('loginError');
            if (errorEl) {
                errorEl.textContent = 'Error verifying admin access. Please contact support.';
                errorEl.style.display = 'block';
            }
        }
    } else {
        // User not logged in - show login page
        console.log('User not logged in, showing login page');
        loginPage.style.display = 'flex';
        adminDash.style.display = 'none';
    }
});

// ── Login button click ───────────────────────────────────────────
const loginBtn = document.getElementById('adminLoginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorEl = document.getElementById('loginError');
        
        console.log('Login attempt for:', email);
        
        if (!email || !password) {
            if (errorEl) {
                errorEl.textContent = 'Please enter email and password.';
                errorEl.style.display = 'block';
            }
            return;
        }
        
        // Disable button and show loading
        const btn = document.getElementById('adminLoginBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('Login successful, waiting for auth state change...');
        } catch (err) {
            console.error('Login error:', err.code, err.message);
            if (errorEl) {
                errorEl.textContent = 'Invalid email or password.';
                errorEl.style.display = 'block';
            }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-unlock-alt"></i> Sign In';
            const passwordField = document.getElementById('adminPassword');
            if (passwordField) passwordField.value = '';
        }
    });
}

// Enter key support
const adminPassword = document.getElementById('adminPassword');
const adminEmail = document.getElementById('adminEmail');
if (adminPassword) {
    adminPassword.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('adminLoginBtn')?.click();
    });
}
if (adminEmail) {
    adminEmail.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('adminLoginBtn')?.click();
    });
}

// ── Logout ──────────────────────────────────────────────────────────
const logoutBtn = document.getElementById('adminLogoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        console.log('Logged out');
        showToast('Logged out successfully', 'success');
    });
}

// ── Panel navigation ────────────────────────────────────────────────
const panelTitles = {
    overview: 'Overview',
    bookings: 'Bookings',
    blog: 'Blog Posts',
    shop: 'Shop Products',
    testimonials: 'Testimonials',
    notifications: 'Notifications'
};

document.querySelectorAll('.admin-nav a[data-panel]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const panel = link.dataset.panel;
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        link.classList.add('active');
        const targetPanel = document.getElementById('panel-' + panel);
        if (targetPanel) targetPanel.classList.add('active');
        const titleEl = document.getElementById('adminPanelTitle');
        if (titleEl) titleEl.textContent = panelTitles[panel] || panel;
    });
});

// ── Helper functions ────────────────────────────────────────────────
function formatDT(val) {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}

function statusBadge(status) {
    const map = { pending: 'badge-warning', confirmed: 'badge-success', cancelled: 'badge-error', completed: 'badge-success' };
    return `<span class="badge ${map[status] || 'badge-info'}">${status || '—'}</span>`;
}

function attachStatusChanges(selector) {
    document.querySelectorAll(`${selector} .status-change`).forEach(sel => {
        sel.addEventListener('change', async () => {
            try {
                await updateDoc(doc(db, 'bookings', sel.dataset.id), { status: sel.value });
                showToast('Status updated.', 'success');
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            }
        });
    });
}

// ── Initialize all panels ──────────────────────────────────────────
async function initAdmin() {
    console.log('Initializing admin dashboard...');
    try {
        await Promise.all([
            loadOverview(),
            loadAdminBookings(),
            loadBlogPosts(),
            loadShopProducts(),
            loadTestimonialsAdmin(),
            loadActiveNotif()
        ]);
    } catch (e) {
        console.error('Error initializing admin:', e);
        showToast('Error loading dashboard data', 'error');
    }
}

// ── Overview ────────────────────────────────────────────────────────
async function loadOverview() {
    try {
        const [bookings, orders, blog, shop] = await Promise.all([
            getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))),
            getDocs(collection(db, 'orders')),
            getDocs(collection(db, 'blog')),
            getDocs(collection(db, 'shop')),
        ]);

        const revenue = [...orders.docs].reduce((sum, d) => sum + (d.data().totalAmount || 0), 0)
                      + [...bookings.docs].reduce((sum, d) => sum + (d.data().totalAmount || 0), 0);

        const ovBookings = document.getElementById('ov-bookings');
        const ovOrders = document.getElementById('ov-orders');
        const ovBlog = document.getElementById('ov-blog');
        const ovProducts = document.getElementById('ov-products');
        const ovRevenue = document.getElementById('ov-revenue');
        
        if (ovBookings) ovBookings.textContent = bookings.size;
        if (ovOrders) ovOrders.textContent = orders.size;
        if (ovBlog) ovBlog.textContent = blog.size;
        if (ovProducts) ovProducts.textContent = shop.size;
        if (ovRevenue) ovRevenue.textContent = '$' + revenue.toFixed(0);

        const recent = bookings.docs.slice(0, 8);
        const recentContainer = document.getElementById('recentBookings');
        if (recentContainer) {
            recentContainer.innerHTML = recent.length ? `
            <table class="data-table">
                <thead>
                    <th>Client</th><th>Service</th><th>Date & Time</th><th>Amount</th><th>Status</th><th>Action</th>
                </thead>
                <tbody>
                ${recent.map(d => {
                    const b = d.data();
                    return `
                    <tr>
                        <td>${escapeHtml(b.userInfo?.name || b.userEmail || '—')}</td>
                        <td>${escapeHtml(b.service?.name || '—')}</td>
                        <td>${formatDT(b.dateTime)}</td>
                        <td>$${b.totalAmount || 0}</td>
                        <td>${statusBadge(b.status)}</td>
                        <td>
                            <select class="status-change" data-id="${d.id}" style="width:auto;padding:0.3rem 0.5rem;font-size:0.8rem;">
                                <option ${b.status==='pending' ? 'selected' : ''} value="pending">Pending</option>
                                <option ${b.status==='confirmed' ? 'selected' : ''} value="confirmed">Confirm</option>
                                <option ${b.status==='cancelled' ? 'selected' : ''} value="cancelled">Cancel</option>
                            </select>
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>` : '<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No bookings yet.</div>';
        }

        attachStatusChanges('#recentBookings');
    } catch (e) {
        console.error('Error loading overview:', e);
        showToast('Error loading overview data', 'error');
    }
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

// ── Bookings ────────────────────────────────────────────────────────
async function loadAdminBookings(statusFilter = '') {
    const container = document.getElementById('adminBookingsTable');
    if (!container) return;
    
    try {
        const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        let docs = snap.docs;
        if (statusFilter) docs = docs.filter(d => d.data().status === statusFilter);

        container.innerHTML = docs.length ? `
        <table class="data-table">
            <thead>
                <th>Client</th><th>Email</th><th>Service</th><th>Duration</th><th>Date & Time</th><th>Amount</th><th>Status</th><th>Action</th>
            </thead>
            <tbody>
            ${docs.map(d => {
                const b = d.data();
                return `
                <tr>
                    <td>${escapeHtml(b.userInfo?.name || '—')}</td>
                    <td>${escapeHtml(b.userInfo?.email || b.userEmail || '—')}</td>
                    <td>${escapeHtml(b.service?.name || '—')}</td>
                    <td>${escapeHtml(b.duration?.label || '—')}</td>
                    <td>${formatDT(b.dateTime)}</td>
                    <td>$${b.totalAmount || 0}</td>
                    <td>${statusBadge(b.status)}</td>
                    <td>
                        <select class="status-change" data-id="${d.id}" style="width:auto;padding:0.3rem 0.5rem;font-size:0.8rem;">
                            <option ${b.status==='pending' ? 'selected' : ''} value="pending">Pending</option>
                            <option ${b.status==='confirmed' ? 'selected' : ''} value="confirmed">Confirmed</option>
                            <option ${b.status==='cancelled' ? 'selected' : ''} value="cancelled">Cancelled</option>
                        </select>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>` : '<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No bookings found.</div>';

        attachStatusChanges('#adminBookingsTable');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="padding:1.5rem;color:var(--error);">Error loading bookings. Please refresh the page.</div>';
    }
}

const bookingStatusFilter = document.getElementById('bookingStatusFilter');
if (bookingStatusFilter) {
    bookingStatusFilter.addEventListener('change', e => {
        loadAdminBookings(e.target.value);
    });
}

// ── Blog ────────────────────────────────────────────────────────────
async function loadBlogPosts() {
    const container = document.getElementById('blogList');
    if (!container) return;
    
    try {
        const snap = await getDocs(query(collection(db, 'blog'), orderBy('createdAt', 'desc')));
        if (snap.empty) {
            container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No posts yet. Create your first one above.</div>';
            return;
        }
        container.innerHTML = `
        <table class="data-table">
            <thead>
                <th>Title</th><th>Category</th><th>Published</th><th>Date</th><th>Actions</th>
            </thead>
            <tbody>
            ${snap.docs.map(d => {
                const p = d.data();
                return `
                <tr>
                    <td>${escapeHtml(p.title)}</td>
                    <td>${escapeHtml(p.category || '—')}</td>
                    <td>${p.published ? '<span class="badge badge-success">Live</span>' : '<span class="badge badge-warning">Draft</span>'}</td>
                    <td>${formatDT(p.createdAt)}</td>
                    <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-outline edit-post" data-id="${d.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm toggle-pub" data-id="${d.id}" data-pub="${p.published}" style="background:rgba(255,255,255,0.08);border:none;color:var(--text-secondary);">
                            ${p.published ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
                        </button>
                        <button class="btn btn-sm btn-danger del-post" data-id="${d.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>`;

        // Edit
        container.querySelectorAll('.edit-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const snap2 = await getDoc(doc(db, 'blog', btn.dataset.id));
                    const p = snap2.data();
                    const blogEditId = document.getElementById('blogEditId');
                    const blogTitle = document.getElementById('blogTitle');
                    const blogCategory = document.getElementById('blogCategory');
                    const blogImage = document.getElementById('blogImage');
                    const blogReadTime = document.getElementById('blogReadTime');
                    const blogExcerpt = document.getElementById('blogExcerpt');
                    const blogContent = document.getElementById('blogContent');
                    const blogPublished = document.getElementById('blogPublished');
                    const blogFormTitle = document.getElementById('blogFormTitle');
                    const saveBlogBtn = document.getElementById('saveBlogBtn');
                    
                    if (blogEditId) blogEditId.value = btn.dataset.id;
                    if (blogTitle) blogTitle.value = p.title || '';
                    if (blogCategory) blogCategory.value = p.category || '';
                    if (blogImage) blogImage.value = p.imageUrl || '';
                    if (blogReadTime) blogReadTime.value = p.readTime || '';
                    if (blogExcerpt) blogExcerpt.value = p.excerpt || '';
                    if (blogContent) blogContent.value = p.contentHtml || p.content || '';
                    if (blogPublished) blogPublished.checked = p.published !== false;
                    if (blogFormTitle) blogFormTitle.textContent = 'Edit Post';
                    if (saveBlogBtn) saveBlogBtn.textContent = 'Update Post';
                    
                    const blogForm = document.getElementById('blogForm');
                    if (blogForm) blogForm.scrollIntoView({ behavior: 'smooth' });
                } catch (e) {
                    showToast('Error loading post: ' + e.message, 'error');
                }
            });
        });

        // Toggle publish
        container.querySelectorAll('.toggle-pub').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const newPub = btn.dataset.pub !== 'true';
                    await updateDoc(doc(db, 'blog', btn.dataset.id), { published: newPub });
                    showToast(newPub ? 'Post published.' : 'Post drafted.', 'success');
                    loadBlogPosts();
                } catch (e) {
                    showToast('Error: ' + e.message, 'error');
                }
            });
        });

        // Delete
        container.querySelectorAll('.del-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this post permanently?')) return;
                try {
                    await deleteDoc(doc(db, 'blog', btn.dataset.id));
                    showToast('Post deleted.', 'success');
                    loadBlogPosts();
                } catch (e) {
                    showToast('Error deleting post: ' + e.message, 'error');
                }
            });
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="padding:1.5rem;color:var(--error);">Error loading posts. Please refresh the page.</div>';
    }
}

// Save / update blog post
const saveBlogBtn = document.getElementById('saveBlogBtn');
if (saveBlogBtn) {
    saveBlogBtn.addEventListener('click', async () => {
        const title = document.getElementById('blogTitle')?.value.trim();
        if (!title) { 
            showToast('Title is required.', 'error'); 
            return; 
        }

        const btn = document.getElementById('saveBlogBtn');
        setLoading(btn, true);

        const data = {
            title,
            category:    document.getElementById('blogCategory')?.value || '',
            imageUrl:    document.getElementById('blogImage')?.value.trim() || '',
            readTime:    parseInt(document.getElementById('blogReadTime')?.value) || null,
            excerpt:     document.getElementById('blogExcerpt')?.value.trim() || '',
            contentHtml: document.getElementById('blogContent')?.value.trim() || '',
            published:   document.getElementById('blogPublished')?.checked || false,
            updatedAt:   serverTimestamp(),
        };

        try {
            const editId = document.getElementById('blogEditId')?.value;
            if (editId) {
                await updateDoc(doc(db, 'blog', editId), data);
                showToast('Post updated.', 'success');
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'blog'), data);
                showToast('Post published!', 'success');
            }
            clearBlogForm();
            loadBlogPosts();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            setLoading(btn, false);
        }
    });
}

function clearBlogForm() {
    const fields = ['blogEditId','blogTitle','blogCategory','blogImage','blogReadTime','blogExcerpt','blogContent'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const blogPublished = document.getElementById('blogPublished');
    if (blogPublished) blogPublished.checked = true;
    
    const blogFormTitle = document.getElementById('blogFormTitle');
    if (blogFormTitle) blogFormTitle.textContent = 'New Post';
    
    const saveBlogBtn = document.getElementById('saveBlogBtn');
    if (saveBlogBtn) saveBlogBtn.textContent = 'Publish Post';
}

const clearBlogFormBtn = document.getElementById('clearBlogForm');
if (clearBlogFormBtn) clearBlogFormBtn.addEventListener('click', clearBlogForm);

// ── Shop ────────────────────────────────────────────────────────────
async function loadShopProducts() {
    const container = document.getElementById('shopList');
    if (!container) return;
    
    try {
        const snap = await getDocs(query(collection(db, 'shop'), orderBy('createdAt', 'desc')));
        if (snap.empty) {
            container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-secondary);">No products yet.</div>';
            return;
        }
        container.innerHTML = `
        <table class="data-table">
            <thead>
                <th>Name</th><th>Category</th><th>Price</th><th>Published</th><th>Actions</th>
            </thead>
            <tbody>
            ${snap.docs.map(d => {
                const p = d.data();
                return `
                <tr>
                    <td>${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.category || '—')}</td>
                    <td>$${parseFloat(p.price || 0).toFixed(2)}</td>
                    <td>${p.published ? '<span class="badge badge-success">Live</span>' : '<span class="badge badge-warning">Hidden</span>'}</td>
                    <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-outline edit-product" data-id="${d.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger del-product" data-id="${d.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>`;

        container.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const snap2 = await getDoc(doc(db, 'shop', btn.dataset.id));
                    const p = snap2.data();
                    
                    const shopEditId = document.getElementById('shopEditId');
                    const shopName = document.getElementById('shopName');
                    const shopCategory = document.getElementById('shopCategory');
                    const shopPrice = document.getElementById('shopPrice');
                    const shopImage = document.getElementById('shopImage');
                    const shopDesc = document.getElementById('shopDesc');
                    const shopDownload = document.getElementById('shopDownload');
                    const shopPublished = document.getElementById('shopPublished');
                    const shopFormTitle = document.getElementById('shopFormTitle');
                    const saveShopBtn = document.getElementById('saveShopBtn');
                    
                    if (shopEditId) shopEditId.value = btn.dataset.id;
                    if (shopName) shopName.value = p.name || '';
                    if (shopCategory) shopCategory.value = p.category || '';
                    if (shopPrice) shopPrice.value = p.price || '';
                    if (shopImage) shopImage.value = p.imageUrl || '';
                    if (shopDesc) shopDesc.value = p.description || '';
                    if (shopDownload) shopDownload.value = p.downloadUrl || '';
                    if (shopPublished) shopPublished.checked = p.published !== false;
                    if (shopFormTitle) shopFormTitle.textContent = 'Edit Product';
                    if (saveShopBtn) saveShopBtn.textContent = 'Update Product';
                    
                    const shopForm = document.getElementById('shopForm');
                    if (shopForm) shopForm.scrollIntoView({ behavior: 'smooth' });
                } catch (e) {
                    showToast('Error loading product: ' + e.message, 'error');
                }
            });
        });

        container.querySelectorAll('.del-product').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this product?')) return;
                try {
                    await deleteDoc(doc(db, 'shop', btn.dataset.id));
                    showToast('Product deleted.', 'success');
                    loadShopProducts();
                } catch (e) {
                    showToast('Error deleting product: ' + e.message, 'error');
                }
            });
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="padding:1.5rem;color:var(--error);">Error loading products. Please refresh the page.</div>';
    }
}

const saveShopBtn = document.getElementById('saveShopBtn');
if (saveShopBtn) {
    saveShopBtn.addEventListener('click', async () => {
        const name = document.getElementById('shopName')?.value.trim();
        const price = parseFloat(document.getElementById('shopPrice')?.value);
        if (!name || isNaN(price)) { 
            showToast('Name and price are required.', 'error'); 
            return; 
        }

        const btn = document.getElementById('saveShopBtn');
        setLoading(btn, true);

        const data = {
            name,
            category:    document.getElementById('shopCategory')?.value || '',
            price,
            imageUrl:    document.getElementById('shopImage')?.value.trim() || '',
            description: document.getElementById('shopDesc')?.value.trim() || '',
            downloadUrl: document.getElementById('shopDownload')?.value.trim() || '',
            published:   document.getElementById('shopPublished')?.checked || false,
            updatedAt:   serverTimestamp(),
        };

        try {
            const editId = document.getElementById('shopEditId')?.value;
            if (editId) {
                await updateDoc(doc(db, 'shop', editId), data);
                showToast('Product updated.', 'success');
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'shop'), data);
                showToast('Product added!', 'success');
            }
            clearShopForm();
            loadShopProducts();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            setLoading(btn, false);
        }
    });
}

function clearShopForm() {
    const fields = ['shopEditId','shopName','shopCategory','shopPrice','shopImage','shopDesc','shopDownload'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const shopPublished = document.getElementById('shopPublished');
    if (shopPublished) shopPublished.checked = true;
    
    const shopFormTitle = document.getElementById('shopFormTitle');
    if (shopFormTitle) shopFormTitle.textContent = 'New Product';
    
    const saveShopBtn = document.getElementById('saveShopBtn');
    if (saveShopBtn) saveShopBtn.textContent = 'Save Product';
}

const clearShopFormBtn = document.getElementById('clearShopForm');
if (clearShopFormBtn) clearShopFormBtn.addEventListener('click', clearShopForm);

// ── Testimonials ────────────────────────────────────────────────────
async function loadTestimonialsAdmin() {
    const container = document.getElementById('adminTestimonialsList');
    if (!container) return;
    
    try {
        const snap = await getDocs(query(collection(db, 'testimonials'), orderBy('createdAt', 'desc')));
        if (snap.empty) {
            container.innerHTML = '<p style="color:var(--text-secondary);">No testimonials yet.</p>';
            return;
        }
        container.innerHTML = snap.docs.map(d => {
            const t = d.data();
            return `
            <div class="order-card" style="align-items:flex-start;flex-direction:column;gap:0.75rem;">
                <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <strong>${escapeHtml(t.name)}</strong>
                        <span style="color:#ffc107;margin-left:0.5rem;">${'★'.repeat(t.rating)}${'☆'.repeat(5-t.rating)}</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <span class="badge ${t.featured ? 'badge-success' : 'badge-info'}">${t.featured ? 'Featured' : 'Standard'}</span>
                        <button class="btn btn-sm btn-outline toggle-feature" data-id="${d.id}" data-featured="${!!t.featured}">
                            ${t.featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button class="btn btn-sm btn-danger del-testimonial" data-id="${d.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <p style="color:var(--text-secondary);font-size:0.9rem;">"${escapeHtml(t.message)}"</p>
                <small style="color:var(--text-secondary);">${formatDT(t.createdAt)}</small>
            </div>`;
        }).join('');

        container.querySelectorAll('.toggle-feature').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const newVal = btn.dataset.featured !== 'true';
                    await updateDoc(doc(db, 'testimonials', btn.dataset.id), { featured: newVal });
                    showToast(newVal ? 'Testimonial featured.' : 'Removed from featured.', 'success');
                    loadTestimonialsAdmin();
                } catch (e) {
                    showToast('Error: ' + e.message, 'error');
                }
            });
        });

        container.querySelectorAll('.del-testimonial').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this testimonial?')) return;
                try {
                    await deleteDoc(doc(db, 'testimonials', btn.dataset.id));
                    showToast('Testimonial deleted.', 'success');
                    loadTestimonialsAdmin();
                } catch (e) {
                    showToast('Error: ' + e.message, 'error');
                }
            });
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:var(--error);">Error loading testimonials. Please refresh the page.</p>';
    }
}

// ── Notifications ───────────────────────────────────────────────────
let notifStyle = 'banner';
let notifColor = 'purple';

document.querySelectorAll('.style-option').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        notifStyle = el.dataset.style;
        updateNotifPreview();
    });
});

document.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-color]').forEach(b => b.style.outline = 'none');
        btn.style.outline = '2px solid white';
        notifColor = btn.dataset.color;
        updateNotifPreview();
    });
});

const notifMessage = document.getElementById('notifMessage');
if (notifMessage) notifMessage.addEventListener('input', updateNotifPreview);

function updateNotifPreview() {
    const msg = document.getElementById('notifMessage')?.value || 'Your notification will appear here.';
    const previewEl = document.getElementById('notifPreviewEl');
    const previewMsg = document.getElementById('notifPreviewMsg');
    if (previewEl) {
        previewEl.className = (notifStyle === 'sticky' ? 'notif-sticky-banner' : 'notif-banner') + ' ' + notifColor;
    }
    if (previewMsg) previewMsg.textContent = msg;
}

const saveNotifBtn = document.getElementById('saveNotifBtn');
if (saveNotifBtn) {
    saveNotifBtn.addEventListener('click', async () => {
        const msg = document.getElementById('notifMessage')?.value.trim();
        if (!msg) { 
            showToast('Please enter a message.', 'error'); 
            return; 
        }

        const btn = document.getElementById('saveNotifBtn');
        setLoading(btn, true);

        try {
            await setDoc(doc(db, 'settings', 'notification'), {
                message:   msg,
                style:     notifStyle,
                color:     notifColor,
                active:    true,
                updatedAt: serverTimestamp()
            });
            showToast('Notification published!', 'success');
            loadActiveNotif();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            setLoading(btn, false);
        }
    });
}

const clearNotifBtn = document.getElementById('clearNotifBtn');
if (clearNotifBtn) {
    clearNotifBtn.addEventListener('click', async () => {
        try {
            await setDoc(doc(db, 'settings', 'notification'), { active: false, updatedAt: serverTimestamp() }, { merge: true });
            showToast('Notification cleared.', 'success');
            loadActiveNotif();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
}

async function loadActiveNotif() {
    const display = document.getElementById('activeNotifDisplay');
    if (!display) return;
    
    try {
        const snap = await getDoc(doc(db, 'settings', 'notification'));
        if (!snap.exists() || !snap.data().active) {
            display.innerHTML = '<p>No active notification.</p>';
            return;
        }
        const n = snap.data();
        display.innerHTML = `
        <div class="order-card">
            <div>
                <p style="margin-bottom:0.25rem;"><strong>Message:</strong> ${escapeHtml(n.message)}</p>
                <p style="color:var(--text-secondary);font-size:0.85rem;"><strong>Style:</strong> ${n.style} &nbsp;|&nbsp; <strong>Color:</strong> ${n.color}</p>
            </div>
            <span class="badge badge-success">Active</span>
        </div>`;
    } catch (e) {
        display.innerHTML = '<p style="color:var(--error);">Error loading notification.</p>';
    }
}