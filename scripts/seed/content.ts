/**
 * Starter CMS content: legal pages (drafts for legal review), three guides
 * for the blog, and general FAQs. Seeded with $setOnInsert, so edits made in
 * Admin → Content are never overwritten by a re-seed.
 */

export const LEGAL_PAGES = [
  {
    slug: "privacy",
    title: { en: "Privacy policy", ne: "गोपनीयता नीति" },
    summary: {
      en: "What personal information MantraSphere Real Estate collects, why, who it is shared with, how long it is kept and how to ask for it to be corrected or deleted.",
      ne: "मन्त्रास्फियर रियल इस्टेटले कुन व्यक्तिगत विवरण किन सङ्कलन गर्छ, कोसँग साझा हुन्छ, कति समय राखिन्छ र सच्याउन वा मेटाउन कसरी अनुरोध गर्ने।",
    },
    body: {
      en: `This policy explains how MantraSphere Innovations Pvt. Ltd. ("we", "us") handles personal information on the MantraSphere Real Estate website. We follow the Individual Privacy Act, 2075 (2018) of Nepal.

## What we collect

- **Account details:** your name, mobile number and, if you add it, your email address. Passwords are stored only as a secure hash.
- **Listings:** the property details, photos, location and contact number you enter when you post a property.
- **Enquiries:** when you contact an owner or send us a message, we store your name, phone number, optional email and message.
- **Verification documents:** if you ask to be marked as a verified owner or agent, the documents you upload. These are kept in private storage that only our staff can open.
- **Payments:** the plan you bought, the amount, the payment method and the reference from eSewa, Khalti or your bank. We never see or store your eSewa or Khalti PIN or password.
- **Technical data:** a one-way hash of your IP address (used to stop spam and abuse) and the pages you view on a listing, counted without identifying you.

## Why we use it

- To run your account and show your listings.
- To pass your enquiry to the owner or agent of the property you contacted.
- To send login codes, payment receipts, listing reminders and the alerts you asked for.
- To review listings, prevent fraud and spam, and keep records required by law.

We do not sell your personal information, and we do not use it for advertising by others.

## Who we share it with

- **The owner or agent** of a listing you enquire about receives your name, phone number and message.
- **Service providers** that help us run the site: SMS and email delivery, payment gateways (eSewa, Khalti), Cloudflare Turnstile (spam protection) and our hosting provider. They may use the information only to provide their service to us.
- **Authorities**, when Nepali law requires it.

Maps on the site are loaded from OpenStreetMap, which receives your IP address when map tiles load.

## Cookies and storage on your device

We use a login cookie to keep you signed in. Saved properties and the properties you pick to compare are stored in your browser so they work without an account. We do not use advertising cookies.

## How long we keep it

- Account details: while your account is open, and up to 12 months after you close it.
- Enquiries: up to 24 months.
- Payment records: as long as Nepali tax law requires.
- Verification documents: until verification is complete and up to 12 months after, unless you ask us to delete them sooner.

## Your rights

You can see and edit your profile and listings in your dashboard at any time. To get a copy of your information, correct it, or have your account and data deleted, contact us using the details below. We reply within 30 days.

## Contact

MantraSphere Innovations Pvt. Ltd., Dhangadhimai-10, Siraha, Nepal. Email: info@mantrasphere.com.np. Phone: +977 9849361011.

We may update this policy. The date at the top of the page shows the latest change.`,
      ne: "",
    },
  },
  {
    slug: "terms",
    title: { en: "Terms of use", ne: "प्रयोगका सर्तहरू" },
    summary: {
      en: "The rules for using MantraSphere Real Estate: accounts, posting listings, paid plans and refunds, our review of listings, and the limits of our responsibility.",
      ne: "मन्त्रास्फियर रियल इस्टेट प्रयोग गर्ने नियम: खाता, सूची राख्ने, सशुल्क योजना र फिर्ता, सूचीको जाँच, र हाम्रो जिम्मेवारीको सीमा।",
    },
    body: {
      en: `These terms apply to everyone who uses the MantraSphere Real Estate website, run by MantraSphere Innovations Pvt. Ltd. By using the site you agree to them.

## Using the site

- You must be at least 18 years old to create an account or post a listing.
- Keep your login codes and password private. You are responsible for activity on your account.
- Do not copy listings in bulk, send spam, or try to get around our security.

## Posting a property

- You may list only property that you own or are authorised to sell or rent. We may ask for proof.
- Information must be true and current: price, area, location and photos must match the actual property. Photos must be your own or used with permission.
- Mark a property as sold or rented as soon as it is no longer available.
- We review every listing before it goes live and may edit, reject or remove a listing that breaks these terms or the law. Repeated or serious breaches may lead to account suspension.

## Plans and payments

- Paid plans give a listing more visibility for the period shown on the pricing page. Prices include any applicable taxes unless stated otherwise.
- A plan starts when our team approves the listing. Renewals and upgrades start when the payment is confirmed.
- If we reject a listing after you have paid, we will refund the plan fee or let you correct and resubmit the listing. Once a listing has been approved and published, the plan fee is not refundable.
- Payments by eSewa and Khalti are confirmed automatically. Bank transfers are confirmed after we check the deposit slip.

## Enquiries and deals

MantraSphere Real Estate connects buyers, tenants, owners and agents. Unless a listing is marked as posted by MantraSphere, we are not a party to any sale or rental. Check the land ownership certificate, map and other documents yourself, ideally with a lawyer, before paying any money.

## Our responsibility

We work to keep listings accurate but cannot guarantee every detail that owners and agents provide. To the extent the law allows, we are not liable for losses arising from a transaction between users or from information supplied by them.

## Changes and governing law

We may update these terms; the date at the top shows the latest change. These terms are governed by the laws of Nepal, and disputes will be handled by the competent courts of Nepal.

## Contact

MantraSphere Innovations Pvt. Ltd., Dhangadhimai-10, Siraha, Nepal. Email: info@mantrasphere.com.np.`,
      ne: "",
    },
  },
];

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Cover photo per post: a CC0 demo photo (see demo-photos.json), copied into the CMS upload folder by the seed. */
export const BLOG_COVERS: Record<string, { photo: string; alt: string }> = {
  "land-units-in-nepal-ropani-aana-bigha-kattha": { photo: "land-01", alt: "Terraced farmland on a hillside in Nepal" },
  "checklist-before-buying-land-in-nepal": { photo: "land-04", alt: "An open plot of land with houses behind it" },
  "how-home-loan-emi-works-in-nepal": { photo: "house-06", alt: "A two-storey family house in Nepal" },
};

export const BLOG_POSTS = () => [
  {
    slug: "land-units-in-nepal-ropani-aana-bigha-kattha",
    title: { en: "Land units in Nepal: ropani, aana, bigha and kattha explained", ne: "नेपालका जग्गा एकाइ: रोपनी, आना, बिघा र कट्ठा" },
    excerpt: {
      en: "Why a plot is measured in ropani in Kathmandu but in kattha in the terai, how the units fit together, and how to convert them to square feet.",
      ne: "काठमाडौंमा रोपनी तर तराईमा कट्ठामा किन नापिन्छ, एकाइहरू कसरी जोडिन्छन् र वर्ग फिटमा कसरी रूपान्तरण गर्ने।",
    },
    tags: ["land", "units", "buying"],
    publishedAt: days(21),
    body: {
      en: `Nepal uses two traditional systems for land, and listings often switch between them. Knowing how they fit together helps you compare prices fairly.

## The hill system: ropani, aana, paisa, daam

Used in the hills and the Kathmandu valley.

- 1 ropani = 16 aana = 5,476 sq ft
- 1 aana = 4 paisa = 342.25 sq ft
- 1 paisa = 4 daam = 85.56 sq ft
- 1 daam = 21.39 sq ft

Areas are often written as four numbers, for example **1-4-0-0**, meaning 1 ropani 4 aana 0 paisa 0 daam.

## The terai system: bigha, kattha, dhur

Used in the terai districts, such as Siraha, Morang or Kailali.

- 1 bigha = 20 kattha = 72,900 sq ft
- 1 kattha = 20 dhur = 3,645 sq ft
- 1 dhur = 182.25 sq ft

## Comparing the two

One kattha (3,645 sq ft) is a little more than 10 aana (3,422.5 sq ft). One bigha is about 13.3 ropani.

## Compare price per unit, not total price

A land price is often quoted "per aana" or "per kattha". To compare two plots, convert both to the same unit first. Our [land unit converter](/en/tools/land-unit-converter) does this instantly, and every listing on MantraSphere shows the original area together with its size in square feet.

## Always check the certificate

The area that counts is the one on the land ownership certificate (lalpurja) and the official map. Ask the owner for both before you pay a deposit.`,
      ne: "",
    },
  },
  {
    slug: "checklist-before-buying-land-in-nepal",
    title: { en: "A checklist before you buy land in Nepal", ne: "नेपालमा जग्गा किन्नुअघिको जाँचसूची" },
    excerpt: {
      en: "The documents to see, the questions to ask and the site checks to make before you pay a deposit on a plot of land.",
      ne: "जग्गाको बैना दिनुअघि हेर्नुपर्ने कागजात, सोध्नुपर्ने प्रश्न र गर्नुपर्ने स्थलगत जाँच।",
    },
    tags: ["land", "buying", "documents"],
    publishedAt: days(12),
    body: {
      en: `Buying land is one of the largest payments most families make. A few checks before you pay any money can prevent years of trouble.

## Documents to see

1. **Land ownership certificate (lalpurja).** Check that the owner's name, plot number and area match what you were told.
2. **Cadastral map (naksa) and trace.** These show the plot's shape, its neighbours and whether it touches a public road.
3. **Owner's citizenship certificate.** The seller should be the person named on the lalpurja, or hold a valid power of attorney.
4. **Land revenue tax receipt.** Confirms the yearly tax has been paid.

Ask for copies, and check the details at the Land Revenue Office (malpot) before signing anything.

## On the site

- Walk the boundary with the owner and compare it with the map.
- Measure the access road. Many municipalities need a minimum road width before they approve a building plan.
- Ask neighbours whether there is any dispute about the boundary or a path.
- Check whether electricity, water and drainage reach the plot.

## Before you pay

- Ask the municipality whether the land falls in a zone where you can build what you plan.
- Find out if the plot is mortgaged to a bank. A mortgaged plot cannot be transferred until the loan is cleared.
- Put any deposit agreement in writing, with the plot number, the full price and the date for transfer.

A lawyer or a licensed surveyor can do these checks for you for a modest fee. On MantraSphere, listings from verified owners and agents are marked, but you should always see the original documents yourself.`,
      ne: "",
    },
  },
  {
    slug: "how-home-loan-emi-works-in-nepal",
    title: { en: "How a home loan EMI works in Nepal", ne: "नेपालमा घर कर्जाको EMI कसरी काम गर्छ" },
    excerpt: {
      en: "What the monthly instalment is made of, why the interest rate matters so much over 20 years, and how to plan your budget before you apply.",
      ne: "मासिक किस्ता केले बनेको हुन्छ, २० वर्षमा ब्याज दरले कति फरक पार्छ, र आवेदन दिनुअघि बजेट कसरी बनाउने।",
    },
    tags: ["home loan", "EMI", "finance"],
    publishedAt: days(4),
    body: {
      en: `Most banks in Nepal offer home loans repaid in equal monthly instalments, called EMI. Understanding the EMI helps you choose a loan you can comfortably pay.

## What the EMI pays for

Each instalment covers the interest for that month on the remaining balance, and the rest reduces the loan. In the early years most of the EMI goes to interest. Later, most of it reduces the balance.

## Why the rate matters

On a long loan, a small change in the rate makes a large difference. For a loan of Rs 50 lakh over 20 years, every 1% added to the rate raises the EMI by roughly Rs 3,000 a month and the total interest by several lakh. Try different rates in our [EMI calculator](/en/tools/emi-calculator) to see the effect.

## Planning your budget

- Keep the EMI to a share of your monthly income that still leaves room for living costs and savings. Banks will also check this.
- Nepal Rastra Bank sets limits on how much banks can lend against a property's value. Ask your bank for the current limit, and plan to pay the rest as a down payment.
- Add the one-time costs: registration fees and taxes at the land revenue office, the bank's service charge and valuation fee.

## Fixed or floating?

Many home loans in Nepal have a floating rate that moves with the bank's base rate, so your EMI can change during the loan. Ask whether the bank changes the EMI or the number of months when the rate changes.

## Before you sign

Compare the offers of two or three banks, read the loan agreement carefully, and ask about the charge for paying the loan off early.`,
      ne: "",
    },
  },
];

export const EXTRA_FAQS = [
  {
    category: "GENERAL",
    question: { en: "Is it free to search and contact owners?", ne: "खोज्न र धनीलाई सम्पर्क गर्न निःशुल्क हो?" },
    answer: {
      en: "Yes. Searching, saving properties, comparing them and contacting owners or agents are free. Only owners and agents pay, for listing plans.",
      ne: "हो। खोज्ने, सम्पत्ति सुरक्षित गर्ने, तुलना गर्ने र धनी वा एजेन्टलाई सम्पर्क गर्ने काम निःशुल्क छ। सूची योजनाका लागि धनी र एजेन्टले मात्र तिर्छन्।",
    },
  },
  {
    category: "GENERAL",
    question: { en: "Are the listings checked?", ne: "सूचीहरू जाँच गरिन्छन्?" },
    answer: {
      en: "Our team reviews every listing before it goes live and removes listings that are reported as sold or misleading. Owners and agents who have shown us their documents carry a “Verified” badge. Always check the original land documents yourself before paying any money.",
      ne: "हरेक सूची प्रकाशित हुनुअघि हाम्रो टोलीले जाँच गर्छ, र बिक्री भएको वा भ्रामक भनी उजुरी आएका सूची हटाउँछ। कागजात देखाएका धनी र एजेन्टमा “प्रमाणित” चिन्ह हुन्छ। पैसा तिर्नुअघि सधैं जग्गाको मूल कागजात आफैं जाँच्नुहोस्।",
    },
  },
  {
    category: "GENERAL",
    question: { en: "How do I get alerts for new properties?", ne: "नयाँ सम्पत्तिको सूचना कसरी पाउने?" },
    answer: {
      en: "Search for properties with the filters you want, then tap “Save search”. Choose email or SMS and how often you want alerts. You can pause or delete alerts any time under “Saved searches” in your dashboard.",
      ne: "चाहेका फिल्टरसहित सम्पत्ति खोज्नुहोस्, अनि “खोज सुरक्षित गर्नुहोस्” थिच्नुहोस्। इमेल वा एसएमएस र कति पटक सूचना चाहिन्छ छान्नुहोस्। ड्यासबोर्डको “सुरक्षित खोजहरू” मा जुनसुकै बेला रोक्न वा मेटाउन सकिन्छ।",
    },
  },
  {
    category: "GENERAL",
    question: { en: "Can I compare properties side by side?", ne: "सम्पत्ति छेउछेउ राखेर तुलना गर्न मिल्छ?" },
    answer: {
      en: "Yes. Tap “Compare” on up to three listings, then open the comparison to see price, price per square foot, area, road width and other details in one table.",
      ne: "मिल्छ। बढीमा तीन वटा सूचीमा “तुलना” थिच्नुहोस्, अनि मूल्य, प्रति वर्ग फिट मूल्य, क्षेत्रफल, बाटोको चौडाइ लगायत विवरण एउटै तालिकामा हेर्नुहोस्।",
    },
  },
];
