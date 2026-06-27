/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>

namespace P64::Renderer::BigTex
{
  constexpr uint32_t SCREEN_WIDTH = 320;
  constexpr uint32_t SCREEN_HEIGHT = 240;

  constexpr uint32_t FB_BYTE_SIZE = SCREEN_WIDTH * SCREEN_HEIGHT * 2;
  constexpr uint32_t FB_BANK_ADDR[5] = {
    //0x80500000 - FB_BYTE_SIZE,
    0x80500000,
    0x80600000 - FB_BYTE_SIZE, 0x80600000,
    0x80700000 - FB_BYTE_SIZE, 0x80700000,
  };

  struct FrameBuffers {
    surface_t color[3]{};
    surface_t uv[3]{};
    surface_t shade[3]{};
    surface_t *depth{};
  };

  surface_t* getZBuffer();
  FrameBuffers allocBuffers();
  void freeBuffers(FrameBuffers &fbs);
}