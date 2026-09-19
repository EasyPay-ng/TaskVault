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

## The security rules (`firestore.rules`)

Deploy once with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

…or open **Firebase Console → Firestore Database → Rules**, paste the
file and press **Publish**.

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

## Deposit system — manual admin verification (sender name + transaction ID)

The old flow let any user type in a number and be credited instantly. The
current flow:

1. **Request** — `deposit.html` creates a `transactions` doc with
   `status: 'awaiting_payment'`, a **unique remark** (`CC-XXXXXX-NNNN`),
   the exact ₦ amount, and a **30-minute window** to make the transfer.
   No balance change. (User-facing copy promises approval **within 24
   hours**, most in minutes.)
2. **Pay** — user transfers the exact amount with the exact remark.
3. **Submit** — user enters their **sender name** (prefilled from KYC)
   and the **bank transaction ID** (≥ 24 digits), which moves the doc to
   `pending`. If the 30-minute window lapses first, the request becomes
   `expired`.
4. **Admin decision** — in `admin-deposits.html` the admin sees the
   remark, amount, sender name and transaction ID for each pending
   deposit, matches **all four** against the bank statement/app, then
   **Approve** (credits the balance) or **Reject** (with a reason shown
   to the user).

Why this is safe now: the user can only ever do
`awaiting_payment → pending` (or `→ expired`) on their **own** deposit —
the Firestore rules forbid any other self-update, so a user can never
set `completed`, touch a balance, or approve anything. Only the two admin
emails (server-side, per `firestore.rules`) can credit.

**Operational notes**

- The bank account's statement is the ground truth: a "pending" deposit
  is only real money if the matching transfer (remark + exact amount +
  sender + reference) actually appears. If it doesn't, reject.
- Approve same-day wherever possible — users are promised 24 hours.
- Repeated rejected deposits from the same account → consider a KYC
  hold or account block.
- Later upgrades that slot in without breaking this flow: automatic
  receipt-image verification, or Paystack/Flutterwave transfer
  verification (gateway confirms the transfer server-side, webhook
  credits the balance — zero humans).

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
