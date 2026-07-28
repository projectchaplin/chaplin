# Chaplin public-launch security

Chaplin treats browser state, route parameters, Supabase user metadata, uploaded
filenames, MIME declarations, and client-supplied owner IDs as untrusted.
Authorization decisions are made on the server from a verified Supabase access
token and database ownership records.

## Enforced controls

- Super Admin is granted only when the verified account email exactly matches
  `SUPER_ADMIN_EMAIL`. Editable Supabase `user_metadata` never grants a role.
- Creator, series, product, character-media, pipeline, generation, mix, and
  assembly mutations verify account ownership before using the service-role
  client.
- Browser mutations reject cross-site origins. Native bearer-token requests
  remain supported.
- Authentication, writing, generation, upload, pipeline, interaction, feed, and
  Concierge operations use persistent atomic rate limits in Supabase.
- Uploads have byte ceilings, an allow-listed image MIME type, and matching
  PNG/JPEG/WebP file signatures.
- Creator credits are changed through atomic, idempotent database functions.
  The welcome grant also requires a server-created signup entitlement, so
  accounts created by calling Supabase Auth directly receive no free credits.
  Allowed production durations cost five credits per second; mismatched
  format/duration requests are rejected.
- Authentication redirects are restricted to local paths, login failures do
  not disclose whether an account exists, and production email confirmation is
  not bypassed.
- Global response headers block framing and MIME sniffing, restrict browser
  capabilities, limit referrer data, and enable HSTS in production.

## Required production configuration

- Keep `AUTH_AUTO_CONFIRM=false`.
- Use a unique, strong `SUPER_ADMIN_PASSWORD` and keep the Super Admin email
  private.
- Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production origin.
- Set `RATE_LIMIT_SALT` to a long random value. If absent, the server-only
  Supabase service-role key is used as the fingerprinting secret.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, provider keys, and the database connection
  string server-only. Never prefix them with `NEXT_PUBLIC_`.
- Enable Supabase email confirmation, leaked-password protection, CAPTCHA/bot
  protection, and MFA for the Super Admin account in the Supabase dashboard.
- Put provider billing alerts and hard spend ceilings in place. Application
  throttles reduce abuse but do not replace provider-side limits.

## Operational response

If abuse is suspected, disable the affected provider stage in Super Admin,
rotate exposed credentials, review generation and authentication logs, revoke
affected Supabase sessions, and preserve relevant request metadata before
cleaning up accounts or assets.
