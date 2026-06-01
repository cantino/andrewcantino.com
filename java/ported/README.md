# Physics Applets

Three interactive physics demonstrations, originally written as Java applets in 2004
(© Andrew Cantino, Haverford College) and re-implemented by Claude here in modern HTML5 Canvas +
vanilla JavaScript so they run in any browser. The physics, controls, and on-screen
behavior are preserved from the originals.

Open [`index.html`](index.html) for the landing page, or jump straight to an applet:

| Applet | Folder | What it shows |
| --- | --- | --- |
| **Damped Driven Harmonic Oscillator** | [`damped-driven-harmonic-oscillator/`](damped-driven-harmonic-oscillator/index.html) | Resonance: response amplitude and phase lag vs. driving frequency, with adjustable quality factor Q. Click/drag either graph to set the drive frequency ω. |
| **Hilbert Space & Coupled Oscillators** | [`coupled-oscillators/`](coupled-oscillators/index.html) | Two spring-coupled pendulums decomposed into normal modes as a vector in state space, plus the resulting beats. Click the plot to pick a state, then press **Go!** |
| **Waves on a Beaded String** | [`beaded-string/`](beaded-string/index.html) | N beads on a string: only N standing-wave modes exist, and higher mode numbers alias back onto the fundamentals. |

## Running locally

These are static files — just open `index.html` in a browser, or serve the folder:

```sh
npx http-server applets
OR
python3 -m http.server
```

## Porting notes

Each applet is a single self-contained `index.html` (HTML + CSS + JS, no build step, no
dependencies). The JavaScript is a faithful line-by-line port of the original Java
`paint()` / animation code, including the exact equations, coordinate transforms, colors,
and per-tick time stepping, so the motion matches the Java originals. The Java source
remains archived in `PhysicsApplets.tar.gz` at the repository root.
