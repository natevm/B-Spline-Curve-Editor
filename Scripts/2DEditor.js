import { CurveEditor } from "./2DCurveEditor.js"
import { KnotEditor } from "./KnotEditor.js"
import { Curve } from "./Curve.js"

let curveEditor;
let knotEditor;
let knotEditorOpen = false;

/* Main AngularJS controller */
angular
    .module('BSplineEditor', ['ngMaterial', 'ngMessages', 'ngSanitize'])
    .config(function ($mdIconProvider, $mdThemingProvider) {
        $mdIconProvider
            .defaultIconSet('img/icons/sets/core-icons.svg', 24);

        $mdThemingProvider.definePalette('black', {
            '50': '323639', // Background color of bottom sheet
            '100': '111111',
            '200': '202124', // select
            '300': '323639', // primary/warn
            '400': '444444',
            '500': '555555', // primary/warn 
            '600': 'FFFFFF', // background accent
            '700': '777777',
            '800': '888888', // primary/warn
            '900': 'FFFFFF',
            'A100': '202124', // primary/warn   accent    background
            'A200': 'FFFFFF', // accent (text)
            'A400': 'CCCCCC', // accent
            'A700': 'DDDDDD', // accent
            'contrastDefaultColor': 'light'
        });

        $mdThemingProvider.theme('default')
            .primaryPalette('black', { 'default': '600' })
            .accentPalette('black', { 'default': '600' })
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
    .controller('BSplineCtrl', function BSplineCtrl($mdDialog, $mdBottomSheet, $mdToast, $scope, $timeout, $window) {
        $scope.settings = {
            printLayout: true,
            showControlPolygon: true,
            showControlHandles: true,
            showCurve: true,
            minzoom: 1,
            maxzoom: 1000,
            zoom: 400,
            snapping: true,
            snapToXEnabled: true,
            snapToYEnabled: true,
            fullScreen: false,
            insertionMode: 'back',
            editMode: 'edit',
            designName: (localStorage.getItem("design_name") == undefined) ? "Untitled design" : localStorage.getItem("design_name")
        };

        $timeout(function () {
            const render = function (time) {
                curveEditor.render(time);
                knotEditor.render(time);
                requestAnimationFrame(render);
            };

            window.onresize = function () {
                curveEditor.resize()
                knotEditor.resize()
            };

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

            // var UploadBezierFileButton = document.getElementById("UploadBezierFile");
            // UploadBezierFileButton.addEventListener("change", (e) => {
            //     var selectedFile = event.target.files[0];
            //     var filename = event.target.files[0].name;
            //     var reader = new FileReader();
            //     reader.onload = (event) => {
            //         var lines = event.target.result.split("\n");
            //         lines = cleanArray(lines)
            //         var numCurves = parseInt(lines[0], 10);
            //         assert(numCurves >= 0, "Number of curves must be greater than or equal to zero! (P >= 0)")
            //         lines = lines.splice(1)

            //         var curves = [];
            //         var lineIdx = 0;
            //         for (var i = 0; i < numCurves; ++i) {
            //             curves[i] = new Curve();
            //             var numPoints = -1;
            //             /* remove the P, get total points in first line */
            //             lines[lineIdx] = lines[lineIdx].substring(1)
            //             lines[lineIdx] = lines[lineIdx].trim()
            //             numPoints = parseInt(lines[lineIdx])
            //             lines = lines.splice(1)

            //             console.log("new curve")
            //             curves[i].controlPoints = []
            //             for (var j = 0; j < numPoints; ++j) {
            //                 var separators = [' ', '\t'];
            //                 var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
            //                 strArray = cleanArray(strArray)
            //                 assert(strArray.length == 2);
            //                 var x = parseFloat(strArray[0])
            //                 var y = parseFloat(strArray[1])
            //                 console.log("x: " + x + " y: " + y);
            //                 lines = lines.splice(1)
            //                 if (numPoints < 100 || j % 2 == 0) {
            //                     curves[i].controlPoints.push(x, -y, 0.0)
            //                 }
            //             }
            //             curves[i].setDegree(numPoints - 1);

            //             if (filename.endsWith(".crv")) {
            //                 curves[i].showCurve = false;
            //                 curves[i].showControlPolygon = true;
            //                 curves[i].showControlPoints = false;
            //             }
            //             curveEditor.curves.push(curves[i])
            //         }
            //         console.log(lines);
            //         curveEditor.backup();
            //     }
            //     reader.readAsText(selectedFile);
            // });


            var UploadBSplineFileButton = document.getElementById("UploadBSplineFile");
            UploadBSplineFileButton.addEventListener("change", (e) => {
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
                    for (var i = 0; i < numCurves; ++i) {
                        curves[i] = new Curve();
                        var numPoints = -1;
                        var degree = -1;

                        /* Get the degree */
                        lines[0] = lines[0].trim()
                        degree = parseInt(lines[0]);
                        lines = lines.splice(1)

                        /* Get total points in first line */
                        lines[0] = lines[0].trim()
                        numPoints = parseInt(lines[0])
                        lines = lines.splice(1)

                        // console.log("new curve")

                        /* Parse control points */
                        curves[i].controlPoints = []
                        for (var j = 0; j < numPoints; ++j) {
                            var separators = [' ', '\t'];
                            var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
                            strArray = cleanArray(strArray)
                            assert(strArray.length == 2);
                            var x = parseFloat(strArray[0])
                            var y = parseFloat(strArray[1])
                            // console.log("x: " + x + " y: " + y);
                            lines = lines.splice(1)
                            if (numPoints < 100 || j % 2 == 0) {
                                curves[i].controlPoints.push(x, -y, 0.0)
                            }
                        }

                        curves[i].setDegree(degree);

                        /* Parse knot */
                        var knotProvided = 0;
                        lines[0] = lines[0].trim()
                        knotProvided = parseInt(lines[0])
                        lines = lines.splice(1)

                        if (knotProvided == 0) {
                            curves[i].setOpen(true);
                            curves[i].setUniformity(true);
                        } else {
                            curves[i].setOpen(false);
                            curves[i].setUniformity(false);
                            var separators = [' ', '\t'];
                            var strArray = lines[0].split(new RegExp('[' + separators.join('') + ']', 'g'));
                            strArray = cleanArray(strArray)
                            var knot = [];
                            for (var j = 0; j < strArray.length; ++j) {
                                knot.push(parseFloat(strArray[j]));
                            }

                            assert(knot.length == ((degree + 1) + (curves[i].controlPoints.length / 3) ))

                            /* normalize the knot */
                            var min = knot[0];
                            var max = knot[knot.length - 1];
                            for (var j = 0; j < knot.length; ++j) {
                                knot[j] -= min;
                                knot[j] /= (max - min);
                            }
                            curves[i].knot_vector = knot;
                            lines = lines.splice(1)
                        }


                        if (filename.endsWith(".crv")) {
                            curves[i].showCurve = false;
                            curves[i].showControlPolygon = true;
                            curves[i].showControlPoints = false;
                        }
                        curveEditor.curves.push(curves[i])
                    }
                    console.log(lines);
                    curveEditor.backup();
                }
                reader.readAsText(selectedFile);
                document.getElementById("UploadBSplineFile").value = ""
            });

            curveEditor = new CurveEditor();
            knotEditor = new KnotEditor();
            requestAnimationFrame(render);
        });



        $scope.sampleAction = function (name, ev) {
            $mdDialog.show($mdDialog.alert()
                .title(name)
                .textContent('You triggered the "' + name + '" action')
                .ok('Great')
                .targetEvent(ev)
            );
        };

        $scope.undo = function (ev) {
            /* move up undo stack */
            if (curveEditor.undo() == false) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: cannot undo further.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
            } else {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Undo')
                        .position('bottom right')
                        .hideDelay(3000)
                );
            }
        };

        $scope.redo = function (ev) {
            /* move down undo stack */
            if (curveEditor.redo() == false) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent('Error: cannot redo further')
                    .position('bottom right')
                    .hideDelay(3000)
                );
            }
            else {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent('Redo')
                    .position('bottom right')
                    .hideDelay(3000)
                );
            }
        };

        $scope.cut = function (ev) {
            /* If no curve selected, toast error */
            if (curveEditor.getSelectedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: no curve selected.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }
            
            /* else copy selected curve */
            curveEditor.copySelectedCurve();

            /* then, delete selected curve */
            curveEditor.deleteLastCurve();

            $mdToast.show(
                $mdToast.simple()
                    .textContent('Curve cut')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        };

        $scope.copy = function (ev) {
            /* If no curve selected, toast error */
            if (curveEditor.getSelectedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: no curve selected.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }
            
            /* else copy selected curve */
            curveEditor.copySelectedCurve();

            $mdToast.show(
                $mdToast.simple()
                    .textContent('Curve copied')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        };

        $scope.paste = function (ev) {
            /* If no curve copied, toast error */
            if (curveEditor.getCopiedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: cut or copy a curve first.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }
            
            /* else paste copied curve */
            curveEditor.pasteCurve();

            $mdToast.show(
                $mdToast.simple()
                    .textContent('Curve pasted')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        };

        $scope.updateSnapping = function (ev) {
            curveEditor.setSnappingMode($scope.settings.snapping);
            $mdToast.show(
                $mdToast.simple()
                    .textContent("Snapping " + (($scope.settings.snapping) ? "enabled" : "disabled") + ".")
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        $scope.updateSnapToX = function (ev) {
            curveEditor.setSnapToXMode($scope.settings.snapToXEnabled);
            $mdToast.show(
                $mdToast.simple()
                    .textContent("Snapping to X " + (($scope.settings.snapToXEnabled) ? "enabled" : "disabled") + ".")
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        $scope.updateSnapToY = function (ev) {
            curveEditor.setSnapToYMode($scope.settings.snapToYEnabled);
            $mdToast.show(
                $mdToast.simple()
                    .textContent("Snapping to Y " + (($scope.settings.snapToYEnabled) ? "enabled" : "disabled") + ".")
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        

        $scope.updateVisibility = function (ev) {
            curveEditor.setControlPolygonVisibility($scope.settings.showControlPolygon);
            curveEditor.setControlHandleVisibility($scope.settings.showControlHandles);
            curveEditor.setCurveVisibility($scope.settings.showCurve);

            $mdToast.show(
                $mdToast.simple()
                    .textContent('Visibility updated.')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        };

        $scope.addCurve = function (ev) {
            console.log(ev);
            curveEditor.newCurve()
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Curve added.')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        };

        $scope.deleteCurve = function (ev) {
            if (curveEditor.getSelectedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: no curve selected.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }

            curveEditor.deleteLastCurve();
        };

        $scope.deleteLastHandle = function (ev) {
            if (curveEditor.getSelectedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Error: no handle selected.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }

            curveEditor.deleteLastHandle();
        }

        $scope.updateInsertionMode = function (ev) {
            console.log($scope.settings.insertionMode)
            if ($scope.settings.insertionMode == "front") {
                curveEditor.setAddMode(true, false, false);
            }
            if ($scope.settings.insertionMode == "back") {
                curveEditor.setAddMode(false, true, false);
            }
            if ($scope.settings.insertionMode == "closest") {
                curveEditor.setAddMode(false, false, true);
            }

            $mdToast.show(
                $mdToast.simple()
                    .textContent('Insertion mode updated.')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        $scope.updateEditMode = function (ev) {
            console.log($scope.settings.editMode)
            curveEditor.setEditMode($scope.settings.editMode);
            
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Edit mode updated.')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        $scope.toggleFullScreen = function (ev, toggle = false) {
            if (toggle) {
                $scope.settings.fullScreen = !$scope.settings.fullScreen;
            }
            if ($scope.settings.fullScreen) {
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

        $scope.goTo3DEditor = function (ev) {
            $window.location.href = "./3DEditor.html"
        }

        $scope.resetCamera = function (ev) {
            $scope.settings.zoom = 400;
            curveEditor.resetCamera();
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Camera reset.')
                    .position('bottom right')
                    .hideDelay(3000)
            );
        }

        $scope.updateZoom = function () {
            var amount = $scope.settings.zoom / 1000.0;
            amount *= 4;
            amount += 1;
            // // amount *= 1000;

            curveEditor.updateZoom(amount);
        }

        $scope.save = function (ev) {
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

            var text = "# Number of curves: \n"
            text += curveEditor.curves.length + "\n"
            for (var i = 0; i < curveEditor.curves.length; ++i) {
                text += "\n# Curve " + i + "\n";
                text += "# Degree: \n";
                text += curveEditor.curves[i].getDegree() + "\n";
                text += "# Number of control points: \n";
                text += curveEditor.curves[i].getNumCtlPoints() + "\n";
                text += "# Control point data: \n";
                for (var j = 0; j < curveEditor.curves[i].getNumCtlPoints(); ++j) {
                    text += curveEditor.curves[i].controlPoints[j * 3 + 0] + "    ";
                    text += curveEditor.curves[i].controlPoints[j * 3 + 1] * -1.0 + "    \n"
                }
                text += "# Knot present: \n";
                text += "1 \n";
                text += "# Knot data: \n";
                for (var j = 0; j < curveEditor.curves[i].knot_vector.length; ++j) {
                    text += curveEditor.curves[i].knot_vector[j] + " ";
                }
                text += "\n";
            }
            download(text, $scope.settings.designName + ".dat", "text");
        };

        $scope.renameDesign = function (ev) {
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
                $scope.settings.designName = result;
                localStorage.setItem("design_name", $scope.settings.designName);
                curveEditor.setShortcutsEnabled(true);

                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Project renamed to "' + $scope.settings.designName + '".')
                        .position('bottom right')
                        .hideDelay(3000)
                );
            }, () => {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Rename canceled.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                curveEditor.setShortcutsEnabled(true);
            });
        };

        $scope.newDesign = function (ev) {
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
                $scope.settings.designName = result;
                curveEditor.deleteAll();
                localStorage.setItem("design_name", $scope.settings.designName);
                curveEditor.setShortcutsEnabled(true);
            }, () => {
                console.log('New design canceled');
                curveEditor.setShortcutsEnabled(true);
            });
        };

        $scope.showHelp = function (ev) {
            $mdDialog.show($mdDialog.alert()
                .title("Help")
                .clickOutsideToClose(true)
                .htmlContent(
                    '<p>Click and hold to create or remove a control handle. <\p>'
                    + '<p>Click and drag on the empty region to move the camera. <\p>'
                    + '<p> Use the zoom slider to zoom in or out. <\p> '
                    + '<p> Edit knot vectors by clicking the abacus button on the top right. <\p>')
                .ok('Close')
                .targetEvent(ev)
            );
        };

        $scope.openBottomSheet = function (ev) {
            if (curveEditor.getSelectedCurve() == -1) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Select a curve first.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
                return;
            }
            if (knotEditorOpen == true) {
                $scope.closeBottomSheet();
                return;
            }
            knotEditorOpen = true;
            $scope.alert = '';
            $mdBottomSheet.show({
                templateUrl: 'bottom-sheet-grid-template.html',
                controller: 'KnotEditorCtrl',
                // clickOutsideToClose: false,
                disableBackdrop: false,
                disableParentScroll: true
            }).then(function (clickedItem) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent(clickedItem['name'] + ' clicked!')
                        .position('bottom right')
                        .hideDelay(1500)
                );
            }).catch(function (error) {
                // User clicked outside or hit escape
            });
        };

        $scope.closeBottomSheet = function (ev) {
            $mdBottomSheet.hide();
            console.log("closing");
            knotEditorOpen = false;
        }
    })
    .controller('KnotEditorCtrl', function ($scope, $mdToast, $mdDialog, $mdBottomSheet, $timeout) {
        $scope.data = {
            curve: curveEditor.getSelectedCurve(),
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
        });
        $scope.listItemClick = function () {
        };
        $scope.$on("$destroy", function () {
            knotEditor.clearWebGL();
            curveEditor.backup();
            knotEditorOpen = false;
        });
        $scope.updateDegree = function () {
            $scope.data.curve.setDegree($scope.data.degree);
            // knotEditor.generateUniformFloatingKnotVector();
            knotEditor.updateBasisFunctions();
            // curveEditor.backup();
        }
        $scope.increaseDegree = function () {
            if ($scope.data.degree >= 8) {
                var confirm = $mdDialog.confirm()
                    .title('Are you sure you like to increase the degree further?')
                    .textContent('A higher degree may decrease performance.')
                    .ariaLabel('Increase Degree Warning')
                    .ok('Please do it!')
                    .cancel('Cancel');

                $mdDialog.show(confirm).then(function () {
                    if (($scope.data.degree < $scope.data.maxDegree) && ($scope.data.degree < 100)) {
                        $scope.data.degree++;
                    } else {
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Maximum degree reached.')
                                .position('bottom right')
                                .hideDelay(3000)
                        );
                    }
                    $scope.updateDegree();
                }, function () {
                });
            }
            else {

                if (($scope.data.degree < $scope.data.maxDegree) && ($scope.data.degree < 100)) {
                    $scope.data.degree++;
                } else {
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Maximum degree reached.')
                            .position('bottom right')
                            .hideDelay(3000)
                    );
                }
                $scope.updateDegree();
            }
            

        }
        $scope.decreaseDegree = function () {
            if ($scope.data.degree > $scope.data.minDegree) {
                $scope.data.degree--;
            } else {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Minimum degree reached.')
                        .position('bottom right')
                        .hideDelay(3000)
                );
            }
            $scope.updateDegree();
        }

        $scope.updateUniformProperty = function () {
            $scope.data.curve.setUniformity($scope.data.makeUniform);
            knotEditor.updateBasisFunctions();
        }

        $scope.updateOpenProperty = function () {
            $scope.data.curve.setOpen($scope.data.makeOpen);
            knotEditor.updateBasisFunctions();
        }
    });