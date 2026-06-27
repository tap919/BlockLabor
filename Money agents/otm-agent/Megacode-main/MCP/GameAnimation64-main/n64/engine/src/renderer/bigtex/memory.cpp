/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#include "memory.h"
#include "../../libdragon/utils.h"

namespace {
  heap_stats_t heap_stats{};
  surface_t zBuffer{};
  void* oldSbrkTop{0};
}

namespace P64::Renderer::BigTex
{
  surface_t *getZBuffer() {
    assert(zBuffer.buffer);
    return &zBuffer;
  }

  void freeBuffers(FrameBuffers &fbs)
  {
    surface_free(&zBuffer);
    zBuffer = {};
    for(auto &fb : fbs.uv) {
      surface_free(&fb);
      fb = {};
    }

    LD::sbrkSetTop(oldSbrkTop);
  }

  FrameBuffers allocBuffers() {
    if(is_memory_expanded()) { // With 8MB, we reserve the upper 4MB (excl. the stack) for the frame-buffers
      // first limit the upper heap to match against the start of our first buffer
      oldSbrkTop = LD::sbrkSetTop((void*)FB_BANK_ADDR[0]);
      //debugf("sbrk_top: %p -> %p\n", oldSbrkTop, oldSbrkTop);

      zBuffer = surface_make(UncachedAddr(FB_BANK_ADDR[4]), FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH*2);
      return {
        .color = {
          surface_make(UncachedAddr(FB_BANK_ADDR[1]), FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH*2),
          surface_make(UncachedAddr(FB_BANK_ADDR[2]), FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH*2),
          surface_make(UncachedAddr(FB_BANK_ADDR[3]), FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH*2),
        },
        .uv = {
          surface_alloc(FMT_RGBA32, SCREEN_WIDTH, SCREEN_HEIGHT),
          surface_alloc(FMT_RGBA32, SCREEN_WIDTH, SCREEN_HEIGHT),
          surface_alloc(FMT_RGBA32, SCREEN_WIDTH, SCREEN_HEIGHT),
        },
        /*.shade = {
          surface_alloc(FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT),
          surface_alloc(FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT),
          surface_alloc(FMT_RGBA16, SCREEN_WIDTH, SCREEN_HEIGHT),
        },*/
        .depth = &zBuffer
      };
    } else {
      assertf(false, "Expansion-Pack required!");
    }
  }
}