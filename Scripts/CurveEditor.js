import { Curve } from "./Curve.js"

class CurveEditor {
    constructor() {
        this.pointJustAdded = false;
        this.selectedCurve = 0;
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
        this.zoom = 0.5;
        this.addMode = 0;
        this.addToFront = false;
        this.addToBack = false;
        this.addToClosest = true;
        this.snappingEnabled = true;
        this.zooming = false;
        this.panning = false;
        this.mousedown = false;
        this.touchstart = false;
        this.doubletapped = false;

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

        this.curves[0].select();

        /* Setup Hammer Events / */
        var hammer = new Hammer(this.canvas, {
            domEvents: true
        });

        hammer.get('press').set({
            time: 200
        });

        hammer.get('pan').set({
            threshold: 10,
            threshold: 9
        });

        /* Pan */
        hammer.on('panstart', (e) => {
            if (this.zooming) return;
            this.panStart(
                (e.changedPointers[0].clientX / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.changedPointers[0].clientY / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)),
                e.deltaX / this.zoom,
                e.deltaY / this.zoom);
        });
        hammer.on('pan', (e) => {
            if (this.zooming) return;
            this.pan(
                (e.changedPointers[0].clientX / this.zoom - this.gl.canvas.clientWidth / (2.0 * this.zoom)),
                (e.changedPointers[0].clientY / this.zoom - this.gl.canvas.clientHeight / (2.0 * this.zoom)),
                e.deltaX / this.zoom,
                e.deltaY / this.zoom);
        });
        hammer.on('panend', (e) => {
            if (this.zooming) return;
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

        document.addEventListener("mousedown", (e) => { this.mousedown = true; });
        document.addEventListener("mouseup", (e) => { 
            this.mousedown = false; 
            if (this.selectedCurve != -1) {
                this.curves[this.selectedCurve].clearTemporaryHandle();
            }            
        });
        document.addEventListener("touchstart", (e) => { this.mousedown = true; });
        document.addEventListener("touchend", (e) => { this.mousedown = false; });
        document.addEventListener("touchcancel", (e) => { this.mousedown = false; });
    }

    updateZoom(zoomAmount) {
        this.zoom = zoomAmount;
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
        this.selectedHandle = -1;
        for (var j = 0; j < this.curves.length; ++j) {
            var ctl_idx = this.curves[j].getClickedHandle(x - this.position.x, y - this.position.y);
            if (ctl_idx != -1) {
                this.selectedHandle = ctl_idx;
                if (this.selectedCurve != -1) 
                    this.curves[this.selectedCurve].deselect();
                this.selectedCurve = j;
                this.curves[j].select();
                this.curves[j].selectHandle(ctl_idx);
                break;
            }
        }
    }

    panStart(initialX, initialY, deltaX, deltaY) {
        if (this.selectedCurve != -1) {
            this.curves[this.selectedCurve].clearTemporaryHandle();
        }

        this.panning = true;

        /* Check if we're moving a point */
        this.selectedHandle = -1;

        /* First try to move a handle belonging to the selected curve */
        if (this.selectedCurve != -1) {
            var ctl_idx = this.curves[this.selectedCurve].getClickedHandle((initialX - deltaX) - this.position.x, (initialY - deltaY) - this.position.y);
            if (ctl_idx != -1) {
                this.selectedHandle = ctl_idx;
                this.curves[this.selectedCurve].selectHandle(ctl_idx);
            }
        }

        /* If we weren't able to select a handle belonging to the current curve, search through all possible curves. */
        if (this.selectedHandle == -1) {
            for (var j = 0; j < this.curves.length; ++j) {
                var ctl_idx = this.curves[j].getClickedHandle((initialX - deltaX) - this.position.x, (initialY - deltaY) - this.position.y);
                if (ctl_idx != -1) {
                    this.selectedHandle = ctl_idx;
                    if (this.selectedCurve != -1)
                        this.curves[this.selectedCurve].deselect();
                    this.selectedCurve = j;
                    this.curves[j].select();
                    this.curves[j].selectHandle(ctl_idx);
                    break;
                }
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

            /* If snapping is on, see if we can place this point over another */
            var handleUnderneath = -1;
            var otherHandlePos = [0.0, 0.0, 0.0];
            if (this.snappingEnabled) {
                for (var j = 0; j < this.curves.length; ++j) {
                    var ctl_idx = this.curves[j].getSnapPosition(x - this.position.x, y - this.position.y, this.selectedCurve == j, this.selectedHandle);
                    if ((ctl_idx != -1) && !((j == this.selectedCurve) && (ctl_idx == this.selectedHandle))) {
                        handleUnderneath = ctl_idx;
                        otherHandlePos = this.curves[j].getHandlePos(handleUnderneath);
                        break;
                    }
                }
            }

            if (handleUnderneath != -1) {
                this.curves[this.selectedCurve].moveHandle(this.selectedHandle, otherHandlePos[0], otherHandlePos[1]);
            }
            else {
                this.curves[this.selectedCurve].moveHandle(this.selectedHandle,
                    x - this.position.x,
                    y - this.position.y);
            }
        }
    }

    panEnd() {
        this.panning = false;
        if (this.selectedHandle == -1) {
            this.originalPosition = this.position;
        }

        this.backup();
    }

    press(x, y) {
        var deleting = false;
        console.log("pressing")
        if (this.selectedCurve != -1) {
            var ctl_idx = this.curves[this.selectedCurve].getClickedHandle(
                x - this.position.x,
                y - this.position.y);
            if (ctl_idx == -1) {
                this.curves[this.selectedCurve].setTemporaryHandle(x - this.position.x, y - this.position.y, 0.1, 1.0, 0.0, 1.0);
            }
            else {
                let handlePos = this.curves[this.selectedCurve].getHandlePos(ctl_idx);
                this.curves[this.selectedCurve].setTemporaryHandle(handlePos[0], handlePos[1], .6, 0.0, 0.0, 1.0);
                deleting = true;
            }
        }

        setTimeout(() => {
            if (this.selectedCurve != -1) {
                this.curves[this.selectedCurve].clearTemporaryHandle();
            }

            if (this.mousedown && this.panning == false) {
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
                this.backup();
            }

        }, deleting ? 600 : 400);

    }

    setSnappingMode(enabled) {
        this.snappingEnabled = enabled;
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
        console.log("doubletap")
        this.doubletapped = true;
        if (this.selectedCurve == -1) {
            for (var j = 0; j < this.curves.length; ++j) {
                var ctl_idx = this.curves[j].getClickedHandle(
                    x - this.position.x,
                    y - this.position.y)
                if (ctl_idx != -1) {
                    this.curves[j].removeHandle(ctl_idx);
                    if (this.selectedCurve != -1)
                        this.curves[this.selectedCurve].deselect();
                    this.selectedCurve = j;
                    this.curves[j].select();
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
                if (this.mousedown && this.panning == false) {
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
                    this.backup();
                }
                this.pressUp();
            }
        }

        this.backup();
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

        /* Draw all unselected curves */
        for (let i = 0; i < this.curves.length; ++i) {
            if (!this.curves[i].selected)
                this.curves[i].draw(orthoMatrix, modelViewMatrix, aspect, now);
        }

        /* Draw all selected curves */
        for (let i = 0; i < this.curves.length; ++i) {
            if (this.curves[i].selected)
                this.curves[i].draw(orthoMatrix, modelViewMatrix, aspect, now);
        }
    }

    /* Adds a new curve to the scene */
    newCurve() {
        this.curves.push(new Curve(-this.position.x, -this.position.y))
        if (this.selectedCurve != -1)
            this.curves[this.selectedCurve].deselect();
        this.selectedCurve = this.curves.length - 1;
        this.curves[this.selectedCurve].select();

        this.backup();
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

        this.backup();
    }

    addHandle() {
        if (this.selectedCurve != -1) {
            this.curves[this.selectedCurve].addHandle(-this.position.x / this.zoom, -this.position.y / this.zoom);
        }

        this.backup();
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
        this.position = { x: 0, y: 0 };
        this.originalPosition = { x: 0, y: 0 };
        this.zoom = 0.5;
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
}

export { CurveEditor };