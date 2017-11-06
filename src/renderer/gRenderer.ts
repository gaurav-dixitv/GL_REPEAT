
import * as Utils from '../utils/utils'

(global as any).PIXI = require('pixi');
(global as any).Phaser = require('phaser');

export class GRenderer {

    /**
     * Creates an instance of GRenderer.
     * @param {Phaser.Game} game 
     * @memberof GRenderer
     */
    public constructor(game: Phaser.Game) {
        this.game = game;
        this.mDrawElementsCount = 0;
        this.mIndexCount = 0;

        this.mVerticesFloat32 = null;
        this.mIndicesUint16 = null;

        this.mVerticesFloat32Index = 0;
        this.mIndicesFloat32Index = 0;
        this.mTextureCoordsFloat32Index = 0;

        this.initProgram();
        this.init();
    }


    /**
     * Uploads a texture to unit 1. (Assumes POT!)
     * 
     * @private
     * @param {Phaser.Image} texture 
     * @memberof GRenderer
     */
    private processTexture(texture: Phaser.Image) {
        this.gl.activeTexture(this.gl.TEXTURE0 + 1);
        let glTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, glTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.texture.baseTexture.premultipliedAlpha);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, texture.texture.baseTexture.source);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    /**
     * Converts input points to quads with a repeating texture.
     * 
     * @param {GPoint[]} rawData 
     * @param {string} key 
     * @param {string} [frame=''] 
     * @memberof GRenderer
     */
    public addRawRepeatingTexture(rawData: GPoint[], key: string, frame: string = '') {

        let image = this.game.add.image(0, 0, key, frame);
        let samplerIndex = 0;
        this.processTexture(image);

        let scaledWidth = image.texture.baseTexture.width * Utils.deviceConfig.scaleFactor() * 0.3; //scaled down to 0.3 to highlight the repeat.
        let verticalExtendedLength = Utils.deviceConfig.worldBoundVerticalSpan() * 0.7;
        image.destroy();

        let repeatYCount = (verticalExtendedLength / scaledWidth);
        let lastU = 0.0;
        let lastV = 0.0;

        let vertices: number[] = [];
        let textureCoords: number[] = [];
        let indices: number[] = [];
        for (let i = 0; i < rawData.length; i += 2) {

            //bottom left
            vertices[vertices.length] = rawData[i].x;
            vertices[vertices.length] = rawData[i].y + verticalExtendedLength;
            vertices[vertices.length] = 1;

            //top left
            vertices[vertices.length] = rawData[i].x;
            vertices[vertices.length] = rawData[i].y;
            vertices[vertices.length] = 1;

            //top right
            vertices[vertices.length] = rawData[i + 1].x;
            vertices[vertices.length] = rawData[i + 1].y;
            vertices[vertices.length] = 1;

            //bottom right
            vertices[vertices.length] = rawData[i + 1].x;
            vertices[vertices.length] = rawData[i + 1].y + verticalExtendedLength;
            vertices[vertices.length] = 1;

            let factor = (rawData[i + 1].x - rawData[i].x) / scaledWidth;

            let y1 = ((rawData[i].y + verticalExtendedLength) - rawData[i].y);
            let y2 = ((rawData[i].y + verticalExtendedLength) - rawData[i + 1].y);
            let percent = (y1 - y2) / y1;
            percent *= repeatYCount;

            //bottom left
            textureCoords[textureCoords.length] = 0.0 + lastU;
            textureCoords[textureCoords.length] = (1.0 * repeatYCount) + lastV;
            textureCoords[textureCoords.length] = samplerIndex;
            textureCoords[textureCoords.length] = 0.0;

            //top left
            textureCoords[textureCoords.length] = 0.0 + lastU;
            textureCoords[textureCoords.length] = 0.0 + lastV;
            textureCoords[textureCoords.length] = samplerIndex;
            textureCoords[textureCoords.length] = 1.0;

            //top right
            textureCoords[textureCoords.length] = factor + lastU;
            textureCoords[textureCoords.length] = 0.0 + percent + lastV;//((i == 1) ? 0.6 : percent);
            textureCoords[textureCoords.length] = samplerIndex;
            textureCoords[textureCoords.length] = 1.0;

            //bottom right
            textureCoords[textureCoords.length] = factor + lastU;
            textureCoords[textureCoords.length] = (1.0 * repeatYCount) + percent + lastV;//((i == 1) ? 0.6 : percent);
            textureCoords[textureCoords.length] = samplerIndex;
            textureCoords[textureCoords.length] = 0.0;

            lastU = (factor + lastU) - Math.floor(factor + lastU);
            lastV += percent;

            indices[indices.length] = this.mIndexCount;
            indices[indices.length] = this.mIndexCount + 1;
            indices[indices.length] = this.mIndexCount + 2;
            indices[indices.length] = this.mIndexCount;
            indices[indices.length] = this.mIndexCount + 2;
            indices[indices.length] = this.mIndexCount + 3;
            this.mIndexCount += 4;
        }
        this.uploadData(vertices, indices, textureCoords);
    }


    /**
     * Make a draw call.
     * 
     * @memberof GRenderer
     */
    public render() {

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mVertexBuffer);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndexBuffer);

        this.gl.enableVertexAttribArray(this.mAVertexCoordsLocation);
        this.gl.vertexAttribPointer(this.mAVertexCoordsLocation, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mTextureBuffer);
        this.gl.enableVertexAttribArray(this.mATextureCoordsLocation);
        this.gl.vertexAttribPointer(this.mATextureCoordsLocation, 4, this.gl.FLOAT, false, 0, 0);

        this.mViewMatrix[6] = -this.game.camera.view.x;
        this.mViewMatrix[7] = -this.game.camera.view.y;
        this.gl.uniformMatrix3fv(this.mUViewMatrixLocation, false, this.mViewMatrix);
        
        this.gl.uniform1f(this.mUTimeLocation, this.game.time.now / 1000);

        this.gl.drawElements(this.gl.TRIANGLES, this.mDrawElementsCount, this.gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Cleanup webgl.
     * 
     * @memberof GRenderer
     */
    public shutdown() {

        this.restoreProgram();

        if (this.mVertexBuffer) this.gl.deleteBuffer(this.mVertexBuffer);
        if (this.mIndexBuffer) this.gl.deleteBuffer(this.mIndexBuffer);
        if (this.mTextureBuffer) this.gl.deleteBuffer(this.mTextureBuffer);

        let textureUnitsCount = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
        for (let unit = 0; unit < textureUnitsCount; ++unit) {
            this.gl.activeTexture(this.gl.TEXTURE0 + unit);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);

        let unbinderBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, unbinderBuffer);
        let numAttributes = this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS);
        for (let attrib = 0; attrib < numAttributes; ++attrib) {
            this.gl.vertexAttribPointer(attrib, 1, this.gl.FLOAT, false, 0, 0);
        }

        this.gl.deleteBuffer(unbinderBuffer);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

        this.mShaderProgram = null;

        this.mVerticesFloat32 = null;
        this.mIndicesUint16 = null;
        this.mTextureCoordsFloat32 = null;
        this.mViewMatrix = null;
    }


    /**
     * Restore phaser's shader program.
     * 
     * @memberof GRenderer
     */
    public restoreProgram() {
        if (this.mOriginalProgram) this.gl.useProgram(this.mOriginalProgram);
        else if (DEBUG) console.warn("GRenderer: Could not restore program.");
    }

    /**
     * Use Grenderer's shader program.
     * 
     * @memberof GRenderer
     */
    public useProgram() {
        if (this.mShaderProgram) this.gl.useProgram(this.mShaderProgram);
        else if (DEBUG) console.warn("GRenderer: Could not use program.");
    }

    /**
     * Init everything webgl.
     * 
     * @private
     * @memberof GRenderer
     */
    private init() {
        let currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
        if (currentProgram) this.mOriginalProgram = currentProgram;
        else if (DEBUG) console.warn("GRenderer: Did not save a program to restore.");
        this.useProgram();
        this.createBuffers();
        this.initGLSLParameters();
        this.initBuffers();
    }

    /**
     * Create needed buffers.
     * 
     * @private
     * @memberof GRenderer
     */
    private createBuffers() {
        if (this.mVertexBuffer) this.gl.deleteBuffer(this.mVertexBuffer);
        this.mVertexBuffer = this.gl.createBuffer();
        if (this.mIndexBuffer) this.gl.deleteBuffer(this.mIndexBuffer);
        this.mIndexBuffer = this.gl.createBuffer();
        if (this.mTextureBuffer) this.gl.deleteBuffer(this.mTextureBuffer);
        this.mTextureBuffer = this.gl.createBuffer();

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mVertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.mVerticesCurrentLimit * 4, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndicesCurrentLimit * 2, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mTextureBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.mTexturesCurrentLimit * 4, this.gl.STATIC_DRAW);
    }

    /**
     * Store and initialize attribures/uniforms.
     * 
     * @private
     * @memberof GRenderer
     */
    private initGLSLParameters() {

        //attribute locations.
        this.mAVertexCoordsLocation = this.gl.getAttribLocation(this.mShaderProgram, "aVertexPosition");
        this.mATextureCoordsLocation = this.gl.getAttribLocation(this.mShaderProgram, "aTexCoord");

        //uniform locations.
        this.mUViewMatrixLocation = this.gl.getUniformLocation(this.mShaderProgram, "viewMatrix");
        this.mUClipMatrixLocation = this.gl.getUniformLocation(this.mShaderProgram, "clipMatrix");
        let sampler = this.gl.getUniformLocation(this.mShaderProgram, "uTexture");
        this.gl.uniform1i(sampler, 1);

        //matrices
        this.mViewMatrix = new Float32Array([0.6, 0, 0, 0, 0.6, 0, -this.game.camera.view.x, -this.game.camera.view.y, 1]);
        this.gl.uniformMatrix3fv(this.mUViewMatrixLocation, false, this.mViewMatrix);

        let clipMatrix = new Float32Array([2 / this.game.canvas.width, 0, 0, 0, 2 / this.game.canvas.height, 0, -1, -1, 1]);
        this.gl.uniformMatrix3fv(this.mUClipMatrixLocation, false, clipMatrix);

        this.mUTimeLocation = this.gl.getUniformLocation(this.mShaderProgram, "iTime");
        this.gl.uniform1f(this.mUTimeLocation, 0);

        let resU = this.gl.getUniformLocation(this.mShaderProgram, "iResolution");
        this.gl.uniform2fv(resU, [this.game.width, this.game.height]);
    }


    /**
     * Init typed arrays that are copied by the GPU.
     * 
     * @private
     * @memberof GRenderer
     */
    private initBuffers() {
        this.mVerticesFloat32 = new Float32Array(this.mVerticesCurrentLimit);
        this.mIndicesUint16 = new Uint16Array(this.mIndicesCurrentLimit);
        this.mTextureCoordsFloat32 = new Float32Array(this.mTexturesCurrentLimit);
    }


    /**
     * Grabs default compiled shader programs, attaches and links them.
     * 
     * 
     * @memberof GLRenderer
     */
    private initProgram() {
        this.gl = this.game.canvas.getContext("webgl") || this.game.canvas.getContext("experimental-webgl");
        if (!this.gl) {
            alert("Oops, gl not supported. Fallback to canvas");
        }

        let fragmentShader = this.getShader(this.gl, 'shader-fs');
        let vertexShader = this.getShader(this.gl, 'shader-vs');

        // Create the shader program
        this.mShaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.mShaderProgram, vertexShader);
        this.gl.attachShader(this.mShaderProgram, fragmentShader);
        this.gl.linkProgram(this.mShaderProgram);

        if (!this.gl.getProgramParameter(this.mShaderProgram, this.gl.LINK_STATUS)) {
            console.warn('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(this.mShaderProgram));
        }
        if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS))
            console.warn(this.gl.getShaderInfoLog(vertexShader));

        if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS))
            console.warn(this.gl.getShaderInfoLog(fragmentShader));
    }

    /**
     * grabs default shader sources and compiles them.
     * 
     * @private
     * @param {WebGLRenderingContext} gl 
     * @param {string} id 
     * @param {any} [type] 
     * @returns 
     * 
     * @memberof GLRenderer
     */
    private getShader(gl: WebGLRenderingContext, id: string, type?) {
        let shaderScript, theSource, shader;
        shaderScript = document.getElementById(id);
        if (!shaderScript) {
            return null;
        }
        theSource = shaderScript.text;
        if (!type) {
            if (shaderScript.type == 'x-shader/x-fragment') {
                type = gl.FRAGMENT_SHADER;
            } else if (shaderScript.type == 'x-shader/x-vertex') {
                type = gl.VERTEX_SHADER;
            } else {
                return null;
            }
        }
        shader = gl.createShader(type);
        gl.shaderSource(shader, theSource);
        // Compile the shader program
        gl.compileShader(shader);
        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            //console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }


    /**
     * Uploads data on the GPU. Performs buffer reallocation if needed.
     * 
     * @param {number[]} vertices 
     * @param {number[]} indices 
     * @memberof GRenderer
     */
    public uploadData(vertices: number[], indices: number[], textureCoords: number[]) {

        if ((this.mVerticesFloat32Index + vertices.length) >= this.mVerticesFloat32.length) {
            if (DEBUG) console.warn("You are creating too many vertices!");
            this.mVerticesCurrentLimit = Math.floor(this.mVerticesCurrentLimit * 1.5);
            let oldContent = this.mVerticesFloat32;
            this.mVerticesFloat32 = new Float32Array(this.mVerticesCurrentLimit);
            this.mVerticesFloat32.set(oldContent);
            oldContent = null;

            this.mVerticesFloat32.set(vertices, this.mVerticesFloat32Index);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mVertexBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.mVerticesCurrentLimit * 4, this.gl.DYNAMIC_DRAW);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.mVerticesFloat32.subarray(0, this.mVerticesFloat32Index + vertices.length));
            this.mVerticesFloat32Index += vertices.length;
        }
        else {
            this.mVerticesFloat32.set(vertices, this.mVerticesFloat32Index);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mVertexBuffer);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, this.mVerticesFloat32Index * 4, this.mVerticesFloat32.subarray(this.mVerticesFloat32Index, this.mVerticesFloat32Index + vertices.length));
            this.mVerticesFloat32Index += vertices.length;
        }

        if ((this.mIndicesFloat32Index + indices.length) >= this.mIndicesUint16.length) {
            console.warn("You are creating to many indices/vertices!");
            this.mIndicesCurrentLimit = Math.floor(this.mIndicesCurrentLimit * 1.5);
            let oldIndices = this.mIndicesUint16;
            this.mIndicesUint16 = new Uint16Array(this.mIndicesCurrentLimit);
            this.mIndicesUint16.set(oldIndices);
            oldIndices = null;

            this.mIndicesUint16.set(indices, this.mIndicesFloat32Index);

            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndexBuffer);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndicesCurrentLimit * 2, this.gl.STATIC_DRAW);
            this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, 0, this.mIndicesUint16.subarray(0, this.mIndicesFloat32Index + indices.length));
            this.mIndicesFloat32Index += indices.length;

        } else {
            this.mIndicesUint16.set(indices, this.mIndicesFloat32Index);

            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndexBuffer);
            this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, this.mIndicesFloat32Index * 2, this.mIndicesUint16.subarray(this.mIndicesFloat32Index, this.mIndicesFloat32Index + indices.length));
            this.mIndicesFloat32Index += indices.length;
        }

        if ((this.mTextureCoordsFloat32Index + textureCoords.length) >= this.mTextureCoordsFloat32.length) {
            console.warn("You are using too many texture coordinates!");

            this.mTexturesCurrentLimit = Math.floor(this.mTexturesCurrentLimit * 1.5);
            let oldContent = this.mTextureCoordsFloat32;
            this.mTextureCoordsFloat32 = new Float32Array(this.mTexturesCurrentLimit);
            this.mTextureCoordsFloat32.set(oldContent);
            oldContent = null;

            this.mTextureCoordsFloat32.set(textureCoords, this.mTextureCoordsFloat32Index);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mTextureBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.mTexturesCurrentLimit * 4, this.gl.DYNAMIC_DRAW);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.mTextureCoordsFloat32.subarray(0, this.mTextureCoordsFloat32Index + textureCoords.length));
            this.mTextureCoordsFloat32Index += textureCoords.length;

        } else {
            this.mTextureCoordsFloat32.set(textureCoords, this.mTextureCoordsFloat32Index);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mTextureBuffer);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, this.mTextureCoordsFloat32Index * 4, this.mTextureCoordsFloat32.subarray(this.mTextureCoordsFloat32Index, this.mTextureCoordsFloat32Index + textureCoords.length));
            this.mTextureCoordsFloat32Index += textureCoords.length;
        }

        if (DEBUG) {
            console.log(this.mVerticesFloat32Index + " vertices currently bound.");
            console.log(this.mIndicesFloat32Index + " indices currently bound.");
        }

        this.mDrawElementsCount = this.mIndicesFloat32Index;
    }

    //Buffers
    private mVertexBuffer: WebGLBuffer;
    private mIndexBuffer: WebGLBuffer;
    private mTextureBuffer: WebGLBuffer;

    //Attribute locations
    private mAVertexCoordsLocation: number;
    private mATextureCoordsLocation: number

    //Uniform locations
    private mUViewMatrixLocation: WebGLUniformLocation;
    private mUClipMatrixLocation: WebGLUniformLocation;

    private mUTimeLocation: WebGLUniformLocation;

    //Programs
    private mShaderProgram: WebGLProgram;
    private mOriginalProgram: WebGLProgram;

    //Matrices
    private mViewMatrix: Float32Array;

    //data
    private mVerticesFloat32: Float32Array;
    private mIndicesUint16: Uint16Array;
    private mTextureCoordsFloat32: Float32Array;

    private mVerticesFloat32Index: number;
    private mIndicesFloat32Index: number;
    private mTextureCoordsFloat32Index: number;

    //variables
    private mDrawElementsCount: number;
    private mIndexCount: number;

    private mVerticesCurrentLimit: number = 12 * 90;    // 12 = 4(every corner of a quad) * 3(xyz for the corner). 90 Quads can be created before reallocation.
    private mIndicesCurrentLimit: number = 6 * 90;     // 6 indices for a Quad. 90 Quads.
    private mTexturesCurrentLimit: number = 16 * 90;    // 16 = 4(every corner of a quad) * 4(xyzw for the corner). 90 Quads.

    private game: Phaser.Game;
    private gl: WebGLRenderingContext;
}

export interface GPoint {
    x: number;
    y: number;
}