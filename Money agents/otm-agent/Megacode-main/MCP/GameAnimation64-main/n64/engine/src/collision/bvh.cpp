/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#include "collision/bvh.h"
// #include "../debug/debugDraw.h"

namespace {
  const int16_t *ctxData;
  const P64::Coll::AABB *ctxAABB;
  const fm_vec3_t *ctxRayPos;
  const fm_vec3_t *ctxRayDir;
  P64::Coll::BVHResult *ctxRes;

  void queryNodeAABB(const P64::Coll::BVHNode *node)
  {
    if(!node->aabb.vsAABB(*ctxAABB))return;

    int dataCount = node->value & 0b1111;
    int offset = (int16_t)node->value >> 4;

    if(dataCount == 0) {
      queryNodeAABB(&node[offset]);
      queryNodeAABB(&node[offset + 1]);
      return;
    }

    int offsetEnd = offset + dataCount;
    while(offset < offsetEnd && ctxRes->count < P64::Coll::MAX_RESULT_COUNT) {
      ctxRes->triIndex[ctxRes->count++] = ctxData[offset++];
    }
  }

  void queryNodeRaycast(const P64::Coll::BVHNode *node)
  {
    if(!node->aabb.vsRay(*ctxRayPos, *ctxRayDir))return;

    int dataCount = node->value & 0b1111;
    int offset = (int16_t)node->value >> 4;

    if(dataCount == 0) {
      queryNodeRaycast(&node[offset]);
      queryNodeRaycast(&node[offset + 1]);
      return;
    }

    int offsetEnd = offset + dataCount;
    while(offset < offsetEnd && ctxRes->count < P64::Coll::MAX_RESULT_COUNT) {
      ctxRes->triIndex[ctxRes->count++] = ctxData[offset++];
    }
  }
}

void P64::Coll::BVH::vsAABB(const AABB &aabb, BVHResult &res) const {
  ctxData = (int16_t*)&nodes[nodeCount]; // data starts right after nodes;
  ctxAABB = &aabb;
  ctxRes = &res;
  queryNodeAABB(nodes);
}

void P64::Coll::BVH::raycast(const fm_vec3_t &pos, const fm_vec3_t &dir, BVHResult &res) const {
  ctxData = (int16_t*)&nodes[nodeCount]; // data starts right after nodes;
  ctxRayPos = &pos;
  ctxRayDir = &dir;
  ctxRes = &res;
  queryNodeRaycast(nodes);
}


