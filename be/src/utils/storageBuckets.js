import { supabaseAdmin } from '../config/supabase.js';

const ensured = new Set();

/**
 * Ensure a public Supabase Storage bucket exists (service role).
 * Buckets used by this app: receipts, proofs, qrcodes
 */
export async function ensurePublicBucket(bucketId) {
  if (ensured.has(bucketId)) return;

  const { error } = await supabaseAdmin.storage.createBucket(bucketId, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      throw new Error(`Storage bucket "${bucketId}" missing: ${error.message}`);
    }
    if (buckets?.some((b) => b.name === bucketId || b.id === bucketId)) {
      ensured.add(bucketId);
      return;
    }
    throw new Error(`Storage bucket "${bucketId}" missing: ${error.message}`);
  }

  ensured.add(bucketId);
}
