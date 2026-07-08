# Access & billing flows (plan)

Status: **planning only.** Nothing here is built. Auth and team flows already
exist in the app; billing (Stripe) does not. This doc is the spec to build
against when billing work starts.

Decision locked with the founder: **credit card required up front** for a
**7-day free trial**. Card is captured after email verification, before the app.
Nothing is charged until day 7.

---

## 0. Source of truth (read this first)

One rule underpins every flow below:

- **Stripe owns billing state.** It runs the trial clock, charges cards, retries
  failures, manages renewals.
- **A webhook mirrors that state into our database.** Store only
  `stripe_customer_id` and `subscription_status` (`trialing` | `active` |
  `past_due` | `canceled`) on the org/user. Never store card data.
- **The app and the landing page read our DB, never Stripe live.** The app gates
  access on `subscription_status`; the landing page only checks the login session.

If the webhook is wrong, everything downstream is wrong. It is the single most
important piece to get right.

---

## 1. Signup + trial (new user)

Happy path, all green:

```
Landing "Start free trial"
  → Sign up (name, email, password)      [exists: app/auth/signup]
  → Verify email (click inbox link)      [exists: app/auth/confirm]
  → Add card (Stripe Checkout, trial starts, NOT charged)   [NEW]
  → Onboarding (create workspace)        [exists: app/auth/onboarding]
  → In the app, 7-day trial running
```

- Card is captured *after* verify, *before* the app. Trial only starts once a
  valid card is on file. Rationale: after-verify converts better than card-first
  because the user has already invested effort.
- On day 7 Stripe auto-charges. Outcomes handled in flow 3.

Edge cases to handle:
- User abandons at the card step → account exists but no subscription. Decide:
  block the app until card added, or allow a card-less limbo state. Recommend:
  block, route them back to Checkout on next sign-in.
- Email never verified → cannot reach the card step (already enforced by Supabase).

---

## 2. Sign-in + access gating (returning user)

Sign-in is not one destination. The app middleware reads `subscription_status`
and routes:

| status              | route                                   |
|---------------------|-----------------------------------------|
| `trialing` / `active` | full dashboard                        |
| `past_due`          | dashboard + persistent "update card" banner (grace) |
| `canceled` / `unpaid` | locked screen; only action is "Update card" |

- **Locked → Update card** sends the user to the Stripe billing portal. New card
  → webhook fires → DB flips to `active` → access restored. (The green loop.)
- The gate lives in one place (middleware / session check) so every route is
  protected by the same read. An account can never be inside the app while unpaid.

**Landing page sync:** on load, check for a Supabase session.
- Logged out → CTAs stay "Start free trial" + "Sign in".
- Logged in → swap primary CTA to "Go to dashboard".
Landing needs only the session, not billing status.

Open decision: does `past_due` keep **full** access during dunning, or degrade to
**read-only**? Recommend full access, past due is usually a stale card, not a
non-payer.

---

## 3. Trial lifecycle & dunning

```
Day 0   card captured, trial starts (trialing)
Day 5   reminder email: "trial ends in 2 days"        [needs email provider]
Day 7   Stripe auto-charge:
          success  → active                            (silent, no user action)
          failure  → past_due → dunning retries        (Stripe retries ~4x/week)
                       recovered → active
                       exhausted → canceled → locked screen
Anytime user cancels in trial → canceled, never charged
```

- Reminder + dunning emails depend on a transactional email provider. Confirm one
  is wired up; if not, this is a prerequisite.
- All state transitions arrive via webhook and update `subscription_status`.

---

## 4. Seats ↔ Stripe sync (per-seat billing)

**The most important billing flow, because team invites already exist but are
currently free.** Pricing is per seat ($149/seat/mo on Team), so:

- **Invite accepted / member added** → increment the Stripe subscription
  `quantity` by 1. Stripe prorates the mid-cycle cost automatically.
- **Member removed** → decrement `quantity`. Proration credit applies to the next
  invoice.
- **Pending invites**: decide whether an unaccepted invite counts as a paid seat.
  Recommend billing only on *accepted* seats.

Hooks into: `app/api/team/invite`, `app/api/team/accept`, `app/api/team/member`.
Each of these must also call Stripe to adjust quantity, then let the webhook
reconcile `subscription_status` / seat count back into the DB.

Edge cases:
- Removing the **billing owner** — block it, or force ownership transfer first.
- Downgrading seat count below the number of active members — block, or force
  removing members first.

---

## 5. Plan changes

- **Upgrade** (Starter → Team): change the Stripe price, proration is immediate.
- **Downgrade**: apply at period end, and check the target plan's limits aren't
  already exceeded (e.g. downgrading to Starter's 5-bid cap while over it).
- **Monthly ↔ annual**: separate prices; annual usually discounted.

---

## 6. Usage limits

Starter is "up to 5 bids/month." Nothing enforces this today.

- Count active bids/deals per billing period against the plan cap.
- At the cap → block new-deal creation with an upgrade prompt (not a hard error).
- `active` / Team = unlimited.

---

## 7. Cancellation & offboarding

- "Are you sure" step (optional win-back offer).
- Cancel → `canceled` at period end (keep access until then) or immediately.
- Offboarding: data export, then retention/deletion per policy. Enterprise pricing
  promises "retention controls", currently unbuilt.

---

## What's already built vs. new

**Built:** login, signup, forgot/reset password, email confirm, onboarding, team
invite/accept/member management, and the full product workflow (deals, KB,
questions, responses, exports, library, templates).

**New (all billing):** Stripe account + products/prices, `stripe_customer_id` +
`subscription_status` columns, checkout route, webhook route, billing portal
route, access-gating middleware read, seat-quantity sync in the team routes,
usage-limit enforcement, and trial/dunning emails.

**Prerequisite to confirm:** a transactional email provider (flows 3 and the
notification story depend on it).

---

## Recommended build order

1. **Stripe scaffolding** — account, products/prices, DB columns, checkout +
   webhook + portal routes, test-mode cards.
2. **Access gating** — middleware reads `subscription_status`; locked screen.
3. **Seats ↔ Stripe sync** — wire the existing team routes to adjust quantity.
4. **Usage limits** — enforce Starter's cap.
5. **Trial + dunning emails** — day-5 reminder, failure notices.

Flows 5 (plan changes) and 7 (cancellation) can follow once the core is live.
