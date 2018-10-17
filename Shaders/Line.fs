// precision lowp float;
varying lowp vec4 vColor;
// varying lowp vec3 vOffset;

// uniform float thickness;
// uniform int taper;

void main(void) 
{
    // if (taper == 1) {
    //     float t = thickness;
    //     vec3 distanceVector = vOffset;
    //     float d = sqrt(dot(distanceVector, distanceVector));
    //     gl_FragColor = vColor * vec4((t-d)/t, (t-d)/t, (t-d)/t, 0.0);
    // } else {
        gl_FragColor = vColor;
    // }
}