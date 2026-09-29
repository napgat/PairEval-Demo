# PairEval OAuth redirect contract (Day 1)

The Full System API draft selects `GET /api/auth/oidc/start` and **`GET /api/auth/oidc/callback`**. Day 2 added both routes with authorization-code/PKCE, state/nonce, ID-token verification and a 12-hour server session. Live Google login is still untested; the SQLite Demo still uses its account picker.

| Environment | Authorized JavaScript origin | Exact redirect URI | Client |
|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/oidc/callback` | Google Cloud `PairEval` project's `PairEval Local` web client; origin and redirect verified in console. |
| Staging | Not required by the server-side authorization-code flow; no staging JavaScript origin is configured. | `https://paireval-full-staging.vercel.app/api/auth/oidc/callback` | Google Cloud `PairEval` project's dedicated `PairEval Staging` web client; redirect verified in console on 29 September 2026. |

The local redirect value is in ignored `.env.local`; its client secret is unconfirmed. The staging redirect value and the names `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` were verified in Vercel Production Environment Variables for the dedicated staging project. Their values were not opened or printed. The redeployment after the variables were added was Ready. Clicking staging's Google sign-in link reached Google Account Chooser with the dedicated staging client and exact staging callback; no account was selected, so the callback and session remain untested. Only placeholder variable names and the non-secret local URI are committed in `.env.example`.

The existing Google client named `PairEval Web` includes a redirect to the Lab deployment. Do not reuse its credentials or attach that redirect to this staging deployment. The dedicated `PairEval Staging` client now has both the localhost and staging callbacks, and Google Cloud showed “OAuth client saved” after the staging URI was added. Test authorization code + PKCE, state/nonce, token/domain rejection, logout, session scope, and role authorization under the PRD IDs before claiming OAuth acceptance. Do not claim an OAuth pass from implementation or configuration alone.
