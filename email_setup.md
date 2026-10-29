# FindShopEasily – Merchant Email Setup Guide (Nodemailer & SMTP)

This guide walks you through setting up and configuring the automated merchant onboarding email system in FindShopEasily.

When a Super Admin registers a store via the Super Admin Portal, the backend:
1. Automatically creates a `shop_admin` user account.
2. Generates a secure, human-readable temporary password (e.g. `Shop@A8K2mn4P`).
3. Sends a branded welcome email to the merchant with:
   - Store details
   - Merchant Portal Login URL
   - Registered login email & temporary password
   - **Crucial security prompt**: Instructions to log in and immediately reset their password in Account Settings.

---

## 1. Environment Variables Overview

Add or update the following settings in your backend environment file:
* Local development: `backend/.env` or `backend/.env.local`
* Production: `backend/.env.production`

```dotenv
# ==============================================================================
# Mail / SMTP Configuration (Nodemailer)
# ==============================================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_app_password
SMTP_FROM="FindShopEasily <your_email@gmail.com>"

# Merchant Portal Base URL (included in onboarding welcome email)
# Local: http://localhost:3000 | Production: https://admin.findshopeasily.com
SHOP_ADMIN_URL=http://localhost:3000
```

---

## 2. Setting Up Gmail SMTP (Recommended for Quick Setup)

Google requires an **App Password** (16-character dedicated key) for third-party applications like Node.js / Nodemailer. You cannot use your regular Gmail account login password.

### Step 1: Enable 2-Step Verification
1. Open your Google Account Security Dashboard: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Scroll to **How you sign in to Google**.
3. Ensure **2-Step Verification** is turned **ON**. (Google requires 2FA to create App Passwords).

### Step 2: Generate a 16-Character App Password
1. In the top search bar of your Google Account page, search for **"App passwords"** (or open directly: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
2. Under **App name**, enter: `FindShopEasily`
3. Click **Create**.
4. A modal will pop up with a 16-character yellow box code (e.g. `abcd efgh ijkl mnop`).
5. Copy this 16-character code.

### Step 3: Put Credentials into `.env`
Open `backend/.env` (and `backend/.env.production` if deploying) and fill in:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_exact_gmail_address@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="FindShopEasily <your_exact_gmail_address@gmail.com>"
SHOP_ADMIN_URL=http://localhost:3000
```

> **Note on `SMTP_FROM`:** Gmail requires the email address inside `<...>` to match your `SMTP_USER` address. You can customize the display name in quotes (e.g. `"FindShopEasily Support"`).

---

## 3. Alternative SMTP Providers

If you prefer using dedicated transactional email services (e.g., Brevo, Amazon SES, SendGrid, Hostinger):

### Option A: Brevo (Formerly Sendinblue) - Free 300 emails/day
```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_login_email
SMTP_PASS=your_brevo_smtp_master_key
SMTP_FROM="FindShopEasily <no-reply@yourdomain.com>"
```

### Option B: Amazon SES
```dotenv
SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_SES_SMTP_USERNAME
SMTP_PASS=YOUR_SES_SMTP_PASSWORD
SMTP_FROM="FindShopEasily <no-reply@yourverifieddomain.com>"
```

### Option C: Custom Domain / cPanel / Hostinger
```dotenv
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@yourdomain.com
SMTP_PASS=your_mailbox_password
SMTP_FROM="FindShopEasily <support@yourdomain.com>"
```

---

## 4. Development & Simulated Mode (Zero Crashing)

If `SMTP_USER` or `SMTP_PASS` are left empty (or if credentials have not been configured yet):
* The backend **will NOT crash** and the shop creation request **will NOT fail**.
* The email service automatically switches to **Simulated Mode** and prints a formatted card in your terminal:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [FindShopEasily Mailer] SIMULATED WELCOME EMAIL (SMTP Not Configured)  │
├────────────────────────────────────────────────────────────────────────┤
│ To:           merchant@example.com
│ Owner Name:   Ramesh Sharma
│ Shop Name:    Sharma Kirana & General Store
│ Portal URL:   http://localhost:3000
│ Temporary PW: Shop@X8K2mn4P
│ Security:     Advise merchant to reset password after first login.
├────────────────────────────────────────────────────────────────────────┤
│ Note: Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env       │
│ to enable real email delivery.                                         │
└────────────────────────────────────────────────────────────────────────┘
```

Furthermore, the Super Admin creation modal displays the generated temporary credentials with a **one-click copy button** so administrators can share the login details with merchants directly if needed.

---

## 5. Verification & Testing

1. Start the FindShopEasily stack:
   ```bash
   npm run dev:prod
   # or ./launch.sh prod
   ```
2. Open Super Admin portal: [http://localhost:3001](http://localhost:3001)
3. Navigate to **Shops** -> Click **+ Register Shop**.
4. Fill in:
   - Store Name
   - Owner Name
   - Owner Email (use your own personal email to test live delivery)
   - Phone & Address
5. Click **Create Store**.
6. Check your inbox for the branded welcome email:
   - Verify the Store Name and Login Credentials.
   - Verify the password reset security notice.
   - Click the Login button and sign into Shop Admin ([http://localhost:3000](http://localhost:3000)).

---

## 6. Troubleshooting Common Issues

| Error | Root Cause | Solution |
| :--- | :--- | :--- |
| `535-5.7.8 Username and Password not accepted` | Using standard Google password instead of 16-character App Password. | Generate an App Password at `myaccount.google.com/apppasswords`. |
| `ETIMEDOUT` or `ECONNREFUSED` | Blocked port or incorrect secure flag. | Use `SMTP_PORT=587` with `SMTP_SECURE=false`, or `SMTP_PORT=465` with `SMTP_SECURE=true`. |
| Sender mismatch warning | Gmail requires sender address to match `SMTP_USER`. | Make sure `SMTP_FROM="Name <same_email_as_smtp_user>"` |
| Email marked as Spam | Missing SPF/DKIM (for custom domains). | If using custom domain, add SPF (`v=spf1 include:... ~all`) and DKIM TXT records in your DNS. |
