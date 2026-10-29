import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendMerchantWelcomeInput {
  to: string;
  ownerName: string;
  shopName: string;
  tempPassword: string;
  loginUrl?: string;
}

export interface EmailSendResult {
  success: boolean;
  delivered: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass,
          },
          // Pool connections for higher throughput
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        });
        this.isConfigured = true;
      } catch (err) {
        console.error("[EmailService] Failed to initialize SMTP transporter:", err);
        this.transporter = null;
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      this.transporter = null;
    }
  }

  /**
   * Dispatches a welcome email to the merchant with store details, portal login credentials,
   * and a prominent instruction to reset their temporary password after initial login.
   */
  async sendMerchantWelcomeEmail(data: SendMerchantWelcomeInput): Promise<EmailSendResult> {
    const { to, ownerName, shopName, tempPassword } = data;
    const loginUrl =
      data.loginUrl ||
      process.env.SHOP_ADMIN_URL ||
      "http://localhost:3000";

    const fromAddress =
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER
        ? `"FindShopEasily" <${process.env.SMTP_USER}>`
        : '"FindShopEasily" <no-reply@findshopeasily.com>');

    if (!this.isConfigured || !this.transporter) {
      this.initTransporter();
    }

    // If SMTP is not configured, log credentials in a readable format for dev/staging
    if (!this.isConfigured || !this.transporter) {
      console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│ [FindShopEasily Mailer] SIMULATED WELCOME EMAIL (SMTP Not Configured)  │
├────────────────────────────────────────────────────────────────────────┤
│ To:           ${to}
│ Owner Name:   ${ownerName}
│ Shop Name:    ${shopName}
│ Portal URL:   ${loginUrl}
│ Temporary PW: ${tempPassword}
│ Security:     Advise merchant to reset password after first login.
├────────────────────────────────────────────────────────────────────────┤
│ Note: Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env       │
│ to enable real email delivery.                                         │
└────────────────────────────────────────────────────────────────────────┘
      `);

      return {
        success: true,
        delivered: false,
        simulated: true,
      };
    }

    const subject = `Welcome to FindShopEasily! Your store "${shopName}" is ready`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F9F5F0;
      color: #1F2937;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #F9F5F0;
      padding: 32px 12px;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 20px;
      border: 1px solid #E8E1D5;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(52, 79, 31, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #344F1F 0%, #243815 100%);
      padding: 32px 28px;
      text-align: center;
      color: #FFFFFF;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      color: #D3E2C4;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #374151;
    }
    .store-badge {
      display: inline-block;
      background: #E8F0E3;
      color: #344F1F;
      font-weight: 700;
      font-size: 14px;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    .credentials-box {
      background: #F8F9FA;
      border: 1.5px dashed #CBD5E1;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .credentials-box h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4B5563;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
      font-size: 14px;
    }
    .cred-row:last-child {
      border-bottom: none;
    }
    .cred-label {
      color: #6B7280;
      font-weight: 500;
    }
    .cred-value {
      font-family: 'Courier New', Courier, monospace;
      font-weight: 700;
      color: #111827;
      background: #E2E8F0;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .security-notice {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
      color: #92400E;
    }
    .security-notice strong {
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .security-notice p {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .cta-button {
      display: inline-block;
      background: #344F1F;
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(52, 79, 31, 0.25);
    }
    .steps-list {
      margin: 20px 0;
      padding-left: 20px;
      font-size: 13px;
      color: #4B5563;
    }
    .steps-list li {
      margin-bottom: 8px;
    }
    .footer {
      background: #F3EFEA;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #6B7280;
      border-top: 1px solid #E8E1D5;
    }
    .footer a {
      color: #344F1F;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>FindShopEasily</h1>
        <p>Merchant Partner Program</p>
      </div>

      <div class="content">
        <div class="greeting">
          Hello <strong>${ownerName}</strong>,
        </div>

        <p>
          Welcome to <strong>FindShopEasily</strong>! Your retail store has been registered on our hyper-local marketplace platform.
        </p>

        <div>
          <span class="store-badge">🏪 Store: ${shopName}</span>
        </div>

        <div class="credentials-box">
          <h3>Your Shopkeeper Portal Credentials</h3>
          <div class="cred-row">
            <span class="cred-label">Login Portal:</span>
            <a href="${loginUrl}" style="color: #344F1F; font-weight: 600; text-decoration: underline;">${loginUrl}</a>
          </div>
          <div class="cred-row">
            <span class="cred-label">Login Email:</span>
            <span class="cred-value">${to}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Temporary Password:</span>
            <span class="cred-value">${tempPassword}</span>
          </div>
        </div>

        <div class="security-notice">
          <strong>⚠️ Security Action Required: Reset Your Password</strong>
          <p>
            This temporary password was generated automatically for your initial access. For the security of your store and customer data, please log in and <strong>immediately change your password</strong> in your store profile settings.
          </p>
        </div>

        <div class="cta-container">
          <a href="${loginUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
            Log In to Merchant Portal &rarr;
          </a>
        </div>

        <h4 style="margin: 24px 0 8px 0; font-size: 14px; color: #1F2937;">Next Steps to Launch Your Store:</h4>
        <ol class="steps-list">
          <li><strong>Sign in</strong> using the credentials above.</li>
          <li><strong>Change your password</strong> to a private, strong password.</li>
          <li><strong>Update Store Timings & Details</strong> (opening/closing hours, amenities).</li>
          <li><strong>Add Products</strong> with images, prices, and stock to appear on customer searches.</li>
        </ol>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px 0;">Need assistance? Contact our merchant support desk at <a href="mailto:support@findshopeasily.com">support@findshopeasily.com</a></p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} FindShopEasily. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Welcome to FindShopEasily!

Hello ${ownerName},

Your retail store "${shopName}" is now registered on FindShopEasily.

Here are your Shopkeeper Portal credentials:
--------------------------------------------------
Portal URL:         ${loginUrl}
Login Email:        ${to}
Temporary Password: ${tempPassword}
--------------------------------------------------

⚠️ IMPORTANT SECURITY RECOMMENDATION:
This is an automatically generated temporary password. For the security of your store, please log in immediately and reset your password under Account Settings.

Next Steps:
1. Log in to your merchant portal at ${loginUrl}
2. Reset your password
3. Update your shop timings, amenities, and catalog products

Need help? Contact support@findshopeasily.com

Best regards,
The FindShopEasily Team
    `.trim();

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] Merchant welcome email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return {
        success: true,
        delivered: true,
        simulated: false,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[EmailService] Error sending welcome email to ${to}:`, errorMessage);
      return {
        success: false,
        delivered: false,
        simulated: false,
        error: errorMessage,
      };
    }
  }
}

export const emailService = new EmailService();
