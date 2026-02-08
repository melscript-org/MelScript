function setupCanvasWebGL(Lang) {
  Lang.addHandler('clearColor', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('clearColor() only works on WebGL canvas');
      }
      const r = args[0] || 0;
      const g = args[1] || 0;
      const b = args[2] || 0;
      const a = args[3] !== undefined ? args[3] : 1;
      target.__mel_gl.clearColor(r, g, b, a);
      return target;
    },
  });

  Lang.addHandler('clear', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('clear() only works on WebGL canvas');
      }
      const gl = target.__mel_gl;
      const mask = args[0] || gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT;
      gl.clear(mask);
      return target;
    },
  });

  Lang.addHandler('viewport', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('viewport() only works on WebGL canvas');
      }
      const x = args[0] || 0;
      const y = args[1] || 0;
      const w = args[2] || target.__mel_width;
      const h = args[3] || target.__mel_height;
      target.__mel_gl.viewport(x, y, w, h);
      return target;
    },
  });

  Lang.addHandler('getGL', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('getGL() only works on WebGL canvas');
      }
      return target.__mel_gl;
    },
  });

  Lang.addHandler('lockPointer', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_dom) {
        Lang.error('lockPointer() only works on canvas');
      }

      target.__mel_dom.requestPointerLock =
        target.__mel_dom.requestPointerLock ||
        target.__mel_dom.mozRequestPointerLock ||
        target.__mel_dom.webkitRequestPointerLock;

      target.__mel_dom.onclick = function () {
        target.__mel_dom.requestPointerLock();
      };

      if (!target.__mel_pointer_setup) {
        target.__mel_pointer_setup = true;

        document.addEventListener('pointerlockchange', function () {
          if (document.pointerLockElement === target.__mel_dom) {
            document.addEventListener('mousemove', target.__mel_mouse_handler);
          } else {
            document.removeEventListener('mousemove', target.__mel_mouse_handler);
          }
        });

        target.__mel_mouse_handler = function (e) {
          if (Lang.state.handlers.has('__mel_mousemove_callback')) {
            const callback = Lang.state.handlers.get('__mel_mousemove_callback');
            if (callback && callback.fn) {
              callback.fn(
                [{ movementX: e.movementX, movementY: e.movementY }],
                Lang.state.variables
              );
            }
          }
        };
      }

      return target;
    },
  });

  Lang.addHandler('onMouseMove', {
    type: 'method',
    call: (target, args, scope) => {
      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('onMouseMove() requires a function');
      }

      Lang.state.handlers.set('__mel_mousemove_callback', {
        fn: (args, scope) => {
          const fnScope = new Map(scope);
          if (callback.params.length > 0) {
            fnScope.set(callback.params[0], args[0]);
          }

          for (let i = 0; i < callback.body.length; i++) {
            Lang.executeStatement(callback.body[i], fnScope);
          }
        },
      });

      return target;
    },
  });

  const defaultVertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    attribute vec2 aTexCoord;
    uniform mat4 uModelView;
    uniform mat4 uProjection;
    varying vec3 vColor;
    varying vec2 vTexCoord;
    void main() {
      vColor = aColor;
      vTexCoord = aTexCoord;
      gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
    }
  `;

  const defaultFragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    varying vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    void main() {
      if (uHasTexture) {
        gl_FragColor = texture2D(uTexture, vTexCoord) * vec4(vColor, 1.0);
      } else {
        gl_FragColor = vec4(vColor, 1.0);
      }
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  const Matrix = {
    identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],

    perspective: (fov, aspect, near, far) => {
      const f = 1.0 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect,
        0,
        0,
        0,
        0,
        f,
        0,
        0,
        0,
        0,
        (far + near) * nf,
        -1,
        0,
        0,
        2 * far * near * nf,
        0,
      ];
    },

    ortho: (left, right, bottom, top, near, far) => {
      const lr = 1 / (left - right);
      const bt = 1 / (bottom - top);
      const nf = 1 / (near - far);
      return [
        -2 * lr,
        0,
        0,
        0,
        0,
        -2 * bt,
        0,
        0,
        0,
        0,
        2 * nf,
        0,
        (left + right) * lr,
        (top + bottom) * bt,
        (far + near) * nf,
        1,
      ];
    },

    translate: (m, x, y, z) => {
      const out = [...m];
      out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
      return out;
    },

    rotateX: (m, a) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        out = [...m];
      const m4 = m[4],
        m5 = m[5],
        m6 = m[6],
        m7 = m[7],
        m8 = m[8],
        m9 = m[9],
        m10 = m[10],
        m11 = m[11];
      out[4] = m4 * c + m8 * s;
      out[5] = m5 * c + m9 * s;
      out[6] = m6 * c + m10 * s;
      out[7] = m7 * c + m11 * s;
      out[8] = m8 * c - m4 * s;
      out[9] = m9 * c - m5 * s;
      out[10] = m10 * c - m6 * s;
      out[11] = m11 * c - m7 * s;
      return out;
    },

    rotateY: (m, a) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        out = [...m];
      const m0 = m[0],
        m1 = m[1],
        m2 = m[2],
        m3 = m[3],
        m8 = m[8],
        m9 = m[9],
        m10 = m[10],
        m11 = m[11];
      out[0] = m0 * c - m8 * s;
      out[1] = m1 * c - m9 * s;
      out[2] = m2 * c - m10 * s;
      out[3] = m3 * c - m11 * s;
      out[8] = m0 * s + m8 * c;
      out[9] = m1 * s + m9 * c;
      out[10] = m2 * s + m10 * c;
      out[11] = m3 * s + m11 * c;
      return out;
    },

    rotateZ: (m, a) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        out = [...m];
      const m0 = m[0],
        m1 = m[1],
        m2 = m[2],
        m3 = m[3],
        m4 = m[4],
        m5 = m[5],
        m6 = m[6],
        m7 = m[7];
      out[0] = m0 * c + m4 * s;
      out[1] = m1 * c + m5 * s;
      out[2] = m2 * c + m6 * s;
      out[3] = m3 * c + m7 * s;
      out[4] = m4 * c - m0 * s;
      out[5] = m5 * c - m1 * s;
      out[6] = m6 * c - m2 * s;
      out[7] = m7 * c - m3 * s;
      return out;
    },

    scale: (m, x, y, z) => {
      const out = [...m];
      out[0] *= x;
      out[1] *= x;
      out[2] *= x;
      out[3] *= x;
      out[4] *= y;
      out[5] *= y;
      out[6] *= y;
      out[7] *= y;
      out[8] *= z;
      out[9] *= z;
      out[10] *= z;
      out[11] *= z;
      return out;
    },

    multiply: (a, b) => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[i * 4 + j] =
            a[i * 4 + 0] * b[0 * 4 + j] +
            a[i * 4 + 1] * b[1 * 4 + j] +
            a[i * 4 + 2] * b[2 * 4 + j] +
            a[i * 4 + 3] * b[3 * 4 + j];
        }
      }
      return out;
    },

    lookAt: (eye, target, up) => {
      const zx = eye[0] - target[0];
      const zy = eye[1] - target[1];
      const zz = eye[2] - target[2];
      let len = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz);
      const z = [zx * len, zy * len, zz * len];

      const xx = up[1] * z[2] - up[2] * z[1];
      const xy = up[2] * z[0] - up[0] * z[2];
      const xz = up[0] * z[1] - up[1] * z[0];
      len = 1 / Math.sqrt(xx * xx + xy * xy + xz * xz);
      const x = [xx * len, xy * len, xz * len];

      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];

      return [
        x[0],
        y[0],
        z[0],
        0,
        x[1],
        y[1],
        z[1],
        0,
        x[2],
        y[2],
        z[2],
        0,
        -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
        -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
        -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
        1,
      ];
    },
  };

  Lang.addHandler('Camera', {
    type: 'function',
    call: (args, scope) => {
      const config = args[0] || {};
      return {
        __mel_camera: true,
        x: config.x || 0,
        y: config.y || 1.6,
        z: config.z || 5,
        rotX: config.rotX || 0,
        rotY: config.rotY || 0,
        rotZ: config.rotZ || 0,
        fov: config.fov || Math.PI / 4,
        near: config.near || 0.1,
        far: config.far || 1000,
        ortho: config.ortho || false,
      };
    },
  });

  function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
  }

  Lang.addHandler('Texture', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Texture() requires an image path');
      }

      const path = String(args[0]);
      const config = args[1] || {};

      return {
        __mel_texture: true,
        path: path,
        image: null,
        glTexture: null,
        loaded: false,
        width: 0,
        height: 0,
        wrapS: config.wrapS || 'repeat',
        wrapT: config.wrapT || 'repeat',
        minFilter: config.minFilter || 'linear',
        magFilter: config.magFilter || 'linear',

        load: function (gl) {
          if (this.loaded) return;

          this.image = new Image();
          this.image.crossOrigin = 'anonymous';

          const self = this;
          this.image.onload = function () {
            self.glTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, self.glTexture);

            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self.image);

            self.width = self.image.width;
            self.height = self.image.height;

            const wrapMap = {
              repeat: gl.REPEAT,
              clamp: gl.CLAMP_TO_EDGE,
              mirror: gl.MIRRORED_REPEAT,
            };
            const filterMap = { linear: gl.LINEAR, nearest: gl.NEAREST };

            if (!isPowerOf2(self.image.width) || !isPowerOf2(self.image.height)) {
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            } else {
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMap[self.wrapS] || gl.REPEAT);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMap[self.wrapT] || gl.REPEAT);
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
                filterMap[self.minFilter] || gl.LINEAR
              );
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MAG_FILTER,
                filterMap[self.magFilter] || gl.LINEAR
              );
              gl.generateMipmap(gl.TEXTURE_2D);
            }

            self.loaded = true;
          };

          this.image.onerror = function () {
            self.loadError = 'Failed to load texture: ' + path;

            self.glTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, self.glTexture);

            const pixel = new Uint8Array([255, 0, 255, 255]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            self.loaded = true;
          };
          this.image.src = path;
        },
      };
    },
  });

  Lang.addHandler('Shader', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 2) {
        Lang.error('Shader() requires vertex and fragment shader source');
      }

      const vertexSrc = String(args[0]);
      const fragmentSrc = String(args[1]);

      return {
        __mel_shader: true,
        vertexSource: vertexSrc,
        fragmentSource: fragmentSrc,
        program: null,
        attrs: {},
        uniforms: {},
        compiled: false,
      };
    },
  });

  Lang.addHandler('useShader', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('useShader() only works on WebGL canvas');
      }

      const shader = args[0];
      if (!shader || !shader.__mel_shader) {
        Lang.error('useShader() requires a Shader object');
      }

      const gl = target.__mel_gl;

      if (!shader.compiled) {
        shader.program = createProgram(gl, shader.vertexSource, shader.fragmentSource);
        if (!shader.program) {
          Lang.error('Failed to compile custom shader');
        }
        shader.compiled = true;
      }

      target.__mel_active_shader = shader;
      target.__mel_3d_program = null;
      return target;
    },
  });

  Lang.addHandler('Framebuffer', {
    type: 'function',
    call: (args, scope) => {
      const width = args[0] || 512;
      const height = args[1] || 512;

      return {
        __mel_framebuffer: true,
        width: width,
        height: height,
        glFramebuffer: null,
        glTexture: null,
        glRenderbuffer: null,
        initialized: false,
      };
    },
  });

  Lang.addHandler('renderTo', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('renderTo() only works on WebGL canvas');
      }

      const gl = target.__mel_gl;
      const framebuffer = args[0];

      if (!framebuffer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, target.__mel_width, target.__mel_height);
        return target;
      }

      if (!framebuffer.__mel_framebuffer) {
        Lang.error('renderTo() requires a Framebuffer object or null');
      }

      if (!framebuffer.initialized) {
        framebuffer.glFramebuffer = gl.createFramebuffer();
        framebuffer.glTexture = gl.createTexture();
        framebuffer.glRenderbuffer = gl.createRenderbuffer();

        gl.bindTexture(gl.TEXTURE_2D, framebuffer.glTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          framebuffer.width,
          framebuffer.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindRenderbuffer(gl.RENDERBUFFER, framebuffer.glRenderbuffer);
        gl.renderbufferStorage(
          gl.RENDERBUFFER,
          gl.DEPTH_COMPONENT16,
          framebuffer.width,
          framebuffer.height
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.glFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          framebuffer.glTexture,
          0
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          framebuffer.glRenderbuffer
        );

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          Lang.error('Framebuffer is not complete');
        }

        framebuffer.initialized = true;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.glFramebuffer);
      gl.viewport(0, 0, framebuffer.width, framebuffer.height);

      return target;
    },
  });

  Lang.addHandler('Mesh', {
    type: 'function',
    call: (args, scope) => {
      const config = args[0];
      if (!config || typeof config !== 'object') {
        Lang.error('Mesh() requires a configuration object');
      }

      let vertices = null;
      let faces = null;
      let colors = null;
      let uvs = null;
      let normals = null;
      let position = [0, 0, -5];
      let rotation = [0, 0, 0];
      let scale = [1, 1, 1];

      const arrays = [];

      for (let key in config) {
        const val = config[key];
        if (!Array.isArray(val)) continue;

        if (val.length > 0 && Array.isArray(val[0])) {
          if (val[0].length === 3) {
            arrays.push(val);
          } else if (val[0].length === 2) {
            uvs = val;
          }
        } else if (val.length === 3 && typeof val[0] === 'number') {
          const hasNegative = val.some((v) => v < 0);
          if (hasNegative || val[2] < -1) {
            position = val;
          } else {
            rotation = val;
          }
        }
      }

      if (arrays.length < 2) {
        Lang.error('Mesh() requires at least vertices and faces');
      }

      for (let i = 0; i < arrays.length; i++) {
        const arr = arrays[i];
        const allBetween01 = arr.every(
          (v) => v[0] >= 0 && v[0] <= 1 && v[1] >= 0 && v[1] <= 1 && v[2] >= 0 && v[2] <= 1
        );
        const hasLargeIndex = arr.some((v) => v[0] > 10 || v[1] > 10 || v[2] > 10);

        const sumAbove1 = arr.every((v) => {
          const sum = Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]);
          return sum > 0.9 && sum < 1.1;
        });

        if (sumAbove1 && !colors) {
          normals = arr;
        } else if (allBetween01) {
          if (!colors) colors = arr;
        } else if (hasLargeIndex) {
          if (!faces) faces = arr;
        } else {
          if (!vertices) vertices = arr;
          else if (!faces) faces = arr;
        }
      }

      if (!vertices) vertices = arrays[0];
      if (!faces && arrays.length > 1) faces = arrays[1];
      if (!colors && arrays.length > 2) colors = arrays[2];

      if (!vertices || !faces) {
        Lang.error('Mesh() requires at least vertices and faces');
      }

      let texture = null;
      if (config.texture && config.texture.__mel_texture) {
        texture = config.texture;
      }

      return {
        __mel_mesh: true,
        vertices: vertices,
        faces: faces,
        colors: colors,
        uvs: uvs,
        normals: normals,
        texture: texture,
        x: position[0],
        y: position[1],
        z: position[2],
        rx: rotation[0],
        ry: rotation[1],
        rz: rotation[2],
        sx: scale[0],
        sy: scale[1],
        sz: scale[2],
        wireframe: false,
        visible: true,
      };
    },
  });

  Lang.addHandler('setCamera', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('setCamera() only works on WebGL canvas');
      }

      const camera = args[0];
      if (!camera || !camera.__mel_camera) {
        Lang.error('setCamera() requires a Camera object');
      }

      target.__mel_active_camera = camera;
      return target;
    },
  });

  Lang.addHandler('raycast', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('raycast() only works on WebGL canvas');
      }

      const x = args[0];
      const y = args[1];
      const objects = args[2] || [];

      if (!Array.isArray(objects)) {
        Lang.error('raycast() third argument must be an array of objects');
      }

      const camera = target.__mel_active_camera;
      if (!camera || !camera.__mel_camera) {
        return null;
      }

      const ndcX = (x / target.__mel_width) * 2 - 1;
      const ndcY = -(y / target.__mel_height) * 2 + 1;

      const rayDir = {
        x: ndcX * Math.tan(camera.fov / 2) * (target.__mel_width / target.__mel_height),
        y: ndcY * Math.tan(camera.fov / 2),
        z: -1,
      };

      const len = Math.sqrt(rayDir.x * rayDir.x + rayDir.y * rayDir.y + rayDir.z * rayDir.z);
      rayDir.x /= len;
      rayDir.y /= len;
      rayDir.z /= len;

      const cosY = Math.cos(camera.rotY);
      const sinY = Math.sin(camera.rotY);
      const cosX = Math.cos(camera.rotX);
      const sinX = Math.sin(camera.rotX);

      const rotatedX = rayDir.x * cosY - rayDir.z * sinY;
      const rotatedZ = rayDir.x * sinY + rayDir.z * cosY;
      const rotatedY = rayDir.y * cosX - rotatedZ * sinX;

      rayDir.x = rotatedX;
      rayDir.y = rotatedY;
      rayDir.z = rotatedZ * cosX + rayDir.y * sinX;

      let closestObj = null;
      let closestDist = Infinity;

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj || !obj.__mel_mesh || !obj.visible) continue;

        const centerX = obj.x;
        const centerY = obj.y;
        const centerZ = obj.z;

        let radius = 1;
        if (obj.vertices && obj.vertices.length > 0) {
          let maxDist = 0;
          for (let v = 0; v < obj.vertices.length; v++) {
            const dx = obj.vertices[v][0] * obj.sx;
            const dy = obj.vertices[v][1] * obj.sy;
            const dz = obj.vertices[v][2] * obj.sz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > maxDist) maxDist = dist;
          }
          radius = maxDist;
        }

        const ocX = camera.x - centerX;
        const ocY = camera.y - centerY;
        const ocZ = camera.z - centerZ;

        const a = rayDir.x * rayDir.x + rayDir.y * rayDir.y + rayDir.z * rayDir.z;
        const b = 2 * (ocX * rayDir.x + ocY * rayDir.y + ocZ * rayDir.z);
        const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;

        const discriminant = b * b - 4 * a * c;

        if (discriminant >= 0) {
          const t = (-b - Math.sqrt(discriminant)) / (2 * a);
          if (t > 0 && t < closestDist) {
            closestDist = t;
            closestObj = obj;
          }
        }
      }

      return closestObj;
    },
  });

  Lang.addHandler('draw3d', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_gl) {
        Lang.error('draw3d() only works on WebGL canvas');
      }

      const obj = args[0];
      if (!obj || !obj.vertices || !obj.faces) {
        Lang.error('draw3d() requires object with vertices and faces');
      }

      if (!obj.visible) return target;

      const gl = target.__mel_gl;

      if (!target.__mel_3d_program && !target.__mel_active_shader) {
        target.__mel_3d_program = createProgram(gl, defaultVertexShader, defaultFragmentShader);
        if (!target.__mel_3d_program) Lang.error('Failed to create shader program');
        target.__mel_3d_attrs = {
          position: gl.getAttribLocation(target.__mel_3d_program, 'aPosition'),
          color: gl.getAttribLocation(target.__mel_3d_program, 'aColor'),
          texCoord: gl.getAttribLocation(target.__mel_3d_program, 'aTexCoord'),
        };
        target.__mel_3d_uniforms = {
          modelView: gl.getUniformLocation(target.__mel_3d_program, 'uModelView'),
          projection: gl.getUniformLocation(target.__mel_3d_program, 'uProjection'),
          texture: gl.getUniformLocation(target.__mel_3d_program, 'uTexture'),
          hasTexture: gl.getUniformLocation(target.__mel_3d_program, 'uHasTexture'),
        };
        gl.enable(gl.DEPTH_TEST);
      }

      const verts = [];
      for (let i = 0; i < obj.vertices.length; i++) {
        verts.push(obj.vertices[i][0], obj.vertices[i][1], obj.vertices[i][2]);
      }

      const cols = [];
      if (obj.colors) {
        for (let i = 0; i < obj.colors.length; i++) {
          cols.push(obj.colors[i][0], obj.colors[i][1], obj.colors[i][2]);
        }
      } else {
        for (let i = 0; i < obj.vertices.length; i++) {
          cols.push(1, 1, 1);
        }
      }

      const texCoords = [];
      if (obj.uvs) {
        for (let i = 0; i < obj.uvs.length; i++) {
          texCoords.push(obj.uvs[i][0], obj.uvs[i][1]);
        }
      } else {
        for (let i = 0; i < obj.vertices.length; i++) {
          texCoords.push(0, 0);
        }
      }

      const inds = [];
      for (let i = 0; i < obj.faces.length; i++) {
        inds.push(obj.faces[i][0], obj.faces[i][1], obj.faces[i][2]);
      }

      const vertexData = new Float32Array(verts);
      const colorData = new Float32Array(cols);
      const texCoordData = new Float32Array(texCoords);
      const indexData = new Uint16Array(inds);

      if (!obj.__mel_vbo) {
        obj.__mel_vbo = gl.createBuffer();
        obj.__mel_cbo = gl.createBuffer();
        obj.__mel_tbo = gl.createBuffer();
        obj.__mel_ibo = gl.createBuffer();
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_cbo);
      gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_tbo);
      gl.bufferData(gl.ARRAY_BUFFER, texCoordData, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.__mel_ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.DYNAMIC_DRAW);

      const program = target.__mel_active_shader
        ? target.__mel_active_shader.program
        : target.__mel_3d_program;
      gl.useProgram(program);

      const attrs = target.__mel_3d_attrs;
      const uniforms = target.__mel_3d_uniforms;

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_vbo);
      gl.enableVertexAttribArray(attrs.position);
      gl.vertexAttribPointer(attrs.position, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_cbo);
      gl.enableVertexAttribArray(attrs.color);
      gl.vertexAttribPointer(attrs.color, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.__mel_tbo);
      if (attrs.texCoord >= 0) {
        gl.enableVertexAttribArray(attrs.texCoord);
        gl.vertexAttribPointer(attrs.texCoord, 2, gl.FLOAT, false, 0, 0);
      }

      if (obj.texture && obj.texture.__mel_texture) {
        if (!obj.texture.loaded) {
          obj.texture.load(gl);
        }

        if (obj.texture.loadError) {
          Lang.error(obj.texture.loadError);
        }

        if (obj.texture.loaded && obj.texture.glTexture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, obj.texture.glTexture);
          gl.uniform1i(uniforms.texture, 0);
          gl.uniform1i(uniforms.hasTexture, 1);
        } else {
          gl.uniform1i(uniforms.hasTexture, 0);
        }
      } else {
        gl.uniform1i(uniforms.hasTexture, 0);
      }

      const aspect = target.__mel_width / target.__mel_height;
      const camera = target.__mel_active_camera;

      let fov = Math.PI / 4;
      let near = 0.1;
      let far = 1000;
      let ortho = false;

      if (camera && camera.__mel_camera) {
        fov = camera.fov;
        near = camera.near;
        far = camera.far;
        ortho = camera.ortho;
      }

      const projection = ortho
        ? Matrix.ortho(-aspect, aspect, -1, 1, near, far)
        : Matrix.perspective(fov, aspect, near, far);

      let viewMatrix = Matrix.identity();

      if (camera && camera.__mel_camera) {
        viewMatrix = Matrix.rotateX(viewMatrix, -camera.rotX);
        viewMatrix = Matrix.rotateY(viewMatrix, -camera.rotY);
        viewMatrix = Matrix.rotateZ(viewMatrix, -camera.rotZ);
        viewMatrix = Matrix.translate(viewMatrix, -camera.x, -camera.y, -camera.z);
      }

      let modelMatrix = Matrix.identity();
      modelMatrix = Matrix.translate(modelMatrix, obj.x, obj.y, obj.z);
      modelMatrix = Matrix.rotateX(modelMatrix, obj.rx);
      modelMatrix = Matrix.rotateY(modelMatrix, obj.ry);
      modelMatrix = Matrix.rotateZ(modelMatrix, obj.rz);
      modelMatrix = Matrix.scale(modelMatrix, obj.sx, obj.sy, obj.sz);

      const modelView = Matrix.multiply(viewMatrix, modelMatrix);

      gl.uniformMatrix4fv(uniforms.projection, false, projection);
      gl.uniformMatrix4fv(uniforms.modelView, false, modelView);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.__mel_ibo);

      if (obj.wireframe) {
        for (let i = 0; i < obj.faces.length; i++) {
          gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 3 * 2);
        }
      } else {
        gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);
      }

      return target;
    },
  });
}
