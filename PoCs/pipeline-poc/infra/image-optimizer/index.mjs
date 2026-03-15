/**
 * S3-triggered Lambda: resizes and compresses uploaded images.
 * Uses Jimp (pure JavaScript, no native deps) - works on Lambda without platform-specific builds.
 * Skips non-images and objects already tagged with x-optimized.
 * Validates magic bytes before processing to avoid passing untrusted data to file-type (security).
 */

import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Jimp } from "jimp";

const s3 = new S3Client({});
const cloudfront = new CloudFrontClient({});

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;
const MAX_OPTIMIZED_SIZE = 1.5 * 1024 * 1024; // 1.5MB - if larger, re-optimize even with x-optimized

const IMAGE_EXT = /\.(jpe?g|png)$/i;
const CONTEXT_PATHS = ["/activity/", "/profile/", "/public_site/", "/note/"];

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isImageKey(key) {
  return IMAGE_EXT.test(key);
}

function isContextPath(key) {
  return CONTEXT_PATHS.some((p) => key.includes(p));
}

/** Returns true if buffer has JPEG or PNG magic bytes. Avoids passing untrusted data to file-type. */
function hasValidImageMagic(buf, ext) {
  if (!buf || buf.length < 8) return false;
  if (ext === "png") {
    return buf.subarray(0, 8).equals(PNG_MAGIC);
  }
  return buf.subarray(0, 3).equals(JPEG_MAGIC);
}

export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    if (record.s3?.bucket?.name == null || record.s3?.object?.key == null) continue;
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    if (!isImageKey(key) || !isContextPath(key)) {
      console.log("Skip (not image or wrong path):", key);
      continue;
    }

    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key })
      );
      const contentLength = head.ContentLength ?? 0;
      if (head.Metadata?.["x-optimized"] === "true" && contentLength < MAX_OPTIMIZED_SIZE) {
        console.log("Skip (already optimized):", key, `(${(contentLength / 1024).toFixed(0)}KB)`);
        continue;
      }

      const { Body, ContentType } = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const buf = await streamToBuffer(Body);
      const ext = key.split(".").pop()?.toLowerCase() ?? "";

      if (!hasValidImageMagic(buf, ext)) {
        console.log("Skip (invalid magic bytes, not JPEG/PNG):", key);
        continue;
      }

      const image = await Jimp.fromBuffer(buf);
      const { width, height } = image.bitmap;
      const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

      if (needsResize) {
        image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
      }

      let outputBuf;
      let outputContentType = ContentType ?? "image/jpeg";

      if (ext === "png") {
        outputBuf = await image.getBuffer("image/png", { deflateLevel: 9 });
      } else {
        outputBuf = await image.getBuffer("image/jpeg", { quality: JPEG_QUALITY });
        outputContentType = "image/jpeg";
      }

      if (outputBuf.length >= buf.length) {
        console.log("Skip (output not smaller):", key, `${(buf.length / 1024).toFixed(1)}KB -> ${(outputBuf.length / 1024).toFixed(1)}KB`);
        continue;
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: outputBuf,
          ContentType: outputContentType,
          Metadata: { "x-optimized": "true" },
        })
      );

      const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
      if (distributionId?.trim()) {
        try {
          const path = `/${key}`;
          await cloudfront.send(
            new CreateInvalidationCommand({
              DistributionId: distributionId.trim(),
              InvalidationBatch: {
                CallerReference: `opt-${Date.now()}-${key.replace(/[/\\]/g, "-").slice(-50)}`,
                Paths: { Quantity: 1, Items: [path] },
              },
            })
          );
          console.log("Invalidated CloudFront cache for", path);
        } catch (invErr) {
          console.warn("CloudFront invalidation failed (cache may serve stale):", invErr);
        }
      }

      const origSize = buf.length;
      const newSize = outputBuf.length;
      console.log(`Optimized ${key}: ${(origSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB`);
    } catch (err) {
      console.error("Error processing", key, err);
    }
  }
};

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (ch) => chunks.push(ch));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
