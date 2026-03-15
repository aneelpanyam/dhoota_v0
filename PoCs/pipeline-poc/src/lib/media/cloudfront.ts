import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const DEFAULT_EXPIRES_IN_SECONDS = 3600; // 1 hour

function getCdnDomain(): string | null {
  const domain = process.env.NEXT_PUBLIC_CDN_DOMAIN;
  if (!domain || !domain.trim()) return null;
  const trimmed = domain.replace(/\/$/, ""); // strip trailing slash
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function getKeyPairId(): string | null {
  const id = process.env.AWS_CLOUDFRONT_KEY_PAIR_ID;
  if (!id || !id.trim()) return null;
  return id;
}

function getPrivateKey(): string | null {
  const key = process.env.AWS_CLOUDFRONT_PRIVATE_KEY;
  if (!key || !key.trim()) return null;
  // Support \n in env (some systems store newlines as literal \n)
  // Normalize line endings (Windows CRLF -> LF)
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Returns true when all three CDN env vars are set. When true, media is served via CloudFront signed URLs.
 */
export function isCdnConfigured(): boolean {
  return !!(getCdnDomain() && getKeyPairId() && getPrivateKey());
}

/**
 * Generates a signed CloudFront URL for the given S3 key. Throws if CDN is not configured or signing fails.
 * @param s3Key - The S3 object key (e.g. tenantId/activity/uuid/filename.jpg)
 * @param expiresInSeconds - URL validity in seconds (default 3600 = 1 hour)
 */
export async function getSignedCdnUrl(
  s3Key: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS
): Promise<string> {
  const domain = getCdnDomain();
  const keyPairId = getKeyPairId();
  const privateKey = getPrivateKey();

  if (!domain || !keyPairId || !privateKey) {
    throw new Error("CloudFront CDN not configured: missing NEXT_PUBLIC_CDN_DOMAIN, AWS_CLOUDFRONT_KEY_PAIR_ID, or AWS_CLOUDFRONT_PRIVATE_KEY");
  }

  const path = s3Key.split("/").map(encodeURIComponent).join("/");
  const url = `${domain}/${path}`;
  const dateLessThan = new Date(Date.now() + expiresInSeconds * 1000);

  return getSignedUrl({
    url,
    keyPairId,
    privateKey,
    dateLessThan,
  });
}
