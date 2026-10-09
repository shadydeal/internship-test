# Grocery Store API

A Node.js REST API for employee and manager accounts in a hierarchical organization. MongoDB stores organization nodes separately and stores employees and managers as role-discriminated documents in one `people` collection. Node records store their ancestor IDs, which allows access checks and descendant queries to use the same hierarchy. The shared people collection enforces email uniqueness across both account types.

## Requirements

- Node.js 20 or newer
- Docker with Docker Compose, or a MongoDB 7 instance

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `JWT_SECRET` to a random value of at least 32 characters.
3. Start MongoDB with `docker compose up -d mongo`, or configure `MONGODB_URI` for an existing instance.
4. Initialize the organization and demo accounts: `npm run seed`
5. Start the API: `npm start`
6. Run unit tests: `npm test`

The seed script can be run repeatedly. It creates the representative hierarchy below and updates its demo accounts without deleting other records:

The seed script contains the complete organization chart from the brief, including the Novi Beograd / Bezanija / Radnja 6 branch used in its access-control example.

Demo accounts use `manager@grocery.local` and `employee@grocery.local`. Their default password is `ChangeMe123!`; set `SEED_MANAGER_PASSWORD` and `SEED_EMPLOYEE_PASSWORD` before seeding to change it. These are development credentials only. Use strong unique values and a private database outside local development.

## Authentication and authorization

Log in with `POST /api/auth/login` and send the returned JWT on protected requests as `Authorization: Bearer <token>`. Passwords are stored as bcrypt hashes. Tokens expire, and every request loads the current account and node from MongoDB.

- Managers can read and manage both employee and manager accounts in their own node and descendants.
- Employees can read employee accounts in their own node and descendants. They cannot read managers or create, update, or delete accounts.
- Attempts to access records outside the caller's subtree are denied; record lookups return `404` to avoid disclosing whether an inaccessible account exists.

## API

All endpoints except `GET /health` and `POST /api/auth/login` require a bearer token.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Authenticate using `{ "email": "...", "password": "..." }` |
| `GET` | `/api/employees?nodeId=...` | List employees at one authorized node |
| `GET` | `/api/employees?nodeId=...&includeDescendants=true` | List employees at that node and all its descendants |
| `POST` | `/api/employees` | Create an employee (manager only) |
| `GET` | `/api/employees/:id` | Read an employee in scope |
| `PATCH` | `/api/employees/:id` | Update an employee (manager only) |
| `DELETE` | `/api/employees/:id` | Delete an employee (manager only) |
| `GET` | `/api/managers?nodeId=...` | List managers at one authorized node (manager only) |
| `GET` | `/api/managers?nodeId=...&includeDescendants=true` | List managers at that node and all its descendants (manager only) |
| `POST` | `/api/managers` | Create a manager (manager only) |
| `GET` | `/api/managers/:id` | Read a manager in scope (manager only) |
| `PATCH` | `/api/managers/:id` | Update a manager (manager only) |
| `DELETE` | `/api/managers/:id` | Delete a manager (manager only) |

Create-account requests require `name`, `email`, `password` (at least 10 characters), and `nodeId`. Updates accept any non-empty subset of those fields. `nodeId` must refer to a node within the manager's own subtree.

## Example

```sh
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@grocery.local","password":"ChangeMe123!"}'

curl "http://localhost:3000/api/employees?nodeId=novi-beograd&includeDescendants=true" \
  -H "Authorization: Bearer <token>"
```
