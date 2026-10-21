# Streaks, support and round totals

- Member pages: `streaks.html`, `support.html` (linked from Menu).
- Admin page: `admin-community.html` (linked from Admin).
- All streak types default to inactive. Admins enable each type individually.
- Daily check-ins are explicit and use UTC. A weekly streak means consecutive Monday-starting weeks with at least one check-in; monthly means consecutive calendar months with at least one check-in. The previous period remains current until the current period ends, so users have time to check in.
- Pausing a type pauses its rewards, not historical check-ins. A check-in can be recorded when any type is enabled and contributes to all period calculations.
- Rewards are never automatic. Admins review a UID and manually pay an amount to its wallet. A transaction records the payment and prevents duplicate rewards for that user/type/current UTC period. Admins cannot edit reward records.
- Support tickets and replies are private to their owner and admins. Admins close/reopen tickets. Replies are available inside the app; no email/push delivery is implemented.
- All three game lobbies now sum a user's entry scores for the selected round, including prize ranking. Each entry retains its own score; new rounds start independently. Existing completed-round payouts are not recalculated.

## Deployment / verification

Deploy the updated `firestore.rules` before using the new pages (`firebase deploy --only firestore:rules`, or publish through Firebase Console). Publish the static HTML, CSS and JS files together.

Run `node --test tests/engagement.test.mjs` for aggregation and calendar logic coverage. Authenticated Firebase integration and deployed security rules must also be tested with two member accounts and an admin: duplicate check-in, unauthorized ticket read/reply, reward while inactive, repeated reward payment, concurrent reward payment, and round totals after multiple entries. Those integration checks were not run in the sandbox.

The existing application's client-managed wallet and game-score trust model is unchanged; these additions do not make scores or existing wallet operations tamper-proof. A trusted backend is recommended for financial operations and authoritative gameplay validation.
