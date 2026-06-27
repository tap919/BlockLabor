/**
 * ComponentManager.h
 * GameAnimation64 - ECS Component Management
 * 
 * Manages component storage and retrieval in the Entity Component System.
 * Uses sparse sets for cache-friendly component storage.
 */

#pragma once
#include "EntityManager.h"
#include <cstdint>
#include <vector>
#include <unordered_map>
#include <typeindex>
#include <memory>
#include <algorithm>

namespace P64::ECS {

// Forward declarations
class IComponentArray;
template<typename T> class ComponentArray;

/**
 * Interface for type-erased component arrays.
 */
class IComponentArray {
public:
    virtual ~IComponentArray() = default;
    
    /**
     * Remove component from an entity.
     * @param entity Entity to remove component from
     */
    virtual void remove(Entity entity) = 0;
    
    /**
     * Check if entity has this component type.
     * @param entity Entity to check
     * @return True if entity has component
     */
    virtual bool has(Entity entity) const = 0;
    
    /**
     * Get number of components stored.
     * @return Component count
     */
    virtual size_t size() const = 0;
    
    /**
     * Clear all components.
     */
    virtual void clear() = 0;
    
    /**
     * Get the type index of this component array.
     * @return Type index
     */
    virtual std::type_index type() const = 0;
};

/**
 * Sparse set-based component storage for a specific component type.
 * Provides O(1) insertion, removal, and lookup with cache-friendly iteration.
 */
template<typename T>
class ComponentArray : public IComponentArray {
public:
    ComponentArray() = default;
    ~ComponentArray() override = default;
    
    /**
     * Add or replace component for an entity.
     * @param entity Entity to add component to
     * @param component Component data
     */
    void insert(Entity entity, const T& component) {
        if (has(entity)) {
            // Replace existing component
            components[sparse[entity.id]] = component;
        } else {
            // Add new component
            sparse[entity.id] = static_cast<uint32_t>(components.size());
            components.push_back(component);
            entities.push_back(entity);
        }
    }
    
    /**
     * Add or replace component for an entity (move version).
     * @param entity Entity to add component to
     * @param component Component data
     */
    void insert(Entity entity, T&& component) {
        if (has(entity)) {
            // Replace existing component
            components[sparse[entity.id]] = std::move(component);
        } else {
            // Add new component
            sparse[entity.id] = static_cast<uint32_t>(components.size());
            components.push_back(std::move(component));
            entities.push_back(entity);
        }
    }
    
    /**
     * Get component for an entity.
     * @param entity Entity to get component from
     * @return Reference to component data
     * @throws std::out_of_range if entity doesn't have component
     */
    T& get(Entity entity) {
        if (!has(entity)) {
            throw std::out_of_range("Entity does not have component");
        }
        return components[sparse[entity.id]];
    }
    
    /**
     * Get component for an entity (const version).
     * @param entity Entity to get component from
     * @return Const reference to component data
     * @throws std::out_of_range if entity doesn't have component
     */
    const T& get(Entity entity) const {
        if (!has(entity)) {
            throw std::out_of_range("Entity does not have component");
        }
        return components[sparse[entity.id]];
    }
    
    /**
     * Try to get component for an entity.
     * @param entity Entity to get component from
     * @return Pointer to component or nullptr if not found
     */
    T* tryGet(Entity entity) {
        if (!has(entity)) {
            return nullptr;
        }
        return &components[sparse[entity.id]];
    }
    
    /**
     * Try to get component for an entity (const version).
     * @param entity Entity to get component from
     * @return Const pointer to component or nullptr if not found
     */
    const T* tryGet(Entity entity) const {
        if (!has(entity)) {
            return nullptr;
        }
        return &components[sparse[entity.id]];
    }
    
    /**
     * Remove component from an entity.
     * @param entity Entity to remove component from
     */
    void remove(Entity entity) override {
        if (!has(entity)) {
            return;
        }
        
        // Get index of component to remove
        uint32_t index = sparse[entity.id];
        
        // Move last component to this position
        if (index < components.size() - 1) {
            components[index] = std::move(components.back());
            entities[index] = entities.back();
            sparse[entities[index].id] = index;
        }
        
        // Remove last element
        components.pop_back();
        entities.pop_back();
        
        // Clear sparse entry
        sparse[entity.id] = std::numeric_limits<uint32_t>::max();
    }
    
    /**
     * Check if entity has this component type.
     * @param entity Entity to check
     * @return True if entity has component
     */
    bool has(Entity entity) const override {
        if (entity.id >= sparse.size()) {
            return false;
        }
        uint32_t index = sparse[entity.id];
        return index < components.size() && entities[index] == entity;
    }
    
    /**
     * Get number of components stored.
     * @return Component count
     */
    size_t size() const override {
        return components.size();
    }
    
    /**
     * Clear all components.
     */
    void clear() override {
        components.clear();
        entities.clear();
        sparse.clear();
    }
    
    /**
     * Get the type index of this component array.
     * @return Type index
     */
    std::type_index type() const override {
        return std::type_index(typeid(T));
    }
    
    /**
     * Get iterator to beginning of components.
     * @return Iterator to first component
     */
    typename std::vector<T>::iterator begin() {
        return components.begin();
    }
    
    /**
     * Get iterator to end of components.
     * @return Iterator past last component
     */
    typename std::vector<T>::iterator end() {
        return components.end();
    }
    
    /**
     * Get const iterator to beginning of components.
     * @return Const iterator to first component
     */
    typename std::vector<T>::const_iterator begin() const {
        return components.begin();
    }
    
    /**
     * Get const iterator to end of components.
     * @return Const iterator past last component
     */
    typename std::vector<T>::const_iterator end() const {
        return components.end();
    }
    
    /**
     * Get iterator to beginning of entities.
     * @return Iterator to first entity
     */
    typename std::vector<Entity>::iterator entitiesBegin() {
        return entities.begin();
    }
    
    /**
     * Get iterator to end of entities.
     * @return Iterator past last entity
     */
    typename std::vector<Entity>::iterator entitiesEnd() {
        return entities.end();
    }
    
    /**
     * Get const iterator to beginning of entities.
     * @return Const iterator to first entity
     */
    typename std::vector<Entity>::const_iterator entitiesBegin() const {
        return entities.begin();
    }
    
    /**
     * Get const iterator to end of entities.
     * @return Const iterator past last entity
     */
    typename std::vector<Entity>::const_iterator entitiesEnd() const {
        return entities.end();
    }
    
private:
    // Dense array of components (cache-friendly)
    std::vector<T> components;
    
    // Dense array of corresponding entities
    std::vector<Entity> entities;
    
    // Sparse array mapping entity ID to component index
    std::vector<uint32_t> sparse;
    
    /**
     * Ensure sparse array is large enough for entity ID.
     * @param entityId Entity ID to check
     */
    void ensureSparseSize(uint32_t entityId) {
        if (entityId >= sparse.size()) {
            sparse.resize(entityId + 1, std::numeric_limits<uint32_t>::max());
        }
    }
};

/**
 * Manages all component arrays and provides type-safe access.
 */
class ComponentManager {
public:
    ComponentManager() = default;
    ~ComponentManager() = default;
    
    /**
     * Register a component type.
     * Must be called before using a component type.
     */
    template<typename T>
    void registerComponent() {
        std::type_index type = std::type_index(typeid(T));
        
        if (componentArrays.find(type) != componentArrays.end()) {
            // Component type already registered
            return;
        }
        
        // Create new component array
        componentArrays[type] = std::make_unique<ComponentArray<T>>();
        componentTypes[typeid(T)] = nextComponentType++;
    }
    
    /**
     * Get component type ID.
     * @return Unique ID for component type
     */
    template<typename T>
    uint32_t getComponentType() {
        std::type_index type = std::type_index(typeid(T));
        auto it = componentTypes.find(type);
        if (it == componentTypes.end()) {
            throw std::runtime_error("Component type not registered");
        }
        return it->second;
    }
    
    /**
     * Add component to an entity.
     * @param entity Entity to add component to
     * @param component Component data
     */
    template<typename T>
    void addComponent(Entity entity, const T& component) {
        getComponentArray<T>()->insert(entity, component);
    }
    
    /**
     * Add component to an entity (move version).
     * @param entity Entity to add component to
     * @param component Component data
     */
    template<typename T>
    void addComponent(Entity entity, T&& component) {
        getComponentArray<T>()->insert(entity, std::move(component));
    }
    
    /**
     * Remove component from an entity.
     * @param entity Entity to remove component from
     */
    template<typename T>
    void removeComponent(Entity entity) {
        getComponentArray<T>()->remove(entity);
    }
    
    /**
     * Get component for an entity.
     * @param entity Entity to get component from
     * @return Reference to component data
     */
    template<typename T>
    T& getComponent(Entity entity) {
        return getComponentArray<T>()->get(entity);
    }
    
    /**
     * Get component for an entity (const version).
     * @param entity Entity to get component from
     * @return Const reference to component data
     */
    template<typename T>
    const T& getComponent(Entity entity) const {
        return getComponentArray<T>()->get(entity);
    }
    
    /**
     * Try to get component for an entity.
     * @param entity Entity to get component from
     * @return Pointer to component or nullptr if not found
     */
    template<typename T>
    T* tryGetComponent(Entity entity) {
        return getComponentArray<T>()->tryGet(entity);
    }
    
    /**
     * Try to get component for an entity (const version).
     * @param entity Entity to get component from
     * @return Const pointer to component or nullptr if not found
     */
    template<typename T>
    const T* tryGetComponent(Entity entity) const {
        return getComponentArray<T>()->tryGet(entity);
    }
    
    /**
     * Check if entity has component.
     * @param entity Entity to check
     * @return True if entity has component
     */
    template<typename T>
    bool hasComponent(Entity entity) const {
        auto it = componentArrays.find(std::type_index(typeid(T)));
        if (it == componentArrays.end()) {
            return false;
        }
        return it->second->has(entity);
    }
    
    /**
     * Remove all components from an entity.
     * @param entity Entity to clear components from
     */
    void entityDestroyed(Entity entity) {
        for (auto& [type, array] : componentArrays) {
            array->remove(entity);
        }
    }
    
    /**
     * Clear all components of all types.
     */
    void clear() {
        for (auto& [type, array] : componentArrays) {
            array->clear();
        }
    }
    
private:
    // Map from type index to component array
    std::unordered_map<std::type_index, std::unique_ptr<IComponentArray>> componentArrays;
    
    // Map from type index to component type ID
    std::unordered_map<std::type_index, uint32_t> componentTypes;
    
    // Next available component type ID
    uint32_t nextComponentType = 0;
    
    /**
     * Get component array for type T.
     * @return Pointer to component array
     * @throws std::runtime_error if component type not registered
     */
    template<typename T>
    ComponentArray<T>* getComponentArray() {
        std::type_index type = std::type_index(typeid(T));
        auto it = componentArrays.find(type);
        if (it == componentArrays.end()) {
            throw std::runtime_error("Component type not registered");
        }
        return static_cast<ComponentArray<T>*>(it->second.get());
    }
    
    /**
     * Get component array for type T (const version).
     * @return Const pointer to component array
     * @throws std::runtime_error if component type not registered
     */
    template<typename T>
    const ComponentArray<T>* getComponentArray() const {
        std::type_index type = std::type_index(typeid(T));
        auto it = componentArrays.find(type);
        if (it == componentArrays.end()) {
            throw std::runtime_error("Component type not registered");
        }
        return static_cast<const ComponentArray<T>*>(it->second.get());
    }
};

} // namespace P64::ECS