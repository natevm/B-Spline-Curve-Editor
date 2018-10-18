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
            assert(numCurves >= 0, "Number of curves must be greater than or equal to zero! (P >= 0)")
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
                for (var j = 0; j < numPoints; ++j) {
                    var separators = [' ', '\t'];
                    var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
                    strArray = cleanArray(strArray)
                    assert(strArray.length == 2);
                    var x = parseFloat(strArray[0])
                    var y = parseFloat(strArray[1])
                    console.log("x: " + x + " y: " + y);
                    lines = lines.splice(1)
                    if (numPoints < 100 || j % 2 == 0) {
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
});

window.onresize = function () {
    curveEditor.resize()
};

angular
    .module('BSplineEditor', ['ngMaterial', 'ngMessages'])
    .config(function ($mdIconProvider, $mdThemingProvider) {
        $mdIconProvider
            .defaultIconSet('img/icons/sets/core-icons.svg', 24);

        $mdThemingProvider.definePalette('black', {
            '50': '000000',
            '100': '111111',
            '200': '222222', // select
            '300': '333333', // primary/warn
            '400': '444444',
            '500': '555555', // primary/warn 
            '600': '00FF00', // background accent
            '700': '777777',
            '800': '888888', // primary/warn
            '900': '999999',
            'A100': '222222', // primary/warn   accent    background
            'A200': 'FFFFFF', // accent (text)
            'A400': 'CCCCCC', // accent
            'A700': 'DDDDDD', // accent
            'contrastDefaultColor': 'light'
        });

        $mdThemingProvider.theme('default')
            .primaryPalette('black', {'default': '600'})
            .accentPalette('black', {'default' : '600'})
            .warnPalette('black')
            .backgroundPalette('black')

        $mdThemingProvider.alwaysWatchTheme(true);
    })
    .filter('keyboardShortcut', function ($window) {
        return function (str) {
            if (!str) return;
            var keys = str.split('-');
            var isOSX = /Mac OS X/.test($window.navigator.userAgent);

            var separator = (!isOSX || keys.length > 2) ? '+' : '';

            var abbreviations = {
                M: isOSX ? '' : 'Ctrl',
                A: isOSX ? 'Option' : 'Alt',
                S: 'Shift'
            };

            return keys.map(function (key, index) {
                var last = index === keys.length - 1;
                return last ? key : abbreviations[key];
            }).join(separator);
        };
    })
    .controller('DemoBasicCtrl', function DemoCtrl($mdDialog) {
        this.settings = {
            printLayout: true,
            showControlPolygon: true,
            showControlHandles: true,
            showCurve: true,
            fullScreen: false,
            insertionMode: 'front'
        };

        this.sampleAction = function (name, ev) {
            $mdDialog.show($mdDialog.alert()
                .title(name)
                .textContent('You triggered the "' + name + '" action')
                .ok('Great')
                .targetEvent(ev)
            );
        };

        this.updateVisibility = function (ev) {
            curveEditor.setControlPolygonVisibility(this.settings.showControlPolygon);
            curveEditor.setControlHandleVisibility(this.settings.showControlHandles);
            curveEditor.setCurveVisibility(this.settings.showCurve);
        };

        this.addCurve = function(ev) {
            curveEditor.newCurve()
        };

        this.deleteCurve = function(ev) {
            curveEditor.deleteLastCurve();
        };

        this.deleteLastHandle = function(ev) {
            curveEditor.deleteLastHandle();
        }

        this.updateInsertionMode = function(ev) {
            console.log(this.settings.insertionMode)
            if (this.settings.insertionMode == "front") {
                curveEditor.setAddMode(true, false, false);
            }
            if (this.settings.insertionMode == "back") {
                curveEditor.setAddMode(false, true, false);
            }
            if (this.settings.insertionMode == "closest") {
                curveEditor.setAddMode(false, false, true);
            }
        }

        this.toggleFullScreen = function(ev) {
            if (this.settings.fullScreen) {
                var docElm = document.getElementById("editor");
                if (docElm.requestFullscreen) {
                    docElm.requestFullscreen();
                } else if (docElm.mozRequestFullScreen) {
                    docElm.mozRequestFullScreen();
                } else if (docElm.webkitRequestFullScreen) {
                    docElm.webkitRequestFullScreen();
                } else if (docElm.msRequestFullscreen) {
                    docElm.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        };

        this.save = function(ev) {
            // Function to download data to a file
            function download(data, filename, type) {
                var file = new Blob([data], { type: type });
                if (window.navigator.msSaveOrOpenBlob) // IE10+
                    window.navigator.msSaveOrOpenBlob(file, filename);
                else { // Others
                    var a = document.createElement("a"),
                        url = URL.createObjectURL(file);
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(function () {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 0);
                }
            }

            var text = ""
            text += curveEditor.curves.length + "\n"
            for (var i = 0; i < curveEditor.curves.length; ++i) {
                text += "P " + (curveEditor.curves[i].controlPoints.length / 3) + "\n";
                for (var j = 0; j < curveEditor.curves[i].controlPoints.length / 3; ++j) {
                    text += curveEditor.curves[i].controlPoints[j * 3 + 0] / 50.0 + "    ";
                    text += curveEditor.curves[i].controlPoints[j * 3 + 1] / -50.0 + "\n"
                }
            }
            download(text, "Curve.dat", "text");
        };
    });