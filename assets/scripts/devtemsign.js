    import { createClient } from "@supabase/supabase-js";

    let supabaseClient = null;

    async function initSupabase() {
      try {
        const res = await fetch("/.netlify/functions/fcnfig");
        const { url, key } = await res.json();
        supabaseClient = createClient(url, key);
      } catch (err) {
        console.warn("Auth config fallback");
        supabaseClient = {
          auth: {
            signUp: async () => ({ error: { message: "Auth service unavailable. Refresh." } }),
            signInWithPassword: async () => ({ error: { message: "Auth unavailable." } })
          }
        };
      }
    }

    function generateUsername(fullName) {
      let base = fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (base.length < 3) base = "creator";
      const unique = Math.floor(Math.random() * 10000);
      return `${base}_${unique}`;
    }

    function showAlert(message, type = "info") {
      const existing = document.querySelector(".floating-toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.className = "floating-toast";
      toast.innerText = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);
    }

    async function verifyRecaptcha() {
      const token = grecaptcha?.getResponse();
      if (!token) {
        showAlert("Please verify the reCAPTCHA", "error");
        return false;
      }
      try {
        const res = await fetch("/.netlify/functions/verify-recaptcha", {
          method: "POST",
          body: JSON.stringify({ token }),
          headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.success) return true;
        showAlert("reCAPTCHA verification failed", "error");
        return false;
      } catch (e) {
        showAlert("reCAPTCHA error, please try again", "error");
        return false;
      }
    }

    // Get redirect URL: priority to 'next' param OR default to /home
    function getRedirectUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      let nextPath = urlParams.get('next');
      if (nextPath) {
        try {
          nextPath = decodeURIComponent(nextPath);
          return nextPath;
        } catch(e) { return '/home'; }
      }
      return '/home';
    }

    function redirectAfterAuth() {
      const target = getRedirectUrl();
      window.location.href = target;
    }

    // SIGNUP: auto-generate username, skill=unknown, about=user, image placeholder
    async function handleSignup(e) {
      e.preventDefault();
      if (!supabaseClient) { showAlert("Initializing...", "error"); return; }
      
      const fullName = document.getElementById("signupFullname").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      if (!fullName || !email || !password) {
        showAlert("All fields are required", "error");
        return;
      }
      if (password.length < 6) {
        showAlert("Password must be at least 6 characters", "error");
        return;
      }

      const recaptchaOk = await verifyRecaptcha();
      if (!recaptchaOk) return;

      const username = generateUsername(fullName);
      const bio = "User bio — creative mind on DevTemple";
      const skills = "unknown";
      const photoUrl = `https://placehold.co/600x600?text=${fullName.slice(0,1).toUpperCase()}`;

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              full_name: fullName,
              bio: bio,
              skills: skills,
              photo_url: photoUrl,
              about: "user"
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectUrl())}`
          }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          showAlert("Signup successful! Please check your email to verify your account before logging in.", "success");
          if (grecaptcha) grecaptcha.reset();
          setTimeout(() => setActivePanel("login"), 1500);
        } else if (data.session) {
showAlert("Signup successful! Please check your email to verify your account.", "success");
if (grecaptcha) grecaptcha.reset();
setTimeout(() => setActivePanel("login"), 1500);
        } else {
          showAlert("Signup complete! Verify email to continue.", "success");
        }
        document.getElementById("signupForm").reset();
        if (grecaptcha) grecaptcha.reset();
      } catch (err) {
        showAlert(err.message || "Signup failed, please try again", "error");
        if (grecaptcha) grecaptcha.reset();
      }
    }

    async function handleLogin(e) {
      e.preventDefault();
      if (!supabaseClient) { showAlert("Auth not ready", "error"); return; }
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      if (!email || !password) {
        showAlert("Email and password required", "error");
        return;
      }
      const recaptchaOk = await verifyRecaptcha();
      if (!recaptchaOk) return;
      
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showAlert("Logged in successfully! Redirecting...", "success");
        redirectAfterAuth();
      } catch (err) {
        showAlert("Login failed: " + (err.message || "invalid credentials"), "error");
        if (grecaptcha) grecaptcha.reset();
      }
    }

    // Toggle password visibility
    function setupPasswordToggles() {
      document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const targetId = this.dataset.target;
          const input = document.getElementById(targetId);
          if (input) {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            // Update icon (eye vs eye-off)
            const svg = this.querySelector('svg');
            if (type === 'text') {
              svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
              svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
          }
        });
      });
    }

    function setActivePanel(mode) {
      const signupPanel = document.getElementById("signupPanel");
      const loginPanel = document.getElementById("loginPanel");
      const tabs = document.querySelectorAll(".tab-btn");
      if (mode === "signup") {
        signupPanel.classList.remove("hidden");
        loginPanel.classList.add("hidden");
        tabs.forEach(btn => {
          if (btn.dataset.mode === "signup") btn.classList.add("active");
          else btn.classList.remove("active");
        });
        window.location.hash = "signup";
      } else {
        signupPanel.classList.add("hidden");
        loginPanel.classList.remove("hidden");
        tabs.forEach(btn => {
          if (btn.dataset.mode === "login") btn.classList.add("active");
          else btn.classList.remove("active");
        });
        window.location.hash = "login";
      }
      if (window.grecaptcha) try { grecaptcha.reset(); } catch(e) {}
    }

    function handleHashChange() {
      const hash = window.location.hash.slice(1).toLowerCase();
      if (hash === "login") setActivePanel("login");
      else if (hash === "signup") setActivePanel("signup");
      else setActivePanel("signup");
    }

    window.addEventListener("DOMContentLoaded", async () => {
      await initSupabase();
      document.getElementById("signupForm").addEventListener("submit", handleSignup);
      document.getElementById("loginForm").addEventListener("submit", handleLogin);
      setupPasswordToggles();
      
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => setActivePanel(btn.dataset.mode));
      });
      document.querySelectorAll("[data-switch-to]").forEach(btn => {
        btn.addEventListener("click", (e) => setActivePanel(btn.dataset.switchTo));
      });
      if (window.location.hash === "#login") setActivePanel("login");
      else setActivePanel("signup");
      window.addEventListener("hashchange", handleHashChange);
    });
 
