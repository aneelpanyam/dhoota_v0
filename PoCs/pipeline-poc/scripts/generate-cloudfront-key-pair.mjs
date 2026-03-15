#!/usr/bin/env node
/**
 * Generates an RSA key pair for CloudFront signed URLs.
 * Works on Windows, macOS, and Linux (no OpenSSL required).
 *
 * Usage: node scripts/generate-cloudfront-key-pair.mjs
 *
 * Output:
 * - public_key.pem — paste into CloudFront "Create public key"
 * - private_key.pem — add to AWS_CLOUDFRONT_PRIVATE_KEY (keep secret, add to .gitignore)
 */

import { generateKeyPairSync, createPrivateKey, createPublicKey } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
});

// CloudFront expects PKCS#1 for the public key; spki works but let's ensure compatibility
const priv = createPrivateKey(privateKey);
const pub = createPublicKey(priv);
const publicPem = pub.export({ type: "spki", format: "pem" });

const outDir = dirname(fileURLToPath(import.meta.url));
const publicPath = join(outDir, "public_key.pem");
const privatePath = join(outDir, "private_key.pem");

writeFileSync(publicPath, publicPem);
writeFileSync(privatePath, privateKey);

console.log("Key pair generated:\n");
console.log("  public_key.pem  — Paste into CloudFront 'Create public key' form");
console.log("  private_key.pem — Add to AWS_CLOUDFRONT_PRIVATE_KEY in .env.local\n");
console.log("Add scripts/private_key.pem to .gitignore and delete it after adding to env.\n");
console.log("Public key (first 80 chars):", publicPem.split("\n").slice(1, 3).join(" ").slice(0, 80) + "...");
