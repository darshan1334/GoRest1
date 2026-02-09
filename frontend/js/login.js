document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-form');

    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');

    const linkForgot = document.getElementById('link-forgot');
    const linkBack = document.getElementById('link-back');

    // Tab Switching Logic
    function switchTab(tab) {
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        // Remove active class from tabs
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        if (tab === 'login') {
            loginForm.classList.add('active');
            if (tabLogin) tabLogin.classList.add('active');
        } else if (tab === 'signup') {
            signupForm.classList.add('active');
            if (tabSignup) tabSignup.classList.add('active');
        }
    }

    // Event Listeners for Tabs
    if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
    if (tabSignup) tabSignup.addEventListener('click', () => switchTab('signup'));

    // Event Listeners for Links
    if (linkForgot) {
        linkForgot.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            forgotForm.classList.add('active');
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        });
    }

    if (linkBack) {
        linkBack.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('login');
        });
    }

    // Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (email && password) {
                // Simulate successful login
                console.log("Login successful");
                window.location.href = 'planning.html';
            } else {
                alert("Please fill in all fields.");
            }
        });
    }

    // Signup Form Submission
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;

            if (!email || !password || !confirm) {
                alert("Please fill in all fields.");
                return;
            }

            if (password !== confirm) {
                alert("Passwords do not match!");
                return;
            }

            alert("Account created successfully! Please sign in.");
            switchTab('login');
        });
    }

    // Forgot Password Form Submission
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            if (email) {
                alert(`Password reset link sent to ${email}`);
                switchTab('login');
            } else {
                alert("Please enter your email.");
            }
        });
    }
});
