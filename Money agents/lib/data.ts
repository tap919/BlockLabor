export type StrategyBadge = 'zero' | 'low' | 'medium';

export interface StrategyMetric {
  label: string;
  value: string;
}

export interface StrategyDetails {
  title: string;
  content: string;
}

export interface StrategyImplementation {
  title: string;
  steps: string[];
}

export interface Strategy {
  id: string;
  title: string;
  badge: { text: string; type: StrategyBadge };
  description: string;
  metrics: StrategyMetric[];
  details: StrategyDetails;
  implementation: StrategyImplementation;
}

export const strategies: Strategy[] = [
  {
    id: 'ai-arbitrage',
    title: 'AI Agent Arbitrage',
    badge: { text: '$0 Start', type: 'zero' },
    description: 'Use white-label AI backends ($29/agent) and resell as custom solutions ($200-300/mo). Build chatbots, automation agents, and assistants with OpenClaw multi-agent system.',
    metrics: [
      { label: 'Setup Time', value: '10 min' },
      { label: 'Revenue/Client', value: '$200-300/mo' },
      { label: 'Margin', value: '85%' },
    ],
    details: {
      title: 'AI Agent Arbitrage',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            The AI Agent Arbitrage model is the fastest path to revenue. You leverage existing white-label AI platforms 
            (like Kuga, OpenClaw) that cost $29/month per agent and resell them as custom solutions at $200-300/month.
        </p>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Revenue Model</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>Cost:</strong> $29/agent (white-label backend)</li>
            <li><strong>Sell for:</strong> $200-300/month per client</li>
            <li><strong>Setup time:</strong> 10 minutes per agent</li>
            <li><strong>Margin:</strong> 85-90%</li>
            <li><strong>Target:</strong> Small businesses, local shops, service providers</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Agent Types to Sell</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>Customer Service Bots:</strong> Restaurants, retail, healthcare</li>
            <li><strong>Lead Qualification:</strong> Real estate, insurance, B2B</li>
            <li><strong>Appointment Scheduling:</strong> Salons, consultants, medical</li>
            <li><strong>FAQ Automation:</strong> SaaS, e-commerce, services</li>
            <li><strong>Social Media Response:</strong> Brands, influencers, agencies</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Client Acquisition</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Cold outreach on LinkedIn (50 messages/day)</li>
            <li>Local business networking events</li>
            <li>Free audit offer: "Let me show you how AI can save you 20 hours/week"</li>
            <li>Create demo videos showing ROI calculations</li>
            <li>Partner with web designers and marketing agencies</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">First Month Goal</h4>
        <p class="text-neutral-400">
            5 clients × $250/month = $1,250 MRR<br>
            Cost: 5 × $29 = $145<br>
            <strong class="text-emerald-500">Net Profit: $1,105/month</strong>
        </p>
      `,
    },
    implementation: {
      title: 'AI Agent Arbitrage Implementation',
      steps: [
        'Set up OpenClaw multi-agent system on Cloudflare Workers',
        'Create 3 demo agents: customer service, lead qualification, appointment booking',
        'Build landing page showcasing ROI calculator and case studies',
        'Create outreach list: 100 local businesses on Google Maps',
        'Send 50 cold emails/day offering free audit + demo',
        'Schedule 5 demo calls per week, close 2 clients',
        'Set up white-label backend ($29/agent) for each client',
        'Create onboarding checklist and deliver in 48 hours',
        'Collect testimonials and case studies',
        'Scale to 10 clients in Month 1 = $2.5K MRR',
      ],
    },
  },
  {
    id: 'content-arbitrage',
    title: 'Content Arbitrage',
    badge: { text: '$0 Start', type: 'zero' },
    description: 'Repurpose existing content from one platform and monetize on another. Use AI to transform Reddit threads into Twitter threads, YouTube videos into blog posts, etc.',
    metrics: [
      { label: 'Setup Time', value: '30 min' },
      { label: 'Revenue/Month', value: '$500-2K' },
      { label: 'Automation', value: '95%' },
    ],
    details: {
      title: 'Content Arbitrage',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Content arbitrage involves taking content from one platform where it has low value and republishing it 
            on another where it can be monetized at higher rates. Use AI to transform and optimize content automatically.
        </p>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Core Workflow</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>Source:</strong> Reddit threads, Quora answers, YouTube transcripts</li>
            <li><strong>Transform:</strong> Use AI to rewrite as Twitter threads, blog posts, LinkedIn articles</li>
            <li><strong>Monetize:</strong> Display ads, affiliate links, sponsored content</li>
            <li><strong>Automate:</strong> Make.com workflows + AI = 95% automated</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">High-Value Transformations</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Reddit → Twitter threads (finance, tech, productivity)</li>
            <li>YouTube → Blog posts with SEO optimization</li>
            <li>Podcast → LinkedIn articles + newsletter</li>
            <li>Industry reports → Twitter threads + infographics</li>
            <li>Academic papers → Plain English explainers</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Monetization Strategies</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>Ad Revenue:</strong> Google AdSense, Mediavine ($500-2K/month at 50K views)</li>
            <li><strong>Affiliate Links:</strong> Amazon Associates, product recommendations</li>
            <li><strong>Sponsored Content:</strong> Brands pay $100-500 per post</li>
            <li><strong>Newsletter:</strong> Beehiiv with premium tier ($10-20/subscriber)</li>
            <li><strong>Course Sales:</strong> Bundle content into courses</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Automation Setup</h4>
        <p class="mb-2 text-neutral-400">
            <strong>Tools needed (all free tiers available):</strong>
        </p>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Make.com for workflow automation</li>
            <li>Claude/GPT API for content transformation</li>
            <li>Buffer for social scheduling</li>
            <li>WordPress for blog hosting</li>
        </ul>
      `,
    },
    implementation: {
      title: 'Content Arbitrage Implementation',
      steps: [
        'Choose niche (tech, finance, health, productivity)',
        'Set up Make.com workflow to scrape Reddit top posts',
        'Connect Claude API to transform posts into Twitter threads',
        'Create WordPress blog with AdSense enabled',
        'Set up Buffer for automated social scheduling',
        'Build initial content bank: 30 posts, 60 threads',
        'Post 3x/day on Twitter, 1x/day on blog',
        'Join affiliate programs relevant to niche',
        'Grow to 10K Twitter followers and 50K blog views/month',
        'Monetize: ads + affiliates = $500-2K/month',
      ],
    },
  },
  {
    id: 'micro-saas',
    title: 'Micro-SaaS Builder',
    badge: { text: '$0 Start', type: 'zero' },
    description: 'Build and launch niche SaaS products in 48 hours using no-code tools. Target underserved markets with specific pain points.',
    metrics: [
      { label: 'Build Time', value: '48 hrs' },
      { label: 'Revenue Range', value: '$5K-50K MRR' },
      { label: 'Scalability', value: 'High' },
    ],
    details: {
      title: 'Micro-SaaS Builder',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Micro-SaaS products are small, focused software solutions that solve specific problems for niche markets. 
            Build in 48 hours using no-code tools, validate quickly, and scale to $5K-50K MRR.
        </p>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Validated Ideas for 2026</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>AI Content Repurposer:</strong> One blog post → 10 social posts</li>
            <li><strong>Niche Job Board:</strong> AI engineers, blockchain devs, biotech</li>
            <li><strong>Customer Interview Tool:</strong> Automated insights from calls</li>
            <li><strong>Meeting Summarizer:</strong> Zoom/Meet → Action items</li>
            <li><strong>Social Media Analytics:</strong> Track competitors automatically</li>
            <li><strong>Price Monitor:</strong> Track competitor pricing for e-commerce</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">48-Hour Launch Framework</h4>
        <p class="mb-2 text-neutral-400"><strong>Day 1 (Friday):</strong></p>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Choose validated idea (check Reddit, Indie Hackers for pain points)</li>
            <li>Build landing page (Carrd, Webflow)</li>
            <li>Set up payment (Stripe)</li>
            <li>Start building core feature (Bubble, NxCode)</li>
        </ul>
        
        <p class="mb-2 text-neutral-400"><strong>Day 2 (Saturday):</strong></p>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Complete core functionality</li>
            <li>Add authentication (Auth0, Clerk)</li>
            <li>Create demo video</li>
            <li>Write launch story</li>
        </ul>
        
        <p class="mb-2 text-neutral-400"><strong>Day 3 (Sunday):</strong></p>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li>Launch on Twitter, Product Hunt, Indie Hackers</li>
            <li>Send to 50 potential customers personally</li>
            <li>Offer founding member pricing (50% off forever)</li>
            <li>Collect feedback and iterate</li>
        </ul>
        
        <h4 class="text-emerald-500 font-semibold mt-6 mb-2">Revenue Expectations</h4>
        <ul class="mb-4 text-neutral-400 list-disc pl-5 space-y-2">
            <li><strong>Month 1:</strong> 5-10 customers at $20-50/month = $100-500 MRR</li>
            <li><strong>Month 3:</strong> 25-50 customers = $500-2.5K MRR</li>
            <li><strong>Month 6:</strong> 100-200 customers = $2K-10K MRR</li>
            <li><strong>Month 12:</strong> 300-500 customers = $6K-25K MRR</li>
        </ul>
      `,
    },
    implementation: {
      title: 'Micro-SaaS Implementation',
      steps: [
        'Research pain points on Reddit r/SaaS, r/Entrepreneur',
        'Validate idea: send survey to 100 potential users',
        'Choose no-code stack: Bubble/NxCode + Stripe + Clerk',
        'Build MVP in 48 hours following framework above',
        'Create demo video (Loom) showing key features',
        'Write launch story with personal angle',
        'Launch on Product Hunt, Indie Hackers, Twitter',
        'Reach out to 50 potential customers with personalized message',
        'Offer founding member pricing: $20/month (50% off)',
        'Collect feedback daily and ship updates weekly',
      ],
    },
  },
  {
    id: 'gig-automation',
    title: 'Gig Automation Platform',
    badge: { text: '$50-200', type: 'low' },
    description: 'Build AI tools that automate Fiverr/Upwork gigs. Offer 10x faster delivery by automating the work pipeline with agents.',
    metrics: [
      { label: 'Setup Time', value: '2-3 days' },
      { label: 'Revenue/Month', value: '$2K-8K' },
      { label: 'Efficiency Gain', value: '10x' },
    ],
    details: {
      title: 'Gig Automation Platform',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Automate high-demand freelance services using AI agents. Deliver work faster and cheaper than human competitors while maintaining high margins.
        </p>
      `,
    },
    implementation: {
      title: 'Gig Automation Implementation',
      steps: [
        'Identify high-volume, repetitive gigs on Fiverr/Upwork',
        'Build AI agent pipeline to automate the core task',
        'Create optimized gig listings with fast delivery times',
        'Fulfill orders using the automated pipeline',
        'Collect 5-star reviews to rank higher',
      ],
    },
  },
  {
    id: 'social-mgmt',
    title: 'Social Media Management',
    badge: { text: '$0 Start', type: 'zero' },
    description: 'Offer AI-powered social media management. Use agents to create content, schedule posts, respond to comments, and analyze performance.',
    metrics: [
      { label: 'Setup Time', value: '1 day' },
      { label: 'Revenue/Client', value: '$500-1.5K/mo' },
      { label: 'Client Capacity', value: '20-50' },
    ],
    details: {
      title: 'Social Media Management',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Manage social media for multiple clients simultaneously using AI agents to handle content creation, scheduling, and engagement.
        </p>
      `,
    },
    implementation: {
      title: 'Social Media Management Implementation',
      steps: [
        'Set up AI content generation pipelines for different platforms',
        'Configure scheduling tools (Buffer, Hootsuite) via API',
        'Create engagement agents to respond to comments/DMs',
        'Pitch local businesses on full-service social management',
        'Onboard clients and automate their social presence',
      ],
    },
  },
  {
    id: 'agent-marketplace',
    title: 'AI Agent Marketplace',
    badge: { text: '$100-500', type: 'low' },
    description: 'Create and sell specialized AI agents on marketplaces. Build vertical-specific agents (real estate, e-commerce, healthcare) and list them.',
    metrics: [
      { label: 'Build Time', value: '3-5 days' },
      { label: 'Price/Agent', value: '$50-500' },
      { label: 'Market Size', value: '$52B by 2030' },
    ],
    details: {
      title: 'AI Agent Marketplace',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Develop specialized AI agents tailored for specific industries and sell them as ready-to-use solutions on emerging AI marketplaces.
        </p>
      `,
    },
    implementation: {
      title: 'Agent Marketplace Implementation',
      steps: [
        'Identify underserved niches needing AI automation',
        'Develop specialized agents using OpenClaw/CrewAI',
        'Package agents with clear documentation and use cases',
        'List agents on AI marketplaces (e.g., Flowise, LangChain hubs)',
        'Market agents to specific industry groups',
      ],
    },
  },
  {
    id: 'print-on-demand',
    title: 'Print-On-Demand',
    badge: { text: '$0 Start', type: 'zero' },
    description: 'Use AI to design products (t-shirts, mugs, phone cases) and sell via Printful/Printify. Zero inventory, automated fulfillment.',
    metrics: [
      { label: 'Setup Time', value: '4-6 hrs' },
      { label: 'Profit/Item', value: '$5-15' },
      { label: 'Scalability', value: 'Unlimited' },
    ],
    details: {
      title: 'Print-On-Demand',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Leverage AI image generation to create unique designs for merchandise. Automate the store and fulfillment process using Print-on-Demand services.
        </p>
      `,
    },
    implementation: {
      title: 'Print-On-Demand Implementation',
      steps: [
        'Generate niche design concepts using Midjourney/DALL-E',
        'Set up a Shopify or Etsy store',
        'Integrate Printify/Printful for automated fulfillment',
        'Create AI-generated product descriptions and mockups',
        'Drive traffic via organic social media (TikTok/Reels)',
      ],
    },
  },
  {
    id: 'freelance-marketplace',
    title: 'Freelance Marketplace',
    badge: { text: '$500-1K', type: 'medium' },
    description: 'Launch white-label freelance marketplace with AI-powered matching, automation, and tools. Focus on niche industries.',
    metrics: [
      { label: 'Launch Time', value: '1-2 weeks' },
      { label: 'Commission', value: '10-20%' },
      { label: 'Network Effect', value: 'High' },
    ],
    details: {
      title: 'Freelance Marketplace',
      content: `
        <h3 class="text-emerald-500 font-semibold mb-4 text-lg">Strategy Overview</h3>
        <p class="mb-4 text-neutral-400">
            Create a specialized freelance platform connecting clients with AI-augmented freelancers, taking a commission on transactions.
        </p>
      `,
    },
    implementation: {
      title: 'Freelance Marketplace Implementation',
      steps: [
        'Select a specific niche (e.g., AI video editors, prompt engineers)',
        'Set up a white-label marketplace platform (e.g., Sharetribe)',
        'Recruit initial supply (freelancers) via targeted outreach',
        'Attract demand (clients) through content marketing',
        'Implement AI matching to connect clients with the best freelancers',
      ],
    },
  },
];

export const tools = [
  { name: 'n8n', purpose: 'Execution Hub & Automation Backbone' },
  { name: 'HubSpot', purpose: 'CRM & Sales Pipeline' },
  { name: 'Stripe', purpose: 'Payment Processing & Invoicing' },
  { name: 'Gmail', purpose: 'Outreach & Communication' },
  { name: 'Google Calendar', purpose: 'Scheduling & Lead Qualification' },
  { name: 'Airtable', purpose: 'Data Store & Operations Table' },
  { name: 'Slack', purpose: 'Internal Alerts & Approvals' },
  { name: 'MCP', purpose: 'Standardized Agent Tool Interface' },
];

export const lifecycleSteps = [
  { step: 1, title: 'Goal Intake', icon: 'Target', description: 'Define revenue targets, boundaries, capital, risk tolerance, and approved channels.' },
  { step: 2, title: 'Opportunity Mapping', icon: 'Globe', description: 'Scout agent builds ranked backlog by profit, speed to cash, complexity, and risk.' },
  { step: 3, title: 'Plan Generation', icon: 'Brain', description: 'Orchestrator creates multi-step execution plan, selects tools, and routes to specialists.' },
  { step: 4, title: 'Human Approval', icon: 'ShieldCheck', description: 'Review and approve offers, pricing, outreach, and money movement actions.' },
  { step: 5, title: 'Execution', icon: 'Zap', description: 'Automated outreach, proposal drafting, and fulfillment run within policy.' },
  { step: 6, title: 'Measurement', icon: 'LineChart', description: 'Daily reporting on leads, meetings, revenue, and ROI by channel/agent.' },
  { step: 7, title: 'Learning Loop', icon: 'History', description: 'Memory updates based on conversion data, failures, and scaling opportunities.' }
];
