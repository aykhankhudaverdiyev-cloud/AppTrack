# AppTrack: Developer Documentation

This project uses **React**, **Vite**, and **Supabase**. This guide will help you understand the codebase and architectural decisions.

## 1. Project Architecture
*   `src/pages/`: Contains the main application views (Dashboard, Login, etc.).
*   `src/components/`: Reusable UI modules.
*   `src/store/`: The "Brain" of the app. `studentsStore.js` is responsible for fetching, merging, and normalizing data from multiple Supabase tables.
*   `src/Services/`: API interaction layer.
*   `src/context/`: Handles global Auth state.
*   `src/lib/`: Database client initialization.

## 2. Important Logic
### Authentication & Role System
- `AuthContext.jsx` manages the global session.
- `App.jsx` handles routing. The `RootRedirect` function checks the user's role (`student` vs `admin`) and directs them accordingly.
- `RoleRoute.jsx` acts as a route guard.

### File Storage & Security
- Files are stored in Supabase `student-documents` bucket.
- **Privacy:** Files are private by default. Access is managed via `createSignedUrl` (1-hour expiration).
- **Security:** RLS (Row Level Security) policies are enforced in Supabase to ensure users can only access files they are authorized to see.

### Real-time Sync
- The application uses Supabase `channels` (`postgres_changes`) to listen for database events. Whenever data in `profiles` or `applications` tables changes, the store automatically reloads the data.

## 3. Contributing
1. **Adding a Feature:** Create a page in `src/pages/`.
2. **Adding Data:** If a new table is needed, update the `getStudents` or `loadStudents` function in `studentsStore.js`.
3. **Best Practices:** 
   - Keep logic in `Services/` or `store/`.
   - Maintain JSDoc comments for new functions.