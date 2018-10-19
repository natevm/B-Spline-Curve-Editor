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
    }else{
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
            var rgb = hslToRgb(i * (1.0 / this.lines.length) + Math.sin(now), .5, .5);;
            this.lines[i].color = [rgb[0], rgb[1], rgb[2], 1.0];

            this.lines[i].draw(this.gl, orthoMatrix, modelViewMatrix, aspect, now);
        }
    }
}

export { KnotEditor };