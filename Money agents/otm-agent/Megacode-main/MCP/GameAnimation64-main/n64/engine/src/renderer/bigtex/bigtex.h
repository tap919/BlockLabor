/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>
#include <t3d/t3dmodel.h>

namespace P64::Renderer::BigTex {
  constexpr uint32_t TEX_BASE_ADDR = 0x8040'0000;
  static_assert((TEX_BASE_ADDR & 0x000F'FFFF) == 0, "Low 20bits must be zero");

  void patchT3DM(T3DModel &model);

  void applyTexturesUV(uint64_t *fbTexIn, uint16_t *buffOut, uint32_t buffSize);
  void applyTexturesMat(uint64_t *fbTexIn, uint16_t *buffOut, uint32_t buffSize);

  void ucodeInit();
  void ucodeDestroy();
  void ucodeFillTextures(uint32_t fbTex, uint32_t fbTexEnd, uint32_t fbOut);
}