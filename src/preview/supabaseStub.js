/** Offline stand-in for src/lib/supabase.js — design-review page only. */
const noop = () => ({ data: [], error: null })
const builder = new Proxy({}, {
  get: () => () => builder,
})
export const supabase = {
  from: () => builder,
  rpc: async () => ({ data: null, error: null }),
  channel: () => ({ on: () => ({ on: () => ({ subscribe: () => {} }) }), subscribe: () => {} }),
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null, error: null }) }) },
}
export { noop }
