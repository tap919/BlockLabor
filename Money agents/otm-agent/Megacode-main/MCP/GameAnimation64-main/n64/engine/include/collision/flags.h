/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <cstdint>

namespace P64::Coll
{
  namespace TriType {
    constexpr uint8_t FLOOR = 1 << 0;
    constexpr uint8_t WALL  = 1 << 1;
    constexpr uint8_t CEIL  = 1 << 2;
    constexpr uint8_t BCS   = 1 << 3;
  }

  namespace BCSFlags {
    constexpr uint8_t SHAPE_BOX      = 1 << 0;
    constexpr uint8_t SHAPE_CYLINDER = 1 << 1; // @TODO

    constexpr uint8_t TRIGGER   = 1 << 2;
    constexpr uint8_t BOUNCY    = 1 << 3;
    constexpr uint8_t FIXED_XYZ = 1 << 4;
  }
}
