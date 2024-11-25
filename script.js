const BPM = 120;
const TICKS = 16;
const INTERVAL = 1 / (4 * BPM / (60 * 1000));
const MAX_BITS = 32;
const MAX_HEX = MAX_BITS / 4;

const sounds = [
  'sounds/bass_drum.wav',
  'sounds/snare_drum.wav',
  'sounds/low_tom.wav',
  'sounds/mid_tom.wav',
  'sounds/hi_tom.wav',
      'sounds/rim_shot.wav',
      'sounds/hand_clap.wav',
      'sounds/cowbell.wav',
      'sounds/cymbal.wav',
      'sounds/o_hi_hat.wav',
      'sounds/cl_hi_hat.wav',

      'sounds/low_conga.wav',
      'sounds/mid_conga.wav',
      'sounds/hi_conga.wav',
      'sounds/claves.wav',
      'sounds/maracas.wav',
];
document.getElementById('modeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const buffers = [];
const theGrid = document.getElementById('grid');
const sLen = sounds.length;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingSourceNode;
let recordingDestination;
let lastTick = TICKS - 1;
let curTick = 0;
let lastTime = new Date().getTime();
let isRunning = true;  // Flag to control if the loop is running
let savedHash = '';  // Variable to save the state of the grid

function binToHex(bin) {
  let hex = '';
  for (let i = 0, len = bin.length; i < len; i += MAX_BITS) {
    let tmp = parseInt(bin.substr(i, MAX_BITS), 2).toString(16);
    while (tmp.length < MAX_HEX) {
      tmp = '0' + tmp;
    }
    hex += tmp;
  }
  return hex;
}

function hexToBin(hex) {
  let bin = '';
  for (let i = 0, len = hex.length; i < len; i += MAX_HEX) {
    let tmp = parseInt(hex.substr(i, MAX_HEX), 16).toString(2);
    while (tmp.length < MAX_BITS) {
      tmp = '0' + tmp;
    }
    bin += tmp;
  }
  return bin;
}

function updateState() {
  let state = '';
  Array.from(beats).map(function (btn) {
    state += btn.classList.contains('on') ? '1' : '0';
  });
  window.location.hash = binToHex(state);
}

function restoreState() {
  let hash = savedHash || window.location.hash;
  hash = (hash === '') ? '0000000000000000' : hash.substr(1);
  hexToBin(hash).split('').map(function (el, i) {
    if (parseInt(el) === 1) {
      beats[i].classList.add('on');
    } else {
      beats[i].classList.remove('on');
    }
  });
}

window.addEventListener('hashchange', restoreState, false);

for (let soundIndex = 0; soundIndex < sLen; ++soundIndex) {
  (function (index) {
    const req = new XMLHttpRequest();
    req.open('GET', sounds[index], true);
    req.responseType = 'arraybuffer';
    req.onload = function () {
      audioCtx.decodeAudioData(req.response, function (buffer) {
        buffers.push(buffer);
      });
    };
    req.send();
  })(soundIndex);

  const fragment = document.createDocumentFragment();
  for (let t = 0; t < TICKS; ++t) {
    const btn = document.createElement('button');
    btn.className = 'beat';
    btn.addEventListener('click', function () {
      this.classList.toggle('on');
      updateState();
    }, false);
    fragment.appendChild(btn);
  }
  theGrid.appendChild(fragment);
  theGrid.appendChild(document.createElement('p'));
}

const beats = document.getElementsByClassName('beat');

function drumLoop() {
  if (!isRunning) return;  // If not running, exit the loop early

  const curTime = new Date().getTime();
  if (curTime - lastTime >= INTERVAL) {
    for (let i = 0; i < sLen; ++i) {
      const lastBeat = beats[i * TICKS + lastTick];
      const curBeat = beats[i * TICKS + curTick];
      lastBeat.classList.remove('ticked');
      curBeat.classList.add('ticked');

      if (curBeat.classList.contains('on')) {
        try {
          const source = audioCtx.createBufferSource();
          source.buffer = buffers[i];
          source.connect(audioCtx.destination);
          source.start();

          if (isRecording) {
            source.connect(recordingDestination);
          }
        } catch (e) {
          console.error(e.message);
          new Audio(sounds[i]).play();
        }
      }
    }
    lastTick = curTick;
    curTick = (curTick + 1) % TICKS;
    lastTime = curTime;
  }
  if (isRunning) {
    requestAnimationFrame(drumLoop);  // Continue the loop only if running
  }
}

restoreState();
requestAnimationFrame(drumLoop);

function enableIOSAudio() {
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0); // Use 'start' instead of 'noteOn'
  window.removeEventListener('touchend', enableIOSAudio, false);
}

window.addEventListener('touchend', enableIOSAudio, false);

// Recording functionality
function startRecording() {
  isRecording = true;
  audioChunks = [];
  recordingSourceNode = audioCtx.createGain();
  recordingDestination = audioCtx.createMediaStreamDestination();
  recordingSourceNode.connect(recordingDestination);
  mediaRecorder = new MediaRecorder(recordingDestination.stream);
  mediaRecorder.ondataavailable = function (event) {
    audioChunks.push(event.data);
  };
  mediaRecorder.onstop = function () {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioURL = URL.createObjectURL(audioBlob);
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = audioURL;
    downloadLink.download = 'recording.wav';
    downloadLink.style.display = 'block';
  };
  mediaRecorder.start();
}

function stopRecording() {
  isRecording = false;
  mediaRecorder.stop();
}

// Stop sequencer function
function stopSequencer() {
  isRunning = false;  // Stop the loop
  console.log("Sequencer stopped");

  // Save current state to the savedHash variable
  let state = '';
  Array.from(beats).map(function (btn) {
    state += btn.classList.contains('on') ? '1' : '0';
  });
  savedHash = binToHex(state);  // Save the state

  // Reset all beats to off state
  Array.from(beats).forEach((btn) => {
    btn.classList.remove('on', 'ticked');  // Remove 'on' and 'ticked' classes
  });

  // Optionally disable the stop button
  document.getElementById('stopSequencerButton').disabled = true;
}

// Reset the sequencer and start again
function startSequencer() {
  isRunning = true;  // Start the loop
  restoreState();  // Restore the saved state
  requestAnimationFrame(drumLoop);  // Start the loop again

  // Enable the stop button
  document.getElementById('stopSequencerButton').disabled = false;
}

// Event listeners for buttons
document.getElementById('startRecordingButton').addEventListener('click', startRecording);
document.getElementById('stopRecordingButton').addEventListener('click', stopRecording);
document.getElementById('stopSequencerButton').addEventListener('click', stopSequencer);

// Optionally, you could create a start button for the sequencer
document.getElementById('startSequencerButton').addEventListener('click', startSequencer);