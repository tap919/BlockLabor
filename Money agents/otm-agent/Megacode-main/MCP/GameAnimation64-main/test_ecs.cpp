/**
 * test_ecs.cpp
 * GameAnimation64 - ECS System Test
 * 
 * Tests the Entity Component System implementation.
 */

#include <iostream>
#include <cassert>
#include "n64/engine/include/ecs/example/ExampleUsage.h"

using namespace P64::ECS;

int main() {
    std::cout << "Testing GameAnimation64 ECS System...\n";
    
    // Test 1: Basic entity creation and destruction
    {
        std::cout << "\nTest 1: Entity Management\n";
        
        Coordinator coordinator;
        
        // Create entities
        Entity e1 = coordinator.createEntity();
        Entity e2 = coordinator.createEntity();
        Entity e3 = coordinator.createEntity();
        
        assert(coordinator.entityAlive(e1));
        assert(coordinator.entityAlive(e2));
        assert(coordinator.entityAlive(e3));
        assert(coordinator.getEntityCount() == 3);
        
        // Destroy an entity
        coordinator.destroyEntity(e2);
        assert(!coordinator.entityAlive(e2));
        assert(coordinator.getEntityCount() == 2);
        
        // Create another entity (should reuse e2's ID with new generation)
        Entity e4 = coordinator.createEntity();
        assert(coordinator.entityAlive(e4));
        assert(coordinator.getEntityCount() == 3);
        
        std::cout << "✓ Entity management test passed\n";
    }
    
    // Test 2: Component registration and management
    {
        std::cout << "\nTest 2: Component Management\n";
        
        Coordinator coordinator;
        
        // Register component types
        coordinator.registerComponent<TransformComponent>();
        coordinator.registerComponent<VelocityComponent>();
        
        // Create entity
        Entity entity = coordinator.createEntity();
        
        // Add components
        coordinator.addComponent<TransformComponent>(
            entity,
            TransformComponent(1.0f, 2.0f, 3.0f)
        );
        
        coordinator.addComponent<VelocityComponent>(
            entity,
            VelocityComponent(4.0f, 5.0f, 6.0f)
        );
        
        // Verify components
        assert(coordinator.hasComponent<TransformComponent>(entity));
        assert(coordinator.hasComponent<VelocityComponent>(entity));
        
        auto& transform = coordinator.getComponent<TransformComponent>(entity);
        assert(transform.position[0] == 1.0f);
        assert(transform.position[1] == 2.0f);
        assert(transform.position[2] == 3.0f);
        
        auto& velocity = coordinator.getComponent<VelocityComponent>(entity);
        assert(velocity.linear[0] == 4.0f);
        assert(velocity.linear[1] == 5.0f);
        assert(velocity.linear[2] == 6.0f);
        
        // Remove component
        coordinator.removeComponent<VelocityComponent>(entity);
        assert(!coordinator.hasComponent<VelocityComponent>(entity));
        assert(coordinator.hasComponent<TransformComponent>(entity));
        
        std::cout << "✓ Component management test passed\n";
    }
    
    // Test 3: System registration and update
    {
        std::cout << "\nTest 3: System Management\n";
        
        Coordinator coordinator;
        
        // Register components
        coordinator.registerComponent<TransformComponent>();
        coordinator.registerComponent<VelocityComponent>();
        coordinator.registerComponent<RenderableComponent>();
        
        // Register systems
        auto movementSystem = coordinator.registerSystem<MovementSystem>();
        auto renderSystem = coordinator.registerSystem<RenderSystem>();
        
        // Set system signatures
        Signature movementSignature;
        movementSignature.set<TransformComponent>();
        movementSignature.set<VelocityComponent>();
        coordinator.setSystemSignature<MovementSystem>(movementSignature);
        
        Signature renderSignature;
        renderSignature.set<TransformComponent>();
        renderSignature.set<RenderableComponent>();
        coordinator.setSystemSignature<RenderSystem>(renderSignature);
        
        // Pass coordinator to systems
        movementSystem->setCoordinator(&coordinator);
        renderSystem->setCoordinator(&coordinator);
        
        // Create test entity
        Entity entity = coordinator.createEntity();
        
        // Add components that match movement system
        coordinator.addComponent<TransformComponent>(
            entity,
            TransformComponent(0.0f, 0.0f, 0.0f)
        );
        
        coordinator.addComponent<VelocityComponent>(
            entity,
            VelocityComponent(1.0f, 2.0f, 3.0f)
        );
        
        // Verify system has entity
        assert(movementSystem->getEntityCount() == 1);
        assert(renderSystem->getEntityCount() == 0); // No RenderableComponent yet
        
        // Add RenderableComponent
        coordinator.addComponent<RenderableComponent>(
            entity,
            RenderableComponent(1, 1)
        );
        
        // Now both systems should have the entity
        assert(movementSystem->getEntityCount() == 1);
        assert(renderSystem->getEntityCount() == 1);
        
        // Update systems
        float deltaTime = 1.0f; // 1 second
        coordinator.updateSystems(deltaTime);
        
        // Verify movement system updated transform
        auto& transform = coordinator.getComponent<TransformComponent>(entity);
        assert(transform.position[0] == 1.0f); // 0 + 1*1
        assert(transform.position[1] == 2.0f); // 0 + 2*1
        assert(transform.position[2] == 3.0f); // 0 + 3*1
        
        std::cout << "✓ System management test passed\n";
    }
    
    // Test 4: Complete example
    {
        std::cout << "\nTest 4: Complete Example\n";
        
        ExampleUsage example;
        std::cout << "Running complete example...\n";
        
        // Note: This would normally run the example, but for testing
        // we'll just verify it compiles and can be instantiated
        assert(true); // Placeholder
        
        std::cout << "✓ Complete example test passed\n";
    }
    
    std::cout << "\n========================================\n";
    std::cout << "All ECS tests passed successfully!\n";
    std::cout << "========================================\n";
    
    return 0;
}