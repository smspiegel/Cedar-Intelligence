# Cedar Intelligence frontend

Expo client for listing monitors and dispatching runs through Cedar's versioned API.

## Development

```bash
npm install
cp .env.example .env.local
npm run web
```

For local development, set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` in `.env.local`. The Clerk key is public by design; never add a Clerk secret key to the Expo app. The temporary `EXPO_PUBLIC_DEV_API_TOKEN` escape hatch is read only while `__DEV__` is true.

The app requires a signed-in Clerk session. On web it uses Clerk's hosted React components; iOS and Android use Clerk's native auth view in a development or production build. Enable the Native API in the Clerk Dashboard before testing a native build.

## Static build

```bash
npm run build
```

The generated site is written to `dist/`.

## Render settings

The repository-root [`render.yaml`](../render.yaml) defines this static site as `cedar-web`. Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` on that service; both are public build-time values.
