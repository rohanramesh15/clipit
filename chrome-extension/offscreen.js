/**
 * Deadbird — Offscreen Audio Recorder
 * Records audio from a tab using MediaRecorder API.
 * This runs in an offscreen document context (Manifest V3).
 */

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START_RECORDING') {
    startRecording(msg.streamId, msg.duration)
      .then(audioData => sendResponse({ success: true, audioData }))
      .catch(e => {
        console.error('[Deadbird Offscreen] Recording failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true; // async response
  }

  if (msg.type === 'OFFSCREEN_STOP_RECORDING') {
    stopRecording()
      .then(audioData => sendResponse({ success: true, audioData }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

async function startRecording(streamId, duration) {
  console.log('[Deadbird Offscreen] Starting recording, streamId:', streamId, 'duration:', duration);

  // Get media stream from the stream ID
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  recordingStream = stream;
  audioChunks = [];

  // Determine supported MIME type
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  let mimeType = '';
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }

  console.log('[Deadbird Offscreen] Using MIME type:', mimeType);

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[Deadbird Offscreen] Recording stopped, chunks:', audioChunks.length);

      // Stop all tracks
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
      }

      if (audioChunks.length === 0) {
        reject(new Error('No audio data captured'));
        return;
      }

      // Convert to blob and then to base64
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const base64 = await blobToBase64(audioBlob);

      resolve({
        base64,
        mimeType,
        size: audioBlob.size,
      });
    };

    mediaRecorder.onerror = (event) => {
      console.error('[Deadbird Offscreen] MediaRecorder error:', event.error);
      reject(event.error);
    };

    mediaRecorder.start();
    console.log('[Deadbird Offscreen] MediaRecorder started');

    // Auto-stop after duration
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

  return new Promise((resolve) => {
    const originalOnStop = mediaRecorder.onstop;
    mediaRecorder.onstop = async (event) => {
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
      }

      if (audioChunks.length === 0) {
        resolve(null);
        return;
      }

      const mimeType = mediaRecorder.mimeType;
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const base64 = await blobToBase64(audioBlob);

      resolve({
        base64,
        mimeType,
        size: audioBlob.size,
      });
    };

    mediaRecorder.stop();
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Result is "data:audio/webm;base64,XXXXXX"
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

console.log('[Deadbird Offscreen] Audio recorder ready');
