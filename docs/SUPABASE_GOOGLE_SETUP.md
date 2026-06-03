# Enable Google OAuth for this project

Follow these steps to enable Google sign-in for the app.

1. Create OAuth credentials in Google Cloud Console
   - Go to https://console.cloud.google.com/apis/credentials
   - Create an OAuth 2.0 Client ID (type: Web application)
   - Add authorized redirect URIs (see step 3)
   - Copy the Client ID and Client Secret

2. Configure Supabase
   - Open your Supabase project dashboard
   - Go to `Authentication` -> `Providers`
   - Under **Google**, paste the Client ID and Client Secret and enable the provider

3. Add Redirect URLs to Supabase and Google

   Use these callback URLs (replace placeholders with your actual deployment URL / alias):

   - `https://<your-vercel-alias>/api/auth/callback`
   - `https://<your-deployment-url>.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback`

   Example for the recent deployment in this branch:

   - `https://sharp-ishizaka-41afb9.vercel.app/api/auth/callback`
   - `https://sharp-ishizaka-41afb9-7h07ec3sl-mapit112.vercel.app/api/auth/callback`

4. Add environment variables

   Required environment variables in Vercel (and locally for development):

   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL (eg. https://xyz.supabase.co)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
   - `GOOGLE_CLIENT_ID` — Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` — Google OAuth client secret

   Optional server-only envs:

   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (store as server-only)

5. Redeploy

   After configuring Supabase and adding env vars, trigger a production deploy:

   ```bash
   vercel deploy --prod --yes
   ```

6. Test

   - Open https://<your-vercel-alias>/auth/login and click "Sign in with Google".
   - If you see the error `Unsupported provider: provider is not enabled`, return to Supabase and ensure the Google provider is enabled and the redirect URLs match.

Troubleshooting

- If the user is redirected to a blank page after Google consent, ensure the callback URL used by the client is pointing to `/api/auth/callback` (server-side exchange).
- If the client shows `Invalid API key`, ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are present in the runtime environment.
