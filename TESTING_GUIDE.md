# Testing Guide for AppTrack

## Prerequisites

1. Supabase project created
2. Environment variables set in `.env.local`
3. Storage buckets created (`avatars`, `student-documents`)
4. SQL schema run successfully

## Quick Start Testing

### Step 1: Start Development Server
```bash
npm run dev
```

### Step 2: Login as Admin
1. Go to http://localhost:5173
2. Login with: aykhan.khudaverdiyev@gmail.com
3. You should be redirected to `/admin`

### Step 3: Test Admin Dashboard
1. Verify you can see all students
2. Try setting visibility to "public" directly (no approval needed)
3. Check notifications drawer for any pending requests

### Step 4: Test Student Workflow

#### Login as Student
1. Create a new student account (or use test account)
2. Login and complete profile
3. You should be redirected to `/student`

#### Test Visibility Request
1. Go to your Applications section
2. Click visibility toggle on an application
3. You should see success message
4. Check admin dashboard - you should see notification

#### Test Admin Approval
1. Go to admin dashboard
2. Open notifications drawer
3. Find pending visibility request
4. Click "Approve" or "Decline"
5. Verify the request status updates

### Step 5: Test Explore Students

#### As Admin
1. Login as admin
2. Set a student's profile visibility to "public"
3. Login as that student

#### As Student
1. Go to Explore Students tab
2. You should see the public profile
3. Check that private data is hidden

## Expected Behaviors

### Admin Actions (No Approval)
| Action | Result |
|--------|--------|
| Set application visibility | Immediate change |
| Set license visibility | Immediate change |
| Add application | Creates record |
| Edit application | Updates record |
| Delete application | Removes record |

### Student Actions (Approval Required)
| Action | Result |
|--------|--------|
| Request application visibility change | Creates request + notification |
| Request license visibility change | Creates request + notification |
| Request profile visibility change | Creates request + notification |

### Explore Students (Public View)
| Condition | Result |
|-----------|--------|
| profile_visibility = "public" | Appears in directory |
| application.visibility = "public" | Shows to other students |
| license.visibility = "public" | Shows to other students |

## Database Verification

### Check visibility_requests table
```sql
SELECT * FROM visibility_requests ORDER BY created_at DESC;
```

### Check notifications table
```sql
SELECT * FROM notifications ORDER BY created_at DESC;
```

### Check RLS policies are working
```sql
-- Should show all students to admin
SELECT COUNT(*) FROM profiles;

-- Should only show own profile to student (use as student)
SELECT * FROM profiles WHERE id = auth.uid();
```

## Error Handling

### Common Errors

1. **"Supabase env variables are missing"**
   - Fix: Check `.env.local` file exists with correct values

2. **"Row level security policy violation"**
   - Fix: Verify RLS is enabled on tables in Supabase
   - Fix: Check JWT claims include `role` field

3. **"Storage bucket not found"**
   - Fix: Create `avatars` and `student-documents` buckets in Supabase

4. **Notifications not showing**
   - Fix: Verify notifications table has data
   - Fix: Check admin user has correct role in profiles table

## Debug Commands

### Check database tables exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Check RLS is enabled
```sql
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('profiles', 'applications', 'licenses');
```

### Check storage buckets
```sql
-- In Supabase dashboard, go to Storage section
-- Verify these buckets exist:
-- - avatars
-- - student-documents
```

## Performance Tips

1. The SQL schema includes indexes on:
   - student_id columns
   - visibility columns
   - status columns

2. Use the `getPublicStudents()` function for explore section
3. Use the `getPendingVisibilityRequests()` function for admin notifications

## Support

For issues:
1. Check FINAL_REPORT.md for overview
2. Check DATABASE_SETUP.md for setup issues
3. Review sql/schema.sql for table structure
