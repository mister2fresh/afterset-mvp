export type HelpTopic = {
	id: string;
	title: string;
	body: string;
	/** Loom embed URL or R2 video URL (optional) */
	videoUrl?: string;
};

export type HelpCategory = {
	id: string;
	title: string;
	description: string;
	topics: HelpTopic[];
};

export const helpCategories: HelpCategory[] = [
	{
		id: "getting-started",
		title: "Getting Started",
		description: "Set up your first capture page and start collecting fans.",
		topics: [
			{
				id: "create-page",
				title: "Creating your first capture page",
				body: `Your capture page is the landing page fans visit to join your email list. To create one:

1. Go to the **Pages** tab and click **New Page**.
2. Give it a title — this is what fans see, so use something like "Austin March 28" or your band name.
3. Pick a style preset or customize colors, fonts, and button style.
4. Hit **Save** — your page is live instantly.

Your page gets a permanent URL like **afterset.net/your-slug**. You can share this link, print it on a QR code, or pair it with an SMS keyword.`,
			},
			{
				id: "share-page",
				title: "Sharing your page (QR, NFC, link, SMS)",
				body: `There are several ways to get fans to your capture page:

- **Direct link** — Share your afterset.net/your-slug URL on social media, in your bio, or on merch.
- **QR code** — Print the QR code from your page card. Fans scan it with their phone camera and land directly on your page.
- **NFC chip** — Program an NFC sticker or card with your page URL. Fans tap their phone to open it.
- **SMS keyword** — Set up a text-to-join keyword so fans can text a word to your number and get auto-subscribed.

All of these point to the same page, so you only need to set things up once.`,
			},
			{
				id: "first-fans",
				title: "What happens when a fan signs up",
				body: `When a fan enters their email on your capture page:

1. They're instantly added to your fan list (visible in the **Fans** tab).
2. If you've set up a follow-up email sequence, the first email sends automatically based on your timing settings.
3. The capture is tagged with the page title at that moment — so if your page says "Nashville April 5", that context is preserved forever, even if you change the title later.

You can view all captures in the **Fans** tab, filter by page, date, or method, and export to CSV.`,
			},
		],
	},
	{
		id: "pages",
		title: "Capture Pages",
		description: "How the single-page model works and how to customize your pages.",
		topics: [
			{
				id: "single-page-model",
				title: "The single-page model: one page, many shows",
				body: `Most artists only need **one capture page**. Here's how it works:

- Your page has a **permanent slug** (URL) — this never changes. Print it on stickers, QR codes, NFC chips, etc.
- Before each show, update the **display title** (e.g., "Austin March 28" → "Nashville April 5").
- When a fan signs up, the current title is saved with their capture, so you always know which show they came from.

This means your QR code, NFC chip, and SMS keyword all keep working — you just swap the title.`,
			},
			{
				id: "customize-style",
				title: "Customizing your page style",
				body: `Each capture page has several style options:

- **Presets** — Choose from 6 presets (Gold, Neon, Ember, Violet, Minimal, Verdant) as a starting point.
- **Colors** — Set accent color, secondary color, text color, and background color. Button text contrast is auto-detected.
- **Font style** — Modern (sans-serif), Editorial (serif), Mono (monospace), or Condensed (sans-serif + uppercase).
- **Title size** — Default, Large, or XL.
- **Layout** — Centered or Stacked.
- **Background** — Solid, gradient, or other styles.
- **Button** — Rounded, sharp, pill, etc.

Changes are reflected instantly on the live page.`,
			},
			{
				id: "delete-page",
				title: "Deleting a page",
				body: `Deleting a capture page is safe — all your fan data and capture history are preserved. The page URL will stop working, but:

- Fans already captured remain in your fan list.
- Capture history still shows the page title that was active when each fan signed up.
- Email sequences already in progress will continue to send.

You can delete a page from the page card dropdown menu.`,
			},
		],
	},
	{
		id: "emails",
		title: "Emails & Sequences",
		description: "Follow-up emails, drip sequences, and broadcasts.",
		topics: [
			{
				id: "follow-up-sequence",
				title: "Setting up a follow-up email sequence",
				body: `A follow-up sequence is a series of emails that automatically send to fans after they sign up. To set one up:

1. Go to **Emails** tab or click the email icon on a page card.
2. Add your first email (Step 1). Choose when it sends: immediately, 1 hour later, or next morning.
3. Add more steps (up to 5 total). Steps 2–5 send on a delay measured in days, always at 9am in your timezone.

Each step has its own subject line and body. Emails are plain text — keep them personal and conversational.`,
			},
			{
				id: "email-templates",
				title: "Writing effective email templates",
				body: `Your follow-up emails are plain text by default — this is intentional. Plain text emails feel personal and have higher open rates.

Tips:
- **Keep it short** — 2–3 sentences max for the first email. Fans just gave you their email; don't overwhelm them.
- **Be conversational** — Write like you're texting a friend, not sending a newsletter.
- **Include a call to action** — Link to your music, merch, or next show.
- **Use the preview** — Check how your email looks before saving.`,
			},
			{
				id: "broadcasts",
				title: "Sending a broadcast to all fans",
				body: `Broadcasts are one-off emails to your full fan list or a filtered segment. Use them for:

- New release announcements
- Merch drops
- Upcoming show details
- Tour dates

To send a broadcast:

1. Go to **Emails** tab → **Email Fans** section.
2. Create a new broadcast, choose a template or write from scratch.
3. Optionally filter by capture page, date range, or signup method.
4. Preview, then send.

Limits: 1 broadcast per day, 5,000 max recipients per send.`,
			},
		],
	},
	{
		id: "sms",
		title: "SMS Keywords",
		description: "Text-to-join keywords for live shows.",
		topics: [
			{
				id: "setup-keyword",
				title: "Setting up an SMS keyword",
				body: `SMS keywords let fans text a word to your number and get auto-subscribed. To set one up:

1. Open a capture page and click the keyword option.
2. Choose a keyword (2–20 characters, letters and numbers only). It's case-insensitive.
3. The system checks availability — keywords are unique per phone number.

Once set, fans text your keyword to the number shown and they're captured just like a web signup. The same page title snapshot and email sequence apply.

Some words are reserved (STOP, HELP, etc.) and can't be used as keywords.`,
			},
			{
				id: "keyword-tips",
				title: "Tips for choosing a good keyword",
				body: `Your keyword should be:

- **Short** — Easy to remember and type quickly. 4–8 characters is ideal.
- **Unique to you** — Your band name, a song title, or a memorable word.
- **Easy to say out loud** — You'll be telling fans to "text KEYWORD to this number" from stage.
- **Not easily confused** — Avoid words that sound like other words or are hard to spell.

Examples: RIFFS, ENCORE, VIBE, your band name abbreviation.`,
			},
		],
	},
	{
		id: "analytics",
		title: "Analytics",
		description: "Understanding your fan capture and email performance data.",
		topics: [
			{
				id: "dashboard-overview",
				title: "Understanding your dashboard",
				body: `The **Overview** tab shows your key metrics at a glance:

- **Total fans** — All unique fans across all your capture pages.
- **Total pages** — Number of active capture pages.
- **This week** — New fan signups in the last 7 days.
- **Daily chart** — Fan captures over the last 30 days.

Use this to spot trends — if captures spike after a show, you know your setup is working.`,
			},
			{
				id: "email-analytics",
				title: "Email open rates and performance",
				body: `Each capture page tracks email performance:

- **Sent** — Total emails sent from this page's sequence.
- **Opened** — How many were opened (tracked via open pixel).
- **Open rate** — Percentage of sent emails that were opened.
- **Per-step breakdown** — See which steps in your sequence perform best.

Check the **Analytics** tab for per-page details, or view page-level stats from the page card.

Tip: If open rates drop on later steps, consider shortening your sequence or making later emails more compelling.`,
			},
		],
	},
	{
		id: "account",
		title: "Account & Settings",
		description: "Profile, timezone, and account management.",
		topics: [
			{
				id: "timezone",
				title: "Setting your timezone",
				body: `Your timezone controls when scheduled emails send. Sequence steps 2+ and broadcast emails send at 9am in your timezone.

To update: go to **Settings** and select your timezone from the dropdown. This affects all future scheduled sends — emails already queued will send at their originally scheduled time.`,
			},
			{
				id: "pwa-install",
				title: "Installing the app on your phone",
				body: `Afterset works as a Progressive Web App (PWA) — you can install it on your home screen for a native app experience.

**iPhone (Safari):**
1. Open afterset.net in Safari.
2. Tap the Share button (square with arrow).
3. Scroll down and tap "Add to Home Screen".

**Android (Chrome):**
1. Open afterset.net in Chrome.
2. Tap the three-dot menu.
3. Tap "Install app" or "Add to Home Screen".

Once installed, it opens full-screen like a native app with push notifications.`,
			},
		],
	},
];
