# AppTrack Setup Script
# Run this in your terminal to set up the application

Write-Host "=== AppTrack Setup Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    Set-Content -Path ".env.local" -Value @"
VITE_SUPABASE_URL=https://ugvgktlphevruvnoteum.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_fDay1Uim-FyzRXZCKwbw9w_Kea4cvEr
"@
    Write-Host "✓ .env.local created" -ForegroundColor Green
} else {
    Write-Host "✓ .env.local already exists" -ForegroundColor Green
}

# Check if sql folder exists
if (-not (Test-Path "sql")) {
    Write-Host "Creating sql folder..." -ForegroundColor Yellow
    New-Item -Path "sql" -ItemType Directory
}

# Check if schema.sql exists
if (-not (Test-Path "sql/schema.sql")) {
    Write-Host "SQL schema not found - create it manually" -ForegroundColor Yellow
    Write-Host "See sql/schema.sql content in the main repository" -ForegroundColor Yellow
} else {
    Write-Host "✓ SQL schema exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to Supabase Dashboard" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Create Storage Buckets:" -ForegroundColor White
Write-Host "   - avatars (public)" -ForegroundColor Gray
Write-Host "   - student-documents (private)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Run SQL Schema:" -ForegroundColor White
Write-Host "   - Go to SQL Editor" -ForegroundColor Gray
Write-Host "   - Paste sql/schema.sql content" -ForegroundColor Gray
Write-Host "   - Click Run" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Install dependencies:" -ForegroundColor White
Write-Host "   npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Start development server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
