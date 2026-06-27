#include "globalSetup.h"
#include "renderer/deferred/DeferredRenderer.h"
#include "renderer/deferred/TestingFramework.h"

using namespace P64;

extern "C" void* createDeferredTestRunner();

void globalSetup() {
    Log::info("Deferred Pipeline Test Suite Initializing");
    
    AssetManager::loadScene("data/scenes/1_scene.json");
    
    auto testRunner = static_cast<CodeComponent*>(createDeferredTestRunner());
    if (testRunner) {
        testRunner->init();
        
        auto scene = AssetManager::getCurrentScene();
        if (scene) {
            auto testEntity = scene->createEntity("TestRunner");
            testEntity->addComponent(testRunner);
        }
    }
    
    Log::info("Deferred Pipeline Test Suite Ready");
}