/**
 * PRODUCT OWNER RPG - Core Game Engine
 * Features: SCORM 1.2, Collision Logic, Synth Sound, Scenario Engine
 */

// --- 1. SCORM API Wrapper ---
const SCORM = {
    active: false,
    init() {
        try {
            this.active = window.parent && window.parent.LMSInitialize ? true : false;
            if (this.active) window.parent.LMSInitialize("");
        } catch (e) { console.log("SCORM Init failed - running offline"); }
    },
    saveScore(score) {
        if (this.active) {
            window.parent.LMSSetValue("cmi.core.score.raw", score);
            window.parent.LMSCommit("");
        }
    },
    complete() {
        if (this.active) {
            window.parent.LMSSetValue("cmi.core.lesson_status", "completed");
            window.parent.LMSFinish("");
        }
    }
};

// --- 2. Audio Engine (Web Audio API) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();

function playSound(type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

// --- 3. Game State ---
const state = {
    player: { x: 384, y: 284, speed: 4 },
    keys: {},
    visited: new Set(),
    score: 0,
    isPaused: false,
    rooms: [
        { id: 'planning', x: [0, 390], y: [0, 290], title: 'Sprint Planning' },
        { id: 'stakeholder', x: [410, 800], y: [0, 290], title: 'Stakeholder Meeting' },
        { id: 'roadmap', x: [0, 390], y: [310, 600], title: 'Roadmap Room' },
        { id: 'team', x: [410, 800], y: [310, 600], title: 'Team Desk' }
    ]
};

// --- 4. Scenarios ---
const Scenarios = {
    planning: {
        q: "The team velocity is 30 points. Stakeholders want 50 points of features.",
        options: [
            { t: "A) Commit to all 50 (Work Harder)", correct: false },
            { t: "B) Negotiate a realistic 30 point Sprint Goal", correct: true }
        ]
    },
    stakeholder: {
        q: "Prioritize these items (click to move to top):",
        items: ["Customer Pain", "Revenue", "CEO's Personal Idea", "Bug Fix"],
        order: [0, 1, 3, 2]
    },
    roadmap: {
        q: "Where does 'AI Integration Research' belong?",
        options: [
            { t: "NOW", correct: false },
            { t: "NEXT", correct: false },
            { t: "LATER", correct: true }
        ]
    },
    team: {
        q: "Devs: 'We don't understand the Acceptance Criteria for this story.'",
        options: [
            { t: "A) Figure it out during dev", correct: false },
            { t: "B) Stop and refine the story together", correct: true }
        ]
    }
};

// --- 5. Core Loop ---
function update() {
    if (state.isPaused) return;

    let nextX = state.player.x;
    let nextY = state.player.y;

    if (state.keys['ArrowUp'] || state.keys['w']) nextY -= state.player.speed;
    if (state.keys['ArrowDown'] || state.keys['s']) nextY += state.player.speed;
    if (state.keys['ArrowLeft'] || state.keys['a']) nextX -= state.player.speed;
    if (state.keys['ArrowRight'] || state.keys['d']) nextX += state.player.speed;

    if (nextX > 0 && nextX < 768 && !isWall(nextX, nextY)) {
        state.player.x = nextX;
    }
    if (nextY > 0 && nextY < 568 && !isWall(nextX, nextY)) {
        state.player.y = nextY;
    }

    const p = document.getElementById('player');
    p.style.left = state.player.x + 'px';
    p.style.top = state.player.y + 'px';

    checkRoomEntry();
    requestAnimationFrame(update);
}

function isWall(x, y) {
    if (x > 360 && x < 410) return true;
    if (y > 270 && y < 310) return true;
    return false;
}

function checkRoomEntry() {
    state.rooms.forEach(room => {
        if (!state.visited.has(room.id)) {
            if (state.player.x > room.x[0] && state.player.x < room.x[1] &&
                state.player.y > room.y[0] && state.player.y < room.y[1]) {
                triggerScenario(room.id);
            }
        }
    });
}

// --- 6. UI & Interactions ---
let currentOrder = [0, 1, 2, 3];

function triggerScenario(roomId) {
    state.isPaused = true;
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.style.display = 'flex';

    const sc = Scenarios[roomId];
    let html = '<h2>' + roomId.toUpperCase() + '</h2><p>' + sc.q + '</p>';

    if (sc.options) {
        sc.options.forEach(function(opt, idx) {
            html += '<button onclick="handleAnswer(\'' + roomId + '\', ' + idx + ')">' + opt.t + '</button>';
        });
    } else if (roomId === 'stakeholder') {
        html += '<div class="draggable-list">';
        currentOrder.forEach(function(itemIdx, pos) {
            html += '<div class="drag-item" onclick="reorder(' + pos + ')">' + (pos + 1) + '. ' + sc.items[itemIdx] + '</div>';
        });
        html += '</div>';
        html += '<button onclick="checkRanking()">Submit Priority</button>';
        html += '<p><small>Click items to move them to the top</small></p>';
    }

    content.innerHTML = html;
}

window.reorder = function(idx) {
    const item = currentOrder.splice(idx, 1)[0];
    currentOrder.unshift(item);
    triggerScenario('stakeholder');
};

window.checkRanking = function() {
    if (currentOrder[0] === 0 && currentOrder[1] === 1) {
        handleAnswer('stakeholder', true);
    } else {
        handleAnswer('stakeholder', false);
    }
};

window.handleAnswer = function(roomId, choiceIdx) {
    const sc = Scenarios[roomId];
    const isCorrect = typeof choiceIdx === 'boolean' ? choiceIdx : sc.options[choiceIdx].correct;

    if (isCorrect) {
        playSound('success');
        state.score += 25;
        alert("Correct! Good Product Owner instincts.");
    } else {
        playSound('wrong');
        alert("Not quite. Remember Agile principles!");
    }

    state.visited.add(roomId);
    state.isPaused = false;
    document.getElementById('modal').style.display = 'none';

    document.getElementById('score-val').innerText = state.score;
    const progress = (state.visited.size / 4) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';

    state.player.x = 384;
    state.player.y = 284;

    if (state.visited.size === 4) endGame();
    else requestAnimationFrame(update);
};

function endGame() {
    state.isPaused = true;
    SCORM.saveScore(state.score);
    SCORM.complete();
    const content = document.getElementById('modal-content');
    document.getElementById('modal').style.display = 'flex';
    content.innerHTML = '<h1>Training Complete!</h1><p>Final Score: ' + state.score + '/100</p><button onclick="location.reload()">Replay</button>';
}

// --- 7. Init ---
window.addEventListener('keydown', function(e) { state.keys[e.key] = true; });
window.addEventListener('keyup', function(e) { state.keys[e.key] = false; });

SCORM.init();
requestAnimationFrame(update);
