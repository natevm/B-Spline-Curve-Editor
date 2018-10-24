import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.pointJustAdded = false;
        this.selectedCurve = -1;
        this.selectedHandle = -1;
        this.showCurves = true;
        this.showControlPolygons = true;
        this.showControlHandles = true;
        this.shortcutsEnabled = true;
        this.then = 0.0;
        this.canvas = document.querySelector('#glcanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        this.position = { x: 0, y: 0 };
        this.originalPosition = { x: 0, y: 0 };
        this.zoom = 20.0;
        this.addMode = 0;
        this.addToFront = false;
        this.addToBack = true;
        this.addToClosest = false;
        this.snappingEnabled = true;
        this.zooming = false;
        this.panning = false;
        this.mousedown = false;
        this.touchstart = false;
        this.doubletapped = false;
        this.ortho = false;
        this.near = 0.1;
        this.far = 100.0;
        this.fovy = 45;

        /* Temporary janky camera controls */
        this.rotX = 0.0;
        this.rotY = 0.0;
        this.deltaX = 0.0;
        this.deltaY = 0.0;

        // If we don't have a GL context, give up now  
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        /* Handle canvas resizes */
        this.resize();
        this.canvas.onresize = function () { this.resize(); }

        /* Initialize curve shaders, start off with a random curve */
        Curve.Initialize(this.gl);

        this.curves = [];
        if (localStorage.getItem("curves")) {
            let curveObjs = JSON.parse(localStorage.getItem("curves"));
            for (var i = 0; i < curveObjs.length; ++i) {
                this.curves.push(new Curve(0, 0, curveObjs[i]));
            }
        } else {
            for (let i = 0; i < 1; ++i) {
                this.curves.push(new Curve());
                this.curves[i].controlPoints = []
                for (let j = 0; j < 5; ++j) {
                    this.curves[i].addHandle((this.canvas.clientWidth / 4.0) * (2.0 * Math.random() - 1.0), (this.canvas.clientHeight / 4.0) * (2.0 * Math.random() - 1.0))
                }
            }

            this.backup();
        }

        if (this.curves.length > 0) {
            this.selectedCurve = 0; // TEMPORARY
            this.curves[0].selected = true;

        }

        /* Setup Hammer Events / */
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('press').set({
            time: 200
        });

        hammer.get('pan').set({
            threshold: 10,
            threshold: 9,
            direction: Hammer.DIRECTION_ALL
        });

        /* Pan */
        hammer.on('panstart', (e) => {
            var bb = e.target.getBoundingClientRect();
            this.panStart(
                (e.center.x - bb.left) / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom),
                (e.center.y - bb.top) / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom),
                e.deltaX / this.zoom, e.deltaY / this.zoom);
        });
        hammer.on('pan', (e) => {
            var bb = e.target.getBoundingClientRect();
            /* Weird bug where centerx and y are zero, flying you off the screen... */
            if ((e.center.x == 0) && (e.center.y == 0)) {
                this.panEnd();
                console.log(e)
                return;
            }

            this.pan(
                (e.center.x - bb.left) / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom),
                (e.center.y - bb.top) / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom),
                e.deltaX / this.zoom, e.deltaY / this.zoom);
        });
        hammer.on('panend', (e) => {
            this.panEnd();
        });

        /* Press */
        hammer.on('press', (e) => {
            this.press((e.center.x / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.center.y / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)));
            console.log(e);
        });
        hammer.on('pressup', (e) => { this.pressUp(); });

        // /* Pinch */
        // hammer.on('pinchstart', (e) =>  {
        //     this.originalZoom = this.zoom;
        // });
        // hammer.on('pinch', (e) => { 
        //     this.zoom = this.originalZoom * e.scale;
        //     console.log(e.scale);
        // });
        // hammer.on('pinchend', (e) => { this.originalZoom = this.zoom; this.zooming = false; });

        /* Double tap */
        hammer.on('doubletap', (e) => {
            this.doubleTap((e.center.x / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.center.y / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)));
        });

        /* tap */
        hammer.on('tap', (e) => {
            this.tap((e.center.x / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.center.y / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)));
        });

        /* Setup keyboard shortcuts */
        document.onkeyup = (e) => {
            if (!this.shortcutsEnabled) return;

            if (e.keyCode == 67) this.hideCurves();
            if (e.keyCode == 76) this.hideControlPolygons();
            if (e.keyCode == 80) this.hideControlHandles();
            if (e.keyCode == 65) this.addHandle();
            if (e.keyCode == 46) this.deleteLastHandle();
            if (e.keyCode == 78) this.newCurve();

            this.backup();
        };

        /* Prevent right clicking the webgl canvas */
        this.canvas.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        }
    }

    setOrthoEnabled(enabled) {
        this.ortho = enabled;
    }

    updateZoom(zoomAmount) {
        this.zoom = Math.pow(10, zoomAmount);
    }

    setShortcutsEnabled(enabled) {
        this.shortcutsEnabled = enabled;
    }

    backup() {
        let json = JSON.stringify(this.curves);
        localStorage.setItem("curves", json)
    }

    /* Changes the webgl viewport to account for screen resizes */
    resize() {
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

    tap(x, y) {
        console.log("tap is currently unsupported");
    }

    panStart(initialX, initialY, deltaX, deltaY) {
        console.log("panStart is currently unsupported");
    }

    pan(x, y, deltax, deltay) {
        this.deltaX = deltax * .001;
        this.deltaY = deltay * .001;
        // console.log("pan is currently unsupported");
    }

    panEnd() {
        console.log("panEnd is currently unsupported");
    }

    press(x, y) {
        console.log("press is currently unsupported");
    }

    pressUp() {
        console.log("pressUp is currently unsupported");
    }

    doubleTap(x, y) {
        console.log("doubleTap is currently unsupported");
    }

    setSnappingMode(enabled) {
        this.snappingEnabled = enabled;
    }

    setAddMode(addToFront, addToBack, addToClosest) {
        this.addToFront = addToFront;
        this.addToBack = addToBack;
        this.addToClosest = addToClosest;
    }

    newCurve() {
        console.log("newCurve is currently unsupported");
    }

    deleteLastHandle() {
        console.log("deleteLastHandle is currently unsupported");
    }

    addHandle() {
        console.log("addHandle is currently unsupported");
    }

    /* Deletes the last modified curve */
    deleteLastCurve() {        
        if (this.selectedCurve != -1) {
            this.curves.splice(this.selectedCurve, 1);
            this.selectedCurve = -1;
            this.selectedHandle = -1;
        }

        this.backup();
    }

    deleteAll() {
        this.curves = [];
        this.selectedCurve = -1;
        this.selectedHandle = -1;

        this.backup();
    }

    setControlPolygonVisibility(visible) {
        this.showControlPolygons = visible;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showControlPolygon = this.showControlPolygons;
        }
    }

    setControlHandleVisibility(visible) {
        this.showControlHandles = visible;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showControlPoints = this.showControlHandles;
        }
    }

    setCurveVisibility(visible) {
        this.showCurves = visible;
        for (var j = 0; j < this.curves.length; ++j) {
            this.curves[j].showCurve = this.showCurves;
        }
    }

    resetCamera() {
        console.log("resetCamera is currently unsupported");
    }

    getNumCtlPointsOfSelected() {
        if (this.selectedCurve == -1)
            return -1;
        else {
            return this.curves[this.selectedCurve].getNumCtlPoints();
        }
    }

    getSelectedCurve() {
        if (this.selectedCurve == -1)
            return -1;
        else {
            return this.curves[this.selectedCurve];
        }
    }

    render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - this.then;
        this.then = now;
        let gl = this.gl;

        /* Set OpenGL state */
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        /* Setup the projection */
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const perspectiveMatrix = mat4.create();

        let viewDistance = 1.0;

        if (this.ortho) {
            mat4.ortho(perspectiveMatrix, -aspect * viewDistance, aspect*viewDistance, -viewDistance, viewDistance, this.near, this.far)
        } else {
            mat4.perspective(perspectiveMatrix, this.fovy, aspect, this.near, this.far);
        }
        let view = mat4.create();
        let eye = vec3.create();
        let center = vec3.create();
        let up = vec3.create();
        vec3.set(eye, 0.0, 0.0, 1.0)
        vec3.set(center, 0.0, 0.0, 0.0)
        vec3.set(up, 0.0, 1.0, 0.0)
        mat4.lookAt(view, eye, center, up);
        mat4.multiply(perspectiveMatrix, perspectiveMatrix, view);
        mat4.scale(perspectiveMatrix, perspectiveMatrix, [1.0/this.zoom, 1.0/this.zoom, 1.0/this.zoom]);

        
        /* Move the camera */
        

        const modelViewMatrix = mat4.create();
        mat4.rotate(modelViewMatrix, modelViewMatrix, this.rotX + now * .2, [0, 1, 0]);
        // mat4.rotate(modelViewMatrix, modelViewMatrix, this.rotY, [1, 0, 0]);

        this.rotX += this.deltaX;
        this.rotY += this.deltaY;
        this.deltaX *= .99;
        this.deltaY *= .99;

        /* Resize lines */
        for (let i = 0; i < this.curves.length; ++i) {
            this.curves[i].handleRadius = .01 * this.zoom;//.005;//30 / this.zoom;
            this.curves[i].handleThickness = .005;//5 / this.zoom;
            this.curves[i].thickness = .005;//5 / this.zoom;
        }

        /* Draw all unselected curves */
        for (let i = 0; i < this.curves.length; ++i) {
            if (!this.curves[i].selected)
                this.curves[i].draw(perspectiveMatrix, modelViewMatrix, aspect, now);
        }

        /* Draw all selected curves */
        for (let i = 0; i < this.curves.length; ++i) {
            if (this.curves[i].selected)
                this.curves[i].draw(perspectiveMatrix, modelViewMatrix, aspect, now);
        }
    }
}

export { CurveEditor };