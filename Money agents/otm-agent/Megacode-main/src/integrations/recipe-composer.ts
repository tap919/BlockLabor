/**
 * Recipe Composer for Megacode (OverCoat). (#42)
 *
 * Lets users combine multiple short Recipes into a larger, named composite
 * Recipe — similar to how shell pipelines chain commands. The composer:
 *
 * - Validates that all constituent recipes exist in the registry.
 * - Merges `requiredMCPs` lists (deduped).
 * - Serialises the combined call list in execution order.
 * - Optionally inserts a thin "glue" transform step between each pair of
 *   recipes so output from one can feed input to the next.
 * - Exports the final composite as a standard Recipe that works with the
 *   existing tool-recipes and MCP flow coordinator.
 */

import type { Recipe, RecipeCategory } from "./tool-recipes";
import type { ToolCall, FlowStep } from "./mcp-flow-coordinator";

// ============================================================================
// Types
// ============================================================================

/**
 * A declarative description of one recipe slot in a composition.
 */
export interface RecipeSlot {
  /** ID of an existing recipe to include. */
  recipeId: string;
  /**
   * Optional static argument overrides merged on top of each call's args.
   * Useful to customise a generic recipe for a specific context.
   */
  argOverrides?: Record<string, unknown>;
}

/** Options for the final composed recipe. */
export interface CompositionOptions {
  id: string;
  name: string;
  description: string;
  category?: RecipeCategory;
  /** If true, inserts a no-op transform FlowStep as a "barrier" between each recipe's calls. */
  insertBarriers?: boolean;
}

/** The result of a composition — includes both the merged Recipe and FlowSteps. */
export interface CompositionResult {
  recipe: Recipe;
  flowSteps: FlowStep[];
}

// ============================================================================
// RecipeComposer
// ============================================================================

/**
 * Composes multiple recipes into a single executable recipe or flow plan.
 *
 * @example
 * ```ts
 * const composer = new RecipeComposer(allRecipes);
 * const result = composer.compose(
 *   [{ recipeId: "scaffold-component" }, { recipeId: "generate-tests" }],
 *   { id: "scaffold-with-tests", name: "Scaffold + Tests", description: "..." }
 * );
 * ```
 */
export class RecipeComposer {
  private registry = new Map<string, Recipe>();

  constructor(recipes: Recipe[] = []) {
    for (const r of recipes) {
      this.registry.set(r.id, r);
    }
  }

  /** Add a recipe to the registry. */
  register(recipe: Recipe): void {
    this.registry.set(recipe.id, recipe);
  }

  /** Register multiple recipes at once. */
  registerAll(recipes: Recipe[]): void {
    for (const r of recipes) this.register(r);
  }

  /** Get a recipe by ID. */
  get(id: string): Recipe | undefined {
    return this.registry.get(id);
  }

  /** List all registered recipe IDs. */
  list(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Validate a slot list — returns any error messages (empty = valid).
   */
  validate(slots: RecipeSlot[]): string[] {
    const errors: string[] = [];
    if (slots.length === 0) {
      errors.push("Composition must include at least one recipe slot");
    }
    for (const slot of slots) {
      if (!this.registry.has(slot.recipeId)) {
        errors.push(`Recipe not found in registry: "${slot.recipeId}"`);
      }
    }
    return errors;
  }

  /**
   * Compose a set of recipe slots into a new composite Recipe + FlowSteps.
   *
   * @param slots Ordered list of recipe slots to combine.
   * @param options Metadata for the resulting composed recipe.
   */
  compose(slots: RecipeSlot[], options: CompositionOptions): CompositionResult {
    const errors = this.validate(slots);
    if (errors.length > 0) {
      throw new Error(`Composition validation failed:\n${errors.join("\n")}`);
    }

    const allCalls: ToolCall[] = [];
    const requiredMCPs = new Set<string>();
    const flowSteps: FlowStep[] = [];
    let stepIndex = 0;

    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const slot = slots[slotIdx];
      const recipe = this.registry.get(slot.recipeId)!;

      // Merge required MCPs
      for (const mcp of recipe.requiredMCPs) {
        requiredMCPs.add(mcp);
      }

      // Build calls with optional arg overrides
      const calls: ToolCall[] = recipe.calls.map(call => ({
        ...call,
        args: slot.argOverrides
          ? { ...call.args, ...slot.argOverrides }
          : { ...call.args },
      }));

      allCalls.push(...calls);

      // Generate FlowSteps for this slot's calls
      for (const call of calls) {
        const stepId = `${options.id}-step-${stepIndex++}`;
        flowSteps.push({
          id: stepId,
          label: `[${recipe.name}] ${call.tool}`,
          type: "call",
          call,
        });
      }

      // Optionally insert a barrier transform between recipes
      if (options.insertBarriers && slotIdx < slots.length - 1) {
        const barrierId = `${options.id}-barrier-${slotIdx}`;
        // Reference the last call step *before* this barrier, not the barrier itself
        const lastCallStepId = flowSteps.length > 0 ? flowSteps[flowSteps.length - 1].id : undefined;
        flowSteps.push({
          id: barrierId,
          label: `Barrier after "${recipe.name}"`,
          type: "transform",
          transform: (ctx) => ({ _barrier: slotIdx, _results: Array.from(ctx.results.keys()) }),
          dependsOn: lastCallStepId ? [lastCallStepId] : undefined,
        });
      }
    }

    const recipe: Recipe = {
      id: options.id,
      name: options.name,
      description: options.description,
      category: options.category ?? "workflow",
      calls: allCalls,
      requiredMCPs: Array.from(requiredMCPs),
      explanation: `Composed from: ${slots.map(s => s.recipeId).join(" → ")}`,
    };

    return { recipe, flowSteps };
  }

  /**
   * Quick helper — compose and immediately return the merged Recipe (no FlowSteps).
   */
  composeRecipe(slots: RecipeSlot[], options: CompositionOptions): Recipe {
    return this.compose(slots, options).recipe;
  }

  /**
   * Quick helper — compose and immediately return only the FlowSteps.
   */
  composeFlow(slots: RecipeSlot[], options: CompositionOptions): FlowStep[] {
    return this.compose(slots, options).flowSteps;
  }
}
