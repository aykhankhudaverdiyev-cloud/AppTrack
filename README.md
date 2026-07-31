# AppTrack 🎓

AppTrack is a comprehensive Student Application Tracking System designed to help students manage their university applications, academic transcripts, and certifications in one secure, organized platform.

## 🚀 Live Demo
[https://apptrack-black.vercel.app/](https://apptrack-black.vercel.app/)

## ✨ Key Features
- **Role-Based Access:** Dedicated interfaces for Students and Admins.
- **Privacy Control:** Granular visibility settings (Public/Private) for individual applications and documents.
- **Document Management:** Secure PDF upload and viewing system using Supabase Storage.
- **Public Directory:** A searchable directory of public student profiles for community exploration.
- **Real-time Updates:** Automatic UI synchronization via Supabase Real-time.

## 🛠 Tech Stack
- **Frontend:** React 19, Vite, React Router 7
- **Backend/Database:** Supabase (Auth, Postgres, Storage)
- **Styling:** CSS3 (Custom responsive design)

## ⚙️ Getting Started
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key