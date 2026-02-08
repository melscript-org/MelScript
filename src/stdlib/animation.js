function setupAnimation(Lang) {
  const globalLoops = new Map();
  let nextLoopId = 0;

  Lang.killAllLoops = () => {
    globalLoops.forEach(cancelAnimationFrame);
    globalLoops.clear();
  };

  Lang.addKeyword('loop');
  Lang.addKeyword('fps');

  Lang.addHandler('loop', {
    type: 'statement',

    parse: (expect, next, peek, parseExpression, parseBlock) => {
      let targetFps = null;

      if (peek().value === 'fps') {
        next();
        targetFps = parseExpression();
      }

      expect('SYMBOL', '{');
      const body = parseBlock();
      expect('SYMBOL', '}');

      return { type: 'Loop', body, fps: targetFps };
    },
  });

  Lang.addHandler('Loop', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      const loopId = nextLoopId++;
      let animationId = null;

      const compiledBody = () => {
        const len = stmt.body.length;
        for (let i = 0; i < len; i++) {
          executeStatement(stmt.body[i], scope);
        }
      };

      const fpsVal = stmt.fps ? evaluate(stmt.fps, scope) : null;
      const useLimit = fpsVal !== null && fpsVal > 0;
      const interval = useLimit ? 1000 / fpsVal : 0;

      let lastTime = performance.now();
      let frameCount = 0;

      scope.set('frame', 0);
      scope.set('deltaTime', 0);
      scope.set('time', 0);

      const loopNative = (timestamp) => {
        animationId = requestAnimationFrame(loopNative);

        const delta = timestamp - lastTime;
        lastTime = timestamp;

        scope.set('frame', frameCount++);
        scope.set('deltaTime', delta * 0.001);
        scope.set('time', timestamp * 0.001);

        try {
          compiledBody();
        } catch (e) {
          handleError(e, loopId, animationId);
        }
      };

      const loopThrottled = (timestamp) => {
        animationId = requestAnimationFrame(loopThrottled);

        const delta = timestamp - lastTime;

        if (delta < interval) return;
        lastTime = timestamp - (delta % interval);

        scope.set('frame', frameCount++);
        scope.set('deltaTime', delta * 0.001);
        scope.set('time', timestamp * 0.001);

        try {
          compiledBody();
        } catch (e) {
          handleError(e, loopId, animationId);
        }
      };

      const handleError = (e, id, animId) => {
        if (e.type === 'BREAK') {
          cancelAnimationFrame(animId);
          globalLoops.delete(id);
          return;
        }
        if (e.type !== 'CONTINUE') {
          console.error('Loop Error:', e);
          cancelAnimationFrame(animId);
          globalLoops.delete(id);
        }
      };

      if (useLimit) {
        animationId = requestAnimationFrame(loopThrottled);
      } else {
        animationId = requestAnimationFrame(loopNative);
      }
      globalLoops.set(loopId, animationId);
    },
  });
}
