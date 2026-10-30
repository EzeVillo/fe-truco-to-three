import { writeFile } from 'node:fs/promises';

// The hub removes /truco-a-3/ before requesting this asset service.
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
