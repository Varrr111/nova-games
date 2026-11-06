// Звуки Штаба — синтез WebAudio (свои, без файлов): щелчок, приказ, телетайп, начало хода,
// взятие области, неудача, сонар флота, гул штаба. Включение — кнопка с динамиком (запоминается).
(function () {
  let ctx = null, master = null, on = true, ambient = null;
  try { on = localStorage.getItem("hq_sound") !== "off"; } catch (e) {}
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, t, dur, type = "sine", peak = 0.3, slide = 0, filt = 0) {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    let node = o;
    if (filt) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filt; o.connect(f); node = f; }
    node.connect(g); g.connect(master); env(g, t, 0.008, dur, peak); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, peak = 0.2, fType = "bandpass", f0 = 1200, q = 1) {
    const c = ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = fType; f.frequency.value = f0; f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(master); env(g, t, 0.004, dur, peak); s.start(t);
  }
  const S = {
    click() { const t = ctx.currentTime; tone(1800, t, 0.03, "square", 0.06, 0.5, 4000); noise(t, 0.025, 0.05, "highpass", 3000); },
    select(kind) {
      const t = ctx.currentTime;
      if (kind === "naval") { tone(1250, t, 0.9, "sine", 0.16, 0.98); tone(1250, t + 0.5, 0.7, "sine", 0.05, 0.98); return; }
      if (kind === "air") { noise(t, 0.35, 0.08, "bandpass", 700, 0.7); tone(220, t, 0.35, "sawtooth", 0.04, 1.6, 900); return; }
      noise(t, 0.06, 0.12, "lowpass", 900); tone(110, t, 0.12, "triangle", 0.15, 0.7);   // лязг брони
    },
    order() { const t = ctx.currentTime; tone(880, t, 0.07, "square", 0.07, 1, 2500); tone(1320, t + 0.09, 0.09, "square", 0.07, 1, 2500); noise(t + 0.2, 0.08, 0.04, "bandpass", 2400, 3); },
    send() { const t = ctx.currentTime; for (let i = 0; i < 9; i++) { noise(t + i * 0.045 + Math.random() * 0.01, 0.02, 0.09, "bandpass", 2200 + Math.random() * 800, 4); } tone(660, t + 0.45, 0.25, "triangle", 0.1); },
    turn() {   // начало хода: удар барабана + низкий рог
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) { tone(70, t + i * 0.16, 0.25, "sine", 0.4, 0.5); noise(t + i * 0.16, 0.12, 0.12, "lowpass", 400); }
      tone(98, t + 0.7, 1.4, "sawtooth", 0.12, 1, 700); tone(147, t + 0.7, 1.4, "sawtooth", 0.08, 1, 700); tone(196, t + 0.95, 1.1, "sawtooth", 0.06, 1, 900);
    },
    win() { const t = ctx.currentTime; [262, 330, 392, 523].forEach((f, i) => tone(f, t + i * 0.12, 0.6 - i * 0.05, "sawtooth", 0.09, 1, 1800)); tone(70, t, 0.4, "sine", 0.35, 0.6); },
    lose() { const t = ctx.currentTime; [392, 311, 233].forEach((f, i) => tone(f, t + i * 0.22, 0.6, "sawtooth", 0.08, 0.97, 1100)); noise(t, 0.5, 0.06, "lowpass", 300); },
    boom() { const t = ctx.currentTime; noise(t, 0.9, 0.35, "lowpass", 220); tone(55, t, 0.8, "sine", 0.4, 0.4); },
    error() { const t = ctx.currentTime; tone(180, t, 0.12, "square", 0.08, 0.9, 1200); tone(140, t + 0.13, 0.18, "square", 0.08, 0.9, 1200); },
    ambient(start) {   // тихий гул штаба: низкий дрон + далёкие радиопомехи
      if (!start) { if (ambient) { ambient.forEach(n => { try { n.stop(); } catch (e) {} }); ambient = null; } return; }
      if (ambient) return;
      const c = ctx, t = c.currentTime, o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o1.type = "sawtooth"; o1.frequency.value = 55; o2.type = "sawtooth"; o2.frequency.value = 55.6;
      f.type = "lowpass"; f.frequency.value = 160; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.035, t + 3);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
      ambient = [o1, o2];
      (function crackle() { if (!ambient || !on) return; noise(ctx.currentTime, 0.15 + Math.random() * 0.25, 0.012, "bandpass", 1500 + Math.random() * 1500, 2); setTimeout(crackle, 2500 + Math.random() * 6000); })();
    },
  };
  window.SFX = {
    play(name, arg) { if (!on || !ac()) return; try { S[name] && S[name](arg); } catch (e) {} },
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem("hq_sound", on ? "on" : "off"); } catch (e) {} if (ac()) S.ambient(on); return on; },
    unlock() { if (on && ac()) S.ambient(true); },
  };
})();
