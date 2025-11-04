# Setup Guide

## Supabase Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in project details:
   - **Name**: control-dashboard (or any name you prefer)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Free tier is sufficient for development
4. Click "Create new project" (takes 1-2 minutes)

### Step 2: Get Your Supabase Credentials

Once your project is created:

1. Go to **Settings** → **API** in your Supabase dashboard
2. You'll find three important values:

   - **Project URL** 
     - This is your `NEXT_PUBLIC_SUPABASE_URL`
     - Example: `https://xxxxxxxxxxxxx.supabase.co`
   
   - **anon public** key
     - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Long string starting with `eyJ...`
   
   - **service_role** key (⚠️ Keep this secret!)
     - This is your `SUPABASE_SERVICE_ROLE_KEY`
     - Also a long string starting with `eyJ...`
     - **Important**: This key bypasses Row Level Security, keep it secure!

### Step 3: Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project
4. Copy the entire SQL content
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

This creates:
- `perfexcrm_metrics` table
- `uchat_metrics` table  
- `aggregated_insights` table
- Indexes and triggers for automatic timestamp updates

### Step 4: Enable Real-time (Optional but Recommended)

1. Go to **Settings** → **API**
2. Ensure **"Realtime"** is enabled (should be enabled by default)

## Environment Variables

After getting your Supabase credentials, add them to your environment:

### For Local Development (.env.local)

Create a `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# PerfexCRM API Configuration
NEXT_PUBLIC_PERFEXCRM_API_URL=https://perfexcrm.themesic.com
PERFEXCRM_API_KEY=your-perfexcrm-api-key

# Uchat API Configuration
NEXT_PUBLIC_UCHAT_API_URL=https://www.uchat.com.au/api
UCHAT_API_KEY=your-uchat-api-key

# Data Sync Configuration (optional)
DATA_SYNC_INTERVAL=60000
ENABLE_REALTIME=true
```

### For Vercel Deployment

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - Click **"Add New"**
   - Enter the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the value
   - Select environment (Production, Preview, Development)
   - Click **"Save"**
4. Repeat for all variables
5. **Redeploy** your application after adding variables

## Testing the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test the sync endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/sync \
     -H "Content-Type: application/json" \
     -d '{"source": "all"}'
   ```

3. Check Supabase:
   - Go to **Table Editor** in Supabase dashboard
   - You should see data in the tables after running sync

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure all Supabase variables are set in `.env.local` (local) or Vercel (production)
- Restart your dev server after adding variables

### "Relation does not exist" error
- Make sure you ran the SQL migration script
- Check in Supabase **Table Editor** that the tables exist

### Real-time not working
- Verify real-time is enabled in Supabase settings
- Check that `ENABLE_REALTIME=true` in your environment variables

### Build errors
- The build should succeed even without env vars (using placeholders)
- Make sure to add all env vars in Vercel before the first deployment

