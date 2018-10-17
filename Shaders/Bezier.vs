// precision lowp float;
attribute float t;
attribute float direction; 
// attribute vec3 position;
// attribute vec3 next;
// attribute vec3 previous;

uniform mat4 modelView;
uniform mat4 projection;
uniform float aspect;

uniform float thickness;
uniform int miter;

uniform int uNumControlPoints;
uniform lowp vec3 uControlPoints[100];

varying lowp vec4 vColor;
// varying lowp vec3 vOffset;

#define MAX_K 128.0
#define MAX_K_i 128
float bernstein(int n, int k, float t) {
    float result = 1.0;
    for(int i = 1; i <= MAX_K_i; i++) {
        if (i > k) break;
        result *= float(n - (k - i)) / float(i);
    }
    float first = (k == 0) ? 1.0 : pow(t, float(k));
    float second = ((n - k) == 0) ? 1.0 : pow(1.0 - t, float(n-k));

    result *= first * second;
    return result;
}

vec3 bernstein3(float n, float k, float t1, float t2, float t3) {
    vec3 result = vec3(1.0, 1.0, 1.0);
    for(float i = 1.0; i <= MAX_K; i++) {
        if (i > k) break;
        result *= (n - (k - i)) / i;
    }

    vec3 first = (k == 0.0) ? vec3(1.0, 1.0, 1.0) : vec3(pow(t1, k), pow(t2, k), pow(t3, k));
    vec3 second = ((n - k) == 0.0) ? vec3(1.0, 1.0, 1.0) : vec3(pow(1.0-t1, n - k),pow(1.0-t2, n - k),pow(1.0-t3, n - k));
    result *= first * second;
    return result;
}

void main(void) {
    float tNow = t;
    float tPrev = max(tNow - .001, 0.0);
    float tNext = min(tNow + .001, 1.0);

    vec3 previous = vec3(0.0, 0.0, 0.0);
    vec3 position = vec3(0.0, 0.0, 0.0);
    vec3 next = vec3(0.0, 0.0, 0.0);

    int n = uNumControlPoints - 1;
    for (int i = 0; i <= 128; ++i) {
        if (i > n) break;
        vec3 p_i = uControlPoints[i];
        vec3 theta = bernstein3(float(n), float(i), tPrev, tNow, tNext);
        previous += p_i * theta[0];
        position += p_i * theta[1];
        next += p_i * theta[2];
    }

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
            len = min(thickness / dot(miter, perp), .1);
        } else {
            dir = dirA;
        }
    }
    vec3 normal = vec3(-dir.y, dir.x, dir.z);
    normal *= len/2.0;

    vec3 offset = normal * orientation;
    gl_Position = projection * modelView * vec4((position + offset), 1.0);
    gl_PointSize = 1.0;

    normal = normalize(normal);
    vColor = vec4(abs(normal.x), abs(normal.y), abs(.5 - normal.x * normal.y), 1.0);
    // vOffset = offset;
}