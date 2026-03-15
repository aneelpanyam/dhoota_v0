# Image Optimizer Lambda Setup

S3-triggered Lambda that automatically resizes and compresses uploaded images (JPEG, PNG, WebP) before CloudFront serves them. Typical 2MB images are reduced to ~200–400KB.

---

## Prerequisites

- S3 bucket configured per [AWS_SETUP.md](./AWS_SETUP.md)
- AWS CLI configured
- Node.js 20+

---

## 1. Build the Lambda Package

Uses **Jimp** (pure JavaScript, no native dependencies) — works on Lambda without platform-specific builds.

```powershell
cd infra/image-optimizer
npm install
```

Create a deployment zip:

```powershell
# Windows PowerShell (run from infra/image-optimizer)
Compress-Archive -Path index.mjs, package.json, node_modules -DestinationPath ..\image-optimizer.zip -Force
cd ..
```

Or on Linux/macOS:

```bash
zip -r ../image-optimizer.zip index.mjs package.json node_modules
cd ..
```

---

## 2. Create the Lambda Function

1. Go to [Lambda Console](https://console.aws.amazon.com/lambda/home#/functions)
2. **Create function** → Author from scratch
3. **Function name**: `dhoota-image-optimizer`
4. **Runtime**: Node.js 20.x
5. **Architecture**: x86_64
6. **Execution role**: Create a new role with basic Lambda permissions (we'll add S3 next)
7. Create function

### Configure the Function

- **Memory**: 1024 MB (Jimp is pure JS and uses more memory than native libs)
- **Timeout**: 60 seconds
- **Code**: Upload `image-optimizer.zip` (or deploy via CLI)

### Add S3 Permissions to the Role

1. Go to the function → **Configuration** → **Permissions**
2. Click the execution role name (opens IAM)
3. **Add permissions** → **Attach policies** → **Create policy** (JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ReadWrite",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::dhoota-media-dev/*"
    }
  ]
}
```

Note: `s3:GetObject` covers both GetObject and HeadObject. There is no separate `s3:HeadObject` action.

Replace `dhoota-media-dev` with your bucket name. Name the policy `dhoota-image-optimizer-s3` and attach it to the Lambda role.

**CloudFront invalidation** (optional but recommended): To serve the optimized image immediately instead of waiting for cache TTL, add a second policy for CloudFront:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` and `YOUR_DISTRIBUTION_ID`. Find the distribution ID in CloudFront Console → your distribution → General tab (e.g. `E1234ABCD5678`). Then set the Lambda environment variable `CLOUDFRONT_DISTRIBUTION_ID` to that value.

---

## 3. Add S3 Event Notification

1. Go to [S3 Console](https://s3.console.aws.amazon.com/s3/buckets) → your bucket (`dhoota-media-dev`)
2. **Properties** tab → **Event notifications** → **Create event notification**
3. **Name**: `image-optimizer-trigger`
4. **Event types**: `s3:ObjectCreated:Put`
5. **Destination**: Lambda function → select `dhoota-image-optimizer`
6. Create

S3 will prompt you to add permission for the bucket to invoke the Lambda. Accept.

---

## 4. Verify Setup

1. Upload a new image via the app (e.g. add media to an activity)
2. In Lambda Console → **Monitor** → **View logs in CloudWatch**
3. Check the log stream for the invocation; you should see `Optimized tenant/activity/.../file.jpg: 2048.0KB -> 320.5KB`
4. In S3, confirm the object size has decreased
5. Request the image via the app; CloudFront will serve the optimized version (may need cache invalidation for immediate effect)

---

## 5. Existing Images

The Lambda only runs on **new** uploads. For images already in S3:

- **Option A**: Re-upload via the app (edit activity, replace image)
- **Option B**: Use a one-off script to copy objects (triggers Lambda). Example:

```bash
aws s3 cp s3://dhoota-media-dev/tenant/activity/uuid/old.jpg s3://dhoota-media-dev/tenant/activity/uuid/old.jpg
```

This overwrites the object and triggers the Lambda.

---

## 6. CloudFront Cache

After optimization, CloudFront may still serve the old version until cache expires (default TTL, e.g. 24h). To force refresh:

1. CloudFront Console → your distribution → **Invalidations**
2. Create invalidation with path `/*` (or the specific key path)

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Lambda not triggered | S3 event notification configured? Bucket has permission to invoke Lambda? |
| Lambda timeout | Increase memory (512MB+) or timeout (30s). Jimp is slower than Sharp; 1024MB recommended for large images. |
| Object not optimized | Verify key matches `*/activity/*`, `*/profile/*`, `*/public_site/*`, or `*/note/*` and extension is jpg/jpeg/png. WebP is not supported (skipped). |
| Optimized in S3 but still seeing old version | CloudFront cache. Set `CLOUDFRONT_DISTRIBUTION_ID` and add CloudFront invalidation permission so the Lambda invalidates the cache after optimizing. |
| "Skip (already optimized)" but image still large | Each upload triggers two Lambda runs: one processes, one skips (from our overwrite). Check both log streams. If the first run failed, the second would skip a 2MB object; we now re-optimize when x-optimized but size > 1.5MB. |

### npm audit vulnerabilities

Jimp depends on `file-type`, which has a moderate advisory (GHSA-5v7r-6r5c-r473: infinite loop in ASF parser). **Mitigation**: we validate magic bytes (JPEG/PNG) before passing the buffer to Jimp, so non-image or malformed files never reach file-type's format detection. Monitor [jimp-dev/jimp](https://github.com/jimp-dev/jimp) for upstream updates.
