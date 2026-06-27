/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "scene/object.h"
#include "scene/components/nodeGraph.h"

#include "assets/assetManager.h"

namespace
{
  struct InitData
  {
    uint16_t assetIdx;
    uint8_t autoRun;
    uint8_t repeatable;
  };
}

namespace P64::Comp
{
  void NodeGraph::initDelete(Object &obj, NodeGraph* data, uint16_t* initData_)
  {
    auto initData = (InitData*)initData_;
    if (initData == nullptr) {
      data->~NodeGraph();
      return;
    }

    new(data) NodeGraph();
    data->inst.load(initData->assetIdx);
    data->inst.object = &obj;
    data->inst.repeatable = initData->repeatable != 0;
    data->doUpdate = initData->autoRun != 0;
  }
}
