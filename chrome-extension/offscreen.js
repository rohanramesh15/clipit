/**
 * Deadbird — Offscreen Audio Recorder
 * Records audio from a tab using MediaRecorder API.
 * This runs in an offscreen document context (Manifest V3).
 *
 * Persistent Loopback Mode:
 * When audio is enabled, we start a continuous audio stream that plays through
 * the speakers (loopback). Recording just taps into this existing stream,
 * so there's no audio interruption or glitches during capture.
 */

// Persistent loopback state (runs continuously once enabled)
let persistentStream = null;
let audioContext = null;
let sourceNode = null;
let isLoopbackActive = false;

// Recording state (temporary, for each capture)
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Start persistent loopback (called when user enables audio)
  if (msg.type === 'OFFSCREEN_START_LOOPBACK') {
    startPersistentLoopback(msg.streamId)
      .then(() => sendResponse({ success: true }))
      .catch(e => {
        console.error('[Deadbird Offscreen] Loopback start failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true;
  }

  // Stop persistent loopback (called when tab closes or audio disabled)
  if (msg.type === 'OFFSCREEN_STOP_LOOPBACK') {
    stopPersistentLoopback();
    sendResponse({ success: true });
    return;
  }

  // Record a clip from the persistent stream
  if (msg.type === 'OFFSCREEN_RECORD_CLIP') {
    recordClip(msg.duration)
      .then(audioData => sendResponse({ success: true, audioData }))
      .catch(e => {
        console.error('[Deadbird Offscreen] Recording failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true;
  }

  // Legacy: Start recording (creates new stream each time - fallback)
  if (msg.type === 'OFFSCREEN_START_RECORDING') {
    // If we have persistent loopback, use it
    if (isLoopbackActive && persistentStream) {
      recordClip(msg.duration)
        .then(audioData => sendResponse({ success: true, audioData }))
        .catch(e => sendResponse({ success: false, error: e.message }));
    } else {
      // Fallback: create new stream (causes audio glitch)
      startRecordingLegacy(msg.streamId, msg.duration)
        .then(audioData => sendResponse({ success: true, audioData }))
        .catch(e => sendResponse({ success: false, error: e.message }));
    }
    return true;
  }

  if (msg.type === 'OFFSCREEN_STOP_RECORDING') {
    stopRecording()
      .then(audioData => sendResponse({ success: true, audioData }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

/**
 * Start persistent audio loopback.
 * This runs continuously, playing tab audio through speakers.
 * Called once when user enables audio capture.
 */
async function startPersistentLoopback(streamId) {
  if (isLoopbackActive) {
    console.log('[Deadbird Offscreen] Loopback already active');
    return;
  }

  console.log('[Deadbird Offscreen] Starting persistent loopback...');

  // Get media stream from the stream ID
  persistentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // Create AudioContext and connect to speakers for loopback
  audioContext = new AudioContext();
  sourceNode = audioContext.createMediaStreamSource(persistentStream);
  sourceNode.connect(audioContext.destination);

  isLoopbackActive = true;
  console.log('[Deadbird Offscreen] ✅ Persistent loopback active - audio will play through speakers');
}

/**
 * Stop persistent loopback and clean up.
 */
function stopPersistentLoopback() {
  console.log('[Deadbird Offscreen] Stopping persistent loopback...');

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  if (persistentStream) {
    persistentStream.getTracks().forEach(track => track.stop());
    persistentStream = null;
  }

  isLoopbackActive = false;
  isRecording = false;
  console.log('[Deadbird Offscreen] Loopback stopped');
}

/**
 * Record a clip from the persistent stream.
 * No audio interruption since stream is already flowing.
 */
async function recordClip(duration = 3000) {
  if (!isLoopbackActive || !persistentStream) {
    throw new Error('Loopback not active. Enable audio capture first.');
  }

  if (isRecording) {
    throw new Error('Recording already in progress');
  }

  console.log('[Deadbird Offscreen] Recording clip, duration:', duration);
  isRecording = true;
  audioChunks = [];

  // Determine supported MIME type
  const mimeType = getSupportedMimeType();

  return new Promise((resolve, reject) => {
    mediaRecorder = new MediaRecorder(persistentStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      console.log('[Deadbird Offscreen] Clip recorded, chunks:', audioChunks.length);

      if (audioChunks.length === 0) {
        reject(new Error('No audio data captured'));
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const base64 = await blobToBase64(audioBlob);

      resolve({
        base64,
        mimeType,
        size: audioBlob.size,
      });
    };

    mediaRecorder.onerror = (event) => {
      isRecording = false;
      console.error('[Deadbird Offscreen] MediaRecorder error:', event.error);
      reject(event.error);
    };

    mediaRecorder.start();

    // Auto-stop after duration
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, duration);
  });
}

/**
 * Legacy recording method - creates new stream each time.
 * Causes brief audio glitch. Used as fallback.
 */
async function startRecordingLegacy(streamId, duration) {
  console.log('[Deadbird Offscreen] Legacy recording (may cause audio glitch)');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // Set up temporary loopback
  const tempContext = new AudioContext();
  const tempSource = tempContext.createMediaStreamSource(stream);
  tempSource.connect(tempContext.destination);

  audioChunks = [];
  const mimeType = getSupportedMimeType();

  return new Promise((resolve, reject) => {
    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Clean up temporary loopback
      tempSource.disconnect();
      tempContext.close().catch(() => {});
      stream.getTracks().forEach(track => track.stop());

      if (audioChunks.length === 0) {
        reject(new Error('No audio data captured'));
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const base64 = await blobToBase64(audioBlob);

      resolve({
        base64,
        mimeType,
        size: audioBlob.size,
      });
    };

    mediaRecorder.onerror = (event) => {
      tempSource.disconnect();
      tempContext.close().catch(() => {});
      stream.getTracks().forEach(track => track.stop());
      reject(event.error);
    };

    mediaRecorder.start();

    if (duration && duration > 0) {
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);
    }
  });
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    throw new Error('No recording in progress');
  }
  mediaRecorder.stop();
}

function getSupportedMimeType() {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

console.log('[Deadbird Offscreen] Audio recorder ready (persistent loopback supported)');
