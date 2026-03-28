import { getFirestore, collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { showToast, setLoading } from './utils.js';

const db = getFirestore();
const auth = getAuth();

// Load testimonials
async function loadTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    const loader = document.getElementById('testimonialsLoader');
    if (!grid) return;

    grid.innerHTML = '';
    loader.style.display = 'block';

    try {
        const q = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            grid.innerHTML = '<p>No testimonials yet. Be the first to share your experience!</p>';
        } else {
            grid.innerHTML = snapshot.docs.map(doc => `
                <div class="testimonial-card">
                    <div class="stars">${'★'.repeat(doc.data().rating)}${'☆'.repeat(5-doc.data().rating)}</div>
                    <p>"${doc.data().message}"</p>
                    <span>— ${doc.data().name}</span>
                    <small>${new Date(doc.data().createdAt?.toDate()).toLocaleDateString()}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error(error);
        showToast('Failed to load testimonials.', 'error');
    } finally {
        loader.style.display = 'none';
    }
}

// Star rating UI
function initStarRating() {
    const stars = document.querySelectorAll('#starRating i');
    const ratingInput = document.getElementById('testimonialRating');
    if (!stars.length) return;

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            ratingInput.value = value;
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= value) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
}

// Submit testimonial
const testimonialForm = document.getElementById('testimonialForm');
if (testimonialForm) {
    testimonialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in to leave a testimonial.', 'error');
            return;
        }

        const name = document.getElementById('testimonialName').value.trim();
        const rating = parseInt(document.getElementById('testimonialRating').value);
        const message = document.getElementById('testimonialMessage').value.trim();

        if (!name || !message) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        const submitBtn = testimonialForm.querySelector('button[type="submit"]');
        setLoading(submitBtn, true);

        try {
            await addDoc(collection(db, 'testimonials'), {
                name,
                rating,
                message,
                userId: user.uid,
                createdAt: serverTimestamp()
            });
            showToast('Thank you for your testimonial!', 'success');
            testimonialForm.reset();
            // Reset star rating to 5
            document.getElementById('testimonialRating').value = 5;
            const stars = document.querySelectorAll('#starRating i');
            stars.forEach((s, idx) => {
                if (idx < 5) s.classList.add('fas');
                else s.classList.add('far');
            });
            // Reload testimonials
            loadTestimonials();
        } catch (error) {
            showToast('Error submitting testimonial: ' + error.message, 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadTestimonials();
    initStarRating();
});