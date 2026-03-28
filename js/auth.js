import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    updateProfile,
    sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast } from './utils.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();
const db = getFirestore();

export { auth, provider };

// Email/Password Sign Up with Email Verification
export async function signUpWithEmail(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        if (displayName) {
            await updateProfile(userCredential.user, { displayName });
        }
        
        await sendEmailVerification(userCredential.user);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            displayName: displayName || '',
            email: email,
            emailVerified: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        return { success: true, user: userCredential.user, needsVerification: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Email/Password Login with verification check
export async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: 'Please verify your email before logging in. Check your inbox!' };
        }
        
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Resend verification email
export async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'No user logged in' };
    
    try {
        await sendEmailVerification(user);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Password Reset
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Google Sign In
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
                displayName: user.displayName || '',
                email: user.email,
                photoURL: user.photoURL || '',
                emailVerified: user.emailVerified,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update UI based on auth state - SHOW USER MENU
onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
});

// Function to update all auth-related UI elements
function updateAuthUI(user) {
    // Update dashboard link
    const dashLink = document.getElementById('dashboardNavLink');
    if (dashLink) {
        dashLink.style.display = user ? 'inline' : 'none';
    }
    
    // Update login/logout buttons in navigation
    const loginLink = document.getElementById('loginNavLink');
    const logoutBtn = document.getElementById('logoutNavBtn');
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userNameDisplay');
    
    if (loginLink) {
        loginLink.style.display = user ? 'none' : 'inline';
    }
    
    if (logoutBtn) {
        logoutBtn.style.display = user ? 'inline' : 'none';
    }
    
    if (userMenu) {
        userMenu.style.display = user ? 'flex' : 'none';
    }
    
    if (userAvatar && user) {
        const photoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=9b7bff&color=fff&size=32`;
        userAvatar.src = photoUrl;
        userAvatar.alt = user.displayName || 'User';
    }
    
    if (userName && user) {
        userName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    }
}

// Handle logout from anywhere
export function handleLogout() {
    signOut(auth).then(() => {
        showToast('Logged out successfully', 'success');
        // Redirect to home page if on dashboard
        if (window.location.pathname.includes('dashboard.html')) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    }).catch((error) => {
        showToast('Error logging out: ' + error.message, 'error');
    });
}

export function triggerSignOut() {
    return signOut(auth);
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu    = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });

        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });

        document.addEventListener('click', (e) => {
            if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }
    
    // Attach logout handler to any logout buttons
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    });
});