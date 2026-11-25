/**
 * English copy for the marketing site and the sign-in pages.
 * `bn.ts` must provide every key (it is typed against this file).
 * House style: plain verbs, sentence case, no em dashes.
 */
export const en = {
  langName: 'English',
  meta: {
    homeTitle: 'HisabKhata: inventory, POS and invoicing for Bangladeshi shops',
    homeDescription:
      'Run your shop’s stock, sales, dues and invoices in one place. Built for retail, grocery, pharmacy and wholesale businesses in Bangladesh.',
    featuresTitle: 'Features',
    featuresDescription:
      'Point of sale, inventory, purchases, customer dues, invoices, reports and team roles, built for shops in Bangladesh.',
    pricingTitle: 'Pricing',
    pricingDescription:
      'Simple prices in taka. Start free, try Basic for 14 days, pay by bKash, Nagad, card or bank transfer.',
    aboutTitle: 'About',
    aboutDescription: 'Why we built HisabKhata, a khata for shops in Bangladesh made in Sylhet.',
    contactTitle: 'Contact',
    contactDescription:
      'Questions about plans, moving from another system or setting up a barcode scanner? Send us a message.',
    loginTitle: 'Sign in',
    registerTitle: 'Create your account',
  },
  nav: {
    features: 'Features',
    pricing: 'Pricing',
    about: 'About',
    contact: 'Contact',
    signIn: 'Sign in',
    startTrial: 'Start free trial',
    openDashboard: 'Open dashboard',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    home: 'HisabKhata home',
    siteNavigation: 'Site navigation',
  },
  prefs: {
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    switchToDark: 'Switch to dark mode',
    switchToLight: 'Switch to light mode',
  },
  footer: {
    tagline: 'Inventory, point of sale and invoicing for shops and wholesalers in Bangladesh.',
    product: 'Product',
    company: 'Company',
    createAccount: 'Create account',
    followUs: 'Follow us',
    madeIn: 'Made in Sylhet, Bangladesh.',
  },
  common: {
    step: 'Step',
    perMonth: 'month',
    perYear: 'year',
    tryAgain: 'Try again',
    connecting:
      'Connecting to server… after a quiet spell this can take a minute or two. Please keep this page open.',
    serverAsleep: 'We could not reach the server. Check your connection and try again.',
    offline:
      'We could not reach the server. It may still be starting up, so please try again in a minute.',
  },
  home: {
    heroTitle: 'Your shop’s khata, kept straight.',
    heroBody:
      'HisabKhata records every sale, purchase and baki in one place, so the stock on your shelf, the money in your drawer and what customers owe you always agree.',
    heroCta: 'Start your 14-day trial',
    heroSecondary: 'See how it works',
    heroNote: 'Free plan for up to 50 products. No card needed.',
    invoice: {
      label: 'Example invoice and customer balance in HisabKhata',
      store: 'Rahman General Store',
      address: 'Zindabazar, Sylhet',
      date: '21 Nov 2026',
      item: 'Item',
      qty: 'Qty',
      amount: 'Amount',
      total: 'Total',
      paidBy: 'Paid by bKash',
      dues: 'Added to Farzana Begum’s dues',
      stockAfter: 'Stock after this sale',
      rice: 'Miniket Rice 25 kg',
      items: [
        'Miniket Rice 25 kg',
        'Rupchanda Soybean Oil 5 L',
        'চানাচুর (300 g)',
        'Ispahani Tea 400 g',
      ],
      left: (n: number) => `${n} left`,
      browserUrl: 'hisabkhata.app/dashboard',
    },
    stepsTitle: 'One sale, recorded once',
    stepsBody: 'No more writing the same sale in a notebook, a stock register and a dues book.',
    steps: [
      {
        title: 'Scan or search at the counter',
        body: 'Barcode scanners work out of the box. Cash, card, bKash, Nagad and Rocket, split however the customer pays.',
      },
      {
        title: 'Stock and dues update in the same moment',
        body: 'Every sale reduces stock and records the payment in one step. If a customer pays later, their balance is waiting for you.',
      },
      {
        title: 'The invoice is ready',
        body: 'A numbered PDF invoice with your logo, in taka, ready to print or email.',
      },
    ],
    stepVisual: {
      search: 'Scan a barcode or type a name',
      found: 'Miniket Rice 25 kg',
      inStock: '6 in stock',
      stock: 'Stock',
      dues: 'Farzana Begum’s dues',
      invoiceNo: 'Invoice RGS-2600568',
      pdf: 'PDF',
    },
    builtTitle: 'Built for how shops here actually run',
    builtBody: 'Grocery stores, pharmacies, electronics shops, wholesalers and distributors.',
    shopTypes: {
      grocery: 'Grocery',
      pharmacy: 'Pharmacy',
      electronics: 'Electronics',
      wholesale: 'Wholesale',
      distributor: 'Distributor',
    },
    built: [
      {
        title: 'Taka first',
        body: 'Amounts in ৳ with lakh grouping, Asia/Dhaka dates, Bangla product names on invoices.',
      },
      {
        title: 'Baki without the notebook',
        body: 'Sell on credit, collect in parts, print a customer statement any time.',
      },
      {
        title: 'A login for every staff member',
        body: 'Cashiers sell. Managers handle stock. Only owners see profit and settings.',
      },
      {
        title: 'Know what to reorder',
        body: 'Low-stock alerts each morning, and purchase records that track what you owe suppliers.',
      },
      {
        title: 'Your numbers, not estimates',
        body: 'Profit and loss built from real sales, cost of goods and expenses.',
      },
    ],
    previewTitle: 'Your whole shop on one screen',
    previewBody:
      'Today’s sales, what customers owe, what is running low and how the month is going. This is the real dashboard, filled with a demo shop’s data.',
    previewAlt:
      'HisabKhata dashboard showing sales, dues, low stock and a 30-day sales chart for a demo grocery store',
    paymentsLabel: 'Accepted payments',
    payments: {
      cash: 'Cash',
      bkash: 'bKash',
      nagad: 'Nagad',
      rocket: 'Rocket',
      card: 'Card',
      bank: 'Bank transfer',
    },
    faqTitle: 'Questions shop owners ask',
    faq: [
      {
        q: 'What does the free plan include?',
        a: 'Up to 50 products and one login, with the point of sale, invoices, customers, dues and purchases. There is no time limit. Every new business also gets 14 days of Basic to try the rest.',
      },
      {
        q: 'Is my shop’s data safe?',
        a: 'Each business’s records are kept separate from every other business. Everything travels over an encrypted connection, passwords are stored as one-way hashes, and every sensitive action is logged with who did it and when. You can export your reports at any time.',
      },
      {
        q: 'What if my internet is slow or goes off?',
        a: 'HisabKhata is light and works well on mobile data. It does need a connection to save a sale, so keep a phone hotspot handy for outages. A full offline mode is not available yet.',
      },
      {
        q: 'Can I use a barcode scanner?',
        a: 'Yes. Any USB or Bluetooth scanner that types like a keyboard works at the counter with no setup. You can also search by name or SKU.',
      },
      {
        q: 'Can invoices show Bangla product names?',
        a: 'Yes. Product names in Bangla print correctly on PDF invoices, next to amounts in taka.',
      },
      {
        q: 'How do I pay, and can I cancel?',
        a: 'Pay by bKash, Nagad, card or bank transfer. You can change or cancel your plan any time from the Subscription page. There is no contract.',
      },
    ],
    testimonialsTitle: 'What shop owners say',
    ctaTitle: 'Open your khata today',
    ctaBody: 'Set up takes about a minute. Bring your product list; we will handle the rest.',
    ctaButton: 'Create free account',
  },
  features: {
    title: 'Everything a shop needs to keep its accounts straight',
    intro:
      'HisabKhata covers the full loop: buy stock, sell it, collect what you are owed, and see what you earned.',
    start: 'Start free trial',
    compare: 'Compare plans',
    sections: [
      {
        key: 'pos',
        title: 'Point of sale',
        intro: 'A counter screen made for speed, on a laptop, tablet or a phone.',
        items: [
          'Barcode scanning and search by name or SKU',
          'Line and order discounts, configurable tax',
          'Cash, card, bKash, Nagad, Rocket and split payments',
          'Change calculated automatically',
          'Credit sales added to the customer’s dues',
          'Returns and cancellations that restock automatically',
        ],
        demo: {
          title: 'Counter 1',
          rows: [
            ['Miniket Rice 25 kg × 2', '৳3,700'],
            ['Paid by bKash', '৳3,000'],
            ['To dues', '৳700'],
          ],
        },
      },
      {
        key: 'inventory',
        title: 'Inventory',
        intro: 'Stock levels you can trust, because every change has a reason.',
        items: [
          'Products with SKU, barcode, unit, cost and selling price',
          'Categories, photos and bulk actions',
          'Stock history for every product',
          'Adjustments for damage, expiry, loss or recount',
          'Low and out-of-stock alerts',
          'Stock value at cost and at retail',
        ],
        demo: {
          title: 'Stock history',
          rows: [
            ['Sale RGS-2600568', '−2'],
            ['Purchase from Akij Foods', '+20'],
            ['Damaged, 1 bag torn', '−1'],
          ],
        },
      },
      {
        key: 'purchases',
        title: 'Purchases and suppliers',
        intro: 'Record what comes in and what you owe for it.',
        items: [
          'Purchases add stock immediately',
          'Partial payments and supplier dues',
          'Pay suppliers against the oldest bills first',
          'Cancel a purchase and reverse its stock',
        ],
        demo: {
          title: 'Akij Foods',
          rows: [
            ['Purchase PUR-0142', '৳36,000'],
            ['Paid', '৳20,000'],
            ['You owe', '৳16,000'],
          ],
        },
      },
      {
        key: 'customers',
        title: 'Customers and dues',
        intro: 'Replace the baki notebook.',
        items: [
          'Customer profiles with purchase history',
          'Outstanding balance on every profile',
          'Collect payments that settle the oldest invoices first',
          'Statements you can download',
        ],
        demo: {
          title: 'Farzana Begum',
          rows: [
            ['Invoice RGS-2600512', '৳1,250'],
            ['Invoice RGS-2600568', '৳2,060'],
            ['Total due', '৳3,310'],
          ],
        },
      },
      {
        key: 'invoices',
        title: 'Invoices',
        intro: 'Numbered, professional and in taka.',
        items: [
          'Your logo, address and BIN on every invoice',
          'Sequential numbers per business with your own prefix',
          'Download as PDF or email to the customer',
        ],
        demo: {
          title: 'RGS-2600568',
          rows: [
            ['Total', '৳5,060'],
            ['Paid', '৳3,000'],
            ['Due', '৳2,060'],
          ],
        },
      },
      {
        key: 'reports',
        title: 'Reports',
        intro: 'Clear definitions, so the numbers mean the same thing every time.',
        items: [
          'Daily, weekly, monthly and annual sales',
          'Profit and loss: revenue, cost of goods, gross profit, expenses, net profit',
          'Inventory, low stock, purchases, customers, expenses, payments and dues',
          'Export any report as CSV or PDF',
        ],
        demo: {
          title: 'November',
          rows: [
            ['Revenue', '৳4,82,300'],
            ['Cost of goods', '৳3,96,100'],
            ['Net profit', '৳61,450'],
          ],
        },
      },
      {
        key: 'team',
        title: 'Team and security',
        intro: 'Everyone signs in as themselves.',
        items: [
          'Owner, manager, cashier and staff roles, plus custom roles',
          'Every sensitive action is logged',
          'Each business’s data is isolated from every other business',
          'Run more than one business from one account',
        ],
        demo: {
          title: 'Team',
          rows: [
            ['Abdur Rahman', 'Owner'],
            ['Sumon Ahmed', 'Manager'],
            ['Rina Akter', 'Cashier'],
          ],
        },
      },
    ],
  },
  pricing: {
    title: 'Simple prices in taka',
    intro:
      'Start free. Every new business gets 14 days of Basic. Pay by bKash, Nagad, card or bank transfer.',
    period: 'Billing period',
    monthly: 'Monthly',
    yearly: 'Yearly, 2 months free',
    popular: 'Most popular',
    startFree: 'Start free',
    tryPlan: (name: string) => `Try ${name} free`,
    plans: {
      FREE: { name: 'Free', description: 'For a single shop getting started.' },
      BASIC: { name: 'Basic', description: 'For growing shops with a small team.' },
      PREMIUM: {
        name: 'Premium',
        description: 'For wholesalers, distributors and multi-counter stores.',
      },
    } as Record<string, { name: string; description: string }>,
    unlimitedProducts: 'Unlimited products',
    upToProducts: (n: number) => `Up to ${n} products`,
    unlimitedTeam: 'Unlimited team members',
    justYou: 'Just you',
    upToTeam: (n: number) => `Up to ${n} team members`,
    core: 'POS, invoices, customers, purchases',
    featureNames: {
      ADVANCED_REPORTS: 'Profit and loss, product, customer and payment reports',
      ADVANCED_ANALYTICS: 'Advanced analytics',
      PRIORITY_SUPPORT: 'Priority support',
      INVOICE_EMAIL: 'Email invoices to customers',
    } as Record<string, string>,
    note: 'Prices include VAT where applicable. You can change or cancel your plan at any time from the Subscription page.',
    compareTitle: 'Compare plans',
    compareFeature: 'Feature',
    unlimited: 'Unlimited',
    included: 'Included',
    notIncluded: 'Not included',
    rows: {
      products: 'Products',
      team: 'Team logins',
      pos: 'Point of sale and invoices',
      dues: 'Customer dues and statements',
      purchases: 'Purchases and supplier dues',
      basicReports: 'Sales and stock reports',
      advancedReports: 'Profit and loss and detailed reports',
      emailInvoices: 'Email invoices to customers',
      analytics: 'Advanced analytics',
      support: 'Priority support',
    },
    faqTitle: 'Pricing questions',
    faq: [
      {
        q: 'What happens after the 14-day trial?',
        a: 'Nothing is charged automatically. When the trial ends you can pick a paid plan or carry on with Free.',
      },
      {
        q: 'Can I switch plans later?',
        a: 'Yes. Move up or down from the Subscription page whenever you like.',
      },
      {
        q: 'Do you charge per counter or per device?',
        a: 'No. Plans are priced per business. Team members sign in on any device.',
      },
      {
        q: 'How do I pay?',
        a: 'bKash, Nagad, card or bank transfer. Yearly billing gives you two months free.',
      },
    ],
  },
  about: {
    title: 'Why we built HisabKhata',
    story: [
      'Walk into almost any shop in Bangladesh and you will find a khata: a bound notebook where the owner writes down who bought what, who still owes money, and what needs to be ordered. It works, until the shop grows, a second person starts working the counter, or the notebook goes missing.',
      'Most software built for shops was designed somewhere else. Prices in dollars, no idea what bKash is, invoices that do not show the taka sign, and no way to track baki the way shopkeepers actually do it.',
      'HisabKhata keeps the idea of the khata and makes it reliable. Each sale updates stock, payments and dues in one step. Each change is recorded with who made it and why. Owners see their real profit; cashiers see only what they need.',
      'We build for grocery stores, pharmacies, electronics shops, wholesalers and distributors, and we start from how they already work.',
    ],
    valuesTitle: 'What we hold ourselves to',
    values: [
      {
        title: 'Start from the shop',
        body: 'We design around how shops here already work: baki, bKash, Bangla names and a busy counter.',
      },
      {
        title: 'Numbers you can trust',
        body: 'Every figure comes from a recorded sale, purchase or payment, and every change has a name next to it.',
      },
      {
        title: 'Fair, simple prices',
        body: 'Prices in taka, a real free plan, and no contract to get out of.',
      },
    ],
    madeTitle: 'Made in Sylhet, Bangladesh',
    madeBody:
      'HisabKhata is designed and built in Sylhet, by people who buy from these shops every day.',
    founderRole: 'Founder',
    founderPlaceholder: 'Founder photo and name coming soon',
  },
  contact: {
    title: 'Talk to us',
    intro:
      'Questions about plans, moving from another system, or setting up a barcode scanner? Send a message and we will reply by email within one working day.',
    hours: 'Hours',
    hoursValue: 'Saturday to Thursday, 10am to 7pm (Dhaka time)',
    whatsapp: 'Chat on WhatsApp',
    phone: 'Phone',
    email: 'Email',
    name: 'Your name',
    yourEmail: 'Email',
    message: 'Message',
    messageHint: 'Tell us a little about your shop and what you need.',
    send: 'Send message',
    sentTitle: 'Message sent',
    sentBody: 'Thanks, your message is in. We will reply to the email address you gave us.',
    sendAnother: 'Send another message',
  },
  auth: {
    login: {
      title: 'Sign in',
      description: 'Welcome back. Sign in to open your khata.',
      email: 'Email',
      password: 'Password',
      forgot: 'Forgot password?',
      submit: 'Sign in',
      newHere: 'New to HisabKhata?',
      create: 'Create a free account',
    },
    register: {
      title: 'Create your account',
      description:
        'Set up your business in under a minute. Every new account starts with a 14-day Basic trial.',
      descriptionPlan: 'Start with a 14-day Basic trial. No card needed.',
      name: 'Your name',
      email: 'Email',
      password: 'Password',
      passwordHint: 'At least 8 characters with letters and numbers.',
      confirm: 'Confirm password',
      business: 'Business name',
      businessPlaceholder: 'e.g. Rahman General Store',
      businessType: 'Business type',
      mobile: 'Mobile (optional)',
      submit: 'Create account',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
    },
    businessTypes: {
      RETAIL: 'Retail',
      GROCERY: 'Grocery',
      PHARMACY: 'Pharmacy',
      ELECTRONICS: 'Electronics',
      WHOLESALE: 'Wholesale',
      DISTRIBUTOR: 'Distributor',
      OTHER: 'Other',
    } as Record<string, string>,
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  validation: {
    required: 'This field is required',
    email: 'Enter a valid email address',
    min: (n: number) => `Enter at least ${n} characters`,
    max: (n: number) => `Use ${n} characters or fewer`,
    mismatch: 'Passwords do not match',
    // Custom messages from the shared schemas, translated by exact text in bn.ts.
    known: {} as Record<string, string>,
  },
};

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? Widen<U>[]
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

export type Dictionary = Widen<typeof en>;
