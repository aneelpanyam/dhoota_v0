# AWS S3 Setup Guide

Step-by-step guide to configure AWS S3 for the Dhoota Pipeline PoC.

---

## 1. Choose a Region

Pick the AWS region closest to your users. For India-based political workers:

| Region | Code | Recommended for |
|--------|------|-----------------|
| Mumbai | `ap-south-1` | Primary choice for India |
| Hyderabad | `ap-south-2` | Alternative for India |
| Singapore | `ap-southeast-1` | Fallback |

Use `ap-south-1` unless you have a specific reason not to.

---

## 2. Create the S3 Bucket

1. Go to [S3 Console](https://s3.console.aws.amazon.com/s3/buckets)
2. Click **Create bucket**
3. Configure:
   - **Bucket name**: `dhoota-media-dev` (must be globally unique — add a suffix if taken, e.g., `dhoota-media-dev-yourname`)
   - **Region**: `ap-south-1`
   - **Object Ownership**: ACLs disabled (recommended)
   - **Block Public Access**: Keep ALL four checkboxes CHECKED (block all public access). We use presigned URLs — the bucket itself should never be public.
   - **Bucket Versioning**: Disabled (for PoC; enable for production)
   - **Default encryption**: SSE-S3 (Amazon S3 managed keys) — the default is fine
4. Click **Create bucket**

### CORS Configuration

After creating the bucket, configure CORS so the browser can upload directly via presigned URLs:

1. Go to the bucket > **Permissions** tab > **Cross-origin resource sharing (CORS)** > Edit
2. Paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

For production, replace `http://localhost:3000` with your actual domain(s). You can add multiple origins:

```json
"AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"]
```

---

## 3. Create an IAM User with Least-Privilege Access

### Why an IAM User (for now)

AWS recommends IAM Roles with temporary credentials over long-lived access keys. However, Vercel Serverless Functions don't natively assume IAM roles at runtime. For the PoC, a dedicated IAM user with a tightly scoped policy is the pragmatic choice. For production, consider:
- Vercel's [OIDC Federation](https://vercel.com/docs/security/secure-backend-access/oidc) to assume an IAM Role
- An intermediate AWS Lambda that generates presigned URLs

### Create the IAM Policy

1. Go to [IAM Console > Policies](https://console.aws.amazon.com/iam/home#/policies)
2. Click **Create policy** > **JSON** tab
3. Paste this least-privilege policy (replace `dhoota-media-dev` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUploadAndRead",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::dhoota-media-dev/*"
    },
    {
      "Sid": "AllowListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::dhoota-media-dev"
    }
  ]
}
```

This grants ONLY:
- `PutObject` — needed to generate presigned upload URLs
- `GetObject` — needed to generate presigned download URLs (if we add that later)
- `ListBucket` — needed to verify objects exist

It does NOT grant: `DeleteObject`, `PutBucketPolicy`, `PutBucketACL`, or any admin actions.

4. Click **Next**, name it `dhoota-s3-media-access`, add a description, and create

### Create the IAM User

1. Go to [IAM Console > Users](https://console.aws.amazon.com/iam/home#/users)
2. Click **Create user**
3. **User name**: `dhoota-poc-s3`
4. Do NOT check "Provide user access to the AWS Management Console" — this is a programmatic-only user
5. Click **Next**
6. **Set permissions**: Choose "Attach policies directly" > search for `dhoota-s3-media-access` > check it
7. Click **Next** > **Create user**

### Create Access Keys

1. Click on the user `dhoota-poc-s3`
2. Go to **Security credentials** tab
3. Scroll to **Access keys** > **Create access key**
4. Choose **Application running outside AWS** (this is our Vercel use case)
5. Click **Next** > **Create access key**
6. **IMPORTANT**: Copy both the **Access key ID** and **Secret access key** now. The secret is only shown once.

---

## 4. Configure Environment Variables

Put the values in your `.env.local`:

```
AWS_S3_BUCKET=dhoota-media-dev
AWS_S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

---

## 5. Security Checklist

- [ ] S3 bucket has ALL public access blocked
- [ ] IAM policy only grants `PutObject`, `GetObject`, `ListBucket` on this one bucket
- [ ] IAM user has no console access
- [ ] Access keys are stored in `.env.local` only (git-ignored)
- [ ] `.env.local` is listed in `.gitignore`
- [ ] CORS only allows your specific origins
- [ ] Presigned URLs have a 1-hour expiration (configured in code)

### Key Rotation (Production)

For production, rotate access keys every 90 days:
1. Create a new access key for the user
2. Update the env var in Vercel
3. Verify the new key works
4. Delete the old key

Or better: migrate to Vercel OIDC + IAM Role to eliminate long-lived keys entirely.

---

## 6. Verify Setup

After configuring everything, you can test the presigned URL generation by starting the dev server and calling the endpoint:

```bash
curl -X POST http://localhost:3000/api/media/presign \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","mimeType":"image/jpeg","fileSizeBytes":1024,"context":"activity"}'
```

If auth is required (which it is), you'll need to be logged in first. The easiest way to test is through the chat UI after completing the full setup.

---

## 7. CloudWatch Logs Setup (Structured Logging)

The app supports structured logging to AWS CloudWatch Logs. In development, logs print to the console. In production (Vercel), logs are batched and flushed to CloudWatch at the end of each API request.

### Create the Log Group

1. Go to [CloudWatch Console > Log groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
2. Make sure you are in the correct region (e.g., `ap-south-1`)
3. Click **Create log group**
4. **Log group name**: `/dhoota/pipeline`
5. **Retention**: Choose a retention period (e.g., 30 days for PoC, 90 days for production)
6. Click **Create**

### Add CloudWatch Permissions to the IAM User

The same IAM user (`dhoota-poc-s3`) can be extended with CloudWatch Logs permissions, or you can create a separate policy.

1. Go to [IAM Console > Policies](https://console.aws.amazon.com/iam/home#/policies)
2. Click **Create policy** > **JSON** tab
3. Paste (replace the log group ARN region and account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:ap-south-1:YOUR_ACCOUNT_ID:log-group:/dhoota/pipeline:*"
    }
  ]
}
```

To find your account ID: click your username in the top-right of the AWS console.

4. Name it `dhoota-cloudwatch-logs-access` and create
5. Go to [IAM Console > Users](https://console.aws.amazon.com/iam/home#/users) > `dhoota-poc-s3`
6. Click **Add permissions** > **Attach policies directly** > search for `dhoota-cloudwatch-logs-access` > attach

### Configure Environment Variables

Add these to your `.env.local` (and Vercel env vars for production):

```
CLOUDWATCH_ENABLED=true
CLOUDWATCH_LOG_GROUP=/dhoota/pipeline
CLOUDWATCH_REGION=ap-south-1
```

Set `CLOUDWATCH_ENABLED=false` (or omit it) for local development — logs will print to the console instead.

### What Gets Logged

Each API request emits structured JSON logs containing:
- **Pipeline trace**: overall request duration, source, optionId, step count
- **Per-step details**: step name, duration, success/failure, LLM model used, SQL query count
- **Errors**: LLM failures, SQL execution errors, pipeline-level errors

Logs are flushed non-blocking via `waitUntil` on Vercel, so they don't slow down the user response.

### Verify Setup

After enabling CloudWatch, trigger any action in the chat UI, then check:

1. Go to [CloudWatch Console > Log groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups) > `/dhoota/pipeline`
2. You should see a log stream named with today's date (e.g., `2026-03-12-a1b2c3d4`)
3. Click the stream to view structured JSON log entries

### Security Checklist

- [ ] Log group exists in the correct region
- [ ] IAM policy scoped to only the `/dhoota/pipeline` log group
- [ ] `CLOUDWATCH_ENABLED` is `false` in local dev
- [ ] No sensitive data (passwords, tokens) logged — only pipeline metadata and error messages
