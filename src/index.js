(function () {
  const files = [
    'src/core/state.js',
    'src/runtime/error.js',
    'src/core/tokenizer.js',
    'src/core/parse.js',
    'src/core/evaluator.js',
    'src/execution/executor.js',
    'src/execution/continuation.js',
    'src/execution/input-handler.js',
    'src/core/interpreter.js',
    'src/stdlib/data.js',
    'src/stdlib/methods.js',
    'src/stdlib/ui.js',
    'src/stdlib/io.js',
    'src/stdlib/network.js',
    'src/stdlib/control-flow.js',
    'src/stdlib/functions.js',
    'src/stdlib/wasm.js',
    'src/stdlib/canvas/2d.js',
    'src/stdlib/canvas/webgl.js',
    'src/stdlib/canvas/index.js',
    'src/stdlib/storage.js',
    'src/stdlib/animation.js',
    'src/stdlib/audio.js',
    'src/stdlib/time.js',
    'src/stdlib/crypto.js',
    'src/stdlib/threads.js',

    'src/stdlib/index.js',
    'src/stdlib/init.js',
    'src/loader/script-loader.js',
  ];

  let i = 0;

  function load() {
    if (i >= files.length) return;

    const s = document.createElement('script');
    s.src = files[i];
    s.onload = () => {
      i++;
      load();
    };
    document.head.appendChild(s);
  }

  load();
})();
