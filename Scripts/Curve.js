/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [(r), (g), (b)];
}


class Curve {
    static Initialize(gl) {
        Curve.gl = gl;

        let bfsSource = "";
        let bvsSource = "";
        let lfsSource = "";
        let lvsSource = "";

        let promises = [];
        promises.push($.ajax({
            url: "./Shaders/BSpline.vs",
            success: function (result) {
                bvsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load BSpline.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/BSpline.fs",
            success: function (result) {
                bfsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load BSpline.fs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Line.vs",
            success: function (result) {
                lvsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Line.fs",
            success: function (result) {
                lfsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.fs with error ");
                console.log(result);
            }
        }));

        Promise.all(promises).then(() => {
            Curve.BSplineShaderProgram = Curve.InitShaderProgram(gl, bvsSource, bfsSource);
            Curve.BSplineProgramInfo = {
                program: Curve.BSplineShaderProgram,
                attribLocations: {
                    t: gl.getAttribLocation(Curve.BSplineShaderProgram, 't'),
                    direction: gl.getAttribLocation(Curve.BSplineShaderProgram, 'direction'),
                },
                uniformLocations: {
                    projection: gl.getUniformLocation(Curve.BSplineShaderProgram, 'projection'),
                    modelView: gl.getUniformLocation(Curve.BSplineShaderProgram, 'modelView'),
                    thickness: gl.getUniformLocation(Curve.BSplineShaderProgram, 'thickness'),
                    aspect: gl.getUniformLocation(Curve.BSplineShaderProgram, 'aspect'),
                    miter: gl.getUniformLocation(Curve.BSplineShaderProgram, 'miter'),
                    controlPoints: gl.getUniformLocation(Curve.BSplineShaderProgram, 'uControlPoints'),
                    numControlPoints: gl.getUniformLocation(Curve.BSplineShaderProgram, 'uNumControlPoints'),
                    knotVector: gl.getUniformLocation(Curve.BSplineShaderProgram, 'uKnotVector'),
                    knotIndex: gl.getUniformLocation(Curve.BSplineShaderProgram, 'knot_index'),
                    degree: gl.getUniformLocation(Curve.BSplineShaderProgram, 'degree'),
                    tmin: gl.getUniformLocation(Curve.BSplineShaderProgram, 'tMin'),
                    tmax: gl.getUniformLocation(Curve.BSplineShaderProgram, 'tMax'),
                },
            };

            Curve.LineShaderProgram = Curve.InitShaderProgram(gl, lvsSource, lfsSource);
            Curve.LineProgramInfo = {
                program: Curve.LineShaderProgram,
                attribLocations: {
                    position: gl.getAttribLocation(Curve.LineShaderProgram, 'position'),
                    next: gl.getAttribLocation(Curve.LineShaderProgram, 'next'),
                    previous: gl.getAttribLocation(Curve.LineShaderProgram, 'previous'),
                    direction: gl.getAttribLocation(Curve.LineShaderProgram, 'direction'),
                    color: gl.getAttribLocation(Curve.LineShaderProgram, 'color'),
                },
                uniformLocations: {
                    projection: gl.getUniformLocation(Curve.LineShaderProgram, 'projection'),
                    modelView: gl.getUniformLocation(Curve.LineShaderProgram, 'modelView'),
                    thickness: gl.getUniformLocation(Curve.LineShaderProgram, 'thickness'),
                    aspect: gl.getUniformLocation(Curve.LineShaderProgram, 'aspect'),
                    miter: gl.getUniformLocation(Curve.LineShaderProgram, 'miter'),
                    color: gl.getUniformLocation(Curve.LineShaderProgram, 'ucolor'),
                },
            };
        });
    }

    // Initialize a shader program, so WebGL knows how to draw our data
    static InitShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = Curve.LoadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = Curve.LoadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        // Create the shader program
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        // If creating the shader program failed, alert
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        return shaderProgram;
    }

    // creates a shader of the given type, uploads the source and
    // compiles it.
    static LoadShader(gl, type, source) {
        const shader = gl.createShader(type);

        // Send the source to the shader object
        gl.shaderSource(shader, source);

        // Compile the shader program
        gl.compileShader(shader);

        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    constructor(x = 0, y = 0, obj = null) {
        this.showCurve = true;
        this.showControlPolygon = true;
        this.showControlPoints = true;
        this.numSamples = 200;
        this.thickness = (obj == null) ? 10.0 : obj.thickness;
        this.controlPoints = (obj == null) ? [
            -100.0 + x, y, 0.0,
            100.0 + x, y, 0.0,
        ] : obj.controlPoints;
        this.temporaryPoint = []

        this.handleRadius = 50;
        this.handleThickness = 10.;
        this.handleSamples = 30;
        this.selected = false;
        this.selectedHandle = -1;
        this.selectedColor = [0.0, 0.0, 0.0, 0.0];
        this.deselectedColor = [-.7, -.7, -.7, 0.0];
        this.isOpen =  (obj == null) ? true : obj.isOpen;
        this.isUniform = (obj == null) ?  true : obj.isUniform;
        this.degree = (obj == null) ? 1 : obj.degree;
        this.knot_vector = (obj == null) ? [0.0, .33, .66, 1.0] : obj.knot_vector;

        this.updateConstraints();
        this.updateBuffers();
    }

    toJSON() {
        return {
            thickness: this.thickness,
            controlPoints: this.controlPoints,
            knot_vector: this.knot_vector,
            degree: this.degree,
            isOpen: this.isOpen,
            isUniform: this.isUniform
        };
    }

    select() {
        this.selected = true;
    }

    selectHandle(selectedHandle) {
        this.selectedHandle = selectedHandle;
    }

    deselect() {
        this.clearTemporaryHandle();
        this.selected = false;
        this.selectedHandle = -1;
    }

    getNumCtlPoints() {
        return this.controlPoints.length / 3;
    }

    getDegree() {
        return this.degree;
    }

    updateConstraints() {
        if (this.isUniform) {
            this.makeKnotVectorUniform();
        }
        if (this.isOpen) {
            this.makeKnotVectorOpen();
        }
    }

    setDegree(degree) {
        let oldDegree = this.degree;

        if ((degree >= 1) && (degree <= this.getNumCtlPoints() - 1))
            this.degree = degree;
        else return;

        if (this.knot_vector == undefined) {
            this.knot_vector = [];
        }

        let numKnots = this.getOrder() + this.getNumCtlPoints();
        if (oldDegree < this.degree) {
            for (var i = numKnots - (this.degree - oldDegree); i < numKnots; ++i) {
                this.knot_vector.push(i / (numKnots - (1 + this.degree - oldDegree)));
            }
        } else {
            this.knot_vector = this.knot_vector.slice(0, numKnots);
        }

        for (var i = 0; i < numKnots; ++i) {
            this.knot_vector[i] /= this.knot_vector[this.knot_vector.length - 1];
        }
        this.updateConstraints();
    }

    makeKnotVectorUniform() {
        this.knot_vector = [];
        let numKnots = this.getOrder() + this.getNumCtlPoints();
        for (var i = 0; i < numKnots; ++i) {
            this.knot_vector.push(i / (numKnots - 1));
        }
    }

    makeKnotVectorOpen() {
        let numKnots = this.getOrder() + this.getNumCtlPoints();
        var lower = this.knot_vector[this.degree];
        var upper = this.knot_vector[this.knot_vector.length - 1 - (this.degree)];

        for (var i = 0; i < numKnots; ++i) {
            this.knot_vector[i] -= lower;
            this.knot_vector[i] /= (upper - lower);
        }

        for (var i = 0; i < this.degree; ++i) {
            this.knot_vector[i] = 0.0;
        }

        for (var i = this.knot_vector.length - (this.degree); i < this.knot_vector.length; ++i) {
            this.knot_vector[i] = 1.0;
        }

        this.checkUpperEndConditions();
    }

    checkUpperEndConditions() {
        var isOpen = true;
        var lastVal = this.knot_vector[this.knot_vector.length - 1];
        for (var i = this.knot_vector.length - 2; i >= this.knot_vector.length - (this.degree + 1); i--) {
            if (this.knot_vector[i] != lastVal) {
                isOpen = false;
                break;
            }
        }

        if (isOpen) {
            let other = lastVal;
            /* Try to find the first value which doesn't equal the last */
            for (var i = this.knot_vector.length - 1; i >= 0; --i) {
                if (this.knot_vector[i] != lastVal) {
                    other = this.knot_vector[i];
                    break;
                }
            }

            this.knot_vector[this.knot_vector.length - 1] += .05;
            for (var i = 0; i < this.knot_vector.length; ++i) {
                this.knot_vector[i] /= this.knot_vector[this.knot_vector.length - 1];
            }
            // /* If all knots were moved to the end */
            // if (other == lastVal) 
            // {
            // } else {
            //     /* Move all knots except the last whose value equals the last value */
            //     for (var i = 0; i < this.knot_vector.length - 1; ++i) {
            //         if (this.knot_vector[i] == lastVal) {
            //             this.knot_vector[i] = (lastVal + other) / 2;
            //         }
            //     }
            // }
        }

    }

    setUniformity(isUniform) {
        this.isUniform = isUniform;
        this.updateConstraints();
    }

    setOpen(isOpen) {
        this.isOpen = isOpen;
        this.updateConstraints();
    }

    getOrder() {
        return this.degree + 1;
    }

    updateBuffers() {
        let gl = Curve.gl;

        if (!this.buffers) {
            this.buffers = {}
            this.buffers.t = gl.createBuffer();
            this.buffers.tDirection = gl.createBuffer();
            this.buffers.controlPointsPosition = gl.createBuffer();
            this.buffers.controlPointsNext = gl.createBuffer();
            this.buffers.controlPointsPrevious = gl.createBuffer();
            this.buffers.controlPointsDirection = gl.createBuffer();
            this.buffers.controlPointsColors = gl.createBuffer();

            this.buffers.handlePointsPosition = gl.createBuffer();
            this.buffers.handlePointsNext = gl.createBuffer();
            this.buffers.handlePointsPrevious = gl.createBuffer();
            this.buffers.handlePointsDirection = gl.createBuffer();
            this.buffers.handlePointsIndices = gl.createBuffer();
            this.buffers.handlePointsColors = gl.createBuffer();
        }


        let t = this.getTValues();

        /* Double each t, adding a direction */
        let tDirection = [];
        let doubleTs = [];
        for (var i = 0; i < t.length; ++i) {
            tDirection.push(-1, 1)
            doubleTs.push(t[i], t[i])
        }

        let next = [];
        let prev = [];
        let pos = [];
        let ctlDirection = []
        let controlPointColors = []
        for (var i = 0; i < this.controlPoints.length / 3; ++i) {
            let iprev = Math.max(i - 1, 0);
            let inext = Math.min(i + 1, (this.controlPoints.length / 3) - 1);
            next.push(this.controlPoints[inext * 3 + 0], this.controlPoints[inext * 3 + 1], this.controlPoints[inext * 3 + 2])
            next.push(this.controlPoints[inext * 3 + 0], this.controlPoints[inext * 3 + 1], this.controlPoints[inext * 3 + 2])
            prev.push(this.controlPoints[iprev * 3 + 0], this.controlPoints[iprev * 3 + 1], this.controlPoints[iprev * 3 + 2])
            prev.push(this.controlPoints[iprev * 3 + 0], this.controlPoints[iprev * 3 + 1], this.controlPoints[iprev * 3 + 2])
            pos.push(this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
            pos.push(this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
            controlPointColors.push(1.0, 1.0, 1.0, 1.0);
            controlPointColors.push(1.0, 1.0, 1.0, 1.0);
            controlPointColors.push(1.0, 1.0, 1.0, 1.0);
            ctlDirection.push(-1, 1);
        }

        /* Create lines for control point handles */
        // let center = vec3.create();
        // vec3.set(center, this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
        var i = 0;
        let handlePoints = [];
        let handlePointsPrev = [];
        let handlePointsNext = [];
        let handlePointsDirection = [];
        let handlePointsIndices = [];
        let handlePointColors = [];
        let temppts = this.controlPoints.slice();
        if (this.temporaryPoint.length != 0) {
            temppts.push(this.temporaryPoint[0], this.temporaryPoint[1], this.temporaryPoint[2]);
        }
        for (var i = 0; i < temppts.length / 3; ++i) {
            for (var j = 0; j < this.handleSamples + 1; ++j) {
                let jprev = Math.max(j - 1, 0);
                let jnext = Math.min(j + 1, this.handleSamples);

                let degreePrev = (jprev / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;
                let degree = (j / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;
                let degreeNext = (jnext / (1.0 * this.handleSamples - 1)) * 2 * Math.PI;

                let rad = (i == this.selectedHandle) ? this.handleRadius * 1.0 : this.handleRadius;
                if ((i == ((temppts.length / 3) - 1)) && (this.temporaryPoint.length != 0)) {
                    rad *= 1.2;
                }

                handlePointsPrev.push(temppts[i * 3 + 0] + Math.cos(degreePrev) * rad, temppts[i * 3 + 1] + Math.sin(degreePrev) * rad, 0.0);
                handlePointsPrev.push(temppts[i * 3 + 0] + Math.cos(degreePrev) * rad, temppts[i * 3 + 1] + Math.sin(degreePrev) * rad, 0.0);

                handlePoints.push(temppts[i * 3 + 0] + Math.cos(degree) * rad, temppts[i * 3 + 1] + Math.sin(degree) * rad, 0.0);
                handlePoints.push(temppts[i * 3 + 0] + Math.cos(degree) * rad, temppts[i * 3 + 1] + Math.sin(degree) * rad, 0.0);

                handlePointsNext.push(temppts[i * 3 + 0] + Math.cos(degreeNext) * rad, temppts[i * 3 + 1] + Math.sin(degreeNext) * rad, 0.0);
                handlePointsNext.push(temppts[i * 3 + 0] + Math.cos(degreeNext) * rad, temppts[i * 3 + 1] + Math.sin(degreeNext) * rad, 0.0);

                handlePointsDirection.push(-1, 1 * (this.selectedHandle == i) ? 4 : 1);

                if ((i == ((temppts.length / 3) - 1)) && (this.temporaryPoint.length != 0)) {
                    handlePointColors.push(this.temporaryPointColor[0], this.temporaryPointColor[1], this.temporaryPointColor[2], this.temporaryPointColor[3]);
                    handlePointColors.push(this.temporaryPointColor[0], this.temporaryPointColor[1], this.temporaryPointColor[2], this.temporaryPointColor[3]);
                    // handlePointColors.push(this.temporaryPointColor[0], this.temporaryPointColor[1], this.temporaryPointColor[2], this.temporaryPointColor[3]);
                }
                else {
                    var rgb = hslToRgb(i * (1.0 / this.getNumCtlPoints()), 1., .5);;
                    // this.lines[i].color = [rgb[0], rgb[1], rgb[2], 1.0];

                    handlePointColors.push(rgb[0], rgb[1], rgb[2], 1.0);
                    handlePointColors.push(rgb[0], rgb[1], rgb[2], 1.0);
                    // handlePointColors.push(1.0, 1.0, 1.0, 1.0);
                }

                if (j != this.handleSamples) {
                    let offset = 2 * (this.handleSamples + 1) * i; // 2 points per point. 6 floats per point. handleSamples + 1 points. 
                    // handlePointsIndices.push((handlePoints.length/3) -  j * 2 + (i * this.handleSamples + 1), j*2+1 + (i * this.handleSamples + 1));
                    /* each two points creates two triangles in our strip. */
                    handlePointsIndices.push(j * 2 + offset, j * 2 + 2 + offset, j * 2 + 1 + offset, j * 2 + 2 + offset, j * 2 + 3 + offset, j * 2 + 1 + offset); // first pt, second pt
                }
            }
        }

        /* Control points */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.t);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(doubleTs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPrevious);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(prev), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsNext);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(next), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ctlDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsColors);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(controlPointColors), gl.STATIC_DRAW)

        /* Handles */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePoints), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsNext);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsNext), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPrevious);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsPrev), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsDirection);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointsDirection), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.handlePointsIndices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(handlePointsIndices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsColors);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(handlePointColors), gl.STATIC_DRAW)
    }

    getBSplinePoints() {
        let tValues = this.getTValues();
        let points = []
        let n = (this.controlPoints.length / 3) - 1; // degree

        /* for each point */
        for (let pi = 0; pi < this.numSamples; ++pi) {
            let p = vec3.create()
            let t = tValues[pi];

            for (let i = 0; i <= 128; ++i) {
                if (i > n) break;
                let p_i = vec3.create()
                vec3.set(p_i, this.controlPoints[i * 3], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2])
                let theta = this.bernstein(n, i, t);
                vec3.scale(p_i, p_i, theta)
                vec3.add(p, p, p_i);
            }

            points.push(p);
        }

        return points;
    }

    getTValues() {
        let ts = []
        for (let i = 0; i < this.numSamples; ++i) {
            ts.push(i / (this.numSamples - 1));
        }
        return ts;
    }

    getClickedHandle(x, y) {
        for (var i = 0; i < this.controlPoints.length / 3; ++i) {
            var deltaX = x - this.controlPoints[3 * i + 0];
            var deltaY = y - this.controlPoints[3 * i + 1];
            var distSqrd = deltaX * deltaX + deltaY * deltaY;
            if (distSqrd * .9 < (this.handleRadius * this.handleRadius))
                return i;
        }
        return -1;
    }

    getSnapPosition(x, y, selectedIsCurrent, currentHandle) {
        for (var i = 0; i < this.controlPoints.length / 3; ++i) {
            if (selectedIsCurrent && currentHandle == i) continue;

            var deltaX = x - this.controlPoints[3 * i + 0];
            var deltaY = y - this.controlPoints[3 * i + 1];
            var distSqrd = deltaX * deltaX + deltaY * deltaY;
            if (distSqrd * .9 < (this.handleRadius * this.handleRadius))
                return i;
        }
        return -1;
    }

    moveHandle(handleIdx, x, y) {
        this.controlPoints[3 * handleIdx + 0] = x;
        this.controlPoints[3 * handleIdx + 1] = y;
    }

    removeHandle(handleIdx) {
        this.controlPoints.splice(handleIdx * 3, 3);
        this.knot_vector.splice(handleIdx, 1);
        this.selectedHandle = -1;
        if (this.getOrder() > this.getNumCtlPoints() ) {
            this.setDegree(this.getDegree() - 1);
        }

        this.updateConstraints();
    }

    sqr(x) { return x * x }
    dist2(v, w) { return this.sqr(v[0] - w[0]) + this.sqr(v[1] - w[1]) }
    distToSegmentSquared(p, v, w) {
        var l2 = this.dist2(v, w);
        if (l2 == 0) return this.dist2(p, v);
        var t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
        t = Math.max(0, Math.min(1, t));
        return this.dist2(p, [v[0] + t * (w[0] - v[0]),
        v[1] + t * (w[1] - v[1])]);
    }
    distToSegment(p, v, w) { return Math.sqrt(this.distToSegmentSquared(p, v, w)); }

    addHandle(x, y, addToFront = false, addToBack = false, addToClosest = true) {
        var p = vec2.create()
        vec2.set(p, x, y);

        if (addToBack) {
            this.controlPoints.push(x, y, 0.0)
        } else if (addToFront) {
            this.controlPoints.unshift(x, y, 0.0);
        }
        else {
            var closest = -1;
            var closestDistance = Number.MAX_VALUE;
            for (var i = 0; i < (this.controlPoints.length / 3 - 1); ++i) {
                var v = vec2.create()
                var w = vec2.create()
                vec2.set(v, this.controlPoints[i * 3 + 0], this.controlPoints[i * 3 + 1])
                vec2.set(w, this.controlPoints[(i + 1) * 3 + 0], this.controlPoints[(i + 1) * 3 + 1])
                var distance = this.distToSegment(p, v, w);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = i;
                }
            }

            if (closest == 0) {
                var end = vec2.create();
                vec2.set(end, this.controlPoints[0], this.controlPoints[1])
                var distanceToEnd = vec2.distance(p, end);
                if (distanceToEnd <= closestDistance) {
                    this.controlPoints.unshift(x, y, 0.0);
                    this.knot_vector.unshift(0.0);
                    for (var i = 1; i < this.knot_vector.length; ++i) {
                        this.knot_vector[i] += .1;
                    }
                    for (var i = 0; i < this.knot_vector.length; ++i) {
                        this.knot_vector[i] /= this.knot_vector[this.knot_vector.length - 1];
                    }
                } else {
                    this.controlPoints.splice((closest + 1) * 3, 0, x, y, 0.0);
                    let t = (this.knot_vector[closest] + this.knot_vector[closest + 1]) / 2.0;
                    this.knot_vector.splice((closest + 1), 0, t);
                }
            } else if (closest == ((this.controlPoints.length / 3) - 2)) {
                var end = vec2.create();
                vec2.set(end, this.controlPoints[this.controlPoints.length - 3], this.controlPoints[this.controlPoints.length - 2])
                var distanceToEnd = vec2.distance(p, end);
                if (distanceToEnd <= closestDistance) {
                    this.controlPoints.push(x, y, 0.0);
                    this.knot_vector.push(1. + (1.0 / (this.knot_vector.length - 1)));
                    for (var i = 0; i < this.knot_vector.length; ++i) {
                        this.knot_vector[i] /= this.knot_vector[this.knot_vector.length - 1];
                    }
                } else {
                    this.controlPoints.splice((closest + 1) * 3, 0, x, y, 0.0);
                    let t = (this.knot_vector[closest] + this.knot_vector[closest + 1]) / 2.0;
                    this.knot_vector.splice(closest + 1, 0, t);
                }
            } else {
                this.controlPoints.splice((closest + 1) * 3, 0, x, y, 0.0);
                let t = (this.knot_vector[closest] + this.knot_vector[closest + 1]) / 2.0;
                this.knot_vector.splice(closest + 1, 0, t);
            }
        }

        this.updateConstraints();
    }

    setTemporaryHandle(x, y, r, g, b, a) {
        this.temporaryPoint = [x, y, 0.0]
        this.temporaryPointColor = [r, g, b, a]
    }

    clearTemporaryHandle() {
        this.temporaryPoint = [];
        this.temporaryPointColor = [];
    }

    getHandlePos(index) {
        return [this.controlPoints[index * 3 + 0], this.controlPoints[index * 3 + 1], this.controlPoints[index * 3 + 2]]
    }

    bernstein(n, k, t) {
        let result = 1.0;
        for (let i = 1.0; i <= 128; i++) {
            if (i > k) break;
            result *= (n - (k - i)) / i;
        }
        result *= Math.pow(t, k) * Math.pow(1.0 - t, n - k);
        return result;
    }

    drawCurve(projection, modelView, aspect, time) {
        let gl = Curve.gl;
        if (!Curve.BSplineShaderProgram) return;

        /* K is the knot interval containing x. It starts at degree, and ends at the last interval of the knot. */
        for (var k = this.degree; k < this.knot_vector.length; ++k) {
            // t values
            {
                const numComponents = 1;
                const type = gl.FLOAT;
                const normalize = false;
                const stride = 0;
                const offset = 0;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.t);
                gl.vertexAttribPointer(
                    Curve.BSplineProgramInfo.attribLocations.t,
                    numComponents,
                    type,
                    normalize,
                    stride,
                    offset);
                gl.enableVertexAttribArray(
                    Curve.BSplineProgramInfo.attribLocations.t);
            }

            // direction
            {
                const numComponents = 1;
                const type = gl.FLOAT;
                const normalize = false;
                const stride = 0;
                const offset = 0;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tDirection);
                gl.vertexAttribPointer(
                    Curve.BSplineProgramInfo.attribLocations.direction,
                    numComponents,
                    type,
                    normalize,
                    stride,
                    offset);
                gl.enableVertexAttribArray(
                    Curve.BSplineProgramInfo.attribLocations.direction);
            }


            // Tell WebGL to use our program when drawing
            gl.useProgram(Curve.BSplineProgramInfo.program);

            // Set the shader uniforms
            gl.uniformMatrix4fv(
                Curve.BSplineProgramInfo.uniformLocations.projection,
                false,
                projection);

            gl.uniformMatrix4fv(
                Curve.BSplineProgramInfo.uniformLocations.modelView,
                false,
                modelView);

            gl.uniform1f(
                Curve.BSplineProgramInfo.uniformLocations.thickness,
                this.thickness);

            // gl.uniform1f(
            //     Curve.BSplineProgramInfo.uniformLocations.aspect,
            //     aspect);

            gl.uniform1i(
                Curve.BSplineProgramInfo.uniformLocations.miter,
                0);

            gl.uniform1i(
                Curve.BSplineProgramInfo.uniformLocations.knotIndex,
                k); // I think this goes from degree to n - degree

            gl.uniform1i(
                Curve.BSplineProgramInfo.uniformLocations.degree,
                this.degree);

            // /* extract knot interval */
            // let knotInterval = [];
            // knotInterval.push(this.knot_vector[k])
            // knotInterval.push(this.knot_vector[k+1])

            // for (var j = 0; j < this.degree; ++j) {
            //     knotInterval.unshift(knotInterval[0]);
            // }

            // for (var j = 0; j < this.degree; ++j) {
            //     knotInterval.push(knotInterval[knotInterval.length - 1]);
            // }

            gl.uniform1fv(
                Curve.BSplineProgramInfo.uniformLocations.knotVector,
                new Float32Array(this.knot_vector)
            );

            /* Values of X range from t_x to t_k+1 */
            gl.uniform1f(
                Curve.BSplineProgramInfo.uniformLocations.tmin,
                this.knot_vector[k]);

            gl.uniform1f(
                Curve.BSplineProgramInfo.uniformLocations.tmax,
                this.knot_vector[k + 1]);



            // knotVector
            // knotIndex
            // degree

            /* Extract temporary control points */
            let tCtlPts = [];
            for (var j = 0; j <= this.degree; ++j) {
                let idx = j + k - this.degree;
                tCtlPts.push(
                    this.controlPoints[3 * idx + 0],
                    this.controlPoints[3 * idx + 1],
                    this.controlPoints[3 * idx + 2],
                )
            }

            gl.uniform3fv(
                Curve.BSplineProgramInfo.uniformLocations.controlPoints,
                new Float32Array(tCtlPts));

            /* The temporary control point count is degree + 1 */
            gl.uniform1i(
                Curve.BSplineProgramInfo.uniformLocations.numControlPoints,
                this.degree + 1);

            {
                const vertexCount = this.numSamples * 2;
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
            }



        }

    }

    drawControlPoints(projection, modelView, aspect, time) {
        let gl = Curve.gl;

        if (!Curve.LineShaderProgram) return;

        // position values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPosition);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.position,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.position);
        }

        // previous values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsPrevious);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.previous,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.previous);
        }

        // next values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsNext);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.next,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.next);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsDirection);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.direction);
        }

        // color values
        {
            const numComponents = 4;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.handlePointsColors);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.color,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.color);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Curve.LineProgramInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.thickness,
            this.handleThickness);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Curve.LineProgramInfo.uniformLocations.miter,
            0);

        gl.uniform4fv(
            Curve.LineProgramInfo.uniformLocations.color,
            this.selected ? this.selectedColor : this.deselectedColor);

        {
            const vertexCount = (this.handleSamples * 6) * ((this.controlPoints.length + this.temporaryPoint.length) / 3);
            const type = gl.UNSIGNED_SHORT;
            const offset = 0;
            // gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.handlePointsIndices);
            gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
        }
    }

    drawControlPolygon(projection, modelView, aspect, time) {
        let gl = Curve.gl;

        if (!Curve.LineShaderProgram) return;

        // position values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPosition);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.position,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.position);
        }

        // previous values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsPrevious);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.previous,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.previous);
        }

        // next values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsNext);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.next,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.next);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsDirection);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.direction);
        }

        // color values
        {
            const numComponents = 4;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.controlPointsColors);
            gl.vertexAttribPointer(
                Curve.LineProgramInfo.attribLocations.color,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Curve.LineProgramInfo.attribLocations.color);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Curve.LineProgramInfo.program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Curve.LineProgramInfo.uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.thickness,
            this.handleThickness);

        gl.uniform1f(
            Curve.LineProgramInfo.uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Curve.LineProgramInfo.uniformLocations.miter,
            1);

        gl.uniform4fv(
            Curve.LineProgramInfo.uniformLocations.color,
            this.selected ? this.selectedColor : this.deselectedColor);

        {
            const vertexCount = (this.controlPoints.length / 3) * 2;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }
    }

    draw(projection, modelView, aspect, time) {
        var gl = Curve.gl;

        this.updateBuffers()
        if (this.showControlPolygon) {
            this.drawControlPolygon(projection, modelView, aspect, time);
        }

        if (this.showControlPoints) {
            this.drawControlPoints(projection, modelView, aspect, time);
        }

        if (this.showCurve) {
            this.drawCurve(projection, modelView, aspect, time);
        }
    }
}

export { Curve }