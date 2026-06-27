/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>

#include "scene/scene.h"

namespace P64::Renderer
{
  struct Material
  {
    constexpr static uint16_t MASK_DEPTH  = 1 << 0;
    constexpr static uint16_t MASK_PRIM   = 1 << 1;
    constexpr static uint16_t MASK_ENV    = 1 << 2;
    constexpr static uint16_t MASK_LIGHT  = 1 << 3;

    uint16_t setMask{};
    uint8_t fresnel{};
    uint8_t valFlags{};
    color_t colorPrim{};
    color_t colorEnv{};
    color_t colorFresnel{};

    [[nodiscard]] constexpr bool doesAnything() const {
      return setMask != 0;
    }

    constexpr uint16_t getDepthRead() const {
      return valFlags & 0b01;
    }

    constexpr uint16_t getDepthWrite() const {
      return valFlags & 0b10;
    }

    void begin(Object &obj);

    void end();
  };
}
