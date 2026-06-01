import '@testing-library/jest-dom/vitest'
import { loadEnv } from 'vite'

// Load .env.test for integration tests
const envVars = loadEnv('test', process.cwd(), '')
Object.assign(process.env, envVars)

// Set a deterministic 64-char hex key for crypto tests in Plan 03.
// Real production key is generated via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
process.env.OAUTH_ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY ?? 'a'.repeat(64)
