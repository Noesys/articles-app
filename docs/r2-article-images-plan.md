# R2-backed article images

> Goal: keep D1 article bodies as text + short image URLs; store binary media in R2 so paste/import never blows past content size limits with base64.

**Context:** Seed/import hit `SQLITE_TOOBIG` when mammoth embedded `data:image/...;base64,...` into HTML. Prior discuss: [import / R2 thread](../../.cursor/projects/Users-naresh-Projects-articles-app/agent-transcripts/99d73179-9b0e-4b96-8710-ca83a512fc51/99d73179-9b0e-4b96-8710-ca83a512fc51.jsonl).

---

## Progress

| Phase | Status | Notes |
|---|---|---|
| **0** — Plan + locked decisions | [x] | This doc |
| **1** — R2 bucket + Worker binding | [x] | `contiq-article-images` → `IMAGES` |
| **2** — Upload + serve API | [x] | `POST/GET /api/images` |
| **3** — TipTap toolbar / paste / drop → R2 | [x] | Stop writing new base64 from editor |
| **4** — Deploy + verify | [ ] | `npm run deploy` |
| **5** — Seed/import rewrite (optional) | [ ] | mammoth → R2 → `<img src="/api/images/...">` |

---

## Locked decisions

| Decision | Lock | Why |
|---|---|---|
| **Bucket** | Name `contiq-article-images`, binding `IMAGES` | Contiq-scoped; one media bucket |
| **Object key** | `articles/{userId}/{uuid}.{ext}` | Ownership clear; no need for articleId at upload time |
| **Upload API** | `POST /api/images` multipart field `file`; **Access auth** (same as articles) | Simplest; no signed-URL dance |
| **Serve** | Worker proxy `GET /api/images/{userId}/{filename}` | Same-origin URLs; no public r2.dev / custom domain for v1 |
| **URL in HTML** | Relative `/api/images/{userId}/{filename}` | Works with Vite proxy + production Worker; sanitize already allows `/` |
| **Auth on GET** | No Worker `accessAuth` on GET (unguessable UUID keys) | `<img>` loads reliably; CF Access still gates the hostname in prod |
| **Types** | `image/jpeg`, `image/png`, `image/gif`, `image/webp` | Match editor accept |
| **Size** | Max **2 MB** after client compress | Matches existing client limit |
| **Lifecycle** | Keep objects forever (v1) | No orphan GC; articles may share history snapshots |
| **Existing content** | Leave external `https://` and any leftover `data:` alone | No migration job in v1 |
| **New editor images** | Always upload to R2; **do not** inline remote → base64 | Prevents D1 bloat; remote `https` srcs stay as-is |
| **Sanitize** | Keep stripping `data:` / `javascript:` on `src` | Encourages R2 URLs; existing base64 was already dropped on save |
| **Seed/import** | Out of v1 scope (Phase 5) | Editor path unblocks day-to-day writing first |

---

## API sketch

```
POST /api/images
  Auth: accessAuth
  Body: multipart/form-data field "file"
  → 201 { success, data: { key, url, contentType, size } }

GET /api/images/:userId/:filename
  Auth: none (Worker); CF Access on hostname in prod
  → 200 image bytes + Content-Type / Cache-Control
```

---

## Frontend sketch

- `uploadArticleImage(file)` → compress if needed → `FormData` → `POST /api/images` → returns `url`
- TipTap toolbar image button uses upload (not `convertImageToBase64`)
- SmartPaste file paste/drop uploads to R2; `inlineRemoteImages` default **false**
- `http-client`: do not force `Content-Type: application/json` for `FormData`

---

## Tradeoffs (accepted)

| Choice | Upside | Downside |
|---|---|---|
| Worker proxy vs public bucket | One deploy surface; Access-friendly | Extra Worker bandwidth vs R2 public CDN |
| Relative `/api/images/...` | Same-origin, no CORS | Images only load on Contiq origin |
| No GC | Simple | Orphans after abandoned drafts |
| Seed later | Smaller v1 | Historical imports stay image-less until Phase 5 |

---

## Manual / ops notes

- Create bucket once: `npx wrangler r2 bucket create contiq-article-images` (from `article-api`)
- No R2 CORS config needed for Worker-proxy serving
- Local `wrangler dev` uses local R2 simulation automatically with the binding
