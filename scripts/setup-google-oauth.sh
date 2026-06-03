#!/usr/bin/env bash
set -euo pipefail

# Interactive helper to add Google OAuth client id/secret to Vercel envs
# Usage: ./scripts/setup-google-oauth.sh

read -p "Enter SUPABASE_PROJECT_URL (eg https://xyz.supabase.co): " SUPABASE_URL
read -p "Enter NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " SUPABASE_PUBLISHABLE_KEY
read -p "Enter SUPABASE_SERVICE_ROLE_KEY (optional, leave blank to skip): " SUPABASE_SERVICE_ROLE_KEY
read -p "Enter GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -p "Enter GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

echo "Adding environment variables to Vercel (will prompt for environment selection)..."

echo "Adding NEXT_PUBLIC_SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL" --yes || true

echo "Adding NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" --yes || true

if [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "Adding SUPABASE_SERVICE_ROLE_KEY (server-only)"
  vercel env add SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" --yes || true
fi

echo "Adding GOOGLE_CLIENT_ID"
vercel env add GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID" --yes || true

echo "Adding GOOGLE_CLIENT_SECRET"
vercel env add GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET" --yes || true

cat <<EOF
Done. Next steps:
1. In your Supabase dashboard -> Auth -> Providers -> Google, paste the Google Client ID and Secret.
2. Add the following Redirect URLs to Supabase OAuth settings:
   - https://<your-vercel-alias>/api/auth/callback
   - https://<your-deployment-url>.vercel.app/api/auth/callback
   - http://localhost:3000/api/auth/callback
3. Redeploy on Vercel (the CLI will trigger a new deployment if envs changed):
   vercel deploy --prod --yes
EOF
