// precision lowp float;
attribute vec3 position;
attribute float direction; 
attribute vec3 next;
attribute vec3 previous;

uniform mat4 modelView;
uniform mat4 projection;
uniform float aspect;

uniform float thickness;
uniform int miter;

varying lowp vec4 vColor;
// varying lowp vec3 vOffset;

void main() {
  vec2 aspectVec = vec2(aspect, 1.0);
  mat4 projViewModel = projection * modelView;
  float len = thickness;
  float orientation = direction;

  //starting point uses (next - current)
  vec3 dir = vec3(0.0);
  if (position == previous) {
    dir = normalize(next - position);
  } 
  //ending point uses (current - previous)
  else if (position == next) {
    dir = normalize(position - previous);
  }
  //somewhere in middle, needs a join
  else {
    //get directions from (C - B) and (B - A)
    vec3 dirA = normalize((position - previous));
    if (miter == 1) {
      vec3 dirB = normalize((next - position));
      //now compute the miter join normal and length
      vec3 tangent = normalize(dirA + dirB);
      vec3 perp = vec3(-dirA.y, dirA.x, dirA.z);
      vec3 miter = vec3(-tangent.y, tangent.x, tangent.z);
      dir = tangent;
      len = min(thickness / dot(miter, perp), 50.);
    } else {
      dir = dirA;
    }
  }
  vec3 normal = vec3(-dir.y, dir.x, dir.z);
  normal *= len/2.0;

  vec3 offset = normal * orientation;
  gl_Position = projViewModel * vec4((position + offset), 1.0);
  gl_PointSize = 1.0;

  // vOffset = offset;
  vColor = vec4(1.0, 1.0, 1.0, 1.0);
}