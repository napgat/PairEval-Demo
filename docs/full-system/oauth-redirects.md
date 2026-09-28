# PairEval OAuth redirect contract (Day 1)

The Full System API draft selects `GET /api/auth/oidc/start` and **`GET /api/auth/oidc/callback`**. No OAuth route has been implemented yet; the SQLite Demo still uses its account picker.

| Environment | Authorized JavaScript origin | Exact redirect URI | Client |
|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/oidc/callback` | Google Cloud `PairEval` project's `PairEval Local` web client; origin and redirect verified in console. |
| Staging | `https://paireval-full-staging.vercel.app` | `https://paireval-full-staging.vercel.app/api/auth/oidc/callback` | Dedicated staging web client still to be created and registered. |

The local redirect value is in ignored `.env.local`; its client secret is not available and remains unset. The staging redirect value is stored as a Vercel Production environment variable on the dedicated staging project. The staging client ID and secret are **not** configured, so OAuth cannot be tested yet. Only placeholder variable names and the non-secret local URI are committed in `.env.example`.

The existing Google client named `PairEval Web` includes a redirect to the Lab deployment. Do not reuse its credentials or attach that redirect to this staging deployment. After a dedicated staging client is created, store its client ID and secret in Vercel Environment Variables, confirm the exact URI in Google Cloud, redeploy, then implement and test authorization code + PKCE, state/nonce, token verification, logout, session scope, and role authorization under the PRD IDs. Do not claim an OAuth pass from configuration alone.
