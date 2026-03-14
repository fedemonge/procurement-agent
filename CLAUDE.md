# Procurement Agent

AI-powered supplier discovery tool. Live at procurement.fedemongeconsulting.com.

## What it does
1. User describes a product/service, optionally uploads an image and enters brand/SKU
2. User enters city/country and preferred incoterm
3. Claude (claude-sonnet-4-6 + web_search beta) searches the web and returns a curated supplier list
4. User can request results emailed as Excel + HTML report to any email
5. Every search triggers an alert email to fede@fedemongeconsulting.com

## Stack
- Next.js 14 App Router + TypeScript + Tailwind
- Anthropic claude-sonnet-4-6 with `web_search_20250305` beta tool
- nodemailer → Hostinger SMTP (smtp.hostinger.com:465)
- exceljs for Excel export
- @vercel/functions `waitUntil` for async email (returns 200 immediately, emails in background)
- Deployed on Vercel free tier

## Brand colors (match fedemongeconsulting.com)
- Teal: #28cfe2 (accents, CTAs, links)
- Navy: #0F2D3A (headers, backgrounds)
- Charcoal: #1a1d1e (page background)

## Key files
- src/app/page.tsx — Full UI (search form, results, email section)
- src/app/api/search/route.ts — Claude web_search API, maxDuration: 60
- src/app/api/email-results/route.ts — async email via waitUntil, maxDuration: 60
- src/lib/claude.ts — Anthropic client + prompt
- src/lib/excel.ts — branded Excel generation
- src/lib/mailer.ts — Hostinger SMTP sender
- src/lib/templates/pdf-report.ts — HTML report template
- src/lib/templates/email-alert.ts — owner alert + user email templates

## Deployment
npx vercel --prod
Custom domain: procurement.fedemongeconsulting.com
DNS: CNAME procurement → cname.vercel-dns.com (set in Hostinger DNS panel)

## Environment variables (set in Vercel Dashboard → Settings → Environment Variables)
ANTHROPIC_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL, NEXT_PUBLIC_SITE_URL

## Common issues
- OneDrive EPERM: rm -rf .next before builds
- Claude web_search timeout: check Anthropic status, retry
- SMTP auth failure: verify SMTP_PASS in Vercel env vars
- exceljs not found: must be in dependencies (not devDependencies), serverExternalPackages in next.config.ts
