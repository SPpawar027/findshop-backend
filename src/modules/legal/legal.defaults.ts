export interface DefaultLegalDoc {
  id: string;
  slug: string;
  title: string;
  version: string;
  content: string;
  contentHtml: string;
  lastUpdatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_LEGAL_DOCS: Record<string, DefaultLegalDoc> = {
  "privacy-policy": {
    id: "privacy-policy",
    slug: "privacy-policy",
    title: "FindShopEasily Privacy Policy",
    version: "1.0.0",
    lastUpdatedBy: "FindShopEasily Legal Team",
    updatedAt: "2026-10-23T00:00:00.000Z",
    content: `<h2>1. Introduction</h2>
<p>Welcome to <strong>FindShopEasily</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We connect consumers directly with local physical retail stores, counters, and in-store discounts in Betul, Madhya Pradesh and surrounding regions.</p>
<p>This Privacy Policy outlines our data practices in full compliance with the <strong>Google Play Developer Policies</strong> and India's <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>. Your privacy and trust are our top priorities.</p>

<h2>2. Data We Collect &amp; Why We Need It</h2>
<p>We collect only the minimum data required to deliver direct local shopping discovery:</p>

<h3>A. Precise &amp; Approximate Device Location</h3>
<ul>
  <li><strong>Permissions:</strong> <code>ACCESS_FINE_LOCATION</code> and <code>ACCESS_COARSE_LOCATION</code>.</li>
  <li><strong>Purpose:</strong> Used strictly while the application is in active <strong>foreground use</strong> to calculate real-time walking/driving distance to local retail stores in Betul and sort nearby deals by proximity.</li>
  <li><strong>Privacy Guarantee:</strong> We do <strong>NOT</strong> track location in the background when the app is closed, and we do <strong>NOT</strong> sell, trade, or share your coordinate history with data brokers or advertising networks.</li>
</ul>

<h3>B. Camera &amp; Photo Storage (Optional)</h3>
<ul>
  <li><strong>Permissions:</strong> <code>CAMERA</code> and Read Media Images.</li>
  <li><strong>Purpose:</strong> Requested only when you choose to scan a physical merchant's in-store QR code or upload customer review photos for a store. You can deny these permissions and still browse stores and deals freely.</li>
</ul>

<h3>C. Account &amp; Profile Information</h3>
<ul>
  <li><strong>Data Collected:</strong> Full name, verified mobile phone number, email address, and optional avatar image.</li>
  <li><strong>Purpose:</strong> To authenticate your account securely, attribute merchant reviews, synchronize saved stores across your devices, and prevent fraudulent activity.</li>
</ul>

<h3>D. Crash Diagnostics &amp; Device Performance</h3>
<ul>
  <li>Basic device model, OS version, and app performance logs to diagnose app crashes and ensure seamless multi-screen responsiveness.</li>
</ul>

<h2>3. Zero Third-Party Advertising SDKs</h2>
<p>FindShopEasily contains <strong>NO third-party advertising tracking networks</strong>. We do not track you across other applications, nor do we monetize or sell your private contact data to advertisers.</p>

<h2>4. User Rights &amp; Mandatory Account Deletion</h2>
<p>In accordance with Google Play Data Safety requirements and Indian data protection regulations, every user has the absolute right to access, rectify, or permanently delete their account and personal data at any time:</p>
<ul>
  <li><strong>In-App Deletion:</strong> Open the app, navigate to <code>Profile</code> &rarr; <code>Settings</code> &rarr; <code>Account Security</code> &rarr; <code>Delete Account &amp; Data</code>.</li>
  <li><strong>Direct Email Request:</strong> Send an email to <a href="mailto:support@findshopeasily.com?subject=Data%20Deletion%20Request">support@findshopeasily.com</a> with the subject <em>&quot;Data Deletion Request&quot;</em>.</li>
  <li><strong>Timeline:</strong> All associated database records, authentication credentials, and customer reviews will be permanently purged within 7 to 30 business days.</li>
</ul>

<h2>5. Children's Privacy</h2>
<p>Our platform is designed for users aged 13 and above. We do not knowingly collect personal information from children under 13. If we discover that personal data of a minor has been collected without parental consent, we will immediately delete that information.</p>

<h2>6. Data Security &amp; Encryption</h2>
<p>All data transmitted between the mobile application, web portals, and our AWS cloud servers is encrypted using modern <strong>TLS 1.3 / HTTPS</strong> encryption. Passwords and authentication tokens are securely hashed with industry-standard bcrypt algorithms.</p>

<h2>7. Grievance Officer &amp; Contact Details</h2>
<p>If you have any questions, concerns, or grievances regarding this Privacy Policy or data processing practices, please contact our designated Grievance Officer:</p>
<ul>
  <li><strong>Name:</strong> Sagar Patidar (FindShopEasily Team)</li>
  <li><strong>Email:</strong> <a href="mailto:support@findshopeasily.com">support@findshopeasily.com</a></li>
  <li><strong>Phone:</strong> +91 98260 12345 (Mon&ndash;Sat, 10:00 AM &ndash; 8:00 PM IST)</li>
  <li><strong>Address:</strong> FindShopEasily, Betul, Madhya Pradesh 460001, India</li>
</ul>`,
    contentHtml: `<h2>1. Introduction</h2>
<p>Welcome to <strong>FindShopEasily</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We connect consumers directly with local physical retail stores, counters, and in-store discounts in Betul, Madhya Pradesh and surrounding regions.</p>
<p>This Privacy Policy outlines our data practices in full compliance with the <strong>Google Play Developer Policies</strong> and India's <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>. Your privacy and trust are our top priorities.</p>

<h2>2. Data We Collect &amp; Why We Need It</h2>
<p>We collect only the minimum data required to deliver direct local shopping discovery:</p>

<h3>A. Precise &amp; Approximate Device Location</h3>
<ul>
  <li><strong>Permissions:</strong> <code>ACCESS_FINE_LOCATION</code> and <code>ACCESS_COARSE_LOCATION</code>.</li>
  <li><strong>Purpose:</strong> Used strictly while the application is in active <strong>foreground use</strong> to calculate real-time walking/driving distance to local retail stores in Betul and sort nearby deals by proximity.</li>
  <li><strong>Privacy Guarantee:</strong> We do <strong>NOT</strong> track location in the background when the app is closed, and we do <strong>NOT</strong> sell, trade, or share your coordinate history with data brokers or advertising networks.</li>
</ul>

<h3>B. Camera &amp; Photo Storage (Optional)</h3>
<ul>
  <li><strong>Permissions:</strong> <code>CAMERA</code> and Read Media Images.</li>
  <li><strong>Purpose:</strong> Requested only when you choose to scan a physical merchant's in-store QR code or upload customer review photos for a store. You can deny these permissions and still browse stores and deals freely.</li>
</ul>

<h3>C. Account &amp; Profile Information</h3>
<ul>
  <li><strong>Data Collected:</strong> Full name, verified mobile phone number, email address, and optional avatar image.</li>
  <li><strong>Purpose:</strong> To authenticate your account securely, attribute merchant reviews, synchronize saved stores across your devices, and prevent fraudulent activity.</li>
</ul>

<h3>D. Crash Diagnostics &amp; Device Performance</h3>
<ul>
  <li>Basic device model, OS version, and app performance logs to diagnose app crashes and ensure seamless multi-screen responsiveness.</li>
</ul>

<h2>3. Zero Third-Party Advertising SDKs</h2>
<p>FindShopEasily contains <strong>NO third-party advertising tracking networks</strong>. We do not track you across other applications, nor do we monetize or sell your private contact data to advertisers.</p>

<h2>4. User Rights &amp; Mandatory Account Deletion</h2>
<p>In accordance with Google Play Data Safety requirements and Indian data protection regulations, every user has the absolute right to access, rectify, or permanently delete their account and personal data at any time:</p>
<ul>
  <li><strong>In-App Deletion:</strong> Open the app, navigate to <code>Profile</code> &rarr; <code>Settings</code> &rarr; <code>Account Security</code> &rarr; <code>Delete Account &amp; Data</code>.</li>
  <li><strong>Direct Email Request:</strong> Send an email to <a href="mailto:support@findshopeasily.com?subject=Data%20Deletion%20Request">support@findshopeasily.com</a> with the subject <em>&quot;Data Deletion Request&quot;</em>.</li>
  <li><strong>Timeline:</strong> All associated database records, authentication credentials, and customer reviews will be permanently purged within 7 to 30 business days.</li>
</ul>

<h2>5. Children's Privacy</h2>
<p>Our platform is designed for users aged 13 and above. We do not knowingly collect personal information from children under 13. If we discover that personal data of a minor has been collected without parental consent, we will immediately delete that information.</p>

<h2>6. Data Security &amp; Encryption</h2>
<p>All data transmitted between the mobile application, web portals, and our AWS cloud servers is encrypted using modern <strong>TLS 1.3 / HTTPS</strong> encryption. Passwords and authentication tokens are securely hashed with industry-standard bcrypt algorithms.</p>

<h2>7. Grievance Officer &amp; Contact Details</h2>
<p>If you have any questions, concerns, or grievances regarding this Privacy Policy or data processing practices, please contact our designated Grievance Officer:</p>
<ul>
  <li><strong>Name:</strong> Sagar Patidar (FindShopEasily Team)</li>
  <li><strong>Email:</strong> <a href="mailto:support@findshopeasily.com">support@findshopeasily.com</a></li>
  <li><strong>Phone:</strong> +91 98260 12345 (Mon&ndash;Sat, 10:00 AM &ndash; 8:00 PM IST)</li>
  <li><strong>Address:</strong> FindShopEasily, Betul, Madhya Pradesh 460001, India</li>
</ul>`,
  },
  "terms-and-conditions": {
    id: "terms-and-conditions",
    slug: "terms-and-conditions",
    title: "FindShopEasily Terms of Service",
    version: "1.0.0",
    lastUpdatedBy: "FindShopEasily Legal Team",
    updatedAt: "2026-10-23T00:00:00.000Z",
    content: `<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the FindShopEasily mobile application, website, or merchant portals, you agree to be bound by these Terms of Service. If you do not agree to these terms, please refrain from using the platform.</p>

<h2>2. Scope of Platform &amp; In-Store Shopping Disclaimer</h2>
<p>FindShopEasily is a local physical retail discovery and community marketplace service designed to connect consumers with brick-and-mortar merchants in Betul, Madhya Pradesh.</p>
<ul>
  <li><strong>In-Store Transactions:</strong> Unless explicitly specified, item purchases, payment settlements, warranty claims, and goods exchanges occur in person directly at the physical merchant counter.</li>
  <li><strong>Merchant Autonomy:</strong> Merchants operate independently and are solely responsible for compliance with local sales tax, GST invoices, and consumer protection laws.</li>
</ul>

<h2>3. User Accounts &amp; Security</h2>
<ul>
  <li><strong>Accurate Information:</strong> You agree to provide true, accurate, and current information when creating an account.</li>
  <li><strong>Credential Protection:</strong> You are responsible for maintaining the confidentiality of your authentication credentials. Notify us immediately of any unauthorized account access.</li>
  <li><strong>Minimum Age:</strong> You must be at least 13 years of age to register an account on FindShopEasily.</li>
</ul>

<h2>4. Community Guidelines &amp; Prohibited Conduct</h2>
<p>When using FindShopEasily, you agree NOT to:</p>
<ul>
  <li>Submit false, defamatory, fraudulent, or malicious merchant reviews.</li>
  <li>Attempt to reverse-engineer, decompile, scrape, or extract source code from the mobile application, web apps, or backend APIs.</li>
  <li>Impersonate any merchant, retail counter, or another user.</li>
  <li>List or promote counterfeit, stolen, or illegal products.</li>
</ul>
<p>Violation of these guidelines will result in immediate suspension or permanent termination of your account without prior notice.</p>

<h2>5. Merchant Pricing, Deals &amp; Stock Availability</h2>
<ul>
  <li>Individual merchants and store owners are solely responsible for ensuring the accuracy of their listed product availability, specifications, MRP, and discount percentages.</li>
  <li>While FindShopEasily conducts verification audits of registered merchants, we cannot guarantee that an item is in stock at the physical counter at all hours. We encourage calling the store using the in-app phone action before traveling for urgent items.</li>
</ul>

<h2>6. Intellectual Property Rights</h2>
<p>All design systems, UI layouts, brand trademarks, logos, database schemas, and proprietary code in the FindShopEasily application and website are the intellectual property of FindShopEasily. Unauthorized reproduction or commercial distribution is strictly prohibited.</p>

<h2>7. Limitation of Liability</h2>
<p>To the fullest extent permitted by applicable law, FindShopEasily and its operators shall not be liable for any indirect, punitive, or consequential damages resulting from:</p>
<ul>
  <li>Commercial disputes between buyers and merchants during in-store purchases.</li>
  <li>Temporary unavailability of the platform due to server maintenance or network outages.</li>
  <li>Third-party map navigation links or external telephone networks.</li>
</ul>

<h2>8. Modifications to Terms</h2>
<p>We reserve the right to revise or replace these Terms at any time. Material changes will be accompanied by an updated version number and effective date on the mobile app and website.</p>

<h2>9. Governing Law &amp; Jurisdiction</h2>
<p>These Terms are governed by and construed in accordance with the laws of the Republic of India. Any legal dispute or proceeding arising out of or related to FindShopEasily shall be subject to the exclusive jurisdiction of the competent courts in <strong>Betul, Madhya Pradesh, India</strong>.</p>

<h2>10. Contact Information</h2>
<p>For any legal inquiries, merchant partnerships, or terms clarification:</p>
<ul>
  <li><strong>Support Email:</strong> <a href="mailto:support@findshopeasily.com">support@findshopeasily.com</a></li>
  <li><strong>Helpline:</strong> +91 98260 12345 (Mon&ndash;Sat, 10:00 AM &ndash; 8:00 PM IST)</li>
  <li><strong>Office:</strong> FindShopEasily, Betul, Madhya Pradesh 460001, India</li>
</ul>`,
    contentHtml: `<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the FindShopEasily mobile application, website, or merchant portals, you agree to be bound by these Terms of Service. If you do not agree to these terms, please refrain from using the platform.</p>

<h2>2. Scope of Platform &amp; In-Store Shopping Disclaimer</h2>
<p>FindShopEasily is a local physical retail discovery and community marketplace service designed to connect consumers with brick-and-mortar merchants in Betul, Madhya Pradesh.</p>
<ul>
  <li><strong>In-Store Transactions:</strong> Unless explicitly specified, item purchases, payment settlements, warranty claims, and goods exchanges occur in person directly at the physical merchant counter.</li>
  <li><strong>Merchant Autonomy:</strong> Merchants operate independently and are solely responsible for compliance with local sales tax, GST invoices, and consumer protection laws.</li>
</ul>

<h2>3. User Accounts &amp; Security</h2>
<ul>
  <li><strong>Accurate Information:</strong> You agree to provide true, accurate, and current information when creating an account.</li>
  <li><strong>Credential Protection:</strong> You are responsible for maintaining the confidentiality of your authentication credentials. Notify us immediately of any unauthorized account access.</li>
  <li><strong>Minimum Age:</strong> You must be at least 13 years of age to register an account on FindShopEasily.</li>
</ul>

<h2>4. Community Guidelines &amp; Prohibited Conduct</h2>
<p>When using FindShopEasily, you agree NOT to:</p>
<ul>
  <li>Submit false, defamatory, fraudulent, or malicious merchant reviews.</li>
  <li>Attempt to reverse-engineer, decompile, scrape, or extract source code from the mobile application, web apps, or backend APIs.</li>
  <li>Impersonate any merchant, retail counter, or another user.</li>
  <li>List or promote counterfeit, stolen, or illegal products.</li>
</ul>
<p>Violation of these guidelines will result in immediate suspension or permanent termination of your account without prior notice.</p>

<h2>5. Merchant Pricing, Deals &amp; Stock Availability</h2>
<ul>
  <li>Individual merchants and store owners are solely responsible for ensuring the accuracy of their listed product availability, specifications, MRP, and discount percentages.</li>
  <li>While FindShopEasily conducts verification audits of registered merchants, we cannot guarantee that an item is in stock at the physical counter at all hours. We encourage calling the store using the in-app phone action before traveling for urgent items.</li>
</ul>

<h2>6. Intellectual Property Rights</h2>
<p>All design systems, UI layouts, brand trademarks, logos, database schemas, and proprietary code in the FindShopEasily application and website are the intellectual property of FindShopEasily. Unauthorized reproduction or commercial distribution is strictly prohibited.</p>

<h2>7. Limitation of Liability</h2>
<p>To the fullest extent permitted by applicable law, FindShopEasily and its operators shall not be liable for any indirect, punitive, or consequential damages resulting from:</p>
<ul>
  <li>Commercial disputes between buyers and merchants during in-store purchases.</li>
  <li>Temporary unavailability of the platform due to server maintenance or network outages.</li>
  <li>Third-party map navigation links or external telephone networks.</li>
</ul>

<h2>8. Modifications to Terms</h2>
<p>We reserve the right to revise or replace these Terms at any time. Material changes will be accompanied by an updated version number and effective date on the mobile app and website.</p>

<h2>9. Governing Law &amp; Jurisdiction</h2>
<p>These Terms are governed by and construed in accordance with the laws of the Republic of India. Any legal dispute or proceeding arising out of or related to FindShopEasily shall be subject to the exclusive jurisdiction of the competent courts in <strong>Betul, Madhya Pradesh, India</strong>.</p>

<h2>10. Contact Information</h2>
<p>For any legal inquiries, merchant partnerships, or terms clarification:</p>
<ul>
  <li><strong>Support Email:</strong> <a href="mailto:support@findshopeasily.com">support@findshopeasily.com</a></li>
  <li><strong>Helpline:</strong> +91 98260 12345 (Mon&ndash;Sat, 10:00 AM &ndash; 8:00 PM IST)</li>
  <li><strong>Office:</strong> FindShopEasily, Betul, Madhya Pradesh 460001, India</li>
</ul>`,
  },
};
