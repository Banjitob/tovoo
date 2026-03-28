import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, setLoading } from './utils.js';

const db = getFirestore();
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!name || !email || !message) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        setLoading(submitBtn, true);

        try {
            await addDoc(collection(db, 'contacts'), {
                name,
                email,
                message,
                createdAt: serverTimestamp()
            });
            showToast('Message sent successfully! We will reply soon.', 'success');
            contactForm.reset();
        } catch (error) {
            showToast('Error sending message: ' + error.message, 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    });
}