# AWS Lambda + Bedrock Migration - Deployment Guide

## Prerequisites
- AWS CLI configured with credentials for `eu-west-2`
- SAM CLI installed
- Companies House API key available

## Step 1: Store API Key in AWS SSM Parameter Store

```bash
aws ssm put-parameter \
  --name "/outreach/companies_house_api_key" \
  --value "YOUR_COMPANIES_HOUSE_API_KEY" \
  --type SecureString \
  --region eu-west-2
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Build and Deploy with SAM

```bash
cd infrastructure
sam build
sam deploy --guided \
  --stack-name ish-outreach-agent \
  --region eu-west-2 \
  --capabilities CAPABILITY_IAM
```

When prompted:
- Accept default values for most prompts
- Say "Y" to "Allow SAM CLI IAM role creation"
- Say "Y" to Lambda authorization warnings (public API)

After deployment, save the `OutreachApiUrl` from the output. It will look like:
```
https://xxxxx.execute-api.eu-west-2.amazonaws.com
```

## Step 4: Update Netlify Environment Variables

1. Go to Netlify → Outreach Agent site → Site settings → Environment
2. Add new variable: `NEXT_PUBLIC_API_URL` = `[OutreachApiUrl from SAM output]`
3. Trigger a new deploy

## Step 5: Verify Deployment

1. Access the Netlify site
2. Go to CRM section
3. Test search functionality
4. Test email generation

## Troubleshooting

### API Gateway CORS errors
- Check the `ALLOWED_ORIGIN` environment variable in `infrastructure/template.yaml`
- Update Netlify deployment URL if different from current value

### Bedrock errors
- Verify the region is `eu-west-2`
- Check that `amazon.nova-pro-v1:0` model is available in that region

### Companies House API errors
- Verify the API key is correctly stored in SSM Parameter Store
- Test directly: `curl -u YOUR_KEY: "https://api.company-information.service.gov.uk/search/companies?q=test&items_per_page=1"`
