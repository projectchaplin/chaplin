# Chaplin Native

The iOS, Android, and web-capable native client for Project Chaplin. It is an
isolated Expo SDK 57 application and does not import the Next.js UI.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `EXPO_PUBLIC_API_URL` to the reachable Chaplin web server origin.
   Physical phones cannot use the PC's `localhost`; use the machine's LAN IP.
3. Copy the public Supabase URL and anonymous key into the two
   `EXPO_PUBLIC_SUPABASE_*` values. Never put provider or service-role keys in
   this folder.
4. Run `npm install`, then `npm start`.
5. Open in Expo Go first. Use an EAS development build when testing signed
   distribution or native configuration.

## Checks

```bash
npm run typecheck
npm run lint
npx expo export --platform all --output-dir dist-check
```

## App structure

- `src/app`: routes only.
- `src/screens`: Studio, actor, Spark, production, Library, and account screens.
- `src/components`: reusable native UI.
- `src/lib`: Supabase session storage and authenticated API client.
- `../src/app/api/v1/mobile`: additive mobile backend contracts.

The first complete workflow is actor creation → Magic Character → Spark writing
→ voice lock → identity frame → five-second video → Library/share.
