export interface DefaultLegalDoc {
  id: string;
  title: string;
  version: string;
  content: string;
}

export const DEFAULT_LEGAL_DOCS: Record<string, DefaultLegalDoc> = {
  "privacy-policy": {
    id: "privacy-policy",
    title: "FindShopEasily Privacy Policy",
    version: "1.0.0",
    content: `# Privacy Policy for FindShopEasily

**Last Updated:** October 2026  
**Effective Date:** October 23, 2026  
**Developer:** Sagar Patidar (FindShopEasily Team)  
**Registered Operations:** Betul, Madhya Pradesh 460001, India  
**Official Contact:** support@findshopeasily.com | +91 98260 12345  

---

## 1. Introduction
Welcome to **FindShopEasily** ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you have a secure experience when discovering local physical retail stores, counters, and in-store discounts in Betul and nearby regions.

This Privacy Policy explains how we collect, use, disclose, and safeguard your personal data when you use the FindShopEasily mobile application, website, and related merchant platform services.

---

## 2. Information We Collect
We collect only the minimum data required to deliver direct local shopping discovery:

### A. Location Data (Foreground Device GPS)
* **What we collect:** Approximate location (\`ACCESS_COARSE_LOCATION\`) and precise location (\`ACCESS_FINE_LOCATION\`).
* **Purpose:** To calculate walking/driving distances to local Betul stores and sort nearby deals by proximity.
* **Important Disclosure:** We collect location **only while the application is in active foreground use**. We do **NOT** track your background location when the app is closed, and we do **NOT** sell or trade your coordinate history to data brokers or advertising networks.

### B. Account & Profile Information
* **Registration details:** Name, email address, mobile phone number, and optional avatar image.
* **Purpose:** To authenticate your account, allow review publishing, manage your wishlist, and secure your saved preferences.

### C. Device Permissions & Hardware Access
* **Camera (\`CAMERA\`):** Optional. Used only when you choose to scan a physical merchant's in-store QR code or take a picture for a store review.
* **Photo Library / Storage:** Optional. Used only to upload user-selected photos for customer reviews.
* **Notifications (\`POST_NOTIFICATIONS\`):** Optional. Used strictly for store discount alerts and system service updates that you opt into.

### D. Automated Usage & Crash Diagnostics
* Basic device model, OS version, and app performance logs to diagnose app crashes and optimize screen responsiveness across devices.

---

## 3. How We Use Your Information
We use collected data solely for legitimate product functionality:
1. Presenting real-time distance calculations and directions to physical stores.
2. Enabling customer reviews, star ratings, and community feedback.
3. Synchronizing your saved stores and product bookmarks across devices.
4. Sending transactional alerts (e.g. password resets, security notifications).
5. Preventing fraud, spam reviews, or unauthorized access.

---

## 4. No Third-Party Ad Trackers or Data Selling
* **Zero Commercial Trackers:** FindShopEasily does not integrate third-party ad networks (like AdMob, Unity, or Facebook Audience Network) that track you across apps or websites.
* **No Selling of Personal Data:** We will never sell, rent, or monetize your personal phone numbers, emails, or location traces to advertisers.

---

## 5. Data Retention & Account Deletion Policy
In strict compliance with **Google Play Developer Policies** and the **Digital Personal Data Protection (DPDP) Act 2023**:

* **Account Deletion Inside App:** You can permanently delete your account and all associated profile data at any time directly in the mobile app by navigating to:  
  **Profile → Settings → Account Security → Delete Account & Data**.
* **Deletion via Email:** You may also email **support@findshopeasily.com** with the subject \`"Data Deletion Request"\` specifying your registered email or phone number.
* **Retention Timeline:** Upon deletion confirmation, your account credentials, reviews, and bookmarks will be purged from our active databases within 7 days, and fully purged from backup archives within 30 days.

---

## 6. Security of Your Information
We implement industry-standard security safeguards including TLS 1.3 encryption in transit, bcrypt-hashed passwords, and role-based administrative access controls hosted on hardened cloud servers.

---

## 7. Children's Privacy
FindShopEasily is not directed to children under 13 years of age. We do not knowingly collect personal identifiable information from children under 13. If you become aware that a child has provided us with personal information, please contact us immediately so we can remove the data.

---

## 8. Policy Updates & Contact
We may update this Privacy Policy from time to time. Any changes will be published in this document and updated inside the app.

For questions, grievances, or privacy requests, contact:
* **Privacy & Grievance Officer:** Sagar Patidar
* **Email:** support@findshopeasily.com
* **Address:** FindShopEasily Tech Labs, Betul, Madhya Pradesh 460001, India
`,
  },
  "terms-and-conditions": {
    id: "terms-and-conditions",
    title: "FindShopEasily Terms of Service",
    version: "1.0.0",
    content: `# Terms and Conditions of Service

**Last Updated:** October 2026  
**Effective Date:** October 23, 2026  
**Platform:** FindShopEasily (Mobile App, Website, and Merchant Portal)  
**Governing Jurisdiction:** Betul, Madhya Pradesh, India  

---

## 1. Acceptance of Terms
By downloading, browsing, or registering an account on FindShopEasily, you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these terms, please discontinue using the application immediately.

---

## 2. Description of Service
FindShopEasily is a local physical commerce discovery marketplace connecting customers with verified retail stores, showrooms, and service providers in Betul, Madhya Pradesh.

* FindShopEasily enables users to discover store addresses, contact details, product catalogs, ongoing in-store offers, and genuine customer reviews.
* **Walk-In Disclaimer:** Transactions, product payments, and warranty fulfillment occur in person between you and the respective retail store merchant unless explicitly marked otherwise.

---

## 3. User Accounts & Responsibilities
1. **Accurate Information:** You agree to provide true, accurate, and current information during registration.
2. **Account Security:** You are responsible for maintaining the confidentiality of your login credentials.
3. **Age Requirement:** You must be at least 13 years of age to register an account.

---

## 4. User Conduct & Community Guidelines
When using FindShopEasily, you agree NOT to:
* Submit false, defamatory, fraudulent, or malicious merchant reviews.
* Attempt to reverse engineer, decompile, scrape, or extract source code from the mobile application or backend APIs.
* Impersonate any merchant, business owner, or individual.
* Use the platform to promote illegal products, counterfeit goods, or unauthorized advertisements.

Violation of these guidelines will result in immediate suspension or permanent termination of your account without notice.

---

## 5. Merchant Content, Pricing & Availability
* Individual merchants and store owners are solely responsible for ensuring the accuracy of their listed product availability, specifications, MRP, and discount percentages.
* While FindShopEasily conducts verification audits of registered merchants, we cannot guarantee that an item is in stock at the physical counter at all hours. We encourage calling the store using the in-app phone action before traveling for urgent items.

---

## 6. Intellectual Property
All design systems, UI layouts, brand trademarks, logos, database schemas, and proprietary code in the FindShopEasily application and website are the intellectual property of FindShopEasily and its founders. Unauthorized reproduction or commercial distribution is strictly prohibited.

---

## 7. Limitation of Liability
To the fullest extent permitted by applicable law, FindShopEasily and its operators shall not be liable for any indirect, punitive, or consequential damages resulting from:
* Commercial disputes between buyers and merchants during in-store purchases.
* Temporary unavailability of the platform due to server maintenance or network outages.
* Third-party links or navigation maps provided for convenience.

---

## 8. Modifications to Terms
We reserve the right to revise or replace these Terms at any time. Continued use of the platform after changes are posted constitutes acceptance of the modified Terms.

---

## 9. Governing Law & Dispute Resolution
These Terms are governed by and construed in accordance with the laws of the Republic of India. Any legal dispute or proceeding arising out of or related to FindShopEasily shall be subject to the exclusive jurisdiction of the competent courts in **Betul, Madhya Pradesh, India**.

---

## 10. Contact Information
For any legal inquiries, merchant partnerships, or terms clarification:
* **Support Email:** support@findshopeasily.com
* **Helpline:** +91 98260 12345 (Mon–Sat, 10:00 AM – 8:00 PM IST)
* **Office:** FindShopEasily, Betul, Madhya Pradesh 460001, India
`,
  },
};
