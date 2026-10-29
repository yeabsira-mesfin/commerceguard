# CommerceGuard

Secure full stack commerce demo built from the original React, Redux and React Router e-commerce starter. All products, users and orders are synthetic. There are no real payments, and credit card information is never collected.

## Features in the review branch

- Responsive product catalog with keyword search, category filtering and sorting.
- Redux-based cart with add, remove and quantity controls.
- Customer registration and login backed by PostgreSQL and bcrypt.
- Short-lived JWT authorization, server-controlled customer/admin roles, login rate limiting.
- Cart checkout with inventory locking, server-controlled prices, stock decrements and simulated order persistence.
- Order history and object-level authorization to prevent another customer reading an order.
- Admin inventory/product management, simulated order status, customer profiles, sales metrics and audit logging.
- Policy unit tests, PostgreSQL integration tests, GitHub Actions build and dependency audit.

## Getting started

Requirements: Node.js 22+, npm and PostgreSQL 16+.

1. Create the commerceguard database and an app database user.
2. Copy backend/.env.example to backend/.env.
3. Set DATABASE_URL, a unique JWT_SECRET at least 32 characters, and a local DEMO_ADMIN_PASSWORD at least 12 characters. Do not commit .env.
4. In backend run: npm install && npm run migrate && npm run seed && npm run dev.
5. In a second terminal, in ecommerce run: npm install && npm start.
6. Open the local React development server. CRA proxies API requests to localhost:3100.

Seeded admin email: admin@commerceguard.test. The password is the locally supplied DEMO_ADMIN_PASSWORD. To make a customer account, use the signup form.

## API routes

- Public: GET /api/products, POST /api/auth/register, POST /api/auth/login
- Customer: POST /api/orders, GET /api/orders, GET /api/orders/:id
- Admin: POST /api/products, PATCH /api/products/:id, GET /api/admin/dashboard

## Security model

Only the backend decides privileges and order ownership. Checkout ignores client-supplied prices, acquires PostgreSQL row locks for inventory updates and uses transactions. Email fields are normalized, queries parameterized, password hashing uses bcrypt, and audit logs track admin changes and blocked cross-account reads. The storefront stores its short-lived token in component memory.

Tests cover BOLA/IDOR access denial, admin route restrictions, price integrity, inventory decreases and invalid cart items. The dependency override ensures a patched proxy-addr version.

## Known limitations

This is an MVP, not a commercial checkout system. There are no live payments or password-reset emails. A one-time reset-token flow works only in an expressly enabled local demo; it is disabled from returning tokens in production. Product editing, profile updates and simulated order status workflows are available. Returns, real shipping, pagination, refresh-token rotation and production deployment are not included. Images are decorative CSS illustrations. Production rollout would require HTTPS, secret management, CSRF/session design for future cookie auth, password reset with email verification, expanded monitoring and formal security testing.

## Portfolio description

Built a secure demo commerce platform with React, Redux, Express, PostgreSQL, role-based access, database-backed inventory, atomic simulated checkout, and audit-logged administrative changes.

## Additional account and operations features

CommerceGuard supports product-detail views, customer profile updates, administrator product creation/editing, order status transitions, and a local-only token-based password recovery demonstration. Demo tokens are returned only if `DEMO_RESET_TOKENS=true` and `NODE_ENV` is not production; the Docker stack explicitly disables that option.

## Docker and browser QA

Copy `docker.env.example` to `.env`, replace placeholders, and run `docker compose up --build`. Open http://127.0.0.1:8081. CI verifies database-backed APIs, browser cart/checkout, administrator operations, token reset, accessibility and container image builds. See [QA.md](QA.md).
