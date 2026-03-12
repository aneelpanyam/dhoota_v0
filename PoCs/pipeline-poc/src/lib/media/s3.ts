import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _s3Client;
}

export async function generatePresignedUploadUrl(
  tenantId: string,
  context: string,
  filename: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const fileId = crypto.randomUUID();
  const s3Key = `${tenantId}/${context}/${fileId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });

  return { uploadUrl, s3Key };
}

export async function generatePresignedReadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
}

export function getMediaUrl(s3Key: string): string {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${s3Key}`;
}
