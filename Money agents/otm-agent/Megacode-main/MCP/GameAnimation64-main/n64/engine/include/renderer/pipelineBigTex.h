/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>
#include "pipeline.h"
#include "bigtex/textures.h"
#include "bigtex/uvTexture.h"

namespace P64
{
  class RenderPipelineBigTex final : public RenderPipeline
  {
    public:
      constexpr static uint32_t DRAW_MODE_DEF = 0;
      constexpr static uint32_t DRAW_MODE_UV  = 1;
      constexpr static uint32_t DRAW_MODE_MAT = 2;

      Renderer::BigTex::Textures textures{18};
      Renderer::BigTex::UVTexture uvTex{};
      uint32_t drawMode{DRAW_MODE_DEF};

      using RenderPipeline::RenderPipeline;
      ~RenderPipelineBigTex() override;

      void init() override;
      void preDraw() override;
      void draw() override;
  };
}
