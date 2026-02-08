function setupCanvas2D(Lang) {
  Lang.addHandler('fillRect', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('fillRect() only works on 2D canvas');
      }

      target.__mel_ctx.fillRect(args[0], args[1], args[2], args[3]);
      return target;
    },
  });

  Lang.addHandler('strokeRect', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('strokeRect() only works on 2D canvas');
      }

      const x = args[0] || 0;
      const y = args[1] || 0;
      const w = args[2] || 0;
      const h = args[3] || 0;

      target.__mel_ctx.strokeRect(x, y, w, h);
      return target;
    },
  });

  Lang.addHandler('clearRect', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('clearRect() only works on 2D canvas');
      }

      const x = args[0] || 0;
      const y = args[1] || 0;
      const w = args[2] || target.__mel_width;
      const h = args[3] || target.__mel_height;

      target.__mel_ctx.clearRect(x, y, w, h);
      return target;
    },
  });

  Lang.addHandler('fillStyle', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('fillStyle() only works on 2D canvas');
      }

      const value = args[0];
      target.__mel_ctx.fillStyle = typeof value === 'string' ? value : String(value);
      return target;
    },
  });

  Lang.addHandler('strokeStyle', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('strokeStyle() only works on 2D canvas');
      }

      target.__mel_ctx.strokeStyle = String(args[0]);
      return target;
    },
  });

  Lang.addHandler('lineWidth', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('lineWidth() only works on 2D canvas');
      }

      target.__mel_ctx.lineWidth = args[0];
      return target;
    },
  });

  Lang.addHandler('beginPath', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('beginPath() only works on 2D canvas');
      }

      target.__mel_ctx.beginPath();
      return target;
    },
  });

  Lang.addHandler('closePath', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('closePath() only works on 2D canvas');
      }

      target.__mel_ctx.closePath();
      return target;
    },
  });

  Lang.addHandler('moveTo', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('moveTo() only works on 2D canvas');
      }

      target.__mel_ctx.moveTo(args[0], args[1]);
      return target;
    },
  });

  Lang.addHandler('lineTo', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('lineTo() only works on 2D canvas');
      }

      target.__mel_ctx.lineTo(args[0], args[1]);
      return target;
    },
  });

  Lang.addHandler('stroke', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('stroke() only works on 2D canvas');
      }

      target.__mel_ctx.stroke();
      return target;
    },
  });

  Lang.addHandler('fill', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('fill() only works on 2D canvas');
      }

      target.__mel_ctx.fill();
      return target;
    },
  });

  Lang.addHandler('arc', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('arc() only works on 2D canvas');
      }

      const x = args[0];
      const y = args[1];
      const radius = args[2];
      const startAngle = args[3] || 0;
      const endAngle = args[4] || Math.PI * 2;

      target.__mel_ctx.arc(x, y, radius, startAngle, endAngle);
      return target;
    },
  });

  Lang.addHandler('rect', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('rect() only works on 2D canvas');
      }

      target.__mel_ctx.rect(args[0], args[1], args[2], args[3]);
      return target;
    },
  });

  Lang.addHandler('fillText', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('fillText() only works on 2D canvas');
      }

      const text = String(args[0]);
      const x = args[1];
      const y = args[2];

      target.__mel_ctx.fillText(text, x, y);
      return target;
    },
  });

  Lang.addHandler('strokeText', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('strokeText() only works on 2D canvas');
      }

      const text = String(args[0]);
      const x = args[1];
      const y = args[2];

      target.__mel_ctx.strokeText(text, x, y);
      return target;
    },
  });

  Lang.addHandler('font', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('font() only works on 2D canvas');
      }

      target.__mel_ctx.font = String(args[0]);
      return target;
    },
  });

  Lang.addHandler('textAlign', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('textAlign() only works on 2D canvas');
      }

      target.__mel_ctx.textAlign = String(args[0]);
      return target;
    },
  });

  Lang.addHandler('save', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('save() only works on 2D canvas');
      }

      target.__mel_ctx.save();
      return target;
    },
  });

  Lang.addHandler('restore', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('restore() only works on 2D canvas');
      }

      target.__mel_ctx.restore();
      return target;
    },
  });

  Lang.addHandler('translate', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('translate() only works on 2D canvas');
      }

      target.__mel_ctx.translate(args[0], args[1]);
      return target;
    },
  });

  Lang.addHandler('rotate', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('rotate() only works on 2D canvas');
      }

      target.__mel_ctx.rotate(args[0]);
      return target;
    },
  });

  Lang.addHandler('scale', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('scale() only works on 2D canvas');
      }

      target.__mel_ctx.scale(args[0], args[1]);
      return target;
    },
  });

  Lang.addHandler('getImageData', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('getImageData() only works on 2D canvas');
      }

      const x = args[0] || 0;
      const y = args[1] || 0;
      const w = args[2] || target.__mel_width;
      const h = args[3] || target.__mel_height;

      return target.__mel_ctx.getImageData(x, y, w, h);
    },
  });

  Lang.addHandler('putImageData', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('putImageData() only works on 2D canvas');
      }

      const imageData = args[0];
      const x = args[1] || 0;
      const y = args[2] || 0;

      target.__mel_ctx.putImageData(imageData, x, y);
      return target;
    },
  });

  Lang.addHandler('createImageData', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_ctx) {
        Lang.error('createImageData() only works on 2D canvas');
      }

      const w = args[0] || target.__mel_width;
      const h = args[1] || target.__mel_height;

      return target.__mel_ctx.createImageData(w, h);
    },
  });
}
