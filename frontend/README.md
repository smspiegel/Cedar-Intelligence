# Cedar Intelligence frontend

Expo client for listing monitors and dispatching runs through Cedar's versioned API.

## Development

```bash
npm install
cp .env.example .env.local
npm run web
```

For local development, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_DEV_API_TOKEN` in `.env.local`. The latter is intentionally read only while `__DEV__` is true; production builds use user JWTs and must not contain an API token.

## Static build

```bash
npm run build
```

The generated site is written to `dist/`.

## Render settings

The repository-root [`render.yaml`](../render.yaml) defines this static site as `cedar-web`. Set only `EXPO_PUBLIC_API_URL` on that service; it is a public build-time value.
