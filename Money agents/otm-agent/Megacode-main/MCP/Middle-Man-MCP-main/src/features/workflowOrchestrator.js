'use strict';

const { v4: uuidv4 } = require('uuid');
const { withRetry } = require('./retryLogic');
const config = require('../config');

const flowRegistry = new Map();
const flowRuns = new Map();

/**
 * Creates a named task — the atomic unit of a workflow flow.
 * Isolates functional logic from cross-cutting concerns (retry, error handling).
 *
 * @param {string} name - Unique task name within a flow.
 * @param {Function} fn - Task function receiving (context) and returning a value.
 * @param {object} [options] - Optional overrides: { retry: { retries, delay, backoff } }.
 */
function createTask(name, fn, options = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('Task name must be a non-empty string');
  if (typeof fn !== 'function') throw new TypeError('Task fn must be a function');
  return { name, fn, options };
}

/**
 * Defines a named flow composed of tasks.
 * Flows are the top-level unit of workflow orchestration.
 *
 * @param {string} name - Unique flow name.
 * @param {Array}  tasks - Ordered array of tasks created with createTask().
 * @param {object} [options] - Flow-level options.
 */
function createFlow(name, tasks, options = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('Flow name must be a non-empty string');
  if (!Array.isArray(tasks)) throw new TypeError('Tasks must be an array');
  const flow = { name, tasks, options, createdAt: Date.now() };
  flowRegistry.set(name, flow);
  flowRuns.set(name, []);
  return flow;
}

/**
 * Executes a registered flow by name.
 * Each task result is merged into the shared context for downstream tasks.
 * A task failure immediately halts the flow and marks which task failed.
 *
 * @param {string} name    - Name of the flow to run.
 * @param {object} context - Initial context object passed to every task.
 * @returns {Promise<object>} Run record with per-task status, timings, and errors.
 */
async function runFlow(name, context = {}) {
  const flow = flowRegistry.get(name);
  if (!flow) throw new Error(`Flow not found: ${name}`);

  const runId = uuidv4();
  const run = {
    runId,
    flowName: name,
    status: 'running',
    startTime: Date.now(),
    endTime: null,
    failedTask: null,
    tasks: [],
    context,
  };

  const runs = flowRuns.get(name) || [];
  if (!flowRuns.has(name)) flowRuns.set(name, runs);
  runs.push(run);

  const maxRunsPerFlow =
    config &&
    config.workflow &&
    Number.isInteger(config.workflow.maxRunsPerFlow)
      ? config.workflow.maxRunsPerFlow
      : null;
  if (maxRunsPerFlow && maxRunsPerFlow > 0 && runs.length > maxRunsPerFlow) {
    // Trim oldest runs to enforce the configured limit.
    runs.splice(0, runs.length - maxRunsPerFlow);
  }
  let currentContext = { ...context };

  for (const task of flow.tasks) {
    const taskRun = {
      name: task.name,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      error: null,
    };
    run.tasks.push(taskRun);

    try {
      const retryOpts = task.options.retry || {};
      const result = await withRetry(() => task.fn(currentContext), {
        retries: retryOpts.retries !== undefined ? retryOpts.retries : config.retry.retries,
        delay: retryOpts.delay !== undefined ? retryOpts.delay : config.retry.delay,
        backoff: retryOpts.backoff !== undefined ? retryOpts.backoff : config.retry.backoff,
      });
      currentContext = { ...currentContext, [task.name]: result };
      taskRun.status = 'success';
      taskRun.endTime = Date.now();
      taskRun.durationMs = taskRun.endTime - taskRun.startTime;
    } catch (err) {
      taskRun.status = 'failed';
      taskRun.endTime = Date.now();
      taskRun.durationMs = taskRun.endTime - taskRun.startTime;
      taskRun.error = err.message;
      run.status = 'failed';
      run.endTime = Date.now();
      run.durationMs = run.endTime - run.startTime;
      run.failedTask = task.name;
      throw err;
    }
  }

  run.status = 'success';
  run.endTime = Date.now();
  run.durationMs = run.endTime - run.startTime;
  return run;
}

/**
 * Returns the current status and last run info for a named flow.
 */
function getFlowStatus(name) {
  const flow = flowRegistry.get(name);
  if (!flow) return null;
  const runs = flowRuns.get(name) || [];
  const last = runs[runs.length - 1] || null;
  return {
    name,
    createdAt: flow.createdAt,
    taskCount: flow.tasks.length,
    tasks: flow.tasks.map((t) => t.name),
    totalRuns: runs.length,
    lastRun: last
      ? {
          runId: last.runId,
          status: last.status,
          startTime: last.startTime,
          endTime: last.endTime,
          failedTask: last.failedTask,
          tasks: last.tasks,
        }
      : null,
  };
}

/**
 * Returns status summaries for all registered flows (centralized observability).
 */
function getAllFlows() {
  const result = [];
  for (const [name] of flowRegistry) {
    result.push(getFlowStatus(name));
  }
  return result;
}

module.exports = { createTask, createFlow, runFlow, getFlowStatus, getAllFlows };
