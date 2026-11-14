/** Reference data seeded into a fresh database. All of it is editable in Admin. */

/** Districts where land is usually measured in Bigha-Kattha-Dhur (Terai / inner Terai). */
export const TERAI_DISTRICTS = new Set([
  "Jhapa", "Morang", "Sunsari", "Saptari", "Siraha", "Dhanusha", "Mahottari", "Sarlahi", "Rautahat",
  "Bara", "Parsa", "Chitwan", "Nawalpur", "Parasi", "Rupandehi", "Kapilvastu", "Dang", "Banke",
  "Bardiya", "Kailali", "Kanchanpur", "Udayapur",
]);

export const PLANS = [
  {
    slug: "normal", tier: "NORMAL", priceNpr: 6000, durationDays: 90, homepageSection: null,
    facebookPromotionDays: 5, videoIncluded: false, maxPhotos: 10, sortWeight: 0,
    name: { en: "Normal", ne: "सामान्य" },
    features: {
      en: ["Listed on property pages", "Photos and description", "5 days Facebook promotion"],
      ne: ["सम्पत्ति पृष्ठहरूमा सूचीकृत", "फोटो र विवरण", "५ दिन फेसबुक प्रवर्द्धन"],
    },
  },
  {
    slug: "premium", tier: "PREMIUM", priceNpr: 10000, durationDays: 120, homepageSection: "PREMIUM",
    facebookPromotionDays: 10, videoIncluded: false, maxPhotos: 15, sortWeight: 10,
    name: { en: "Premium", ne: "प्रिमियम" },
    features: {
      en: ["Everything in Normal", "Premium section on the home page", "Premium badge", "10 days Facebook promotion"],
      ne: ["सामान्यका सबै सुविधा", "गृहपृष्ठको प्रिमियम खण्डमा", "प्रिमियम ब्याज", "१० दिन फेसबुक प्रवर्द्धन"],
    },
  },
  {
    slug: "latest", tier: "LATEST", priceNpr: 15000, durationDays: 180, homepageSection: "LATEST",
    facebookPromotionDays: 15, videoIncluded: false, maxPhotos: 20, sortWeight: 20,
    name: { en: "Latest", ne: "लेटेस्ट" },
    features: {
      en: ["Everything in Premium", "Latest section on the home page", "Priority in search results", "15 days Facebook promotion"],
      ne: ["प्रिमियमका सबै सुविधा", "गृहपृष्ठको लेटेस्ट खण्डमा", "खोज नतिजामा प्राथमिकता", "१५ दिन फेसबुक प्रवर्द्धन"],
    },
  },
  {
    slug: "top", tier: "TOP", priceNpr: 25000, durationDays: 300, homepageSection: "TOP",
    facebookPromotionDays: 20, videoIncluded: false, maxPhotos: 25, sortWeight: 30,
    name: { en: "Top", ne: "टप" },
    features: {
      en: ["Everything in Latest", "Top section on the home page", "Top of search results", "20 days Facebook promotion"],
      ne: ["लेटेस्टका सबै सुविधा", "गृहपृष्ठको टप खण्डमा", "खोज नतिजाको सबैभन्दा माथि", "२० दिन फेसबुक प्रवर्द्धन"],
    },
  },
  {
    slug: "highlight", tier: "HIGHLIGHT", priceNpr: 32000, durationDays: null, homepageSection: "HIGHLIGHT",
    facebookPromotionDays: 25, videoIncluded: true, maxPhotos: 30, sortWeight: 40,
    name: { en: "Highlight", ne: "हाइलाइट" },
    features: {
      en: ["Everything in Top", "Highlight hero section", "Professional video", "Stays live until sold", "25 days Facebook promotion"],
      ne: ["टपका सबै सुविधा", "हाइलाइट मुख्य खण्डमा", "व्यावसायिक भिडियो", "नबिकेसम्म सक्रिय", "२५ दिन फेसबुक प्रवर्द्धन"],
    },
  },
] as const;

export const AMENITIES: { slug: string; en: string; ne: string; icon: string; appliesTo?: string[] }[] = [
  { slug: "drinking-water", en: "Drinking water", ne: "खानेपानी", icon: "droplets" },
  { slug: "electricity", en: "Electricity", ne: "बिजुली", icon: "zap" },
  { slug: "sewerage", en: "Sewerage", ne: "ढल", icon: "waves" },
  { slug: "boring-water", en: "Boring / deep tube well", ne: "बोरिङ", icon: "droplet" },
  { slug: "solar", en: "Solar water heater", ne: "सोलार", icon: "sun", appliesTo: ["HOUSE", "BUNGALOW", "FLAT"] },
  { slug: "garden", en: "Garden", ne: "बगैँचा", icon: "trees", appliesTo: ["HOUSE", "BUNGALOW"] },
  { slug: "balcony", en: "Balcony", ne: "बार्दली", icon: "panel-top", appliesTo: ["HOUSE", "BUNGALOW", "FLAT"] },
  { slug: "modular-kitchen", en: "Modular kitchen", ne: "मोड्युलर भान्सा", icon: "chef-hat", appliesTo: ["HOUSE", "BUNGALOW", "FLAT"] },
  { slug: "lift", en: "Lift", ne: "लिफ्ट", icon: "arrow-up-down", appliesTo: ["FLAT", "OFFICE", "COMMERCIAL"] },
  { slug: "backup-power", en: "Power backup", ne: "पावर ब्याकअप", icon: "battery-charging" },
  { slug: "security", en: "24-hour security", ne: "२४ घण्टा सुरक्षा", icon: "shield-check" },
  { slug: "cctv", en: "CCTV", ne: "सीसीटीभी", icon: "cctv" },
  { slug: "internet", en: "Internet ready", ne: "इन्टरनेट", icon: "wifi" },
  { slug: "compound-wall", en: "Compound wall", ne: "कम्पाउन्ड वाल", icon: "brick-wall" },
  { slug: "earthquake-resistant", en: "Earthquake-resistant design", ne: "भूकम्प प्रतिरोधी", icon: "building", appliesTo: ["HOUSE", "BUNGALOW", "FLAT", "COMMERCIAL", "OFFICE"] },
];

export const FAQS = [
  {
    category: "LISTING",
    question: { en: "How do I list my property?", ne: "म आफ्नो सम्पत्ति कसरी राख्न सक्छु?" },
    answer: {
      en: "Sign up with your mobile number, choose “Post property”, fill in the details step by step, add photos, then pick a plan and pay with eSewa, Khalti or bank transfer. Our team reviews every listing before it goes live.",
      ne: "आफ्नो मोबाइल नम्बरबाट दर्ता गर्नुहोस्, “सम्पत्ति राख्नुहोस्” छान्नुहोस्, विवरण क्रमशः भर्नुहोस्, फोटो थप्नुहोस्, अनि योजना छानेर eSewa, Khalti वा बैंक ट्रान्सफरबाट भुक्तानी गर्नुहोस्। हरेक सूची प्रकाशित हुनुअघि हाम्रो टोलीले जाँच गर्छ।",
    },
  },
  {
    category: "LISTING",
    question: { en: "Which land units can I use?", ne: "म कुन जग्गा एकाइ प्रयोग गर्न सक्छु?" },
    answer: {
      en: "Ropani-Aana-Paisa-Daam, Bigha-Kattha-Dhur, square feet or square metres. We show your original figure and a converted value so every buyer understands the size.",
      ne: "रोपनी-आना-पैसा-दाम, बिघा-कट्ठा-धुर, वर्ग फिट वा वर्ग मिटर। हामी तपाईंको मूल अंक र रूपान्तरित मान दुवै देखाउँछौँ।",
    },
  },
  {
    category: "PRICING",
    question: { en: "What happens when my plan expires?", ne: "मेरो योजना सकिएपछि के हुन्छ?" },
    answer: {
      en: "We remind you by SMS and email 7 days and 1 day before expiry. After expiry the listing is hidden from search until you renew or upgrade.",
      ne: "म्याद सकिनु ७ दिन र १ दिन अघि SMS र इमेलबाट जानकारी दिन्छौँ। म्याद सकिएपछि नवीकरण वा अपग्रेड नगरेसम्म सूची खोजबाट लुकाइन्छ।",
    },
  },
  {
    category: "PAYMENT",
    question: { en: "Which payment methods do you accept?", ne: "कुन भुक्तानी विधि स्वीकार गर्नुहुन्छ?" },
    answer: {
      en: "eSewa and Khalti are verified automatically. Bank transfers are activated after our team checks the deposit slip, usually within one working day.",
      ne: "eSewa र Khalti स्वतः प्रमाणित हुन्छन्। बैंक ट्रान्सफर भने हाम्रो टोलीले भौचर जाँचेपछि, प्रायः एक कार्य दिनभित्र सक्रिय हुन्छ।",
    },
  },
  {
    category: "GENERAL",
    question: { en: "How do I mark my property as sold?", ne: "सम्पत्ति बिक्यो भनेर कसरी जनाउने?" },
    answer: {
      en: "Open “My listings” in your dashboard and choose “Mark as sold”. The listing leaves active search right away and appears under “Recently sold”.",
      ne: "ड्यासबोर्डको “मेरा सूचीहरू” खोलेर “बिक्री भयो” छान्नुहोस्। सूची तुरुन्तै सक्रिय खोजबाट हट्छ र “भर्खरै बिक्री भएका” मा देखिन्छ।",
    },
  },
];
