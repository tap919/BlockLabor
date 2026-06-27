/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#include <libdragon.h>
#include "collision/shapes.h"


bool P64::Coll::AABB::vsAABB(const Coll::AABB &other) const {
  return (max.v[0] >= other.min.v[0])
      && (max.v[1] >= other.min.v[1])
      && (max.v[2] >= other.min.v[2])
      && (min.v[0] <= other.max.v[0])
      && (min.v[1] <= other.max.v[1])
      && (min.v[2] <= other.max.v[2]);
}

bool P64::Coll::AABB::vsRay(const fm_vec3_t &pos, const fm_vec3_t &dir) const
{
  /*bool intersection(box b, ray r) {
    double tx1 = (b.min.x - r.x0.x)*r.n_inv.x;
    double tx2 = (b.max.x - r.x0.x)*r.n_inv.x;

    double tmin = min(tx1, tx2);
    double tmax = max(tx1, tx2);

    double ty1 = (b.min.y - r.x0.y)*r.n_inv.y;
    double ty2 = (b.max.y - r.x0.y)*r.n_inv.y;

    tmin = max(tmin, min(ty1, ty2));
    tmax = min(tmax, max(ty1, ty2));

    return tmax >= tmin;
  }*/

  constexpr float DEF_MAX_FLOAT = 10000.0f;
  auto invDir = fm_vec3_t{DEF_MAX_FLOAT, DEF_MAX_FLOAT, DEF_MAX_FLOAT};
  if(dir.x != 0)invDir.x = 1.0f / dir.x;
  if(dir.y != 0)invDir.y = 1.0f / dir.y;
  if(dir.z != 0)invDir.z = 1.0f / dir.z;
  auto vecMin = (fm_vec3_t{(float)min.v[0], (float)min.v[1], (float)min.v[2]} - pos) * invDir;
  auto vecMax = (fm_vec3_t{(float)max.v[0], (float)max.v[1], (float)max.v[2]} - pos) * invDir;

  fm_vec3_t t1{
    fminf(vecMin.v[0], vecMax.v[0]),
    fminf(vecMin.v[1], vecMax.v[1]),
    fminf(vecMin.v[2], vecMax.v[2])
  };
  fm_vec3_t t2{
    fmaxf(vecMin.v[0], vecMax.v[0]),
    fmaxf(vecMin.v[1], vecMax.v[1]),
    fmaxf(vecMin.v[2], vecMax.v[2])
  };

  float near = fmaxf(fmaxf(t1.x, t1.y), t1.z);
  float far = fminf(fminf(t2.x, t2.y), t2.z);

  return (far >= near ? (near < 0.0f ? far : near) : -1.0f) >= 0.0f;

  /*float tmin = (min.v[0] - pos.v[0]) / dir.v[0];
  float tmax = (max.v[0] - pos.v[0]) / dir.v[0];

  if(tmin > tmax)std::swap(tmin, tmax);

  float tymin = (min.v[1] - pos.v[1]) / dir.v[1];
  float tymax = (max.v[1] - pos.v[1]) / dir.v[1];

  if(tymin > tymax)std::swap(tymin, tymax);

  if((tmin > tymax) || (tymin > tmax))return false;
  if(tymin > tmin)tmin = tymin;
  if(tymax < tmax)tmax = tymax;

  float tzmin = (min.v[2] - pos.v[2]) / dir.v[2];
  float tzmax = (max.v[2] - pos.v[2]) / dir.v[2];

  if(tzmin > tzmax)std::swap(tzmin, tzmax);

  if((tmin > tzmax) || (tzmin > tmax))return false;
  if(tzmin > tmin)tmin = tzmin;
  if(tzmax < tmax)tmax = tzmax;

  return true;*/
}

bool P64::Coll::AABB::vsPoint(const IVec3 &pos) const {
  return (pos.v[0] >= min.v[0])
      && (pos.v[1] >= min.v[1])
      && (pos.v[2] >= min.v[2])
      && (pos.v[0] <= max.v[0])
      && (pos.v[1] <= max.v[1])
      && (pos.v[2] <= max.v[2]);
}
