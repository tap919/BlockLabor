/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>
#include <rspq_constants.h>

/**
 * NOTE: this is a hack to not touch libdragon for now.
 * This can break at any moment if libdragon is updated.
 */

extern "C" {
  struct rdpq_block_t;
  struct rspq_block_cb_t;

  typedef struct rspq_block_s {
    uint32_t nesting_level;     ///< Nesting level of the block
    rdpq_block_t *rdp_block;    ///< Option RDP static buffer (with RDP commands)
    rspq_block_cb_t *atexit;    ///< List of callbacks to call upon freeing the block
    uint32_t cmds[];            ///< Block contents (commands)
  } rspq_block_t;

  struct rdpq_tracking_t {
    uint32_t autosync : 17;
    bool mode_freeze : 1;
    uint8_t cycle_type_known : 2;
    uint8_t cycle_type_frozen : 2;
  };

  void __rdpq_block_run(rdpq_block_t *block);
  extern void rspq_next_buffer(void);
  extern rdpq_tracking_t rdpq_tracking;
}

namespace LD::RSPQ
{
  constexpr uint32_t RSPQ_CMD_JUMP = 0x02;
  constexpr uint32_t RSPQ_CMD_CALL = 0x03;
  constexpr uint32_t RSPQ_CMD_RET  = 0x04;

  volatile uint32_t *backupPointer;
  volatile uint32_t *backupSentinel;
  rdpq_tracking_t backupRdpTracking;

  inline void init()
  {
  }

  inline void redirectStart(volatile uint32_t *newPointer, volatile uint32_t *newSentinel)
  {
    backupPointer = rspq_cur_pointer;
    backupSentinel = rspq_cur_sentinel;
    backupRdpTracking = rdpq_tracking;

    rspq_cur_pointer = newPointer;
    rspq_cur_sentinel = newSentinel;
  }

  inline volatile uint32_t* redirectEnd()
  {
    auto end = rspq_cur_pointer;
    rspq_cur_pointer = backupPointer;
    rspq_cur_sentinel = backupSentinel;
    rdpq_tracking = backupRdpTracking;

    return end;
  }

  inline void exec(volatile uint32_t *words, volatile uint32_t *words_end)
  {
    if(words != words_end)
    {
      words_end[0] = ((RSPQ_CMD_RET)<<24) | (RSPQ_MAX_BLOCK_NESTING_LEVEL - 1);
      rspq_write(0, RSPQ_CMD_CALL, PhysicalAddr(words), (RSPQ_MAX_BLOCK_NESTING_LEVEL - 1));
      __rdpq_block_run(NULL);
    }
  }
}