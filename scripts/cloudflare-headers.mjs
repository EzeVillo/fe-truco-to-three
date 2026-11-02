import { writeFile } from 'node:fs/promises';

// This service owns the root of truco.ezevillo.com.
await writeFile(
  new URL('../dist/cloudflare/_headers', import.meta.url),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: public, max-age=0, must-revalidate
`,
);
