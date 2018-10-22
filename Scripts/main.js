import { CurveEditor } from "./CurveEditor.js"
import { KnotEditor } from "./KnotEditor.js"
import { Curve } from "./Curve.js"

/* Is this required? */
let curveEditor;
let knotEditor;

const render = function (time) {
    curveEditor.render(time);
    knotEditor.render(time);
    requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
    curveEditor = new CurveEditor();
    knotEditor = new KnotEditor();
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
    knotEditor.resize()
};

angular
    .module('BSplineEditor', ['ngMaterial', 'ngMessages', 'ngSanitize'])
    .config(function ($mdIconProvider, $mdThemingProvider) {
        $mdIconProvider
            .defaultIconSet('img/icons/sets/core-icons.svg', 24);

        $mdThemingProvider.definePalette('black', {
            '50': '222222', // Background color of bottom sheet
            '100': '111111',
            '200': '222222', // select
            '300': '333333', // primary/warn
            '400': '444444',
            '500': '555555', // primary/warn 
            '600': '2b9a2b', // background accent
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
    .controller('DemoBasicCtrl', function DemoCtrl($mdDialog, $mdBottomSheet, $mdToast, $scope) {
        this.settings = {
            printLayout: true,
            showControlPolygon: true,
            showControlHandles: true,
            showCurve: true,
            zoom: 25,
            snappingEnabled: true,
            fullScreen: false,
            insertionMode: 'closest',
            designName: (localStorage.getItem("design_name") == undefined) ? "Untitled design" : localStorage.getItem("design_name")
        };

        this.sampleAction = function (name, ev) {
            $mdDialog.show($mdDialog.alert()
                .title(name)
                .textContent('You triggered the "' + name + '" action')
                .ok('Great')
                .targetEvent(ev)
            );
        };

        this.updateSnapping = function (ev) {
            curveEditor.setSnappingMode(this.settings.snappingEnabled);
        }

        this.updateVisibility = function (ev) {
            curveEditor.setControlPolygonVisibility(this.settings.showControlPolygon);
            curveEditor.setControlHandleVisibility(this.settings.showControlHandles);
            curveEditor.setCurveVisibility(this.settings.showCurve);
        };

        this.addCurve = function(ev) {
            console.log(ev);
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

        this.resetCamera = function(ev) {
            curveEditor.resetCamera();
            this.settings.zoom = 25;
        }

        this.updateZoom = function() {
            curveEditor.updateZoom((this.settings.zoom * 2.0) / 100.0);
        }

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
            download(text, this.settings.designName + ".dat", "text");
        };

        this.renameDesign = function(ev) {
            curveEditor.setShortcutsEnabled(false);

            // Appending dialog to document.body to cover sidenav in docs app
            var confirm = $mdDialog.prompt()
            .title('What would you like to rename your design?')
            // .textContent('Bowser is a common name.')
            .placeholder('Design name')
            .ariaLabel('Design name')
            .initialValue('Untitled design')
            .targetEvent(ev)
            .required(true)
            .ok('Rename')
            .cancel('Cancel');

            $mdDialog.show(confirm).then((result) => {
                this.settings.designName = result;
                localStorage.setItem("design_name", this.settings.designName);
                curveEditor.setShortcutsEnabled(true);
            }, ()  => {
                console.log('Rename canceled');
                curveEditor.setShortcutsEnabled(true);
            });
        };

        this.newDesign = function(ev) {
            curveEditor.setShortcutsEnabled(false);

            // Appending dialog to document.body to cover sidenav in docs app
            var confirm = $mdDialog.prompt()
                .title('What would you like to call your design?')
                .textContent('WARNING: This will delete any unsaved progress')
                .placeholder('Design name')
                .ariaLabel('Design name')
                .initialValue('Untitled design')
                .targetEvent(ev)
                .required(true)
                .ok('Create')
                .cancel('Cancel');

            $mdDialog.show(confirm).then((result) => {
                this.settings.designName = result;
                curveEditor.deleteAll();
                localStorage.setItem("design_name", this.settings.designName);
                curveEditor.setShortcutsEnabled(true);
            }, ()  => {
                console.log('New design canceled');
                curveEditor.setShortcutsEnabled(true);
            });
        };

        this.showHelp = function(ev) {
            $mdDialog.show($mdDialog.alert()
                .title("Help")
                .clickOutsideToClose(true)
                .htmlContent('<p>Click and hold to create/remove a control handle. <\p>  <p>Click and drag to move the camera. <\p> <p> Scroll to zoom. <\p> <p>Curves can be added or removed from the \"Edit\" menu.<\p> ')
                .ok('Close')
                .targetEvent(ev)
            );
        };

        $scope.openBottomSheet = function(ev) {
            $scope.alert = '';
            $mdBottomSheet.show({
                templateUrl: 'bottom-sheet-grid-template.html',
                controller: 'GridBottomSheetCtrl',
                clickOutsideToClose: true
            }).then(function(clickedItem) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(clickedItem['name'] + ' clicked!')
                    .position('top right')
                    .hideDelay(1500)
                );
            }).catch(function(error) {
            // User clicked outside or hit escape
            });
          };
        
        this.closeBottomSheet = function(ev) {
            $mdBottomSheet.hide();
            console.log("closing");
        }
    })
    .controller('GridBottomSheetCtrl', function($scope, $mdBottomSheet, $timeout) {
        $scope.data = {
            curve : curveEditor.getSelectedCurve(),
            degree: curveEditor.getSelectedCurve().getDegree(),
            minDegree: 1,
            maxDegree: curveEditor.getNumCtlPointsOfSelected() - 1,
            makeOpen: curveEditor.getSelectedCurve().isOpen,
            makeUniform: curveEditor.getSelectedCurve().isUniform
        };
        $timeout(function () {
            knotEditor.initializeWebGL();            
            knotEditor.setCurve($scope.data.curve);
            knotEditor.updateBasisFunctions();
            curveEditor.backup();
        });
        $scope.listItemClick = function() {
        };
        $scope.$on("$destroy", function() {
            knotEditor.clearWebGL();
            curveEditor.backup();
        });
        $scope.updateDegree = function() {
            $scope.data.curve.setDegree($scope.data.degree);
            // knotEditor.generateUniformFloatingKnotVector();
            knotEditor.updateBasisFunctions();
            curveEditor.backup();
        }
        $scope.increaseDegree = function() {
            if ($scope.data.degree < $scope.data.maxDegree) {
                $scope.data.degree++;
            }
            $scope.updateDegree();
        }
        $scope.decreaseDegree = function() {
            if ($scope.data.degree > $scope.data.minDegree) {
                $scope.data.degree--;
            }
            $scope.updateDegree();
        }

        $scope.updateUniformProperty = function() {
            $scope.data.curve.setUniformity($scope.data.makeUniform);
            knotEditor.updateBasisFunctions();
        }

        $scope.updateOpenProperty = function() {
            $scope.data.curve.setOpen($scope.data.makeOpen);
            knotEditor.updateBasisFunctions();
        }
    });