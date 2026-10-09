# Grocery Store API

A Node.js REST API for employee and manager accounts in a hierarchical organization. MongoDB stores organization nodes separately and stores employees and managers as role-discriminated documents in one `people` collection. Each node stores its parent and ancestor IDs, enabling indexed descendant queries and subtree authorization. A shared people collection enforces unique email addresses across both account types.

## Requirements

- Node.js 20 or newer
- Docker with Docker Compose, or a MongoDB 7 instance
- `curl` and `jq` to run the shell examples below

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `JWT_SECRET` to a random value of at least 32 characters.
3. Start MongoDB with `docker compose up -d mongo`, or configure `MONGODB_URI` for an existing instance.
4. Initialize the organization and demo accounts: `npm run seed`
5. Start the API: `npm start`
6. Run unit tests: `npm test`

The seed script contains the complete organization chart from the brief, including the Novi Beograd / Bezanija / Radnja 6 branch used in its access-control example. It can be run repeatedly; it updates its demo records without deleting other data.

Demo accounts use `manager@grocery.local` and `employee@grocery.local`. Their default password is `ChangeMe123!`; set `SEED_MANAGER_PASSWORD` and `SEED_EMPLOYEE_PASSWORD` before seeding to change it. These are development credentials only. Use strong unique values and a private database outside local development.

## Authentication and authorization

Log in with `POST /api/auth/login` to obtain a JWT, and send that token on protected requests using the `Authorization: Bearer <token>` header. Passwords are stored as bcrypt hashes. Tokens expire, and every request reloads the current account and node from MongoDB.

- Managers can read and manage employees and managers in their node and descendants.
- Employees can read employees in their node and descendants. They cannot read managers or create, update, or delete accounts.
- Node queries outside the caller's subtree are denied. Reads of individual accounts outside that scope return `404` to avoid disclosing whether an inaccessible account exists.
- Create and update requests can only assign accounts to a node inside the manager's own subtree.

## API

All endpoints except `GET /health` and `POST /api/auth/login` require a bearer token.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/health` | Public liveness check |
| `POST` | `/api/auth/login` | Authenticate using `{ "email": "...", "password": "..." }` |
| `GET` | `/api/employees?nodeId=...` | List employees assigned exactly to an authorized node |
| `GET` | `/api/employees?nodeId=...&includeDescendants=true` | List employees at the authorized node and all descendants |
| `POST` | `/api/employees` | Create an employee (manager only) |
| `GET` | `/api/employees/:id` | Read an employee in scope |
| `PATCH` | `/api/employees/:id` | Update an employee (manager only) |
| `DELETE` | `/api/employees/:id` | Delete an employee (manager only) |
| `GET` | `/api/managers?nodeId=...` | List managers assigned exactly to an authorized node (manager only) |
| `GET` | `/api/managers?nodeId=...&includeDescendants=true` | List managers at the authorized node and all descendants (manager only) |
| `POST` | `/api/managers` | Create a manager (manager only) |
| `GET` | `/api/managers/:id` | Read a manager in scope (manager only) |
| `PATCH` | `/api/managers/:id` | Update a manager (manager only) |
| `DELETE` | `/api/managers/:id` | Delete a manager (manager only) |

Creation requires `name`, `email`, `password` (at least 10 characters), and `nodeId`. Updates accept any non-empty subset of those fields. A successful create returns `201` and a sanitized account. A successful delete returns `204` with no response body. Password hashes are never returned.

## Endpoint examples

Run these examples after starting the API and seeding the database. They use `curl` and `jq` to save JWTs and newly created record IDs. The seeded account passwords are `ChangeMe123!` unless changed with the seed environment variables.

### Health check

`GET /health` is public and does not require a token:

```sh
API_URL=http://localhost:3000
curl -i "$API_URL/health"
```

### Log in

`POST /api/auth/login` accepts either seeded manager or employee credentials. It returns a token and a non-sensitive user profile:

```sh
MANAGER_TOKEN=$(curl -sS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@grocery.local","password":"ChangeMe123!"}' | jq -r '.token')

EMPLOYEE_TOKEN=$(curl -sS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@grocery.local","password":"ChangeMe123!"}' | jq -r '.token')
```

Add `-i` to inspect an HTTP status and response headers, or remove `-sS` to see curl's transfer progress.

### Employee endpoints

Employees may list employee accounts in their own subtree. The demo employee belongs to Bezanija, whose descendant is Radnja 6:

```sh
# GET /api/employees?nodeId=bezanija — employees assigned to this node only.
curl -sS "$API_URL/api/employees?nodeId=bezanija" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"

# GET /api/employees?nodeId=bezanija&includeDescendants=true — include descendant nodes.
curl -sS "$API_URL/api/employees?nodeId=bezanija&includeDescendants=true" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

The remaining employee endpoints require a manager token. Create an employee in the manager's subtree, read it by ID, update its name, and delete it:

```sh
# POST /api/employees — create an employee and capture its ID.
NEW_EMPLOYEE=$(curl -sS -X POST "$API_URL/api/employees" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Radnja 6 Employee","email":"radnja6.employee@grocery.local","password":"StrongPassword123!","nodeId":"radnja-6"}')
EMPLOYEE_ID=$(printf '%s' "$NEW_EMPLOYEE" | jq -r '._id // .id')

# GET /api/employees/:id — read the created employee.
curl -sS "$API_URL/api/employees/$EMPLOYEE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# PATCH /api/employees/:id — update one or more supplied fields.
curl -sS -X PATCH "$API_URL/api/employees/$EMPLOYEE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Radnja 6 Employee"}'

# DELETE /api/employees/:id — successful response is HTTP 204 with no body.
curl -i -X DELETE "$API_URL/api/employees/$EMPLOYEE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

### Manager endpoints

Only managers may list manager accounts. These examples show a list for exactly Novi Beograd and a list that includes all its descendants:

```sh
# GET /api/managers?nodeId=novi-beograd — managers assigned to the node only.
curl -sS "$API_URL/api/managers?nodeId=novi-beograd" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# GET /api/managers?nodeId=novi-beograd&includeDescendants=true — include descendant nodes.
curl -sS "$API_URL/api/managers?nodeId=novi-beograd&includeDescendants=true" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

Create a manager at Bezanija, read the new record, update its name, and delete it:

```sh
# POST /api/managers — create a manager and capture its ID.
NEW_MANAGER=$(curl -sS -X POST "$API_URL/api/managers" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bezanija Manager","email":"bezanija.manager@grocery.local","password":"StrongManagerPassword123!","nodeId":"bezanija"}')
MANAGER_ID=$(printf '%s' "$NEW_MANAGER" | jq -r '._id // .id')

# GET /api/managers/:id — read the created manager.
curl -sS "$API_URL/api/managers/$MANAGER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# PATCH /api/managers/:id — update one or more supplied fields.
curl -sS -X PATCH "$API_URL/api/managers/$MANAGER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Bezanija Manager"}'

# DELETE /api/managers/:id — successful response is HTTP 204 with no body.
curl -i -X DELETE "$API_URL/api/managers/$MANAGER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

An employee attempting to list managers or query a node outside their subtree receives `403`. For example, `GET /api/managers?nodeId=bezanija` with `$EMPLOYEE_TOKEN` is forbidden, even when the node is within the employee's subtree.
