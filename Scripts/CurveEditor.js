import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.pointJustAdded = false;
        this.selectedCurve = 0;
        this.selectedHandle = -1;
        this.showCurves = true;
        this.showControlPolygons = true;
        this.showControlHandles = true;
        this.then = 0.0;
        this.canvas = document.querySelector('#glcanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        this.position = { x: 0, y: 0 };
        this.originalPosition = { x: 0, y: 0 };
        this.zoom = 0.5;
        this.addMode = 0;
        this.addToFront = false;
        this.addToBack = false;
        this.addToClosest = true;
        this.zooming = false;
        this.panning = false;

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
        for (let i = 0; i < 1; ++i) {
            this.curves.push(new Curve());
            this.curves[i].controlPoints = []
            for (let j = 0; j < 5; ++j) {
                this.curves[i].addHandle((this.canvas.clientWidth / 4.0) * (2.0 * Math.random() - 1.0), (this.canvas.clientHeight / 4.0) * (2.0 * Math.random() - 1.0))
            }
        }

        /* Setup Hammer Events / */
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('pinch').set({
            enable: true
        });

        hammer.get('pan').set({
            threshold: 0
        });

        /* Pan */
        hammer.on('panstart', (e) => { 
            if (this.zooming) return;
            this.panStart(
                e.center.x / this.zoom - (this.gl.canvas.clientWidth / (2.0 * this.zoom)), 
                e.center.y / this.zoom - (this.gl.canvas.clientHeight / (2.0 * this.zoom))); 
            });
        hammer.on('pan', (e) => { 
            if (this.zooming) return;
            this.pan(
                (e.changedPointers[0].clientX/this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.changedPointers[0].clientY/this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)),
                e.deltaX/this.zoom, 
                e.deltaY/this.zoom); 
        });
        hammer.on('panend', (e) => { 
            if (this.zooming) return;
            this.panEnd(); });

        /* Press */
        hammer.on('press', (e) => { 
            this.press((e.center.x/this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                       (e.center.y/this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)));            
        });
        hammer.on('pressup', (e) => { this.pressUp(); });

        /* Pinch */
        hammer.on('pinchstart', (e) =>  {
            this.originalZoom = this.zoom;
        });
        hammer.on('pinch', (e) => { 
            this.zoom = this.originalZoom * e.scale;
            console.log(e.scale);
        });
        hammer.on('pinchend', (e) => { this.originalZoom = this.zoom; this.zooming = false; });

        this.canvas.onscroll = (e) => { 
            console.log(e)
        };

        /* Double tap */
        hammer.on('doubletap', (e) => { 
            this.doubleTap((e.center.x/this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                           (e.center.y/this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom))); 
        });
        
        /* Setup keyboard shortcuts */
        document.onkeyup = (e) => {
            console.log("The key code is: " + e.keyCode);
            if (e.keyCode == 67) this.hideCurves();
            if (e.keyCode == 76) this.hideControlPolygons();
            if (e.keyCode == 80) this.hideControlHandles();
            if (e.keyCode == 65) this.addHandle();
            if (e.keyCode == 46) this.deleteLastHandle();
            if (e.keyCode == 78) this.newCurve();
        };

        /* Prevent right clicking the webgl canvas */
        this.canvas.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        }

        document.addEventListener('wheel', (e) => {
            if (e.deltaY < 0.0) {
                this.zoom -= -e.deltaY * .001;
            } else {

                this.zoom += e.deltaY * .001;
            }
            console.log(e);
            }, { capture: false, passive: true})
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

    panStart(initialX, initialY) {
        this.panning = true;
        // console.log(e)
        /* Check if we're moving a point */
        this.selectedHandle = -1;
        // this.selectedCurve = -1;
        for (var j = 0; j < this.curves.length; ++j) {
            var ctl_idx = this.curves[j].getClickedHandle( initialX - this.position.x, initialY - this.position.y);
            if (ctl_idx != -1) {
                console.log("Handle " + ctl_idx + " was pressed");
                this.selectedHandle = ctl_idx;
                this.selectedCurve = j;
                break;
            }
        }

        if (this.selectedHandle == -1) {
            this.originalPosition = { x: this.position.x, y: this.position.y };
        }
    }

    pan(x, y, deltax, deltay) {
        if (!this.panning) return;
        if (this.selectedHandle == -1) {
            this.position.x = this.originalPosition.x + deltax;
            this.position.y = this.originalPosition.y + deltay;
        } else {
            this.pointJustAdded = false;
            this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                x - this.position.x,
                y - this.position.y);
        }
    }

    panEnd() {
        this.panning = false;
        if (this.selectedHandle == -1) {
            this.originalPosition = this.position;
        }
    }

    press(x, y) {
        if (this.selectedCurve != -1) {
            var ctl_idx = this.curves[this.selectedCurve].getClickedHandle(
                x - this.position.x,
                y - this.position.y);
            if (ctl_idx == -1) {
                if (this.pointJustAdded == false) {
                    this.curves[this.selectedCurve].addHandle(
                        x - this.position.x,
                        y - this.position.y, this.addToFront, this.addToBack, this.addToClosest);
                    this.selectedHandle = (this.curves[this.selectedCurve].controlPoints.length / 3) - 1;
                } else {
                    this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                        x - this.position.x,
                        y - this.position.y);
                }
                this.pointJustAdded = true;
            }
            else if (this.pointJustAdded == false) {
                this.selectedHandle = ctl_idx;
                this.deleteLastHandle();
                return;
            }
        }
    }

    setAddMode(addToFront, addToBack, addToClosest) {
        this.addToFront = addToFront;
        this.addToBack = addToBack;
        this.addToClosest = addToClosest;
    }

    pressUp() {
        this.pointJustAdded = false;
    }

    doubleTap(x, y) {
        if (this.selectedCurve == -1) {
            for (var j = 0; j < this.curves.length; ++j) {
                var ctl_idx = this.curves[j].getClickedHandle(
                    x - this.position.x,
                    y - this.position.y)
                if (ctl_idx != -1) {
                    this.curves[j].removeHandle(ctl_idx);
                    this.selectedCurve = j;
                    return;
                }
            }
        } else {
            var ctl_idx = this.curves[this.selectedCurve].getClickedHandle(
                x - this.position.x,
                y - this.position.y)
            if (ctl_idx != -1) {
                this.selectedHandle = ctl_idx;
                this.deleteLastHandle();
                return;
            }
            else {
                this.press(x, y); 
                this.pressUp(); 
            }
        }
    }

    /* Draws the curves to the screen */
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
        const orthoMatrix = mat4.create();
        mat4.ortho(orthoMatrix, -gl.canvas.clientWidth, gl.canvas.clientWidth, gl.canvas.clientHeight, -gl.canvas.clientHeight, -1.0, 1.0)
        let zoom = vec3.create();
        vec3.set(zoom, this.zoom, this.zoom, 1.0);
        mat4.scale(orthoMatrix, orthoMatrix, zoom);

        /* Move the camera */
        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [this.position.x, this.position.y, -1.0]);

        /* Now draw our curves */
        for (let i = 0; i < this.curves.length; ++i) {
            this.curves[i].draw(orthoMatrix, modelViewMatrix, aspect, now);
        }
    }

    /* Adds a new curve to the scene */
    newCurve() {
        this.curves.push(new Curve(-this.position.x, -this.position.y))
        this.selectedCurve = this.curves.length - 1;
    }

    /* Deletes the last clicked handle */
    deleteLastHandle() {
        if (this.selectedCurve != -1 && this.selectedHandle != -1) {
            if (this.curves[this.selectedCurve].controlPoints.length <= 3) {
                this.curves.splice(this.selectedCurve, 1);
                this.selectedCurve = -1;
                this.selectedHandle = -1;
            } else {
                console.log("Deleting point");
                this.curves[this.selectedCurve].removeHandle(this.selectedHandle);
                this.selectedHandle = -1;
            }
        }
    }

    addHandle() {
        if (this.selectedCurve != -1) {
            this.curves[this.selectedCurve].addHandle(-this.position.x/this.zoom, -this.position.y/this.zoom);
        }
    }

    /* Deletes the last modified curve */
    deleteLastCurve() {
        if (this.selectedCurve != -1) {
            this.curves.splice(this.selectedCurve, 1);
            this.selectedCurve = -1;
            this.selectedHandle = -1;
        }
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
}

export { CurveEditor };