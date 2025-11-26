import { createClient } from '@supabase/supabase-js';
import { User } from "../types";

// Configuration for Supabase
const SUPABASE_URL = 'https://wynpsqzvkgkmlvfwglnv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bnBzcXp2a2drbWx2ZndnbG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTA2ODYsImV4cCI6MjA3OTY2NjY4Nn0.Mm7NM2zxwiczAkYXrXLeO5A47E9myktLP62Y9z3GEQs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Super Admin Constants
const SUPER_ADMIN_EMAIL = 'marciomedrado@gmail.com';
const DEFAULT_PASS = '12345678';

// Helper to map Supabase profile to App User
const mapProfileToUser = (profile: any, email?: string): User => {
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL || profile.email === SUPER_ADMIN_EMAIL;
  
  return {
    id: profile.id,
    name: profile.name || 'Usuário',
    email: profile.email || email || '',
    // FORCE ADMIN FOR SUPER ADMIN
    role: isSuperAdmin ? 'admin' : (profile.role || 'user'),
    // FORCE APPROVED FOR SUPER ADMIN
    status: isSuperAdmin ? 'approved' : (profile.status || 'pending'),
    // FORCE INFINITE CREDITS FOR SUPER ADMIN
    credits: isSuperAdmin ? 99999 : (profile.credits ?? 0),
    avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&background=random`
  };
};

// --- Auth Methods ---

// NOTE: Login function is kept for internal logic but UI is removed
export const login = async (email: string, password: string): Promise<User> => {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) throw new Error("Email ou senha incorretos.");
  if (!authData.user) throw new Error("Erro ao autenticar.");

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (!profile) throw new Error("Perfil não encontrado.");

  return mapProfileToUser(profile, authData.user.email);
};

export const signup = async (name: string, email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });

  if (error) throw new Error(error.message);
  
  // Return provisional user
  return {
    id: data.user?.id || 'temp-id',
    name,
    email,
    role: email === SUPER_ADMIN_EMAIL ? 'admin' : 'user',
    status: email === SUPER_ADMIN_EMAIL ? 'approved' : 'pending',
    credits: email === SUPER_ADMIN_EMAIL ? 99999 : 5,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
  };
};

export const logout = async () => {
  await supabase.auth.signOut();
  window.location.reload(); // Hard reload to reset state
};

// Modified to ensure we always get a user (Auto-Login / Bypass)
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    // 1. Try to get existing session
    let { data: { session } } = await supabase.auth.getSession();

    // 2. AUTO-LOGIN: If no session, try to log in the Super Admin automatically
    if (!session) {
      console.log("No session found. Attempting Auto-Login for Super Admin...");
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: DEFAULT_PASS
      });

      if (signInData.session) {
        session = signInData.session;
      } else {
        // If login fails (e.g. user doesn't exist), try to CREATE the super admin
        console.log("Auto-login failed. Attempting to create Super Admin account...");
        const { data: signUpData } = await supabase.auth.signUp({
          email: SUPER_ADMIN_EMAIL,
          password: DEFAULT_PASS,
          options: { data: { name: 'Super Admin' } }
        });
        
        if (signUpData.session) {
            session = signUpData.session;
        }
      }
    }

    // 3. If we managed to get a session (either existing or auto-logged in)
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Even if profile fetch fails or status is weird, FORCE SUPER ADMIN ACCESS
      if (session.user.email === SUPER_ADMIN_EMAIL) {
        return {
          id: session.user.id,
          name: profile?.name || 'Marcio Medrado',
          email: SUPER_ADMIN_EMAIL,
          role: 'admin',
          status: 'approved',
          credits: 99999,
          avatar: profile?.avatar_url
        };
      }

      if (profile) return mapProfileToUser(profile, session.user.email);
    }
  } catch (error) {
    console.error("Auth error:", error);
  }

  // 4. FALLBACK BYPASS (Offline Mode / Emergency)
  // If Supabase is down or everything fails, return the Bypassed Admin User so the app still works locally
  console.warn("Falling back to Offline Super Admin Mode");
  return {
    id: 'offline-super-admin',
    name: 'Marcio Medrado',
    email: SUPER_ADMIN_EMAIL,
    role: 'admin',
    status: 'approved',
    credits: 99999,
    avatar: `https://ui-avatars.com/api/?name=Marcio+Medrado&background=random`
  };
};

export const reloadUser = async (): Promise<User | null> => {
  return await getCurrentUser();
}

// --- Admin Methods ---

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name');
  
  if (error) {
      console.error("Error fetching users:", error);
      return []; // Return empty if error (e.g. offline mode)
  }
  
  return data.map(p => mapProfileToUser(p));
};

export const updateUserStatus = async (userId: string, status: 'approved' | 'pending' | 'blocked'): Promise<User[]> => {
  if (userId === 'offline-super-admin') return [];

  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  return await getAllUsers();
};

export const updateUserCredits = async (userId: string, amount: number): Promise<User[]> => {
  if (userId === 'offline-super-admin') return [];

  const { data: current } = await supabase.from('profiles').select('credits').eq('id', userId).single();
  const newCredits = Math.max(0, (current?.credits || 0) + amount);

  await supabase.from('profiles').update({ credits: newCredits }).eq('id', userId);
  return await getAllUsers();
};

export const adminResetPassword = async (userId: string, newPass: string): Promise<User[]> => {
  if (userId === 'offline-super-admin') return [];
  
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
  if (profile) {
      await supabase.auth.resetPasswordForEmail(profile.email);
  }
  return await getAllUsers();
};

// --- User Methods ---

export const consumeCredit = async (userId: string): Promise<boolean> => {
  // Offline bypass
  if (userId === 'offline-super-admin') return true;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!profile) return false;
  if (profile.role === 'admin') return true;

  if (profile.credits > 0) {
    await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
    return true;
  }
  return false;
};

export const reportPayment = async (userId: string, credits: number, amount: number): Promise<void> => {
    console.log(`[PAGAMENTO] Usuário ${userId} reportou pagamento de R$${amount}`);
};

export const changeOwnPassword = async (userId: string, currentPass: string, newPass: string): Promise<void> => {
    if (userId === 'offline-super-admin') return;
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) throw new Error(error.message);
}