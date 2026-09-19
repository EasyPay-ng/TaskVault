/**
 * TaskVault — server-side deposit verification
 *
 * Flow (deposit.html):
 *   1. User requests a deposit -> a `transactions` doc is created with
 *      status 'awaiting_payment', a unique remark (CC-XXXXXX-NNNN) and a
 *      30-minute expiry.
 *   2. User pays that exact amount with that exact remark, then uploads a
 *      screenshot of the successful transfer to
 *      `proofs/{userId}/{depositId}` in Cloud Storage and sets the doc to
 *      'processing'.
 *   3. THIS FUNCTION (storage trigger) reads the image with a Gemini
 *      vision model, extracts the remark / amount / sender name / time
 *      from the receipt, checks them against the deposit doc, and then:
 *        - all checks pass AND amount <= AUTO_APPROVE_LIMIT
 *            -> 'completed', balance credited HERE (server-side)
 *        - all checks pass, amount > limit
 *            -> 'verified' (admin confirms with one click in
 *               admin-deposits.html)
 *        - any check fails / image unreadable
 *            -> 'failed' or 'manual_review' (admin decides)
 *
 * Required environment variables (Firebase Console -> Functions ->
 * Configure, or `firebase functions:secrets:set`):
 *   GEMINI_API_KEY      - a Google AI Studio API key
 *   GEMINI_MODEL        - optional, default "gemini-2.5-flash"
 *   AUTO_APPROVE_LIMIT  - optional USD limit for fully-automatic
 *                         approval, default 20
 */

const { onObjectFinalize } = require('firebase-functions/v2/storage');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AUTO_APPROVE_LIMIT = parseFloat(process.env.AUTO_APPROVE_LIMIT || '20');
const CLOCK_SKEW_MS = 10 * 60 * 1000; // 10 min tolerance on receipt time

// ============================================================
// Receipt reading (Gemini vision)
// ============================================================

const RECEIPT_PROMPT = `You are a payment receipt verifier for Nigerian bank transfer deposits.
Look carefully at this transfer receipt screenshot. Extract ONLY what is clearly visible.
Return a JSON object with exactly these keys:
{
  "remark": string or null,        // the transfer remark / reference code the sender used (often looks like CC-XXXX-NNNN)
  "amountNGN": number or null,     // the amount in Nigerian Naira (digits only, no currency symbol)
  "senderName": string or null,    // the name of the sender / transferor / payer account shown on the receipt
  "bankName": string or null,      // the bank or app name shown (e.g. GTBank, Kuda, OPay, Moniepoint, PalmPay, Access, Wema, Zenith, First Bank)
  "paymentDateTime": string or null, // when the transfer was made, as ISO 8601 in the shown local time, e.g. "2026-09-19T14:32:00"; null if not visible
  "bankReference": string or null  // a bank-generated transaction / narration / reference ID that is distinct from the sender-chosen remark
}
Rules:
- Use null for anything not clearly visible. Never guess or invent values.
- Do not output anything except the JSON object.`;

async function readReceipt(base64, mimeType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: RECEIPT_PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Gemini returned no text');

  // The model is asked for JSON only; be defensive anyway.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    remark: parsed.remark ?? null,
    amountNGN: parsed.amountNGN ?? null,
    senderName: parsed.senderName ?? null,
    bankName: parsed.bankName ?? null,
    paymentDateTime: parsed.paymentDateTime ?? null,
    bankReference: parsed.bankReference ?? null,
  };
}

// ============================================================
// Normalizers & checkers (deterministic — the model only extracts,
// we decide)
// ============================================================

function normRemark(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when two person names plausibly refer to the same account holder
 * (order-independent token match, or containment — bank screens show
 * names in different casing/order than the user types).
 */
function nameMatches(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (na.length < 3 || nb.length < 3) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = new Set(nb.split(' ').filter(Boolean));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 && inter / union >= 0.6;
}

function parseAmount(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Loose parser for receipt times: ISO, "19/09/2026 14:32",
 * "Sep 19, 2026 2:32 PM", etc. Returns a Date or null.
 */
function parseReceiptDate(s) {
  if (!s) return null;
  s = String(s).trim();

  // dd/mm/yyyy[ hh:mm[:ss]]  (common on NG banking apps)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, d, mo, y, h, mi, sec] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      h === undefined ? 0 : Number(h),
      mi === undefined ? 0 : Number(mi),
      sec === undefined ? 0 : Number(sec)
    );
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // ISO or anything Date understands ("2026-09-19T14:32:00", "Sep 19, 2026 2:32 PM")
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt;
  return null;
}

function toMs(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// ============================================================
// The verifier
// ============================================================

// Triggers on the project's default Storage bucket; we filter the
// "proofs/**" prefix inside the handler below.
exports.verifyDepositProof = onObjectFinalize(async (event) => {
    const file = event.data; // a google.cloud.storage.Object resource
    // file.name looks like "proofs/{userId}/{depositId}"
    const parts = (file.name || '').split('/').filter(Boolean);
    if (parts[0] !== 'proofs' || parts.length < 3) {
      console.warn('Skipping non-proof object:', file.name);
      return;
    }
    const userId = parts[1];
    const depositId = parts[parts.length - 1];

    const db = admin.firestore();
    const depositRef = db.collection('transactions').doc(depositId);
    const depositSnap = await depositRef.get();

    if (!depositSnap.exists) {
      console.warn(`Deposit ${depositId} not found for proof ${file.name}`);
      return;
    }
    const deposit = depositSnap.data();
    if (deposit.type !== 'deposit' || deposit.userId !== userId) {
      console.warn(`Proof ${file.name} does not match deposit ${depositId}`);
      return;
    }
    if (deposit.status === 'completed' || deposit.status === 'rejected' || deposit.status === 'expired') {
      console.info(`Deposit ${depositId} already final (${deposit.status}); ignoring proof`);
      return;
    }

    // Expired requests are never credited, whatever the image shows.
    const expiresAtMs = toMs(deposit.expiresAt);
    if (expiresAtMs !== null && expiresAtMs < Date.now()) {
      await depositRef.update({
        status: 'expired',
        verifyReason: 'request expired before verification',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.info(`Deposit ${depositId} expired; marked expired`);
      return;
    }

    // Pull the image via the admin SDK.
    const gcsFile = admin.storage().bucket(file.bucket).file(file.name);
    const [content] = await gcsFile.download();
    const base64 = content.toString('base64');
    const mimeType = file.contentType || 'image/jpeg';

    let extracted;
    try {
      extracted = await readReceipt(base64, mimeType);
    } catch (e) {
      console.error('Receipt read failed:', e.message);
      await depositRef.update({
        status: 'manual_review',
        verifyReason: 'image_unreadable',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    console.info(`Deposit ${depositId} extracted:`, JSON.stringify(extracted));

    // ---- Checks ----
    const failures = [];
    const expectedRemark = normRemark(deposit.remark);
    const imgRemark = normRemark(extracted.remark);
    // Exact match, or (bank screens sometimes truncate long remarks)
    // the visible part must still be at least the "CC-XXXX" prefix.
    const remarkOk =
      expectedRemark.length > 0 &&
      imgRemark.length >= 8 &&
      (imgRemark === expectedRemark || expectedRemark.startsWith(imgRemark));

    const expectedAmount = parseAmount(deposit.amountNGN);
    const imgAmount = parseAmount(extracted.amountNGN);
    const amountOk =
      expectedAmount !== null && imgAmount !== null && Math.abs(imgAmount - expectedAmount) < 0.01;

    const nameOk = nameMatches(extracted.senderName, deposit.senderName);

    const imgTime = parseReceiptDate(extracted.paymentDateTime);
    const createdMs = toMs(deposit.timestamp) || Date.now();
    let timeOk = false;
    let timeDetail = '';
    if (imgTime === null) {
      timeDetail = 'date not visible on receipt';
    } else {
      timeOk = imgTime.getTime() >= createdMs - CLOCK_SKEW_MS && imgTime.getTime() <= Date.now() + CLOCK_SKEW_MS;
      if (!timeOk) timeDetail = `receipt time ${imgTime.toISOString()} outside request window`;
    }

    if (!remarkOk) failures.push('remark_mismatch');
    if (!amountOk) failures.push('amount_mismatch');
    if (!nameOk) failures.push('sender_name_mismatch');
    if (!timeOk) failures.push(`date_mismatch: ${timeDetail}`);

    const verifiedData = {
      remark: extracted.remark,
      amountNGN: imgAmount,
      senderName: extracted.senderName,
      bankName: extracted.bankName,
      paymentDateTime: extracted.paymentDateTime,
      bankReference: extracted.bankReference,
      checks: { remark: remarkOk, amount: amountOk, senderName: nameOk, date: timeOk },
    };

    const allOk = failures.length === 0;
    const amountUSD = Number(deposit.amountUSD || 0);

    if (allOk && amountUSD <= AUTO_APPROVE_LIMIT) {
      // Fully automatic: credit server-side.
      const userRef = db.collection('users').doc(userId);
      await Promise.all([
        userRef.update({ balance: admin.firestore.FieldValue.increment(amountUSD) }),
        userRef
          .collection('activities')
          .add({
            type: 'deposit',
            title: 'Bank Transfer Deposit (auto-verified)',
            amount: amountUSD,
            source: 'receipt-verification',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          }),
      ]);
      await depositRef.update({
        status: 'completed',
        autoVerified: true,
        verifyReason: 'all checks passed (remark, amount, sender name, date)',
        verifiedData,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.info(`Deposit ${depositId} auto-verified & credited $${amountUSD}`);
      return;
    }

    if (allOk) {
      // Passed everything but exceeds the auto-approve limit.
      await depositRef.update({
        status: 'verified',
        autoVerified: false,
        verifyReason: 'all checks passed — awaiting admin confirmation (amount above auto limit)',
        verifiedData,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.info(`Deposit ${depositId} verified, waiting for admin confirm`);
      return;
    }

    await depositRef.update({
      status: 'failed',
      autoVerified: false,
      verifyReason: failures.join('; '),
      verifiedData,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.info(`Deposit ${depositId} failed checks: ${failures.join(', ')}`);
  }
);

// ============================================================
// Expiry sweep — marks stale awaiting_payment/processing docs
// so the admin list stays honest even if the user's browser
// closed before uploading.
// ============================================================

exports.expireStaleDeposits = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Africa/Lagos' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    // One equality + one range only (avoids needing a composite index);
    // the status filter happens in code.
    const q = await db
      .collection('transactions')
      .where('type', '==', 'deposit')
      .where('expiresAt', '<', admin.firestore.Timestamp.now())
      .limit(300)
      .get();

    const batch = db.batch();
    let count = 0;
    q.docs.forEach((d) => {
      const status = (d.data().status || '').toLowerCase();
      if (status === 'awaiting_payment' || status === 'processing') {
        batch.update(d.ref, { status: 'expired', verifiedAt: now });
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      console.info(`Expired ${count} stale deposits`);
    }
  }
);
