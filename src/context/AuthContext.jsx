import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { getMyProfile } from "../Services/ProfileService"

const ADMIN_EMAILS = ["aykhan.khudaverdiyev@gmail.com"]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null)
      return null
    }

    try {
      let data = await getMyProfile(currentUser.id)

      // If OAuth created a user but the profile row does not exist yet,
      // create a minimal student profile automatically.
      if (!data) {
        // Get email from currentUser or user_metadata
        const email = (currentUser.email || currentUser.user_metadata?.email || "").trim()
        const fullName = currentUser.user_metadata?.full_name || (currentUser.email?.split("@")[0]) || "Student"
        
        const { error: insertError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: currentUser.id,
              email: email || "unknown+" + currentUser.id + "@supabase.user",  // Fallback email
              role: "student",
              is_profile_completed: false,
              full_name: fullName,
            },
            { onConflict: "id" }
          )

        if (insertError) {
          console.error("Profile insert error:", insertError.message)
          setProfile(null)
          return null
        }

        data = await getMyProfile(currentUser.id)
      }

      // Auto-promote admin emails to admin role — works even on first login
      if (currentUser.email && ADMIN_EMAILS.includes(currentUser.email)) {
        if (data?.role !== "admin") {
          const email = (currentUser.email || currentUser.user_metadata?.email || "").trim()
          const fullName = currentUser.user_metadata?.full_name || (currentUser.email?.split("@")[0]) || "Admin"
          
          const { error: upsertError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: currentUser.id,
                email: email || "admin+" + currentUser.id + "@supabase.user",  // Fallback email
                role: "admin",
                is_profile_completed: true,
                full_name: fullName,
              },
              { onConflict: "id" }
            )

          if (!upsertError) {
            data = await getMyProfile(currentUser.id)
          }
        }
      }

      setProfile(data)
      return data
    } catch (error) {
      console.error("Profile load error:", error.message)
      setProfile(null)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile(null)
      }

      if (mounted) setLoading(false)
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return

      setLoading(true)
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        loadProfile(nextSession.user)
      } else {
        setProfile(null)
      }

      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
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
