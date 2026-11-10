# Haseeb Mirza Mess Management System

Monthly meal-subscription mess app (Ajman, UAE). Google Sheet = database, Google Apps Script = backend, `index.html` = app.
© 2026 Haseeb Mirza. All Rights Reserved. Contact: +971 50 725 6801

## Files
- `index.html` - the app (hosted free on GitHub Pages; file name must stay `index.html`)
- `apps-script/Code.gs` - backend, paste into the Google Sheet's Apps Script
- `database/Mess_Management_Template.xlsx` - empty database template (upload to Google Drive, open as Google Sheet)

## Setup (one restaurant = one Sheet + one script)
1. Upload `Mess_Management_Template.xlsx` to Google Drive, open it, File > Save as Google Sheets. Set File > Settings > Time zone to Dubai.
2. In the Sheet: Extensions > Apps Script. Paste `Code.gs`, save.
3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the Web app URL (ends with `/exec`).
4. Host on GitHub Pages: repo Settings > Pages > Source: Deploy from a branch > `main` / `(root)` > Save. Open `https://YOUR-USERNAME.github.io/REPO-NAME/`, then paste the Web app URL in the box under the login, tap Save connection, then Login.
5. Password is OFF for now. To turn on: `REQUIRE_PASSWORD = true` in `Code.gs`, `NEED_PW = true` in `index.html`, and add script property `APP_PASSWORD`.

## Security
Never commit passwords, keys or Web app URLs of real client data. Share each Sheet only with its owner.
