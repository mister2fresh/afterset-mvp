# ADR-006: Business Setup — Colorado LLC, Mercury Banking, and Compliance Infrastructure

**Status:** Accepted
**Date:** 2026-03-21
**Deciders:** [Author]
**Related:** ADR-002 (Resend — CAN-SPAM compliance), ADR-005 (SMS — TCPA compliance)

---

## Decision

**Colorado single-member LLC ($50)** as the business entity. **Mercury** (free) for business banking. **Stripe** for payment processing, set up as a business account with EIN. **Wave Free** for bookkeeping. **Bundled Tech E&O + Cyber Liability insurance** (~$730–$1,100/year) before first fan data is collected. **Federal trademark filing** ($700, Classes 42 + 41) via Intent-to-Use application. Legal documents (ToS, Privacy Policy, DPA) start with templates, with a SaaS attorney engaged within 90 days ($2,500–$5,000).

**Critical pre-launch requirements:** TCPA-compliant SMS opt-in flow with all required disclosures baked into the platform (not configurable by artists). CAN-SPAM compliant email footers (mandatory, non-removable). 10DLC registration via the SMS provider (~$19.50 + $2.65–$11.15/month). Published Privacy Policy and Terms of Service with clickwrap acceptance. PO Box or virtual mailbox for CAN-SPAM physical address ($5–$40/month).

**Total cost to go from nothing to legally operational: ~$2,200–$4,400 one-time + ~$90–$156/month recurring.**

---

## Context

Afterset collects and stores fan PII (emails, names, phone numbers) on behalf of artists and sends marketing emails and SMS messages on their behalf. This creates regulatory exposure under TCPA, CAN-SPAM, the Colorado Privacy Act, and CCPA/CPRA that does not exist for a typical SaaS product. The SMS text-to-join flow (ADR-005) is the highest-risk feature — TCPA penalties of $500–$1,500 per unsolicited text message have no statutory cap, and class action filings surged 67% in 2024 to 2,788 cases with an average settlement of $6.6 million.

### Why these decisions are coupled

Entity formation, banking, insurance, and compliance are interdependent. The LLC must exist before the EIN. The EIN must exist before the bank account. The bank account must exist before Stripe payouts work. The ToS must exist before the first paying customer. TCPA compliance must be engineered into the platform before a single SMS is sent — it cannot be bolted on later. Insurance must be bound before PII is collected because policies are claims-made (no retroactive coverage). Treating these as sequential blockers rather than independent tasks is the key insight.

### Constraints

- Solo founder, Colorado-based, bootstrapped, pre-revenue.
- Target: first 10 paying customers within 8 weeks of build start.
- No legal or accounting background — setup must be self-serviceable.
- Budget: minimize fixed costs while protecting against existential legal risk.
- Must preserve optionality for future fundraising without over-engineering now.

---

## Sub-decisions

### 1. Entity Type: Colorado Single-Member LLC — SELECTED

**LLC ($50 formation, $25/year renewal):** Personal liability protection, pass-through taxation, zero entity-level state tax, lightest compliance burden. Colorado LLC files online, processes instantly, and has the lowest formation cost of any state. Annual periodic report is $25 (increased from $10 effective July 2024). Founder serves as own registered agent ($0).

**S-Corp election (via IRS Form 2553):** Splits income into salary (subject to 15.3% SE tax) and distributions (exempt). Math only works when net profit consistently exceeds $40K–$50K/year. At Afterset's target of 10 customers at $12–$25/month, annual revenue is $1,440–$3,000 — S-Corp payroll administration would cost more than the tax savings.

**C-Corp (Delaware):** Required for institutional VC funding. Formation costs $475–$785 in year one (Delaware fees + Colorado foreign qualification + registered agent). Imposes double taxation and rigid compliance requirements. Premature for a bootstrapped product with no investor conversations.

**Why Colorado over Delaware/Wyoming:** Afterset operates in Colorado, has no investors, and is a single-member LLC. Forming in another state means paying that state's fees *plus* Colorado foreign qualification fees. Delaware's Court of Chancery advantage is irrelevant without equity disputes. Wyoming offers nothing Colorado doesn't for this profile.

### 2. Banking: Mercury + Stripe — SELECTED

**Mercury (free, no minimum):** $0 monthly fee, free domestic and international wires, native Stripe integration, API access for future automation, FDIC coverage up to $5M via sweep network. No cash deposits — irrelevant for a SaaS business where all revenue arrives digitally.

**Relay ($0 Starter):** Strong envelope budgeting with 20 free sub-accounts. Better for Profit First methodology but premature segmentation for a pre-revenue founder. Cash deposit support via Allpoint+ is unnecessary.

**Traditional bank (Chase Business Complete, $15/month):** Branch access and established credit relationships, but monthly fees, wire fees ($25+), and no SaaS-specific features. Only makes sense if the founder needs in-branch services.

**Stripe setup:** Register immediately — Stripe allows individual accounts using an SSN, then upgrade to a business account with EIN after LLC formation. No penalty, no account reset. Processing fees: 2.9% + $0.30 per card transaction. At $12/month pricing, effective rate is ~5.4% ($0.65/transaction). Consider annual billing to reduce per-transaction overhead.

### 3. Legal Compliance: Templates Now, Attorney Within 90 Days — SELECTED

**Full attorney engagement from day one ($4,500–$7,500):** Ideal but cost-prohibitive for a pre-revenue founder. A comprehensive SaaS legal package (ToS, Privacy Policy, DPA, AUP) from a specialized attorney runs $2,500–$5,000.

**Template-only approach ($100–$500):** Termly Pro+ ($20/month) or TermsFeed (one-time $47–$297) generates baseline ToS and Privacy Policy. Sufficient for a standard SaaS but insufficient for Afterset's SMS/PII complexity — TCPA provisions, CAN-SPAM "initiator" liability, data processor obligations, and indemnification clauses require custom drafting.

**Hybrid approach (selected):** Generate templates for launch ($100–$250), then engage a SaaS attorney within 90 days to customize ($2,500–$5,000). Templates provide legal cover for early customers while the attorney package is prepared. The critical compliance elements that cannot wait for the attorney — TCPA opt-in flows, CAN-SPAM email footers, STOP keyword handling — are engineering tasks built into the platform, not legal document tasks.

**Key compliance architecture decisions:**
- TCPA disclosures and opt-out handling are **platform-enforced, not artist-configurable**. Artists cannot remove or modify required consent language, STOP/HELP handling, or sending time restrictions (8 AM–9 PM recipient local time). This is the primary defense against vicarious liability.
- CAN-SPAM email footers (unsubscribe link + physical address) are **mandatory and non-removable** in every email template.
- Consent logging (timestamp, phone number, keyword, consent language displayed) is automated at the platform level and retained for 5 years.
- 10DLC registration must be complete before the first SMS sends. Allow 2–3 weeks for campaign approval.

### 4. Tax and Accounting: Wave Free + CPA at First Filing — SELECTED

**Wave Starter (free):** Double-entry bookkeeping, unlimited invoicing, P&L/balance sheet/cash flow reports at $0. Manual bank transaction import is manageable at <20 transactions/month. No auto bank sync on the free tier.

**QuickBooks Solopreneur ($20/month):** Auto bank sync, real-time tax estimates, receipt scanning. Overkill at pre-revenue and lacks a customizable chart of accounts for proper SaaS revenue recognition.

**Hurdlr Premium ($10/month):** Real-time tax estimates and mileage tracking — optimized for gig workers, not SaaS founders.

**CPA timing:** Hire for the first annual tax filing ($300–$500 for a straightforward Schedule C). The QBI deduction (up to 20% of qualified business income), Section 174 R&D amortization rules, and startup cost classification (Section 195 vs. Section 162) are areas where a CPA pays for itself in avoided mistakes.

**Colorado-specific:** Flat 4.40% state income tax. Self-employment tax is 15.3% federal. Quarterly estimated payments not required until expected annual tax liability exceeds $1,000. At 10 customers, annual net profit is likely well below that threshold.

### 5. IP Protection: File Trademark Now, Acquire .com Later — SELECTED

**File now ($700 for Classes 42 + 41):** "Afterset" is a coined/fanciful mark — highest distinctiveness, ~85–90% approval likelihood. Intent-to-Use filing locks in a priority date nationwide. An unrelated bar already uses the Afterset name — delay increases risk of class conflict or domain complications. USPTO fees increased January 2025 to $350/class (unified filing, TEAS Plus/Standard distinction eliminated).

**Wait until revenue:** Saves $700 but cedes priority date. A SaaS product operating nationally without federal trademark protection relies solely on common-law rights, which are geographically limited and difficult to enforce for internet businesses. The risk/reward is wrong — $700 is less than three months of a Pro subscription from one customer.

**Colorado state trademark ($30):** Cheap supplementary layer. Only protects within Colorado. Not a substitute for federal. File it anyway.

**Domain strategy:** Operating on `afterset.net` is workable — 95% of top SaaS companies use `.com`, but Signal.org and Speedtest.net demonstrate .net is viable in tech audiences. Register `afterset.io` and `afterset.co` defensively ($20–$50). Initiate `.com` acquisition at $5K MRR when a $2,000–$10,000 purchase is justifiable. Claim @afterset on all social platforms immediately ($0).

### 6. Insurance: Bundled Tech E&O + Cyber Before Launch — SELECTED

**Bundled Tech E&O + Cyber Liability ($730–$1,100/year):** Covers data breach notification/forensics, legal defense for service failure claims, software bug liability, business interruption. Claims-made policy — must be active before PII collection begins or that period is a permanent coverage gap. Hiscox offers the lowest entry point (~$22.50/month professional liability, ~$30/month cyber).

**Defer insurance until revenue:** Tempting but dangerous. The moment the first fan texts a keyword, Afterset is collecting phone numbers — PII covered under breach notification laws in all 50 states. An uninsured data breach at pre-revenue can bankrupt the LLC and pierce the veil to personal assets if the LLC is undercapitalized.

**General Liability ($300–$600/year):** Add within 30–60 days of first paying customer. Required by most B2B contracts (venues, promoters, enterprise artists will demand a Certificate of Insurance).

**TCPA-specific coverage:** Standard policies generally exclude TCPA claims. Request an affirmative TCPA endorsement when purchasing. If excluded, the primary defense is platform-level compliance engineering — proper consent, auto-STOP handling, consent logging, time-of-day restrictions.

---

## Consequences

### Positive

- Entity formation to bank account to Stripe in a single afternoon for $50. LLC is live instantly via Colorado SOS online filing.
- Total recurring compliance cost is ~$90–$156/month — less than one Band tier subscription. Scales with revenue, not ahead of it.
- TCPA compliance is platform-enforced rather than artist-dependent, reducing vicarious liability exposure. This is the single most important architectural decision in the entire business setup.
- Trademark filing locks in nationwide priority date for a strong coined mark. No risk of losing the name to a later filer.
- Insurance bound before PII collection means no claims-made gap. Coverage is in place from day one.
- Every optimization (S-Corp election, Delaware C-Corp, enterprise accounting, multi-state sales tax) has a specific revenue trigger. No premature complexity.

### Negative

- Template legal documents are not custom-fit for the SMS/PII use case. There is a 90-day window where the ToS may not fully protect against an artist misuse scenario. Mitigated by platform-enforced compliance controls.
- Standard insurance policies likely exclude TCPA damages. Afterset's primary TCPA defense is compliance, not insurance — a posture that requires zero engineering mistakes in the consent flow.
- Operating on `afterset.net` without the `.com` creates minor brand leakage. Users may type `afterset.com` instinctively and land on the unrelated bar's site.
- Self-filing the trademark without an attorney increases risk of a procedural error or insufficient goods/services description. The $350/class filing fee is non-refundable if the application is abandoned.
- Wave Free requires manual transaction entry. Time cost is ~15 minutes/month at pre-revenue but scales poorly past ~50 transactions/month.

---

## Revisit When

- **Net self-employment income exceeds $50K/year.** Evaluate S-Corp election with CPA. At this threshold, the SE tax savings (~$3,000+/year) outweigh the cost of payroll administration.
- **Pursuing institutional investment.** Convert to Delaware C-Corp before a Series A. Colorado supports statutory conversion. Do this before significant revenue makes the taxable event material.
- **Monthly revenue exceeds $1K.** Formalize multi-state sales tax compliance. Enable Stripe Tax. File quarterly estimated taxes if annualized liability exceeds $1,000.
- **Revenue exceeds $100K in any single state.** Register for that state's sales tax. Most states use $100K or 200 transactions as the economic nexus threshold.
- **First enterprise/venue contract requiring COI.** Bind General Liability if not already active.
- **Text message volume exceeds 10K/month.** Reassess TCPA insurance options. Explore specialty policies through DOXA or CRC Group.
- **Transaction volume exceeds 50/month in Wave.** Upgrade to Wave Pro ($16–$19/month) or QuickBooks Simple Start ($38/month) for auto bank sync.
- **Notice of Allowance received from USPTO.** File Statement of Use within 6 months (or request extension at $125/class). Calendar this immediately — 84% of failed ITU applications fail because the SOU is never filed.
- **Team grows beyond solo founder.** Add D&O insurance, Workers' Compensation (Colorado requires it), and upgrade from Wave to multi-user bookkeeping.

---

## Validation Tasks Before Committing

These should be completed during the Pre-Build Phase, before the first paying customer:

1. **[ ] Form Colorado LLC.** File Articles of Organization at sos.colorado.gov ($50). Confirm instant processing. Save state ID number.
2. **[ ] Obtain EIN.** Apply at irs.gov immediately after LLC formation ($0). Complete in one session (15-minute inactivity timeout). Save CP-575 letter.
3. **[ ] Open Mercury business account.** Requires Articles of Organization + EIN + photo ID. Verify 1–2 day approval timeline.
4. **[ ] Connect Stripe to Mercury.** Set up Stripe as business account with EIN. Route all payouts to Mercury. Test a $1 charge and payout.
5. **[ ] Publish Privacy Policy.** Must be live before any fan data collection. Link from all capture pages, SMS confirmations, and email footers.
6. **[ ] Publish Terms of Service with clickwrap.** Must be live before first paying customer. Checkbox + "I agree" on artist signup flow.
7. **[ ] Complete 10DLC registration.** Brand registration ($4.50) + Campaign registration ($15 vetting). Allow 10–15 business days for campaign approval. **This gates Sprint 3 SMS launch.**
8. **[ ] Verify TCPA compliance in SMS flow.** Test full text-to-join cycle: call-to-action displays all required disclosures → fan texts keyword → confirmation SMS includes program name, frequency, rates, STOP, HELP, privacy/terms links → STOP triggers immediate opt-out and single confirmation → consent logged with timestamp.
9. **[ ] Verify CAN-SPAM compliance in email templates.** Every email includes: functional unsubscribe link, physical postal address (PO Box), accurate From/Reply-To headers, non-deceptive subject line. Unsubscribe removes within 10 business days (target: immediate).
10. **[ ] Bind Tech E&O + Cyber insurance.** Get quotes from Hiscox, Vouch/Embroker. Confirm TCPA coverage or document exclusion. Bind before first fan data collection.
11. **[ ] File federal trademark.** USPTO Intent-to-Use application for "Afterset" in Classes 42 and 41 ($700). Calendar all deadlines.
12. **[ ] Set up Wave bookkeeping.** Create account, connect to Mercury manually, categorize all pre-launch expenses (hosting, domain, legal, filing fees). Track from day one.

---

## Research Sources

Detailed research across three sessions covering entity formation, banking, tax obligations, TCPA/CAN-SPAM compliance, privacy law, data processing agreements, trademark registration, and insurance. Key confidence levels:

- Colorado LLC filing fee $50: **VERIFIED** (Colorado SOS)
- Colorado periodic report $25/year: **VERIFIED** (SB 23-276, effective July 2024)
- TCPA penalties $500–$1,500 per message, no cap: **VERIFIED** (47 U.S.C. § 227)
- CAN-SPAM penalties up to $53,088 per email: **VERIFIED** (FTC inflation-adjusted 2024)
- Colorado Privacy Act enforcement live, 60-day cure expired Jan 1, 2025: **VERIFIED** (Colorado AG)
- SaaS not taxable at Colorado state level: **VERIFIED** (June 2020 PLR)
- SaaS taxable in Colorado home-rule cities (e.g., Denver): **VERIFIED** (Anrok, Stripe)
- USPTO trademark fee $350/class (unified filing, Jan 2025): **VERIFIED** (USPTO fee schedule)
- Standard E&O/cyber policies generally exclude TCPA: **VERIFIED** (multiple legal analyses)
- 10DLC registration mandatory, unregistered traffic blocked Feb 2025: **VERIFIED** (carrier policies, Twilio docs)
