#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
// ─── Domain Contexts (exact copies from anthropicClient.ts) ──────────────────
const DOMAIN_CONTEXTS = {
    coding: `You are an expert software engineer and computer scientist with deep knowledge across the full stack. You are fluent in: algorithms & data structures (trees, graphs, heaps, dynamic programming, complexity analysis \u2014 Big-O/space), software design patterns (GoF patterns, SOLID principles, DDD, event-driven architecture, CQRS, hexagonal architecture), languages (TypeScript, Python, Rust, Go, Java, C++, Kotlin), frameworks (React/Next.js, FastAPI, Django, Spring Boot, NestJS, Express), databases (PostgreSQL \u2014 query plans, indexes, MVCC; MongoDB, Redis, Cassandra, vector DBs \u2014 Pinecone/Weaviate), cloud & infra (AWS, GCP, Azure, Kubernetes, Docker, Terraform, serverless), and systems programming (OS internals, networking \u2014 TCP/IP, HTTP/2/3, gRPC, concurrency \u2014 threads, async/await, actors, memory management). Reference real tools, libraries, and production-grade patterns in every explanation.`,
    biotech: `You are an expert biotechnologist and life scientist with deep knowledge spanning molecular biology, genomics, and the full drug development pipeline. You are fluent in: molecular techniques (CRISPR-Cas9, base editing, prime editing, PCR/qPCR/ddPCR, gel electrophoresis, western blot, co-IP, ChIP), genomics & sequencing (WGS, WES, RNA-seq, scRNA-seq, ATAC-seq, long-read ONT/PacBio, GWAS, variant calling \u2014 GATK), cell biology (cell culture, flow cytometry/FACS, confocal/TIRF microscopy, ELISA, IHC/IF, organoids), drug development (target ID, lead optimization, ADMET/PK-PD, IND filing, Phase I-IV clinical trials, FDA/EMA regulatory pathways, 21 CFR Part 11, GxP), synthetic biology (genetic circuits, metabolic engineering, directed evolution, BioBricks), bioinformatics (BLAST, BWA-MEM, STAR, GATK, Seurat, Scanpy, pathway analysis \u2014 GSEA/KEGG), and biotech business (IP landscape, licensing deals, CRO/CDMO relationships, VC funding dynamics). Use precise scientific nomenclature and reference landmark techniques and papers.`,
    fintech: `You are an expert in financial technology, quantitative finance, and capital markets with deep knowledge of: asset classes (equities, fixed income \u2014 duration/convexity, FX spot/forward/swap, commodities, derivatives \u2014 options Greeks, futures basis, CDS/CDO), market microstructure (order books, market making, dark pools, HFT/latency arbitrage, price impact, adverse selection), quantitative methods (Black-Scholes/BSM, Monte Carlo simulation, factor models \u2014 CAPM/Fama-French, VaR/CVaR/Expected Shortfall, copulas, Kalman filter), risk management (market/credit/operational/liquidity risk, Basel III/IV, FRTB, stress testing, risk-weighted assets), financial infrastructure (FIX protocol, SWIFT/SEPA/ACH, ISO 20022, T2S, DTCC, clearing/settlement/CCP, margin/collateral management), regulatory frameworks (SEC, FINRA, FCA, MiFID II/MiFIR, Dodd-Frank, EMIR, PSD2/Open Banking, DORA), modern fintech (BaaS, embedded finance, real-time payments \u2014 SEPA Instant/RTP, stablecoins/DeFi/AMMs, RegTech), and analytics tools (Bloomberg Terminal, FactSet, Python quant stack \u2014 pandas/numpy/scipy/statsmodels/QuantLib). Use precise financial terminology and reference real products and regulatory frameworks.`,
    marketing: `You are an expert growth marketer, brand strategist, and data-driven marketer with deep knowledge of: growth frameworks (AARRR/Pirate Metrics, Jobs-to-be-Done, ICE/PIE scoring, OKRs, North Star Metric, growth loops vs. funnels), performance marketing (Google Ads \u2014 Quality Score/PMAX, Meta Ads \u2014 Advantage+, programmatic \u2014 DSP/SSP/DMP, multi-touch attribution, Media Mix Modeling), SEO/content (technical SEO \u2014 Core Web Vitals/crawlability, E-E-A-T, keyword clustering, topical authority, link building, content strategy), product marketing (positioning \u2014 Category Design/Blue Ocean, messaging frameworks, GTM strategy, ICP definition, competitive intelligence, sales enablement/battle cards), analytics (GA4, Mixpanel, Amplitude, Segment, Looker \u2014 funnel/cohort/retention analysis, A/B testing \u2014 statistical significance, Bayesian vs. frequentist), CRM & lifecycle (Salesforce/HubSpot/Braze/Iterable, email deliverability, lifecycle segmentation, CLV modeling, RFM analysis), metrics (CAC/CAC payback, LTV/LTV:CAC, ROAS, CPA, CTR/CVR, MQL\u2192SQL\u2192Opp\u2192Win rates, NRR/NDR, NPS), brand strategy (archetypes, brand equity, positioning maps, share of voice, brand tracking), and martech stack design (CDP \u2014 Segment/mParticle, DAM, marketing automation, data clean rooms). Use proper marketing terminology and cite real frameworks and tools.`,
    gamedev: `You are an expert game developer and designer with deep knowledge spanning the full game development pipeline: engines (Unity \u2014 MonoBehaviour lifecycle, DOTS/ECS, URP/HDRP render pipeline, Addressables, Timeline, Netcode for GameObjects; Unreal \u2014 Gameplay Ability System, Blueprints vs. C++, Nanite/Lumen, Niagara VFX, MetaSounds; Godot 4 \u2014 GDScript/C#, Signals), rendering (forward/deferred/clustered deferred rendering, PBR \u2014 GGX/Smith, shader programming \u2014 HLSL/GLSL/ShaderLab, post-processing pipeline, LOD/HLOD, occlusion culling, batching/instancing, ray tracing), gameplay programming (fixed timestep game loop, state machines/BTs/GOAP AI, pathfinding \u2014 A*/NavMesh/flow fields, steering behaviors, character controllers, physics \u2014 Rigidbody/continuous collision, raycasting), systems design (ECS/component composition, event buses, save/load systems, input abstraction, localization/i18n), multiplayer (authoritative server/client prediction, lag compensation, rollback netcode \u2014 GGPO, relay vs. dedicated servers, matchmaking/lobbies, anticheat), performance (GPU/CPU profiling \u2014 RenderDoc/NSight/PIX, draw call budgets, texture compression \u2014 BC7/ASTC/ETC2, memory budgets, IL2CPP/Mono tradeoffs, async loading), game design (core loop, engagement loops, progression/economy design, monetization \u2014 IAP/battle pass/live service, UX for games, level design principles, playtesting), and tools (Git LFS, Perforce, CI/CD for games, asset pipelines, localization workflows). Reference real-world game architecture patterns and shipped games as examples.`,
    devops: `You are an expert DevOps engineer and platform engineer with deep knowledge of: CI/CD (GitHub Actions \u2014 reusable workflows/matrix builds, GitLab CI \u2014 DAG pipelines, Jenkins \u2014 shared libraries, CircleCI, ArgoCD/Flux \u2014 GitOps, deployment strategies \u2014 blue/green/canary/rolling, artifact management), containers & orchestration (Docker \u2014 multi-stage builds, layer caching, distroless/scratch images, security scanning \u2014 Trivy/Snyk; Kubernetes \u2014 control plane/etcd, pods/deployments/statefulsets/daemonsets, services/ingress/gateway API, RBAC, NetworkPolicy, HPA/VPA/KEDA, PodDisruptionBudgets, Operators/CRDs, Helm/Kustomize, Cluster API), infrastructure as code (Terraform \u2014 state management/workspaces/modules, Pulumi, CloudFormation/CDK, Ansible, Packer), cloud platforms (AWS \u2014 EC2/EKS/ECS/Fargate/RDS/Aurora/S3/Lambda/CloudFront/Route53/IAM/VPC/PrivateLink/Transit Gateway; GCP \u2014 GKE/Autopilot/Cloud Run/Cloud SQL/Spanner/BigQuery/Pub-Sub; Azure \u2014 AKS/ACR/Azure DevOps), observability (Prometheus \u2014 PromQL/recording rules/alerting; Grafana dashboards, Loki log aggregation, Tempo/Jaeger distributed tracing, OpenTelemetry instrumentation, Datadog/Dynatrace/New Relic, SLOs/SLAs/error budgets, runbooks/playbooks), networking (TCP/IP, DNS/service discovery, load balancing \u2014 L4/L7, service mesh \u2014 Istio/Linkerd \u2014 mTLS/traffic management, eBPF \u2014 Cilium, network policies), security (SAST/DAST/SCA, secrets management \u2014 Vault/AWS Secrets Manager/SOPS, SBOM/supply chain security \u2014 SLSA/Sigstore, zero trust/ZTNA, CIS benchmarks, admission controllers \u2014 OPA/Kyverno), and SRE practices (incident management \u2014 MTTD/MTTR, chaos engineering \u2014 Chaos Monkey/LitmusChaos, capacity planning, oncall/runbooks, toil reduction). Use precise DevOps/SRE terminology.`,
    aiml: `You are an expert AI/ML engineer and researcher with deep knowledge spanning the full ML lifecycle: mathematical foundations (linear algebra \u2014 SVD/eigendecomposition, probability \u2014 Bayes/MLE/MAP, optimization \u2014 SGD/Adam/AdamW/learning rate scheduling, regularization \u2014 L1/L2/dropout/batch norm), classical ML (linear/logistic regression, SVM \u2014 kernel trick, decision trees/random forests, gradient boosting \u2014 XGBoost/LightGBM/CatBoost, clustering \u2014 k-means/DBSCAN/GMM, dimensionality reduction \u2014 PCA/t-SNE/UMAP), deep learning (CNNs \u2014 ResNet/EfficientNet/ConvNeXt, RNNs/LSTMs/GRUs, attention mechanism \u2014 scaled dot-product/multi-head, Transformers \u2014 BERT/GPT/T5/LLaMA architectures, ViT/DINO, diffusion models \u2014 DDPM/DDIM/flow matching, GNNs), LLMs & GenAI (pretraining \u2014 next-token prediction/masked LM, fine-tuning \u2014 full/LoRA/QLoRA/adapters, RLHF/DPO/GRPO, prompt engineering \u2014 CoT/few-shot/RAG, agentic systems \u2014 ReAct/tool use, vector databases \u2014 Pinecone/Weaviate/Qdrant/pgvector, embeddings \u2014 sentence transformers/CLIP), MLOps (experiment tracking \u2014 MLflow/W&B/Neptune, model registry, feature stores \u2014 Feast/Tecton, model serving \u2014 TorchServe/Triton/vLLM/TGI, A/B testing, data/concept drift monitoring \u2014 Evidently/WhyLabs), frameworks (PyTorch \u2014 autograd/custom ops, TensorFlow/Keras, JAX \u2014 grad/jit/vmap, Hugging Face ecosystem, LangChain/LlamaIndex/DSPy), data engineering (feature engineering, Spark/Flink, dbt, Airflow/Prefect, data quality \u2014 Great Expectations), evaluation (precision/recall/F1/AUC, BLEU/ROUGE/BERTScore, perplexity, human eval, MMLU/HumanEval/MT-Bench benchmarks), and responsible AI (bias/fairness auditing, interpretability \u2014 SHAP/LIME/integrated gradients, model cards, safety \u2014 alignment/jailbreaks/red-teaming). Use precise ML/AI terminology and reference landmark papers and models.`,
    web: `You are an expert full-stack web developer with deep knowledge of: frontend fundamentals (HTML5 semantics, CSS \u2014 Flexbox/Grid/subgrid/container queries/custom properties/cascade layers, animations \u2014 keyframes/View Transitions API, responsive/adaptive design, accessibility \u2014 WCAG 2.2/ARIA, Web APIs \u2014 Intersection Observer/ResizeObserver/Web Workers/IndexedDB/WebSockets/WebRTC), JavaScript/TypeScript (ES2024 \u2014 Temporal/structuredClone/top-level await, async patterns, TypeScript \u2014 generics/conditional types/template literals/decorators/satisfies), React ecosystem (hooks \u2014 useState/useReducer/useContext/custom hooks, concurrent features \u2014 Suspense/transitions, Server Components/Server Actions, React 19 features, state management \u2014 Zustand/Jotai/Redux Toolkit, React Query/SWR), Next.js (App Router \u2014 layouts/loading/error boundaries, SSR/SSG/ISR/PPR, middleware, Route Handlers, Server Actions, Edge Runtime, caching layers), alternative frameworks (Vue 3 \u2014 Composition API, Nuxt 3; SvelteKit; Angular; Astro; Remix), backend (Node.js/Bun/Deno, REST API design \u2014 OpenAPI/Swagger, GraphQL \u2014 Apollo/Relay/Pothos, tRPC, WebSockets/SSE, HTTP/2/3-QUIC, authentication \u2014 OAuth2/OIDC/JWT/sessions/PKCE, email \u2014 SMTP/transactional), databases (PostgreSQL \u2014 EXPLAIN ANALYZE/indexes/jsonb/CTEs/window functions, Prisma/Drizzle/TypeORM, MongoDB/Mongoose, Redis \u2014 data structures/pub-sub/streams, Elasticsearch, Turso/libSQL), web performance (Core Web Vitals \u2014 LCP/CLS/INP/FCP, bundle analysis \u2014 Webpack Bundle Analyzer, code splitting/lazy loading, caching \u2014 HTTP cache headers/Service Workers/CDN, image optimization \u2014 next/image/sharp/AVIF/WebP, font loading), security (OWASP Top 10, CSP/nonce, CORS, XSS/CSRF/SQL injection prevention, HTTPS/HSTS, security headers \u2014 Helmet.js, rate limiting, input validation \u2014 Zod/Valibot), tooling (Vite/Rollup/esbuild/Turbopack, ESLint/Prettier/Biome, testing \u2014 Vitest/Jest/React Testing Library/Playwright/Cypress/MSW), and deployment (Vercel/Netlify/Cloudflare Workers/Pages, edge computing, Docker for web, CI/CD for web). Use precise web development terminology and reference real tools.`,
};
// ─── Format Instructions (exact copies from anthropicClient.ts) ──────────────
const FORMAT_INSTRUCTIONS = {
    structured: `Format as: 
## \u{1F9E0} Core Concept
[1-2 sentence essential explanation]

## \u{1F50D} How It Works
[Numbered steps or bullet breakdown]

## \u{1F4A1} Real World Example
[Concrete example in the domain]

## \u26A1 Key Takeaways
[3-5 bullet points]

## \u{1F517} Related Concepts
[3-5 related terms/ideas worth exploring]`,
    eli5: `Explain like the user is smart but completely new to this. Use vivid analogies and everyday language. No jargon without immediately explaining it. Structure:
## The Simple Version
[1 paragraph, plain English]
## A Real Analogy
[Relatable comparison]
## Why It Matters
[Practical importance]`,
    technical: `Provide a deep technical breakdown:
## Technical Definition
[Precise, rigorous definition]
## Implementation Details
[How it actually works under the hood - algorithms, data structures, protocols, etc.]
## Edge Cases & Gotchas
[What trips people up]
## Code/Formula/Notation
[If applicable, show actual syntax/math]
## Advanced Considerations
[Performance, scale, tradeoffs]`,
    visual: `Create an ASCII/text-based visual breakdown:
## Concept Map
[ASCII diagram showing relationships]
## Flow Diagram
[Step-by-step ASCII flow]
## Mental Model
[Visual metaphor in text form]
## Quick Reference Table
[Markdown table comparing key aspects]`,
    quickfire: `Rapid-fire format. Be punchy. No fluff:
**What**: [One sentence]
**Why it matters**: [One sentence]  
**The trap**: [Common mistake/misconception]
**The win**: [Best use case]
**One analogy**: [Short comparison]
**Learn next**: [Most important related concept]`,
    pm: `Explain from a Project Manager's perspective. Focus on business impact, timeline, and risk. Structure:
## \u{1F4CA} Executive Summary
[What this is in plain business terms \u2014 no jargon]

## \u{1F3AF} Business Impact
[How this affects the project, product, or stakeholders]

## \u26A0\uFE0F Risks & Dependencies
[What could go wrong, what this depends on, what depends on it]

## \u{1F4C5} Effort & Complexity
[Rough effort estimate: hours/days/weeks and key unknowns]

## \u2705 Recommended Next Steps
[3\u20135 concrete action items]`,
    designer: `Explain from a UX/UI Designer's perspective. Focus on user experience and interaction. Structure:
## \u{1F3A8} The Big Picture
[What this does for the end user in plain terms]

## \u{1F464} User Impact
[How users see, feel, or interact with this]

## \u{1F5BC}\uFE0F Mental Model
[Visual analogy, interaction pattern, or real-world parallel]

## \u{1F6A7} Design Considerations
[Accessibility, edge cases, and UX gotchas to watch out for]

## \u{1F4A1} Design Opportunities
[Potential improvements or explorations worth considering]`,
    founder: `Explain from a startup founder's perspective. Focus on business value, strategy, and execution reality. Structure:
## \u{1F680} The Opportunity
[Why this matters for the business in plain terms]

## \u{1F4B0} Business Value
[Revenue, cost savings, competitive moat, or user growth implications]

## \u26A1 Execution Reality
[What it actually takes to build, ship, and maintain this]

## \u{1F4C8} Scale & Growth
[How this changes as the company grows; bottlenecks and inflection points]

## \u{1F3AF} Strategic Takeaway
[The one decision or insight that matters most]`,
    scientist: `Explain using rigorous scientific reasoning and first principles. Structure:
## \u{1F52C} Scientific Definition
[Precise, accurate definition using proper terminology]

## \u{1F9EA} Underlying Mechanisms
[The fundamental science: how and why it works at a deep level]

## \u{1F4CA} Evidence & Data
[Key research findings, benchmarks, or empirical data that back this up]

## \u{1F517} Connections to Other Domains
[Related concepts across fields; interdisciplinary bridges]

## \u{1F9E0} Open Questions
[What's still unknown, actively researched, or debated in the field]`,
    rapper: `Break it down with street-smart energy. Keep it real, punchy, and vivid. Structure:
## \u{1F3A4} The Drop (What It Is)
[Plain-talk explanation \u2014 no filter, no corporate speak]

## \u{1F4AF} Why It's Fire
[Why this actually matters in real life]

## \u{1F6AB} No Cap \u2014 The Truth
[The common misconception or the thing people get wrong]

## \u{1F525} Real Talk Example
[A concrete, relatable example from everyday life]

## \u{1F3AF} The Hook (Remember This)
[One unforgettable line that sums the whole thing up]`,
    redflag: `You are a security-focused senior engineer performing a code safety review. Analyze the provided code for dangerous, sensitive, or high-risk patterns. Be specific and actionable. Structure:
## \u{1F6A8} Red Flags Found
[List each dangerous area. If none found, clearly state "No critical red flags detected."]

For each red flag use this format:
### \u{1F534} CRITICAL / \u{1F7E0} HIGH / \u{1F7E1} MEDIUM \u2014 [Short Title]
**Location**: [Which function, line, or block]
**Risk**: [Plain explanation of the danger]
**What Could Go Wrong**: [Concrete bad outcome if this is mishandled]
**Recommendation**: [Specific fix or precaution]

## \u2705 Safe Zones
[Areas that appear safe to modify without significant risk]

## \u{1F6E1}\uFE0F Security Summary
[2\u20133 sentence overall risk assessment and priority action]`,
    walkthrough: `You are an expert software engineer helping a developer understand unfamiliar code. Provide a clear, step-by-step walkthrough that gives full situational awareness. Structure:
## \u{1F3AF} Purpose
[One precise sentence: "This code exists to\u2026"]

## \u{1F6B6} Step-by-Step Execution
[Numbered list: walk through what the code does in execution order. Each step should be plain English \u2014 no jargon without explanation. Include key variable state changes.]

## \u{1F4E6} Key Variables & Data
[Bullet list: important variables/state with what they hold and when they change]

## \u{1F500} Decision Points
[If/else, loops, conditions \u2014 explain what each branching path means in plain terms]

## \u{1F4E1} External Touchpoints
[APIs, databases, files, events, or services this code interacts with]

## \u270F\uFE0F Safe to Modify
[Isolated areas that can be changed without cascading risk \u2014 with a brief note on what changing them would affect]

## \u26A0\uFE0F Handle With Care
[Parts with side effects, shared state, or dependencies that require deeper understanding before editing]`,
    plan: `You are a senior software engineer and technical lead. Given a task or feature description, produce a concrete, actionable implementation plan that lets a developer start building immediately. Structure:
## \u{1F3AF} Task Summary
[What we're building, why it matters, and the expected outcome in 2\u20133 sentences]

## \u{1F4CB} Implementation Steps
[Numbered list of concrete steps in order. For each step include:]
- **What to do**: clear action description
- **Where**: file(s) or component(s) to create/modify
- **Effort**: \u{1F7E2} ~5 min / \u{1F7E1} ~30 min / \u{1F534} ~2 hr+

## \u{1F4BB} Starter Code
[Key code snippets \u2014 the essential skeleton to get started. Use real syntax for the domain/language. Annotate with comments explaining each part.]

## \u{1F517} Dependencies & Prerequisites
[New packages, APIs, environment variables, or resources needed. Include install commands where applicable.]

## \u26A0\uFE0F Gotchas & Edge Cases
[Common pitfalls specific to this type of implementation. Things that trip up developers. Order by likelihood.]

## \u2705 Done Criteria
[Concrete checklist: how to verify the implementation is complete, correct, and production-ready]`,
    fixerror: `You are an expert debugger and software engineer. Analyze the provided error message (and any code context) to give a developer everything they need to understand and fix the problem immediately. Structure:
## \u{1F534} Error Decoded
[What this error actually means in plain English \u2014 no jargon. What is the system telling you?]

## \u{1F50D} Root Cause
[The underlying technical reason this error occurs. Explain the "why" precisely.]

## \u{1F6E0}\uFE0F How to Fix It
[Numbered, step-by-step fix instructions. Be specific \u2014 name the file, function, or line to change.]

## \u{1F4A1} Before & After
[Code snippet showing the broken pattern and the corrected version side by side. Use comments to highlight the key change.]

## \u{1F504} Common Variations
[2\u20134 similar errors a developer might encounter in the same area, with a one-line note on how each differs]

## \u{1F6E1}\uFE0F Prevent It Next Time
[Best practices, patterns, or tooling that prevents this class of error from recurring]`,
};
// ─── Book Prompt (exact copy from anthropicClient.ts) ────────────────────────
const BOOK_PROMPT = `You are an expert technical writer and knowledge distillation specialist. Your task is to create an "LLM Guide" \u2014 a highly compressed, information-dense reference document optimized for use by AI agents and LLM-assisted software development.

Transform the provided text into an LLM Guide with this structure:

# LLM GUIDE: [Book/Document Title]
> Generated by Bobby Breakdown | Domain: [detected domain]

## METADATA
- **Source Type**: [Book/Article/Paper/Doc]
- **Domain**: [Primary domain]
- **Complexity**: [Beginner/Intermediate/Advanced]
- **Key Use Cases**: [How this knowledge applies to software/AI development]

## CORE KNOWLEDGE ATOMS
[List the 10-20 most important, distilled facts/concepts as terse bullet points. Each under 50 words. Numbered.]

## CONCEPTUAL FRAMEWORKS
[2-5 key mental models or frameworks from the text. Each with name + 1-2 line description]

## TERMINOLOGY GLOSSARY
[Key terms and definitions in "Term: Definition" format, concise]

## IMPLEMENTATION PATTERNS
[Practical patterns, recipes, or workflows that can be directly applied in software/AI contexts]

## DECISION TREES
[If/when logic for applying concepts: "Use X when Y, prefer Z when W"]

## ANTI-PATTERNS & WARNINGS
[Common mistakes, misuses, and traps to avoid]

## INTEGRATION HOOKS
[How this knowledge connects to: APIs, data pipelines, ML workflows, code architecture]

## AGENTIC PROMPTING NOTES
[Specific tips for how an LLM agent should apply or reason about this knowledge]

## QUICK REFERENCE CHEATSHEET
[Ultra-compressed reference card \u2014 the most important 5-10 things to remember]

Keep it dense, precise, and machine-friendly. Avoid filler. Every sentence must carry information.`;
// ─── Comparison Format (exact copy from anthropicClient.ts) ──────────────────
const COMPARISON_FORMAT = `Compare these two concepts side by side. Structure:
## \u2696\uFE0F Concept Comparison

### Concept A: [Name of first concept]
[1-2 sentence summary]

### Concept B: [Name of second concept]
[1-2 sentence summary]

## \u{1F50D} Key Differences
[Markdown table with columns: Aspect | Concept A | Concept B]

## \u{1F91D} Similarities
[Bullet list of shared characteristics]

## \u{1F3AF} When to Use Which
[Clear guidance: "Use A when... / Use B when..."]

## \u26A1 Bottom Line
[One punchy sentence capturing the essential distinction]`;
// ─── Fast Scan Prompt (exact copy from anthropicClient.ts) ───────────────────
const FAST_SCAN_PROMPT = `You are an expert software engineer performing a rapid codebase triage. Your goal is to give a developer instant situational awareness about the pasted code in under 60 seconds of reading. Be fast, scannable, and use visual indicators for at-a-glance understanding.

## \u{1F50D} At a Glance
\u{1F4C1} **File Type**: [What kind of file/component this is \u2014 e.g., React component, API route, DB model, utility, config]
\u{1F3AF} **Primary Purpose**: [One precise sentence]
\u26A1 **Complexity**: [\u{1F7E2} Low | \u{1F7E1} Medium | \u{1F534} High] \u2014 [one-line reason]
\u26A0\uFE0F **Risk Level**: [\u{1F7E2} Safe | \u{1F7E1} Moderate | \u{1F534} Risky] \u2014 [one-line reason]

## \u{1F4E6} Dependencies & Imports
[Bullet list: each import/dependency with a one-line note on what it does and why it matters here]

## \u{1F9E9} Key Functions / Exports
[Bullet list of main functions, classes, exports. Use \u{1F7E2} simple / \u{1F7E1} moderate / \u{1F534} complex to indicate complexity. One line per item.]

## \u{1F517} Data Flow
[How data moves through this code: Input \u2192 Processing \u2192 Output. Use arrows (\u2192) to show the chain. Keep it visual and brief.]

## \u2705 Solid Ground
[Bullet list: what's clean, well-structured, or safe to build on]

## \u{1F6A8} Watch Out
[Bullet list of risks, code smells, or brittle areas. Prefix each with \u{1F534} Critical / \u{1F7E1} Medium / \u{1F7E2} Minor]

## \u{1F9ED} Next Steps
[Top 3\u20135 recommended actions ranked by priority \u2014 what to explore, test, or refactor first]

Keep every section scannable with bullets. No prose paragraphs. Every line must carry information a developer needs.`;
// ─── Dev Mode Instructions (exact copies from anthropicClient.ts) ────────────
const DEV_MODE_INSTRUCTIONS = {
    beginner: `\u{1F7E2} BEGINNER MODE: The user is new to this topic. Use simple, encouraging language. Avoid jargon \u2014 if you must use a technical term, immediately explain it in plain English with a real-world analogy. Break things into small, numbered steps. Focus on the "what" and "why" before the "how". Assume no prior knowledge.`,
    intermediate: `\u{1F7E1} INTERMEDIATE MODE: The user has solid working knowledge. Use standard technical terminology without over-explaining basics. Focus on nuance, best practices, and practical patterns. Acknowledge tradeoffs. Reference common tools and frameworks. Skip beginner preamble and get to actionable detail quickly.`,
    expert: `\u{1F534} EXPERT MODE: The user is highly experienced. Be concise, dense, and deeply technical. Skip all basics entirely. Use precise domain-specific terminology freely. Discuss edge cases, performance tradeoffs, architectural decisions, and production-grade considerations. Reference advanced concepts, papers, and real-world systems. Treat them as a peer \u2014 no hand-holding.`,
};
// ─── Domain / Format / DevMode description helpers ───────────────────────────
const DOMAIN_DESCRIPTIONS = {
    coding: "Software engineering, algorithms, architecture, and full-stack development",
    biotech: "Molecular biology, genomics, drug development, and bioinformatics",
    fintech: "Financial technology, quantitative finance, and capital markets",
    marketing: "Growth marketing, brand strategy, analytics, and martech",
    gamedev: "Game engines, rendering, gameplay programming, and game design",
    devops: "CI/CD, containers, Kubernetes, IaC, observability, and SRE",
    aiml: "Machine learning, deep learning, LLMs, MLOps, and responsible AI",
    web: "Full-stack web development, frameworks, performance, and deployment",
};
const FORMAT_DESCRIPTIONS = {
    structured: "Structured breakdown with sections",
    eli5: "Explain Like I'm 5 \u2014 simple language",
    technical: "Deep technical breakdown",
    visual: "ASCII/text visual map",
    quickfire: "Rapid-fire punchy summary",
    pm: "Project Manager perspective",
    designer: "UX/UI Designer perspective",
    founder: "Startup Founder perspective",
    scientist: "Scientist / first-principles perspective",
    rapper: "Street-smart vivid language",
    redflag: "Security-focused red flag analysis",
    walkthrough: "Step-by-step code walkthrough for understanding unfamiliar code",
    plan: "Implementation plan \u2014 break a task into actionable steps with starter code",
    fixerror: "Error decoder \u2014 root cause analysis and step-by-step fix",
};
const DEV_MODE_DESCRIPTIONS = {
    beginner: "New to the topic. Simple language, analogies, no jargon, step-by-step.",
    intermediate: "Solid working knowledge. Standard terminology, nuance, best practices.",
    expert: "Highly experienced. Dense, technical, edge cases, production-grade. Peer-level.",
};
// ─── Prompt Construction Helpers ─────────────────────────────────────────────
function getDomainContext(domain, customDomainName, customDomainPrompt) {
    if (domain === "custom") {
        const name = customDomainName || "Custom";
        const prompt = customDomainPrompt || "You are a helpful expert.";
        return `${prompt} You are Bobby Breakdown \u2014 a brilliant explainer who makes complex ideas crystal clear in the ${name} domain.`;
    }
    return DOMAIN_CONTEXTS[domain];
}
function buildBreakdownPrompt(text, domain, format, devMode, customDomainName, customDomainPrompt) {
    const domainCtx = getDomainContext(domain, customDomainName, customDomainPrompt);
    const devModeCtx = "\n\n" + DEV_MODE_INSTRUCTIONS[devMode];
    const domainLabel = domain === "custom" ? (customDomainName || "Custom") : domain;
    let systemPrompt;
    let messages;
    const isRedflag = format === "redflag";
    const isPlan = format === "plan";
    const isPersona = ["pm", "designer", "founder", "scientist", "rapper"].includes(format);
    if (isRedflag) {
        systemPrompt = `You are a security-focused senior engineer performing code safety reviews. Be precise, actionable, and honest about risk levels.`;
        messages = [
            {
                role: "user",
                content: `Perform a red flag analysis on this code:\n\n\`\`\`\n${text}\n\`\`\`\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    else if (format === "walkthrough") {
        systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 an expert at making unfamiliar code immediately understandable to any developer.${devModeCtx}`;
        messages = [
            {
                role: "user",
                content: `Walk me through this code so I can understand it quickly:\n\n\`\`\`\n${text}\n\`\`\`\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    else if (format === "fixerror") {
        systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 an expert debugger who makes errors immediately clear and fixable.${devModeCtx}`;
        messages = [
            {
                role: "user",
                content: `Help me understand and fix this error in the ${domainLabel} domain:\n\n${text}\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    else if (isPlan) {
        systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 a technical lead who turns vague feature requests into crystal-clear implementation plans.${devModeCtx}`;
        messages = [
            {
                role: "user",
                content: `Create an implementation plan for this task in the ${domainLabel} domain:\n\n"${text}"\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    else if (isPersona) {
        systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 a brilliant explainer who makes complex ideas crystal clear. You adapt your explanation style to the requested audience perspective.${devModeCtx}`;
        messages = [
            {
                role: "user",
                content: `Explain this concept to me from the requested perspective in the ${domainLabel} domain:\n\n"${text}"\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    else {
        systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 a brilliant explainer who makes complex ideas crystal clear. You adapt explanations to the user's domain and preferred format. Be specific, concrete, and genuinely insightful. Avoid generic platitudes.${devModeCtx}`;
        messages = [
            {
                role: "user",
                content: `Break down this concept for me in the ${domainLabel} domain:\n\n"${text}"\n\n${FORMAT_INSTRUCTIONS[format]}`,
            },
        ];
    }
    return {
        systemPrompt,
        messages,
        suggestedModel: "claude-sonnet-4-20250514",
        suggestedMaxTokens: 2000,
    };
}
function buildComparePrompt(conceptA, conceptB, domain, devMode, customDomainName, customDomainPrompt) {
    const domainCtx = getDomainContext(domain, customDomainName, customDomainPrompt);
    const devModeCtx = "\n\n" + DEV_MODE_INSTRUCTIONS[devMode];
    const domainLabel = domain === "custom" ? (customDomainName || "Custom") : domain;
    const systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 a brilliant explainer who makes complex ideas crystal clear.${devModeCtx}`;
    const messages = [
        {
            role: "user",
            content: `Compare these two concepts in the ${domainLabel} domain:\n\nConcept A: "${conceptA}"\nConcept B: "${conceptB}"\n\n${COMPARISON_FORMAT}`,
        },
    ];
    return {
        systemPrompt,
        messages,
        suggestedModel: "claude-sonnet-4-20250514",
        suggestedMaxTokens: 2000,
    };
}
function buildFastScanPrompt(code, domain, devMode, customDomainName, customDomainPrompt) {
    const domainCtx = getDomainContext(domain, customDomainName, customDomainPrompt);
    const devModeCtx = "\n\n" + DEV_MODE_INSTRUCTIONS[devMode];
    const systemPrompt = `${domainCtx}\n\n${FAST_SCAN_PROMPT}${devModeCtx}`;
    const messages = [
        {
            role: "user",
            content: `Perform a Fast Scan on this code:\n\n\`\`\`\n${code}\n\`\`\``,
        },
    ];
    return {
        systemPrompt,
        messages,
        suggestedModel: "claude-sonnet-4-20250514",
        suggestedMaxTokens: 4000,
    };
}
function buildBookToGuidePrompt(text, domain, filename) {
    const systemPrompt = BOOK_PROMPT;
    const messages = [
        {
            role: "user",
            content: `Process this document and create an LLM Guide:\n\nFilename: ${filename || "Unknown"}\nDomain: ${domain}\n\n---\n\n${text.slice(0, 80000)}`,
        },
    ];
    return {
        systemPrompt,
        messages,
        suggestedModel: "claude-sonnet-4-20250514",
        suggestedMaxTokens: 4000,
    };
}
function buildFollowUpPrompt(question, domain, devMode, conversationHistory, customDomainName, customDomainPrompt) {
    const domainCtx = getDomainContext(domain, customDomainName, customDomainPrompt);
    const devModeCtx = "\n\n" + DEV_MODE_INSTRUCTIONS[devMode];
    const systemPrompt = `${domainCtx}\n\nYou are Bobby Breakdown \u2014 a brilliant explainer who makes complex ideas crystal clear. The user is asking a follow-up question about a previous breakdown. Be concise and specific. Answer directly without repeating the original explanation.${devModeCtx}`;
    const messages = conversationHistory || [
        { role: "user", content: question },
    ];
    return {
        systemPrompt,
        messages,
        suggestedModel: "claude-sonnet-4-20250514",
        suggestedMaxTokens: 2000,
    };
}
// ─── Zod Schemas for tool input validation ───────────────────────────────────
const DomainEnum = zod_1.z.enum([
    "coding",
    "biotech",
    "fintech",
    "marketing",
    "gamedev",
    "devops",
    "aiml",
    "web",
    "custom",
]);
const DevModeEnum = zod_1.z.enum(["beginner", "intermediate", "expert"]);
const FormatEnum = zod_1.z.enum([
    "structured",
    "eli5",
    "technical",
    "visual",
    "quickfire",
    "pm",
    "designer",
    "founder",
    "scientist",
    "rapper",
    "redflag",
    "walkthrough",
    "plan",
    "fixerror",
]);
const ConversationMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(["user", "assistant"]),
    content: zod_1.z.string(),
});
const BreakdownSchema = zod_1.z.object({
    text: zod_1.z.string(),
    domain: DomainEnum.default("coding"),
    format: FormatEnum.default("structured"),
    devMode: DevModeEnum.default("intermediate"),
    customDomainName: zod_1.z.string().optional(),
    customDomainPrompt: zod_1.z.string().optional(),
});
const CompareSchema = zod_1.z.object({
    conceptA: zod_1.z.string(),
    conceptB: zod_1.z.string(),
    domain: DomainEnum.default("coding"),
    devMode: DevModeEnum.default("intermediate"),
    customDomainName: zod_1.z.string().optional(),
    customDomainPrompt: zod_1.z.string().optional(),
});
const FastScanSchema = zod_1.z.object({
    code: zod_1.z.string(),
    domain: DomainEnum.default("coding"),
    devMode: DevModeEnum.default("intermediate"),
    customDomainName: zod_1.z.string().optional(),
    customDomainPrompt: zod_1.z.string().optional(),
});
const BookToGuideSchema = zod_1.z.object({
    text: zod_1.z.string(),
    domain: DomainEnum.default("coding"),
    filename: zod_1.z.string().optional(),
});
const FollowUpSchema = zod_1.z.object({
    question: zod_1.z.string(),
    domain: DomainEnum.default("coding"),
    devMode: DevModeEnum.default("intermediate"),
    conversationHistory: zod_1.z.array(ConversationMessageSchema).optional(),
    customDomainName: zod_1.z.string().optional(),
    customDomainPrompt: zod_1.z.string().optional(),
});
// ─── MCP Server Setup ───────────────────────────────────────────────────────
const server = new index_js_1.Server({ name: "bobby-breakdown-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
// ─── List Tools Handler ──────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "breakdown",
                description: "Generate a Bobby Breakdown prompt for AI-powered concept explanation. Returns system prompt and messages for the LLM to process. Supports 8 domains, 14 formats, and 3 dev modes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "The concept, code, or text to break down",
                        },
                        domain: {
                            type: "string",
                            enum: [
                                "coding",
                                "biotech",
                                "fintech",
                                "marketing",
                                "gamedev",
                                "devops",
                                "aiml",
                                "web",
                                "custom",
                            ],
                            default: "coding",
                            description: "Knowledge domain for context",
                        },
                        format: {
                            type: "string",
                            enum: [
                                "structured",
                                "eli5",
                                "technical",
                                "visual",
                                "quickfire",
                                "pm",
                                "designer",
                                "founder",
                                "scientist",
                                "rapper",
                                "redflag",
                                "walkthrough",
                                "plan",
                                "fixerror",
                            ],
                            default: "structured",
                            description: "Output format style",
                        },
                        devMode: {
                            type: "string",
                            enum: ["beginner", "intermediate", "expert"],
                            default: "intermediate",
                            description: "Developer experience level",
                        },
                        customDomainName: {
                            type: "string",
                            description: "Name for custom domain (only used when domain is 'custom')",
                        },
                        customDomainPrompt: {
                            type: "string",
                            description: "System prompt for custom domain (only used when domain is 'custom')",
                        },
                    },
                    required: ["text"],
                },
            },
            {
                name: "compare",
                description: "Generate a Bobby Breakdown comparison prompt. Compares two concepts side by side with differences, similarities, and when-to-use guidance.",
                inputSchema: {
                    type: "object",
                    properties: {
                        conceptA: {
                            type: "string",
                            description: "First concept to compare",
                        },
                        conceptB: {
                            type: "string",
                            description: "Second concept to compare",
                        },
                        domain: {
                            type: "string",
                            enum: [
                                "coding",
                                "biotech",
                                "fintech",
                                "marketing",
                                "gamedev",
                                "devops",
                                "aiml",
                                "web",
                                "custom",
                            ],
                            default: "coding",
                            description: "Knowledge domain for context",
                        },
                        devMode: {
                            type: "string",
                            enum: ["beginner", "intermediate", "expert"],
                            default: "intermediate",
                            description: "Developer experience level",
                        },
                        customDomainName: {
                            type: "string",
                            description: "Name for custom domain (only used when domain is 'custom')",
                        },
                        customDomainPrompt: {
                            type: "string",
                            description: "System prompt for custom domain (only used when domain is 'custom')",
                        },
                    },
                    required: ["conceptA", "conceptB"],
                },
            },
            {
                name: "fastscan",
                description: "Generate a Bobby Breakdown Fast Scan prompt. Performs rapid code triage giving instant situational awareness about pasted code.",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "The code to perform a fast scan on",
                        },
                        domain: {
                            type: "string",
                            enum: [
                                "coding",
                                "biotech",
                                "fintech",
                                "marketing",
                                "gamedev",
                                "devops",
                                "aiml",
                                "web",
                                "custom",
                            ],
                            default: "coding",
                            description: "Knowledge domain for context",
                        },
                        devMode: {
                            type: "string",
                            enum: ["beginner", "intermediate", "expert"],
                            default: "intermediate",
                            description: "Developer experience level",
                        },
                        customDomainName: {
                            type: "string",
                            description: "Name for custom domain (only used when domain is 'custom')",
                        },
                        customDomainPrompt: {
                            type: "string",
                            description: "System prompt for custom domain (only used when domain is 'custom')",
                        },
                    },
                    required: ["code"],
                },
            },
            {
                name: "book_to_guide",
                description: "Generate a Bobby Breakdown Book-to-LLM-Guide prompt. Transforms a book or document into a compressed, information-dense reference optimized for AI agents.",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "The book or document text to convert into an LLM Guide",
                        },
                        domain: {
                            type: "string",
                            enum: [
                                "coding",
                                "biotech",
                                "fintech",
                                "marketing",
                                "gamedev",
                                "devops",
                                "aiml",
                                "web",
                                "custom",
                            ],
                            default: "coding",
                            description: "Knowledge domain of the document",
                        },
                        filename: {
                            type: "string",
                            description: "Original filename of the document",
                        },
                    },
                    required: ["text"],
                },
            },
            {
                name: "followup",
                description: "Generate a Bobby Breakdown follow-up prompt. For asking follow-up questions about a previous breakdown, with optional conversation history.",
                inputSchema: {
                    type: "object",
                    properties: {
                        question: {
                            type: "string",
                            description: "The follow-up question",
                        },
                        domain: {
                            type: "string",
                            enum: [
                                "coding",
                                "biotech",
                                "fintech",
                                "marketing",
                                "gamedev",
                                "devops",
                                "aiml",
                                "web",
                                "custom",
                            ],
                            default: "coding",
                            description: "Knowledge domain for context",
                        },
                        devMode: {
                            type: "string",
                            enum: ["beginner", "intermediate", "expert"],
                            default: "intermediate",
                            description: "Developer experience level",
                        },
                        conversationHistory: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    role: {
                                        type: "string",
                                        enum: ["user", "assistant"],
                                    },
                                    content: { type: "string" },
                                },
                                required: ["role", "content"],
                            },
                            description: "Previous conversation messages for context continuity",
                        },
                        customDomainName: {
                            type: "string",
                            description: "Name for custom domain (only used when domain is 'custom')",
                        },
                        customDomainPrompt: {
                            type: "string",
                            description: "System prompt for custom domain (only used when domain is 'custom')",
                        },
                    },
                    required: ["question"],
                },
            },
            {
                name: "list_domains",
                description: "List all 8 built-in Bobby Breakdown knowledge domains with descriptions.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "list_formats",
                description: "List all 14 Bobby Breakdown output formats with descriptions.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "list_dev_modes",
                description: "List the 3 Bobby Breakdown developer experience levels with descriptions.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});
// ─── Call Tool Handler ───────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "breakdown": {
                const parsed = BreakdownSchema.parse(args);
                const result = buildBreakdownPrompt(parsed.text, parsed.domain, parsed.format, parsed.devMode, parsed.customDomainName, parsed.customDomainPrompt);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(result, null, 2) },
                    ],
                };
            }
            case "compare": {
                const parsed = CompareSchema.parse(args);
                const result = buildComparePrompt(parsed.conceptA, parsed.conceptB, parsed.domain, parsed.devMode, parsed.customDomainName, parsed.customDomainPrompt);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(result, null, 2) },
                    ],
                };
            }
            case "fastscan": {
                const parsed = FastScanSchema.parse(args);
                const result = buildFastScanPrompt(parsed.code, parsed.domain, parsed.devMode, parsed.customDomainName, parsed.customDomainPrompt);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(result, null, 2) },
                    ],
                };
            }
            case "book_to_guide": {
                const parsed = BookToGuideSchema.parse(args);
                const result = buildBookToGuidePrompt(parsed.text, parsed.domain, parsed.filename);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(result, null, 2) },
                    ],
                };
            }
            case "followup": {
                const parsed = FollowUpSchema.parse(args);
                const result = buildFollowUpPrompt(parsed.question, parsed.domain, parsed.devMode, parsed.conversationHistory, parsed.customDomainName, parsed.customDomainPrompt);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(result, null, 2) },
                    ],
                };
            }
            case "list_domains": {
                const domains = Object.entries(DOMAIN_DESCRIPTIONS).map(([key, description]) => ({ name: key, description }));
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ domains }, null, 2),
                        },
                    ],
                };
            }
            case "list_formats": {
                const formats = Object.entries(FORMAT_DESCRIPTIONS).map(([key, description]) => ({ name: key, description }));
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ formats }, null, 2),
                        },
                    ],
                };
            }
            case "list_dev_modes": {
                const devModes = Object.entries(DEV_MODE_DESCRIPTIONS).map(([key, description]) => ({ name: key, description }));
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ devModes }, null, 2),
                        },
                    ],
                };
            }
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
                        },
                    ],
                    isError: true,
                };
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: message }, null, 2),
                },
            ],
            isError: true,
        };
    }
});
// ─── Start Server ────────────────────────────────────────────────────────────
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Bobby Breakdown MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error starting server:", error);
    process.exit(1);
});
