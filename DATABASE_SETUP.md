# AppTrack Database Setup Guide

## Prerequisites
1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key
3. Update `.env.local` with your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Database Schema Setup

### Step 1: Run SQL Schema
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `sql/schema.sql`
4. Click **Run** to execute

### Step 2: Configure Storage Buckets
Create two storage buckets in your Supabase dashboard:

1. **avatars** - for student profile photos
   - Public bucket
   - Allow public uploads (for avatars only)

2. **student-documents** - for application documents
   - Private bucket
   - Only authenticated users can access their own files

### Step 3: Enable Row Level Security (RLS)
RLS policies are already included in the schema.sql file. They ensure:
- Admins can view and modify all data
- Students can only view/edit their own data
- Public visibility controls what students see in the explore section

## Key Features Implemented

### 1. Visibility Request Approval Workflow
- Students request to change visibility (application/license)
- Request stored in `visibility_requests` table with status "pending"
- Admin receives notification
- Admin can approve or decline
- Upon approval, visibility is updated in the database
- Upon decline, notification is created and request marked as declined

### 2. Notifications System
- Admin receives notifications for all visibility requests
- Notification types: visibility_request, deadline, recommendation_declined, other
- Notifications show in a drawer on the admin dashboard
- Admin can mark as read, approve, or decline requests

### 3. Explore Students (Public View)
- Only students with `profile_visibility = "public"` appear
- Only public applications and licenses show in explore
- Private data remains hidden from other students

### 4. Admin Controls
- Admin can set anything to public/private directly (no approval needed)
- Admin can view all student data
- Admin can add/edit/remove applications and licenses for any student

## Troubleshooting

### Common Issues

1. **RLS Policies Not Working**
   - Ensure `auth.uid()` is being set correctly
   - Check that JWT claims include `role`
   - Verify RLS is enabled on all tables

2. **Storage Upload Failures**
   - Verify bucket names match: `avatars` and `student-documents`
   - Check storage permissions
   - Ensure CORS settings allow your domain

3. **Visibility Requests Not Showing**
   - Check `visibility_requests` table has data
   - Verify admin has notifications permission
   - Check notification type matches: `visibility_request`

## Database Tables Reference

### profiles
- Main user profile with visibility settings
- Admin fields: `role`, `admin_notes`, `assigned_counselor`, `decision`

### applications
- Student university applications
- Visibility: `private` (admin only) or `public` (visible to students)

### application_documents
- Documents attached to applications
- Stored in `student-documents` bucket

### licenses
- Certifications (IELTS, SAT, GRE, etc.)
- Visibility controls apply

### license_media
- Evidence files for licenses

### notifications
- Admin notification inbox
- Status: pending, unread, read, approved, declined

### visibility_requests
- Tracks student visibility change requests
- Status: pending, approved, declined
- Links to `profiles` and `applications`/`licenses`

## Next Steps
1. Test admin dashboard functionality
2. Test student dashboard functionality
3. Test visibility request workflow
4. Test explore students (public view)
5. Verify all data persists correctly
