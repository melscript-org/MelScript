function  setupUI(Lang){
    

Lang.addHandler('wait', {
  type: 'dual', 
  
  callAsFunction: (args, scope) => {
    const ms = args[0] || 1000;
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  },
  
  callAsMethod: (target, args, scope) => {
    if (!target || !target.__mel_element) {
      Lang.error('wait() only works on UI elements.');
    }
    
    const eventType = String(args[0] || 'click');
    const valueGetter = args[1];
    
    return {
      __mel_waiting: true,
      __mel_element_ref: target,
      __mel_event: eventType,
      __mel_value_getter: valueGetter,
      __mel_value_source: null,
      __mel_return_value: null,
      __mel_submit: null,
      
      __mel_render: function() {
        if (!target.__mel_rendered && typeof target.__mel_render === 'function') {
          target.__mel_render();
        }
        
        Lang.state.paused = true;
        
        target.__mel_dom.addEventListener(eventType, () => {
        
          if (this.__mel_value_source) {
            if (this.__mel_value_source.__mel_dom) {
              this.__mel_return_value = this.__mel_value_source.__mel_dom.value || '';
            }
          }
       
          else if (this.__mel_value_getter && this.__mel_value_getter.params) {
            const funcScope = new Map();
            funcScope.__parent = scope;
                     
            const originalGet = Map.prototype.get;
            const originalSet = Map.prototype.set;
            const originalHas = Map.prototype.has;
            
            funcScope.get = function(key) {
              if (originalHas.call(this, key)) return originalGet.call(this, key);
              if (this.__parent) return this.__parent.get(key);
              return undefined;
            };
            
            funcScope.set = function(key, value) {
              if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
                return this.__parent.set(key, value);
              }
              return originalSet.call(this, key, value);
            };
            
            funcScope.has = function(key) {
              if (originalHas.call(this, key)) return true;
              if (this.__parent) return this.__parent.has(key);
              return false;
            };
            
            for (let i = 0; i < this.__mel_value_getter.body.length; i++) {
              try {
                Lang.state.executeStatement(this.__mel_value_getter.body[i], funcScope);
              } catch (e) {
                if (e.type === 'RETURN') {
                  this.__mel_return_value = e.value;
                  break;
                }
              }
            }
          }
                   
          if (this.__mel_submit) {
            this.__mel_submit();
          }
        }, { once: true });
      }
    };
  }
});



Lang.addHandler('style', {
  type: 'method',
  call: (target, args, scope) => {
    const options = args[0];
    
    if (!target || !options || typeof options !== 'object') {
      return target;
    }
    
    if (!target.__mel_styles) {
      target.__mel_styles = {};
    }
    
    if (options.theme) {
      target.__mel_theme = options.theme;
    }
    
    for (let key in options) {
      let value = options[key];
      
      if (key === 'theme') continue;
      
      if (key === 'px') {
        target.__mel_styles.left = value + 'px';
        continue;
      }
      
      if (key === 'py') {
        target.__mel_styles.top = value + 'px';
        continue;
      }
      
      if (typeof value === 'number') {
        if (key === 'width' || key === 'height' || key === 'fontSize' || 
            key === 'borderRadius' || key === 'padding' || key === 'margin' ||
            key === 'top' || key === 'left' || key === 'right' || key === 'bottom') {
          target.__mel_styles[key] = value + 'px';
        } else {
          target.__mel_styles[key] = String(value);
        }
      } else {
        target.__mel_styles[key] = value;
      }
    }
    
    if (target.__mel_rendered) {
      if (target.__mel_container) {
        for (let prop in target.__mel_styles) {
          target.__mel_container.style.setProperty(prop, target.__mel_styles[prop], 'important');
        }
      }
      
      if (target.__mel_input) {
        for (let prop in target.__mel_styles) {
          target.__mel_input.style.setProperty(prop, target.__mel_styles[prop], 'important');
        }
      }
      
      if (target.__mel_label) {
        target.__mel_label.style.setProperty('color', target.__mel_styles.color, 'important');
      }
      
      if (target.__mel_dom) {
        for (let prop in target.__mel_styles) {
          target.__mel_dom.style.setProperty(prop, target.__mel_styles[prop], 'important');
        }
      }
    }
    
    return target;
  }
});

Lang.addHandler('src', {
  type: 'method',
  call: (target, args, scope) => {
    if (!target || !target.__mel_element) {
      Lang.error('src() only works on MEL elements');
    }
    
    if (args.length === 0) {
      Lang.error('src() requires a URL');
    }
    
    const url = String(args[0]);
    target.__mel_src = url;
    
    if (target.__mel_rendered && target.__mel_dom) {
      target.__mel_dom.src = url;
    } else {     
      const originalRender = target.__mel_render;
      if (originalRender) {
        target.__mel_render = function() {
          originalRender.call(this);
          if (this.__mel_dom && this.__mel_src) {
            this.__mel_dom.src = this.__mel_src;
          }
        };
      }
    }
    
    return target;
  }
});


Lang.addHandler('create', {
  type: 'value',
  value: {
    button: function(text) {
      const buttonObject = {
        __mel_element: true,
        __mel_type: 'button',
        __mel_id: null,
        __mel_text: text || '',
        __mel_rendered: false,
        __mel_styles: {},
        __mel_dom: null,
        
        __mel_render: function() {
          if (this.__mel_rendered) return;
          this.__mel_rendered = true;
          
          const button = document.createElement('button');
          if (this.__mel_id) {
            button.id = this.__mel_id;
          }
          button.textContent = this.__mel_text;
          
          if (this.__mel_styles.left || this.__mel_styles.top) {
            button.style.position = 'absolute';
          }
          
          for (let prop in this.__mel_styles) {
            button.style[prop] = this.__mel_styles[prop];
          }
          
          document.body.appendChild(button);
          this.__mel_dom = button;
        }
      };
      
      setTimeout(() => {
        if (!buttonObject.__mel_rendered) {
          buttonObject.__mel_render();
        }
      }, 0);
      
      return buttonObject;
    },
    
    element: function(tag, text) {
      const elementObject = {
        __mel_element: true,
        __mel_type: 'element',
        __mel_tag: tag || 'div',
        __mel_text: text || '',
        __mel_id: null,
        __mel_rendered: false,
        __mel_styles: {},
        __mel_dom: null,
        
        __mel_render: function() {
          if (this.__mel_rendered) return;
          this.__mel_rendered = true;
          
          const element = document.createElement(this.__mel_tag);
          if (this.__mel_id) {
            element.id = this.__mel_id;
          }
          element.textContent = this.__mel_text;
          
          if (this.__mel_styles.left || this.__mel_styles.top) {
            element.style.position = 'absolute';
          }
          
          for (let prop in this.__mel_styles) {
            element.style[prop] = this.__mel_styles[prop];
          }
          
          document.body.appendChild(element);
          this.__mel_dom = element;
        }
      };
      
      setTimeout(() => {
        if (!elementObject.__mel_rendered) {
          elementObject.__mel_render();
        }
      }, 0);
      
      return elementObject;
    }
  }
});

Lang.addKeyword('create');
  
  
Lang.addHandler('on', {
  type: 'method',
  call: (target, args, scope) => {  
    const isValidTarget = target && (
      target.__mel_element || 
      target.__mel_gl ||      
      target.__mel_ctx       
    );
    
    if (!isValidTarget) {
      Lang.error('on() can only be called on MEL elements or canvas');
    }
    
    if (args.length < 2) {
      Lang.error('on() requires event name and callback function');
    }
    
    const eventName = String(args[0]);
    const callback = args[1];
    
    if (!callback || (!callback.params && typeof callback !== 'function')) {
      Lang.error('Second argument to on() must be a function');
    }

    const domElement = target.__mel_dom;
   
    if (domElement) {
      attachEventListener(domElement, eventName, callback, scope);
    } else {
   
      if (!target.__mel_events) {
        target.__mel_events = [];
      }
      target.__mel_events.push({ event: eventName, callback: callback });
           
      const originalRender = target.__mel_render;
      if (originalRender) {
        target.__mel_render = function() {
          originalRender.call(this);
          
          if (this.__mel_events && this.__mel_dom) {
            for (let i = 0; i < this.__mel_events.length; i++) {
              const evt = this.__mel_events[i];
              attachEventListener(this.__mel_dom, evt.event, evt.callback, scope);
            }          
            this.__mel_events = [];
          }
        };
      }
    }
    
    return target;
  }
});


function attachEventListener(domElement, eventName, callback, scope) {
  const options = eventName.startsWith('touch') ? { passive: false } : false;
  
  domElement.addEventListener(eventName, function(e) {
    try {    
      if (callback.params && callback.body) {
           
        const baseScope = scope || Lang.state.variables;        
      
        const eventScope = new Map();
        eventScope.__parent = baseScope;
        
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;
        
        eventScope.get = function(key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };
        
        eventScope.set = function(key, value) {
          if (this.__parent && this.__parent.has && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };
        
        eventScope.has = function(key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent && this.__parent.has) return this.__parent.has(key);
          return false;
        };
              
        if (callback.params.length > 0) {
          const paramName = callback.params[0].name || callback.params[0];
          originalSet.call(eventScope, paramName, e);
        }
             
        for (let i = 0; i < callback.body.length; i++) {
          Lang.state.executeStatement(callback.body[i], eventScope);
        }
      }       
      else if (typeof callback === 'function') {
        callback(e);
      }
    } catch (err) {
      if (err.type === 'RETURN') {
        return;
      }
      console.error('Error in event handler:', err);
    }
  }, options);
}


Lang.addHandler('remove', {
  type: 'method',
  call: (target, args, scope) => {
    if (!target || !target.__mel_element) {
      Lang.error('remove() only works on UI elements.');
    }
      
    if (target.__mel_dom && target.__mel_dom.parentNode) {
      target.__mel_dom.remove();
      target.__mel_rendered = false;
      target.__mel_dom = null;
    }
    
    return null;
  }
 
});


Lang.addHandler('getCanvasPosition', {
  type: 'method',
  call: (target, args, scope) => {
    const event = args[0];
    const canvas = args[1];
    
    if (!canvas || !canvas.__mel_dom) {
      Lang.error('getCanvasPosition() requires a canvas as second argument');
    }
    
    let clientX, clientY;
    
 
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }
 
    else if (event.clientX !== undefined) {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    else {
      return { x: 0, y: 0 };
    }
    
    const rect = canvas.__mel_dom.getBoundingClientRect();
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
});

Lang.state.variables.set('touch', {
  __mel_element: true,
  __mel_type: 'touch',
  __mel_rendered: true,
  __mel_dom: document,
  __mel_events: []
});

Lang.state.variables.set('keyboard', {
  __mel_element: true,
  __mel_type: 'keyboard',
  __mel_rendered: true,
  __mel_dom: document,
  __mel_events: []
});


}
