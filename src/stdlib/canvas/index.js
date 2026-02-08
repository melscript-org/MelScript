function setupCanvas(Lang) {
  Lang.addHandler('canvas', {
    type: 'value',
    value: {
      create2d: function (width, height) {
        const w = width || 800;
        const h = height || 600;

        const canvasObject = {
          __mel_element: true,
          __mel_type: 'canvas',
          __mel_context_type: '2d',
          __mel_id: null,
          __mel_width: w,
          __mel_height: h,
          __mel_rendered: false,
          __mel_styles: {},
          __mel_dom: null,
          __mel_ctx: null,
          __mel_scale: 1,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const canvas = document.createElement('canvas');
            if (this.__mel_id) {
              canvas.id = this.__mel_id;
            }
            canvas.width = this.__mel_width;
            canvas.height = this.__mel_height;

            const hasPositioning =
              this.__mel_styles.position ||
              this.__mel_styles.left ||
              this.__mel_styles.top ||
              this.__mel_styles.zIndex;

            if (!hasPositioning) {
              canvas.style.maxWidth = '100%';
              canvas.style.height = 'auto';
            } else {
              canvas.style.width = this.__mel_width + 'px';
              canvas.style.height = this.__mel_height + 'px';
            }

            canvas.style.display = 'block';

            for (let prop in this.__mel_styles) {
              canvas.style[prop] = this.__mel_styles[prop];
            }

            document.body.appendChild(canvas);
            this.__mel_dom = canvas;
            this.__mel_ctx = canvas.getContext('2d');

            this.__mel_setupResize();
          },

          __mel_setupResize: function () {
            const canvas = this.__mel_dom;
            const ctx = this.__mel_ctx;
            const baseWidth = this.__mel_width;
            const baseHeight = this.__mel_height;

            const resize = () => {
              const rect = canvas.getBoundingClientRect();
              this.__mel_scale = rect.width / baseWidth;
            };

            window.addEventListener('resize', resize);
            resize();
          },
        };

        canvasObject.__mel_render();

        return canvasObject;
      },

      createWebGL: function (width, height) {
        const w = width || 800;
        const h = height || 600;

        const canvasObject = {
          __mel_element: true,
          __mel_type: 'canvas',
          __mel_context_type: 'webgl',
          __mel_id: null,
          __mel_width: w,
          __mel_height: h,
          __mel_rendered: false,
          __mel_styles: {},
          __mel_dom: null,
          __mel_gl: null,
          __mel_scale: 1,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const canvas = document.createElement('canvas');
            if (this.__mel_id) {
              canvas.id = this.__mel_id;
            }
            canvas.width = this.__mel_width;
            canvas.height = this.__mel_height;

            const hasPositioning =
              this.__mel_styles.position ||
              this.__mel_styles.left ||
              this.__mel_styles.top ||
              this.__mel_styles.zIndex;

            if (!hasPositioning) {
              canvas.style.maxWidth = '100%';
              canvas.style.height = 'auto';
            } else {
              canvas.style.width = this.__mel_width + 'px';
              canvas.style.height = this.__mel_height + 'px';
            }

            canvas.style.display = 'block';

            for (let prop in this.__mel_styles) {
              canvas.style[prop] = this.__mel_styles[prop];
            }

            document.body.appendChild(canvas);
            this.__mel_dom = canvas;
            this.__mel_gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (!this.__mel_gl) {
              Lang.error('WebGL not supported');
            }

            this.__mel_setupResize();
          },

          __mel_setupResize: function () {
            const canvas = this.__mel_dom;
            const gl = this.__mel_gl;
            const baseWidth = this.__mel_width;
            const baseHeight = this.__mel_height;

            const resize = () => {
              const rect = canvas.getBoundingClientRect();
              this.__mel_scale = rect.width / baseWidth;
              gl.viewport(0, 0, canvas.width, canvas.height);
            };

            window.addEventListener('resize', resize);
            resize();
          },
        };

        canvasObject.__mel_render();

        return canvasObject;
      },

      createEmpty: function (width, height) {
        const w = width || window.innerWidth;
        const h = height || window.innerHeight;

        const canvasObject = {
          __mel_element: true,
          __mel_type: 'canvas',
          __mel_width: w,
          __mel_height: h,
          __mel_rendered: false,
          __mel_styles: {},
          __mel_dom: null,

          getCanvas: function () {
            return this.__mel_dom;
          },

          getWidth: function () {
            return this.__mel_width;
          },

          getHeight: function () {
            return this.__mel_height;
          },

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const canvas = document.createElement('canvas');
            canvas.width = this.__mel_width;
            canvas.height = this.__mel_height;
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';

            for (let prop in this.__mel_styles) {
              canvas.style[prop] = this.__mel_styles[prop];
            }

            document.body.appendChild(canvas);
            this.__mel_dom = canvas;
          },
        };

        canvasObject.__mel_render();
        return canvasObject;
      },

      createFullscreen: function (contextType) {
        const type = contextType || '2d';

        const canvasObject = {
          __mel_element: true,
          __mel_type: 'canvas',
          __mel_context_type: type,
          __mel_id: null,
          __mel_width: window.innerWidth,
          __mel_height: window.innerHeight,
          __mel_rendered: false,
          __mel_styles: {},
          __mel_dom: null,
          __mel_ctx: null,
          __mel_gl: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const canvas = document.createElement('canvas');
            if (this.__mel_id) {
              canvas.id = this.__mel_id;
            }
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';

            for (let prop in this.__mel_styles) {
              canvas.style[prop] = this.__mel_styles[prop];
            }

            document.body.appendChild(canvas);
            this.__mel_dom = canvas;

            if (type === '2d') {
              this.__mel_ctx = canvas.getContext('2d');
            } else {
              this.__mel_gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
              if (!this.__mel_gl) {
                Lang.error('WebGL not supported');
              }
            }

            this.__mel_setupFullscreenResize();
          },

          __mel_setupFullscreenResize: function () {
            const canvas = this.__mel_dom;

            const resize = () => {
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              this.__mel_width = window.innerWidth;
              this.__mel_height = window.innerHeight;

              if (this.__mel_gl) {
                this.__mel_gl.viewport(0, 0, canvas.width, canvas.height);
              }
            };

            window.addEventListener('resize', resize);
          },
        };

        canvasObject.__mel_render();

        return canvasObject;
      },
    },
  });

  Lang.addKeyword('canvas');

  Lang.addHandler('getCanvasPosition', {
    type: 'method',
    call: (target, args, scope) => {
      const event = args[0];

      if (!target || (!target.__mel_ctx && !target.__mel_gl)) {
        Lang.error('getCanvasPosition() only works on canvas elements');
      }

      let clientX, clientY;

      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.clientX !== undefined) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        return { x: 0, y: 0 };
      }

      const canvas = target.__mel_dom;
      if (!canvas) {
        return { x: 0, y: 0 };
      }

      const rect = canvas.getBoundingClientRect();

      const scaleX = target.__mel_width / rect.width;
      const scaleY = target.__mel_height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
  });

  setupCanvas2D(Lang);
  setupCanvasWebGL(Lang);
}
