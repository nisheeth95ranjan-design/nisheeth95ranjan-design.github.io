import { useState, useEffect, useRef, useCallback } from "react";

// ─── Swara Data ───────────────────────────────────────────────────────────────
const SWARAS = [
  { hour: 12, short: "Sa",  full: "Ṣaḍja",       freq: 261.63, color: "#FFD700" },
  { hour: 1,  short: "Ri",  full: "Ṛṣabha",       freq: 293.66, color: "#FFC433" },
  { hour: 2,  short: "Ga",  full: "Gāndhāra",      freq: 329.63, color: "#FFB347" },
  { hour: 3,  short: "Ma",  full: "Madhyama",      freq: 349.23, color: "#FF9F40" },
  { hour: 4,  short: "Pa",  full: "Pañcama",       freq: 392.00, color: "#FF8C42" },
  { hour: 5,  short: "Dha", full: "Dhaivata",      freq: 440.00, color: "#FF7043" },
  { hour: 6,  short: "Ni",  full: "Niṣāda",        freq: 493.88, color: "#FF6B35" },
  { hour: 7,  short: "Sa'", full: "Ṣaḍja (Tāra)",  freq: 523.25, color: "#FFD700" },
  { hour: 8,  short: "Ri'", full: "Ṛṣabha (Tāra)", freq: 587.33, color: "#FFC433" },
  { hour: 9,  short: "Ga'", full: "Gāndhāra (Tāra)",freq: 659.26, color: "#FFB347" },
  { hour: 10, short: "Ma'", full: "Madhyama (Tāra)",freq: 698.46, color: "#FF9F40" },
  { hour: 11, short: "Pa'", full: "Pañcama (Tāra)", freq: 783.99, color: "#FF8C42" },
];

// Alarm phrases per hour — each note: [freq, duration, gamakaRange]
const ALARM_PHRASES = {
  0:  [ // Sa — full ārohana
    [261.63,0.35,8],[293.66,0.3,6],[329.63,0.3,6],[349.23,0.3,5],
    [392.00,0.35,7],[440.00,0.3,6],[493.88,0.3,6],[523.25,0.5,10]
  ],
  1:  [ // Ri — meend from Sa, rise to Ga
    [261.63,0.25,5],[293.66,0.4,8],[329.63,0.35,7],[392.00,0.3,6],
    [440.00,0.3,6],[493.88,0.35,7],[523.25,0.45,9]
  ],
  2:  [ // Ga — arch through Ma, Pa
    [329.63,0.4,9],[349.23,0.3,6],[392.00,0.35,7],[440.00,0.35,7],
    [349.23,0.25,5],[329.63,0.5,10]
  ],
  3:  [ // Ma — teevra feel, ascend
    [349.23,0.4,8],[392.00,0.35,7],[440.00,0.3,6],[493.88,0.3,6],
    [523.25,0.35,8],[493.88,0.25,5],[440.00,0.45,9]
  ],
  4:  [ // Pa — upper octave ascent
    [392.00,0.4,9],[440.00,0.3,7],[493.88,0.3,6],[523.25,0.3,7],
    [587.33,0.35,8],[659.26,0.5,10]
  ],
  5:  [ // Dha — sweeping phrase
    [440.00,0.4,10],[493.88,0.3,7],[523.25,0.3,6],[587.33,0.3,7],
    [523.25,0.25,5],[493.88,0.25,5],[440.00,0.5,10]
  ],
  6:  [ // Ni — leading to Sa'
    [493.88,0.35,9],[523.25,0.4,8],[587.33,0.3,6],[659.26,0.3,7],
    [587.33,0.25,5],[523.25,0.45,9]
  ],
  7:  [ // Sa' — graceful descent
    [523.25,0.4,9],[493.88,0.3,7],[440.00,0.3,6],[392.00,0.3,6],
    [349.23,0.3,5],[329.63,0.35,7],[293.66,0.25,5],[261.63,0.5,10]
  ],
  8:  [ // Ri' — avaroha
    [587.33,0.4,9],[523.25,0.3,7],[493.88,0.3,6],[440.00,0.3,6],
    [392.00,0.35,7],[329.63,0.45,9]
  ],
  9:  [ // Ga' — cascading
    [659.26,0.4,10],[587.33,0.3,7],[523.25,0.3,6],[493.88,0.3,6],
    [440.00,0.3,6],[392.00,0.35,7],[349.23,0.45,8]
  ],
  10: [ // Ma' — long descent
    [698.46,0.4,9],[659.26,0.3,7],[587.33,0.3,6],[523.25,0.3,6],
    [493.88,0.3,6],[440.00,0.35,7],[392.00,0.45,9]
  ],
  11: [ // Pa' — final cadence
    [783.99,0.4,10],[698.46,0.3,7],[659.26,0.3,6],[587.33,0.3,6],
    [523.25,0.3,6],[493.88,0.25,5],[440.00,0.25,5],[392.00,0.5,10]
  ],
};

function getTotalPhraseDuration(phraseIndex) {
  const phrase = ALARM_PHRASES[phraseIndex] || ALARM_PHRASES[0];
  return phrase.reduce((s, n) => s + n[1], 0);
}

// ─── Audio Engine ─────────────────────────────────────────────────────────────
function playSwara(freq, duration = 1.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const attack = 0.04, decay = 0.15, sustain = 0.6, release = 0.35;

    const createOsc = (f, gain) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain, now + attack);
      gainNode.gain.linearRampToValueAtTime(gain * sustain, now + attack + decay);
      gainNode.gain.setValueAtTime(gain * sustain, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.1);
    };

    createOsc(freq, 0.45);
    createOsc(freq * 2, 0.12);
    createOsc(freq * 3, 0.05);

    setTimeout(() => ctx.close(), (duration + 0.5) * 1000);
  } catch (e) {}
}

function playGamakaNote(ctx, freq, startTime, duration, gamakaRange) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const osc2 = ctx.createOscillator();
  const gainNode2 = ctx.createGain();

  osc.type = "sine";
  osc2.type = "sine";

  const attack = 0.03, release = Math.min(0.12, duration * 0.3);

  // Gamaka: oscillate ±gamakaRange cents
  const cents = gamakaRange;
  const up = freq * Math.pow(2, cents / 1200);
  const down = freq * Math.pow(2, -cents / 1200);

  osc.frequency.setValueAtTime(freq, startTime);
  osc.frequency.linearRampToValueAtTime(up, startTime + duration * 0.25);
  osc.frequency.linearRampToValueAtTime(down, startTime + duration * 0.55);
  osc.frequency.linearRampToValueAtTime(freq, startTime + duration * 0.8);

  osc2.frequency.setValueAtTime(freq * 2, startTime);
  osc2.frequency.linearRampToValueAtTime(up * 2, startTime + duration * 0.25);
  osc2.frequency.linearRampToValueAtTime(down * 2, startTime + duration * 0.55);
  osc2.frequency.linearRampToValueAtTime(freq * 2, startTime + duration * 0.8);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.38, startTime + attack);
  gainNode.gain.setValueAtTime(0.38, startTime + duration - release);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration + 0.02);

  gainNode2.gain.setValueAtTime(0, startTime);
  gainNode2.gain.linearRampToValueAtTime(0.10, startTime + attack);
  gainNode2.gain.setValueAtTime(0.10, startTime + duration - release);
  gainNode2.gain.linearRampToValueAtTime(0, startTime + duration + 0.02);

  osc.connect(gainNode); gainNode.connect(ctx.destination);
  osc2.connect(gainNode2); gainNode2.connect(ctx.destination);
  osc.start(startTime); osc.stop(startTime + duration + 0.1);
  osc2.start(startTime); osc2.stop(startTime + duration + 0.1);
}

function playAlarmPhrase(hourIndex, onDone) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const phrase = ALARM_PHRASES[hourIndex] || ALARM_PHRASES[0];
    let t = ctx.currentTime + 0.05;
    const overlap = 0.06;
    phrase.forEach(([freq, dur, gamaka]) => {
      playGamakaNote(ctx, freq, t, dur + overlap, gamaka);
      t += dur;
    });
    const total = getTotalPhraseDuration(hourIndex);
    setTimeout(() => {
      ctx.close();
      if (onDone) onDone();
    }, (total + 0.5) * 1000);
  } catch (e) { if (onDone) onDone(); }
}

// ─── SVG Helpers ──────────────────────────────────────────────────────────────
const RangoliBg = () => (
  <svg width="100%" height="100%" style={{position:"absolute",top:0,left:0,opacity:0.07,pointerEvents:"none"}}>
    <defs>
      <pattern id="rng" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <circle cx="40" cy="40" r="2" fill="#FFD700"/>
        <circle cx="40" cy="40" r="12" fill="none" stroke="#FFD700" strokeWidth="0.6"/>
        <circle cx="40" cy="40" r="22" fill="none" stroke="#CD853F" strokeWidth="0.4"/>
        {[0,45,90,135,180,225,270,315].map(a=>{
          const r=30, x=40+r*Math.cos(a*Math.PI/180), y=40+r*Math.sin(a*Math.PI/180);
          return <circle key={a} cx={x} cy={y} r="1.5" fill="#B8860B"/>;
        })}
        <path d="M40,18 L43,37 L40,40 L37,37 Z" fill="#CD853F" opacity="0.5"/>
        <path d="M62,40 L43,43 L40,40 L43,37 Z" fill="#CD853F" opacity="0.5"/>
        <path d="M40,62 L37,43 L40,40 L43,43 Z" fill="#CD853F" opacity="0.5"/>
        <path d="M18,40 L37,37 L40,40 L37,43 Z" fill="#CD853F" opacity="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#rng)"/>
  </svg>
);

const Filigree = ({x,y,rotate=0,size=48}) => (
  <svg width={size} height={size} style={{position:"absolute",left:x,top:y,transform:`rotate(${rotate}deg)`,opacity:0.55,pointerEvents:"none"}}>
    <g stroke="#B8860B" fill="none" strokeWidth="0.8">
      <path d="M4,4 Q8,12 12,8 Q16,4 20,8 Q24,12 28,8 Q32,4 36,8 Q40,12 44,4"/>
      <path d="M4,4 Q12,8 8,12 Q4,16 8,20 Q12,24 8,28 Q4,32 8,36 Q12,40 4,44"/>
      <circle cx="4" cy="4" r="2.5" fill="#B8860B"/>
      <circle cx="44" cy="4" r="1.5" fill="#B8860B"/>
      <circle cx="4" cy="44" r="1.5" fill="#B8860B"/>
      <path d="M4,4 Q14,14 24,24" strokeDasharray="2,3"/>
      <circle cx="24" cy="24" r="3" fill="none" stroke="#CD853F" strokeWidth="0.6"/>
      <path d="M14,14 Q18,10 22,14 Q26,18 22,22"/>
      <path d="M14,14 Q10,18 14,22 Q18,26 14,30"/>
    </g>
  </svg>
);

const LotusPetals = ({cx,cy,r=28}) => {
  const petals = 8;
  return (
    <g>
      {Array.from({length:petals},(_,i)=>{
        const angle = (i/petals)*2*Math.PI;
        const px = cx + r*Math.cos(angle);
        const py = cy + r*Math.sin(angle);
        const cp1x = cx + (r*0.6)*Math.cos(angle-0.4);
        const cp1y = cy + (r*0.6)*Math.sin(angle-0.4);
        const cp2x = cx + (r*0.6)*Math.cos(angle+0.4);
        const cp2y = cy + (r*0.6)*Math.sin(angle+0.4);
        return (
          <path key={i}
            d={`M${cx},${cy} Q${cp1x},${cp1y} ${px},${py} Q${cp2x},${cp2y} ${cx},${cy}`}
            fill="url(#petalGrad)" stroke="#B8860B" strokeWidth="0.5" opacity="0.85"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="7" fill="url(#centerGrad)" stroke="#FFD700" strokeWidth="0.8"/>
      <circle cx={cx} cy={cy} r="3.5" fill="#FFD700" opacity="0.9"/>
    </g>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NadaGhadiyara() {
  const [time, setTime] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);
  const [dragHour, setDragHour] = useState(null);
  const [savedEntry, setSavedEntry] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [alarmHour, setAlarmHour] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [alarmInput, setAlarmInput] = useState("");
  const [alarmError, setAlarmError] = useState("");
  const [activeSwaraBtn, setActiveSwaraBtn] = useState(null);
  const [alarmFiring, setAlarmFiring] = useState(false);
  const [alarmPhrasePlaying, setAlarmPhrasePlaying] = useState(false);
  const clockRef = useRef(null);
  const prevHourRef = useRef(null);
  const snoozeTimerRef = useRef(null);
  const alarmLoopRef = useRef(null);
  const alarmPhraseTimerRef = useRef(null);

  // Live clock
  useEffect(() => {
    if (isDragging) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isDragging]);

  // Hour chime on boundary
  useEffect(() => {
    if (isDragging) return;
    const h = time.getHours() % 12;
    if (prevHourRef.current !== null && prevHourRef.current !== h) {
      const sw = SWARAS.find(s => (s.hour % 12) === h);
      if (sw) playSwara(sw.freq, 1.5);
    }
    prevHourRef.current = h;
  }, [time, isDragging]);

  // Alarm check
  useEffect(() => {
    if (!alarmActive || alarmFiring || isDragging) return;
    const h = time.getHours() % 12;
    const m = time.getMinutes();
    const s = time.getSeconds();
    if (h === (alarmHour % 12) && m === 0 && s === 0) {
      triggerAlarm();
    }
  }, [time, alarmActive, alarmHour, alarmFiring, isDragging]);

  const triggerAlarm = useCallback(() => {
    setAlarmFiring(true);
    scheduleAlarmLoop();
  }, [alarmHour]);

  const scheduleAlarmLoop = useCallback(() => {
    const hIdx = alarmHour !== null ? (alarmHour % 12) : 0;
    const phraseDur = getTotalPhraseDuration(hIdx);
    const gap = 1200;

    const playOnce = () => {
      setAlarmPhrasePlaying(true);
      playAlarmPhrase(hIdx, () => {
        setAlarmPhrasePlaying(false);
        alarmPhraseTimerRef.current = setTimeout(playOnce, gap);
      });
    };
    playOnce();
  }, [alarmHour]);

  const stopAlarmSound = () => {
    clearTimeout(alarmPhraseTimerRef.current);
    clearTimeout(snoozeTimerRef.current);
    setAlarmPhrasePlaying(false);
  };

  const handleSnooze = () => {
    stopAlarmSound();
    setAlarmFiring(false);
    setSnoozeCount(c => c + 1);
    snoozeTimerRef.current = setTimeout(() => {
      triggerAlarm();
    }, 5 * 60 * 1000);
  };

  const handleStop = () => {
    stopAlarmSound();
    setAlarmFiring(false);
    setAlarmActive(false);
    setSnoozeCount(0);
  };

  // Clock geometry
  const CX = 160, CY = 160, R = 140;
  const displayTime = isDragging && dragHour !== null
    ? (() => { const d=new Date(time); d.setHours(dragHour,0,0,0); return d; })()
    : time;

  const seconds = displayTime.getSeconds();
  const minutes = displayTime.getMinutes();
  const hours = displayTime.getHours() % 12;
  const hourAngle = (hours + minutes / 60) * 30 - 90;
  const minuteAngle = (minutes + seconds / 60) * 6 - 90;
  const secondAngle = seconds * 6 - 90;

  const activeHourIdx = isDragging && dragHour !== null
    ? (dragHour % 12)
    : (hours % 12);
  const currentSwara = SWARAS.find(s => (s.hour % 12) === activeHourIdx) || SWARAS[0];

  // Drag logic
  const handleClockMouseDown = (e) => {
    const rect = clockRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    // Only start drag near hour hand tip
    const tipX = CX + 75*Math.cos(hourAngle*Math.PI/180);
    const tipY = CY + 75*Math.sin(hourAngle*Math.PI/180);
    const svgScale = rect.width / 320;
    const tipScreenX = rect.left + tipX * svgScale;
    const tipScreenY = rect.top + tipY * svgScale;
    const ddx = e.clientX - tipScreenX, ddy = e.clientY - tipScreenY;
    if (Math.sqrt(ddx*ddx+ddy*ddy) < 22) {
      setIsDragging(true);
      setDragHour(hours);
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    const h = Math.round(angle / 30) % 12;
    setDragHour(h);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", (e)=>handleMouseMove(e.touches[0]));
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handlePlaySwara = () => playSwara(currentSwara.freq, 1.5);

  const handleSaveTime = () => {
    setSavedEntry({ time: displayTime.toLocaleTimeString(), swara: currentSwara });
    setSaveFlash(true);
    playSwara(currentSwara.freq, 0.8);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleSetAlarmFromHand = () => {
    const h = isDragging && dragHour !== null ? dragHour : hours;
    setAlarmHour(h);
    setAlarmActive(true);
    setAlarmInput(h === 0 ? "12" : String(h));
    setSnoozeCount(0);
    playSwara(currentSwara.freq, 0.6);
  };

  const parseAlarmInput = (val) => {
    val = val.trim();
    const simple = /^(\d{1,2})$/;
    const withMin = /^(\d{1,2}):(\d{2})$/;
    let h, m = 0;
    if (simple.test(val)) {
      h = parseInt(val);
    } else if (withMin.test(val)) {
      const parts = val.match(withMin);
      h = parseInt(parts[1]); m = parseInt(parts[2]);
    } else return null;
    if (h < 1 || h > 12) return null;
    if (m < 0 || m > 59) return null;
    return { h: h % 12, m };
  };

  const handleAlarmSet = () => {
    const parsed = parseAlarmInput(alarmInput);
    if (!parsed) { setAlarmError("Enter 1–12, or H:MM (e.g. 7 or 7:30)"); return; }
    setAlarmError("");
    setAlarmHour(parsed.h);
    setAlarmActive(true);
    setSnoozeCount(0);
    playSwara(SWARAS.find(s=>(s.hour%12)===parsed.h)?.freq || 261.63, 0.7);
  };

  const alarmSwara = alarmHour !== null ? SWARAS.find(s=>(s.hour%12)===(alarmHour%12)) : null;

  const handPoint = (angle, length) => ({
    x: CX + length * Math.cos(angle * Math.PI / 180),
    y: CY + length * Math.sin(angle * Math.PI / 180),
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D0A06",
      fontFamily: "Georgia, 'Times New Roman', serif",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingBottom: 40,
    }}>
      <RangoliBg />

      {/* Alarm Firing Overlay */}
      {alarmFiring && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(10,6,2,0.94)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "Georgia, serif",
        }}>
          <style>{`
            @keyframes pulse-ring {
              0%{transform:scale(0.8);opacity:0.8}
              100%{transform:scale(2.2);opacity:0}
            }
            @keyframes bell-shake {
              0%,100%{transform:rotate(0deg)}
              15%{transform:rotate(-18deg)}
              30%{transform:rotate(18deg)}
              45%{transform:rotate(-12deg)}
              60%{transform:rotate(12deg)}
              75%{transform:rotate(-6deg)}
            }
          `}</style>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              position:"absolute", width:220, height:220,
              borderRadius:"50%", border:"2px solid #FFD700",
              animation:`pulse-ring 1.8s ease-out ${i*0.6}s infinite`,
              left:"50%", top:"50%", marginLeft:-110, marginTop:-110,
            }}/>
          ))}
          <div style={{fontSize:64,animation:"bell-shake 0.7s ease-in-out infinite",marginBottom:12}}>🔔</div>
          <div style={{color:"#FFD700",fontSize:52,fontStyle:"italic",letterSpacing:2,marginBottom:6}}>
            {alarmSwara?.short}
          </div>
          <div style={{color:"#CD853F",fontSize:17,letterSpacing:4,marginBottom:4}}>
            {alarmSwara?.full}
          </div>
          <div style={{color:"#8B6914",fontSize:14,letterSpacing:2,marginBottom:6}}>
            {alarmSwara?.freq} Hz
          </div>
          <div style={{color:"#E8D5A3",fontSize:22,letterSpacing:3,marginBottom:24}}>
            {(alarmHour === 0 ? 12 : alarmHour)}:00
          </div>
          {snoozeCount > 0 && (
            <div style={{color:"#8B6914",fontSize:13,marginBottom:16,letterSpacing:2}}>
              Snoozed {snoozeCount}× already
            </div>
          )}
          <div style={{display:"flex",gap:20}}>
            <button onClick={handleSnooze} style={{
              background:"#1A1206",border:"1px solid #8B6914",
              color:"#E8D5A3",padding:"12px 28px",borderRadius:4,
              fontSize:16,fontFamily:"Georgia,serif",cursor:"pointer",letterSpacing:1,
            }}>😴 SNOOZE</button>
            <button onClick={handleStop} style={{
              background:"#3D1A00",border:"1px solid #CC4400",
              color:"#FFB88C",padding:"12px 28px",borderRadius:4,
              fontSize:16,fontFamily:"Georgia,serif",cursor:"pointer",letterSpacing:1,
            }}>✋ STOP</button>
          </div>
        </div>
      )}

      {/* Title */}
      <div style={{textAlign:"center",padding:"28px 0 10px",position:"relative",zIndex:1,width:"100%"}}>
        <Filigree x={12} y={8} rotate={0} size={52}/>
        <Filigree x="calc(100% - 64px)" y={8} rotate={90} size={52}/>
        <div style={{
          background:"linear-gradient(180deg,#3D2200 0%,#1A0E00 100%)",
          border:"1px solid #5C3800", borderRadius:6,
          display:"inline-block",padding:"14px 48px",
          boxShadow:"0 0 32px rgba(184,134,11,0.18), inset 0 1px 0 rgba(255,215,0,0.12)",
        }}>
          <div style={{
            fontSize:11,letterSpacing:8,color:"#8B6914",textTransform:"uppercase",
            marginBottom:4,
          }}>ನಾದ ಘಡಿಯಾರ</div>
          <div style={{
            fontSize:26,letterSpacing:3,color:"#FFD700",
            textShadow:"0 0 20px rgba(255,215,0,0.5)",
            fontWeight:"normal",
          }}>Nāda Ghaḍiyāra</div>
          <div style={{
            fontSize:10,letterSpacing:6,color:"#8B6914",marginTop:5,
          }}>NĀDA GHAḌIYĀRA • TONAL CLOCK</div>
        </div>
      </div>

      {/* Clock Panel */}
      <div style={{
        position:"relative",zIndex:2,
        background:"linear-gradient(160deg,#1E1206 0%,#0D0800 100%)",
        border:"1px solid #4A2E00",borderRadius:8,
        padding:20,margin:"10px 0 8px",
        boxShadow:"0 0 48px rgba(184,134,11,0.12), inset 0 0 32px rgba(0,0,0,0.6)",
      }}>
        <Filigree x={0} y={0} rotate={0} size={44}/>
        <Filigree x="calc(100% - 44px)" y={0} rotate={90} size={44}/>
        <Filigree x={0} y="calc(100% - 44px)" rotate={270} size={44}/>
        <Filigree x="calc(100% - 44px)" y="calc(100% - 44px)" rotate={180} size={44}/>

        <div style={{cursor: isDragging ? "grabbing" : "default"}} onMouseDown={handleClockMouseDown}>
          <svg ref={clockRef} width={320} height={320} viewBox="0 0 320 320" style={{display:"block"}}>
            <defs>
              <radialGradient id="faceGrad" cx="50%" cy="45%">
                <stop offset="0%" stopColor="#2A1800"/>
                <stop offset="100%" stopColor="#0D0800"/>
              </radialGradient>
              <radialGradient id="petalGrad" cx="50%" cy="30%">
                <stop offset="0%" stopColor="#CC6600"/>
                <stop offset="100%" stopColor="#7A3500"/>
              </radialGradient>
              <radialGradient id="centerGrad" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#FFD700"/>
                <stop offset="100%" stopColor="#B8860B"/>
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="softglow">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Face */}
            <circle cx={CX} cy={CY} r={R} fill="url(#faceGrad)" stroke="#4A2E00" strokeWidth="1.5"/>
            <circle cx={CX} cy={CY} r={R-4} fill="none" stroke="#3D2200" strokeWidth="0.5"/>

            {/* Decorative rings */}
            {[110,122,132].map((r,i)=>(
              <circle key={i} cx={CX} cy={CY} r={r} fill="none"
                stroke={i===1?"#5C3800":"#2E1800"} strokeWidth={i===1?0.8:0.4}
                strokeDasharray={i===2?"4,6":undefined}/>
            ))}

            {/* Rangoli tick marks */}
            {Array.from({length:60},(_,i)=>{
              const isHour = i%5===0;
              const a = (i/60)*2*Math.PI - Math.PI/2;
              const r1 = isHour ? R-14 : R-8;
              const r2 = R-4;
              return <line key={i}
                x1={CX+r1*Math.cos(a)} y1={CY+r1*Math.sin(a)}
                x2={CX+r2*Math.cos(a)} y2={CY+r2*Math.sin(a)}
                stroke={isHour?"#8B6914":"#3D2200"}
                strokeWidth={isHour?1.5:0.5}
              />;
            })}

            {/* Swara labels */}
            {SWARAS.map((sw,i)=>{
              const a = (i/12)*2*Math.PI - Math.PI/2;
              const labelR = R - 26;
              const x = CX + labelR*Math.cos(a);
              const y = CY + labelR*Math.sin(a);
              const isActive = (sw.hour%12) === activeHourIdx;
              return (
                <text key={i} x={x} y={y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={isActive?13:10}
                  fontFamily="Georgia, serif"
                  fontStyle="italic"
                  fill={isActive?"#FFD700":"#8B6914"}
                  filter={isActive?"url(#glow)":undefined}
                  style={{transition:"all 0.3s"}}
                >{sw.short}</text>
              );
            })}

            {/* Lotus center decoration */}
            <LotusPetals cx={CX} cy={CY} r={30}/>

            {/* Hour hand */}
            {(()=>{
              const tip = handPoint(hourAngle, 78);
              const base1 = handPoint(hourAngle+90, 7);
              const base2 = handPoint(hourAngle-90, 7);
              const tail = handPoint(hourAngle+180, 18);
              return (
                <g filter="url(#softglow)" style={{cursor:"grab"}}>
                  <polygon
                    points={`${base1.x},${base1.y} ${tip.x},${tip.y} ${base2.x},${base2.y} ${tail.x},${tail.y}`}
                    fill="#CC7700" stroke="#FFD700" strokeWidth="0.8"
                  />
                  <circle cx={tip.x} cy={tip.y} r="4" fill="#FFD700" opacity="0.9"/>
                </g>
              );
            })()}

            {/* Minute hand */}
            {(()=>{
              const tip = handPoint(minuteAngle, 105);
              const base1 = handPoint(minuteAngle+90, 4);
              const base2 = handPoint(minuteAngle-90, 4);
              const tail = handPoint(minuteAngle+180, 14);
              return (
                <polygon
                  points={`${base1.x},${base1.y} ${tip.x},${tip.y} ${base2.x},${base2.y} ${tail.x},${tail.y}`}
                  fill="#8B6914" stroke="#B8860B" strokeWidth="0.6"
                />
              );
            })()}

            {/* Second hand */}
            {(()=>{
              const tip = handPoint(secondAngle, 118);
              const tail = handPoint(secondAngle+180, 22);
              return (
                <g>
                  <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="#CC4400" strokeWidth="1.2"/>
                  <line x1={CX} y1={CY} x2={tail.x} y2={tail.y} stroke="#CC4400" strokeWidth="2"/>
                  <circle cx={CX} cy={CY} r="4.5" fill="#1A0E00" stroke="#FFD700" strokeWidth="1"/>
                  <circle cx={CX} cy={CY} r="2" fill="#FFD700"/>
                </g>
              );
            })()}

            {/* Drag hint */}
            {!isDragging && (
              <text x={CX} y={CY+R-8} textAnchor="middle" fontSize="7"
                fill="#3D2200" fontFamily="Georgia,serif" letterSpacing="1">
                drag hour hand
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* Swara Display Panel */}
      <div style={{
        position:"relative",zIndex:2,width:320,
        background:"linear-gradient(180deg,#1E1206 0%,#0D0800 100%)",
        border:"1px solid #4A2E00",borderRadius:6,padding:"16px 20px",
        marginBottom:10,boxShadow:"0 0 24px rgba(184,134,11,0.1)",
      }}>
        <Filigree x={0} y={0} rotate={0} size={36}/>
        <Filigree x="calc(100% - 36px)" y={0} rotate={90} size={36}/>

        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{
            fontSize:44,fontStyle:"italic",color:"#FFD700",letterSpacing:3,
            textShadow:"0 0 24px rgba(255,215,0,0.6)",lineHeight:1,
          }}>{currentSwara.short}</div>
          <div style={{color:"#CD853F",fontSize:13,letterSpacing:3,marginTop:3}}>
            {currentSwara.full}
          </div>
          <div style={{
            color:"#8B6914",fontSize:11,letterSpacing:4,marginTop:2,
            display:"flex",justifyContent:"center",gap:16,
          }}>
            <span>{currentSwara.freq} Hz</span>
            <span style={{color:"#4A2E00"}}>•</span>
            <span>{displayTime.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* 12 swara buttons */}
        <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center"}}>
          {SWARAS.map((sw,i)=>{
            const isActive = activeSwaraBtn === i;
            const isCurrent = (sw.hour%12) === activeHourIdx;
            return (
              <button key={i}
                onMouseDown={()=>{
                  setActiveSwaraBtn(i);
                  playSwara(sw.freq, 1.0);
                  setTimeout(()=>setActiveSwaraBtn(null),600);
                }}
                style={{
                  background: isActive ? "#5C3800" : isCurrent ? "#2E1A00" : "#1A0E00",
                  border: `1px solid ${isActive?"#FFD700":isCurrent?"#8B6914":"#3D2200"}`,
                  color: isActive ? "#FFD700" : isCurrent ? "#CD853F" : "#8B6914",
                  padding:"5px 7px",borderRadius:3,fontSize:11,
                  fontFamily:"Georgia,serif",fontStyle:"italic",
                  cursor:"pointer",minWidth:40,transition:"all 0.15s",
                  boxShadow: isActive ? "0 0 8px rgba(255,215,0,0.4)" : "none",
                  letterSpacing:1,
                }}
              >{sw.short}</button>
            );
          })}
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{display:"flex",gap:8,marginBottom:10,zIndex:2,position:"relative"}}>
        {[
          {label:"▶ PLAY SWARA", onClick:handlePlaySwara, accent:"#CC7700"},
          {label:"💾 SAVE TIME", onClick:handleSaveTime, accent:"#006644"},
          {label:"🔔 SET ALARM", onClick:handleSetAlarmFromHand, accent:"#660033"},
        ].map((btn,i)=>(
          <button key={i} onClick={btn.onClick} style={{
            background:`linear-gradient(180deg,${btn.accent}22 0%,${btn.accent}11 100%)`,
            border:`1px solid ${btn.accent}55`,
            color:"#E8D5A3",padding:"9px 14px",borderRadius:4,
            fontSize:11,fontFamily:"Georgia,serif",cursor:"pointer",
            letterSpacing:1,transition:"all 0.2s",
            boxShadow: saveFlash && i===1 ? `0 0 20px ${btn.accent}` : "none",
          }}>{btn.label}</button>
        ))}
      </div>

      {/* Save Flash */}
      {saveFlash && savedEntry && (
        <div style={{
          position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
          background:"#1A2200",border:"1px solid #448800",color:"#88FF44",
          padding:"8px 24px",borderRadius:4,fontSize:13,letterSpacing:2,
          zIndex:500,fontFamily:"Georgia,serif",
          boxShadow:"0 0 16px rgba(68,136,0,0.4)",
        }}>✓ Saved — {savedEntry.swara.short} at {savedEntry.time}</div>
      )}

      {/* Alarm Input Panel */}
      <div style={{
        position:"relative",zIndex:2,width:320,
        background:"linear-gradient(180deg,#1E1206 0%,#0D0800 100%)",
        border:"1px solid #4A2E00",borderRadius:6,padding:"14px 20px",
        marginBottom:10,boxShadow:"0 0 24px rgba(184,134,11,0.08)",
      }}>
        <Filigree x={0} y={0} rotate={0} size={32}/>
        <Filigree x="calc(100% - 32px)" y={0} rotate={90} size={32}/>

        <div style={{color:"#8B6914",fontSize:10,letterSpacing:4,marginBottom:8,textAlign:"center"}}>
          ─── SET ALARM ───
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            value={alarmInput}
            onChange={e=>{setAlarmInput(e.target.value);setAlarmError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleAlarmSet()}
            placeholder="e.g. 7 or 7:30"
            style={{
              flex:1,background:"#0D0800",border:"1px solid #4A2E00",
              color:"#E8D5A3",padding:"7px 10px",borderRadius:3,
              fontSize:13,fontFamily:"Georgia,serif",outline:"none",
            }}
          />
          <button onClick={handleAlarmSet} style={{
            background:"#2E1A00",border:"1px solid #8B6914",color:"#FFD700",
            padding:"7px 14px",borderRadius:3,fontSize:12,
            fontFamily:"Georgia,serif",cursor:"pointer",letterSpacing:1,
          }}>SET</button>
        </div>
        {alarmError && (
          <div style={{color:"#CC4400",fontSize:11,marginTop:5,letterSpacing:1}}>{alarmError}</div>
        )}
        {alarmActive && alarmSwara && (
          <div style={{
            marginTop:10,padding:"8px 12px",
            background:"#1A0E00",border:"1px solid #5C3800",borderRadius:3,
            display:"flex",alignItems:"center",justifyContent:"space-between",
          }}>
            <div>
              <span style={{color:"#FFD700",fontStyle:"italic",fontSize:14}}>{alarmSwara.short}</span>
              <span style={{color:"#8B6914",fontSize:11,marginLeft:8,letterSpacing:2}}>
                {(alarmHour===0?12:alarmHour)}:00
              </span>
              {snoozeCount>0&&<span style={{color:"#8B6914",fontSize:10,marginLeft:6}}>zzz×{snoozeCount}</span>}
            </div>
            <button onClick={()=>{setAlarmActive(false);setAlarmHour(null);setSnoozeCount(0);}} style={{
              background:"none",border:"1px solid #4A2E00",color:"#8B6914",
              width:22,height:22,borderRadius:"50%",cursor:"pointer",
              fontSize:11,fontFamily:"Georgia,serif",padding:0,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>✕</button>
          </div>
        )}
      </div>

      {/* Drag status */}
      {isDragging && (
        <div style={{
          position:"relative",zIndex:2,color:"#8B6914",fontSize:11,
          letterSpacing:3,marginBottom:8,fontStyle:"italic",
        }}>
          ↺ dragging — release to resume
        </div>
      )}

      {/* Footer ornament */}
      <div style={{
        position:"relative",zIndex:2,color:"#3D2200",fontSize:10,
        letterSpacing:4,marginTop:4,textAlign:"center",
      }}>
        ❧ ŚRĪ ŚAṄKARĀBHARAṆAM ❧
      </div>

      <style>{`
        button:hover { filter: brightness(1.2); }
        input:focus { border-color: #8B6914 !important; box-shadow: 0 0 8px rgba(139,105,20,0.3); }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; background: #0D0800; }
        ::-webkit-scrollbar-thumb { background: #3D2200; }
      `}</style>
    </div>
  );
}
