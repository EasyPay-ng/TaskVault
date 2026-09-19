# TaskVault — Admin Access & Data Security

## How admin access works

The two admin accounts are:

- `beniwealth70@gmail.com`
- `baasituoppor01@gmail.com`

**Every admin page** (`admin.html`, `admin-deposits.html`, `admin-kyc.html`,
`admin-offers.html`, `admin-stakes.html`, `admin-tasks.html`,
`admin-withdrawals.html`, `admin-game.html`) already checks the signed-in
email against this list (case-insensitive) and shows an access-denied
screen to everyone else. The allowlist is duplicated on each page on
purpose — the pages use different Firebase SDK versions, so a shared
module would be fragile. **If you add a new admin, add the email to all
8 pages AND to `firestore.rules` (`isAdmin()` function).**

The email check on a page is only a **UI gate** — anyone can read page
source. The real enforcement is the Firestore security rules below, which
run on Google's servers and block any request that the rules don't allow,
even a raw SDK call from a browser console.

## The security rules (`firestore.rules` + `storage.rules`)

Deploy once with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy          # deploys rules + storage rules + functions
```

…or open **Firebase Console → Firestore Database → Rules**, paste the file
and press **Publish** (same for **Storage → Rules**).

…or open **Firebase Console → Firestore Database → Rules**, paste the file
and press **Publish**.

What the rules lock down:

| Data | Regular user | Admin |
|---|---|---|
| Own profile (`users/{ownUid}`) | read + update | read + update |
| **Anyone else's profile** | credit-only: may increase `balance` / `totalGameWon` / `totalReferralCommission` / `totalEarned` / `updatedAt` (needed for game prizes, P2P receives, referral commission, task rewards). **Cannot touch name, email, plan, KYC, referral code, or decrease anyone's balance** | full access |
| `withdrawals` status (approve/reject/refund) | ❌ cannot update | ✅ |
| `transactions` (deposits/activation) status | ❌ | ✅ |
| `verification` (KYC) status | ❌ | ✅ |
| `advertise_tasks` | read/create own, edit **own** tasks (approve & pay workers) | ✅ |
| `advert_submissions` | create own; move pending → approved/rejected (bookkeeping only) | ✅ |
| `gameSettings` (entry fee, 1st–5th prizes, max entries, status) | read only | ✅ |
| `referralCommissions` | read own | ✅ only writer |
| Stake `products` | buy/sell stock (`available` only) — price/name/setup locked | ✅ |
| Stake `buybacks` | `unitsBought`/`status` only | ✅ |
| `orders` | update orders they are a party to | ✅ (+delete) |
| Game round entries | create/update **own entry only** | ✅ |
| Everything else (incl. old 2D-shooter collections) | ❌ denied | ❌ denied |

### Verifying it works

1. Sign in to the Firebase console as one of the admin accounts, open
   DevTools (F12) → Console on any page, and run:
   ```js
   db.collection('gameSettings').doc('default').update({ entryFee: 999 })
   ```
   as a **regular** user → should throw `permission-denied`.
2. As a regular user, try
   `db.collection('withdrawals').doc('<anyId>').update({ status: 'approved' })`
   → `permission-denied`.
3. Confirm normal features still work: referral page loads, entering a
   game, P2P transfer, stake buy/sell, deposit/withdrawal request.

## Deposit system v2 — receipt-image verification

The old flow let any user type in a 24-digit number and be credited
instantly. The new flow (this is what makes deposits trustworthy):

1. **Request** — `deposit.html` creates a `transactions` doc with
   `status: 'awaiting_payment'`, a **unique remark** (`CC-XXXXXX-NNNN`),
   the exact ₦ amount, and a **30-minute expiry**. No balance change.
2. **Pay** — user transfers the exact amount with the exact remark.
3. **Proof** — user enters their **sender name** and uploads a
   **screenshot of the successful transfer** to
   `proofs/{uid}/{depositId}` (private Storage path) and sets the doc to
   `processing`.
4. **Machine check** — the Cloud Function `verifyDepositProof`
   (`functions/index.js`) reads the image with a Gemini vision model and
   deterministically checks:
   - receipt **remark** == the deposit's unique remark
   - receipt **amount** == the requested ₦ amount (exact)
   - receipt **sender name** ≈ the sender name the user entered
     (order/case-insensitive token match)
   - receipt **time** inside the request window
5. **Outcome**
   - all pass, ≤ $20 → `completed`, balance credited **server-side**
   - all pass, > $20 → `verified` → your one-click **Confirm & Credit**
     in `admin-deposits.html`
   - any failure / unreadable image → `failed` / `manual_review` → you
     decide (the receipt image + machine-read values are shown in the
     admin detail modal)
   - `expireStaleDeposits` (every 10 min) marks abandoned requests
     `expired`

**Honest limit:** a screenshot is evidence, not a bank confirmation — a
skilled attacker could forge one. The barriers are the unique-per-request
remark (no replay), the exact-amount match, the sender-name match against
what they typed, the time window, the admin confirm above $20, and your
bank statement as the final ground truth (cross-check any suspicious
"verified" deposit against the actual transfer, reject + block if the
money never arrived). For fully unforgeable verification, add
Paystack/Flutterwave transfer verification later — the flow above
coexists with it.

**One-time setup (Firebase Console):**
1. Enable **Cloud Storage** (default bucket is fine).
2. Enable **Cloud Functions**.
3. Create a **Gemini API key** (Google AI Studio, free tier is enough).
4. Set the function environment variables:
   `GEMINI_API_KEY` (required), `GEMINI_MODEL` (default
   `gemini-2.5-flash`), `AUTO_APPROVE_LIMIT` (default `20`).
5. `firebase deploy` (deploy order: rules → storage → functions).

## Honest limitations (what rules alone can't fix)

This site runs its whole economy client-side, so a determined user can
always run arbitrary JS in their own browser. The rules stop them from
touching **other people's and the platform's** data, but they can still:

1. **Edit their own profile/balance fields** — the app itself updates the
   user's own balance in the browser (task rewards, game prizes, daily
   claim), so the rules must allow it. A user can do the same thing
   manually from DevTools.
2. **Trigger a game-round end from their own client** (the lobby does
   this client-side), which controls when prizes are paid out.
3. **List all withdrawals/commissions** (they can query their own
   records, and the query permission applies to the whole collection).

The permanent fix for all three is moving money movement into **Cloud
Functions** (server-side): the function approves withdrawals + pays the
5% commission, ends game rounds on a schedule, and credits balances.
Until then, the rules above are the strongest protection this
static-architecture app can have — they make all *admin* data
(read/write of settings, approvals, tasks, KYC, other users) impossible
to touch from any non-admin browser.

## Adding a new admin (checklist)

1. Firebase Console → **Authentication**: make sure the account exists.
2. `firestore.rules` → add the email to `isAdmin()` → deploy rules.
3. Add the email to `ADMIN_EMAILS` in **all 8** admin pages.
4. Push/deploy the site.
