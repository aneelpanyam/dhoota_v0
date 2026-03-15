# CloudFront CDN Setup Guide

Step-by-step guide to configure AWS CloudFront in front of your S3 bucket for secure, CDN-delivered media. All content is served via **signed URLs only** — no public access.

---

## Security Overview

- **S3 stays private** — Origin Access Control (OAC) only. No direct S3 access.
- **Restrict viewer access** — CloudFront requires signed URLs for all content.
- **Validate before generate** — The app validates access (auth + DB) before generating any URL.
- **Short-lived URLs** — Default 1-hour expiration.

---

## 1. Prerequisites

- S3 bucket configured per [AWS_SETUP.md](./AWS_SETUP.md)
- AWS account with CloudFront permissions

---

## 2. Create CloudFront Key Pair (for Signing)

1. Go to [CloudFront Console > Key management](https://console.aws.amazon.com/cloudfront/v3/home#/key-management)
2. Click **Create public key**
3. **Key name**: `dhoota-media-signing`
4. **Public key**: Generate a key pair using one of these methods:

   **Option A — Node.js (works on Windows, no OpenSSL needed):**
   ```powershell
   node scripts/generate-cloudfront-key-pair.mjs
   ```
   This creates `scripts/public_key.pem` and `scripts/private_key.pem`. Paste the contents of `public_key.pem` into the CloudFront form.

   **Option B — OpenSSL (Linux, macOS, or Git Bash on Windows):**
   ```bash
   openssl genrsa -out private_key.pem 2048
   openssl rsa -pubout -in private_key.pem -out public_key.pem
   ```
   Paste the contents of `public_key.pem` into the CloudFront form.

5. Click **Create public key**
6. Go to **Key groups** > **Create key group**
7. **Key group name**: `dhoota-media-key-group`
8. Add the public key you created. Create.
9. **Important**: Save `private_key.pem` securely. You will need it for `AWS_CLOUDFRONT_PRIVATE_KEY`. The key pair ID (e.g. `K2ABC123...`) is shown in the console. `*.pem` files are gitignored — do not commit them.

---

## 3. Create CloudFront Distribution

1. Go to [CloudFront Console > Distributions](https://console.aws.amazon.com/cloudfront/v3/home#/distributions)
2. Click **Create distribution**
3. **Origin domain**: Select your S3 bucket (e.g. `dhoota-media-dev.s3.ap-south-1.amazonaws.com`)
4. **Origin access**: Origin access control (recommended)
5. Click **Create control setting** — creates a new OAC. Use default name or `dhoota-s3-oac`. Create.
6. **Default cache behavior**:
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS
   - **Cache policy**: CachingOptimized (or custom with TTL 86400)
   - **Restrict viewer access**: **Yes**
   - **Trusted key groups**: Select `dhoota-media-key-group`
7. **Settings**:
   - **Price class**: Use all edge locations (or choose based on your audience)
   - **Alternate domain names** (optional): e.g. `cdn.yourdomain.com`
   - **Custom SSL certificate** (optional): if using custom domain
8. Click **Create distribution**
9. **Update S3 bucket policy**: CloudFront will show a banner. Copy the policy and apply it to your S3 bucket (Permissions > Bucket policy). This allows only CloudFront OAC to read from S3.
10. Note the **Distribution domain name** (e.g. `d123abc.cloudfront.net`)

---

## 4. Configure Environment Variables

Add to `.env.local` (and Vercel env vars for production):

```
NEXT_PUBLIC_CDN_DOMAIN=https://d123abc.cloudfront.net
AWS_CLOUDFRONT_KEY_PAIR_ID=K2ABC123...
AWS_CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

- **NEXT_PUBLIC_CDN_DOMAIN**: Your CloudFront distribution domain (no trailing slash). Use `https://`.
- **AWS_CLOUDFRONT_KEY_PAIR_ID**: The key pair ID from the CloudFront key (starts with `K2`).
- **AWS_CLOUDFRONT_PRIVATE_KEY**: Full PEM contents. For env vars, you can use `\n` for newlines, or paste the key with actual newlines if your env loader supports multiline.

All three must be set for CDN mode. If any is missing, the app falls back to S3 presigned URLs.

---

## 5. Security Checklist

- [ ] S3 bucket has all public access blocked
- [ ] CloudFront uses OAC; S3 bucket policy allows only CloudFront OAC (no public `s3:GetObject`)
- [ ] "Restrict viewer access" enabled on CloudFront distribution
- [ ] Private key stored in env only; never in code or git
- [ ] `.env.local` and `.env` are in `.gitignore`
- [ ] CORS on CloudFront restricted to app origins if you add custom CORS (optional)
- [ ] Key rotation plan: rotate key pair every 90 days (create new key, add to key group, update env, remove old key)

---

## 6. Verify Setup

1. Deploy the app with the env vars set.
2. Log in and trigger a media load (e.g. view an activity with images).
3. Check the network tab: `/api/media/serve?key=...` should return a 302 redirect to a CloudFront URL with `Signature`, `Key-Pair-Id`, and `Expires` query params.
4. The redirected URL should load the image.
5. Unauthenticated request to `/api/media/serve?key=...` (for private content) should return 401.

---

## 7. Key Rotation

To rotate the signing key:

1. Create a new public key and key pair (steps in section 2).
2. Add the new public key to the key group (don't remove the old one yet).
3. Update `AWS_CLOUDFRONT_KEY_PAIR_ID` and `AWS_CLOUDFRONT_PRIVATE_KEY` with the new values.
4. Deploy. New signed URLs will use the new key.
5. After 1 hour (max URL expiry), old URLs will stop working. Remove the old key from the key group.
