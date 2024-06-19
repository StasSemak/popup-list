import { useEffect, useRef, useState } from "react"
import fontTextureSrc from "../assets/roboto.png";
import robotoFont from "../assets/roboto.json";

type FontData = {
    ix: number,
    iy: number,
    aspect: number,
    row_height: number,
    ascent: number,
    descent: number,
    line_gap: number,
    cap_height: number,
    x_height: number,
    space_advance: number,
    chars: Record<string, {
        codepoint: number,
        rect: number[],
        bearing_x: number,
        bearing_y: number,
        advance_x: number,
        flags: number,
    }>,
};

const vertexShaderSrc = `
    attribute vec2 pos;
    attribute vec2 tex0;
    attribute float scale;

    uniform vec2 sdf_tex_size;
    uniform mat3 transform;
    uniform float sdf_border_size;

    varying vec2 tc0;
    varying float doffset;
    varying vec2 sdf_texel;
    varying float subpixel_offset;

    void main() {
        float sdf_size = 2.0 * scale * sdf_border_size;
        tc0 = tex0;
        doffset = 1.0 / sdf_size;
        sdf_texel = 1.0 / sdf_tex_size;
        subpixel_offset = 0.3333 / scale;

        vec3 screen_pos = transform * vec3(pos, 1.0);    
        gl_Position = vec4(screen_pos.xy, 0.0, 1.0);
    } 
`;
const fragmentShaderSrc = `
    precision mediump float;

    uniform sampler2D font_tex;
    uniform float hint_amount;
    uniform float subpixel_amount;
    uniform vec4 font_color;

    varying vec2 tc0;
    varying float doffset;
    varying vec2 sdf_texel;
    varying float subpixel_offset;

    vec3 sdf_triplet_alpha(vec3 sdf, float horz_scale, float vert_scale, float vgrad) {
        float hdoffset = mix(doffset * horz_scale, doffset * vert_scale, vgrad);
        float rdoffset = mix(doffset, hdoffset, hint_amount);
        vec3 alpha = smoothstep(vec3(0.5 - rdoffset), vec3(0.5 + rdoffset), sdf);
        alpha = pow(alpha, vec3(1.0 + 0.2 * vgrad * hint_amount));
        return alpha;
    }

    float sdf_alpha(float sdf, float horz_scale, float vert_scale, float vgrad) {
        float hdoffset = mix(doffset * horz_scale, doffset * vert_scale, vgrad);
        float rdoffset = mix(doffset, hdoffset, hint_amount);
        float alpha = smoothstep(0.5 - rdoffset, 0.5 + rdoffset, sdf);
        alpha = pow(alpha, 1.0 + 0.2 * vgrad * hint_amount);
        return alpha;
    }

    void main() {
        float sdf = texture2D(font_tex, tc0).r;
        float sdf_north = texture2D(font_tex, tc0 + vec2(0.0, sdf_texel.y)).r;
        float sdf_east = texture2D(font_tex, tc0 + vec2(sdf_texel.x, 0.0)).r;

        vec2 sgrad = vec2(sdf_east - sdf, sdf_north - sdf);
        float sgrad_len = max(length(sgrad), 1.0 / 128.0);
        vec2 grad = sgrad / vec2(sgrad_len);
        float vgrad = abs(grad.y);

        if (subpixel_amount > 0.0) {
            vec2 subpixel = vec2(subpixel_offset, 0.0);

            float sdf_sp_n = texture2D(font_tex, tc0 - subpixel).r;
            float sdf_sp_p = texture2D(font_tex, tc0 + subpixel).r;

            float horz_scale = 0.5;
            float vert_scale = 0.6;

            vec3 triplet_alpha = sdf_triplet_alpha(vec3(sdf_sp_n, sdf, sdf_sp_p), horz_scale, vert_scale, vgrad);

            gl_FragColor = vec4(font_color.rgb * triplet_alpha, 1.0);

        } else {
            float horz_scale = 1.1;
            float vert_scale = 0.6;

            float alpha = sdf_alpha(sdf, 1.1, 0.6, vgrad);
            gl_FragColor = vec4(font_color.rgb, font_color.a * alpha);
        }
    }
`;
const plotVertexShaderSrc = `
    attribute vec2 pos;

    void main() {
        gl_Position = vec4(pos, 0.0, 1.0);
    }
`;
const plotFragmentShaderSrc = `
    precision mediump float;

    uniform vec4 plot_color;

    void main() {
        gl_FragColor = plot_color;
    }
`;

class WebGlPlot {
    private gl: WebGLRenderingContext;
    private numPoints: number;
    private vbuffer: WebGLBuffer | null;
    private color: [number, number, number, number];
    private xy: Float32Array;
    private program: WebGLProgram;

    constructor(gl: WebGLRenderingContext, numPoints: number, color: [number, number, number, number]) {
        this.gl = gl;
        this.numPoints = numPoints;
        this.vbuffer = gl.createBuffer();
        this.color = color;
        this.xy = new Float32Array(2 * numPoints);
        this.program = this.initProgram();
    }

    private initProgram() {
        const vertexShaderSrc = `
            attribute vec2 pos;

            void main() {
                gl_Position = vec4(pos, 0.0, 1.0);
            }
        `;
        const fragmentShaderSrc = `
            precision mediump float;

            uniform vec4 plot_color;

            void main() {
                gl_FragColor = plot_color;
            }
        `;
        return initProgram(this.gl, vertexShaderSrc, fragmentShaderSrc);
    }

    public addData(data: number[]) {
        for (let i = 0; i < data.length; i++) {
            this.xy[2 * i] = (i / (data.length - 1)) * 2 - 1;
            this.xy[2 * i + 1] = ((data[i] / Math.max(...data)) * 6 - 5) - 1.25;
        }
    }

    public update() {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.xy, gl.DYNAMIC_DRAW);
    }

    public draw() {
        const gl = this.gl;
        if(!this.program) return;
        gl.useProgram(this.program);

        const plotColorLoc = gl.getUniformLocation(this.program, "plot_color");
        const [r, g, b, a] = this.color;
        gl.uniform4f(plotColorLoc, r, g, b, a);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.drawArrays(gl.LINE_STRIP, 0, this.numPoints);
    }
}
class WebGlRenderer {
    private gl: WebGLRenderingContext;
    private canvas: HTMLCanvasElement;
    private texture: WebGLTexture | null;
    private textureImg: HTMLImageElement;
    private attribs: any;
    private vertexArr: Float32Array;
    private vertexBuffer: WebGLBuffer | null;
    private program: WebGLProgram;
    private fontData: FontData;
    private dpi: number;
    private canvasWidth: number;
    private canvasHeight: number;
    private uniforms: Record<string, any>;

    constructor(canvas: HTMLCanvasElement, fontTextureSrc: string, fontData: FontData) {
        const gl = this.initGl(canvas);
        this.gl = gl;
        this.canvas = canvas;

        const textureRes = this.loadTexture(fontTextureSrc);
        this.texture = textureRes.texture;
        this.textureImg = textureRes.image;

        this.attribs = this.initAttribs();
        this.vertexArr = new Float32Array(100000);
        this.fontData = fontData;
        
        this.dpi = window.devicePixelRatio || 1;
        this.canvasWidth = Math.round(this.dpi * canvas.clientWidth);
        this.canvasHeight = Math.round(this.dpi * canvas.clientHeight);

        this.vertexBuffer = this.gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexArr, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.program = this.initProgram();
        this.uniforms = this.getUniforms();
    }

    private initGl(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl", {
            premultipliedAlpha: false,
            alpha: false,
        });
        if(!gl) {
            throw new Error("WebGL not supported!");
        }
        return gl;
    }

    private loadTexture(src: string) {
        const gl = this.gl;
        const texture = gl.createTexture();
        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.bindTexture(gl.TEXTURE_2D, null);
        };
        image.src = src;
        return {
            texture: texture,
            image: image,
        }
    }

    private initAttribs() {
        const gl = this.gl;

        let attribs = [
            { loc: 0, name: "pos", size: 2 } as any,
            { loc: 1, name: "tex0", size: 2} as any,
            { loc: 2, name: "sdf_size", size: 1 } as any,
        ];

        let stride = 0;
        for (let i = 0; i < attribs.length; i++) {
            const a = attribs[i];
            if(!a.type) a.type = gl.FLOAT;
            if(a.type === gl.FLOAT) a.bsize = 4;
            if(a.type === gl.BYTE || a.type === gl.UNSIGNED_BYTE) a.bsize = 1;
            if(a.type == gl.SHORT || a.type == gl.UNSIGNED_SHORT) a.bsize = 2;
            if(!a.norm) a.norm = false;

            a.offset = stride;
            stride += a.bsize * a.size;
        }

        for (let i = 0; i < attribs.length; i++) {
            attribs[i].stride = stride;
        }

        return attribs;
    }

    private initProgram() {
        const vertexShaderSrc = `
            attribute vec2 pos;
            attribute vec2 tex0;
            attribute float scale;

            uniform vec2 sdf_tex_size;
            uniform mat3 transform;
            uniform float sdf_border_size;

            varying vec2 tc0;
            varying float doffset;
            varying vec2 sdf_texel;
            varying float subpixel_offset;

            void main() {
                float sdf_size = 2.0 * scale * sdf_border_size;
                tc0 = tex0;
                doffset = 1.0 / sdf_size;
                sdf_texel = 1.0 / sdf_tex_size;
                subpixel_offset = 0.3333 / scale;

                vec3 screen_pos = transform * vec3(pos, 1.0);    
                gl_Position = vec4(screen_pos.xy, 0.0, 1.0);
            } 
        `;  
        const fragmentShaderSrc = `
            precision mediump float;

            uniform sampler2D font_tex;
            uniform float hint_amount;
            uniform float subpixel_amount;
            uniform vec4 font_color;

            varying vec2 tc0;
            varying float doffset;
            varying vec2 sdf_texel;
            varying float subpixel_offset;

            vec3 sdf_triplet_alpha(vec3 sdf, float horz_scale, float vert_scale, float vgrad) {
                float hdoffset = mix(doffset * horz_scale, doffset * vert_scale, vgrad);
                float rdoffset = mix(doffset, hdoffset, hint_amount);
                vec3 alpha = smoothstep(vec3(0.5 - rdoffset), vec3(0.5 + rdoffset), sdf);
                alpha = pow(alpha, vec3(1.0 + 0.2 * vgrad * hint_amount));
                return alpha;
            }

            float sdf_alpha(float sdf, float horz_scale, float vert_scale, float vgrad) {
                float hdoffset = mix(doffset * horz_scale, doffset * vert_scale, vgrad);
                float rdoffset = mix(doffset, hdoffset, hint_amount);
                float alpha = smoothstep(0.5 - rdoffset, 0.5 + rdoffset, sdf);
                alpha = pow(alpha, 1.0 + 0.2 * vgrad * hint_amount);
                return alpha;
            }

            void main() {
                float sdf = texture2D(font_tex, tc0).r;
                float sdf_north = texture2D(font_tex, tc0 + vec2(0.0, sdf_texel.y)).r;
                float sdf_east = texture2D(font_tex, tc0 + vec2(sdf_texel.x, 0.0)).r;

                vec2 sgrad = vec2(sdf_east - sdf, sdf_north - sdf);
                float sgrad_len = max(length(sgrad), 1.0 / 128.0);
                vec2 grad = sgrad / vec2(sgrad_len);
                float vgrad = abs(grad.y);

                if (subpixel_amount > 0.0) {
                    vec2 subpixel = vec2(subpixel_offset, 0.0);

                    float sdf_sp_n = texture2D(font_tex, tc0 - subpixel).r;
                    float sdf_sp_p = texture2D(font_tex, tc0 + subpixel).r;

                    float horz_scale = 0.5;
                    float vert_scale = 0.6;

                    vec3 triplet_alpha = sdf_triplet_alpha(vec3(sdf_sp_n, sdf, sdf_sp_p), horz_scale, vert_scale, vgrad);

                    gl_FragColor = vec4(font_color.rgb * triplet_alpha, 1.0);

                } else {
                    float horz_scale = 1.1;
                    float vert_scale = 0.6;

                    float alpha = sdf_alpha(sdf, 1.1, 0.6, vgrad);
                    gl_FragColor = vec4(font_color.rgb, font_color.a * alpha);
                }
            }
        `;
        const program = initProgram(this.gl, vertexShaderSrc, fragmentShaderSrc);
        for (let i = 0; i < this.attribs.length; i++) {
            this.gl.bindAttribLocation(program, this.attribs[i].loc, this.attribs[i].name);
        }
        return program;
    }

    private getUniforms() {
        const gl = this.gl;
        function makeUnfSet(location: WebGLUniformLocation | null, type: number) {
            if(type === gl.FLOAT) {
                return (v0: number) => {
                    gl.uniform1f(location, v0);
                }
            }
            if(type === gl.FLOAT_VEC2) {
                return (v0: number, v1: number) => {
                    gl.uniform2f(location, v0, v1);
                }
            }
            if(type === gl.FLOAT_VEC3) {
                return (v0: number, v1: number, v2: number) => {
                    gl.uniform3f(location, v0, v1, v2);
                }
            }
            if(type === gl.FLOAT_VEC4) {
                return (v0: number, v1: number, v2: number, v3: number) => {
                    gl.uniform4f(location, v0, v1, v2, v3);
                }
            }
            if(type === gl.SAMPLER_2D) {
                return (v: number) => {
                    gl.uniform1i(location, v);
                }
            }
            if(type === gl.SAMPLER_CUBE) {
                return (v: number) => {
                    gl.uniform1i(location, v);
                }
            }
        }
        function makeUnfSetv(location: WebGLUniformLocation | null, type: number) {
            if(type === gl.FLOAT) {
                return (v: Float32List) => {
                    gl.uniform1fv(location, v);
                }
            }
            if(type === gl.FLOAT_VEC2) {
                return (v: Float32List) => {
                    gl.uniform2fv(location, v);
                }
            }
            if(type === gl.FLOAT_VEC3) {
                return (v: Float32List) => {
                    gl.uniform3fv(location, v);
                }
            }
            if(type === gl.FLOAT_VEC4) {
                return (v: Float32List) => {
                    gl.uniform4fv(location, v);
                }
            }
            if(type === gl.FLOAT_MAT2) {
                return (v: Float32List, transpose: boolean = false) => {
                    gl.uniformMatrix2fv(location, transpose, v);
                }
            }
            if(type === gl.FLOAT_MAT3) {
                return (v: Float32List, transpose: boolean = false) => {
                    gl.uniformMatrix3fv(location, transpose, v);
                }
            }
            if(type === gl.FLOAT_MAT4) {
                return (v: Float32List, transpose: boolean = false) => {
                    gl.uniformMatrix4fv(location, transpose, v);
                }
            }
        }
    
        const uLength = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        let res: Record<string, any> = {};
        for (let i = 0; i < uLength; i++) {
            const u = gl.getActiveUniform(this.program, i);
            if(!u) continue;
            const location = gl.getUniformLocation(this.program, u.name);
            const uObj = {
                name: u.name,
                idx: i,
                loc: location,
                type: u.type,
                set: makeUnfSet(location, u.type),
                setv: makeUnfSetv(location, u.type),
            };
            res = { ...res, [u.name]: uObj };
        }

        return res;
    }

    private getFontMetrics(pixelSize: number, lineGap: number) {
        const capScale = pixelSize / this.fontData.cap_height;
        const lowScale = Math.round(this.fontData.x_height * capScale) / this.fontData.x_height;
        const ascent = Math.round(this.fontData.ascent * capScale);
        const lineHeight = Math.round(capScale * (this.fontData.ascent + 
            this.fontData.descent + this.fontData.line_gap) + lineGap);
        return {
            capScale: capScale,
            lowScale: lowScale,
            ascent: ascent,
            lineHeight: lineHeight,
        }
    }

    private writeTextToVertex(text: string, fontMetrics: any, pos: number[], arrPos: number = 0) {
        let cpos = pos;
        let xMax = 0.0;
        const scale = fontMetrics.capScale;
        let strPos = 0;

        while(strPos !== text.length) {
            const glyphFloatCount = 30;
            if(arrPos + glyphFloatCount >= this.vertexArr.length) break;

            const char = text[strPos];
            strPos++;

            if(char === " ") {
                cpos[0] += this.fontData.space_advance * scale;
                continue;
            }

            const fontChar = this.fontData.chars[char];
            const rect = this.charRect(cpos, fontMetrics, fontChar);

            for (let i = 0; i < rect.verticles.length; i++) {
                this.vertexArr[arrPos] = rect.verticles[i];
                arrPos++;
            }

            cpos = rect.pos;
        }

        return {
            rect: [pos[0], pos[1], xMax - pos[0], pos[1] - cpos[1] + fontMetrics.lineHeight],
            stringPos: strPos,
            arrayPos: arrPos,
        }
    }
    private charRect(pos: number[], fontMetrics: any, char: any) {
        const font = this.fontData;
        const lowcase = char.flags === 1;
        const baseline = pos[1] - fontMetrics.ascent;
        const scale = lowcase ? fontMetrics.lowScale : fontMetrics.capScale;
        
        const g = char.rect;
        const bottom = baseline - scale * (font.descent + font.iy);
        const top = bottom + scale * font.row_height;
        const left = pos[0] + font.aspect * scale * (char.bearing_x - font.ix);
        const right = left + font.aspect * scale * (g[2] - g[0]);
        const p = [left, top, right, bottom];
    
        const newPosX = pos[0] + font.aspect * scale * char.advance_x;
    
        const verticles = [
            p[0], p[1], g[0], g[1], scale,
            p[2], p[1], g[2], g[1], scale,
            p[0], p[3], g[0], g[3], scale,
            p[0], p[3], g[0], g[3], scale,
            p[2], p[1], g[2], g[1], scale,
            p[2], p[3], g[2], g[3], scale,
        ];
        
        return {
            verticles: verticles,
            pos: [newPosX, pos[1]],
        }
    }

    private bindAttribs() {
        for (let i = 0; i < this.attribs.length; i++) {
            const a = this.attribs[i];
            this.gl.vertexAttribPointer(a.loc, a.size, a.type, a.norm, a.stride, a.offset);
            this.gl.enableVertexAttribArray(a.loc);
        }
    }

    private writeText(fontSize: number, textX: number, textY: number, text: string, vertexOffset: number = 0) {
        const fSize = Math.round(fontSize * this.dpi);
        const fMetrics = this.getFontMetrics(fSize, fSize * 0.2);
        
        const res = this.writeTextToVertex(text, fMetrics, [textX, textY], vertexOffset);  
        const vertexCount = res.arrayPos / (this.attribs[0].stride / 4);

        return vertexCount;
    }

    public renderData(topText: string, bottomText: string, numbers: number[]) {
        const gl = this.gl;

        const topTextX = -Math.round(0.133 * this.canvasWidth); 
        const topTextY = Math.round(0.4 * this.canvasHeight); 
        const vCountTop = this.writeText(24, topTextX, topTextY, topText);

        const bottomTextX = -Math.round(0.16 * this.canvasWidth);
        const bottomTextY = Math.round(0.1 * this.canvasHeight);
        const vCountBottom = this.writeText(12, bottomTextX, bottomTextY, bottomText, vCountTop);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArr);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        const isUp = numbers[numbers.length - 1] > numbers[numbers.length - 2];
        const greenColor = [0.36470588235294116, 0.6313725490196078, 0.3686274509803922];
        const redColor = [0.7725490196078432, 0.17254901960784313, 0.28627450980392155];
        const currentColor = isUp ? greenColor : redColor;
        const [r, g, b] = currentColor;

        const plot = new WebGlPlot(gl, numbers.length, [r, g, b, 1.0]);
        plot.addData(numbers);

        return () => {
            const newDpi = window.devicePixelRatio || 1;
            if(this.dpi !== newDpi) this.dpi = newDpi;
            const cw = Math.round(this.canvasWidth * 0.5) * 2.0;
            const ch = Math.round(this.canvasHeight * 0.5) * 2.0;
            this.canvas.width = cw;
            this.canvas.height = ch;
            this.canvas.style.width = (cw / this.dpi) + "px";
            this.canvas.style.height = (ch / this.dpi) + "px";
    
            const dx = Math.round(-0.5 * bottomTextX);
            const dy = Math.round(0.5 * bottomTextY);
            const ws = 2.0 / cw;
            const hs = 2.0 / ch;

            const transformMat = new Float32Array([
                ws, 0, 0,
                0, hs, 0,
                dx*ws, dy*hs, 1,
            ]);

            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            gl.useProgram(this.program);

            this.uniforms.font_tex.set(0);
            this.uniforms.sdf_tex_size.set(this.textureImg.width, this.textureImg.height);
            this.uniforms.sdf_border_size.set(this.fontData.iy);
            this.uniforms.transform.setv(transformMat);
            this.uniforms.hint_amount.set(1.0);
            this.uniforms.subpixel_amount.set(1.0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            this.bindAttribs();

            this.uniforms.font_color.set(r, g, b, 1.0);
            gl.drawArrays(gl.TRIANGLES, 0, vCountTop);

            this.uniforms.font_color.set(1.0, 1.0, 1.0, 1.0);
            gl.drawArrays(gl.TRIANGLES, vCountTop, vCountBottom);

            plot.update();
            plot.draw();
        }
    }
}


function createShader(gl: WebGLRenderingContext, type: number, src: string) {
    const shader = gl.createShader(type);
    if(!shader) {
        throw new Error("Unable to create shader!");
    }
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const shaderInfoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Error compiling shader ${shaderInfoLog}`);
    }
    return shader;
}
function initProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);

    const program = gl.createProgram();
    if(!program) {
        throw new Error("Unable to create program!");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Unable to init shader program ${gl.getProgramInfoLog(program)}`);
    }

    return program;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string, attribs: any) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if(!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if(!program) return;
    for (let i = 0; i < attribs.length; i++) {
        gl.bindAttribLocation(program, attribs[i].loc, attribs[i].name);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`Unable to init shader program ${gl.getProgramInfoLog(program)}`);
        return null;
    }

    function makeUnfSet(location: WebGLUniformLocation | null, type: number) {
        if(type === gl.FLOAT) {
            return (v0: number) => {
                gl.uniform1f(location, v0);
            }
        }
        if(type === gl.FLOAT_VEC2) {
            return (v0: number, v1: number) => {
                gl.uniform2f(location, v0, v1);
            }
        }
        if(type === gl.FLOAT_VEC3) {
            return (v0: number, v1: number, v2: number) => {
                gl.uniform3f(location, v0, v1, v2);
            }
        }
        if(type === gl.FLOAT_VEC4) {
            return (v0: number, v1: number, v2: number, v3: number) => {
                gl.uniform4f(location, v0, v1, v2, v3);
            }
        }
        if(type === gl.SAMPLER_2D) {
            return (v: number) => {
                gl.uniform1i(location, v);
            }
        }
        if(type === gl.SAMPLER_CUBE) {
            return (v: number) => {
                gl.uniform1i(location, v);
            }
        }
    }
    function makeUnfSetv(location: WebGLUniformLocation | null, type: number) {
        if(type === gl.FLOAT) {
            return (v: Float32List) => {
                gl.uniform1fv(location, v);
            }
        }
        if(type === gl.FLOAT_VEC2) {
            return (v: Float32List) => {
                gl.uniform2fv(location, v);
            }
        }
        if(type === gl.FLOAT_VEC3) {
            return (v: Float32List) => {
                gl.uniform3fv(location, v);
            }
        }
        if(type === gl.FLOAT_VEC4) {
            return (v: Float32List) => {
                gl.uniform4fv(location, v);
            }
        }
        if(type === gl.FLOAT_MAT2) {
            return (v: Float32List, transpose: boolean = false) => {
                gl.uniformMatrix2fv(location, transpose, v);
            }
        }
        if(type === gl.FLOAT_MAT3) {
            return (v: Float32List, transpose: boolean = false) => {
                gl.uniformMatrix3fv(location, transpose, v);
            }
        }
        if(type === gl.FLOAT_MAT4) {
            return (v: Float32List, transpose: boolean = false) => {
                gl.uniformMatrix4fv(location, transpose, v);
            }
        }
    }

    const uLength = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    let res = { program: program } as any;
    for (let i = 0; i < uLength; i++) {
        const u = gl.getActiveUniform(program, i);
        if(!u) continue;
        const location = gl.getUniformLocation(program, u.name);
        const uObj = {
            name: u.name,
            idx: i,
            loc: location,
            type: u.type,
            set: makeUnfSet(location, u.type),
            setv: makeUnfSetv(location, u.type),
        };
        res = { ...res, [u.name]: uObj };
    }

    return res;
}
function initAttribs(gl: WebGLRenderingContext, attribs: any) {
    let stride = 0;
    for (let i = 0; i < attribs.length; i++) {
        const a = attribs[i];
        if(!a.type) a.type = gl.FLOAT;
        if(a.type === gl.FLOAT) a.bsize = 4;
        if(a.type === gl.BYTE || a.type === gl.UNSIGNED_BYTE) a.bsize = 1;
        if(a.type == gl.SHORT || a.type == gl.UNSIGNED_SHORT) a.bsize = 2;
        if(!a.norm) a.norm = false;

        a.offset = stride;
        stride += a.bsize * a.size;
    }

    for (let i = 0; i < attribs.length; i++) {
        attribs[i].stride = stride;
    }

    return attribs;
}
function bindAttribs(gl: WebGLRenderingContext, attribs: any) {
    for (let i = 0; i < attribs.length; i++) {
        const a = attribs[i];
        gl.vertexAttribPointer(a.loc, a.size, a.type, a.norm, a.stride, a.offset);
        gl.enableVertexAttribArray(a.loc);
    }
}
function loadTexture(gl: WebGLRenderingContext, src: string) {
    const texture = gl.createTexture();
    const image = new Image();
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    image.src = src;
    return {
        id: texture,
        image: image,
    }
}
function fontMetrics(font: any, pixelSize: number, lineGap: number) {
    const capScale = pixelSize / font.cap_height;
    const lowScale = Math.round(font.x_height * capScale) / font.x_height;
    const ascent = Math.round(font.ascent * capScale);
    const lineHeight = Math.round(capScale * (font.ascent + font.descent + font.line_gap) + lineGap);
    return {
        capScale: capScale,
        lowScale: lowScale,
        ascent: ascent,
        lineHeight: lineHeight,
    }
}
function charRect(pos: number[], font: any, fontMetrics: any, fontChar: any) {
    const lowcase = fontChar.flags === 1;
    const baseline = pos[1] - fontMetrics.ascent;
    const scale = lowcase ? fontMetrics.lowScale : fontMetrics.capScale;
    
    const g = fontChar.rect;
    const bottom = baseline - scale * (font.descent + font.iy);
    const top = bottom + scale * font.row_height;
    const left = pos[0] + font.aspect * scale * (fontChar.bearing_x - font.ix);
    const right = left + font.aspect * scale * (g[2] - g[0]);
    const p = [left, top, right, bottom];

    const newPosX = pos[0] + font.aspect * scale * fontChar.advance_x;

    const verticles = [
        p[0], p[1], g[0], g[1], scale,
        p[2], p[1], g[2], g[1], scale,
        p[0], p[3], g[0], g[3], scale,
        p[0], p[3], g[0], g[3], scale,
        p[2], p[1], g[2], g[1], scale,
        p[2], p[3], g[2], g[3], scale,
    ];
    
    return {
        verticles: verticles,
        pos: [newPosX, pos[1]],
    }
}
function writeText(text: string, font: any, fontMetrics: any, pos: number[], 
    vertexArr: Float32Array, arrPos: number = 0
) {
    let cpos = pos;
    let xMax = 0.0;
    const scale = fontMetrics.capScale;
    let strPos = 0;

    while(strPos !== text.length) {
        const glyphFloatCount = 30;
        if(arrPos + glyphFloatCount >= vertexArr.length) break;

        const char = text[strPos];
        strPos++;

        if(char === " ") {
            cpos[0] += font.space_advance * scale;
            continue;
        }

        const fontChar = font.chars[char];
        const rect = charRect(cpos, font, fontMetrics, fontChar);

        for (let i = 0; i < rect.verticles.length; i++) {
            vertexArr[arrPos] = rect.verticles[i];
            arrPos++;
        }

        cpos = rect.pos;
    }

    return {
        rect: [pos[0], pos[1], xMax - pos[0], pos[1] - cpos[1] + fontMetrics.lineHeight],
        stringPos: strPos,
        arrayPos: arrPos,
    }
}
function renderData(textTop: string, textBottom: string, canvas: HTMLCanvasElement, 
    isUp: boolean, numbers: number[]
) {
    const gl = canvas.getContext("webgl", {
        premultipliedAlpha: false,
        alpha: false,
    });
    if(!gl) {
        console.error("WebGL not supproted");
        return;
    }
    
    const fontTex = loadTexture(gl, fontTextureSrc);

    let attribs = [
        { loc: 0, name: "pos", size: 2 } as any,
        { loc: 1, name: "tex0", size: 2} as any,
        { loc: 2, name: "sdf_size", size: 1 } as any,
    ]
    attribs = initAttribs(gl, attribs);

    const vertexArr = new Float32Array(100000);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexArr, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc, attribs);
    if(!program) return;    
    
    const fontSize = Math.round(12 * window.devicePixelRatio);
    const fMetrics = fontMetrics(robotoFont, fontSize, fontSize * 0.2);
    
    const fontSizeTop = Math.round(24 * window.devicePixelRatio);
    const fMetricsTop = fontMetrics(robotoFont, fontSizeTop, fontSizeTop * 0.2);
    
    let dpr = window.devicePixelRatio || 1;
    const canvasWidth = Math.round(dpr * canvas.clientWidth);
    const canvasHeight = Math.round(dpr * canvas.clientHeight);

    const textTopX = -Math.round(0.133 * canvasWidth); 
    const textTopY = Math.round(0.4 * canvasHeight); 
    const textX = -Math.round(0.16 * canvasWidth);
    const textY = Math.round(0.1 * canvasHeight); 
    
    const strResTop = writeText(textTop, robotoFont, fMetricsTop, [textTopX, textTopY], vertexArr);
    const vCountTop = strResTop.arrayPos / (attribs[0].stride / 4);

    const strRes = writeText(textBottom, robotoFont, fMetrics, [textX, textY], vertexArr, strResTop.arrayPos);
    const vCount = strRes.arrayPos / (attribs[0].stride / 4);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexArr);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    const greenColor = [0.36470588235294116, 0.6313725490196078, 0.3686274509803922];
    const redColor = [0.7725490196078432, 0.17254901960784313, 0.28627450980392155];
    const currentColor = isUp ? greenColor : redColor;
    const [r, g, b] = currentColor;

    const plot = new WebGlPlot(gl, numbers.length, [r, g, b, 1.0]);
    plot.addData(numbers);

    let animationId: number | null = null;
    function renderLoop() {
        if(!gl) return;

        const newDpr = window.devicePixelRatio || 1;
        if(dpr !== newDpr) dpr = newDpr;
        const cw = Math.round(canvasWidth * 0.5) * 2.0;
        const ch = Math.round(canvasHeight * 0.5) * 2.0;
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = (cw / dpr) + "px";
        canvas.style.height = (ch / dpr) + "px";

        const dx = Math.round(-0.5 * strRes.rect[2]);
        const dy = Math.round(0.5 * strRes.rect[3]);
        const ws = 2.0 / cw;
        const hs = 2.0 / ch;

        const transformMat = new Float32Array([
            ws, 0, 0,
            0, hs, 0,
            dx*ws, dy*hs, 1,
        ]);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.useProgram(program.program);

        program.font_tex.set(0);
        program.sdf_tex_size.set(fontTex.image.width, fontTex.image.height);
        program.sdf_border_size.set(robotoFont.iy);
        program.transform.setv(transformMat);
        program.hint_amount.set(1.0);
        program.subpixel_amount.set(1.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fontTex.id);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        bindAttribs(gl, attribs);

        program.font_color.set(r, g, b, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, vCountTop);

        program.font_color.set(1.0, 1.0, 1.0, 1.0);
        gl.drawArrays(gl.TRIANGLES, vCountTop, vCount);

        plot.update();
        plot.draw();

        animationId = requestAnimationFrame(renderLoop);
    }
    
    renderLoop();

    return () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    };
}

export function WebGlWidget() {
    const ref = useRef<HTMLCanvasElement>(null);
    const [numbers, setNumbers] = useState<number[]>([130]);

    useEffect(() => {
      const intervalId = setInterval(() => {
        setNumbers(prev => {
            const sign = Math.random() > 0.5 ? 1 : -1;
            const val = Math.random() * sign;
            return [...prev.slice(-50), prev[prev.length - 1] + val];
        });
      }, 300);
    
      return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if(!ref.current) return;
        // const cleanup = renderData(
        //     `$ ${numbers[numbers.length - 1].toFixed(2)}`,
        //     "binance / BNBUSDC", ref.current, 
        //     numbers[numbers.length - 1] > numbers[numbers.length - 2],
        //     numbers
        // );
        const renderer = new WebGlRenderer(ref.current, fontTextureSrc, robotoFont);
        const id = requestAnimationFrame(() => renderer.renderData(
            `$ ${numbers[numbers.length - 1].toFixed(2)}`,
            "binance / BNBUSDC",
            numbers,
        ));

        return () => cancelAnimationFrame(id);
    }, [ref, numbers])

    return(
        <canvas ref={ref} style={{width: "300px", height: "150px"}}>

        </canvas>
    )
}