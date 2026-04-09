# Plan: Pipedrive – Get Most Recent Activity Title for a Deal

## Goal
Build a function/module that, given a **deal ID**, calls the Pipedrive API and returns the **title (subject) of the most recent activity** associated with that deal.

---

## Background & Research

### What is an Activity in Pipedrive?
Activities are appointments, tasks, or calendar events that can be linked to a deal, lead, person, or organisation. Each activity has a `subject` field — this is the "title" shown in the UI. Activities can also have a `type` (call, meeting, email, etc.) defined by the `ActivityTypes` object.

### API Version
- **Prefer API v2** (`/api/v2/activities`) — it is the current recommended version with better performance and stricter validation.
- v1 (`/api/v1/deals/{id}/activities`) also exists but some v1 deal sub-endpoints are being deprecated in favour of v2 filters.

---

## Endpoint to Use

```
GET https://{COMPANY_DOMAIN}.pipedrive.com/api/v2/activities
```

### Key Query Parameters

| Parameter   | Value            | Notes                                           |
|-------------|------------------|-------------------------------------------------|
| `deal_id`   | `<your deal id>` | Filters activities to only those on this deal   |
| `sort_by`   | `add_time`       | Sort by when the activity was added             |
| `sort_direction` | `desc`      | Most recent first                               |
| `limit`     | `1`              | Only fetch the single most recent activity      |

### Response Field of Interest
The activity title lives at:
```
response.data[0].subject
```

---

## Authentication

### Option A — API Token (recommended for internal tools)
Pass the token in the request header:
```
x-api-token: <YOUR_API_TOKEN>
```
**Where to find it:** Pipedrive → Settings → Personal preferences → API

> An API token is tied to a specific user and grants access to all that user's data. Never commit it to source control — use environment variables.

### Option B — OAuth 2.0 Bearer Token (required for public/marketplace apps)
```
Authorization: Bearer <ACCESS_TOKEN>
```
Use this if the integration will be used by multiple Pipedrive accounts.

---

## Implementation Steps

### 1. Set Up Environment
- Store credentials in a `.env` file (never hardcode):
  ```
  PIPEDRIVE_API_TOKEN=your_token_here
  PIPEDRIVE_DOMAIN=yourcompany
  ```

### 2. Write the Function

```typescript
// pipedrive.ts (TypeScript example — adapt to project's language)

const DOMAIN = process.env.PIPEDRIVE_DOMAIN;
const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;

export async function getMostRecentActivityTitle(dealId: number): Promise<string | null> {
  const url = new URL(`https://${DOMAIN}.pipedrive.com/api/v2/activities`);
  url.searchParams.set('deal_id', String(dealId));
  url.searchParams.set('sort_by', 'add_time');
  url.searchParams.set('sort_direction', 'desc');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-token': API_TOKEN!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Pipedrive API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success || !data.data || data.data.length === 0) {
    return null; // No activities found for this deal
  }

  return data.data[0].subject; // This is the activity "title"
}
```

### 3. Handle Edge Cases
- **No activities on deal** → `data.data` will be an empty array; return `null` gracefully.
- **Invalid deal ID** → API returns a 404 or empty result; handle with a clear error message.
- **Expired / invalid token** → API returns 401; surface this clearly to the caller.
- **Rate limits** → Pipedrive enforces a limit per 2-second window per token. Add retry logic with exponential backoff if this is a high-frequency integration.

### 4. (Optional) Also Return Activity Metadata
If you need more than just the title, the `data[0]` object also includes:
- `type` — activity type key (e.g. `"call"`, `"meeting"`)
- `due_date` / `due_time` — scheduled time
- `add_time` — when it was created (RFC 3339 in v2)
- `done` — boolean, whether the activity is marked complete
- `user_id` — the assigned user
- `note` — free-text notes on the activity

---

## Rate Limit Guidance
- **Per-token limit:** Requests per 2-second window (check `x-ratelimit-remaining` response header).
- **Daily write limit:** 10,000 POST/PUT requests per 24 hours, resetting at midnight UTC. Check `x-daily-requests-left` header.
- For this use case (read-only GET), rate limits are unlikely to be an issue unless running in bulk.

---

## Testing
1. Use a **Pipedrive sandbox account** for development — create one at developers.pipedrive.com.
2. Manually create a deal with 2–3 activities in the sandbox.
3. Call the function with the sandbox deal ID and assert the returned subject matches the most recently added activity.

---

## Files to Create
```
src/
  pipedrive.ts       ← the function above
  pipedrive.test.ts  ← unit/integration tests
.env.example         ← document required env vars (no real values)
```

---

## References
- Pipedrive Activities API v2: https://developers.pipedrive.com/docs/api/v1/Activities
- Pipedrive Authentication: https://pipedrive.readme.io/docs/core-api-concepts-authentication
- API v2 Migration Guide: https://pipedrive.readme.io/docs/pipedrive-api-v2-migration-guide
