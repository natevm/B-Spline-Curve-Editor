import { Line } from "./Line.js"

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
function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    } else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [(r), (g), (b)];
}

class KnotEditor {
    constructor() {
        this.then = 0.0;
        this.canvas = undefined;
        this.lines = []
        this.zoom = 1.0;
        this.position = {x: 0, y:0};
        this.handleRadius = 20;
        this.numHandleSamples = 30;
        this.numBasisSamples = 200;
        this.line_needs_refresh = [];

        this.curve = undefined;

        this.precomputed = [];
    }

    initializeWebGL() {
        this.canvas = document.querySelector('#knotCanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        // If we don't have a GL context, give up now  
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        /* Handle canvas resizes */
        this.resize();
        this.canvas.onresize = function () { this.resize(); }

        Line.initializeWebGL(this.gl);
        for (var j = 0; j < 10; ++j) {

            this.lines.push(new Line(this.gl, 0.0, 0.0));
            
            for (var i = 0; i < 100; ++i) {
                this.lines[j].points[i * 3 + 0] = (i / 100.0) * this.canvas.clientWidth - this.canvas.clientWidth * .5;
                this.lines[j].points[i * 3 + 1] = Math.sin((i / 100.0) * 2.0 * 3.14 + (j * .1) * 4.0) * this.canvas.clientHeight * .5;
                this.lines[j].points[i * 3 + 2] = 0;
            }
            this.lines[j].updateBuffers(this.gl)
        }

        /* Setup Hammer Events / */
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('pan').set({
            threshold: 10,
            threshold: 9
        });

        /* Pan */
        hammer.on('panstart', (e) => {
            var bb = e.target.getBoundingClientRect();
            this.panStart(
                (e.center.x - bb.left),
                (e.center.y - bb.top),
                e.deltaX, e.deltaY);

            // console.log(e);

        });
        hammer.on('pan', (e) => {
            var bb = e.target.getBoundingClientRect();
            this.pan(
                (e.center.x - bb.left),
                (e.center.y - bb.top),
                e.deltaX, e.deltaY);

        });
        hammer.on('panend', (e) => {
            this.panEnd();
        });

    }

    setCurve(curve) {
        this.curve = curve;
        this.numBasisSamples = 1000 / curve.getDegree();
    }
 
    panStart(x, y, deltaX, deltaY) {
        let selected = this.selectHandle(x - deltaX);
        if (selected != -1) {
            this.selectedKnot = selected;
        } else {
            this.selectedKnot = -1;
        }

        // console.log(selected);
    }

    pan(x, y, deltaX, deltaY) {
        if (this.selectedKnot == -1) return;
        let x_ = Math.min(1.0, Math.max(0.0, this.untransform(x - this.canvas.clientWidth * .5, 0.0, 0.0)[0])); // x / this.canvas.clientWidth)
        
        for (var i = 0; i < this.selectedKnot; ++i) {
            if (this.curve.knot_vector[i] > x_) {
                this.curve.knot_vector[i] = x_;
                /* Refresh effected lines */
                for (var j = -this.curve.getOrder(); j < this.curve.getOrder(); ++j) {
                    if ((i + j < this.lines.length) && (i + j >= 0))
                        this.line_needs_refresh[i + j] = true;
                }
            }
        }

        this.curve.knot_vector[this.selectedKnot] = x_;
        /* refresh effected lines */
        for (var i = -this.curve.getOrder(); i < this.curve.getOrder(); ++i) {
            if ((this.selectedKnot + i < this.lines.length) && ( this.selectedKnot + i >= 0))
                this.line_needs_refresh[this.selectedKnot + i] = true;
        }


        for (var i = this.selectedKnot + 1; i < this.curve.knot_vector.length; ++i) {
            if (this.curve.knot_vector[i] < x_) {
                this.curve.knot_vector[i] = x_;
                /* refresh effected lines */
                for (var j = -this.curve.getOrder(); j < this.curve.getOrder(); ++j) {
                    if ((i + j < this.lines.length) && (i + j >= 0))
                        this.line_needs_refresh[i + j] = true;
                }
            }
        }

        this.updateBasisFunctions()
    }

    panEnd() {
        this.selectedKnot = -1;
    }

    selectHandle(x) {
        /* x is originally in screenspace, so it doesn't need to be transformed */
        /* I've normalized t, so we need to transform that to screen space. */
        
        let x_ = this.transform(Math.max(0.0,this.untransform(x - this.canvas.clientWidth * .5, 0.0, 0.0)[0]), 0.0, 0.0)[0];
        // console.log("X" + x_)
        for (var i = this.curve.knot_vector.length - 1; i >=0; --i) {
            let t_ = this.transform(this.curve.knot_vector[i], 0.0, 0.0)[0];
            // console.log("T" + t_)
            if (Math.abs(x_ - t_) < this.handleRadius) {
                return i;
            }
        } 

        /* temporary */
        return -1;
    }

    computeBasis(t, i, k) {
        if (this.precomputed[t] != undefined) 
            if (this.precomputed[t][i] != undefined)
                if (this.precomputed[t][i][k] != undefined)
                    return this.precomputed[t][i][k];

        if (k == 0) {
            var t_i = this.curve.knot_vector[i];
            var t_i_1 = this.curve.knot_vector[i+1];
            return ( (t_i <= t) && (t < t_i_1)) ? 1.0 : 0.0;
        }
        
        var leftBasis = this.computeBasis(t, i, k - 1);
        var rightBasis = this.computeBasis(t, i + 1, k - 1);

        var leftTerm = 0.0;
        var rightTerm = 0.0;
        
        if (leftBasis > 0.0) {
            var t_i = this.curve.knot_vector[i];
            var t_i_k = this.curve.knot_vector[i + k];
            var leftDenominator = t_i_k - t_i;
            if (leftDenominator > 0.0) {
                var leftNumerator = t - t_i;
                leftTerm = leftBasis * (leftNumerator / leftDenominator);
            }
        }
        
        if (rightBasis > 0.0) {
            var t_i_1 = this.curve.knot_vector[i + 1];
            var t_i_k_1 = this.curve.knot_vector[i + k + 1];
            var rightDenominator = t_i_k_1 - t_i_1;
            if (rightDenominator > 0.0) {
                var rightNumerator = t_i_k_1 - t;
                rightTerm = rightBasis * (rightNumerator / rightDenominator);
            }
        }

        if (this.precomputed[t] == undefined) 
            this.precomputed[t] = [];
        if (this.precomputed[t][i] == undefined)
            this.precomputed[t][i] = [];
        if (this.precomputed[t][i][k] == undefined)
            this.precomputed[t][i][k] = leftTerm + rightTerm;
        
        return leftTerm + rightTerm;
    }

    transform(x, y, z) {
        return [
            x * (this.canvas.clientWidth * .95) - (this.canvas.clientWidth * .95) * .5, 
            -(y * (this.canvas.clientHeight * .7) - (this.canvas.clientHeight * .7) * .5), 
            z
        ];
    }

    untransform(x, y, z) {
        return [
            (x + (this.canvas.clientWidth * .95) * .5) / (this.canvas.clientWidth * .95), 
            -(y + (this.canvas.clientHeight * .7) * .5) / (this.canvas.clientHeight * .7), 
            z
        ];
    }

    generateUniformFloatingKnotVector(open = false) {
        this.curve.knot_vector = [];
        let numKnots = this.curve.getOrder() + this.curve.getNumCtlPoints();
        for (var i = 0; i < numKnots; ++i) {
            this.curve.knot_vector.push(i / (numKnots - 1) );
        }

        if (open) {
            this.curve.knot_vector[this.curve.knot_vector.length - 1] = 1.1;
        }

        this.updateBasisFunctions()
    }


    updateBasisFunctions() {
        if (this.gl == undefined) return;

        let start = Date.now();

        let numControlPoints = this.curve.getNumCtlPoints();

        if (this.lines.length != (numControlPoints + this.curve.knot_vector.length)) {
            this.lines = [];

            /* Add a line for each control point and each handle */
            for (var i = 0; i < (numControlPoints + this.curve.knot_vector.length); ++i) {
                this.lines[i] = new Line(this.gl, 0.0, 0.0);
                this.line_needs_refresh[i] = true;
            }
        }

        this.precomputed = [];

        /* For each control point */
        for (var i = 0; i < numControlPoints; ++i) {
            // if (!this.line_needs_refresh[i]) continue;
            /* Sample the basis function throughout the domain */
            this.lines[i].points = [];
            for (var s = 0; s < this.numBasisSamples; ++s) { 
                var t = (s / (this.numBasisSamples - 1.0));
                var y = this.computeBasis(t, i, this.curve.getDegree(), this.curve.knot_vector);
                var x = (s / (this.numBasisSamples - 1.0));

                var p = this.transform(x, y, 0);

                this.lines[i].points[s * 3 + 0] = p[0];
                this.lines[i].points[s * 3 + 1] = p[1];
                this.lines[i].points[s * 3 + 2] = p[2];
            }

            this.lines[i].updateBuffers(this.gl)
            var rgb = hslToRgb(i * (1.0 / numControlPoints), 1., .5);;
            this.lines[i].color = [rgb[0], rgb[1], rgb[2], 1.0];
            this.line_needs_refresh[i] = false;
        }

        /* Create a handle for each knot */
        for (var i = 0; i < this.curve.knot_vector.length ; ++i) {
            let x = this.curve.knot_vector[i];
            let y = 0.0;
            this.lines[numControlPoints + i].points = [];
            for (var s = 0; s < this.numHandleSamples + 1; ++s) {
                let angle = (s / (1.0 * this.numHandleSamples - 1)) * 2 * Math.PI;
                let rad = this.handleRadius; // Change this when selecting

                let p = this.transform(x, y, 0.0);
                p[0] += Math.cos(angle) * rad;
                p[1] += Math.sin(angle) * rad;

                this.lines[numControlPoints + i].points.push(p[0], p[1], p[2]);
                this.lines[numControlPoints + i].points.push(p[0], p[1], p[2]);

                
            }
            this.lines[numControlPoints + i].updateBuffers(this.gl);
            this.lines[numControlPoints + i].color = [1.0, 1.0, 1.0, 1.0];
        }

        let end = Date.now();

        /* Mechanism to keep fps at a reasonable rate. Not ideal, but sampling basis is expensive, would rather 
            have a high frame rate */
        if (this.curve.getDegree() != 1) {
            if (end - start > 64) {
                this.numBasisSamples -= 10;
            } else if (end - start < 16) {
                this.numBasisSamples += 10;
                this.numBasisSamples = Math.min(this.numBasisSamples, 1000);
                for (var i = 0; i < this.lines.length; ++i) {
                    this.line_needs_refresh[i] = true;
                }
            }
        }
    }

    clearWebGL() {
        Line.clearWebGL(this.gl);
        for (var i = 0; i < this.lines.length; ++i) {
            this.lines[i].freeBuffers(this.gl);
        }
        this.lines = [];
        this.gl = undefined;
        this.canvas = undefined;
    }

    /* Changes the webgl viewport to account for screen resizes */
    resize() {
        if (this.canvas == undefined) return;

        // Lookup the size the browser is displaying the canvas.
        var displayWidth = this.canvas.clientWidth;
        var displayHeight = this.canvas.clientHeight;

        // Check if the canvas is not the same size.
        if (this.canvas.width != displayWidth ||
            this.canvas.height != displayHeight) {

            // Make the canvas the same size
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(-this.canvas.clientWidth / 2, -this.canvas.clientHeight / 2, 2 * this.canvas.clientWidth, 2 * this.canvas.clientHeight);
        }
    }

    /* Draws the curves to the screen */
    render(now) {
        // this.updateBasisFunctions();

        if (this.canvas == undefined) return;
        
        now *= 0.001;  // convert to seconds
        const deltaTime = now - this.then;
        this.then = now;
        let gl = this.gl;

        // let rgb = hslToRgb(Math.sin(now), 1., .5);

        /* Setup the projection */
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const orthoMatrix = mat4.create();
        mat4.ortho(orthoMatrix, -gl.canvas.clientWidth, gl.canvas.clientWidth, gl.canvas.clientHeight, -gl.canvas.clientHeight, -1.0, 1.0)
        let zoom = vec3.create();
        vec3.set(zoom, this.zoom, this.zoom, 1.0);
        mat4.scale(orthoMatrix, orthoMatrix, zoom);

        /* Move the camera */
        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [this.position.x, this.position.y, -1.0]);


        /* Set OpenGL state */
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        /* Render all knots */
        for (var i = 0; i < this.lines.length; ++i) {
            this.lines[i].draw(this.gl, orthoMatrix, modelViewMatrix, aspect, now);
        }
    }
}

export { KnotEditor };