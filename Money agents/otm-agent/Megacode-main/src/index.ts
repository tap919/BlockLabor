/**
 * OverCoat - The open-source AI coding assistant with multi-LLM support.
 *
 * This module exports the core components for building multi-LLM
 * coding assistants with deep VSCode integration.
 */

// LLM Provider System
export {
  LLMProvider,
  LLMProviderConfig,
  LLMMessage,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
} from "./llm/provider";

export { LLMRouter, RouterConfig, RoutingStrategy } from "./llm/router";

export {
  loadOvercoatSpec,
  buildProviderConfigs,
  OvercoatConfig,
  OvercoatProject,
  OvercoatStack,
} from "./llm/config";

// LLM Providers
export { OllamaProvider } from "./llm/providers/ollama";
export { DeepSeekProvider } from "./llm/providers/deepseek";
export { GeminiProvider } from "./llm/providers/gemini";
export { OpenAICompatibleProvider } from "./llm/providers/openai";

// VSCode Integration
export {
  VSCodeBridge,
  VSCodeBridgeConfig,
  BridgeMessage,
  BridgeMessageType,
  DiagnosticItem,
  EditorDidChangePayload,
  WorkspaceSymbol,
} from "./vscode/bridge";

export {
  OvercoatExtension,
  OvercoatExtensionConfig,
  createOvercoatExtension,
} from "./vscode/extension";

// IDE Bridges (Zed, Cursor, JetBrains/PyCharm)
export {
  ZedBridge,
  ZedBridgeConfig,
  CursorBridge,
  CursorBridgeConfig,
  JetBrainsBridge,
  JetBrainsBridgeConfig,
  JetBrainsCompletionRequest,
  JetBrainsCompletionResponse,
  IDEType,
  IDEBridgeOptions,
  createIDEBridge,
} from "./ide/index";

// Marathon Session Management
export {
  MarathonSession,
  MarathonSessionConfig,
  SessionCheckpoint,
  SessionStats,
  BreakReminderHandler,
  CheckpointHandler,
} from "./session/marathon";

// Completion Cache (speeds up repeated requests, addresses Claude Code / OpenCode weakness)
export {
  CompletionCache,
  CompletionCacheConfig,
  CacheStats,
  cacheKeyFor,
} from "./cache/completion-cache";

// Context Compressor (smart token-budget trimming, addresses Kilo Code / OpenCode weakness)
export {
  ContextCompressor,
  CompressorConfig,
  CompressionResult,
  estimateTokens,
  estimateMessagesTokens,
} from "./context/compressor";

// Code Quality Scorer (accuracy feedback on completions, addresses gap in Claude Code, OpenCode, and Kilo Code)
export {
  CodeQualityScorer,
  scoreCode,
  detectLanguage,
  QualityReport,
  QualityIssue,
  IssueSeverity,
  DetectedLanguage,
} from "./quality/scorer";

// AI & Intelligence Layer
export {
  ContextAssistant,
  ContextAssistantConfig,
  ProjectContext,
  FileEntry,
  CommandEntry,
  CodingPattern,
  Suggestion,
  CommandTranslation,
  CommandFix,
  // Code Review Automation (super upgrade)
  CodeReviewAutomation,
  CodeReviewConfig,
  CodeReviewResult,
  ReviewFinding,
  ReviewSeverity,
  ReviewRule,
  DiffHunk,
} from "./intelligence/context-assistant";

// Predictive & Adaptive Features
export {
  PatternEngine,
  PatternEngineConfig,
  UsagePattern,
  CommandPrediction,
  ResourceSnapshot,
  OptimizationHint,
  ErrorPrediction,
} from "./predictive/pattern-engine";

// Cross-Platform Intelligence
export {
  UniversalPackageManager,
  EnvironmentParityChecker,
  CrossPlatformCompat,
  PackageManagerType,
  PackageOperation,
  PackageResult,
  EnvironmentSnapshot,
  EnvironmentDiff,
} from "./crossplatform/universal-pm";

// Developer Experience
export {
  DataExplorer,
  CommandTimeline,
  SmartCompleter,
  Breakpoint,
  DebugVariable,
  DebugState,
  DataFormat,
  FormattedData,
  TimelineStep,
  CompletionItem,
} from "./devexp/developer-tools";

// Analytics & Monitoring
export {
  ResourceDashboard,
  CostEstimator,
  PerformanceBenchmarker,
  DependencyGraphBuilder,
  ResourceMetrics,
  ProviderPricing,
  CostEstimate,
  BenchmarkResult,
  BenchmarkSummary,
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
} from "./analytics/monitor";

// Security & Compliance
export {
  SecretDetector,
  PermissionAuditor,
  ComplianceChecker,
  SecretFinding,
  PermissionRequirement,
  PermissionAudit,
  ComplianceRule,
  ComplianceResult,
  // Encrypted Session Sharing (super upgrade)
  EncryptedSessionSharing,
  SessionShareConfig,
  EncryptedShare,
  SessionData,
} from "./security/compliance";

// Gamification & Productivity
export {
  AchievementTracker,
  ProductivityAnalyzer,
  MacroManager,
  ContextSwitcher,
  Achievement,
  AchievementCriteria,
  ProductivityInsight,
  CommandMacro,
  ProjectContextState,
} from "./gamification/productivity";

// Integration Ecosystem
export {
  WebhookManager,
  APIRegistry,
  BrowserBridge,
  WebhookConfig,
  WebhookDelivery,
  APIEndpoint,
  BrowserCommand,
  // Plugin Marketplace (super upgrade)
  PluginMarketplace,
  Plugin,
  PluginCategory,
  InstalledPlugin,
  PluginSearchFilters,
  PluginSearchResult,
} from "./integrations/ecosystem";

// UI/UX Innovations
export {
  SemanticColorizer,
  ProgressRenderer,
  OutputFormatter,
  HistoryTimeline,
  ANSI,
  CommandIntent,
  SemanticTheme,
  ProgressState,
  ProgressStyle,
  TimelineEntry,
} from "./ui/interface";

// Automation & Orchestration
export {
  WorkflowEngine,
  TaskScheduler,
  EventEngine,
  ServerInventory,
  Workflow,
  WorkflowStep,
  StepResult,
  WorkflowResult,
  ScheduledTask,
  EventTrigger,
  ServerNode,
  RemoteCommandResult,
} from "./automation/orchestration";

// Knowledge Management
export {
  DocGenerator,
  LearningMode,
  SnippetLibrary,
  ContextualHelpProvider,
  DocEntry,
  DocExample,
  DocOption,
  CommandExplanation,
  Snippet,
  ContextualHelpItem,
} from "./knowledge/knowledge-base";

// Testing & Reliability
export {
  DryRunner,
  CommandTestRunner,
  RollbackManager,
  SnapshotManager,
  PredictedEffect,
  DryRunResult,
  CommandAssertion,
  CommandTestCase,
  TestResult,
  RollbackOperation,
  OperationBackup,
  StateSnapshot,
  SnapshotDiff,
} from "./testing/reliability";

// Accessibility & Inclusivity
export {
  I18nManager,
  ScreenReaderAdapter,
  CognitiveAssistant,
  Locale,
  Message,
  VoiceConfig,
  ScreenReaderConfig,
  ComplexityLevel,
  SimplifiedCommand,
  Announcement,
  // Voice Control (super upgrade)
  VoiceController,
  VoiceCommand,
  VoiceIntent,
  VoiceState,
  VoiceFeedback,
} from "./accessibility/a11y";

// Remote & Distributed
export {
  HostManager,
  TunnelManager,
  OfflineQueue,
  DistributedCommandRunner,
  EdgeComputeManager,
  RemoteHost,
  HostResult,
  DistributedResult,
  TunnelConfig,
  EdgeDeployment,
  QueuedOperation,
  HostResultCallback,
  HostExecutor,
  DeployHandler,
} from "./distributed/remote";

// Project-Specific Intelligence
export {
  FrameworkDetector,
  BestPracticeEnforcer,
  TechDebtTracker,
  DetectedFramework,
  BestPractice,
  MigrationPlan,
  MigrationStep,
  TechDebtItem,
  TechDebtSummary,
  // Migration Assistant (super upgrade)
  MigrationAssistant,
  MigrationAssistantConfig,
  MigrationResult,
  PackageInfo,
  BreakingChange,
} from "./project/intelligence";

// Multi-Step Build System (day-spanning, compartmentalised enterprise builds)
export {
  MultiStepBuild,
  MultiStepBuildConfig,
  BuildPhase,
  PhaseStatus,
  BuildSummary,
} from "./build/multi-step";

// Disk Memory Bank (1 GiB persistent context store for long-running projects)
export {
  DiskMemoryBank,
  DiskMemoryBankConfig,
  MemoryEntry,
  DiskBankStats,
  ONE_GIB,
} from "./memory/disk-bank";

// Metrics & Improvement
export {
  TeamAnalytics,
  SkillTracker,
  RegressionDetector,
  LeakDetector,
  UserMetrics,
  TeamMetrics,
  SkillRecommendation,
  RegressionAlert,
  ResourceLeak,
  PerformanceDataPoint,
} from "./metrics/improvement";

// Vibe Coding Reliability Layer (15 features for users without deep dev knowledge)
export {
  PlainEnglishErrorExplainer,
  IntentValidator,
  ConfidenceIndicator,
  SafeMode,
  OneClickFixEngine,
  PlainLanguageGlossary,
  DependencyAdvisor,
  StepByStepWizard,
  UndoStack,
  SmartScaffolder,
  FriendlyProgressNarrator,
  CodeIntentLogger,
  RookieModeToggle,
  VisualDiffFormatter,
  AutoExplainMode,
  // Types
  ErrorExplanation,
  IntentValidationResult,
  ConfidenceLevel,
  ConfidenceAssessment,
  RiskLevel,
  SafeModeResult,
  CodeFix,
  GlossaryEntry,
  PackageSafetyRating,
  DependencyAdvice,
  WizardStep,
  WizardPlan,
  EditRecord,
  UndoRedoResult,
  ScaffoldFile,
  ScaffoldResult,
  ProgressNarration,
  IntentLoggerOptions,
  AnnotatedCode,
  VerbosityLevel,
  RookieModeConfig,
  RookieModePrompt,
  DiffLine,
  VisualDiff,
  AutoExplainOptions,
  ExplainedResponse,
} from "./vibe/vibe-coding";
