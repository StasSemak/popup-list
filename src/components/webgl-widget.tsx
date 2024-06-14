import { useEffect, useRef } from "react"
import { mat4 } from "gl-matrix";
import fontData from "../assets/msdf-font.json";
import msdfTextureSrc from "../assets/msdf-font.png";

type GlyphData = {
    id: number;
    index: number;
    char: string;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    chnl: number;
    x: number;
    y: number;
    page: number;
}

const vertexShaderSrc = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform mat4 u_projection;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    } 
`;
const fragmentShaderSrc = `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_texCoord;

    void main() {
        vec3 sample = texture2D(u_texture, v_texCoord).rgb;
        float colorThreshold = 0.5;
        
        vec3 color = vec3(0.0);
        float alpha = 0.0;

        if (sample.r >= colorThreshold && sample.g >= colorThreshold && sample.b >= colorThreshold) {
            color = vec3(1.0, 1.0, 1.0);
            alpha = 1.0;
        }
        else if (sample.r >= colorThreshold && sample.b >= colorThreshold) {
            color = vec3(1.0, 1.0, 1.0);
            alpha = 1.0;
        }
        else if (sample.g >= colorThreshold && sample.b >= colorThreshold) {
            color = vec3(1.0, 1.0, 1.0);
            alpha = 1.0;
        }
        
        gl_FragColor = vec4(color, alpha);
    }
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
    const shader = gl.createShader(type);
    if(!shader) return;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Error compiling shader ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
function createShaderProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if(!vertexShader || !fragmentShader) return;
    
    const shaderProgram = gl.createProgram();
    if(!shaderProgram) return;
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error(`Unable to init shader program ${gl.getProgramInfoLog(shaderProgram)}`);
        return null;
    }
    return shaderProgram;
}
function createAndBindBuffer(gl: WebGLRenderingContext, data: number[]) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
}
async function loadMsdfTexture(gl: WebGLRenderingContext): Promise<WebGLTexture | null> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            resolve(texture);
        };
        image.onerror = (err) => {
            reject(err);
        }
        image.src = msdfTextureSrc;
    })
}

function renderCharacter(gl: WebGLRenderingContext, glyhpData: GlyphData, x: number, 
    y: number, positionBuffer: WebGLBuffer, texCoordBuffer: WebGLBuffer) {
    const x0 = x + glyhpData.xoffset;
    const x1 = x0 + glyhpData.width;
    const y0 = y + glyhpData.yoffset;
    const y1 = y0 + glyhpData.height;

    const texX0 = glyhpData.x / fontData.common.scaleW;
    const texX1 = (glyhpData.x + glyhpData.width) / fontData.common.scaleW;
    const texY0 = glyhpData.y / fontData.common.scaleH;
    const texY1 = (glyhpData.y + glyhpData.height) / fontData.common.scaleH;

    const verticles = [
        x0, y0,
        x1, y0,
        x0, y1,
        x0, y1,
        x1, y0,
        x1, y1,
    ];
    const texCoords = [
        texX0, texY0,
        texX1, texY0,
        texX0, texY1,
        texX0, texY1,
        texX1, texY0,
        texX1, texY1,
    ];

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticles), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

async function renderText(text: string, canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl");
    if(!gl) {
        console.error("WebGL not supproted");
        return;
    }

    let msdfTexture;
    try {
        msdfTexture = await loadMsdfTexture(gl);
    } 
    catch (err) {
        console.error(`Error loading font texture ${err}`);
        return;
    }

    const shaderProgram = createShaderProgram(gl, vertexShaderSrc, fragmentShaderSrc);
    if(!shaderProgram) return;

    const positionBuffer = createAndBindBuffer(gl, [
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1,
    ]);
    const texCoordBuffer = createAndBindBuffer(gl, [
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1,
    ]);
    if(!positionBuffer || !texCoordBuffer) return;

    requestAnimationFrame(() => drawScene(gl, shaderProgram, text, msdfTexture, positionBuffer, texCoordBuffer));
}
function drawScene(gl: WebGLRenderingContext, program: WebGLProgram, text: string,
    texture: WebGLTexture | null, positionBuffer: WebGLBuffer, texCoordBuffer: WebGLBuffer) {
    const projectionMatrix = mat4.create();
    mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1);

    const positionAttrLoc = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttrLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttrLoc);
    
    const texCoordAttrLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordAttrLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordAttrLoc);

    gl.useProgram(program);

    const projectionUniformLoc = gl.getUniformLocation(program, 'u_projection');
    gl.uniformMatrix4fv(projectionUniformLoc, false, projectionMatrix);
    
    const textureUniformLoc = gl.getUniformLocation(program, 'u_texture');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureUniformLoc, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);

    let x = 0;
    const y = 0;
    for (const char of text) {
        const glyphData = fontData.chars.find(x => x.char === char);

        if(glyphData) {
            renderCharacter(gl, glyphData, x, y, positionBuffer, texCoordBuffer);
            x += glyphData.xadvance;
        }
    }
}

export function WebGlWidget() {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if(!ref.current) return;
        renderText("HELLO WORLD", ref.current);
    }, [ref])

    return(
        <canvas ref={ref} style={{width: "200px", height: "67px"}}>

        </canvas>
    )
}