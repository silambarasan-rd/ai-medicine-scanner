# Supabase Authentication Setup Guide

This guide will help you set up Supabase OAuth authentication for MathirAI.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. OAuth credentials from providers (Google, GitHub) if using OAuth

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in the project details:
   - Name: mathir-ai (or your choice)
   - Database Password: (generate a secure password)
   - Region: Choose the closest to your users
4. Click "Create new project"

## Step 2: Get Your Supabase Credentials

1. After the project is created, go to **Settings** → **API**
2. Copy the following values:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - publishable/anon key (the long string under "Project API keys")
3. Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

## Step 3: Configure Authentication Providers

### Email Authentication (Magic Link)

Email authentication is enabled by default in Supabase. Users will receive a magic link via email to sign in.

In Supabase:
1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Configure email templates (optional) under **Authentication** → **Email Templates**

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted
6. Set Application type to **Web application**
7. Add Authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for local testing)
8. Copy the Client ID and Client Secret

In Supabase:
1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Paste your Client ID and Client Secret
4. Save

### GitHub OAuth

1. Go to [GitHub Settings](https://github.com/settings/applications/new)
2. Fill in the application details:
   - Application name: MathirAI
   - Homepage URL: Your app URL
   - Authorization callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
3. Click **Register application**
4. Copy the Client ID
5. Click **Generate a new client secret** and copy it

In Supabase:
1. Go to **Authentication** → **Providers**
2. Enable **GitHub**
3. Paste your Client ID and Client Secret
4. Save

## Step 4: Configure Site URL

1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set the Site URL to your production URL (e.g., `https://mathirai.netlify.app`)
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback` (for local development)
   - `https://your-production-url.com/auth/callback`

## Step 5: Test the Authentication Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`
3. You should be redirected to the login page
4. Try logging in with:
   - Email (you'll receive a magic link)
   - Google OAuth
   - GitHub OAuth
5. After successful authentication, you should be redirected to the dashboard

## Troubleshooting

### "Missing Supabase environment variables" Error
- Make sure your `.env.local` file exists and contains the correct values
- Restart your development server after updating environment variables

### OAuth Login Fails
- Verify that the redirect URLs match in both the provider console and Supabase
- Check that the OAuth credentials are correct
- Ensure the provider is enabled in Supabase

### Redirect Loop
- Clear your browser cookies and cache
- Check that the middleware is configured correctly
- Verify that the Site URL in Supabase matches your app URL

## Production Deployment

Before deploying to production:

1. Add production URLs to OAuth provider configurations
2. Update Site URL in Supabase to your production domain
3. Add production redirect URLs to Supabase configuration
4. Set environment variables in your hosting platform (Netlify, Vercel, etc.)

## Security Notes

- Never commit `.env.local` or share your credentials
- Use different Supabase projects for development and production
- Regularly rotate your OAuth secrets
- Enable email confirmation in Supabase for additional security
- Consider implementing rate limiting for authentication endpoints
