import { CurveEditor } from "./CurveEditor.js"
import { Curve } from "./Curve.js"

/* Is this required? */
let curveEditor;

const render = function (time) {
    curveEditor.render(time);
    requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
    curveEditor = new CurveEditor();
    requestAnimationFrame(render);

    var button = document.getElementById("newCurve");
    button.addEventListener("click", (e) => { curveEditor.newCurve() });

    var deleteButton = document.getElementById("Delete");
    deleteButton.addEventListener("click", (e) => { curveEditor.deleteLastHandle() })

    var deleteCurveButton = document.getElementById("DeleteCurve");
    deleteCurveButton.addEventListener("click", (e) => { curveEditor.deleteLastCurve() })

    var hideControlPolygonButton = document.getElementById("HideControlPolygons");
    hideControlPolygonButton.addEventListener("click", (e) => { curveEditor.hideControlPolygons() })

    var hideControlHandlesButton = document.getElementById("HideControlHandles");
    hideControlHandlesButton.addEventListener("click", (e) => { curveEditor.hideControlHandles() })

    var hideCurves = document.getElementById("HideCurves");
    hideCurves.addEventListener("click", (e) => { curveEditor.hideCurves() })


    
    
    

    var addToFront = document.getElementById("ToggleFrontMode");
    addToFront.addEventListener("click", (e) => { curveEditor.setAddMode(true, false, false) })

    var addToBack = document.getElementById("ToggleEndMode");
    addToBack.addEventListener("click", (e) => { curveEditor.setAddMode(false, true, false) })

    var addToClosest = document.getElementById("ToggleClosestMode");
    addToClosest.addEventListener("click", (e) => { curveEditor.setAddMode(false, false, true) })





    var UploadFileButton = document.getElementById("UploadFile");
    UploadFileButton.addEventListener("change", (e) => {
        function cleanArray(actual) {
            var newArray = new Array();
            for (var i = 0; i < actual.length; i++) {
                var temp = actual[i].trim()
                if (temp.indexOf('#') != -1) {
                    temp = temp.substring(0, temp.indexOf('#'));
                }
                if (temp && temp.length >= 1) {
                    newArray.push(temp);
                }
            }
            return newArray;
        }

        function assert(condition, message) {
            if (!condition) {
                message = message || "Assertion failed";
                if (typeof Error !== "undefined") {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        }
        
        var selectedFile = event.target.files[0];
        var filename = event.target.files[0].name;
        var reader = new FileReader();
        reader.onload = (event) => {
            var lines = event.target.result.split("\n");
            lines = cleanArray(lines)
            var numCurves = parseInt(lines[0], 10);
            assert(numCurves >=0, "Number of curves must be greater than or equal to zero! (P >= 0)")
            lines = lines.splice(1)
            
            var curves = [];
            var lineIdx = 0;
            for (var i = 0; i < numCurves; ++i) {
                curves[i] = new Curve();
                var numPoints = -1;
                /* remove the P, get total points in first line */
                lines[lineIdx] = lines[lineIdx].substring(1)
                lines[lineIdx] = lines[lineIdx].trim()
                numPoints = parseInt(lines[lineIdx])
                lines = lines.splice(1)
                
                console.log("new curve")
                curves[i].controlPoints = []
                for (var j = 0; j < numPoints; ++j)  {
                    var separators = [' ', '\t'];
                    var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
                    strArray = cleanArray(strArray)
                    assert(strArray.length == 2);
                    var x = parseFloat(strArray[0])
                    var y = parseFloat(strArray[1])
                    console.log("x: " + x + " y: " + y); 
                    lines = lines.splice(1)
                    if (numPoints < 100 || j%2 == 0) {
                        curves[i].controlPoints.push(x * 50.0, -y * 50.0, 0.0)
                    }
                }

                if (filename.endsWith(".crv")) {
                    curves[i].showCurve = false; 
                    curves[i].showControlPolygon = true;
                    curves[i].showControlPoints = false;
                }
                curveEditor.curves.push(curves[i])
            }
            console.log(lines);
        }
        reader.readAsText(selectedFile);
    });


    // Function to download data to a file
    function download(data, filename, type) {
        var file = new Blob([data], {type: type});
        if (window.navigator.msSaveOrOpenBlob) // IE10+
            window.navigator.msSaveOrOpenBlob(file, filename);
        else { // Others
            var a = document.createElement("a"),
                    url = URL.createObjectURL(file);
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);  
            }, 0); 
        }
    }

    var Save = document.getElementById("Save");
    Save.addEventListener("click", (e) => { 
        var text = ""
        text += curveEditor.curves.length + "\n"
        for (var i = 0; i < curveEditor.curves.length; ++i) {
            text += "P " + (curveEditor.curves[i].controlPoints.length / 3) + "\n";
            for (var j = 0; j < curveEditor.curves[i].controlPoints.length / 3; ++j) {
                text += curveEditor.curves[i].controlPoints[j * 3 + 0] / 50.0 + "    ";
                text += curveEditor.curves[i].controlPoints[j * 3 + 1] / -50.0 + "\n"
            }
        }
        download(text, "Curve.dat", "text")
        })

    var FullScreen = document.getElementById("FullScreen");
    FullScreen.addEventListener("click", (e) => {
        var elem = document.getElementById("myvideo");
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullScreen) {
            elem.webkitRequestFullScreen();
        }
    });

});

window.onresize = function () {
    curveEditor.resize()
};
