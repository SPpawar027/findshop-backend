# FindShopEasily – Backend API Service

Production REST API service powering the **FindShopEasily** consumer mobile app, **Shopkeeper Admin Console**, and **Super Admin Platform**. Built with high-performance Node.js, Express, TypeScript, Sequelize ORM, PostgreSQL, and AWS S3 cloud media storage.

---

## 1. System Architecture & Tech Stack

```
[Mobile App / Shop Admin / Super Admin]
                │
                ▼ (HTTP / JSON)
        [Express 5 Router]
                │
    ┌───────────┴───────────┐
    ▼                       ▼
[Authentication]      [Feature Modules]
(JWT + Bcrypt)        (Auth, Users, Shops, Products, Upload)
    │                       │
    ▼                       ▼
[Sequelize ORM]       [AWS S3 SDK v3]
    │                       │
    ▼ (Internal VPC)        ▼ (Cloud Storage)
[AWS RDS PostgreSQL]  [AWS S3 Bucket: findshop-dev-media-sagar]
```

### Core Technologies
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 5.x
- **Language**: TypeScript 7.x
- **ORM & Database**: Sequelize 6 with PostgreSQL 16+ (AWS RDS Mumbai `ap-south-1`)
- **Cloud Storage**: AWS S3 SDK v3 (`@aws-sdk/client-s3`, presigned URLs, atomic temp-to-permanent image promotion)
- **Security**: JWT (`jsonwebtoken`), password hashing with salt rounds (`bcryptjs`), CORS filtering
- **Process Manager**: PM2 (Cluster mode, auto-reboot, zero-downtime restarts)

---

## 2. Directory Structure

```
backend/
├── src/
│   ├── app.ts                 # Express app initialization, CORS, global middlewares
│   ├── server.ts              # HTTP listener, database connectivity verification
│   ├── config/
│   │   ├── database.ts        # Sequelize connection pool configuration
│   │   └── env.ts             # Strongly typed environment variable validator
│   ├── core/
│   │   ├── errors/            # Standard AppError, BadRequestError, NotFoundError, UnauthorizedError
│   │   ├── middlewares/       # JWT authMiddleware, centralized errorHandler, requestLogger
│   │   ├── storage/           # S3 StorageService (Presigned URLs, copyObject, moveObject)
│   │   └── utils/             # Standardized sendSuccess, sendCreated, formatMediaUrls
│   ├── database/
│   │   └── associations.ts    # Model associations (User 1:M Shops, Shop 1:M Products)
│   ├── modules/
│   │   ├── auth/              # Registration, login, profile (/api/auth)
│   │   ├── users/             # User listing, role updates, suspensions (/api/users)
│   │   ├── shops/             # Shop management, nearby discovery, approvals (/api/shops)
│   │   ├── products/          # Catalog CRUD, image lifecycle promotion (/api/products)
│   │   └── upload/            # Secure S3 presigned URL generator (/api/upload)
│   └── seed-superadmin.ts     # Initial seed script for Super Admin credentials
├── migrations/                # Database DDL migration files
├── dist/                      # Compiled production JavaScript (gitignored)
├── .env                       # Local secrets (gitignored)
├── .env.example               # Clean environment template
└── package.json               # Scripts and production dependencies
```

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` or `production` |
| `PORT` | Listening TCP port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `STORAGE_PROVIDER` | Media storage driver | `s3` |
| `AWS_REGION` | AWS region of S3 and RDS | `ap-south-1` (Mumbai) |
| `AWS_S3_BUCKET` | S3 bucket name | `findshop-dev-media-sagar` |
| `AWS_ACCESS_KEY_ID` | IAM programmatic access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key | `dtZL...` |
| `MEDIA_CDN_URL` | Base public S3/CDN media URL | `https://findshop-dev-media-sagar.s3.ap-south-1.amazonaws.com` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `YourSuperSecretKey2026!` |

---

## 4. Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server (with Auto-Reload)
```bash
npm run dev
```
The server will boot on `http://localhost:4000`.

### 3. Verify Health Check
```bash
curl http://localhost:4000/api/health
```
Response:
```json
{
  "success": true,
  "message": "FindShopEasily backend is running",
  "timestamp": "2026-10-22T13:00:00.000Z"
}
```

### 4. Build TypeScript into JavaScript
```bash
npm run build
```

---

## 5. API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` – Register customer or shopkeeper.
- `POST /api/auth/login` – Authenticate with email/password and obtain JWT.
- `GET /api/auth/me` – Fetch currently authenticated user session.

### Stores & Shops (`/api/shops`)
- `GET /api/shops` – List all shops with pagination, search, category, and status filters.
- `GET /api/shops/nearby?lat=...&lng=...&radius=...` – Geospatial proximity search sorted by distance.
- `GET /api/shops/:id` – Retrieve complete shop profile by ID.
- `GET /api/shops/slug/:slug` – Retrieve shop profile by SEO slug.
- `POST /api/shops` – Onboard a new store.
- `PUT /api/shops/:id` – Update store profile, open/close status, or verification state.
- `DELETE /api/shops/:id` – Delete or archive a shop.

### Products (`/api/products`)
- `GET /api/products` – Catalog product discovery with pagination and search.
- `GET /api/products/shop/:shopId?availableOnly=true` – Fetch products belonging to a specific shop.
- `GET /api/products/:id` – Get single product details.
- `POST /api/products` – Create a product (automatically promotes temporary S3 images to permanent folders).
- `PUT /api/products/:id` – Update product specifications, price, or inventory.
- `DELETE /api/products/:id` – Remove a product.

### Cloud Uploads (`/api/upload`)
- `POST /api/upload/presigned-url` – Generates an AWS S3 presigned PUT URL allowing clients (Shop Admin) to upload WebP images directly to AWS S3 without overloading the API server.

---

## 6. Production Deployment (Ubuntu EC2 + PM2 + Nginx)

### 1. Start with PM2
```bash
npm run build
pm2 start dist/server.js --name "findshop-api"
pm2 save
pm2 startup
```

### 2. Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/findshop-api`)
```nginx
server {
    listen 80;
    server_name api.findshopeasily.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Issue Free SSL with Certbot
```bash
sudo certbot --nginx -d api.findshopeasily.com
```

---

## 7. Security Best Practices
- **Never commit `.env`**: Credentials are automatically ignored via `.gitignore`.
- **Direct S3 Uploads**: Client applications upload directly to S3 using short-lived signed URLs (15-minute expiry).
- **Graceful Error Handling**: All database and system errors pass through `errorHandler.ts` to prevent internal SQL syntax leaks in production responses.
