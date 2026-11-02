// Rendu des poumons : un seul shader WebGL qui lit les trois cartes pré-calculées
// (tools/bake_lungs.py). Tout l'état visuel passe par setState().

const VERT = `
attribute vec2 p;
varying vec2 vP;
void main(){ vP = p; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vP;
uniform sampler2D uA, uB, uC;
uniform vec2 uRes;
uniform vec4 uFit;       // centre xy, échelle xy du poumon dans le canvas
uniform float uT;        // secondes
uniform float uBreath;   // 0 poumon vide, 1 poumon plein
uniform float uFlesh;    // 0 tissu gris, 1 tissu rose
uniform float uTar;      // part de la surface encore tachée
uniform float uOxy;      // oxygène (monoxyde de carbone évacué)
uniform float uAirway;   // voies aériennes propres
uniform float uHaze;     // fumée ambiante
uniform float uSmoke;    // onde de fumée d'une cigarette : position 0..1.4, 0 = rien
uniform float uAir;      // onde d'air pur : position 0..1.4, 0 = rien
uniform vec3 uBg;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03+vec2(11.3,7.1); a *= 0.5; }
  return s;
}
vec3 srgb(float r, float g, float b){ return pow(vec3(r,g,b)/255.0, vec3(2.2)); }

void main(){
  vec2 frag = (vP*0.5+0.5)*uRes;
  // Coordonnées poumon : 0..1, y vers le bas
  vec2 uv = (frag - uFit.xy) / uFit.zw + 0.5;
  uv.y = 1.0 - uv.y;

  // Respiration : le diaphragme descend, les bases gonflent plus que les sommets
  vec2 anchor = vec2(0.5, 0.17);
  vec2 rel = uv - anchor;
  float swell = uBreath;
  rel.x /= 1.0 + 0.040*swell*(0.55 + 0.75*clamp(rel.y*1.6, 0.0, 1.0));
  rel.y /= 1.0 + 0.070*swell;
  vec2 st = rel + anchor;

  vec3 A = texture2D(uA, st).rgb;
  vec3 B = texture2D(uB, st).rgb;
  vec3 C = texture2D(uC, st).rgb;
  if (st.x<0.0||st.x>1.0||st.y<0.0||st.y>1.0){ A=vec3(.5,.5,0.); B=vec3(0.); C=vec3(0.); }

  float lung = B.r;
  float tube = B.g;
  float dist = B.b;
  float h = A.b;
  vec3 N = normalize(vec3((A.rg*2.0-1.0)*1.25, 0.62));

  // --- fond et fumée ambiante ---
  vec2 hp = frag/uRes.y;
  float drift = fbm(hp*vec2(1.7,2.4) + vec2(uT*0.018, -uT*0.03));
  drift = 0.55*drift + 0.45*fbm(hp*3.1 + drift*1.6 + vec2(-uT*0.012, uT*0.02));
  float dv = distance(frag, uFit.xy)/max(uFit.z, uFit.w);
  vec3 bg = uBg;
  bg += vec3(0.0042,0.0034,0.0030) * uHaze * smoothstep(0.34, 0.74, drift);
  // halo derrière les poumons : il se réchauffe avec la récupération
  vec3 halo = mix(vec3(0.0022,0.0018,0.0016), vec3(0.016,0.0050,0.0044), uFlesh);
  bg += halo * (1.0 - smoothstep(0.1, 0.72, dv));

  float a = max(lung, tube);
  // Ombre douce portée sur le fond
  float shade = texture2D(uB, uv + vec2(0.0,-0.012)).r;
  bg *= 1.0 - 0.32*shade;
  // Hors des poumons, inutile de calculer la matière : le fond suffit
  if (a < 0.002) {
    vec3 onlyBg = bg + (hash(frag+fract(uT))-0.5)*0.002;
    gl_FragColor = vec4(pow(max(onlyBg,0.0), vec3(1.0/2.2)), 1.0);
    return;
  }

  // --- tissu ---
  vec3 sickLow  = srgb(40., 32., 31.);
  vec3 sickHigh = srgb(112., 92., 86.);
  vec3 midLow   = srgb(92., 42., 40.);
  vec3 midHigh  = srgb(196., 128., 116.);
  vec3 cleanLow = srgb(158., 50., 52.);
  vec3 cleanHigh= srgb(250., 172., 158.);
  float t = uFlesh;
  vec3 low  = t < 0.5 ? mix(sickLow, midLow, t*2.0) : mix(midLow, cleanLow, t*2.0-1.0);
  vec3 high = t < 0.5 ? mix(sickHigh, midHigh, t*2.0) : mix(midHigh, cleanHigh, t*2.0-1.0);
  float shape = smoothstep(0.08, 0.95, h);
  vec3 flesh = mix(low, high, shape);

  // Marbrure douce et capillaires : ils ressortent quand le sang circule à nouveau
  float marble = fbm(st*vec2(9.0,10.0));
  flesh *= 0.90 + 0.22*marble;
  vec3 capColor = mix(srgb(70.,48.,46.), srgb(170.,44.,50.), uFlesh);
  flesh = mix(flesh, capColor, C.b*(0.14 + 0.28*uFlesh));

  // Mailles des lobules : le pigment se dépose le long de leurs bords
  float edgeInk = C.r;
  vec3 edgeColor = mix(srgb(22.,17.,17.), srgb(168.,70.,68.), uFlesh);
  flesh = mix(flesh, edgeColor, edgeInk*mix(0.54, 0.34, uFlesh));

  // Goudron : C.g est égalisé en rang, donc uTar vaut la part de surface tachée
  // Le bord des taches est un pointillé de suie, jamais une découpe nette
  float cut = 1.0 - uTar;
  float grain = 0.6*vnoise(st*340.0) + 0.4*vnoise(st*120.0);
  float tarMask = smoothstep(cut-0.03, cut+0.05, C.g + (grain-0.5)*0.26) * step(0.001, uTar);
  float core = smoothstep(cut, cut+0.30, C.g);
  float tarDensity = tarMask*(0.40 + 0.52*core);
  vec3 tarColor = mix(srgb(54.,44.,42.), srgb(11.,9.,9.), core);
  flesh = mix(flesh, tarColor, clamp(tarDensity,0.0,0.95));

  // --- lumière ---
  vec3 L1 = normalize(vec3(-0.42, 0.62, 0.68));
  vec3 L2 = normalize(vec3(0.70, -0.15, 0.55));
  float diff = max(dot(N,L1)*0.75+0.25, 0.0);
  float fill = max(dot(N,L2), 0.0)*0.20;
  vec3 V = vec3(0.,0.,1.);
  vec3 Hv = normalize(L1+V);
  float wet = mix(0.10, 0.36, uFlesh) * (1.0 - 0.92*tarMask);
  float micro = 0.5 + 0.5*vnoise(st*90.0);
  float spec = pow(max(dot(N,Hv),0.0), 46.0)*wet*(0.55+0.45*micro);
  float rim = pow(1.0 - clamp(N.z,0.0,1.0), 2.4);
  vec3 sss = mix(srgb(44.,30.,28.), srgb(220.,72.,62.), uFlesh)*rim*(0.28+0.30*uFlesh);
  float ao = mix(0.36, 1.0, smoothstep(0.0, 0.34, h));
  vec3 color = flesh*(diff+fill)*ao + sss + vec3(spec);

  // Oxygène : un rose qui remonte dans le tissu, en moins de 24 h. Il suit le souffle.
  color *= 0.90 + 0.13*uOxy + 0.05*uOxy*swell;

  // --- voies aériennes, vues par transparence ---
  vec3 tubeDirty = srgb(112., 88., 66.);
  vec3 tubeClean = srgb(238., 214., 202.);
  vec3 tubeColor = mix(tubeDirty, tubeClean, uAirway);
  float inLung = lung;
  // Dans le poumon, l'arbre bronchique se devine par transparence ; il s'efface vers les fines branches
  float tubeAlpha = tube*mix(1.0, 0.20*(1.0-smoothstep(0.40,0.88,dist))+0.03, inLung);
  vec3 tubeInner = mix(srgb(70.,52.,44.), srgb(232.,150.,136.), uAirway*0.5+uFlesh*0.5);
  vec3 tubeLit = mix(tubeColor, tubeInner, inLung)*(diff*0.92+0.22)*mix(0.86,1.0,h) + vec3(spec*0.3);
  if (inLung < 0.5) {
    float side = abs(N.x);
    tubeLit *= 0.70 + 0.55*(1.0-side);
  }
  color = mix(color, tubeLit, clamp(tubeAlpha,0.0,1.0));

  // --- ondes : fumée d'une cigarette, air pur après une envie battue ---
  if (uSmoke > 0.0){
    float front = 1.0 - smoothstep(uSmoke-0.26, uSmoke, dist);
    float n = fbm(st*16.0 + vec2(0., -uT*0.5));
    float fade = 1.0 - smoothstep(1.0, 1.4, uSmoke);
    float s = front*(0.45 + 0.55*n)*fade;
    color = mix(color, color*0.22 + vec3(0.012,0.010,0.009), clamp(s*1.05,0.0,0.92));
  }
  if (uAir > 0.0){
    float band = smoothstep(uAir-0.42, uAir-0.05, dist)*(1.0-smoothstep(uAir-0.05, uAir+0.14, dist));
    float fade = 1.0 - smoothstep(1.0, 1.4, uAir);
    color *= 1.0 + band*fade*0.55;
    color += vec3(0.05,0.07,0.08)*band*fade;
  }

  vec3 out3 = mix(bg, color, a);
  // grain léger pour casser les aplats du dégradé
  out3 += (hash(frag+fract(uT))-0.5)*0.004;
  gl_FragColor = vec4(pow(max(out3,0.0), vec3(1.0/2.2)), 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('texture ' + url));
    img.src = url;
  });
}

const DEFAULTS = { flesh: 0.05, tar: 0.62, oxy: 0, airway: 0, haze: 1, breathDepth: 0.5, breathPeriod: 4 };

export class Lungs {
  constructor(canvas, { bg = [0.0024, 0.0018, 0.0016], fit } = {}) {
    this.canvas = canvas;
    this.bg = bg;
    this.fitFn = fit || ((w, h) => ({ cx: w / 2, cy: h / 2, s: Math.min(w / 768, h / 844) }));
    this.state = { ...DEFAULTS };
    this.target = { ...DEFAULTS };
    this.smoke = -1;
    this.air = -1;
    this.guided = null;
    this.running = false;
    this.phase = 0;
    this.lastT = 0;
    this.lastDraw = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ok = false;
  }

  async init(base = 'assets/') {
    const gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => loadImage(`${base}lungs-${n}.png`)));
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    [a, b, c].forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
    this.u = {};
    ['uA', 'uB', 'uC', 'uRes', 'uFit', 'uT', 'uBreath', 'uFlesh', 'uTar', 'uOxy', 'uAirway', 'uHaze', 'uSmoke', 'uAir', 'uBg']
      .forEach((n) => { this.u[n] = gl.getUniformLocation(program, n); });
    gl.uniform1i(this.u.uA, 0);
    gl.uniform1i(this.u.uB, 1);
    gl.uniform1i(this.u.uC, 2);
    gl.uniform3fv(this.u.uBg, this.bg);
    this.gl = gl;
    this.ok = true;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.start();
    return true;
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    const f = this.fitFn(w / dpr, h / dpr);
    this.gl.uniform2f(this.u.uRes, w, h);
    // y du canvas compté du bas dans le shader
    this.gl.uniform4f(this.u.uFit, f.cx * dpr, h - f.cy * dpr, 768 * f.s * dpr, 844 * f.s * dpr);
    this.draw(performance.now());
  }

  /** Applique un état visuel. `instant` : pas de fondu (curseur « voir l'avenir »). */
  setState(next, { instant = false } = {}) {
    Object.assign(this.target, next);
    if (instant || !this.started) {
      Object.assign(this.state, this.target);
      this.started = true;
    }
  }

  puffSmoke() { this.smoke = 0.001; }
  puffAir() { this.air = 0.001; }
  /** Respiration guidée : fonction du temps (s) vers 0..1, ou null pour le rythme naturel. */
  setGuide(fn) { this.guided = fn; }

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      // 30 images/s suffisent à un mouvement lent et ménagent la batterie
      if (now - this.lastDraw < 31 && this.smoke < 0 && this.air < 0) return;
      this.draw(now);
      this.lastDraw = now;
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  draw(now) {
    const { gl, u } = this;
    if (!gl) return;
    const dt = Math.min((now - this.lastT) / 1000, 0.1);
    this.lastT = now;
    const s = this.state;
    const k = 1 - Math.exp(-dt * 1.6);
    for (const key of Object.keys(this.target)) s[key] += (this.target[key] - s[key]) * k;

    this.phase += dt / s.breathPeriod;
    let breath;
    if (this.guided) breath = this.guided(now / 1000);
    else if (this.reduced) breath = 0.5 * s.breathDepth;
    else breath = (0.5 - 0.5 * Math.cos(this.phase * Math.PI * 2)) ** 1.25 * s.breathDepth;

    if (this.smoke >= 0) { this.smoke += dt * 0.42; if (this.smoke > 1.4) this.smoke = -1; }
    if (this.air >= 0) { this.air += dt * 0.5; if (this.air > 1.4) this.air = -1; }

    gl.uniform1f(u.uT, now / 1000 % 1000);
    gl.uniform1f(u.uBreath, breath);
    gl.uniform1f(u.uFlesh, s.flesh);
    gl.uniform1f(u.uTar, s.tar);
    gl.uniform1f(u.uOxy, s.oxy);
    gl.uniform1f(u.uAirway, s.airway);
    gl.uniform1f(u.uHaze, s.haze);
    gl.uniform1f(u.uSmoke, Math.max(this.smoke, 0));
    gl.uniform1f(u.uAir, Math.max(this.air, 0));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
