# Noesys Article Platform

Monorepo for the article platform with user and admin applications.

## Project Structure

- apps/ - React applications
- workers/ - Cloudflare Workers
- packages/ - Shared packages
- infra/ - Infrastructure and migrations

# Noesys Article Platform - User API

## DBML

```dbml

Table users {
id text [pk]
email text [unique, not null]
name text [not null]
auth_role text [not null, note: 'super_admin | admin | user']
job_role text [not null]
created_at text [not null]
is_active int [not null, default: 1, note: '1=active, 0=inactive']

entra_id text [unique]
}

Table article_types {
id text [pk]
name text [unique, not null, note: 'e.g. Marketing, Software, HR']
description text
is_active int [not null, default: 1, note: '1=active, 0=inactive']

pass_threshold real [not null, note: 'article passes if ai_score >= this']
score_prompt text [not null, note: 'AI instruction for producing the main score']
score_min real [not null, default: 0]
score_max real [not null, default: 10]
created_by text [not null, ref: > users.id]
created_at text [not null]
updated_at text [not null]
}

Table parameters {
id text [pk]
article_type_id text [not null, ref: > article_types.id]
name text [not null, note: 'e.g. Grammar, Theme']
prompt text [not null, note: 'AI instruction for evaluating this specific parameter']
scope_type text [not null, note: 'numeric | option']
min_value real [note: 'required when scope_type = numeric']
max_value real [note: 'required when scope_type = numeric']

is_active int [not null, default: 1]

sort_order int [not null, default: 0]

created_by text [not null, ref: > users.id]
created_at text [not null]
updated_at text [not null]

indexes {
(article_type_id, name) [unique]
}
}

Table parameter_options {
id text [pk]
parameter_id text [not null, ref: > parameters.id]
label text [not null, note: 'e.g. "High", "Low", "Recreate"']
sort_order int [not null, default: 0]
is_active int [not null, default: 1]

Indexes {
(parameter_id, label) [unique]
}
}

Table articles {
id text [pk]
user_id text [not null, ref: > users.id]
article_type_id text [not null, ref: > article_types.id]
title text [not null]
content text [not null]
status text [not null, note: 'approved | rewrite_required | pending']

pass_threshold real

ai_feedback text [note: 'overall AI feedback, separate from per-parameter feedback if any']
ai_score real [note: "the article's score against article_types.score_prompt / score_min / score_max. null until scored. sole driver of status"]
version int [not null, default: 1, note: 'increments on every rewrite']
submitted_at text [not null]
scored_at text
month_year text [not null, note: 'e.g. 2026-08']
retry_count int [not null, default: 0]

}

Table article_parameter_results {
id text [pk]
article_id text [not null, ref: > articles.id]
parameter_id text [not null, ref: > parameters.id]
value text [not null, note: 'numeric value or option label']

option_id text [ref: > parameter_options.id, note: 'set when parameter.scope_type = option']
numeric_value real

version int [not null, note: 'matches articles.version at time of scoring']
scored_at text [not null]

Indexes {
(article_id, parameter_id, version) [unique]
(parameter_id, value)
}
}

Table article_history {
id text [pk]
article_id text [not null, ref: > articles.id]
article_type_id text [not null, ref: > article_types.id]
title text [not null]
content text [not null]
ai_feedback text
ai_score real
status text
version int [not null, note: 'version number at the time this snapshot was taken']
submitted_at text [not null]
scored_at text
snapshotted_at text [not null, note: 'when this row was written to history']
}

Table otp_codes {
id text [pk]
email text [not null]
code text [not null]
purpose text [not null, default: 'login', note: 'e.g. login']
expires_at text [not null]
created_at text [not null]
used_at text

Indexes {
email
(email, code)
}
}
```

---

# Authentication APIs

| Method | Endpoint            | Description          |
| ------ | ------------------- | -------------------- |
| POST   | `/auth/otp/request` | Request login OTP    |
| POST   | `/auth/otp/verify`  | Verify OTP and login |
| GET    | `/auth/me`          | Get current user     |

---

## POST /auth/otp/request

Request OTP for login.

### Request

```json
{
  "email": "user@company.com"
}
```

### Response

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "expires_in": 600
  }
}
```

---

## POST /auth/otp/verify

Verify OTP and generate JWT token.

### Request

```json
{
  "email": "user@company.com",
  "code": "123456"
}
```

### Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "usr_xxx",
      "name": "John Doe",
      "email": "user@company.com",
      "job_role": "Developer",
      "auth_role": "user"
    }
  }
}
```

---

## GET /auth/me

Returns currently authenticated user.

### Headers

```http
Authorization: Bearer <token>
```

### Response

```json
{
  "message": "User authenticated successfully",
  "data": {
    "id": "usr_123",
    "email": "john@company.com",
    "name": "John Doe",
    "job_role": "Developer",
    "auth_role": "user",
    "is_active": 1
  }
}
```

---

# Article APIs

| Method | Endpoint                  | Description         |
| ------ | ------------------------- | ------------------- |
| GET    | `/articles/mine`          | List user articles  |
| GET    | `/articles/mine/:id`      | Get article details |
| POST   | `/articles`               | Submit article      |
| GET    | `/articles/:id/status`    | Get article status  |
| GET    | `/articles/article-types` | List article types  |

---

## GET /articles/mine

Returns articles belonging to the logged-in user.

### Query Parameters

| Parameter | Type    | Description       |
| --------- | ------- | ----------------- |
| month     | string  | YYYY-MM format    |
| viewAll   | boolean | View all articles |
| page      | number  | Page number       |
| limit     | number  | Page size         |

### Response

```json
{
  "message": "Articles fetched successfully",
  "data": {
    "items": [
      {
        "id": "art_123",
        "user_id": "usr_123",
        "article_type_id": "type_123",
        "article_type_name": "Technology",
        "title": "AI Trends",
        "content": "...",
        "status": "approved",
        "ai_score": 8,
        "version": 2,
        "submitted_at": "2026-09-01T10:00:00Z",
        "scored_at": "2026-09-01T10:05:00Z",
        "month_year": "2026-09",
        "retry_count": 0,
        "ai_feedback": "Good article"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

---

## GET /articles/mine/:id

Returns article details, feedback, parameter scores and history.

### Response

```json
{
  "message": "Article fetched successfully",
  "data": {
    "article": {
      "id": "art_123",
      "title": "AI Trends",
      "status": "approved",
      "ai_score": 8,
      "version": 2,
      "ai_feedback": "Good article"
    },
    "history": [
      {
        "id": "hist_1",
        "article_id": "art_123",
        "article_type_id": "type_123",
        "title": "AI Trends",
        "content": "...",
        "status": "rewrite_required",
        "version": 1,
        "ai_score": 4,
        "ai_feedback": "Needs improvement",
        "submitted_at": "2026-08-31T10:00:00Z",
        "scored_at": "2026-08-31T10:05:00Z",
        "snapshotted_at": "2026-08-31T10:06:00Z"
      }
    ]
  }
}
```

---

## POST /articles

Creates a new article or rewrites an existing one.

### Request (New Article)

```json
{
  "article_type_id": "type_xxx",
  "title": "AI Trends",
  "content": "Article content"
}
```

### Request (Rewrite)

```json
{
  "id": "art_xxx",
  "article_type_id": "type_xxx",
  "title": "Updated Title",
  "content": "Updated content"
}
```

### Response

```json
{
  "message": "Article submitted",
  "data": {
    "id": "art_xxx",
    "status": "pending",
    "ai_score": null,
    "ai_feedback": null
  }
}
```

---

## GET /articles/:id/status

Returns latest evaluation status.

### Response

```json
{
  "success": true,
  "data": {
    "id": "art_xxx",
    "status": "accepted",
    "ai_score": 8,
    "ai_feedback": "Good article",
    "version": 2
  }
}
```

---

## GET /articles/article-types

Returns available article categories.

### Response

```json
{
  "message": "Article types fetched successfully",
  "data": [
    {
      "id": "type_123",
      "name": "Technology",
      "description": "Technology related articles",
      "created_by": "usr_admin",
      "created_at": "2026-09-01T10:00:00Z",
      "updated_at": "2026-09-01T10:00:00Z"
    }
  ]
}
```

---

# Authentication

All article endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

# Noesys Article Platform - Admin API

# Articles APIs

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/articles`                       | List articles          |
| GET    | `/articles/stats`                 | Dashboard statistics   |
| GET    | `/articles/:id`                   | Get article details    |
| GET    | `/articles/:id/parameter-results` | Get parameter results  |
| POST   | `/articles/:id/parameter-results` | Save parameter results |

---

## GET /articles

Returns articles with optional filters.

### Query Parameters

| Parameter | Type   |
| --------- | ------ |
| month     | string |
| status    | string |
| type      | string |

### Response

```json
{
  "message": "Articles fetched successfully",
  "data": [
    {
      "id": "art_123",
      "title": "AI Trends",
      "status": "approved",
      "ai_score": 8,
      "version": 2,
      "submitted_at": "2026-09-01T10:00:00Z",
      "user_id": "usr_123",
      "author_name": "John Doe",
      "article_type_id": "type_123",
      "article_type_name": "Technology",
      "parameters": [
        {
          "parameterId": "param_1",
          "parameterName": "Grammar",
          "scopeType": "numeric",
          "value": 8
        }
      ]
    }
  ]
}
```

---

## GET /articles/stats

Returns dashboard statistics.

### Response

```json
{
  "message": "Stats fetched successfully",
  "data": {}
}
```

---

## GET /articles/:id

Returns article details, history and parameter scores.

### Response

```json
{
  "message": "Article fetched successfully",
  "data": {
    "article": {},
    "parameter_results": [],
    "history": []
  }
}
```

---

## GET /articles/:id/parameter-results

Returns parameter evaluation results.

### Response

```json
{
  "message": "Parameter results fetched",
  "data": []
}
```

---

## POST /articles/:id/parameter-results

Stores AI evaluation results.

### Request

```json
{
  "ai_score": 8,
  "ai_feedback": "Good article",
  "results": []
}
```

### Response

```json
{
  "message": "Parameter results stored",
  "data": {}
}
```

---

# Article Types APIs

| Method | Endpoint             | Description         |
| ------ | -------------------- | ------------------- |
| GET    | `/article-types`     | List article types  |
| GET    | `/article-types/:id` | Get article type    |
| POST   | `/article-types`     | Create article type |
| PATCH  | `/article-types/:id` | Update article type |
| DELETE | `/article-types/:id` | Delete article type |

---

## GET /article-types

### Response

```json
{
  "message": "Article types fetched successfully",
  "data": [
    {
      "id": "type_123",
      "name": "Technology",
      "description": "Technology related articles",
      "is_active": 1,
      "pass_threshold": 5,
      "score_prompt": "Evaluate the article",
      "score_min": 0,
      "score_max": 10,
      "created_by": "usr_admin",
      "created_at": "2026-09-01T10:00:00Z",
      "updated_at": "2026-09-01T10:00:00Z",
      "parameter_count": 2,
      "parameters": [
        {
          "id": "param_1",
          "name": "Grammar",
          "prompt": "Check grammar",
          "scopeType": "numeric",
          "minValue": 0,
          "maxValue": 10,
          "options": []
        }
      ]
    }
  ]
}
```

---

## GET /article-types/:id

### Response

```json
{
  "message": "Article type fetched successfully",
  "data": {
    "id": "type_123",
    "name": "Technology",
    "description": "Technology related articles",
    "pass_threshold": 5,
    "score_prompt": "Evaluate article",
    "score_min": 0,
    "score_max": 10,
    "is_active": 1
  }
}
```

---

## POST /article-types

### Request

```json
{
  "name": "Technology",
  "description": "Technology articles",
  "passThreshold": 5,
  "scorePrompt": "Evaluate article",
  "scoreMin": 0,
  "scoreMax": 10
}
```

### Response

```json
{
  "message": "Article type created successfully.",
  "data": {}
}
```

---

## PATCH /article-types/:id

### Request

```json
{
  "name": "Technology",
  "description": "Updated description",
  "passThreshold": 6,
  "scorePrompt": "Updated prompt",
  "scoreMin": 0,
  "scoreMax": 10
}
```

### Response

```json
{
  "message": "Article type updated successfully"
}
```

---

## DELETE /article-types/:id

### Response

```json
{
  "message": "Article type deleted successfully"
}
```

---

# Parameters APIs

| Method | Endpoint                                    | Description      |
| ------ | ------------------------------------------- | ---------------- |
| GET    | `/parameters/:articleTypeId/parameters`     | List parameters  |
| GET    | `/parameters/:articleTypeId/parameters/:id` | Get parameter    |
| POST   | `/parameters/:articleTypeId/parameters`     | Create parameter |
| PATCH  | `/parameters/:articleTypeId/parameters/:id` | Update parameter |
| DELETE | `/parameters/:articleTypeId/parameters/:id` | Delete parameter |

---

## GET /parameters/:articleTypeId/parameters

### Response

```json
{
  "message": "Parameters fetched successfully",
  "data": [
    {
      "id": "param_1",
      "name": "Grammar",
      "prompt": "Check grammar",
      "scopeType": "numeric",
      "minValue": 0,
      "maxValue": 10,
      "options": []
    },
    {
      "id": "param_2",
      "name": "Category",
      "prompt": "Choose category",
      "scopeType": "option",
      "minValue": null,
      "maxValue": null,
      "options": [
        {
          "id": "opt_1",
          "label": "Good",
          "sortOrder": 1
        }
      ]
    }
  ]
}
```

---

## GET /parameters/:articleTypeId/parameters/:id

### Response

```json
{
  "message": "Parameter fetched successfully",
  "data": {}
}
```

---

## POST /parameters/:articleTypeId/parameters

### Request

#### Numeric Parameter

```json
{
  "name": "Grammar",
  "prompt": "Evaluate grammar",
  "scopeType": "numeric",
  "minValue": 0,
  "maxValue": 10
}
```

#### Option Parameter

```json
{
  "name": "Category",
  "prompt": "Choose category",
  "scopeType": "option",
  "options": [
    {
      "label": "Good"
    },
    {
      "label": "Average"
    }
  ]
}
```

### Response

```json
{
  "message": "Parameter created successfully.",
  "data": {}
}
```

---

## PATCH /parameters/:articleTypeId/parameters/:id

### Request

```json
{
  "name": "Grammar",
  "prompt": "Updated prompt",
  "scopeType": "numeric",
  "minValue": 0,
  "maxValue": 10
}
```

### Response

```json
{
  "message": "Parameter updated successfully"
}
```

---

## DELETE /parameters/:articleTypeId/parameters/:id

### Response

```json
{
  "message": "Parameter deleted successfully"
}
```

---

# Users APIs

| Method | Endpoint              | Description      |
| ------ | --------------------- | ---------------- |
| GET    | `/users`              | List users       |
| GET    | `/users/:id`          | Get user profile |
| GET    | `/users/:id/articles` | User articles    |
| PATCH  | `/users/:id`          | Update user      |
| PATCH  | `/users/:id/role`     | Update role      |
| PATCH  | `/users/:id/status`   | Update status    |

---

## GET /users

### Query Parameters

| Parameter         | Type   |
| ----------------- | ------ |
| month             | string |
| submission_status | string |

### Response

```json
{
  "message": "Users fetched successfully",
  "data": [
    {
      "message": "Users fetched successfully",
      "data": [
        {
          "id": "usr_123",
          "name": "John Doe",
          "email": "john@company.com",
          "job_role": "Developer",
          "is_active": 1,
          "auth_role": "user"
        }
      ]
    }
  ]
}
```

---

## GET /users/:id

### Response

```json
{
  "message": "User fetched successfully",
  "data": {
    "message": "User fetched successfully",
    "data": {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@company.com",
      "auth_role": "user",
      "job_role": "Developer",
      "is_active": 1,
      "created_at": "2026-09-01T10:00:00Z",
      "created_by": "usr_admin"
    }
  }
}
```

---

## GET /users/:id/articles

### Query Parameters

| Parameter | Type   |
| --------- | ------ |
| month     | string |
| status    | string |
| type      | string |

### Response

```json
{
  "message": "User articles fetched successfully",
  "data": [
    {
      "id": "art_123",
      "title": "AI Trends",
      "status": "approved",
      "ai_score": 8,
      "version": 2,
      "submitted_at": "2026-09-01T10:00:00Z",
      "user_id": "usr_123",
      "author_name": "John Doe",
      "article_type_id": "type_123",
      "article_type_name": "Technology",
      "parameters": []
    }
  ]
}
```

---

## PATCH /users/:id

### Request

```json
{
  "name": "John Doe",
  "job_role": "Developer",
  "is_active": true
}
```

### Response

```json
{
  "message": "User updated successfully"
}
```

---

## PATCH /users/:id/role

### Request

```json
{
  "role": "admin"
}
```

### Response

```json
{
  "message": "User role updated successfully"
}
```

---

## PATCH /users/:id/status

### Request

```json
{
  "is_active": false
}
```

### Response

```json
{
  "message": "User status updated successfully"
}
```

---

# Insights APIs

| Method | Endpoint                         | Description        |
| ------ | -------------------------------- | ------------------ |
| GET    | `/insights/summary`              | Submission summary |
| GET    | `/insights/employee-submissions` | Employee analytics |

---

## GET /insights/summary

### Query Parameters

| Parameter | Type    |
| --------- | ------- |
| start     | YYYY-MM |
| end       | YYYY-MM |

### Response

```json
{
  "summary": {}
}
```

---

## GET /insights/employee-submissions

### Query Parameters

| Parameter | Type    |
| --------- | ------- |
| start     | YYYY-MM |
| end       | YYYY-MM |

### Response

```json
{
  "employees": []
}
```

---

# Authentication

All endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

Only users with `admin` or `super_admin` roles can access Admin APIs.
