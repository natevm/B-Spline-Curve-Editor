class Line {
    static initializeWebGL(gl) {
        console.log("Line initializing WebGL")
        let fsSource = "";
        let vsSource = "";

        let promises = [];
        promises.push($.ajax({
            url: "./Shaders/Line.vs",
            success: function (result) {
                vsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.vs with error ");
                console.log(result);
            }
        }));
        promises.push($.ajax({
            url: "./Shaders/Line.fs",
            success: function (result) {
                fsSource = result.trim();
            }, error: function (result) {
                console.log("failed to load Line.fs with error ");
                console.log(result);
            }
        }));

        if (!Line.ShaderPrograms) {
            Line.ShaderPrograms = []
        }

        if (!Line.ProgramInfo) {
            Line.ProgramInfo = []
        }

        Promise.all(promises).then(() => {
            Line.ShaderPrograms[gl] = Line.InitShaderProgram(gl, vsSource, fsSource);
            Line.ProgramInfo[gl] = {
                program: Line.ShaderPrograms[gl],
                attribLocations: {
                    position: gl.getAttribLocation(Line.ShaderPrograms[gl], 'position'),
                    next: gl.getAttribLocation(Line.ShaderPrograms[gl], 'next'),
                    previous: gl.getAttribLocation(Line.ShaderPrograms[gl], 'previous'),
                    direction: gl.getAttribLocation(Line.ShaderPrograms[gl], 'direction'),
                },
                uniformLocations: {
                    projection: gl.getUniformLocation(Line.ShaderPrograms[gl], 'projection'),
                    modelView: gl.getUniformLocation(Line.ShaderPrograms[gl], 'modelView'),
                    thickness: gl.getUniformLocation(Line.ShaderPrograms[gl], 'thickness'),
                    aspect: gl.getUniformLocation(Line.ShaderPrograms[gl], 'aspect'),
                    miter: gl.getUniformLocation(Line.ShaderPrograms[gl], 'miter'),
                    color: gl.getUniformLocation(Line.ShaderPrograms[gl], 'color'),
                },
            };
        });
    }

    static clearWebGL(gl) {
        console.log("Line clearing WebGL")
    }

    // Initialize a shader program, so WebGL knows how to draw our data
    static InitShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = Line.LoadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = Line.LoadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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

    constructor(gl, x = 0.0, y = 0.0) {
        this.numSamples = 200;
        this.thickness = 20.0;
        this.buffers = [];
        this.points = [
            -100.0 + x, y, 0.0,
            100.0 + x, y, 0.0,
        ];
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.updateBuffers(gl);
    }

    updateBuffers(gl) {
        if (!this.buffers[gl]) {
            this.buffers[gl] = {}
            this.buffers[gl].position = gl.createBuffer();
            this.buffers[gl].next = gl.createBuffer();
            this.buffers[gl].previous = gl.createBuffer();
            this.buffers[gl].direction = gl.createBuffer();
        }

        let next = [];
        let prev = [];
        let pos = [];
        let direction = []
        for (var i = 0; i < this.points.length / 3; ++i) {
            let iprev = Math.max(i - 1, 0);
            let inext = Math.min(i + 1, (this.points.length / 3) - 1);
            next.push(this.points[inext * 3 + 0], this.points[inext * 3 + 1], this.points[inext * 3 + 2])
            next.push(this.points[inext * 3 + 0], this.points[inext * 3 + 1], this.points[inext * 3 + 2])
            prev.push(this.points[iprev * 3 + 0], this.points[iprev * 3 + 1], this.points[iprev * 3 + 2])
            prev.push(this.points[iprev * 3 + 0], this.points[iprev * 3 + 1], this.points[iprev * 3 + 2])
            pos.push(this.points[i * 3 + 0], this.points[i * 3 + 1], this.points[i * 3 + 2])
            pos.push(this.points[i * 3 + 0], this.points[i * 3 + 1], this.points[i * 3 + 2])
            direction.push(-1, 1);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].previous);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(prev), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].next);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(next), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].direction);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(direction), gl.STATIC_DRAW);
    }

    freeBuffers(gl) {
        gl.deleteBuffer(this.buffers[gl].position)
        gl.deleteBuffer(this.buffers[gl].next)
        gl.deleteBuffer(this.buffers[gl].previous)
        gl.deleteBuffer(this.buffers[gl].direction)
        this.buffers[gl] = undefined;
        Line.ShaderPrograms[gl] = undefined;
        Line.ProgramInfo[gl] = undefined;
        console.log("I am freeing buffers!")
    }

    draw(gl, projection, modelView, aspect, time) {
        if (!Line.ShaderPrograms[gl]) return;

        // position values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].position);
            gl.vertexAttribPointer(
                Line.ProgramInfo[gl].attribLocations.position,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Line.ProgramInfo[gl].attribLocations.position);
        }

        // previous values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].previous);
            gl.vertexAttribPointer(
                Line.ProgramInfo[gl].attribLocations.previous,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Line.ProgramInfo[gl].attribLocations.previous);
        }

        // next values
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].next);
            gl.vertexAttribPointer(
                Line.ProgramInfo[gl].attribLocations.next,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Line.ProgramInfo[gl].attribLocations.next);
        }

        // direction
        {
            const numComponents = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[gl].direction);
            gl.vertexAttribPointer(
                Line.ProgramInfo[gl].attribLocations.direction,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(
                Line.ProgramInfo[gl].attribLocations.direction);
        }


        // Tell WebGL to use our program when drawing
        gl.useProgram(Line.ProgramInfo[gl].program);

        // Set the shader uniforms
        gl.uniformMatrix4fv(
            Line.ProgramInfo[gl].uniformLocations.projection,
            false,
            projection);

        gl.uniformMatrix4fv(
            Line.ProgramInfo[gl].uniformLocations.modelView,
            false,
            modelView);

        gl.uniform1f(
            Line.ProgramInfo[gl].uniformLocations.thickness,
            this.thickness);

        gl.uniform1f(
            Line.ProgramInfo[gl].uniformLocations.aspect,
            aspect);

        gl.uniform1i(
            Line.ProgramInfo[gl].uniformLocations.miter,
            1);

        gl.uniform4fv(
            Line.ProgramInfo[gl].uniformLocations.color,
            this.color);

        {
            const vertexCount = (this.points.length / 3) * 2;
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
        }
    }
}

export { Line }