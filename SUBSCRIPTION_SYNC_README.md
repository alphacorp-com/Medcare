# Subscription Status Synchronization

This document describes the subscription status synchronization system that automatically updates tenant statuses based on their subscription status.

## Overview

The subscription sync system ensures that:
1. When a subscription's status changes, the corresponding tenant status is automatically updated
2. When a subscription period expires (currentPeriodEnd < now), the subscription is marked as `past_due` and the tenant is suspended
3. Subscription and tenant statuses remain in sync at all times

## Status Mapping

### Subscription → Tenant Status Mapping

| Subscription Status | Tenant Status | Tenant Action |
|-------------------|---------------|--------------|
| `trial` | `trial` | Tenant is in trial period |
| `active` | `active` | Tenant is active; clear any suspension date |
| `past_due` | `suspended` | Tenant is suspended; set suspension date |
| `cancelled` | `churned` | Tenant is churned; set churned date |
| None (no active subscription) | `churned` | Tenant has no active subscription |

## Cron Job Setup

The system includes a cron endpoint at `GET /api/cron/check-subscriptions` that:
- Finds all subscriptions where `currentPeriodEnd < now` and status is `active` or `trial`
- Updates their status to `past_due`
- Automatically syncs the corresponding tenant statuses to `suspended`

### Setting Up the Cron Job

#### Option 1: Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Option 2: External Cron Service (EasyCron, Cron-job.org, etc.)

Create a cron job with:
- **URL**: `https://your-domain.com/api/cron/check-subscriptions`
- **Method**: GET or POST
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule**: Every hour (or your preferred interval)

#### Option 3: AWS EventBridge / Lambda

Create a Lambda function that makes an HTTP request to the endpoint:

```javascript
const https = require('https');

exports.handler = async (event) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'your-domain.com',
      path: '/api/cron/check-subscriptions',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(JSON.parse(data)); });
    });

    req.on('error', reject);
    req.end();
  });
};
```

### Environment Variables

Set the following environment variable in your `.env`:

```env
CRON_SECRET=your-secure-random-secret-here
```

This secret is used to authenticate cron job requests. If not set, the cron endpoint will accept requests without authentication.

## API Endpoints

### 1. Update Subscription Status

**Endpoint**: `PATCH /api/admin/subscriptions`

**Authentication**: Admin user only

**Request Body**:
```json
{
  "subscriptionId": "uuid",
  "status": "active" | "trial" | "past_due" | "cancelled"
}
```

**Response**:
```json
{
  "message": "Subscription status updated successfully",
  "subscription": {
    "id": "uuid",
    "tenantId": "uuid",
    "planId": "uuid",
    "status": "active",
    "tenant": {
      "id": "uuid",
      "name": "Hospital Name",
      "slug": "hospital-slug",
      "status": "active"
    }
  }
}
```

### 2. List All Subscriptions

**Endpoint**: `GET /api/admin/subscriptions`

**Authentication**: Admin user only

**Response**: Returns list of subscriptions with tenant and plan info

### 3. Create Subscription

**Endpoint**: `POST /api/admin/subscriptions`

**Authentication**: Admin user only

**Request Body**:
```json
{
  "tenantId": "uuid",
  "planId": "uuid",
  "status": "active",
  "currentPeriodStart": "2026-05-01T00:00:00Z",
  "currentPeriodEnd": "2026-06-01T00:00:00Z"
}
```

### 4. Sync Individual Tenant Status

**Endpoint**: `POST /api/admin/tenants/[id]/sync-status`

**Authentication**: Admin user only

**Purpose**: Manually sync a specific tenant's status based on their current subscription

**Response**:
```json
{
  "message": "Tenant status synced successfully",
  "tenant": {
    "id": "uuid",
    "name": "Hospital Name",
    "status": "active",
    "subscriptions": []
  }
}
```

### 5. Check Expired Subscriptions (Cron)

**Endpoint**: `GET|POST /api/cron/check-subscriptions`

**Authentication**: Bearer token (CRON_SECRET)

**Purpose**: Finds and updates all expired subscriptions

**Response**:
```json
{
  "message": "Subscription expiration check completed successfully",
  "timestamp": "2026-05-03T10:30:00Z"
}
```

## Implementation Details

### Core Functions

All subscription sync logic is in `/lib/subscription-sync.ts`:

#### `syncTenantStatus(tenantId: string)`
- Finds the most recent active subscription for a tenant
- Updates tenant status based on subscription status
- Sets `suspendedAt` or `churnedAt` as needed

#### `checkAndUpdateExpiredSubscriptions()`
- Finds all subscriptions with `currentPeriodEnd < now`
- Updates their status to `past_due`
- Syncs tenant statuses for each updated subscription

#### `updateSubscriptionStatus(subscriptionId: string, newStatus: SubscriptionStatus)`
- Updates a subscription's status
- Automatically syncs the tenant's status
- Sets `cancelledAt` if status is `cancelled`

## Integration Points

### When Subscription Status Changes

The system automatically syncs tenant status when:
1. Creating a new subscription via `POST /api/admin/subscriptions`
2. Updating a subscription status via `PATCH /api/admin/subscriptions`
3. Running the cron job for expired subscriptions

### When to Manually Trigger Sync

Use `POST /api/admin/tenants/[id]/sync-status` if:
- A subscription record is updated directly in the database
- A tenant's subscription status needs to be re-synced
- Debugging tenant status issues

## Monitoring & Logging

The sync functions log important events:
- When subscriptions are updated to `past_due`
- When tenant statuses are changed
- Errors during synchronization

Check your application logs for entries from:
- `subscription-sync.ts`
- `/api/admin/subscriptions`
- `/api/cron/check-subscriptions`

## Error Handling

The system includes error handling for:
- Missing subscriptions (tenant marked as churned)
- Database connectivity issues
- Invalid status transitions

Errors are logged to console and appropriate HTTP status codes are returned to the client.

## Example Workflow

1. **Day 1**: Create subscription for a hospital
   - API: `POST /api/admin/subscriptions`
   - Tenant status → `trial` or `active`

2. **Day 30**: Subscription period ends
   - Cron job runs automatically
   - Subscription status → `past_due`
   - Tenant status → `suspended`
   - Tenant can no longer access the system

3. **Day 35**: Admin manually renews subscription
   - API: `PATCH /api/admin/subscriptions` (status: `active`)
   - Tenant status → `active`
   - Tenant can access the system again

## Troubleshooting

### Cron Job Not Running

1. Verify `CRON_SECRET` environment variable is set
2. Check cron service logs
3. Test manually: `curl https://your-domain.com/api/cron/check-subscriptions -H "Authorization: Bearer YOUR_CRON_SECRET"`

### Tenant Status Not Updating

1. Verify subscription exists for the tenant
2. Check subscription status is valid (trial, active, past_due, cancelled)
3. Manually sync: `POST /api/admin/tenants/[id]/sync-status`

### Subscription Period Not Expiring

1. Ensure `currentPeriodEnd` date is in the past
2. Cron job may not have run yet (check schedule)
3. Manually trigger cron: `GET /api/cron/check-subscriptions`

## Future Enhancements

Possible improvements:
- Grace period for `past_due` subscriptions before suspension
- Webhook notifications when subscription expires
- Email alerts to tenant admins
- Automatic retry logic for payment processing
- Subscription renewal reminders
