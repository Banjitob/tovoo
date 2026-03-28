// Utility functions: toast notifications, loading states, etc.

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

export function setLoading(element, isLoading) {
    if (!element) return;
    if (isLoading) {
        element.disabled = true;
        element.classList.add('loading');
        const originalText = element.textContent;
        element.setAttribute('data-original-text', originalText);
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.classList.remove('loading');
        const original = element.getAttribute('data-original-text');
        if (original) element.textContent = original;
    }
}

export function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function formatTime(time) {
    return new Date(time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}