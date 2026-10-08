/**
 * js/supabase-config.js
 * Configuración del cliente Supabase y funciones de autenticación
 */

// REEMPLAZA CON TUS CREDENCIALES DE SUPABASE:
// (Settings -> API en tu panel de Supabase)
const SUPABASE_URL = "https://ktlsopmdqsqujblmgpbf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bHNvcG1kcXNxdWpibG1ncGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODY0MjMsImV4cCI6MjEwNzA2MjQyM30.M1jQeVRnRIqVp3HfCO_QdCMpAErbKya_TzlDK5-Shkc";

let supabaseClient = null;

// Inicializa Supabase de manera segura
try {
  if (window.supabase && SUPABASE_URL !== "https://TU_PROYECTO.supabase.co") {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase inicializado correctamente.");
  } else {
    console.warn("Supabase no configurado aún con claves reales. Usando almacenamiento Local.");
  }
} catch (err) {
  console.error("Error al inicializar Supabase:", err);
}

// Estado de la sesión
const AuthManager = {
  isAdmin: false,

  async init() {
    // Si hay cliente Supabase, verificar sesión activa
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      this.isAdmin = !!session;
      
      // Escuchar cambios de autenticación
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        this.isAdmin = !!session;
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAdmin: this.isAdmin } }));
      });
    } else {
      // Modo LocalStorage demo
      this.isAdmin = localStorage.getItem('demo_is_admin') === 'true';
    }
    return this.isAdmin;
  },

  async login(email, password) {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      this.isAdmin = true;
      return data;
    } else {
      // Fallback demo local si no hay credenciales puestas
      this.isAdmin = true;
      localStorage.setItem('demo_is_admin', 'true');
      return { user: { email: 'admin-demo@local.com' } };
    }
  },

  async logout() {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    this.isAdmin = false;
    localStorage.removeItem('demo_is_admin');
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAdmin: false } }));
  }
};