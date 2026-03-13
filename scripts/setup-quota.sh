#!/bin/bash
# Quick setup script for quota system
# Run: bash scripts/setup-quota.sh

set -e

echo "[START] Setting up API Key Quota System..."
echo ""

# Step 1: Check environment
echo "[OK] Step 1: Checking environment..."
if [ ! -f ".env.local" ]; then
  echo "  [ERROR] .env.local not found"
  exit 1
fi
echo "  [OK] .env.local exists"

# Step 2: Generate CRON_SECRET if not present
if ! grep -q "CRON_SECRET" .env.local; then
  echo ""
  echo "[WARN] CRON_SECRET not found in .env.local"
  echo "   Generating random secret..."
  CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "CRON_SECRET=$CRON_SECRET" >> .env.local
  echo "   [OK] Added CRON_SECRET to .env.local"
else
  echo "[OK] Step 2: CRON_SECRET already set"
fi

# Step 3: Check Supabase CLI
echo ""
echo "[OK] Step 3: Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
  echo "  [ERROR] Supabase CLI not found"
  echo "   Install with: npm install -g @supabase/cli"
  exit 1
fi
echo "  [OK] Supabase CLI installed"

# Step 4: Run migration
echo ""
echo "[OK] Step 4: Running Supabase migration..."
pnpm run db:push
echo "  [OK] Migration completed"

# Step 5: Check vercel.json
echo ""
echo "[OK] Step 5: Checking vercel.json..."
if [ ! -f "vercel.json" ]; then
  echo "  [WARN] vercel.json not found - will need to add cron config manually"
else
  if grep -q '"crons"' vercel.json; then
    echo "  [OK] Cron configuration found in vercel.json"
  else
    echo "  [WARN] Add this to vercel.json:"
    echo '    "crons": [{"path": "/api/cron/reset-quotas", "schedule": "0 0 * * *"}]'
  fi
fi

# Step 6: Type check
echo ""
echo "[OK] Step 5: Type checking (may show pre-existing errors)..."
pnpm type-check 2>&1 | grep -i "quota\|quotamanager" || echo "   [OK] No quota-related errors"

echo ""
echo "=========================================="
echo "[OK] Quota system setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add your 19 API keys to Supabase:"
echo "   - Go to Supabase Dashboard → SQL Editor"
echo "   - Run INSERT statements for each key"
echo "   - See docs/QUOTA_SETUP.md for details"
echo ""
echo "2. Deploy to Vercel (if not already):"
echo "   - Set CRON_SECRET: vercel env add CRON_SECRET"
echo "   - Deploy: vercel deploy --prod"
echo ""
echo "3. Test locally:"
echo "   - pnpm dev"
echo "   - Upload a PDF to /extract"
echo "   - Check /api/v2/quota/status"
echo ""
echo "4. Monitor dashboard:"
echo "   - http://localhost:3000/api/v2/quota/dashboard"
echo ""
echo "Documentation:"
echo "   - QUOTA_MIGRATION_PLAN.md (detailed architecture)"
echo "   - QUOTA_SETUP.md (step-by-step guide)"
echo "   - QUOTA_IMPLEMENTATION.md (this implementation)"
echo ""
