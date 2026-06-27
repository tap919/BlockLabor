# GameAnimation64 - Major Upgrade Architecture

## 1. Core Engine Architecture

### 1.1 Entity Component System (ECS)
```c++
// New ECS core in: n64/engine/include/ecs/
// - EntityManager.h/.cpp - Entity ID management
// - ComponentManager.h/.cpp - Component storage
// - SystemManager.h/.cpp - System execution
// - Archetype.h/.cpp - Memory layout optimization

class EntityManager {
    uint32_t nextEntityId = 1;
    std::vector<uint32_t> freeList;
    
    uint32_t create();
    void destroy(uint32_t entity);
    bool alive(uint32_t entity);
};

template<typename T>
class ComponentManager {
    SparseSet<uint32_t, T> components;
    // Fast iteration, cache-friendly
};

class SystemManager {
    std::vector<std::unique_ptr<ISystem>> systems;
    void update(float deltaTime);
};
```

### 1.2 Memory Management System
```c++
// n64/engine/include/memory/
// - BuddyAllocator.h/.cpp - Power-of-two allocations
// - PoolAllocator.h/.cpp - Fixed-size allocations
// - StackAllocator.h/.cpp - Frame-based allocations
// - MemoryArena.h/.cpp - Region-based allocations

class MemoryManager {
    struct MemoryRegion {
        void* start;
        size_t size;
        MemoryAllocator* allocator;
    };
    
    std::array<MemoryRegion, 8> regions;
    
    void* allocate(size_t size, size_t alignment);
    void free(void* ptr);
    void defragment();
};
```

### 1.3 Job System for RSP Parallelization
```c++
// n64/engine/include/jobs/
// - JobSystem.h/.cpp - Task scheduling
// - RSPJob.h/.cpp - RSP-specific tasks
// - Fiber.h/.cpp - Lightweight threading

class JobSystem {
    struct Job {
        void (*function)(void*);
        void* data;
        Job* parent;
        std::atomic<int> unfinishedJobs;
    };
    
    void schedule(Job* job);
    void wait(Job* job);
};

class RSPJobSystem : public JobSystem {
    // Uses RSP DMA and microcode for parallel processing
    void dispatchRSPTask(RSPTask task);
};
```

## 2. Graphics Pipeline Overhaul

### 2.1 Deferred Rendering Pipeline
```c++
// n64/engine/include/renderer/deferred/
// - GBuffer.h/.cpp - Geometry buffer management
// - LightPass.h/.cpp - Lighting calculations
// - PostProcess.h/.cpp - Post-processing effects

class DeferredRenderer {
    GBuffer gBuffer;
    std::vector<Light> lights;
    
    void renderGeometry();
    void renderLights();
    void applyPostProcess();
};
```

### 2.2 Particle System
```c++
// n64/engine/include/particles/
// - ParticleEmitter.h/.cpp - Particle spawning
// - ParticleUpdater.h/.cpp - Particle simulation
// - ParticleRenderer.h/.cpp - Particle rendering

class ParticleSystem {
    struct Particle {
        Vec3 position;
        Vec3 velocity;
        Vec4 color;
        float size;
        float lifetime;
        float age;
    };
    
    std::vector<Particle> particles;
    void update(float deltaTime);
    void render();
};
```

### 2.3 Dynamic Lighting System
```c++
// n64/engine/include/lighting/
// - LightManager.h/.cpp - Light management
// - ShadowMapper.h/.cpp - Shadow mapping
// - LightProbe.h/.cpp - Global illumination

class LightManager {
    struct Light {
        Vec3 position;
        Vec3 color;
        float intensity;
        float radius;
        LightType type;
    };
    
    std::vector<Light> lights;
    ShadowMap shadowMap;
    
    void updateLight(LightIndex index, const Light& light);
    void renderShadows();
};
```

## 3. Animation System Upgrade

### 3.1 Skeletal Animation
```c++
// n64/engine/include/animation/
// - Skeleton.h/.cpp - Bone hierarchy
// - AnimationClip.h/.cpp - Animation data
// - Animator.h/.cpp - Animation playback
// - Skin.h/.cpp - Mesh skinning

class Skeleton {
    struct Bone {
        std::string name;
        Mat4 bindPose;
        Mat4 inverseBindPose;
        int parent;
        std::vector<int> children;
    };
    
    std::vector<Bone> bones;
    Mat4 getBoneTransform(int boneIndex);
};

class Animator {
    std::map<std::string, AnimationClip> clips;
    AnimationState currentState;
    
    void play(const std::string& clipName);
    void update(float deltaTime);
    void apply(Skeleton& skeleton);
};
```

### 3.2 Physics Engine Integration
```c++
// n64/engine/include/physics/
// - RigidBody.h/.cpp - Physics bodies
// - CollisionSolver.h/.cpp - Collision resolution
// - Constraint.h/.cpp - Physics constraints

class PhysicsWorld {
    std::vector<RigidBody> bodies;
    std::vector<Constraint> constraints;
    
    void step(float deltaTime);
    void addBody(const RigidBody& body);
    void removeBody(uint32_t bodyId);
};
```

## 4. Asset Pipeline Improvements

### 4.1 Asset Compression
```c++
// n64/engine/include/assets/compression/
// - TextureCompressor.h/.cpp - Texture compression
// - MeshCompressor.h/.cpp - Mesh compression
// - AnimationCompressor.h/.cpp - Animation compression

class AssetCompressor {
    enum CompressionType {
        NONE = 0,
        LZ4 = 1,
        ZSTD = 2,
        BC1 = 3,  // Texture compression
        BC4 = 4   // Normal map compression
    };
    
    CompressedData compress(const void* data, size_t size, CompressionType type);
    void* decompress(const CompressedData& compressed);
};
```

### 4.2 Streaming System
```c++
// n64/engine/include/assets/streaming/
// - StreamManager.h/.cpp - Asset streaming
// - PriorityQueue.h/.cpp - Streaming priorities
// - Cache.h/.cpp - Asset caching

class StreamManager {
    struct StreamingRequest {
        AssetId assetId;
        Priority priority;
        Callback callback;
    };
    
    std::priority_queue<StreamingRequest> queue;
    std::thread streamingThread;
    
    void requestAsset(AssetId id, Priority priority, Callback callback);
    void update();
};
```

## 5. Development Tools

### 5.1 Hot Reload System
```c++
// n64/engine/include/tools/hotreload/
// - HotReloadManager.h/.cpp - Hot reload management
// - PatchApplicator.h/.cpp - Code patching
// - SymbolResolver.h/.cpp - Symbol resolution

class HotReloadManager {
    struct Patch {
        void* address;
        std::vector<uint8_t> oldCode;
        std::vector<uint8_t> newCode;
    };
    
    std::vector<Patch> patches;
    
    void applyPatch(const Patch& patch);
    void revertPatch(const Patch& patch);
    void reloadLibrary(const std::string& path);
};
```

### 5.2 Profiling System
```c++
// n64/engine/include/tools/profiling/
// - Profiler.h/.cpp - Performance profiling
// - GPUProfiler.h/.cpp - GPU timing
// - MemoryProfiler.h/.cpp - Memory tracking

class Profiler {
    struct ProfileScope {
        const char* name;
        uint64_t startTime;
        uint64_t endTime;
    };
    
    std::vector<ProfileScope> frames[60];
    int currentFrame = 0;
    
    void beginScope(const char* name);
    void endScope();
    void drawOverlay();
};
```

## 6. File Structure Changes

```
n64/engine/
├── include/
│   ├── core/           # ECS, memory, jobs
│   ├── graphics/       # Rendering, lighting, particles
│   ├── animation/      # Skeletal animation, physics
│   ├── audio/          # Spatial audio, mixing
│   ├── assets/         # Compression, streaming
│   ├── scripting/      # Lua integration
│   └── tools/          # Profiling, hot reload
├── src/
│   └── (same structure as include)
└── thirdparty/
    ├── entt/           # ECS library
    ├── jobsystem/      # Task system
    └── physics/        # Bullet physics integration
```

## 7. Performance Targets

### Memory Usage:
- **Static memory**: 2MB (engine code, static data)
- **Dynamic memory**: 2MB (ECS, temporary allocations)
- **Asset memory**: 4MB (textures, meshes, sounds)
- **Total**: 8MB (full RDRAM utilization)

### Frame Budget (60 FPS = 16.6ms):
- **Input**: 0.5ms
- **Logic**: 4ms
- **Animation**: 2ms
- **Physics**: 3ms
- **Rendering**: 7ms
- **Total**: 16.5ms (99% utilization)

### Triangle Budget:
- **Background**: 500 triangles
- **Characters**: 300 triangles each (max 4)
- **Effects**: 200 triangles
- **UI**: 100 triangles
- **Total**: 2000 triangles/frame

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
1. Implement ECS architecture
2. Add memory management system
3. Create job system for RSP
4. Basic profiling tools

### Phase 2: Graphics (Weeks 5-10)
1. Deferred rendering pipeline
2. Particle system
3. Dynamic lighting
4. Post-processing effects

### Phase 3: Animation & Physics (Weeks 11-14)
1. Skeletal animation system
2. Physics engine integration
3. Inverse kinematics
4. Cloth simulation

### Phase 4: Tools & Polish (Weeks 15-16)
1. Hot reload system
2. Advanced profiling
3. Asset streaming
4. Optimization pass

## 9. Risk Mitigation

### Technical Risks:
1. **RSP parallelization complexity** - Start with simple tasks, profile extensively
2. **Memory fragmentation** - Use pool allocators, implement defragmentation
3. **Performance regression** - Maintain benchmarks, regression testing

### Schedule Risks:
1. **Feature creep** - Strict scope control, MVP first approach
2. **Integration issues** - Weekly integration testing
3. **Hardware limitations** - Continuous N64 hardware testing

### Quality Risks:
1. **Stability issues** - Automated testing, crash reporting
2. **Compatibility problems** - Test on multiple emulators and real hardware
3. **Asset pipeline breaks** - Versioned asset formats, migration tools

## 10. Success Criteria

### Must Have:
1. 60 FPS stable performance
2. 2x triangle budget increase
3. Hot reload under 1 second
4. Zero memory leaks

### Should Have:
1. Skeletal animation support
2. Particle system
3. Dynamic lighting
4. Physics integration

### Nice to Have:
1. Real-time GI with light probes
2. GPU skinning
3. Network multiplayer
4. VR support (experimental)

This architecture will transform GameAnimation64 into a modern, high-performance game engine capable of producing commercial-quality N64 games.