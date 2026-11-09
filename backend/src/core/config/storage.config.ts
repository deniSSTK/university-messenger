import { readPositiveInteger } from './environment.js';
type StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  signedUrlTtl: number;
};
function readStorageConfig(): StorageConfig {
  const bucket =
    process.env.S3_BUCKET ??
    (process.env.NODE_ENV === 'production' ? '' : 'messenger-local');
  const region = process.env.S3_REGION ?? 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const pathStyle = process.env.S3_FORCE_PATH_STYLE ?? 'false';
  const signedUrlTtl =
    process.env.S3_SIGNED_URL_TTL_SECONDS === undefined
      ? 900
      : readPositiveInteger('S3_SIGNED_URL_TTL_SECONDS');

  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket.includes('..')
  ) {
    throw new Error('S3_BUCKET must be a valid bucket name');
  }

  if (
    !/^[a-z0-9-]+$/.test(region) ||
    !['true', 'false'].includes(pathStyle) ||
    signedUrlTtl > 3600
  ) {
    throw new Error(
      'Invalid S3 region, path style or signed URL lifetime (1–3600 seconds)',
    );
  }

  if (endpoint) {
    const url = new URL(endpoint);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      throw new Error(
        'S3_ENDPOINT must be an HTTP(S) endpoint without credentials (HTTPS in production)',
      );
    }
  }

  return {
    bucket,
    region,
    endpoint,
    forcePathStyle: pathStyle === 'true',
    signedUrlTtl,
  };
}

export { readStorageConfig };
export type { StorageConfig };
