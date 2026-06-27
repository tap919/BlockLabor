/**
 * SystemManager.h
 * GameAnimation64 - ECS System Management
 * 
 * Manages system execution and entity queries in the Entity Component System.
 * Supports system dependencies and execution ordering.
 */

#pragma once
#include "EntityManager.h"
#include "ComponentManager.h"
#include <cstdint>
#include <vector>
#include <unordered_map>
#include <memory>
#include <typeindex>
#include <functional>
#include <bitset>

namespace P64::ECS {

// Forward declaration
class SystemManager;

/**
 * Signature representing a set of component types.
 * Used to match entities with systems.
 */
class Signature {
public:
    Signature() = default;
    
    /**
     * Set bit for component type.
     * @tparam T Component type
     */
    template<typename T>
    void set() {
        bitset.set(getComponentType<T>());
    }
    
    /**
     * Clear bit for component type.
     * @tparam T Component type
     */
    template<typename T>
    void clear() {
        bitset.reset(getComponentType<T>());
    }
    
    /**
     * Check if signature has component type.
     * @tparam T Component type
     * @return True if signature includes component type
     */
    template<typename T>
    bool has() const {
        return bitset.test(getComponentType<T>());
    }
    
    /**
     * Check if signature matches another (subset).
     * @param other Signature to compare with
     * @return True if this signature is subset of other
     */
    bool matches(const Signature& other) const {
        return (bitset & other.bitset) == bitset;
    }
    
    /**
     * Get bitset representation.
     * @return Const reference to bitset
     */
    const std::bitset<64>& getBitset() const {
        return bitset;
    }
    
    /**
     * Check if signature is empty.
     * @return True if no bits are set
     */
    bool empty() const {
        return bitset.none();
    }
    
    /**
     * Clear all bits.
     */
    void clearAll() {
        bitset.reset();
    }
    
private:
    std::bitset<64> bitset;
    
    /**
     * Get component type ID for template type.
     * Note: This requires ComponentManager to be initialized first.
     * @tparam T Component type
     * @return Component type ID
     */
    template<typename T>
    static uint32_t getComponentType() {
        // This will be set by SystemManager during initialization
        static uint32_t type = 0;
        return type;
    }
    
    // Friend SystemManager to allow setting component type IDs
    friend class SystemManager;
};

/**
 * Base interface for all systems.
 */
class ISystem {
public:
    virtual ~ISystem() = default;
    
    /**
     * Update system logic.
     * @param deltaTime Time since last update in seconds
     */
    virtual void update(float deltaTime) = 0;
    
    /**
     * Get system signature.
     * @return Signature of required components
     */
    virtual const Signature& getSignature() const = 0;
    
    /**
     * Called when entity signature changes.
     * @param entity Entity that changed
     * @param signature New entity signature
     */
    virtual void onEntitySignatureChanged(Entity entity, const Signature& signature) = 0;
    
    /**
     * Called when entity is destroyed.
     * @param entity Entity that was destroyed
     */
    virtual void onEntityDestroyed(Entity entity) = 0;
};

/**
 * Base class for systems with specific component requirements.
 * Manages entity lists and provides iteration helpers.
 */
template<typename... ComponentTypes>
class System : public ISystem {
public:
    System() = default;
    virtual ~System() override = default;
    
    /**
     * Update system logic.
     * @param deltaTime Time since last update in seconds
     */
    void update(float deltaTime) override {
        // Default implementation does nothing
        // Derived classes should override
    }
    
    /**
     * Get system signature.
     * @return Signature of required components
     */
    const Signature& getSignature() const override {
        return signature;
    }
    
    /**
     * Called when entity signature changes.
     * @param entity Entity that changed
     * @param signature New entity signature
     */
    void onEntitySignatureChanged(Entity entity, const Signature& signature) override {
        if (signature.matches(this->signature)) {
            // Entity now matches system requirements
            entities.push_back(entity);
        } else {
            // Entity no longer matches system requirements
            removeEntity(entity);
        }
    }
    
    /**
     * Called when entity is destroyed.
     * @param entity Entity that was destroyed
     */
    void onEntityDestroyed(Entity entity) override {
        removeEntity(entity);
    }
    
    /**
     * Get list of entities managed by this system.
     * @return Const reference to entity list
     */
    const std::vector<Entity>& getEntities() const {
        return entities;
    }
    
    /**
     * Get number of entities managed by this system.
     * @return Entity count
     */
    size_t getEntityCount() const {
        return entities.size();
    }
    
    /**
     * Check if system manages an entity.
     * @param entity Entity to check
     * @return True if entity is managed by system
     */
    bool hasEntity(Entity entity) const {
        return std::find(entities.begin(), entities.end(), entity) != entities.end();
    }
    
protected:
    // List of entities that match system requirements
    std::vector<Entity> entities;
    
    // System signature (required components)
    Signature signature;
    
private:
    /**
     * Remove entity from system.
     * @param entity Entity to remove
     */
    void removeEntity(Entity entity) {
        auto it = std::find(entities.begin(), entities.end(), entity);
        if (it != entities.end()) {
            // Swap with last element and pop
            *it = entities.back();
            entities.pop_back();
        }
    }
};

/**
 * Manages all systems and their execution order.
 */
class SystemManager {
public:
    SystemManager(EntityManager& entityManager, ComponentManager& componentManager);
    ~SystemManager() = default;
    
    /**
     * Register a system type.
     * @tparam T System type
     * @param dependencies System types that must run before this system
     * @return Reference to registered system
     */
    template<typename T, typename... DependencyTypes>
    std::shared_ptr<T> registerSystem() {
        std::type_index type = std::type_index(typeid(T));
        
        if (systems.find(type) != systems.end()) {
            // System already registered
            return std::static_pointer_cast<T>(systems[type]);
        }
        
        // Create new system
        auto system = std::make_shared<T>();
        systems[type] = system;
        
        // Set system signature
        system->signature = buildSignature<T>();
        
        return system;
    }
    
    /**
     * Set system signature (required components).
     * @tparam T System type
     * @param signature Signature of required components
     */
    template<typename T>
    void setSignature(const Signature& signature) {
        std::type_index type = std::type_index(typeid(T));
        auto it = systems.find(type);
        if (it == systems.end()) {
            throw std::runtime_error("System not registered");
        }
        
        it->second->signature = signature;
    }
    
    /**
     * Update all systems.
     * @param deltaTime Time since last update in seconds
     */
    void update(float deltaTime) {
        for (auto& [type, system] : systems) {
            system->update(deltaTime);
        }
    }
    
    /**
     * Notify systems of entity signature change.
     * @param entity Entity that changed
     * @param signature New entity signature
     */
    void entitySignatureChanged(Entity entity, const Signature& signature) {
        for (auto& [type, system] : systems) {
            system->onEntitySignatureChanged(entity, signature);
        }
    }
    
    /**
     * Notify systems of entity destruction.
     * @param entity Entity that was destroyed
     */
    void entityDestroyed(Entity entity) {
        for (auto& [type, system] : systems) {
            system->onEntityDestroyed(entity);
        }
    }
    
    /**
     * Get system by type.
     * @tparam T System type
     * @return Pointer to system or nullptr if not found
     */
    template<typename T>
    std::shared_ptr<T> getSystem() {
        std::type_index type = std::type_index(typeid(T));
        auto it = systems.find(type);
        if (it == systems.end()) {
            return nullptr;
        }
        return std::static_pointer_cast<T>(it->second);
    }
    
    /**
     * Check if system is registered.
     * @tparam T System type
     * @return True if system is registered
     */
    template<typename T>
    bool hasSystem() {
        std::type_index type = std::type_index(typeid(T));
        return systems.find(type) != systems.end();
    }
    
    /**
     * Remove system by type.
     * @tparam T System type
     */
    template<typename T>
    void removeSystem() {
        std::type_index type = std::type_index(typeid(T));
        systems.erase(type);
    }
    
    /**
     * Clear all systems.
     */
    void clear() {
        systems.clear();
    }
    
private:
    // Reference to entity manager
    EntityManager& entityManager;
    
    // Reference to component manager
    ComponentManager& componentManager;
    
    // Map from system type to system instance
    std::unordered_map<std::type_index, std::shared_ptr<ISystem>> systems;
    
    /**
     * Build signature for system type.
     * @tparam T System type
     * @return Signature with required component bits set
     */
    template<typename T>
    Signature buildSignature() {
        Signature signature;
        // Signature will be set by derived system classes
        return signature;
    }
    
    /**
     * Set component type ID in Signature class.
     * Called during initialization.
     * @tparam T Component type
     * @param typeId Component type ID
     */
    template<typename T>
    static void setComponentTypeId(uint32_t typeId) {
        Signature::getComponentType<T>() = typeId;
    }
    
    // Friend ComponentManager to allow setting component type IDs
    friend class ComponentManager;
};

// Inline implementation
inline SystemManager::SystemManager(EntityManager& entityManager, ComponentManager& componentManager)
    : entityManager(entityManager)
    , componentManager(componentManager) {
}

} // namespace P64::ECS