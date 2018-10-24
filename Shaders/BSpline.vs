attribute float t;
attribute float direction; 

uniform mat4 modelView;
uniform mat4 projection;
uniform float aspect;

uniform float thickness;
uniform int miter;

uniform int uNumControlPoints;

uniform int degree; // degree of the curve
uniform int knot_index; // index of knot interval that contains x
uniform lowp vec3 uControlPoints[100];
uniform highp float uKnotVector[100];

uniform float tMin;
uniform float tMax;

varying lowp vec4 vColor;
// varying lowp vec3 vOffset;

#define MAX_K 128.0
#define MAX_K_i 128

/*
    k: index of knot interval that contains x
    x: the position
    uKnotVector: array of knot positions, needs to be padded as described above
    uControlPoints: array of control points
    p: degree of B-spline
*/
vec3 deBoor(int k, float x, int p) {
    /* Upper limit is 100. */
    vec3 d[100];
    
    /* initialize d (control points extracted on host) */
    for (int j = 0; j <= 100; ++j) {
        if (p + 1 < j) break;
        d[j] = uControlPoints[j]; 
    }

    for (int r = 1; r <= 100; ++r) {
        if (p+1 < r) break;

        for (int j = 100; j >= 0; --j) {
            if (j > p) continue;
            if (j < r) break;

            if (j <= p) {
                float alpha = (x - uKnotVector[j+k-p]) / (uKnotVector[j+1+k-r] - uKnotVector[j+k-p]);
                d[j] = (1.0 - alpha) * d[j-1] + alpha * d[j];
            }
        }
    }

    /* Can't index with non-const */
    for (int i = 0; i < 100; ++i) {
        if (i == p) {
            return d[i];
        }
    }
    return vec3(0.0, 0.0, 0.0);
}

void main(void) {
    float tNow = (t * (tMax - tMin)) + tMin;
    float tPrev = max(tNow - .001, tMin);
    float tNext = min(tNow + .001, tMax);

    /* Position computation */
    vec3 previous = deBoor(knot_index, tPrev, degree);
    vec3 position = deBoor(knot_index, tNow, degree);
    vec3 next = deBoor(knot_index, tNext, degree);


    vec2 aspectVec = vec2(aspect, 1.0);
    mat4 projViewModel = projection * modelView;
    vec4 previousProjected = projViewModel * vec4(previous, 1.0);
    vec4 currentProjected = projViewModel * vec4(position, 1.0);
    vec4 nextProjected = projViewModel * vec4(next, 1.0);

    //get 2D screen space with W divide and aspect correction
    vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;
    vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;
    vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;

    float len = thickness;
    float orientation = direction;

    //starting point uses (next - current)
    vec2 dir = vec2(0.0);
    if (position == previous) {
        dir = normalize(nextScreen - currentScreen);
    } 
    //ending point uses (current - previous)
    else if (position == next) {
        dir = normalize(currentScreen - previousScreen);
    }
    //somewhere in middle, needs a join
    else {
        //get directions from (C - B) and (B - A)
        vec2 dirA = normalize(currentScreen - previousScreen);
        if (miter == 1) {
        vec2 dirB = normalize(nextScreen - currentScreen);
        //now compute the miter join normal and length
        vec2 tangent = normalize(dirA + dirB);
        vec2 perp = vec2(-dirA.y, dirA.x);
        vec2 miter = vec2(-tangent.y, tangent.x);
        dir = tangent;
        len = min(thickness / dot(miter, perp), .05);
        } else {
        dir = dirA;
        }
    }
    vec2 normal = vec2(-dir.y, dir.x);
    normal *= len/2.0;
    normal.x /= aspect; // might need to multiply

    vec4 offset = vec4(normal * orientation, 0.0, 0.0);
    gl_Position = currentProjected + offset;
    gl_PointSize = 1.0;

    normal = normalize(normal);
    vColor = vec4(abs(normal.x), abs(normal.y), 0.0, 1.0);
    // vColor = vec4(1.0, 1.0, 1.0, 1.0);
    // vOffset = offset;
}