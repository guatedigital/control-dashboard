# Authentication Setup Guide

This dashboard now requires authentication. **Only the email `info@intercambioinmobiliario.com` is authorized to access the dashboard.**

## Setup Steps

### 1. Run the Database Migration

Run the authentication migration in your Supabase SQL Editor:

1. Go to Supabase Dashboard → **SQL Editor**
2. Open `supabase/migrations/002_auth_schema.sql`
3. Copy and paste the SQL into the editor
4. Click **Run**

This creates the `authorized_accounts` table that stores which accounts can access the dashboard.

### 2. Enable Supabase Authentication

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Email** provider (if not already enabled)
3. Configure email settings as needed
4. Optionally enable **Email Confirmations** (recommended for production)

### 3. Create the Authorized Account

The migration automatically adds `info@intercambioinmobiliario.com` to the authorized accounts table. 

**Important**: Only this email address can access the dashboard. The system will reject any other email addresses.

#### Step-by-Step: Create User in Supabase Auth

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication**
   - In the left sidebar, click **Authentication**
   - Then click **Users** (or go directly to the Users tab)

3. **Create the User**
   - Click the **"Add user"** button (usually at the top right)
   - Select **"Create new user"** from the dropdown

4. **Fill in User Details**
   - **Email**: Enter `info@intercambioinmobiliario.com`
   - **Password**: Enter a secure password (or leave blank to send a password reset email)
   - **Auto Confirm User**: ✅ Check this box (recommended - allows immediate login without email confirmation)
   - **Send magic link**: Leave unchecked (you're setting a password)

5. **Create the User**
   - Click **"Create user"** button
   - The user will now appear in your users list

6. **Test Login**
   - Go to your dashboard login page (e.g., `http://localhost:3000/login` if running locally)
   - Use the email `info@intercambioinmobiliario.com` and the password you set
   - You should be able to log in and access the dashboard

**Note**: The email is already in the `authorized_accounts` table from the migration, so once you create the user in Supabase Auth, you can immediately log in.

### 4. Access Restrictions

**Only `info@intercambioinmobiliario.com` can access the dashboard.** The system enforces this at both the application level and database level.

If you need to change the authorized email, you'll need to:
1. Update the `AUTHORIZED_EMAIL` constant in `lib/auth/verify-auth.ts`
2. Update the email in the `authorized_accounts` table
3. Update the migration file if you want it to be the default for new installations

## How Authentication Works

1. **User Signs In**: Users sign in with email/password at `/login`
2. **Supabase Auth**: Supabase handles authentication and issues a session token
3. **Authorization Check**: The system checks if the user's email exists in the `authorized_accounts` table with `is_active = true`
4. **Dashboard Access**: Only authorized users can access `/dashboard`

## Security Notes

- The `authorized_accounts` table uses Row Level Security (RLS)
- Only service role (server-side) can write to the table
- Authenticated users can only read their own authorization status
- Always keep the service role key secure

## Troubleshooting

### "Account not authorized" error

- Check that the email exists in `authorized_accounts` table
- Verify `is_active` is set to `true`
- Ensure the email matches exactly (case-sensitive)

### Cannot access dashboard after login

- Verify the migration ran successfully
- Check that your email is in the `authorized_accounts` table
- Check browser console for errors
- Verify Supabase environment variables are set correctly

