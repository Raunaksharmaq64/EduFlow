// Centralized configuration for EduFlow AI learning platform
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';

window.CONFIG = {
    // Set this to your deployed backend URL on Render! (e.g. 'https://eduflow-api.onrender.com')
    BACKEND_URL: isLocalhost
        ? 'http://127.0.0.1:8000'
        : 'https://eduflow-backend-md3l.onrender.com'
};
