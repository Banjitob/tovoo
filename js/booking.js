import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { db } from './firebase.js';
import { showToast, setLoading } from './utils.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();

// ── State ──────────────────────────────────────────────
let currentStep = 1;
let currentUser = null;
let bookingData = { service: null, duration: null, dateTime: null, userInfo: null };
const CREATOR_FEE = 1;

// Load saved booking data from localStorage
function loadSavedBookingData() {
    const saved = localStorage.getItem('Alexisunplugged_booking');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            bookingData = parsed;
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

// Save booking data to localStorage
function saveBookingData() {
    localStorage.setItem('Alexisunplugged_booking', JSON.stringify(bookingData));
}

// Clear saved booking data
function clearSavedBookingData() {
    localStorage.removeItem('Alexisunplugged_booking');
}

// ── Data ───────────────────────────────────────────────
const services = [
    { id: 'love',     name: 'Love Reading',      desc: 'Clarity on relationships, soulmates & emotional blocks.', icon: 'heart',    price: 0 },
    { id: 'career',   name: 'Career Reading',     desc: 'Discover your professional purpose and next steps.',      icon: 'briefcase', price: 0 },
    { id: 'general',  name: 'General Guidance',   desc: 'Open channel for whatever needs to come through.',       icon: 'star',      price: 0 },
    { id: 'timeline', name: 'Timeline Reading',   desc: 'Insights into timing and future events.',               icon: 'hourglass-half', price: 0 },
    { id: 'pastlife', name: 'Past Life Reading',  desc: 'Explore karmic patterns and soul contracts.',           icon: 'infinity',  price: 0 },
    { id: 'chakra',   name: 'Chakra Healing',     desc: 'Energy clearing and alignment for balance.',            icon: 'spa',       price: 0 },
];

const durations = [
    { id: '2card', label: '2-card pull', price: 7,  desc: 'Focused insight with two cards' },
    { id: '3card', label: '3-card pull', price: 10, desc: 'Expanded guidance with three cards' },
    { id: '5card', label: '5-card pull', price: 15, desc: 'Deeper exploration with five cards' },
    { id: 'mini', label: 'Mini read', price: 75, desc: 'Short intuitive reading for quick clarity' },
    { id: 'standard', label: 'Standard read', price: 100, desc: 'Full standard session for balanced guidance' },
    { id: 'timeframe', label: 'Timeframe Reading', price: 5, desc: 'Timing predictions and when events may manifest' }
];

// ── Auth state ─────────────────────────────────────────
onAuthStateChanged(auth, user => {
    currentUser = user;
    const link = document.getElementById('dashboardNavLink');
    if (link) link.style.display = user ? 'block' : 'none';
    
    if (user && !bookingData.userInfo) {
        bookingData.userInfo = {
            name: user.displayName || '',
            email: user.email || '',
            phone: '',
            note: ''
        };
        saveBookingData();
        if (currentStep === 4) render();
    }
});

// ── Stepper ────────────────────────────────────────────
function updateStepper() {
    document.querySelectorAll('.step').forEach(el => {
        const n = parseInt(el.dataset.step);
        el.classList.toggle('active', n === currentStep);
        el.classList.toggle('completed', n < currentStep);
    });
}

function goTo(step) {
    currentStep = step;
    updateStepper();
    render();
    document.getElementById('bookingContent').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Helpers ────────────────────────────────────────────
function totalAmount() {
    const serviceTotal = bookingData.service?.price || 0;
    const durationTotal = bookingData.duration?.price || 0;
    return bookingData.service ? serviceTotal + durationTotal + CREATOR_FEE : 0;
}

function summaryBar() {
    if (!bookingData.service) return '';
    const total = totalAmount();
    return `
    <div class="booking-summary">
        ${bookingData.service ? `<p><span>Service</span><strong>${escapeHtml(bookingData.service.name)}</strong></p>` : ''}
        ${bookingData.duration ? `<p><span>Duration</span><strong>${escapeHtml(bookingData.duration.label)}</strong></p>` : ''}
        ${bookingData.dateTime ? `<p><span>Date & Time</span><strong>${formatDT(bookingData.dateTime)}</strong></p>` : ''}
        <p><span>Creator fee</span><strong>$${CREATOR_FEE.toFixed(2)}</strong></p>
        <p class="booking-total"><span>Total</span><strong>$${total}</strong></p>
    </div>`;
}

function formatDT(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

function navButtons(prevLabel = 'Back', nextId = 'nextBtn', nextLabel = 'Next', nextDisabled = false) {
    return `
    <div class="step-buttons">
        ${currentStep > 1 ? `<button class="btn btn-outline" id="prevBtn"><i class="fas fa-arrow-left"></i> ${prevLabel}</button>` : '<span></span>'}
        <button class="btn btn-primary" id="${nextId}" ${nextDisabled ? 'disabled' : ''}>${nextLabel} ${nextId === 'nextBtn' ? '<i class="fas fa-arrow-right"></i>' : ''}</button>
    </div>`;
}

// ── Renders ────────────────────────────────────────────
function renderStep1() {
    return `
    <div class="booking-step">
        <h2 style="text-align:left;display:block;font-size:1.6rem;margin-bottom:1.5rem;">Choose a Service</h2>
        <div class="services-list">
            ${services.map(s => `
            <div class="service-option ${bookingData.service?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
                <i class="fas fa-${s.icon}"></i>
                <h3>${escapeHtml(s.name)}</h3>
                <p style="font-size:0.85rem;color:var(--text-secondary);margin:0.25rem 0 0.5rem;">${escapeHtml(s.desc)}</p>
                ${s.price > 0 ? `<span class="price">$${s.price}</span>` : ''}
            </div>`).join('')}
        </div>
        ${navButtons('Back', 'nextBtn', 'Next', !bookingData.service)}
    </div>`;
}

function renderStep2() {
    return `
    <div class="booking-step">
        <h2 style="text-align:left;display:block;font-size:1.6rem;margin-bottom:1.5rem;">Select Duration & Add‑ons</h2>
        ${summaryBar()}
        <div class="durations-list">
            ${durations.map(d => `
            <div class="duration-option ${bookingData.duration?.id === d.id ? 'selected' : ''}" data-id="${d.id}">
                <h3>${escapeHtml(d.label)}</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin:0.25rem 0;">${escapeHtml(d.desc)}</p>
                <span class="price">${d.price === 0 ? 'Included' : '+$' + d.price}</span>
            </div>`).join('')}
        </div>
        ${navButtons('Back', 'nextBtn', 'Next', !bookingData.duration)}
    </div>`;
}

function renderStep3() {
    return `
    <div class="booking-step">
        <h2 style="text-align:left;display:block;font-size:1.6rem;margin-bottom:1.5rem;">Choose Date & Time</h2>
        ${summaryBar()}
        <div class="form-group">
            <label for="datetimePicker">Select a date and time</label>
            <input type="text" id="datetimePicker" placeholder="Click to choose..." readonly>
        </div>
        ${navButtons('Back', 'nextBtn', 'Next', !bookingData.dateTime)}
    </div>`;
}

function renderStep4() {
    const info = bookingData.userInfo || {};
    return `
    <div class="booking-step">
        <h2 style="text-align:left;display:block;font-size:1.6rem;margin-bottom:1.5rem;">Your Information</h2>
        ${summaryBar()}
        <div class="form-group">
            <label for="userName">Full Name *</label>
            <input type="text" id="userName" placeholder="Enter your full name" value="${escapeHtml(info.name || '')}">
        </div>
        <div class="form-group">
            <label for="userEmail">Email Address *</label>
            <input type="email" id="userEmail" placeholder="your@email.com" value="${escapeHtml(info.email || '')}">
        </div>
        <div class="form-group">
            <label for="userPhone">Phone (optional)</label>
            <input type="tel" id="userPhone" placeholder="+1 234 567 8900" value="${escapeHtml(info.phone || '')}">
        </div>
        <div class="form-group">
            <label for="userNote">Special notes or questions (optional)</label>
            <textarea id="userNote" rows="3" placeholder="Anything you'd like to share before your session...">${escapeHtml(info.note || '')}</textarea>
        </div>
        ${navButtons('Back', 'nextBtn', 'Next', true)}
    </div>`;
}

function renderStep5() {
    const total = totalAmount();
    return `
    <div class="booking-step">
        <h2 style="text-align:left;display:block;font-size:1.6rem;margin-bottom:1.5rem;">Confirm & Send</h2>
        <form id="bookingForm" action="https://formspree.io/f/mzdkrgao" method="POST">
            ${summaryBar()}
            <div class="booking-summary" style="margin-top:1rem;">
                <p><span>Name</span><strong>${escapeHtml(bookingData.userInfo?.name || '')}</strong></p>
                <p><span>Email</span><strong>${escapeHtml(bookingData.userInfo?.email || '')}</strong></p>
                <p><span>Service</span><strong>${escapeHtml(bookingData.service?.name || '')}</strong></p>
                <p><span>Duration</span><strong>${escapeHtml(bookingData.duration?.label || '')}</strong></p>
                <p><span>Date & Time</span><strong>${bookingData.dateTime ? escapeHtml(formatDT(bookingData.dateTime)) : 'Not selected'}</strong></p>
                <p><span>Notes</span><strong>${escapeHtml(bookingData.userInfo?.note || 'None')}</strong></p>
                <p class="booking-total"><span>Total</span><strong>$${total}</strong></p>
            </div>
            <input type="hidden" name="name" value="${escapeHtml(bookingData.userInfo?.name || '')}">
            <input type="hidden" name="email" value="${escapeHtml(bookingData.userInfo?.email || '')}">
            <input type="hidden" name="phone" value="${escapeHtml(bookingData.userInfo?.phone || '')}">
            <input type="hidden" name="service" value="${escapeHtml(bookingData.service?.name || '')}">
            <input type="hidden" name="duration" value="${escapeHtml(bookingData.duration?.label || '')}">
            <input type="hidden" name="dateTime" value="${escapeHtml(bookingData.dateTime ? formatDT(bookingData.dateTime) : '')}">
            <input type="hidden" name="notes" value="${escapeHtml(bookingData.userInfo?.note || '')}">
            <input type="hidden" name="total" value="$${total}">
            <input type="hidden" name="message" value="Booking request for ${escapeHtml(bookingData.service?.name || 'a service')} on ${escapeHtml(bookingData.dateTime ? formatDT(bookingData.dateTime) : 'an unscheduled time')}.">
            <div class="step-buttons">
                <button class="btn btn-outline" type="button" id="prevBtn"><i class="fas fa-arrow-left"></i> Back</button>
                <button class="btn btn-primary" type="submit" id="sendBtn">Send</button>
            </div>
        </form>
    </div>`;
}

// ── Main render ────────────────────────────────────────
function render() {
    const container = document.getElementById('bookingContent');
    if (!container) return;

    const stepMap = {
        1: renderStep1,
        2: renderStep2,
        3: renderStep3,
        4: renderStep4,
        5: renderStep5
    };
    const html = stepMap[currentStep]();
    container.innerHTML = html;
    attachEvents();
}

// ── Event attachment ───────────────────────────────────
function attachEvents() {
    document.getElementById('prevBtn')?.addEventListener('click', () => goTo(currentStep - 1));

    if (currentStep === 1) {
        document.querySelectorAll('.service-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.service-option').forEach(e => e.classList.remove('selected'));
                el.classList.add('selected');
                const svc = services.find(s => s.id === el.dataset.id);
                bookingData.service = svc;
                saveBookingData();
                document.getElementById('nextBtn').disabled = false;
            });
        });
    }

    if (currentStep === 2) {
        document.querySelectorAll('.duration-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.duration-option').forEach(e => e.classList.remove('selected'));
                el.classList.add('selected');
                const dur = durations.find(d => d.id === el.dataset.id);
                bookingData.duration = dur;
                saveBookingData();
                document.getElementById('nextBtn').disabled = false;
                render(); // refresh summary
            });
        });
    }

    if (currentStep === 3) {
        if (window.flatpickr) {
            window.flatpickr('#datetimePicker', {
                enableTime: true,
                minDate: 'today',
                dateFormat: 'Y-m-d H:i',
                minuteIncrement: 30,
                disable: [
                    date => date.getDay() === 0
                ],
                defaultDate: bookingData.dateTime || null,
                onChange(selectedDates) {
                    if (selectedDates.length) {
                        bookingData.dateTime = selectedDates[0].toISOString();
                        saveBookingData();
                        document.getElementById('nextBtn').disabled = false;
                    }
                }
            });
        } else {
            showToast('Date picker failed to load. Please refresh.', 'error');
        }
    }

    if (currentStep === 4) {
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');
        const phoneEl = document.getElementById('userPhone');
        const noteEl = document.getElementById('userNote');
        const nextBtn = document.getElementById('nextBtn');

        function validate() {
            const valid = nameEl.value.trim() && emailEl.value.includes('@');
            nextBtn.disabled = !valid;
            if (valid) {
                bookingData.userInfo = {
                    name: nameEl.value.trim(),
                    email: emailEl.value.trim(),
                    phone: phoneEl.value.trim(),
                    note: noteEl.value.trim()
                };
                saveBookingData();
            }
        }

        nameEl.addEventListener('input', validate);
        emailEl.addEventListener('input', validate);
        phoneEl.addEventListener('input', () => {
            if (bookingData.userInfo) {
                bookingData.userInfo.phone = phoneEl.value.trim();
                saveBookingData();
            }
        });
        noteEl.addEventListener('input', () => {
            if (bookingData.userInfo) {
                bookingData.userInfo.note = noteEl.value.trim();
                saveBookingData();
            }
        });
        validate();
    }

    document.getElementById('nextBtn')?.addEventListener('click', () => goTo(currentStep + 1));
}

async function saveBooking(txRef, paymentStatus) {
    try {
        await addDoc(collection(db, 'bookings'), {
            userId: currentUser?.uid || null,
            userEmail: bookingData.userInfo?.email || currentUser?.email || '',
            service: bookingData.service,
            duration: bookingData.duration,
            dateTime: bookingData.dateTime,
            userInfo: bookingData.userInfo,
            totalAmount: totalAmount(),
            creatorFee: CREATOR_FEE,
            txRef,
            paymentStatus,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        
        clearSavedBookingData();
        showToast('Booking confirmed! Check your email for confirmation.', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
    } catch (err) {
        showToast('Error saving booking: ' + err.message, 'error');
        const sendBtn = document.getElementById('sendBtn');
        setLoading(sendBtn, false);
    }
}

// ── Mobile nav ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSavedBookingData();
    render();

    const toggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    toggle?.addEventListener('click', e => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        toggle.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    navMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        navMenu.classList.remove('active');
        toggle?.classList.remove('active');
        document.body.classList.remove('menu-open');
    }));
});