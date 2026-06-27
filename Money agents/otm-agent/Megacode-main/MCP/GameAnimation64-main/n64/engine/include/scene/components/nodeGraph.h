/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include "scene/object.h"
#include "script/nodeGraph.h"

namespace P64::Comp
{
  struct NodeGraph
  {
    static constexpr uint32_t ID = 9;

    private:
      P64::NodeGraph::Instance inst{};
      uint8_t doUpdate{};

    public:
      bool run(uint32_t arg0 = 0, uint32_t arg1 = 0)
      {
        inst.args[0] = arg0;
        inst.args[1] = arg1;
        auto oldState = !doUpdate;
        doUpdate = true;
        return oldState == false;
      }

      [[nodiscard]] bool isRunning() const { return doUpdate != 0; }

      void enable() { doUpdate = true; }
      void disable() { doUpdate = false; }

    static uint32_t getAllocSize([[maybe_unused]] void* initData)
    {
      return sizeof(NodeGraph);
    }

    static void initDelete([[maybe_unused]] Object& obj, NodeGraph* data, uint16_t* initData);

    static void update(Object& obj, NodeGraph* data, float deltaTime) {
      if(data->doUpdate) {
        if(!data->inst.update(deltaTime)) {
          data->doUpdate = false;
        }
      }
    }
  };
}