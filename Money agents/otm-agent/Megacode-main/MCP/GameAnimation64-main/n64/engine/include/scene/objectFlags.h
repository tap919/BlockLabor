/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <cstdint>

/**
 * Object flags used in the flag mask in P64::Object.
 */
namespace P64::ObjectFlags
{
  constexpr uint16_t SELF_ACTIVE    = 1 << 0; // if true, object will be updated this frame
  constexpr uint16_t PARENTS_ACTIVE = 1 << 1; // true if all parent(s) are active, used to determine final active state
  constexpr uint16_t HAS_CHILDREN   = 1 << 2; // true if object has children (aka other objects list this as their parent ID)
  constexpr uint16_t PENDING_REMOVE = 1 << 4; // flagged for removal at the end of the frame
  constexpr uint16_t IS_CULLED      = 1 << 5; // if true, object is not drawn this frame (usually set by culling logic)

  constexpr uint16_t ACTIVE = SELF_ACTIVE | PARENTS_ACTIVE;
}