/**
 * ============================================================================
 * AuthContext.jsx
 * ============================================================================
 *
 * PURPOSE:
 *   Global Authentication Hub. Manages user session, profile data, and 
 *   role-based access throughout the application.
 *
 * KEY FEATURES:
 *   1. Auth State: Tracks if a user is logged in (session/user).
 *   2. Profile Sync: Automatically fetches profile data on login.
 *   3. Instant Caching: Caches profile locally to eliminate blank loading screens
 *      and avoid repetitive layout refreshes.
 *   4. Auto-Provisioning: Creates a student profile if one doesn't exist yet.
 *   5. Admin Protection: Hardcoded admin list for role promotion.
 * ============================================================================
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { getMyProfile } from "../Services/ProfileService"

// List of emails that get automatic admin access
const ADMIN_EMAILS = ["aykhan.khudaverdiyev@gmail.com", "yaqubyaqubov009@gmail.com"]
const CACHED_PROFILE_KEY = "apptrack_cached_profile"

function getCachedProfile() {
  try {
    const raw = localStorage.getItem(CACHED_PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCachedProfile(data) {
  try {
    if (data) {
      localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(CACHED_PROFILE_KEY)
    }
  } catch {}
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const initialProfile = getCachedProfile()

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(initialProfile)
  // If we already have a cached profile, we don't block the UI with a loading spinner
  const [loading, setLoading] = useState(!initialProfile)

  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  // In-flight promise to prevent duplicate concurrent network requests for the same user
  const inFlightPromiseRef = useRef(null)
  const inFlightUserIdRef = useRef(null)

  /**
   * Fetches user profile, creates it if missing, or promotes if admin.
   */
  async function loadProfile(currentUser) {
    if (!currentUser?.id) {
      setProfile(null)
      setCachedProfile(null)
      return null
    }

    if (inFlightPromiseRef.current && inFlightUserIdRef.current === currentUser.id) {
      return inFlightPromiseRef.current
    }

    inFlightUserIdRef.current = currentUser.id
    inFlightPromiseRef.current = (async () => {
      try {
        let data = await getMyProfile(currentUser.id)

        // 1. Auto-create student profile if missing (new users)
        if (!data) {
          const email = (currentUser.email || currentUser.user_metadata?.email || "").trim()
          const fullName =
            currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Student"
          const isAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email)

          const { error: insertError } = await supabase.from("profiles").upsert(
            {
              id: currentUser.id,
              email: email || "unknown+" + currentUser.id + "@supabase.user",
              role: isAdmin ? "admin" : "student",
              is_profile_completed: Boolean(isAdmin),
              full_name: fullName,
            },
            { onConflict: "id" }
          )

          if (insertError) {
            console.error("Profile insert error:", insertError.message)
            return profileRef.current
          }
          data = await getMyProfile(currentUser.id)
        } else if (
          currentUser.email &&
          ADMIN_EMAILS.includes(currentUser.email) &&
          data.role !== "admin"
        ) {
          // 2. Auto-promote admin emails to admin role if not already admin
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              role: "admin",
              is_profile_completed: true,
            })
            .eq("id", currentUser.id)

          if (!updateError) {
            data = { ...data, role: "admin", is_profile_completed: true }
          }
        }

        if (data) {
          setProfile(data)
          setCachedProfile(data)
        }
        return data
      } catch (error) {
        console.error("Profile load error:", error.message)
        return profileRef.current
      } finally {
        inFlightPromiseRef.current = null
        inFlightUserIdRef.current = null
      }
    })()

    return inFlightPromiseRef.current
  }

  // Handle auth state changes
  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)

      if (event === "SIGNED_OUT" || !nextUser) {
        setProfile(null)
        setCachedProfile(null)
        setLoading(false)
        return
      }

      // If we don't have a profile yet in state or cache, show loading
      // If we already have a cached profile, update quietly in background without blanking screen
      if (!profileRef.current) {
        setLoading(true)
      }

      await loadProfile(nextUser)
      if (mounted) {
        setLoading(false)
      }
    })

    // Safety timeout to prevent infinite loading screen on bad connections
    const fallbackTimer = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false)
      }
    }, 4000)

    return () => {
      mounted = false
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    setCachedProfile(null)
    setProfile(null)
    setUser(null)
    setSession(null)
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (!user) return null
    return await loadProfile(user)
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}
