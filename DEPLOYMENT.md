# Outreach Agent — Deployment Guide

## One-time setup: new SSM parameter

Before deploying, create the API key parameter (the others already exist):

```bash
# Generate a strong API key
aws ssm put-parameter \
  --name /outreach/api_key \
  --value "$(openssl rand -hex 32)" \
  --type SecureString \
  --region eu-west-2

# Print it so you can copy it for Netlify
aws ssm get-parameter \
  --name /outreach/api_key \
  --with-decryption \
  --query Parameter.Value \
  --output text \
  --region eu-west-2
```

Existing parameters (should already be present):
- `/outreach/companies_house_api_key`
- `/outreach/resend_api_key`
- `/outreach/brave_api_key`

## Deploy Lambda stack

```bash
cd ~/Desktop/ish-work/outreach-agent

git add -A
git commit -m "feat: DynamoDB CRM, /api/crm + /send Lambda routes, multi-page frontend"

cd infrastructure
sam build
sam deploy
```

`sam deploy` will output the API Gateway base URL — copy it for the next step.

## Netlify environment variables

Netlify → Site settings → Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_LAMBDA_BASE` | API Gateway URL from `sam deploy` (e.g. `https://abc123.execute-api.eu-west-2.amazonaws.com`) |
| `NEXT_PUBLIC_OUTREACH_API_KEY` | The key from SSM `/outreach/api_key` |

Trigger a Netlify redeploy after adding them.

## Local development

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_LAMBDA_BASE and NEXT_PUBLIC_OUTREACH_API_KEY
npm run dev
```

## What was added

### Backend
- **`ProspectsTable`** DynamoDB table — PK: `userId`, SK: `companyNumber`, GSIs: `ByStatus`, `ByContactedAt`
- **`CRMFunction`** — `/api/crm` CRUD (list / upsert / patch / delete), auth required
- **`SendFunction`** — `/send` sends via Resend then updates CRM, auth required
- `src/lambda/crm.js`, `src/lambda/send.js`

### Frontend
- `/search` — CH company search, save to CRM
- `/prospects` — CRM table with status filter
- `/prospect/[number]` — company detail, notes, status, reply tracking
- `/compose` — select → generate → edit → send
- `app/lib/api.ts` — typed API client
- Root `/` redirects to `/search`
