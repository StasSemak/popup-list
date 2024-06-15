export class WebGlLine {
    public intensity: number;
    public visible: boolean;
    public numPoints: number;
    public xy: Float32Array;
    public color: number[];
    public scaleX: number;
    public scaleY: number;
    public offsetX: number;
    public offsetY: number;
    public loop: boolean;
    public webglNumPoints: number;
    public _vbuffer: WebGLBuffer;
    public _coord: number;

    private currentIndex = 0;

    constructor(numPoints: number) {
        this.scaleX = 1;
        this.scaleY = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    
        this.loop = false;
    
        this._vbuffer = 0;
        this._coord = 0;
        this.visible = true;
        this.intensity = 1;
    
        this.xy = new Float32Array([]);
        this.numPoints = 0;
        this.color = [1.0, 0.0, 0.0, 1.0];
        this.webglNumPoints = 0;
        this.webglNumPoints = numPoints;
        this.numPoints = numPoints;
        
        this.xy = new Float32Array(2 * this.webglNumPoints);
    }
  
    public setX(index: number, x: number): void {
      this.xy[index * 2] = x;
    }
  
    public setY(index: number, y: number): void {
      this.xy[index * 2 + 1] = y;
    }
  
    public getX(index: number): number {
      return this.xy[index * 2];
    }

    public getY(index: number): number {
      return this.xy[index * 2 + 1];
    }
  
    public lineSpaceX(start: number, stepSize: number): void {
      for (let i = 0; i < this.numPoints; i++) {
        this.setX(i, start + stepSize * i);
      }
    }
  
    public arrangeX(): void {
      this.lineSpaceX(-1, 2 / this.numPoints);
    }
  
    public constY(c: number): void {
      for (let i = 0; i < this.numPoints; i++) {
        this.setY(i, c);
      }
    }
  
    public shiftAdd(data: Float32Array): void {
      const shiftSize = data.length;
  
      for (let i = 0; i < this.numPoints - shiftSize; i++) {
        this.setY(i, this.getY(i + shiftSize));
      }
  
      for (let i = 0; i < shiftSize; i++) {
        this.setY(i + this.numPoints - shiftSize, data[i]);
      }
    }
  
    public addArrayY(yArray: number[]): void {
      if (this.currentIndex + yArray.length <= this.numPoints) {
        for (let i = 0; i < yArray.length; i++) {
          this.setY(this.currentIndex, yArray[i]);
          this.currentIndex++;
        }
      }
    }
  
    public replaceArrayY(yArray: number[]): void {
      if (yArray.length == this.numPoints) {
        for (let i = 0; i < this.numPoints; i++) {
          this.setY(i, yArray[i]);
        }
      }
    }
}
  
export class WebGlPlot {
    private readonly webgl: WebGLRenderingContext;
    public gScaleX: number;
    public gScaleY: number;
    public gXYratio: number;
    public gOffsetX: number;
    public gOffsetY: number;
    private _linesData: WebGlLine[];
    private _program: WebGLProgram;
  
    get linesData(): WebGlLine[] {
        return this._linesData;
    }
  
    constructor(gl: WebGLRenderingContext) {
        this.webgl = gl;
        this._linesData = [];
        this.gScaleX = 1;
        this.gScaleY = 1;
        this.gXYratio = 1;
        this.gOffsetX = 0;
        this.gOffsetY = 0;
        this._program = this.webgl.createProgram() as WebGLProgram;
        this.initProgram();
  
        this.webgl.enable(this.webgl.BLEND);
        this.webgl.blendFunc(this.webgl.SRC_ALPHA, this.webgl.ONE_MINUS_SRC_ALPHA);
    }
  
    public clear() {
        this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);
    }
    public update() {
        this.clear();
        this.draw();
    }

    public draw() {
        const webgl = this.webgl;
        const lines = this._linesData;

        lines.forEach((line) => {
            if (line.visible) {
                webgl.useProgram(this._program);
                
                const uscale = webgl.getUniformLocation(this._program, "uscale");
                webgl.uniformMatrix2fv(
                  uscale,
                  false,
                  new Float32Array([
                    line.scaleX * this.gScaleX,
                    0,
                    0,
                    line.scaleY * this.gScaleY * this.gXYratio,
                  ])
                );
            
                const uoffset = webgl.getUniformLocation(this._program, "uoffset");
                webgl.uniform2fv(
                  uoffset,
                  new Float32Array([line.offsetX + this.gOffsetX, line.offsetY + this.gOffsetY])
                );
            
                const uColor = webgl.getUniformLocation(this._program, "uColor");
                webgl.uniform4fv(uColor, line.color);
            
                webgl.bufferData(webgl.ARRAY_BUFFER, line.xy as ArrayBuffer, webgl.STREAM_DRAW);
            
                webgl.drawArrays(line.loop ? webgl.LINE_LOOP : webgl.LINE_STRIP, 0, line.webglNumPoints);
            }
        });
    }
    
    public addLine(line: WebGlLine) {
        line._vbuffer = this.webgl.createBuffer() as WebGLBuffer;
        this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, line._vbuffer);
        this.webgl.bufferData(this.webgl.ARRAY_BUFFER, line.xy as ArrayBuffer, this.webgl.STREAM_DRAW);
    
        line._coord = this.webgl.getAttribLocation(this._program, "coordinates");
        this.webgl.vertexAttribPointer(line._coord, 2, this.webgl.FLOAT, false, 0, 0);
        this.webgl.enableVertexAttribArray(line._coord);
        
        this.linesData.push(line);
    }

    private initProgram() {
        const vertCode = `
            attribute vec2 coordinates;
            uniform mat2 uscale;
            uniform vec2 uoffset;

            void main() {
                float x = coordinates.x;
                float y = coordinates.y;
                vec2 line = vec2(x, y);
                gl_Position = vec4(uscale * line + uoffset, 0.0, 1.0);
            }
        `;
        const vertShader = this.webgl.createShader(this.webgl.VERTEX_SHADER);
        this.webgl.shaderSource(vertShader as WebGLShader, vertCode);
        this.webgl.compileShader(vertShader as WebGLShader);

        const fragCode = `
            precision mediump float;
            uniform highp vec4 uColor;

            void main() {
                gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            }
        `;
        const fragShader = this.webgl.createShader(this.webgl.FRAGMENT_SHADER);
        this.webgl.shaderSource(fragShader as WebGLShader, fragCode);
        this.webgl.compileShader(fragShader as WebGLShader);

        this._program = this.webgl.createProgram() as WebGLProgram;
        this.webgl.attachShader(this._program, vertShader as WebGLShader);
        this.webgl.attachShader(this._program, fragShader as WebGLShader);
        this.webgl.linkProgram(this._program);
    }
  
    public popDataLine() {
      this.linesData.pop();
    }
    public removeLines() {
      this._linesData = [];
    }
    public viewport(a: number, b: number, c: number, d: number) {
      this.webgl.viewport(a, b, c, d);
    }
}