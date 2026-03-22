# ADR-006: Business Setup — Colorado LLC, Mercury Banking, and Compliance Infrastructure

**Status:** Accepted
**Date:** 2026-03-22
**Deciders:** [Author]
**Related:** ADR-002 (Resend — CAN-SPAM compliance), ADR-005 (SMS — TCPA compliance, RILA exemption)

---

## Decision

**Colorado single-member LLC ($50)** as the business entity. **Mercury** (free) for business banking. **Stripe** for payment processing, set up as a business account with EIN. **Wave Free** for bookkeeping. **Hiscox E&O insurance** (~$270/year) before first paying customer, with cyber liability added at 50+ artists. **Federal trademark filing** ($700, Classes 42 + 41) via Intent-to-Use application. Legal documents (ToS, Privacy Policy) generated via **Termly Pro+** ($20/month), with a **targeted attorney review** ($300–$500) scoped to TCPA vicarious liability and CPA processor language.

**Critical pre-launch requirements:** CAN-SPAM compliant email footers (mandatory, non-removable). Published Privacy Policy and Terms of Service with clickwrap acceptance. PO Box for CAN-SPAM physical address ($5/month). Telnyx toll-free verification (free, per ADR-005). TCPA compliance is largely handled by the architecture: the single-reply-to-consumer-initiated-text flow falls under the FCC's RILA exemption (FCC 15-72), and Telnyx's built-in auto opt-out handles STOP/HELP/CANCEL/END/QUIT/UNSUBSCRIBE at the carrier level.

**Total cost to go from nothing to legally operational: ~$1,620–$1,820 one-time + ~$47.50/month recurring.**

---

## Context

Afterset collects fan PII (emails, names, phone numbers) on behalf of artists and sends marketing emails and a single SMS reply on their behalf. The compliance research initially scoped Afterset's risk profile against general SMS marketing platforms — companies sending ongoing unsolicited texts at scale. This was overly conservative. ADR-005's architecture deliberately avoids that profile:

- **SMS flow:** Fan initiates by texting a keyword → receives ONE immediate reply with a capture page URL → no further SMS is ever sent. The FCC's 2015 RILA ruling (FCC 15-72) explicitly held that a one-time text sent immediately after a consumer's request is fulfillment, not telemarketing, provided the reply contains only the requested information with no additional marketing. ADR-005 enforces this (GSM-7 only, no promotional copy, compliance language only).
- **Email flow:** Fan enters email on capture page (web form = express consent) → receives automated follow-up emails. This is standard CAN-SPAM territory with well-understood compliance requirements handled largely by Resend (List-Unsubscribe headers, bounce processing, suppression).
- **Data sensitivity:** Emails, phone numbers, and names. No SSNs, no financial data, no health records. Supabase Pro provides encryption at rest, RLS tenant isolation, and SOC 2 Type II compliance.

This reframe doesn't eliminate legal obligations — it right-sizes them for a bootstrapped launch.

### Why these decisions are coupled

Entity formation, banking, insurance, and compliance are interdependent. The LLC must exist before the EIN. The EIN must exist before the bank account. The bank account must exist before Stripe payouts work. The ToS must exist before the first paying customer. Insurance must be bound before PII is collected because policies are claims-made. Treating these as sequential blockers rather than independent tasks is the key insight.

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

**Why Colorado over Delaware/Wyoming:** Afterset operates in Colorado, has no investors, and is a single-member LLC. Forming in another state means paying that state's fees plus Colorado foreign qualification fees. Delaware's Court of Chancery advantage is irrelevant without equity disputes.

### 2. Banking: Mercury + Stripe — SELECTED

**Mercury (free, no minimum):** $0 monthly fee, free domestic and international wires, native Stripe integration, API access for future automation, FDIC coverage up to $5M via sweep network. No cash deposits — irrelevant for a SaaS business where all revenue arrives digitally.

**Relay ($0 Starter):** Strong envelope budgeting with 20 free sub-accounts. Better for Profit First methodology but premature segmentation for a pre-revenue founder.

**Traditional bank (Chase Business Complete, $15/month):** Branch access and established credit relationships, but monthly fees, wire fees ($25+), and no SaaS-specific features. Only makes sense if the founder needs in-branch services.

**Stripe setup:** Register immediately — Stripe allows individual accounts using an SSN, then upgrade to a business account with EIN after LLC formation. No penalty, no account reset. Processing fees: 2.9% + $0.30 per card transaction.

### 3. Legal Compliance: Templates + Targeted Review — SELECTED

**Full attorney engagement from day one ($2,500–$5,000):** Comprehensive but cost-prohibitive at pre-revenue. Deferred to $5K MRR when it's justified and the product's actual usage patterns inform better scoping.

**Template-only approach ($240/year):** Termly Pro+ ($20/month) generates ToS, Privacy Policy, and cookie policy with SaaS-specific clauses, auto-updates for regulatory changes, and TCPA/CCPA provisions. Covers 80–90% of requirements for Afterset's actual risk profile.

**Template + targeted attorney review (selected, $540–$740 total first year):** Termly Pro+ for document generation, plus a scoped 1–2 hour consultation ($300–$500) with a SaaS attorney via ContractsCounsel or UpCounsel. Bring the template docs and ask two specific questions: (1) "Does my ToS properly allocate TCPA vicarious liability given the RILA exemption applies to my single-reply SMS flow?" (2) "Is my data processor language sufficient for the Colorado Privacy Act?" Maximum value from minimum legal spend.

**Why this works for Afterset's actual risk profile:**
- The TCPA class action threat ($6.6M average settlement) applies to ongoing SMS marketing — mass texts, purchased lists, ignoring opt-outs. Afterset sends one auto-reply to a consumer-initiated text, covered by the RILA exemption. The TCPA risk is real but narrow: it exists only if the auto-reply contains promotional content beyond the URL, or if a future feature adds ongoing SMS messaging.
- CAN-SPAM has no private right of action. Only FTC and state AGs enforce it. They target large-scale violators, not a SaaS sending 5,000 emails/month.
- The critical compliance elements — TCPA disclosures, STOP handling, CAN-SPAM footers, consent logging — are **engineering tasks baked into the platform**, not legal document tasks. Telnyx handles STOP/HELP at the carrier level (ADR-005). Resend handles List-Unsubscribe headers (ADR-002). These are already decided and built.

### 4. Tax and Accounting: Wave Free + CPA at First Filing — SELECTED

**Wave Starter (free):** Double-entry bookkeeping, unlimited invoicing, P&L/balance sheet/cash flow reports at $0. Manual bank transaction import is manageable at <20 transactions/month.

**QuickBooks Solopreneur ($20/month):** Auto bank sync, real-time tax estimates, receipt scanning. Overkill at pre-revenue and lacks a customizable chart of accounts.

**CPA timing:** Hire for the first annual tax filing ($300–$500 for a straightforward Schedule C). The QBI deduction, Section 174 R&D amortization, and startup cost classification are areas where a CPA pays for itself. Colorado state income tax is a flat 4.40%. Self-employment tax is 15.3% federal. Quarterly estimated payments not required until expected annual tax liability exceeds $1,000.

### 5. IP Protection: File Trademark Now, Acquire .com Later — SELECTED

**File now ($700 for Classes 42 + 41):** "Afterset" is a coined/fanciful mark — highest distinctiveness, ~85–90% approval likelihood. Intent-to-Use filing locks in a priority date nationwide. An unrelated bar already uses the Afterset name — delay increases risk. USPTO fee is $350/class (unified filing effective January 2025).

**Wait until revenue:** Saves $700 but cedes priority date. A SaaS product operating nationally without federal trademark protection relies solely on common-law rights, which are geographically limited and difficult to enforce for internet businesses. $700 is less than three months of a Pro subscription from one customer.

**Colorado state trademark ($30):** Cheap supplementary layer. File it.

**Domain strategy:** Operating on `afterset.net` is workable. Register `afterset.io` and `afterset.co` defensively ($20–$50). Initiate `.com` acquisition at $5K MRR when a $2,000–$10,000 purchase is justifiable. Claim @afterset on all social platforms immediately ($0).

### 6. Insurance: E&O at Launch, Cyber at Growth — SELECTED

**Hiscox E&O / Professional Liability ($270/year, ~$22.50/month):** Covers service failure claims, software bugs causing client harm, missed SLAs. Claims-made policy — must be active before first paying customer. This is the baseline protection for a SaaS product.

**Bundled Tech E&O + Cyber ($730–$1,100/year):** The full bundle adds data breach notification/forensics, legal defense for privacy violations, business interruption. Worth it — but at pre-revenue with low-sensitivity PII (emails and phone numbers, not financial or health data), E&O alone is a defensible starting point.

**Defer all insurance until first customer:** The LLC protects personal assets. The risk during beta with 5 artists and a few hundred fan emails is genuinely low. Acceptable if cash is extremely tight, but not recommended — claims-made gaps are permanent.

**Cyber liability added at 50+ artists:** When the platform holds meaningful fan data volumes, add Hiscox cyber (~$30/month, $360/year) to cover breach notification and forensics. Total at that point: ~$630/year.

**TCPA-specific coverage:** Standard policies generally exclude TCPA claims. Given the RILA exemption covers Afterset's SMS flow, the primary TCPA defense is architectural compliance (ADR-005), not insurance. Revisit if Afterset ever adds ongoing SMS marketing as a feature.

**General Liability ($300–$600/year):** Add when a B2B contract requires a Certificate of Insurance — typically at the first venue, promoter, or enterprise artist deal.

---

## Consequences

### Positive

- Entity formation to bank account to Stripe in a single afternoon for $50.
- Total first-year cost under $2,000 all-in. Ongoing ~$47.50/month — less than two Pro subscriptions.
- TCPA compliance is architecture-enforced (ADR-005), not artist-dependent. RILA exemption covers the core SMS flow. Telnyx handles opt-out at the carrier level. This eliminates the need for $5,000 in TCPA-specific legal work at launch.
- Provider-delegated compliance: Telnyx handles STOP/HELP, Resend handles List-Unsubscribe and suppression, Stripe handles PCI, Supabase handles encryption at rest and SOC 2. The platform inherits their compliance infrastructure.
- Trademark filing locks in nationwide priority for a strong coined mark at $700.
- Every optimization (S-Corp election, Delaware C-Corp, full legal package, bundled insurance) has a specific revenue trigger. No premature complexity.

### Negative

- Template legal documents are not custom-fit. The targeted attorney review mitigates this for the two highest-risk areas (TCPA vicarious liability, CPA processor language), but edge cases may exist in the ToS.
- E&O-only insurance does not cover data breach notification costs. A breach before cyber is added means paying notification and forensics out of pocket. At <50 artists with low-sensitivity PII, this risk is accepted.
- The RILA exemption is narrow. If Afterset ever adds ongoing SMS messaging to fans (beyond the single auto-reply), the exemption no longer applies and the full TCPA compliance stack becomes necessary. This must be treated as a hard product constraint until the legal posture is upgraded.
- Operating on `afterset.net` without the `.com` creates minor brand leakage.
- Self-filing the trademark without an attorney increases risk of procedural error. The $350/class filing fee is non-refundable if abandoned.

---

## Revisit When

- **Net self-employment income exceeds $50K/year.** Evaluate S-Corp election with CPA.
- **Pursuing institutional investment.** Convert to Delaware C-Corp before a Series A.
- **Monthly revenue exceeds $1K.** Formalize multi-state sales tax compliance. Enable Stripe Tax. Begin quarterly estimated taxes if annualized liability exceeds $1,000.
- **Revenue exceeds $5K MRR.** Engage SaaS attorney for full legal package ($2,500–$5,000): custom ToS, DPA, strengthened AUP. At this revenue the cost is justified and the product's actual usage patterns inform better scoping.
- **50+ artists with real fan lists.** Add cyber liability to insurance (~$30/month). Transition from E&O-only to bundled Tech E&O + Cyber.
- **First enterprise/venue contract requiring COI.** Bind General Liability.
- **Revenue exceeds $100K in any single state.** Register for that state's sales tax.
- **Any product decision to add ongoing SMS messaging to fans.** Full TCPA compliance stack required — RILA exemption no longer applies. Budget $2,500–$5,000 for attorney review of SMS-specific ToS provisions and consent architecture.
- **Transaction volume exceeds 50/month in Wave.** Upgrade to Wave Pro ($16–$19/month).
- **Notice of Allowance received from USPTO.** File Statement of Use within 6 months (or extension at $125/class). Calendar immediately — 84% of failed ITU applications fail because the SOU is never filed.
- **Team grows beyond solo founder.** Add D&O insurance, Workers' Compensation (Colorado requires it).

---

## Validation Tasks Before Committing

These should be completed during the Pre-Build Phase, before the first paying customer:

1. **[ ] Form Colorado LLC.** File Articles of Organization at sos.colorado.gov ($50). Confirm instant processing. Save state ID number.
2. **[ ] Obtain EIN.** Apply at irs.gov immediately after LLC formation ($0). Complete in one session (15-minute inactivity timeout). Save CP-575 letter.
3. **[ ] Open Mercury business account.** Requires Articles of Organization + EIN + photo ID. Verify 1–2 day approval timeline.
4. **[ ] Connect Stripe to Mercury.** Set up Stripe as business account with EIN. Route all payouts to Mercury. Test a $1 charge and payout.
5. **[ ] Set up Termly Pro+ and generate ToS + Privacy Policy.** Publish both before any fan data collection. Link from all capture pages, SMS confirmations, and email footers.
6. **[ ] Implement clickwrap ToS acceptance.** Checkbox + "I agree" on artist signup flow. Browsewrap is not sufficient.
7. **[ ] Get PO Box.** Cheapest USPS option (~$5/month). Address goes in every email footer for CAN-SPAM.
8. **[ ] Verify CAN-SPAM compliance in email templates.** Every email includes: functional unsubscribe link, physical postal address, accurate From/Reply-To headers, non-deceptive subject line. Unsubscribe removes immediately.
9. **[ ] Verify TCPA compliance in SMS flow.** Confirm auto-reply contains only URL + compliance language (no promotional copy). Confirm Telnyx auto opt-out handles STOP/HELP/CANCEL/END/QUIT/UNSUBSCRIBE. Confirm consent logging records timestamp + phone + keyword. This validates the RILA exemption posture.
10. **[ ] Bind Hiscox E&O insurance.** ~$22.50/month. Bind before first paying customer.
11. **[ ] File federal trademark.** USPTO Intent-to-Use application for "Afterset" in Classes 42 and 41 ($700). Calendar all deadlines.
12. **[ ] Set up Wave bookkeeping.** Create account, connect to Mercury manually, categorize all pre-launch expenses. Track from day one.
13. **[ ] Schedule targeted attorney consultation.** 1–2 hours ($300–$500) via ContractsCounsel or UpCounsel. Bring Termly-generated docs. Scope: TCPA vicarious liability + CPA processor language.

---

## Research Sources

Detailed research across three sessions covering entity formation, banking, tax obligations, TCPA/CAN-SPAM compliance, privacy law, data processing agreements, trademark registration, and insurance. Key confidence levels:

- Colorado LLC filing fee $50: **VERIFIED** (Colorado SOS)
- Colorado periodic report $25/year: **VERIFIED** (SB 23-276, effective July 2024)
- TCPA penalties $500–$1,500 per message, no cap: **VERIFIED** (47 U.S.C. § 227)
- FCC RILA exemption for single reply to consumer-initiated text: **VERIFIED** (FCC 15-72, July 10, 2015)
- CAN-SPAM penalties up to $53,088 per email: **VERIFIED** (FTC inflation-adjusted 2024)
- CAN-SPAM has no private right of action: **VERIFIED** (15 U.S.C. § 7706)
- Colorado Privacy Act enforcement live, 60-day cure expired Jan 1, 2025: **VERIFIED** (Colorado AG)
- SaaS not taxable at Colorado state level: **VERIFIED** (June 2020 PLR)
- SaaS taxable in Colorado home-rule cities (e.g., Denver): **VERIFIED** (Anrok, Stripe)
- USPTO trademark fee $350/class (unified filing, Jan 2025): **VERIFIED** (USPTO fee schedule)
- Standard E&O/cyber policies generally exclude TCPA: **VERIFIED** (multiple legal analyses)
- Hiscox E&O starting at $22.50/month: **VERIFIED** (Hiscox website)
- Telnyx toll-free verification is free: **VERIFIED** (ADR-005 research, Telnyx docs)
- Telnyx built-in STOP/HELP handling: **VERIFIED** (ADR-005 research, Telnyx docs)
