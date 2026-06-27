/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#pragma once
#include <t3d/t3dmath.h>
#include <vector>
#include <functional>

#include "scene/scene.h"

namespace Debug::Overlay
{
  void toggle();
  void init();
  void draw(P64::Scene &scene, surface_t* surf);
}
