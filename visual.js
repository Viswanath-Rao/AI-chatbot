(() => {
  const canvas = document.getElementById("liquid-canvas");
  const glow = document.querySelector(".pointer-glow");
  const clockEl = document.getElementById("stat-clock");
  const sessionEl = document.getElementById("stat-session");
  const countEl = document.getElementById("stat-count");
  const signalEl = document.getElementById("stat-signal");
  const densityEl = document.getElementById("stat-density");
  const cohereEl = document.getElementById("stat-cohere");
  const ringEl = document.getElementById("mesh-ring");
  const spark = document.getElementById("sparkline");
  const title = document.querySelector("[data-kinetic]");
  const started = Date.now();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const activity = new Array(28).fill(0.08);
  let pulse = 0;

  const pointer = { x: 0.5, y: 0.42, tx: 0.5, ty: 0.42 };

  const splitKinetic = (el) => {
    if (!el) return;
    const text = el.dataset.kinetic || el.textContent;
    el.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--d", i);
      span.style.setProperty("--w", String(480 + (i % 8) * 40));
      span.textContent = ch === " " ? "\u00A0" : ch;
      el.appendChild(span);
    });
  };

  splitKinetic(title);

  const pad = (n) => String(n).padStart(2, "0");

  const tickClock = () => {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
        now.getSeconds()
      )}`;
    }
    const elapsed = Math.floor((Date.now() - started) / 1000);
    if (sessionEl) {
      sessionEl.textContent = `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`;
    }
  };

  const drawSpark = () => {
    if (!spark) return;
    const ctx = spark.getContext("2d");
    const w = spark.width;
    const h = spark.height;
    const light = document.body.classList.contains("light_mode");
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    activity.forEach((v, i) => {
      const x = (i / (activity.length - 1)) * w;
      const y = h - v * (h - 10) - 6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = light ? "#0f6e62" : "#7ee0c8";
    ctx.lineWidth = 2;
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, light ? "rgba(15,110,98,0.22)" : "rgba(126,224,200,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  };

  const syncHud = () => {
    const messages = document.querySelectorAll(".chat-list .message");
    if (!messages.length) {
      for (let i = 0; i < activity.length; i++) activity[i] = 0.08;
    }
    if (countEl) countEl.textContent = pad(messages.length);
    const loading = document.querySelector(".chat-list .message.loading");
    const fault = document.querySelector(".chat-list .message.error");
    const signal = loading ? "Sync" : fault ? "Fault" : messages.length ? "Live" : "Idle";
    if (signalEl) signalEl.textContent = signal;
    const density = Math.min(1, messages.length / 18 + pulse * 0.2);
    if (densityEl) densityEl.textContent = density.toFixed(2);
    const cohere = Math.round((loading ? 0.82 : 0.18 + density * 0.7) * 100);
    if (cohereEl) cohereEl.textContent = `${cohere}%`;
    if (ringEl) {
      const circ = 213.6;
      ringEl.style.strokeDashoffset = String(circ - (cohere / 100) * circ);
    }
    drawSpark();
  };

  const bumpActivity = () => {
    activity.shift();
    activity.push(0.35 + Math.random() * 0.6);
    pulse = 1;
    drawSpark();
  };

  const chat = document.querySelector(".chat-list");
  if (chat) {
    new MutationObserver(() => {
      bumpActivity();
      syncHud();
    }).observe(chat, { childList: true });
  }

  const scaleNear = (el, mx, my) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(mx - cx, my - cy);
    const prox = Math.max(1, 1.08 - d / 900);
    el.style.setProperty("--prox", prox.toFixed(3));
  };

  window.addEventListener("pointermove", (e) => {
    pointer.tx = e.clientX / window.innerWidth;
    pointer.ty = e.clientY / window.innerHeight;
    if (glow) {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    }
    document.documentElement.style.setProperty("--px", (pointer.tx - 0.5).toFixed(3));
    document.documentElement.style.setProperty("--py", (pointer.ty - 0.5).toFixed(3));

    document.querySelectorAll(".suggestion, .stat").forEach((el) => {
      scaleNear(el, e.clientX, e.clientY);
    });

    if (title) {
      title.querySelectorAll(".char").forEach((ch, i) => {
        const w = 420 + pointer.tx * 380 + Math.sin(i + pointer.ty * 8) * 80;
        ch.style.setProperty("--w", String(Math.round(w)));
      });
    }

    document.querySelectorAll(".magnetic").forEach((el) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 90) {
        el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px)`;
      } else {
        el.style.transform = "";
      }
    });
  });

  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  let useGL = Boolean(gl) && !reduce;

  if (useGL) {
    const vs = `
      attribute vec2 a_pos;
      void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;
    const fs = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_light;
      uniform float u_pulse;

      float hash(vec2 p){
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p){
        float v = 0.0;
        float a = 0.5;
        for(int i = 0; i < 6; i++){
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / u_res.xy;
        vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / min(u_res.x, u_res.y);
        p += (u_mouse - 0.5) * 0.42;

        float t = u_time * 0.07;
        vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(p + q * 1.6 + t * 0.4), fbm(p + q * 1.3 - t * 0.35));
        float n = fbm(p + r);
        float m = fbm(p * 1.6 - r);

        vec3 darkA = vec3(0.02, 0.03, 0.07);
        vec3 darkB = vec3(0.04, 0.16, 0.20);
        vec3 darkC = vec3(0.20, 0.14, 0.07);
        vec3 darkD = vec3(0.10, 0.12, 0.28);

        vec3 lightA = vec3(0.94, 0.91, 0.86);
        vec3 lightB = vec3(0.78, 0.88, 0.84);
        vec3 lightC = vec3(0.90, 0.82, 0.68);
        vec3 lightD = vec3(0.82, 0.84, 0.90);

        vec3 a = mix(darkA, lightA, u_light);
        vec3 b = mix(darkB, lightB, u_light);
        vec3 c = mix(darkC, lightC, u_light);
        vec3 d = mix(darkD, lightD, u_light);

        vec3 col = mix(a, b, n);
        col = mix(col, c, m * smoothstep(0.2, 0.9, n));
        col = mix(col, d, smoothstep(0.55, 1.15, length(p)));

        float meshX = abs(fract((p.x + r.x * 0.25) * 11.0) - 0.5);
        float meshY = abs(fract((p.y + r.y * 0.25) * 11.0) - 0.5);
        float mesh = smoothstep(0.045, 0.0, min(meshX, meshY));
        col += mesh * (0.05 + u_pulse * 0.08) * mix(vec3(0.49, 0.88, 0.78), vec3(0.12, 0.34, 0.30), u_light);

        float blob = smoothstep(0.55, 0.2, length(p - (u_mouse - 0.5)));
        col += blob * 0.12 * mix(vec3(0.88, 0.69, 0.42), vec3(0.62, 0.42, 0.18), u_light);

        float vign = smoothstep(1.25, 0.18, length(p * 1.05));
        col *= vign;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        useGL = false;
        return null;
      }
      return shader;
    };

    const program = gl.createProgram();
    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (vsh && fsh) {
      gl.attachShader(program, vsh);
      gl.attachShader(program, fsh);
      gl.linkProgram(program);
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(program, "u_res");
      const uTime = gl.getUniformLocation(program, "u_time");
      const uMouse = gl.getUniformLocation(program, "u_mouse");
      const uLight = gl.getUniformLocation(program, "u_light");
      const uPulse = gl.getUniformLocation(program, "u_pulse");

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener("resize", resize);

      const depths = [16, 28, 40, 22];
      const loop = (now) => {
        pointer.x += (pointer.tx - pointer.x) * 0.055;
        pointer.y += (pointer.ty - pointer.y) * 0.055;
        pulse += (0 - pulse) * 0.03;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, now * 0.001);
        gl.uniform2f(uMouse, pointer.x, 1.0 - pointer.y);
        gl.uniform1f(uLight, document.body.classList.contains("light_mode") ? 1 : 0);
        gl.uniform1f(uPulse, pulse);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        document.querySelectorAll(".orb").forEach((orb, i) => {
          const depth = depths[i] || 20;
          const x = (pointer.x - 0.5) * depth;
          const y = (pointer.y - 0.5) * depth;
          orb.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });

        tickClock();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      useGL = false;
    }
  }

  if (!useGL) {
    canvas.style.background =
      "radial-gradient(1200px 800px at 20% 10%, #16343a, transparent), radial-gradient(900px 700px at 80% 80%, #2a2418, #05070c)";
    setInterval(tickClock, 1000);
    tickClock();
  }

  syncHud();
  window.thorUI = {
    syncHud,
    pulse: () => {
      pulse = 1;
      bumpActivity();
    },
    setSignal: (v) => {
      if (signalEl) signalEl.textContent = v;
    },
  };
})();
