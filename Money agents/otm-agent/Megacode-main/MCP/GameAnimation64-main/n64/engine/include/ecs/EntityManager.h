/**
 * EntityManager.h
 * GameAnimation64 - ECS Entity Management
 * 
 * Manages entity IDs and lifecycle in the Entity Component System.
 * Uses generational indices for safe entity reuse.
 */

#pragma once
#include <cstdint>
#include <vector>
#include <queue>

namespace P64::ECS {

/**
 * Entity identifier with generation counter for safe reuse.
 */
struct Entity {
    uint32_t id : 24;      // 16.7 million entities max
    uint32_t generation : 8; // 256 generations max
    
    constexpr Entity() : id(0), generation(0) {}
    constexpr Entity(uint32_t id, uint32_t gen) : id(id), generation(gen) {}
    
    constexpr bool operator==(const Entity& other) const {
        return id == other.id && generation == other.generation;
    }
    
    constexpr bool operator!=(const Entity& other) const {
        return !(*this == other);
    }
    
    constexpr bool valid() const { return id != 0; }
    
    // Hash for use in unordered containers
    struct Hash {
        size_t operator()(const Entity& e) const {
            return (static_cast<size_t>(e.id) << 8) | e.generation;
        }
    };
};

/**
 * Manages entity creation, destruction, and validation.
 */
class EntityManager {
public:
    EntityManager();
    ~EntityManager() = default;
    
    /**
     * Create a new entity.
     * @return New entity with unique ID
     */
    Entity create();
    
    /**
     * Destroy an entity and mark its ID for reuse.
     * @param entity Entity to destroy
     */
    void destroy(Entity entity);
    
    /**
     * Check if an entity is still alive.
     * @param entity Entity to check
     * @return True if entity exists and hasn't been destroyed
     */
    bool alive(Entity entity) const;
    
    /**
     * Get the current generation of an entity ID.
     * @param id Entity ID (without generation)
     * @return Current generation count
     */
    uint8_t getGeneration(uint32_t id) const;
    
    /**
     * Get total number of active entities.
     * @return Count of living entities
     */
    size_t count() const { return livingEntityCount; }
    
    /**
     * Reset the entity manager, clearing all entities.
     * Warning: Invalidates all existing entity references.
     */
    void reset();
    
private:
    // Next available entity ID
    uint32_t nextId;
    
    // Count of currently living entities
    size_t livingEntityCount;
    
    // Queue of freed entity IDs for reuse
    std::queue<uint32_t> freeList;
    
    // Generation counter for each entity ID
    std::vector<uint8_t> generations;
    
    // Maximum number of entities supported
    static constexpr uint32_t MAX_ENTITIES = 1 << 24; // 16.7 million
    
    /**
     * Ensure entity ID is within valid range.
     * @param id Entity ID to validate
     * @return True if ID is valid
     */
    bool validId(uint32_t id) const {
        return id > 0 && id <= MAX_ENTITIES;
    }
};

// Inline implementations for performance
inline EntityManager::EntityManager() 
    : nextId(1)
    , livingEntityCount(0)
    , generations(MAX_ENTITIES + 1, 0) {
    // Reserve space in free list
    freeList.reserve(1024);
}

inline Entity EntityManager::create() {
    uint32_t id;
    
    if (!freeList.empty()) {
        // Reuse a previously freed ID
        id = freeList.front();
        freeList.pop();
    } else {
        // Allocate new ID
        if (nextId > MAX_ENTITIES) {
            // Handle out of entities (should rarely happen)
            // In practice, we'd want to handle this more gracefully
            return Entity();
        }
        id = nextId++;
    }
    
    ++livingEntityCount;
    return Entity(id, generations[id]);
}

inline void EntityManager::destroy(Entity entity) {
    if (!alive(entity)) {
        return; // Already destroyed or invalid
    }
    
    // Increment generation for this ID
    ++generations[entity.id];
    
    // Add to free list for reuse
    freeList.push(entity.id);
    
    --livingEntityCount;
}

inline bool EntityManager::alive(Entity entity) const {
    if (!validId(entity.id)) {
        return false;
    }
    
    // Entity is alive if its generation matches current generation
    return generations[entity.id] == entity.generation;
}

inline uint8_t EntityManager::getGeneration(uint32_t id) const {
    if (!validId(id)) {
        return 0;
    }
    return generations[id];
}

inline void EntityManager::reset() {
    nextId = 1;
    livingEntityCount = 0;
    
    // Clear free list
    std::queue<uint32_t> empty;
    std::swap(freeList, empty);
    
    // Reset all generations
    std::fill(generations.begin(), generations.end(), 0);
}

} // namespace P64::ECS