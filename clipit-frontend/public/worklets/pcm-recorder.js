// Captures mono audio from the AudioContext graph, downsamples to 16 kHz,
// and posts Int16 PCM ArrayBuffers back on the worklet port.
//
// We assume the host AudioContext runs at 48 kHz (Chrome default on macOS).
// If it runs at another rate, we still divide by ratio = sampleRate / 16000;
// for non-integer ratios this is a cheap linear pick (good enough for speech).

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetRate = 16000;
    this._ratio = sampleRate / this._targetRate;
    this._acc = 0;        // running source-sample index
    this._buf = [];       // accumulated Int16 samples before posting
    this._chunkSize = 1600; // ~100 ms at 16 kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // Linear downsample by stepping through the source at ratio.
    for (let i = 0; i < channel.length; i += this._ratio) {
      const s = channel[Math.floor(i)] || 0;
      const clamped = Math.max(-1, Math.min(1, s));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this._buf.push(int16);
    }

    while (this._buf.length >= this._chunkSize) {
      const chunk = this._buf.splice(0, this._chunkSize);
      const out = new Int16Array(chunk);
      // RMS for the visualizer (cheap, computed pre-transfer).
      let sumSq = 0;
      for (let i = 0; i < out.length; i++) {
        const v = out[i] / 32768;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / out.length);
      this.port.postMessage({ pcm: out.buffer, rms }, [out.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-recorder', PCMRecorderProcessor);
