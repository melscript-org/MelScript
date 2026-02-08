function setupThreads(Lang) {
  const activeWorkers = new Map();

  Lang.addHandler('threads', {
    type: 'value',
    value: {
      spawn: function (code, data) {
        const workerCode = String(code);
        const threadId = 'thread-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const fullCode = `
          self.onmessage = function(e) {
            const data = e.data;
            try {
              ${workerCode}
              self.postMessage({ success: true, result: result });
            } catch (err) {
              self.postMessage({ success: false, error: err.message });
            }
          };
        `;

        const blob = new Blob([fullCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const workerObj = {
          id: threadId,
          worker: worker,
          url: url,
          result: null,
          done: false,
          error: null,
        };

        worker.onmessage = (e) => {
          if (e.data.success) {
            workerObj.result = e.data.result;
          } else {
            workerObj.error = e.data.error;
          }
          workerObj.done = true;
        };

        worker.onerror = (err) => {
          workerObj.error = err.message;
          workerObj.done = true;
        };

        activeWorkers.set(threadId, workerObj);
        worker.postMessage(data || {});

        return threadId;
      },

      wait: function (threadId) {
        const id = String(threadId);
        const asyncId =
          'mel-thread-wait-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const waitObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const checkDone = () => {
              const workerObj = activeWorkers.get(id);

              if (!workerObj) {
                this.__mel_return_value = 'ERROR: Thread not found';
                if (this.__mel_submit) this.__mel_submit();
                return;
              }

              if (workerObj.done) {
                if (workerObj.error) {
                  this.__mel_return_value = 'ERROR: ' + workerObj.error;
                } else {
                  this.__mel_return_value = workerObj.result;
                }

                workerObj.worker.terminate();
                URL.revokeObjectURL(workerObj.url);
                activeWorkers.delete(id);

                if (this.__mel_submit) this.__mel_submit();
              } else {
                setTimeout(checkDone, 10);
              }
            };

            checkDone();
          },
        };

        return waitObject;
      },

      run: function (code, data) {
        const threadId = this.spawn(code, data);
        return this.wait(threadId);
      },
    },
  });

  Lang.addKeyword('threads');
}
