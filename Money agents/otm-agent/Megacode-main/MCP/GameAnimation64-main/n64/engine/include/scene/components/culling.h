/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once
#include "scene/object.h"

namespace P64::Comp
{
  struct Culling
  {
    static constexpr uint32_t ID = 8;

    fm_vec3_t halfExtend{};
    fm_vec3_t offset{};
    uint8_t type;

    static uint32_t getAllocSize([[maybe_unused]] uint16_t* initData)
    {
      return sizeof(Culling);
    }

    static void initDelete([[maybe_unused]] Object& obj, Culling* data, void* initData);

    static void update([[maybe_unused]] Object& obj, Culling* data, float deltaTime)
    {}

    static void draw([[maybe_unused]] Object& obj, Culling* data, float deltaTime);
  };
}
