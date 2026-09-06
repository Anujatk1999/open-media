# Security Policy

Shot Composer is a static, client-only web app: everything runs in the browser, there is no backend, no user accounts, and no server-side data storage. Saved poses, scenes, and motions are kept in the browser's `localStorage`, scoped to your own device — nothing is transmitted anywhere.

Given that scope, realistic report categories include:

- Cross-site scripting (XSS) or other injection issues in the app itself
- Vulnerable or malicious dependencies (`package.json`)
- Build/tooling issues that could affect anyone building or deploying this project

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the [Security tab](https://github.com/Anujatk1999/open-media/security) of this repository
2. Click **"Report a vulnerability"**
3. Describe the issue, steps to reproduce, and potential impact

If private reporting is unavailable, open a GitHub issue with minimal detail asking for a secure contact channel, and we'll follow up.

## Supported versions

This project is pre-1.0 and moves quickly. Security fixes are only made against the latest commit on `master` — there are no maintained older release branches.

## What to expect

This is an open-source side project maintained on a best-effort basis. There's no guaranteed response time, but valid reports will be triaged and fixed as soon as practical, and credited in the fix unless you ask otherwise.
