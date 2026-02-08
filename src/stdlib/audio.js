function setupAudio(Lang) {
  const audioPool = new Map();
  const maxPoolSize = 50;

  let audioContext = null;
  let masterGain = null;

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.value = 1.0;
    }
    return audioContext;
  }

  Lang.addHandler('Audio', {
    type: 'value',
    value: {
      load: function (src) {
        const audio = new Audio(src);

        return {
          __mel_audio: true,
          __mel_element: audio,
          __mel_src: src,
          __mel_loop: false,
          __mel_volume: 1.0,
          __mel_playbackRate: 1.0,

          play: function () {
            this.__mel_element.volume = this.__mel_volume;
            this.__mel_element.loop = this.__mel_loop;
            this.__mel_element.playbackRate = this.__mel_playbackRate;

            const playPromise = this.__mel_element.play();

            if (playPromise !== undefined) {
              playPromise.catch((e) => {
                console.warn('[MEL Audio] Play failed:', e);
              });
            }

            return this;
          },

          pause: function () {
            this.__mel_element.pause();
            return this;
          },

          stop: function () {
            this.__mel_element.pause();
            this.__mel_element.currentTime = 0;
            return this;
          },

          volume: function (v) {
            this.__mel_volume = Math.max(0, Math.min(1, v));
            this.__mel_element.volume = this.__mel_volume;
            return this;
          },

          loop: function (enabled) {
            this.__mel_loop = enabled;
            this.__mel_element.loop = enabled;
            return this;
          },

          speed: function (rate) {
            this.__mel_playbackRate = rate;
            this.__mel_element.playbackRate = rate;
            return this;
          },

          seek: function (time) {
            this.__mel_element.currentTime = time;
            return this;
          },

          getDuration: function () {
            return this.__mel_element.duration || 0;
          },

          getCurrentTime: function () {
            return this.__mel_element.currentTime || 0;
          },

          isPlaying: function () {
            return !this.__mel_element.paused;
          },
        };
      },

      playSound: function (src, volume) {
        const vol = volume !== undefined ? volume : 1.0;

        let poolKey = src + '_' + vol;

        if (!audioPool.has(poolKey)) {
          audioPool.set(poolKey, []);
        }

        const pool = audioPool.get(poolKey);
        let audio = null;

        for (let i = 0; i < pool.length; i++) {
          if (pool[i].paused || pool[i].ended) {
            audio = pool[i];
            break;
          }
        }

        if (!audio) {
          if (pool.length < maxPoolSize) {
            audio = new Audio(src);
            pool.push(audio);
          } else {
            audio = pool[0];
            audio.pause();
            audio.currentTime = 0;
          }
        }

        audio.volume = vol;
        audio.currentTime = 0;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('[MEL Audio] PlaySound failed:', e);
          });
        }
      },
    },
  });

  Lang.addKeyword('Audio');

  Lang.addHandler('Synth', {
    type: 'value',
    value: {
      playNote: function (frequency, duration, waveType) {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = waveType || 'sine';
        oscillator.frequency.value = frequency;

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        gainNode.gain.value = 0.3;

        const dur = duration || 0.5;

        oscillator.start(ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        oscillator.stop(ctx.currentTime + dur);
      },

      beep: function (freq) {
        const f = freq || 440;
        this.playNote(f, 0.1, 'square');
      },

      createOscillator: function (type) {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type || 'sine';
        osc.connect(gain);
        gain.connect(masterGain);

        return {
          __mel_synth: true,
          __mel_oscillator: osc,
          __mel_gain: gain,
          __mel_started: false,

          frequency: function (freq) {
            this.__mel_oscillator.frequency.value = freq;
            return this;
          },

          volume: function (vol) {
            this.__mel_gain.gain.value = vol;
            return this;
          },

          type: function (waveType) {
            this.__mel_oscillator.type = waveType;
            return this;
          },

          start: function () {
            if (!this.__mel_started) {
              this.__mel_oscillator.start();
              this.__mel_started = true;
            }
            return this;
          },

          stop: function () {
            if (this.__mel_started) {
              this.__mel_oscillator.stop();
              this.__mel_started = false;
            }
            return this;
          },

          fadeOut: function (duration) {
            const dur = duration || 0.5;
            const ctx = getAudioContext();
            this.__mel_gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);

            setTimeout(() => {
              this.stop();
            }, dur * 1000);

            return this;
          },
        };
      },
    },
  });

  Lang.addKeyword('Synth');

  const noteFrequencies = {
    C0: 16.35,
    'C#0': 17.32,
    D0: 18.35,
    'D#0': 19.45,
    E0: 20.6,
    F0: 21.83,
    'F#0': 23.12,
    G0: 24.5,
    'G#0': 25.96,
    A0: 27.5,
    'A#0': 29.14,
    B0: 30.87,
    C1: 32.7,
    'C#1': 34.65,
    D1: 36.71,
    'D#1': 38.89,
    E1: 41.2,
    F1: 43.65,
    'F#1': 46.25,
    G1: 49.0,
    'G#1': 51.91,
    A1: 55.0,
    'A#1': 58.27,
    B1: 61.74,
    C2: 65.41,
    'C#2': 69.3,
    D2: 73.42,
    'D#2': 77.78,
    E2: 82.41,
    F2: 87.31,
    'F#2': 92.5,
    G2: 98.0,
    'G#2': 103.83,
    A2: 110.0,
    'A#2': 116.54,
    B2: 123.47,
    C3: 130.81,
    'C#3': 138.59,
    D3: 146.83,
    'D#3': 155.56,
    E3: 164.81,
    F3: 174.61,
    'F#3': 185.0,
    G3: 196.0,
    'G#3': 207.65,
    A3: 220.0,
    'A#3': 233.08,
    B3: 246.94,
    C4: 261.63,
    'C#4': 277.18,
    D4: 293.66,
    'D#4': 311.13,
    E4: 329.63,
    F4: 349.23,
    'F#4': 369.99,
    G4: 392.0,
    'G#4': 415.3,
    A4: 440.0,
    'A#4': 466.16,
    B4: 493.88,
    C5: 523.25,
    'C#5': 554.37,
    D5: 587.33,
    'D#5': 622.25,
    E5: 659.25,
    F5: 698.46,
    'F#5': 739.99,
    G5: 783.99,
    'G#5': 830.61,
    A5: 880.0,
    'A#5': 932.33,
    B5: 987.77,
    C6: 1046.5,
    'C#6': 1108.73,
    D6: 1174.66,
    'D#6': 1244.51,
    E6: 1318.51,
    F6: 1396.91,
    'F#6': 1479.98,
    G6: 1567.98,
    'G#6': 1661.22,
    A6: 1760.0,
    'A#6': 1864.66,
    B6: 1975.53,
    C7: 2093.0,
    'C#7': 2217.46,
    D7: 2349.32,
    'D#7': 2489.02,
    E7: 2637.02,
    F7: 2793.83,
    'F#7': 2959.96,
    G7: 3135.96,
    'G#7': 3322.44,
    A7: 3520.0,
    'A#7': 3729.31,
    B7: 3951.07,
    C8: 4186.01,
  };

  Lang.addHandler('Music', {
    type: 'value',
    value: {
      playNote: function (note, duration, instrument) {
        const freq = noteFrequencies[note];

        if (!freq) {
          Lang.error('Invalid note: ' + note);
        }

        const inst = instrument || 'sine';
        const dur = duration || 0.5;

        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = inst;
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(masterGain);

        gain.gain.value = 0.3;

        osc.start(ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.stop(ctx.currentTime + dur);
      },

      playSequence: function (notes, tempo) {
        const bpm = tempo || 120;
        const beatDuration = 60 / bpm;

        let currentTime = 0;

        for (let i = 0; i < notes.length; i++) {
          const noteData = notes[i];
          const note = noteData.note || noteData;
          const duration = noteData.duration || beatDuration;
          const instrument = noteData.instrument || 'sine';

          if (note !== 'rest') {
            setTimeout(() => {
              this.playNote(note, duration, instrument);
            }, currentTime * 1000);
          }

          currentTime += duration;
        }
      },

      noteToFreq: function (note) {
        return noteFrequencies[note] || 0;
      },

      getNotes: function () {
        return Object.keys(noteFrequencies);
      },
    },
  });

  Lang.addKeyword('Music');

  Lang.addHandler('AudioMaster', {
    type: 'value',
    value: {
      setVolume: function (vol) {
        getAudioContext();
        masterGain.gain.value = Math.max(0, Math.min(1, vol));
      },

      getVolume: function () {
        if (!masterGain) return 1.0;
        return masterGain.gain.value;
      },

      mute: function () {
        getAudioContext();
        masterGain.gain.value = 0;
      },

      unmute: function () {
        getAudioContext();
        masterGain.gain.value = 1.0;
      },

      resume: function () {
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume();
        }
      },
    },
  });

  Lang.addKeyword('AudioMaster');

  Lang.addHandler('playMelody', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 1) {
        Lang.error('playMelody requires 1 argument: (melody array)');
      }

      const melody = args[0];
      const waveType = args[1] || 'sine';
      const volume = args[2] || 0.3;

      if (!Array.isArray(melody)) {
        Lang.error('First argument must be an array of notes');
      }

      const ctx = getAudioContext();
      let currentTime = ctx.currentTime;

      for (let i = 0; i < melody.length; i++) {
        const note = melody[i];
        const freq = note.freq || 440;
        const dur = note.dur || 0.5;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = waveType;
        oscillator.frequency.value = freq;

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        gainNode.gain.value = volume;

        oscillator.start(currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + dur);
        oscillator.stop(currentTime + dur);

        currentTime += dur;
      }

      return null;
    },
  });
}
