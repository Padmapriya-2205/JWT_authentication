# Authentication demo

A small React + Vite frontend and NestJS + MongoDB API for practicing user
registration, password verification, JWT access tokens, and rotating refresh
tokens.

JWT Authentication implemented from scratch to understand better
## Requirements

- Node.js 20 or newer
- MongoDB running locally, or a MongoDB connection string

## Setup

1. Copy the example environment file to the active environment file:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

2. Set `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` in
   `backend\.env`. Use different, randomly generated secrets of at least 32
   characters. Nest loads `backend\.env`; `.env.example` is only a template.
3. Install dependencies from the project root:

   ```sh
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```

4. Start the API and frontend:

   ```sh
   npm run dev
   ```

5. Open <http://localhost:5173>.

The backend listens on port 3000. The Vite development server proxies `/api`
requests to it.

## Authentication flow

- Sign-up stores the username, display name, phone number, a bcrypt-hashed
  password, and a server-assigned `user` role.
- Sign-in verifies the password with bcrypt and issues a 15-minute access JWT
  and a 7-day refresh JWT.
- The refresh JWT is stored as a bcrypt hash in MongoDB. Refreshing rotates the
  token; a token that has already been used cannot refresh again.
- The profile endpoint requires a valid access token. The frontend tries the
  refresh endpoint once if the access token has expired.
- The **Get profile** dashboard tab calls `GET /api/auth/me` with the access
  token in the `Authorization: Bearer ...` header and displays the profile
  returned by that protected endpoint. If that request returns `401`, the UI
  sends the refresh token in the JSON body of `POST /api/auth/refresh`. The API
  verifies the refresh JWT and compares it with the bcrypt hash stored for that
  user before rotating the stored hash. The UI then retries the profile request
  with the new access token.
- **Rotate refresh token** manually tests that refresh flow without waiting for
  the 15-minute access-token expiry. A refresh token is single-use; after
  rotation, the old token is no longer accepted. The dashboard shows an
  activity trace and decoded token claims for learning; decoded claims are not
  proof of validity, and the backend never logs raw token values.
- The dashboard displays the user profile, role, access token, and refresh
  token for learning purposes. Tokens stay in page memory and are lost on
  reload.

Passwords do not use a separate secret key: bcrypt generates a unique salt as
part of its hash. JWT signing secrets are separate and must be kept out of
source control. This is an educational example; a production application
should keep refresh tokens in secure, HttpOnly cookies and add additional
controls such as rate limiting, HTTPS, and account recovery.
