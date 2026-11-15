# Security

## What the app does

- **Sign-in**
  - Passwords are stored only as bcrypt hashes.
  - There are no built-in or fallback accounts.
  - An unknown email and a wrong password get the same answer in the same time.
- **Brute-force protection**
  - 10 failed sign-ins per account per 15 minutes per IP, and 30 per IP overall.
  - The whole API is limited to 300 requests per minute per IP.
- **Sessions**
  - Tokens are signed with `JWT_SECRET` (HS256 only) and last 8 hours.
  - Every request re-checks the account in the database, so the role always comes from the database.
  - A deleted account stops working on its next request.
  - Changing a password signs out every other device.
- **Passwords**
  - At least 12 characters, not a common pattern, and not containing the username.
  - Users change their own with the key icon in the header.
- **TV board**
  - Opens either for a signed-in user or with the secret screen link (`/board?key=…`).
  - An admin copies the link with **Copy TV screen link** in the menu.
  - The board shows no money fields.
- **Requests and uploads**
  - JSON bodies are capped at 100 KB.
  - Imports accept only `.xlsx` files up to 10 MB.
  - Every input is validated.
- **Headers**
  - Security headers come from helmet.
  - API responses are never cached.
  - Pages never send their URL to other sites.

## Managing accounts

```bash
# Set an account's password (typed hidden) and sign it out everywhere
npm run user:set-password -w backend -- planner@demo.local

# Generate a value for JWT_SECRET or BOARD_ACCESS_KEY
npm run secret -w backend
```

- **New TV link:** to revoke a TV link that has leaked, put a new `BOARD_ACCESS_KEY` in `backend/.env` and restart the backend.
- **Sign everyone out:** to sign out every account at once, change `JWT_SECRET` and restart the backend.

## Deployment checklist

- [ ] HTTPS only. Render provides it, so never serve the app over plain HTTP.
- [ ] Set `NODE_ENV=production`. The backend then refuses to start with a weak `JWT_SECRET`.
- [ ] Set `TRUST_PROXY=1` behind Render or another proxy.
- [ ] Set `CORS_ORIGIN` to the real frontend address only.
- [ ] Use a long random `JWT_SECRET` and `BOARD_ACCESS_KEY` (`render.yaml` generates both).
- [ ] Every account has its own strong password; none still has the password it was created with.
- [ ] MongoDB Atlas:
  - [ ] **Network Access:** allow only the server's outbound IPs. Remove `0.0.0.0/0`.
  - [ ] The app's database user has *readWrite* on `job_lifecycle` only, not *atlasAdmin*.
  - [ ] The database password is long and random. Rotate it if it was ever shared.
  - [ ] Backups or Cloud Backup are turned on, and a restore has been tried once.
  - [ ] Turn on two-factor sign-in for every Atlas and Render account.
- [ ] Keep the GitHub repository private. `.env` is git-ignored and must stay that way.
- [ ] Run `npm audit --omit=dev` now and then, and update packages.

## Known, accepted advisories

These cannot be fixed without a major-version upgrade, and none of them can be reached in this app:

- **zod** (memory use on huge arrays): bodies are capped at 100 KB and arrays have explicit maximums.
- **react-router** (open redirect via `<Link>`/`navigate`): the app only navigates to fixed paths and server-issued ids. It does no server-side rendering.
- **uuid via exceljs** (buffer bounds in v3/v5/v6): exceljs doesn't call the affected functions.
