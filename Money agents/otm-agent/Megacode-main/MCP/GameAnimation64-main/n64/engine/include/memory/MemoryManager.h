/**
 * MemoryManager.h
 * GameAnimation64 - Advanced Memory Management
 * 
 * Provides efficient memory allocation for N64 hardware constraints.
 * Includes pool allocators, buddy allocators, and stack allocators.
 */

#pragma once
#include <cstdint>
#include <cstddef>
#include <vector>
#include <memory>
#include <algorithm>
#include <cassert>

namespace P64::Memory {

// Memory region types
enum class RegionType {
    UNKNOWN = 0,
    RDRAM,      // Main RAM (4MB/8MB)
    RSP_DMEM,   // RSP Data Memory (4KB)
    RSP_IMEM,   // RSP Instruction Memory (4KB)
    CART_ROM,   // Cartridge ROM
    SAVE_RAM,   // Save RAM
    AUDIO,      // Audio buffers
    TEXTURE,    // Texture memory
    FRAMEBUFFER // Framebuffer memory
};

// Allocation strategy
enum class AllocationStrategy {
    FIRST_FIT,      // First block that fits
    BEST_FIT,       // Best fitting block
    WORST_FIT,      // Worst fitting block (for fragmentation reduction)
    NEXT_FIT       // Continue from last allocation
};

/**
 * Memory block descriptor.
 */
struct MemoryBlock {
    void* address;
    size_t size;
    bool allocated;
    MemoryBlock* next;
    MemoryBlock* prev;
    
    // For buddy allocator
    uint32_t order;
    bool split;
    
    MemoryBlock(void* addr, size_t sz)
        : address(addr), size(sz), allocated(false), next(nullptr), prev(nullptr),
          order(0), split(false) {}
};

/**
 * Base memory allocator interface.
 */
class IAllocator {
public:
    virtual ~IAllocator() = default;
    
    /**
     * Allocate memory.
     * @param size Size in bytes
     * @param alignment Alignment requirement
     * @return Pointer to allocated memory or nullptr
     */
    virtual void* allocate(size_t size, size_t alignment = 1) = 0;
    
    /**
     * Free memory.
     * @param ptr Pointer to memory to free
     */
    virtual void free(void* ptr) = 0;
    
    /**
     * Get total size of managed memory.
     * @return Total size in bytes
     */
    virtual size_t totalSize() const = 0;
    
    /**
     * Get allocated size.
     * @return Allocated size in bytes
     */
    virtual size_t allocatedSize() const = 0;
    
    /**
     * Get free size.
     * @return Free size in bytes
     */
    virtual size_t freeSize() const = 0;
    
    /**
     * Get fragmentation percentage.
     * @return Fragmentation (0-100)
     */
    virtual float fragmentation() const = 0;
    
    /**
     * Defragment memory (if supported).
     * @return True if defragmentation successful
     */
    virtual bool defragment() = 0;
    
    /**
     * Reset allocator (free all allocations).
     */
    virtual void reset() = 0;
    
    /**
     * Check if pointer is from this allocator.
     * @param ptr Pointer to check
     * @return True if pointer is from this allocator
     */
    virtual bool owns(void* ptr) const = 0;
};

/**
 * Pool allocator for fixed-size allocations.
 * Extremely fast for objects of the same size.
 */
template<size_t BlockSize, size_t BlockCount>
class PoolAllocator : public IAllocator {
public:
    PoolAllocator() {
        // Allocate memory pool
        pool = std::make_unique<uint8_t[]>(BlockSize * BlockCount);
        
        // Initialize free list
        for (size_t i = 0; i < BlockCount; ++i) {
            uint8_t* block = pool.get() + (i * BlockSize);
            *reinterpret_cast<uint8_t**>(block) = freeList;
            freeList = block;
        }
        
        allocatedBlocks = 0;
    }
    
    ~PoolAllocator() override = default;
    
    void* allocate(size_t size, size_t alignment = 1) override {
        if (size > BlockSize || freeList == nullptr) {
            return nullptr;
        }
        
        // Check alignment
        uintptr_t addr = reinterpret_cast<uintptr_t>(freeList);
        if (alignment > 1 && (addr % alignment != 0)) {
            // Find aligned block (simple linear search)
            uint8_t* current = freeList;
            uint8_t* prev = nullptr;
            
            while (current) {
                addr = reinterpret_cast<uintptr_t>(current);
                if (addr % alignment == 0) {
                    // Remove from free list
                    if (prev) {
                        *reinterpret_cast<uint8_t**>(prev) = 
                            *reinterpret_cast<uint8_t**>(current);
                    } else {
                        freeList = *reinterpret_cast<uint8_t**>(current);
                    }
                    
                    ++allocatedBlocks;
                    return current;
                }
                
                prev = current;
                current = *reinterpret_cast<uint8_t**>(current);
            }
            
            return nullptr; // No aligned block found
        }
        
        // Take first block from free list
        uint8_t* block = freeList;
        freeList = *reinterpret_cast<uint8_t**>(block);
        
        ++allocatedBlocks;
        return block;
    }
    
    void free(void* ptr) override {
        if (!owns(ptr)) {
            return;
        }
        
        // Add to free list
        uint8_t* block = static_cast<uint8_t*>(ptr);
        *reinterpret_cast<uint8_t**>(block) = freeList;
        freeList = block;
        
        --allocatedBlocks;
    }
    
    size_t totalSize() const override {
        return BlockSize * BlockCount;
    }
    
    size_t allocatedSize() const override {
        return allocatedBlocks * BlockSize;
    }
    
    size_t freeSize() const override {
        return (BlockCount - allocatedBlocks) * BlockSize;
    }
    
    float fragmentation() const override {
        // Pool allocators have no fragmentation
        return 0.0f;
    }
    
    bool defragment() override {
        // Pool allocators don't need defragmentation
        return true;
    }
    
    void reset() override {
        // Rebuild free list
        freeList = nullptr;
        for (size_t i = 0; i < BlockCount; ++i) {
            uint8_t* block = pool.get() + (i * BlockSize);
            *reinterpret_cast<uint8_t**>(block) = freeList;
            freeList = block;
        }
        allocatedBlocks = 0;
    }
    
    bool owns(void* ptr) const override {
        uintptr_t start = reinterpret_cast<uintptr_t>(pool.get());
        uintptr_t end = start + (BlockSize * BlockCount);
        uintptr_t addr = reinterpret_cast<uintptr_t>(ptr);
        
        return addr >= start && addr < end;
    }
    
private:
    std::unique_ptr<uint8_t[]> pool;
    uint8_t* freeList = nullptr;
    size_t allocatedBlocks = 0;
};

/**
 * Stack allocator for temporary frame-based allocations.
 * Very fast for allocations that are freed in LIFO order.
 */
class StackAllocator : public IAllocator {
public:
    StackAllocator(void* memory, size_t size)
        : memory(static_cast<uint8_t*>(memory)), total(size), used(0) {
        assert(memory != nullptr);
        assert(size > 0);
    }
    
    ~StackAllocator() override = default;
    
    void* allocate(size_t size, size_t alignment = 1) override {
        // Calculate aligned address
        uintptr_t current = reinterpret_cast<uintptr_t>(memory) + used;
        uintptr_t aligned = (current + alignment - 1) & ~(alignment - 1);
        size_t padding = aligned - current;
        
        // Check if we have enough space
        if (used + padding + size > total) {
            return nullptr;
        }
        
        // Store allocation header
        AllocationHeader* header = reinterpret_cast<AllocationHeader*>(aligned);
        header->padding = static_cast<uint8_t>(padding);
        
        used += padding + size;
        return header + 1; // Return memory after header
    }
    
    void free(void* ptr) override {
        if (!owns(ptr)) {
            return;
        }
        
        // Get header
        AllocationHeader* header = static_cast<AllocationHeader*>(ptr) - 1;
        
        // Calculate new used size
        uintptr_t blockStart = reinterpret_cast<uintptr_t>(header);
        uintptr_t blockEnd = blockStart + sizeof(AllocationHeader) + 
                            (reinterpret_cast<uintptr_t>(ptr) - (blockStart + sizeof(AllocationHeader)));
        
        used = blockStart - reinterpret_cast<uintptr_t>(memory);
    }
    
    /**
     * Get current marker position.
     * @return Marker for later rollback
     */
    size_t getMarker() const {
        return used;
    }
    
    /**
     * Roll back to marker.
     * @param marker Marker to roll back to
     */
    void rollback(size_t marker) {
        assert(marker <= used);
        used = marker;
    }
    
    size_t totalSize() const override {
        return total;
    }
    
    size_t allocatedSize() const override {
        return used;
    }
    
    size_t freeSize() const override {
        return total - used;
    }
    
    float fragmentation() const override {
        // Stack allocators have no fragmentation
        return 0.0f;
    }
    
    bool defragment() override {
        return true;
    }
    
    void reset() override {
        used = 0;
    }
    
    bool owns(void* ptr) const override {
        uintptr_t start = reinterpret_cast<uintptr_t>(memory);
        uintptr_t end = start + total;
        uintptr_t addr = reinterpret_cast<uintptr_t>(ptr);
        
        return addr >= start && addr < end;
    }
    
private:
    struct AllocationHeader {
        uint8_t padding;
    };
    
    uint8_t* memory;
    size_t total;
    size_t used;
};

/**
 * Buddy allocator for power-of-two allocations.
 * Reduces fragmentation for variable-sized allocations.
 */
class BuddyAllocator : public IAllocator {
public:
    BuddyAllocator(void* memory, size_t size, size_t minBlockSize = 16);
    ~BuddyAllocator() override;
    
    void* allocate(size_t size, size_t alignment = 1) override;
    void free(void* ptr) override;
    
    size_t totalSize() const override { return total; }
    size_t allocatedSize() const override;
    size_t freeSize() const override;
    float fragmentation() const override;
    bool defragment() override;
    void reset() override;
    bool owns(void* ptr) const override;
    
private:
    struct BuddyBlock {
        uint32_t order;
        bool allocated;
        bool split;
        BuddyBlock* buddy;
        BuddyBlock* parent;
        
        BuddyBlock() : order(0), allocated(false), split(false), 
                      buddy(nullptr), parent(nullptr) {}
    };
    
    uint8_t* memory;
    size_t total;
    size_t minBlockSize;
    uint32_t maxOrder;
    
    std::vector<BuddyBlock*> freeLists;
    std::vector<BuddyBlock> blocks;
    
    /**
     * Get order for size.
     * @param size Requested size
     * @return Order (power of two)
     */
    uint32_t sizeToOrder(size_t size) const;
    
    /**
     * Get block from address.
     * @param addr Address
     * @return Block index
     */
    size_t addressToBlock(void* addr) const;
    
    /**
     * Get address from block.
     * @param block Block index
     * @return Address
     */
    void* blockToAddress(size_t block) const;
    
    /**
     * Split block.
     * @param block Block to split
     * @param order Current order
     */
    void splitBlock(size_t block, uint32_t order);
    
    /**
     * Merge block with buddy.
     * @param block Block to merge
     * @param order Current order
     */
    void mergeBlock(size_t block, uint32_t order);
    
    /**
     * Find free block of order.
     * @param order Order to find
     * @return Block index or -1 if not found
     */
    int findFreeBlock(uint32_t order);
};

/**
 * Main memory manager that coordinates multiple allocators.
 */
class MemoryManager {
public:
    MemoryManager();
    ~MemoryManager();
    
    /**
     * Initialize memory manager with N64 memory layout.
     */
    void initialize();
    
    /**
     * Register memory region.
     * @param type Region type
     * @param start Start address
     * @param size Region size
     * @param allocator Allocator to use
     */
    void registerRegion(RegionType type, void* start, size_t size, 
                       std::unique_ptr<IAllocator> allocator);
    
    /**
     * Allocate memory from best-fit region.
     * @param size Size in bytes
     * @param alignment Alignment requirement
     * @param type Preferred region type
     * @return Pointer to allocated memory or nullptr
     */
    void* allocate(size_t size, size_t alignment = 1, 
                  RegionType type = RegionType::RDRAM);
    
    /**
     * Free memory.
     * @param ptr Pointer to memory
     */
    void free(void* ptr);
    
    /**
     * Allocate from specific region.
     * @param type Region type
     * @param size Size in bytes
     * @param alignment Alignment requirement
     * @return Pointer to allocated memory or nullptr
     */
    void* allocateFrom(RegionType type, size_t size, size_t alignment = 1);
    
    /**
     * Get region for pointer.
     * @param ptr Pointer
     * @return Region type or UNKNOWN
     */
    RegionType getRegion(void* ptr) const;
    
    /**
     * Get allocator statistics.
     * @param type Region type
     * @return Statistics string
     */
    std::string getStats(RegionType type) const;
    
    /**
     * Get total memory statistics.
     * @return Statistics string
     */
    std::string getTotalStats() const;
    
    /**
     * Defragment all regions.
     */
    void defragmentAll();
    
    /**
     * Reset all allocators.
     */
    void resetAll();
    
private:
    struct Region {
        RegionType type;
        void* start;
        size_t size;
        std::unique_ptr<IAllocator> allocator;
        
        Region(RegionType t, void* s, size_t sz, std::unique_ptr<IAllocator> a)
            : type(t), start(s), size(sz), allocator(std::move(a)) {}
    };
    
    std::vector<Region> regions;
    
    /**
     * Find region for pointer.
     * @param ptr Pointer
     * @return Region index or -1
     */
    int findRegion(void* ptr) const;
    
    /**
     * Find region by type.
     * @param type Region type
     * @return Region index or -1
     */
    int findRegion(RegionType type) const;
};

// Global memory manager instance
extern MemoryManager gMemoryManager;

} // namespace P64::Memory