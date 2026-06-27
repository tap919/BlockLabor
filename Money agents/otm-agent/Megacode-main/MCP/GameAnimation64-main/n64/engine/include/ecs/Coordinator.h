/**
 * Coordinator.h
 * GameAnimation64 - ECS Coordinator
 * 
 * Main entry point for the Entity Component System.
 * Provides simplified API for entity and component management.
 */

#pragma once
#include "EntityManager.h"
#include "ComponentManager.h"
#include "SystemManager.h"
#include <memory>

namespace P64::ECS {

/**
 * Main coordinator for the ECS architecture.
 * Provides a simplified interface for entity, component, and system management.
 */
class Coordinator {
public:
    Coordinator();
    ~Coordinator() = default;
    
    // Entity management
    Entity createEntity();
    void destroyEntity(Entity entity);
    bool entityAlive(Entity entity) const;
    size_t getEntityCount() const;
    
    // Component management
    template<typename T>
    void registerComponent() {
        componentManager.registerComponent<T>();
        // Update signature component type mapping
        SystemManager::setComponentTypeId<T>(componentManager.getComponentType<T>());
    }
    
    template<typename T>
    void addComponent(Entity entity, const T& component) {
        componentManager.addComponent(entity, component);
        updateEntitySignature(entity);
    }
    
    template<typename T>
    void addComponent(Entity entity, T&& component) {
        componentManager.addComponent(entity, std::move(component));
        updateEntitySignature(entity);
    }
    
    template<typename T>
    void removeComponent(Entity entity) {
        componentManager.removeComponent<T>(entity);
        updateEntitySignature(entity);
    }
    
    template<typename T>
    T& getComponent(Entity entity) {
        return componentManager.getComponent<T>(entity);
    }
    
    template<typename T>
    const T& getComponent(Entity entity) const {
        return componentManager.getComponent<T>(entity);
    }
    
    template<typename T>
    T* tryGetComponent(Entity entity) {
        return componentManager.tryGetComponent<T>(entity);
    }
    
    template<typename T>
    const T* tryGetComponent(Entity entity) const {
        return componentManager.tryGetComponent<T>(entity);
    }
    
    template<typename T>
    bool hasComponent(Entity entity) const {
        return componentManager.hasComponent<T>(entity);
    }
    
    // System management
    template<typename T, typename... DependencyTypes>
    std::shared_ptr<T> registerSystem() {
        return systemManager.registerSystem<T, DependencyTypes...>();
    }
    
    template<typename T>
    void setSystemSignature(const Signature& signature) {
        systemManager.setSignature<T>(signature);
    }
    
    void updateSystems(float deltaTime) {
        systemManager.update(deltaTime);
    }
    
    template<typename T>
    std::shared_ptr<T> getSystem() {
        return systemManager.getSystem<T>();
    }
    
    template<typename T>
    bool hasSystem() {
        return systemManager.hasSystem<T>();
    }
    
    // Getters for internal managers (advanced use)
    EntityManager& getEntityManager() { return entityManager; }
    ComponentManager& getComponentManager() { return componentManager; }
    SystemManager& getSystemManager() { return systemManager; }
    
    const EntityManager& getEntityManager() const { return entityManager; }
    const ComponentManager& getComponentManager() const { return componentManager; }
    const SystemManager& getSystemManager() const { return systemManager; }
    
    /**
     * Get entity signature.
     * @param entity Entity to get signature for
     * @return Signature of entity's components
     */
    Signature getEntitySignature(Entity entity) const;
    
    /**
     * Clear all entities, components, and systems.
     * Warning: This invalidates all existing entity references.
     */
    void clear();
    
private:
    EntityManager entityManager;
    ComponentManager componentManager;
    SystemManager systemManager;
    
    // Cache of entity signatures for quick lookup
    std::unordered_map<Entity, Signature, Entity::Hash> entitySignatures;
    
    /**
     * Update entity signature and notify systems.
     * @param entity Entity to update
     */
    void updateEntitySignature(Entity entity);
    
    /**
     * Build signature for entity based on its components.
     * @param entity Entity to build signature for
     * @return Signature of entity's components
     */
    Signature buildEntitySignature(Entity entity) const;
};

// Inline implementations
inline Coordinator::Coordinator()
    : systemManager(entityManager, componentManager) {
}

inline Entity Coordinator::createEntity() {
    return entityManager.create();
}

inline void Coordinator::destroyEntity(Entity entity) {
    // Notify systems first
    systemManager.entityDestroyed(entity);
    
    // Remove all components
    componentManager.entityDestroyed(entity);
    
    // Remove from signature cache
    entitySignatures.erase(entity);
    
    // Destroy entity
    entityManager.destroy(entity);
}

inline bool Coordinator::entityAlive(Entity entity) const {
    return entityManager.alive(entity);
}

inline size_t Coordinator::getEntityCount() const {
    return entityManager.count();
}

inline Signature Coordinator::getEntitySignature(Entity entity) const {
    auto it = entitySignatures.find(entity);
    if (it != entitySignatures.end()) {
        return it->second;
    }
    return buildEntitySignature(entity);
}

inline void Coordinator::updateEntitySignature(Entity entity) {
    Signature newSignature = buildEntitySignature(entity);
    Signature oldSignature;
    
    auto it = entitySignatures.find(entity);
    if (it != entitySignatures.end()) {
        oldSignature = it->second;
        it->second = newSignature;
    } else {
        entitySignatures[entity] = newSignature;
    }
    
    // Notify systems if signature changed
    if (newSignature.getBitset() != oldSignature.getBitset()) {
        systemManager.entitySignatureChanged(entity, newSignature);
    }
}

inline Signature Coordinator::buildEntitySignature(Entity entity) const {
    Signature signature;
    
    // Note: This is a simplified implementation.
    // In a real implementation, we would need to iterate through
    // all registered component types and check if entity has them.
    // For now, we'll rely on systems to track their own entities.
    
    return signature;
}

inline void Coordinator::clear() {
    // Clear systems first
    systemManager.clear();
    
    // Clear components
    componentManager.clear();
    
    // Clear entities
    entityManager.reset();
    
    // Clear signature cache
    entitySignatures.clear();
}

} // namespace P64::ECS