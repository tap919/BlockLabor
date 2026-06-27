/**
 * JobSystem.h
 * GameAnimation64 - Parallel Job System
 * 
 * Task-based parallel processing system optimized for N64 RSP.
 * Supports dependency tracking, priority queues, and RSP microcode tasks.
 */

#pragma once
#include <cstdint>
#include <functional>
#include <vector>
#include <queue>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <memory>
#include <future>

namespace P64::Jobs {

// Job priority levels
enum class JobPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
};

// Job types
enum class JobType {
    CPU,    // CPU-bound task
    RSP,    // RSP microcode task
    DMA,    // DMA transfer task
    IO      // I/O operation
};

// Job status
enum class JobStatus {
    PENDING,    // Not yet scheduled
    SCHEDULED,  // Scheduled for execution
    RUNNING,    // Currently executing
    COMPLETED,  // Successfully completed
    FAILED,     // Execution failed
    CANCELLED   // Cancelled before execution
};

/**
 * Job descriptor.
 */
struct Job {
    using Function = std::function<void()>;
    
    uint64_t id;
    Function function;
    JobType type;
    JobPriority priority;
    std::atomic<JobStatus> status;
    
    // Dependencies
    std::vector<Job*> dependencies;
    std::atomic<int> unfinishedDependencies;
    
    // Continuation (job to run after this one)
    Job* continuation;
    
    // Parent job (for nested jobs)
    Job* parent;
    std::atomic<int> unfinishedChildren;
    
    // Result storage
    std::promise<void> promise;
    
    Job(uint64_t jobId, Function func, JobType jobType = JobType::CPU, 
        JobPriority jobPriority = JobPriority::NORMAL)
        : id(jobId), function(std::move(func)), type(jobType), 
          priority(jobPriority), status(JobStatus::PENDING),
          unfinishedDependencies(0), continuation(nullptr),
          parent(nullptr), unfinishedChildren(0) {}
    
    /**
     * Check if job is ready to execute.
     * @return True if all dependencies are satisfied
     */
    bool isReady() const {
        return unfinishedDependencies.load() == 0;
    }
    
    /**
     * Check if job is finished.
     * @return True if job is completed, failed, or cancelled
     */
    bool isFinished() const {
        JobStatus s = status.load();
        return s == JobStatus::COMPLETED || 
               s == JobStatus::FAILED || 
               s == JobStatus::CANCELLED;
    }
    
    /**
     * Add dependency.
     * @param dependency Job that must complete before this one
     */
    void addDependency(Job* dependency) {
        dependencies.push_back(dependency);
        unfinishedDependencies.fetch_add(1);
    }
    
    /**
     * Notify that a dependency has completed.
     */
    void dependencyCompleted() {
        if (unfinishedDependencies.fetch_sub(1) == 1) {
            // Last dependency completed
            // Job is now ready
        }
    }
    
    /**
     * Get future for job completion.
     * @return Future that becomes ready when job completes
     */
    std::future<void> getFuture() {
        return promise.get_future();
    }
};

/**
 * RSP-specific job for microcode execution.
 */
struct RSPJob : public Job {
    // RSP microcode program
    void* microcode;
    size_t microcodeSize;
    
    // Input/output buffers
    void* inputBuffer;
    void* outputBuffer;
    size_t bufferSize;
    
    // DMA parameters
    uint32_t dmaFlags;
    
    RSPJob(uint64_t jobId, Function func, void* uc, size_t ucSize,
           void* inBuf = nullptr, void* outBuf = nullptr, size_t bufSize = 0)
        : Job(jobId, std::move(func), JobType::RSP),
          microcode(uc), microcodeSize(ucSize),
          inputBuffer(inBuf), outputBuffer(outBuf), bufferSize(bufSize),
          dmaFlags(0) {}
};

/**
 * DMA transfer job.
 */
struct DMAJob : public Job {
    void* source;
    void* destination;
    size_t size;
    uint32_t flags;
    
    DMAJob(uint64_t jobId, Function func, void* src, void* dst, size_t sz, uint32_t flgs = 0)
        : Job(jobId, std::move(func), JobType::DMA),
          source(src), destination(dst), size(sz), flags(flgs) {}
};

/**
 * Job queue with priority support.
 */
class JobQueue {
public:
    JobQueue() = default;
    ~JobQueue() = default;
    
    /**
     * Push job to queue.
     * @param job Job to push
     */
    void push(Job* job) {
        std::lock_guard<std::mutex> lock(mutex);
        
        // Insert based on priority
        auto it = queue.begin();
        while (it != queue.end() && (*it)->priority >= job->priority) {
            ++it;
        }
        queue.insert(it, job);
        
        condition.notify_one();
    }
    
    /**
     * Pop job from queue (blocks if empty).
     * @return Next job or nullptr if shutting down
     */
    Job* pop() {
        std::unique_lock<std::mutex> lock(mutex);
        
        condition.wait(lock, [this]() {
            return !queue.empty() || shuttingDown;
        });
        
        if (shuttingDown && queue.empty()) {
            return nullptr;
        }
        
        Job* job = queue.front();
        queue.erase(queue.begin());
        return job;
    }
    
    /**
     * Try to pop job from queue (non-blocking).
     * @param job Output parameter for job
     * @return True if job was popped
     */
    bool tryPop(Job*& job) {
        std::lock_guard<std::mutex> lock(mutex);
        
        if (queue.empty()) {
            return false;
        }
        
        job = queue.front();
        queue.erase(queue.begin());
        return true;
    }
    
    /**
     * Get queue size.
     * @return Number of jobs in queue
     */
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex);
        return queue.size();
    }
    
    /**
     * Check if queue is empty.
     * @return True if queue is empty
     */
    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex);
        return queue.empty();
    }
    
    /**
     * Signal shutdown.
     */
    void shutdown() {
        std::lock_guard<std::mutex> lock(mutex);
        shuttingDown = true;
        condition.notify_all();
    }
    
private:
    mutable std::mutex mutex;
    std::condition_variable condition;
    std::vector<Job*> queue;
    bool shuttingDown = false;
};

/**
 * Worker thread for job execution.
 */
class Worker {
public:
    Worker(JobQueue& queue, uint32_t id);
    ~Worker();
    
    /**
     * Start worker thread.
     */
    void start();
    
    /**
     * Stop worker thread.
     */
    void stop();
    
    /**
     * Get worker ID.
     * @return Worker ID
     */
    uint32_t getId() const { return id; }
    
    /**
     * Check if worker is busy.
     * @return True if currently executing a job
     */
    bool isBusy() const { return busy; }
    
    /**
     * Get completed job count.
     * @return Number of jobs completed
     */
    uint64_t getCompletedCount() const { return completedCount; }
    
private:
    void run();
    
    JobQueue& queue;
    uint32_t id;
    std::thread thread;
    std::atomic<bool> running;
    std::atomic<bool> busy;
    std::atomic<uint64_t> completedCount;
};

/**
 * RSP worker for microcode execution.
 */
class RSPWorker {
public:
    RSPWorker();
    ~RSPWorker();
    
    /**
     * Submit RSP job for execution.
     * @param job RSP job to execute
     */
    void submit(RSPJob* job);
    
    /**
     * Wait for all RSP jobs to complete.
     */
    void waitAll();
    
    /**
     * Check if RSP is busy.
     * @return True if RSP is executing a job
     */
    bool isBusy() const;
    
    /**
     * Get completed RSP job count.
     * @return Number of RSP jobs completed
     */
    uint64_t getCompletedCount() const;
    
private:
    void processJobs();
    
    std::vector<RSPJob*> queue;
    mutable std::mutex mutex;
    std::condition_variable condition;
    std::thread thread;
    std::atomic<bool> running;
    std::atomic<bool> busy;
    std::atomic<uint64_t> completedCount;
};

/**
 * Main job system coordinator.
 */
class JobSystem {
public:
    JobSystem();
    ~JobSystem();
    
    /**
     * Initialize job system.
     * @param workerCount Number of worker threads (0 for automatic)
     * @param useRSP Whether to enable RSP worker
     */
    void initialize(uint32_t workerCount = 0, bool useRSP = true);
    
    /**
     * Shutdown job system.
     */
    void shutdown();
    
    /**
     * Create a job.
     * @param function Job function
     * @param type Job type
     * @param priority Job priority
     * @return Job pointer
     */
    Job* createJob(Job::Function function, JobType type = JobType::CPU,
                   JobPriority priority = JobPriority::NORMAL);
    
    /**
     * Create an RSP job.
     * @param function Job function
     * @param microcode RSP microcode
     * @param microcodeSize Microcode size
     * @param priority Job priority
     * @return RSP job pointer
     */
    RSPJob* createRSPJob(Job::Function function, void* microcode, size_t microcodeSize,
                         JobPriority priority = JobPriority::NORMAL);
    
    /**
     * Create a DMA job.
     * @param function Job function
     * @param source Source address
     * @param destination Destination address
     * @param size Transfer size
     * @param flags DMA flags
     * @param priority Job priority
     * @return DMA job pointer
     */
    DMAJob* createDMAJob(Job::Function function, void* source, void* destination,
                         size_t size, uint32_t flags = 0,
                         JobPriority priority = JobPriority::NORMAL);
    
    /**
     * Schedule a job for execution.
     * @param job Job to schedule
     */
    void schedule(Job* job);
    
    /**
     * Wait for job to complete.
     * @param job Job to wait for
     */
    void wait(Job* job);
    
    /**
     * Wait for all jobs to complete.
     */
    void waitAll();
    
    /**
     * Get job system statistics.
     * @return Statistics string
     */
    std::string getStats() const;
    
    /**
     * Get number of active workers.
     * @return Worker count
     */
    uint32_t getWorkerCount() const { return static_cast<uint32_t>(workers.size()); }
    
    /**
     * Get number of pending jobs.
     * @return Pending job count
     */
    uint64_t getPendingCount() const;
    
    /**
     * Get number of completed jobs.
     * @return Completed job count
     */
    uint64_t getCompletedCount() const;
    
private:
    JobQueue queue;
    std::vector<std::unique_ptr<Worker>> workers;
    std::unique_ptr<RSPWorker> rspWorker;
    
    std::atomic<uint64_t> nextJobId;
    std::atomic<uint64_t> totalCompleted;
    
    // Job pool for allocation
    class JobPool {
    public:
        JobPool();
        ~JobPool();
        
        Job* allocate(Job::Function function, JobType type, JobPriority priority);
        RSPJob* allocateRSP(Job::Function function, void* microcode, size_t microcodeSize,
                           JobPriority priority);
        DMAJob* allocateDMA(Job::Function function, void* source, void* destination,
                           size_t size, uint32_t flags, JobPriority priority);
        
        void deallocate(Job* job);
        
    private:
        struct PoolBlock {
            std::vector<Job*> jobs;
            std::vector<RSPJob*> rspJobs;
            std::vector<DMAJob*> dmaJobs;
        };
        
        std::vector<PoolBlock> blocks;
        mutable std::mutex mutex;
    };
    
    JobPool jobPool;
    
    /**
     * Execute job and handle dependencies.
     * @param job Job to execute
     */
    void executeJob(Job* job);
    
    /**
     * Notify dependents that job has completed.
     * @param job Completed job
     */
    void notifyDependents(Job* job);
    
    /**
     * Complete job (successfully or with error).
     * @param job Job to complete
     * @param success True if job succeeded
     */
    void completeJob(Job* job, bool success);
};

// Global job system instance
extern JobSystem gJobSystem;

} // namespace P64::Jobs