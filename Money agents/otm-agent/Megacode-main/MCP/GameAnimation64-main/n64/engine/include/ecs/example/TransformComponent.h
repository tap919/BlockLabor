/**
 * TransformComponent.h
 * GameAnimation64 - Example Transform Component
 * 
 * Example component demonstrating ECS usage with transform data.
 */

#pragma once
#include "../Coordinator.h"
#include <cstdint>

namespace P64::ECS {

/**
 * Transform component for entity position, rotation, and scale.
 */
struct TransformComponent {
    float position[3] = {0.0f, 0.0f, 0.0f};
    float rotation[3] = {0.0f, 0.0f, 0.0f}; // Euler angles in degrees
    float scale[3] = {1.0f, 1.0f, 1.0f};
    
    TransformComponent() = default;
    
    TransformComponent(float x, float y, float z)
        : position{x, y, z} {}
    
    TransformComponent(float x, float y, float z, float rx, float ry, float rz)
        : position{x, y, z}, rotation{rx, ry, rz} {}
    
    TransformComponent(float x, float y, float z, float rx, float ry, float rz, float sx, float sy, float sz)
        : position{x, y, z}, rotation{rx, ry, rz}, scale{sx, sy, sz} {}
    
    void translate(float dx, float dy, float dz) {
        position[0] += dx;
        position[1] += dy;
        position[2] += dz;
    }
    
    void rotate(float dx, float dy, float dz) {
        rotation[0] += dx;
        rotation[1] += dy;
        rotation[2] += dz;
        
        // Normalize angles
        rotation[0] = fmodf(rotation[0], 360.0f);
        rotation[1] = fmodf(rotation[1], 360.0f);
        rotation[2] = fmodf(rotation[2], 360.0f);
    }
    
    void setPosition(float x, float y, float z) {
        position[0] = x;
        position[1] = y;
        position[2] = z;
    }
    
    void setRotation(float rx, float ry, float rz) {
        rotation[0] = rx;
        rotation[1] = ry;
        rotation[2] = rz;
    }
    
    void setScale(float sx, float sy, float sz) {
        scale[0] = sx;
        scale[1] = sy;
        scale[2] = sz;
    }
};

/**
 * Velocity component for entity movement.
 */
struct VelocityComponent {
    float linear[3] = {0.0f, 0.0f, 0.0f};  // Linear velocity
    float angular[3] = {0.0f, 0.0f, 0.0f}; // Angular velocity (degrees per second)
    
    VelocityComponent() = default;
    
    VelocityComponent(float vx, float vy, float vz)
        : linear{vx, vy, vz} {}
    
    VelocityComponent(float vx, float vy, float vz, float avx, float avy, float avz)
        : linear{vx, vy, vz}, angular{avx, avy, avz} {}
    
    void setLinear(float vx, float vy, float vz) {
        linear[0] = vx;
        linear[1] = vy;
        linear[2] = vz;
    }
    
    void setAngular(float avx, float avy, float avz) {
        angular[0] = avx;
        angular[1] = avy;
        angular[2] = avz;
    }
    
    float getSpeed() const {
        return sqrtf(linear[0] * linear[0] + 
                     linear[1] * linear[1] + 
                     linear[2] * linear[2]);
    }
};

/**
 * Renderable component for entities that should be rendered.
 */
struct RenderableComponent {
    uint32_t meshId = 0;      // Mesh asset ID
    uint32_t materialId = 0;  // Material asset ID
    bool visible = true;      // Visibility flag
    uint8_t layer = 0;        // Render layer (0-31)
    
    RenderableComponent() = default;
    
    RenderableComponent(uint32_t mesh, uint32_t material)
        : meshId(mesh), materialId(material) {}
    
    RenderableComponent(uint32_t mesh, uint32_t material, bool visible, uint8_t layer)
        : meshId(mesh), materialId(material), visible(visible), layer(layer) {}
};

/**
 * Example system that updates entity transforms based on velocity.
 */
class MovementSystem : public System<TransformComponent, VelocityComponent> {
public:
    MovementSystem() {
        // Set system signature
        signature.set<TransformComponent>();
        signature.set<VelocityComponent>();
    }
    
    void update(float deltaTime) override {
        for (Entity entity : entities) {
            auto* transform = coordinator->tryGetComponent<TransformComponent>(entity);
            auto* velocity = coordinator->tryGetComponent<VelocityComponent>(entity);
            
            if (transform && velocity) {
                // Update position based on linear velocity
                transform->translate(
                    velocity->linear[0] * deltaTime,
                    velocity->linear[1] * deltaTime,
                    velocity->linear[2] * deltaTime
                );
                
                // Update rotation based on angular velocity
                transform->rotate(
                    velocity->angular[0] * deltaTime,
                    velocity->angular[1] * deltaTime,
                    velocity->angular[2] * deltaTime
                );
            }
        }
    }
    
    void setCoordinator(Coordinator* coord) {
        coordinator = coord;
    }
    
private:
    Coordinator* coordinator = nullptr;
};

/**
 * Example system that renders entities with transform and renderable components.
 */
class RenderSystem : public System<TransformComponent, RenderableComponent> {
public:
    RenderSystem() {
        // Set system signature
        signature.set<TransformComponent>();
        signature.set<RenderableComponent>();
    }
    
    void update(float deltaTime) override {
        // In a real implementation, this would queue render commands
        // based on entity transforms and renderable properties
        
        for (Entity entity : entities) {
            auto* transform = coordinator->tryGetComponent<TransformComponent>(entity);
            auto* renderable = coordinator->tryGetComponent<RenderableComponent>(entity);
            
            if (transform && renderable && renderable->visible) {
                // Queue render command
                // renderQueue.push({entity, *transform, *renderable});
            }
        }
    }
    
    void setCoordinator(Coordinator* coord) {
        coordinator = coord;
    }
    
private:
    Coordinator* coordinator = nullptr;
};

} // namespace P64::ECS