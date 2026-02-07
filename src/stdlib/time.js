
function setupTime(Lang) {
  
  Lang.addHandler('setTimeout', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 2) {
        Lang.error('setTimeout requires 2 arguments: (callback, delay)');
      }
      
      const callback = args[0];
      const delay = args[1];
      
      if (typeof callback !== 'function' && (!callback.params || !callback.body)) {
        Lang.error('First argument of setTimeout must be a function');
      }
      
      const timeoutId = window.setTimeout(() => {
        if (callback.params && callback.body) {
          try {
            for (let i = 0; i < callback.body.length; i++) {
              Lang.state.executeStatement(callback.body[i], Lang.state.variables);
            }
          } catch (e) {
            if (e.type !== 'RETURN') throw e;
          }
        } else if (typeof callback === 'function') {
          callback();
        }
      }, delay);
      
      return timeoutId;
    }
  });
  
  Lang.addHandler('clearTimeout', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 1) {
        Lang.error('clearTimeout requires 1 argument: (timeoutId)');
      }
      
      window.clearTimeout(args[0]);
      return null;
    }
  });
  
  Lang.addHandler('setInterval', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 2) {
        Lang.error('setInterval requires 2 arguments: (callback, delay)');
      }
      
      const callback = args[0];
      const delay = args[1];
      
      if (typeof callback !== 'function' && (!callback.params || !callback.body)) {
        Lang.error('First argument of setInterval must be a function');
      }
      
      const intervalId = window.setInterval(() => {
        if (callback.params && callback.body) {
          try {
            for (let i = 0; i < callback.body.length; i++) {
              Lang.state.executeStatement(callback.body[i], Lang.state.variables);
            }
          } catch (e) {
            if (e.type !== 'RETURN') throw e;
          }
        } else if (typeof callback === 'function') {
          callback();
        }
      }, delay);
      
      return intervalId;
    }
  });
  
  Lang.addHandler('clearInterval', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 1) {
        Lang.error('clearInterval requires 1 argument: (intervalId)');
      }
      
      window.clearInterval(args[0]);
      return null;
    }
  });
  
  Lang.addHandler('getHours', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getHours();
  }
});

Lang.addHandler('getMinutes', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getMinutes();
  }
});

Lang.addHandler('getSeconds', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getSeconds();
  }
});

Lang.addHandler('getMilliseconds', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getMilliseconds();
  }
});

Lang.addHandler('getDate', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getDate();
  }
});

Lang.addHandler('getMonth', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getMonth();
  }
});

Lang.addHandler('getFullYear', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getFullYear();
  }
});

Lang.addHandler('getDay', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getDay();
  }
});

Lang.addHandler('getTime', {
  type: 'function',
  call: (args, scope) => {
    const date = args[0] ? new Date(args[0]) : new Date();
    return date.getTime();
  }
});
}
