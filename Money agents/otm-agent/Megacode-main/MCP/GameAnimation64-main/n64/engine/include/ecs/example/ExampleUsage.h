/**
 * ExampleUsage.h
 * GameAnimation64 - ECS Usage Example
 * 
 * Demonstrates how to use the Entity Component System.
 */

#pragma once
#include "../Coordinator.h"
#include "TransformComponent.h"
#include <iostream>

namespace P64::ECS {

/**
 * Example demonstrating ECS usage.
 */
class ExampleUsage {
public:
    ExampleUsage() {
        setup();
    }
    
    void run() {
        std::cout << "=== GameAnimation64 ECS Example ===\n";
        
        // Create some entities
        Entity player = createPlayer();
        Entity enemy = createEnemy();
        Entity projectile = createProjectile();
        
        std::cout << "Created " << coordinator.getEntityCount() << " entities\n";
        
        // Update systems for a few frames
        for (int i = 0; i < 5; ++i) {
            float deltaTime = 1.0f / 60.0f; // 60 FPS
            update(deltaTime);
            
            // Print entity states
            printEntityState("Player", player);
            printEntityState("Enemy", enemy);
            printEntityState("Projectile", projectile);
            std::cout << "--- Frame " << (i + 1) << " ---\n";
        }
        
        // Destroy an entity
        coordinator.destroyEntity(projectile);
        std::cout << "Destroyed projectile. Remaining entities: " 
                  << coordinator.getEntityCount() << "\n";
        
        std::cout << "=== Example Complete ===\n";
    }
    
private:
    Coordinator coordinator;
    std::shared_ptr<MovementSystem> movementSystem;
    std::shared_ptr<RenderSystem> renderSystem;
    
    void setup() {
        // Register component types
        coordinator.registerComponent<TransformComponent>();
        coordinator.registerComponent<VelocityComponent>();
        coordinator.registerComponent<RenderableComponent>();
        
        // Register systems
        movementSystem = coordinator.registerSystem<MovementSystem>();
        renderSystem = coordinator.registerSystem<RenderSystem>();
        
        // Set system signatures
        Signature movementSignature;
        movementSignature.set<TransformComponent>();
        movementSignature.set<VelocityComponent>();
        coordinator.setSystemSignature<MovementSystem>(movementSignature);
        
        Signature renderSignature;
        renderSignature.set<TransformComponent>();
        renderSignature.set<RenderableComponent>();
        coordinator.setSystemSignature<RenderSystem>(renderSignature);
        
        // Pass coordinator reference to systems
        movementSystem->setCoordinator(&coordinator);
        renderSystem->setCoordinator(&coordinator);
    }
    
    Entity createPlayer() {
        Entity entity = coordinator.createEntity();
        
        // Add transform component
        coordinator.addComponent<TransformComponent>(
            entity, 
            TransformComponent(0.0f, 0.0f, 0.0f)
        );
        
        // Add velocity component (slow movement)
        coordinator.addComponent<VelocityComponent>(
            entity,
            VelocityComponent(1.0f, 0.0f, 0.0f, 0.0f, 10.0f, 0.0f)
        );
        
        // Add renderable component
        coordinator.addComponent<RenderableComponent>(
            entity,
            RenderableComponent(1, 1, true, 0)
        );
        
        return entity;
    }
    
    Entity createEnemy() {
        Entity entity = coordinator.createEntity();
        
        // Add transform component (offset from player)
        coordinator.addComponent<TransformComponent>(
            entity,
            TransformComponent(5.0f, 0.0f, 0.0f, 0.0f, 180.0f, 0.0f)
        );
        
        // Add velocity component (facing player)
        coordinator.addComponent<VelocityComponent>(
            entity,
            VelocityComponent(-0.5f, 0.0f, 0.0f, 0.0f, -5.0f, 0.0f)
        );
        
        // Add renderable component
        coordinator.addComponent<RenderableComponent>(
            entity,
            RenderableComponent(2, 2, true, 0)
        );
        
        return entity;
    }
    
    Entity createProjectile() {
        Entity entity = coordinator.createEntity();
        
        // Add transform component (starting between player and enemy)
        coordinator.addComponent<TransformComponent>(
            entity,
            TransformComponent(2.5f, 1.0f, 0.0f)
        );
        
        // Add velocity component (fast upward movement)
        coordinator.addComponent<VelocityComponent>(
            entity,
            VelocityComponent(0.0f, 5.0f, 0.0f, 0.0f, 0.0f, 45.0f)
        );
        
        // Add renderable component (different layer)
        coordinator.addComponent<RenderableComponent>(
            entity,
            RenderableComponent(3, 3, true, 1)
        );
        
        return entity;
    }
    
    void update(float deltaTime) {
        // Update all systems
        coordinator.updateSystems(deltaTime);
    }
    
    void printEntityState(const std::string& name, Entity entity) {
        if (!coordinator.entityAlive(entity)) {
            std::cout << name << ": DESTROYED\n";
            return;
        }
        
        auto* transform = coordinator.tryGetComponent<TransformComponent>(entity);
        auto* velocity = coordinator.tryGetComponent<VelocityComponent>(entity);
        auto* renderable = coordinator.tryGetComponent<RenderableComponent>(entity);
        
        std::cout << name << ":\n";
        
        if (transform) {
            std::cout << "  Position: (" << transform->position[0] << ", " 
                      << transform->position[1] << ", " << transform->position[2] << ")\n";
            std::cout << "  Rotation: (" << transform->rotation[0] << ", " 
                      << transform->rotation[1] << ", " << transform->rotation[2] << ")\n";
        }
        
        if (velocity) {
            std::cout << "  Speed: " << velocity->getSpeed() << "\n";
        }
        
        if (renderable) {
            std::cout << "  Visible: " << (renderable->visible ? "Yes" : "No") 
                      << ", Layer: " << (int)renderable->layer << "\n";
        }
    }
};

} // namespace P64::ECS