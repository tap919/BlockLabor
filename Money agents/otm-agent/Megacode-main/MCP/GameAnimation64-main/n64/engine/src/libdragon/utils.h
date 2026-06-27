/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once

namespace P64::LD
{
  void init();

  /**
   * Sets new upper limit for sbrk heap.
   * @return previous top pointer
   */
  void* sbrkSetTop(void* newTop);
}