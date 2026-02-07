
function setupCrypto(Lang) {
  Lang.addHandler('crypto', {
    type: 'value',
    value: {
      sha256: function(text) {
        const str = String(text);
        const asyncId = 'mel-crypto-sha256-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            
            crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      },
      
      sha512: function(text) {
        const str = String(text);
        const asyncId = 'mel-crypto-sha512-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            
            crypto.subtle.digest('SHA-512', data).then(hashBuffer => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      },
      
      sha1: function(text) {
        const str = String(text);
        const asyncId = 'mel-crypto-sha1-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            
            crypto.subtle.digest('SHA-1', data).then(hashBuffer => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      },
      
      randomBytes: function(length) {
        const len = Number(length) || 16;
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      },
      
      randomUUID: function() {
        return crypto.randomUUID();
      },
      
      base64encode: function(text) {
        const str = String(text);
        return btoa(unescape(encodeURIComponent(str)));
      },
      
      base64decode: function(text) {
        const str = String(text);
        return decodeURIComponent(escape(atob(str)));
      },
      
      hmac: function(message, key) {
        const msg = String(message);
        const secret = String(key);
        const asyncId = 'mel-crypto-hmac-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const msgData = encoder.encode(msg);
            
            crypto.subtle.importKey(
              'raw',
              keyData,
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            ).then(cryptoKey => {
              return crypto.subtle.sign('HMAC', cryptoKey, msgData);
            }).then(signature => {
              const hashArray = Array.from(new Uint8Array(signature));
              this.__mel_return_value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            }).catch(err => {
              this.__mel_return_value = 'ERROR: ' + err.message;
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      },
      
      aesEncrypt: function(text, password) {
        const plaintext = String(text);
        const pass = String(password);
        const asyncId = 'mel-crypto-aes-enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const passwordData = encoder.encode(pass);
            
            crypto.subtle.importKey(
              'raw',
              passwordData,
              'PBKDF2',
              false,
              ['deriveBits', 'deriveKey']
            ).then(keyMaterial => {
              return crypto.subtle.deriveKey(
                {
                  name: 'PBKDF2',
                  salt: salt,
                  iterations: 100000,
                  hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
              );
            }).then(key => {
              const data = encoder.encode(plaintext);
              return crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
              ).then(encrypted => ({ encrypted, salt, iv }));
            }).then(({ encrypted, salt, iv }) => {
              const encryptedArray = new Uint8Array(encrypted);
              const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
              result.set(salt, 0);
              result.set(iv, salt.length);
              result.set(encryptedArray, salt.length + iv.length);
              this.__mel_return_value = Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            }).catch(err => {
              this.__mel_return_value = 'ERROR: ' + err.message;
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      },
      
      aesDecrypt: function(encryptedHex, password) {
        const encrypted = String(encryptedHex);
        const pass = String(password);
        const asyncId = 'mel-crypto-aes-dec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            try {
              const encoder = new TextEncoder();
              const decoder = new TextDecoder();
              
              const bytes = new Uint8Array(encrypted.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
              const salt = bytes.slice(0, 16);
              const iv = bytes.slice(16, 28);
              const data = bytes.slice(28);
              
              const passwordData = encoder.encode(pass);
              
              crypto.subtle.importKey(
                'raw',
                passwordData,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
              ).then(keyMaterial => {
                return crypto.subtle.deriveKey(
                  {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                  },
                  keyMaterial,
                  { name: 'AES-GCM', length: 256 },
                  false,
                  ['decrypt']
                );
              }).then(key => {
                return crypto.subtle.decrypt(
                  { name: 'AES-GCM', iv: iv },
                  key,
                  data
                );
              }).then(decrypted => {
                this.__mel_return_value = decoder.decode(decrypted);
                
                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              }).catch(err => {
                this.__mel_return_value = 'ERROR: ' + err.message;
                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              });
            } catch (err) {
              this.__mel_return_value = 'ERROR: ' + err.message;
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            }
          }
        };
        
        return cryptoObject;
      },
      
      pbkdf2: function(password, salt, iterations, keyLength) {
        const pass = String(password);
        const saltStr = String(salt);
        const iter = Number(iterations) || 100000;
        const len = Number(keyLength) || 32;
        const asyncId = 'mel-crypto-pbkdf2-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,
          
          __mel_render: function() {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;
            
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(pass);
            const saltData = encoder.encode(saltStr);
            
            crypto.subtle.importKey(
              'raw',
              passwordData,
              'PBKDF2',
              false,
              ['deriveBits']
            ).then(keyMaterial => {
              return crypto.subtle.deriveBits(
                {
                  name: 'PBKDF2',
                  salt: saltData,
                  iterations: iter,
                  hash: 'SHA-256'
                },
                keyMaterial,
                len * 8
              );
            }).then(bits => {
              const hashArray = Array.from(new Uint8Array(bits));
              this.__mel_return_value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            }).catch(err => {
              this.__mel_return_value = 'ERROR: ' + err.message;
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          }
        };
        
        return cryptoObject;
      }
    }
  });
  
  Lang.addKeyword('crypto');
}
