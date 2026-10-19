/**
 * TaskVault Banner Ads — Shared Client Library
 * Provides:
 *  - Rendering banner slots on any page (empty -> link to place-banner.html)
 *  - Fetching active banner ads from Firestore
 *  - Tracking impressions & clicks
 *  - Helpers for pricing lookup
 *
 * Usage on any page:
 *  <div class="tv-banner" data-banner-slot="dashboard-top" data-banner-page="dashboard" data-banner-size="728x90"></div>
 *  <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js"></script>
 *  <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore-compat.js"></script>
 *  <script src="js/banner-ads.js"></script>
 *  <script> TVBanner.init({ page: "dashboard" }); </script>
 *
 * Or auto-init if page attribute present.
 */

(function (global) {
  const TVBanner = {
    db: null,
    firebaseConfig: {
      apiKey: "AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs",
      authDomain: "taskvault-412a0.firebaseapp.com",
      databaseURL: "https://taskvault-412a0-default-rtdb.firebaseio.com",
      projectId: "taskvault-412a0",
      storageBucket: "taskvault-412a0.firebasestorage.app",
      messagingSenderId: "420716701831",
      appId: "1:420716701831:web:c987d91f7f4c8684eb7022",
      measurementId: "G-93JG3LB08B"
    },
    // Predefined slots — also used by admin & place page.
    // Add new slots here to make them available everywhere.
    SLOTS: [
      { id: "index-hero", page: "index", size: "728x90", label: "Homepage Hero Leaderboard", w: 728, h: 90 },
      { id: "index-middle", page: "index", size: "300x250", label: "Homepage Medium Rectangle", w: 300, h: 250 },
      { id: "index-footer", page: "index", size: "320x50", label: "Homepage Mobile Banner", w: 320, h: 50 },
      { id: "dashboard-top", page: "dashboard", size: "728x90", label: "Dashboard Top Leaderboard", w: 728, h: 90 },
      { id: "dashboard-inline", page: "dashboard", size: "300x250", label: "Dashboard Medium Rectangle", w: 300, h: 250 },
      { id: "dashboard-bottom", page: "dashboard", size: "320x50", label: "Dashboard Bottom Mobile", w: 320, h: 50 },
      { id: "games-top", page: "games", size: "728x90", label: "Games Top Leaderboard", w: 728, h: 90 },
      { id: "games-inline", page: "games", size: "300x250", label: "Games Inline Rectangle", w: 300, h: 250 },
      { id: "games-bottom", page: "games", size: "320x100", label: "Games Bottom Large Mobile", w: 320, h: 100 },
      { id: "tasks-top", page: "tasks", size: "728x90", label: "Tasks Top Leaderboard", w: 728, h: 90 },
      { id: "tasks-inline", page: "tasks", size: "300x250", label: "Tasks Inline Rectangle", w: 300, h: 250 },
      { id: "offers-top", page: "offers", size: "728x90", label: "Offers Top Leaderboard", w: 728, h: 90 },
      { id: "stake-top", page: "stake", size: "728x90", label: "Marketplace Top", w: 728, h: 90 },
      { id: "profile-top", page: "profile", size: "300x250", label: "Profile Banner", w: 300, h: 250 },
      { id: "menu-top", page: "menu", size: "320x50", label: "Menu Mobile Banner", w: 320, h: 50 },
      { id: "deposit-top", page: "deposit", size: "728x90", label: "Deposit Page Banner", w: 728, h: 90 },
      { id: "withdraw-top", page: "withdraw", size: "728x90", label: "Withdraw Page Banner", w: 728, h: 90 },
      { id: "global-header", page: "all", size: "728x90", label: "Global Header (All Pages)", w: 728, h: 90 },
      { id: "global-sidebar", page: "all", size: "300x250", label: "Global Sidebar (All Pages)", w: 300, h: 250 },
      { id: "global-mobile", page: "all", size: "320x50", label: "Global Mobile (All Pages)", w: 320, h: 50 },
      // Additional flexible sizes
      { id: "generic-468x60", page: "all", size: "468x60", label: "Generic Banner 468x60", w: 468, h: 60 },
      { id: "generic-250x250", page: "all", size: "250x250", label: "Generic Square 250x250", w: 250, h: 250 },
      { id: "generic-300x600", page: "all", size: "300x600", label: "Half Page 300x600", w: 300, h: 600 },
      { id: "generic-970x90", page: "all", size: "970x90", label: "Large Leaderboard 970x90", w: 970, h: 90 }
    ],
    // Standard sizes for pricing UI
    SIZES: [
      { value: "728x90", label: "Leaderboard (728×90)", w: 728, h: 90 },
      { value: "970x90", label: "Large Leaderboard (970×90)", w: 970, h: 90 },
      { value: "300x250", label: "Medium Rectangle (300×250)", w: 300, h: 250 },
      { value: "300x600", label: "Half Page (300×600)", w: 300, h: 600 },
      { value: "320x50", label: "Mobile Banner (320×50)", w: 320, h: 50 },
      { value: "320x100", label: "Large Mobile (320×100)", w: 320, h: 100 },
      { value: "468x60", label: "Banner (468×60)", w: 468, h: 60 },
      { value: "250x250", label: "Square (250×250)", w: 250, h: 250 },
      { value: "160x600", label: "Wide Skyscraper (160×600)", w: 160, h: 600 },
      { value: "336x280", label: "Large Rectangle (336×280)", w: 336, h: 280 }
    ],
    PAGES: [
      { value: "index", label: "Homepage (index.html)" },
      { value: "dashboard", label: "Dashboard" },
      { value: "games", label: "Games" },
      { value: "tasks", label: "Tasks" },
      { value: "offers", label: "Offers" },
      { value: "stake", label: "Marketplace (Stake)" },
      { value: "profile", label: "Profile" },
      { value: "menu", label: "Menu" },
      { value: "deposit", label: "Deposit" },
      { value: "withdraw", label: "Withdraw" },
      { value: "football", label: "Football" },
      { value: "referral", label: "Referral" },
      { value: "kyc", label: "KYC" },
      { value: "all", label: "All Pages (Global)" }
    ],
    DURATIONS: [
      { days: 1, label: "1 Day" },
      { days: 3, label: "3 Days" },
      { days: 7, label: "7 Days (1 Week)" },
      { days: 14, label: "14 Days (2 Weeks)" },
      { days: 30, label: "30 Days (1 Month)" },
      { days: 60, label: "60 Days (2 Months)" },
      { days: 90, label: "90 Days (3 Months)" }
    ],

    // Cache
    _activeAdsCache: [],
    _cacheTime: 0,
    CACHE_MS: 60 * 1000,

    ensureDb: function () {
      if (this.db) return this.db;
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
          if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(this.firebaseConfig);
          }
          this.db = firebase.firestore();
          return this.db;
        } catch (e) { console.warn("TVBanner db init failed", e); }
      }
      return null;
    },

    getSlotById: function (id) {
      return this.SLOTS.find(s => s.id === id) || null;
    },

    getSizeMeta: function (size) {
      return this.SIZES.find(s => s.value === size) || { value: size, label: size, w: 300, h: 250 };
    },

    // Fetch active ads (status=active, endDate > now, startDate <= now if exists)
    fetchActiveAds: async function (force) {
      const db = this.ensureDb();
      if (!db) return [];
      const now = Date.now();
      if (!force && this._activeAdsCache.length && (now - this._cacheTime) < this.CACHE_MS) {
        return this._activeAdsCache;
      }
      try {
        const snap = await db.collection("bannerAds").where("status", "==", "active").get();
        const ads = [];
        snap.forEach(doc => {
          const d = doc.data();
          // Check date validity
          let valid = true;
          try {
            const end = d.endDate && d.endDate.toDate ? d.endDate.toDate().getTime() : (d.endDate ? new Date(d.endDate).getTime() : null);
            const start = d.startDate && d.startDate.toDate ? d.startDate.toDate().getTime() : null;
            if (end && end < now) {
              valid = false;
              // Optionally mark expired in background (fire and forget)
              // db.collection("bannerAds").doc(doc.id).update({ status: "expired" }).catch(()=>{});
            }
            if (start && start > now) valid = false;
          } catch (_) {}
          if (valid) ads.push({ id: doc.id, ...d });
        });
        this._activeAdsCache = ads;
        this._cacheTime = now;
        return ads;
      } catch (e) {
        console.warn("fetchActiveAds error", e);
        return [];
      }
    },

    // Pick best ad for slot: exact slotId match preferred, then page+size match, then all+size
    pickAdForSlot: function (ads, slot) {
      if (!slot) return null;
      // 1) exact slotId match
      let candidates = ads.filter(a => a.slotId === slot.id);
      if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
      // 2) page+size match
      candidates = ads.filter(a => (a.page === slot.page || a.page === "all") && a.size === slot.size);
      if (candidates.length) {
        // Prefer exact page over all
        const exactPage = candidates.filter(c => c.page === slot.page);
        if (exactPage.length) return exactPage[Math.floor(Math.random() * exactPage.length)];
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      // 3) size-only fallback for global slots
      candidates = ads.filter(a => a.size === slot.size);
      // Only use if no other slot claims? Avoid cross-page mismatch — only if slot.page is "all"
      if (slot.page === "all" && candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      return null;
    },

    // Render all banners on page
    renderAll: async function (pageHint) {
      const containers = document.querySelectorAll(".tv-banner, [data-banner-slot]");
      if (!containers.length) return;
      const ads = await this.fetchActiveAds();

      containers.forEach(el => {
        // Determine slot metadata
        const slotId = el.getAttribute("data-banner-slot") || el.getAttribute("data-slot") || el.dataset.bannerSlot;
        const page = el.getAttribute("data-banner-page") || el.dataset.bannerPage || pageHint || this.detectPage();
        const size = el.getAttribute("data-banner-size") || el.dataset.bannerSize || "728x90";
        let slot = null;
        if (slotId) slot = this.getSlotById(slotId);
        if (!slot) {
          // Synthesize slot from attributes
          const meta = this.getSizeMeta(size);
          slot = { id: slotId || (page + "-" + size), page: page, size: size, label: (page + " " + size), w: meta.w, h: meta.h };
        }
        // Ensure element has size class
        this.renderSlot(el, slot, ads);
      });
    },

    detectPage: function () {
      const p = (location.pathname.split("/").pop() || "index.html").replace(".html", "").toLowerCase();
      if (!p || p === "index" || p === "") return "index";
      return p;
    },

    renderSlot: function (el, slot, ads) {
      const ad = this.pickAdForSlot(ads, slot);
      el.classList.add("tv-banner-slot");
      el.setAttribute("data-slot-id", slot.id);
      // Set CSS vars for sizing
      el.style.setProperty("--tv-banner-w", slot.w + "px");
      el.style.setProperty("--tv-banner-h", slot.h + "px");

      if (ad) {
        // Active ad found
        this.renderAd(el, ad, slot);
      } else {
        this.renderEmpty(el, slot);
      }
    },

    renderAd: function (el, ad, slot) {
      // Avoid re-render if already showing same ad
      if (el.dataset.renderedAd === ad.id) return;
      el.dataset.renderedAd = ad.id;
      el.innerHTML = "";
      el.classList.remove("tv-banner-empty");
      el.classList.add("tv-banner-active");
      el.title = ad.title || "Sponsored";

      const link = document.createElement("a");
      link.href = ad.targetUrl || ad.link || "#";
      link.target = "_blank";
      link.rel = "noopener sponsored";
      link.className = "tv-banner-link";
      link.setAttribute("aria-label", ad.title || "Advertisement");

      // Click tracking
      link.addEventListener("click", () => {
        this.trackClick(ad.id).catch(() => {});
      });

      // Image
      const img = document.createElement("img");
      img.className = "tv-banner-img";
      img.alt = ad.title || "Ad";
      img.loading = "lazy";
      // Support base64 or URL
      img.src = ad.imageBase64 || ad.image || ad.imageUrl || ad.thumbnail || "";
      // Fallback styling: object-fit cover, width 100%
      img.onerror = function () {
        this.style.display = "none";
        const fallback = document.createElement("div");
        fallback.className = "tv-banner-fallback";
        fallback.textContent = ad.title || "Ad";
        link.appendChild(fallback);
      };

      link.appendChild(img);
      el.appendChild(link);

      // Ad badge
      const badge = document.createElement("span");
      badge.className = "tv-banner-badge";
      badge.textContent = "Ad";
      el.appendChild(badge);

      // Optional title overlay if ad has title and needs display
      if (ad.showTitle) {
        const cap = document.createElement("div");
        cap.className = "tv-banner-caption";
        cap.textContent = ad.title;
        el.appendChild(cap);
      }

      // Impression tracking (once per render)
      this.trackImpression(ad.id).catch(() => {});
    },

    renderEmpty: function (el, slot) {
      if (el.dataset.renderedEmpty === slot.id) return;
      el.dataset.renderedEmpty = slot.id;
      el.innerHTML = "";
      el.classList.remove("tv-banner-active");
      el.classList.add("tv-banner-empty");

      const a = document.createElement("a");
      // Preserve slot context via query param so place page can prefill
      a.href = `place-banner.html?slot=${encodeURIComponent(slot.id)}&page=${encodeURIComponent(slot.page)}&size=${encodeURIComponent(slot.size)}`;
      a.className = "tv-banner-empty-inner";
      a.setAttribute("aria-label", "Advertise here — click to place your ad");

      const icon = document.createElement("div");
      icon.className = "tv-banner-empty-icon";
      icon.innerHTML = '<i class="ri-advertisement-line"></i>';

      const title = document.createElement("div");
      title.className = "tv-banner-empty-title";
      title.textContent = "Advertise Here";

      const sub = document.createElement("div");
      sub.className = "tv-banner-empty-sub";
      // We could fetch price placeholder: show "From $X"
      sub.textContent = slot.label + " • " + slot.size + " • Click to place ad";

      const cta = document.createElement("span");
      cta.className = "tv-banner-empty-cta";
      cta.innerHTML = '<i class="ri-add-line"></i> Place Ad';

      a.append(icon, title, sub, cta);
      el.appendChild(a);
    },

    // Tracking helpers (best effort, no auth required for increment via transaction-like)
    trackImpression: async function (adId) {
      const db = this.ensureDb();
      if (!db) return;
      try {
        const ref = db.collection("bannerAds").doc(adId);
        // Use increment if available
        if (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment) {
          await ref.update({ impressions: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
        }
      } catch (_) {}
    },
    trackClick: async function (adId) {
      const db = this.ensureDb();
      if (!db) return;
      try {
        const ref = db.collection("bannerAds").doc(adId);
        if (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment) {
          await ref.update({ clicks: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
        }
      } catch (_) {}
    },

    // Pricing helpers
    fetchPricing: async function () {
      const db = this.ensureDb();
      if (!db) return [];
      try {
        const snap = await db.collection("bannerPricing").get();
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        return list;
      } catch (e) {
        console.warn("fetchPricing error", e);
        return [];
      }
    },

    findPrice: function (pricingList, slotId, size, page, days) {
      // Prefer exact slotId+dura
      let match = pricingList.find(p => p.slotId === slotId && Number(p.durationDays) === Number(days));
      if (match) return match;
      // Fallback: size+page+duration
      match = pricingList.find(p => p.size === size && p.page === page && Number(p.durationDays) === Number(days));
      if (match) return match;
      // Fallback: size+duration (any page)
      match = pricingList.find(p => p.size === size && Number(p.durationDays) === Number(days));
      if (match) return match;
      // Fallback: page duration generic
      match = pricingList.find(p => p.page === page && Number(p.durationDays) === Number(days));
      return match || null;
    },

    // Auto init helper
    init: async function (opts) {
      opts = opts || {};
      const page = opts.page || this.detectPage();
      // Inject CSS if not present
      if (!document.getElementById("tv-banner-css")) {
        const link = document.createElement("link");
        link.id = "tv-banner-css";
        link.rel = "stylesheet";
        link.href = "css/banner-ads.css";
        // Fallback to inline if file missing — we inject inline below
        document.head.appendChild(link);
      }
      // Also ensure inline critical CSS is present (in case css file not loaded yet)
      if (!document.getElementById("tv-banner-inline-css")) {
        const style = document.createElement("style");
        style.id = "tv-banner-inline-css";
        style.textContent = this.inlineCSS();
        document.head.appendChild(style);
      }
      await this.renderAll(page);
      // Re-render periodically to rotate ads
      if (opts.rotateMs && opts.rotateMs > 0) {
        setInterval(() => {
          this._activeAdsCache = [];
          this.renderAll(page);
        }, opts.rotateMs);
      }
    },

    inlineCSS: function () {
      return `
.tv-banner, .tv-banner-slot { position: relative; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px; background:#fff; border:1px solid rgba(255,140,66,0.08); box-shadow:0 2px 8px rgba(0,0,0,0.04); margin:12px 0; min-height:50px; }
.tv-banner-empty { background: repeating-linear-gradient(135deg, #fff7ed 0 12px, #ffffff 12px 24px); border:1.5px dashed #FF8C42; cursor:pointer; transition: all .2s ease; }
.tv-banner-empty:hover { background: #FFF0E6; border-color: #E67A35; transform: translateY(-2px); box-shadow:0 6px 18px rgba(255,140,66,0.12); }
.tv-banner-empty-inner { display:flex; flex-direction:column; align-items:center; justify-content:center; text-decoration:none; color:#333; padding:14px 16px; width:100%; gap:4px; text-align:center; }
.tv-banner-empty-icon { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#FF8C42,#FF6B35); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; }
.tv-banner-empty-title { font-size:13px; font-weight:800; color:#333; margin-top:4px; }
.tv-banner-empty-sub { font-size:10px; color:#888; font-weight:500; line-height:1.4; }
.tv-banner-empty-cta { margin-top:6px; background: linear-gradient(135deg,#FF8C42,#FF6B35); color:#fff; font-size:11px; font-weight:700; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:4px; }
.tv-banner-link { display:block; width:100%; height:100%; text-decoration:none; }
.tv-banner-img { width:100%; height:100%; object-fit:cover; display:block; max-height:100%; }
.tv-banner-badge { position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.65); color:#fff; font-size:9px; font-weight:700; padding:2px 6px; border-radius:6px; letter-spacing:.04em; text-transform:uppercase; }
.tv-banner-caption { position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.65), transparent); color:#fff; font-size:11px; font-weight:600; padding:8px 10px; }
.tv-banner-fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#FF8C42,#FF6B35); color:#fff; font-weight:700; font-size:13px; min-height:60px; }
/* Size specific helpers */
.tv-banner[data-banner-size="728x90"], .tv-banner-slot[data-banner-size="728x90"] { max-width:728px; width:100%; height:90px; min-height:90px; margin-left:auto; margin-right:auto; }
.tv-banner[data-banner-size="970x90"] { max-width:970px; height:90px; min-height:90px; }
.tv-banner[data-banner-size="300x250"] { max-width:300px; width:100%; height:250px; min-height:250px; margin-left:auto; margin-right:auto; }
.tv-banner[data-banner-size="320x50"] { max-width:320px; width:100%; height:50px; min-height:50px; margin-left:auto; margin-right:auto; }
.tv-banner[data-banner-size="320x100"] { max-width:320px; height:100px; min-height:100px; }
.tv-banner[data-banner-size="468x60"] { max-width:468px; width:100%; height:60px; min-height:60px; }
.tv-banner[data-banner-size="250x250"] { max-width:250px; height:250px; min-height:250px; }
.tv-banner[data-banner-size="300x600"] { max-width:300px; height:600px; min-height:600px; }
.tv-banner[data-banner-size="160x600"] { max-width:160px; height:600px; }
.tv-banner[data-banner-size="336x280"] { max-width:336px; height:280px; }
@media (max-width: 480px) {
  .tv-banner[data-banner-size="728x90"] { height:70px; min-height:70px; }
  .tv-banner[data-banner-size="970x90"] { height:70px; min-height:70px; }
}
`;
    }
  };

  // Expose globally
  global.TVBanner = TVBanner;

  // Auto-init if data attribute present on body
  document.addEventListener("DOMContentLoaded", function () {
    const auto = document.querySelector("[data-tv-banner-auto]");
    if (auto) {
      const page = auto.getAttribute("data-tv-banner-auto") || TVBanner.detectPage();
      TVBanner.init({ page: page });
    } else {
      // Also auto-init if any banner exists but no explicit call — default page detection
      const any = document.querySelector(".tv-banner, [data-banner-slot]");
      if (any) TVBanner.init();
    }
  });

})(typeof window !== 'undefined' ? window : this);
