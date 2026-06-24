# Outreach Agent — Deployment Guide

## Architecture

Next.js BFF on Netlify → AWS Lambda Function URLs (SAM). The BFF authenticates users (Auth.js v5, Google + Credentials) and proxies to Lambdas via server-only `INTERNAL_API_KEY` + `X-User-Id` headers. No secrets are exposed to the browser.

## Deploy Lambda stack

```bash
cd ~/Desktop/ish-work/outreach-agent/infrastructure
sam build
sam deploy --parameter-overrides \
  InternalApiKey="<key>" \
  SesFromEmail="outreach@ishsitotombe.co.uk" \
  ResendApiKey="<resend-key>" \
  CompaniesHouseApiKey="<ch-key>" \
  BraveApiKey="<brave-key>"
```

After deploy, get the Function URLs from the CloudFormation outputs or Lambda console.

## Netlify environment variables

Netlify → outreach-agent site → Site configuration → Environment variables:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://outreach.ishsitotombe.co.uk` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ALLOWED_USER_EMAILS` | Comma-separated allowed login emails |
| `INTERNAL_API_KEY` | Must match the SAM `InternalApiKey` parameter |
| `CRM_LAMBDA_URL` | Function URL for CRMFunction |
| `ACCOUNT_LAMBDA_URL` | Function URL for AccountFunction |
| `DRAFTS_LAMBDA_URL` | Function URL for DraftsFunction |
| `GENERATE_LAMBDA_URL` | Function URL for GenerateFunction |
| `ENRICH_LAMBDA_URL` | Function URL for EnrichFunction |
| `SEND_LAMBDA_URL` | Function URL for SendFunction |
| `SEARCH_LAMBDA_URL` | Function URL for SearchFunction |
| `SUPPRESSION_LAMBDA_URL` | Function URL for SuppressionFunction |

No `NEXT_PUBLIC_*` secrets are used. All Lambda communication is server-side only.

## Local development

```bash
cp .env.local.example .env.local
# Fill in all values (see .env.local.example for the full list)
npm run dev
```

## Key rotation

```bash
openssl rand -hex 32
# Update in both places:
# 1. SAM: sam deploy --parameter-overrides InternalApiKey="<new-key>" ...
# 2. Netlify: Environment variables → INTERNAL_API_KEY → paste new key → redeploy
```
