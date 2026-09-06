import { useEffect, type ReactNode } from "react";
import "./HelpPage.css";

/**
 * help.html — the Shot Composer documentation hub, opened in a new tab from
 * the ⓘ button in both Static and Motion modes (see ComposerShell's topNav).
 *
 * Content mirrors OpenMedia_Shot_Composer_Help_Center.docx section-for-section
 * (26 numbered topics — the docx's Tutorials section is dropped for now until
 * the single intro video is ready) so the doc stays the single source of
 * truth. Preset
 * labels (shot size, camera angle, elevation, composition) are pulled from
 * the live UI copy in modules/library/calibration/shotAxes.ts and
 * compositionPresets.ts rather than the doc's shorthand, since this page has
 * to match what the app actually shows.
 */

type TocItem = { id: string; num: number; label: string };
type TocGroup = { label: string; items: TocItem[] };

const TOC: TocGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "welcome", num: 1, label: "Welcome to Shot Composer" },
      { id: "getting-started", num: 2, label: "Getting Started" },
      { id: "static-vs-motion", num: 3, label: "Static vs Motion" },
    ],
  },
  {
    label: "Building a Shot",
    items: [
      { id: "first-shot", num: 4, label: "Creating Your First Shot" },
      { id: "posing", num: 5, label: "Posing Characters" },
      { id: "transform", num: 6, label: "Transforming & Duplicating" },
      { id: "shot-size", num: 7, label: "Shot Size" },
      { id: "camera-angle", num: 8, label: "Camera Angle" },
      { id: "ots", num: 9, label: "Over-the-Shoulder (OTS)" },
      { id: "elevation", num: 10, label: "Camera Elevation" },
      { id: "composition", num: 11, label: "Composition" },
      { id: "complete-frame", num: 12, label: "A Complete Cinematic Frame" },
    ],
  },
  {
    label: "Motion",
    items: [
      { id: "motion-keyframes", num: 13, label: "Motion Mode & Keyframes" },
      { id: "animation-example", num: 14, label: "Simple Animation Example" },
      { id: "camera-movement", num: 15, label: "Camera Movement" },
      { id: "timeline-controls", num: 16, label: "Timeline Controls" },
    ],
  },
  {
    label: "Saving & Library",
    items: [
      { id: "saving", num: 17, label: "Saving Your Work" },
      { id: "shot-library", num: 18, label: "Shot Library" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "shortcuts", num: 19, label: "Keyboard Shortcuts" },
      { id: "workflow", num: 20, label: "Simple Cinematic Workflow" },
    ],
  },
  {
    label: "AI Prompting",
    items: [
      { id: "prompt-guide", num: 21, label: "Prompt Guide for AI Video" },
      { id: "prompting-best-practices", num: 22, label: "Prompting Best Practices" },
      { id: "why-shot-composer", num: 23, label: "Why Use Shot Composer?" },
      { id: "recommended-workflow", num: 24, label: "Recommended Workflow for AI Creators" },
    ],
  },
  {
    label: "Learn More",
    items: [
      { id: "quick-reference", num: 25, label: "Quick Reference" },
      { id: "help-support", num: 26, label: "Help & Support" },
    ],
  },
];

function Section({ id, num, title, children }: { id: string; num: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="help-section">
      <div className="help-section-eyebrow">
        <span className="help-section-num">{num}</span>
      </div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Callout({ icon = "💡", tone, children }: { icon?: string; tone?: "blue"; children: ReactNode }) {
  return (
    <div className={`help-callout${tone ? ` ${tone}` : ""}`}>
      <span className="help-callout-icon">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Figure({ src, alt, caption, wide }: { src: string; alt: string; caption: string; wide?: boolean }) {
  return (
    <figure className="help-figure" style={wide ? undefined : { maxWidth: 480 }}>
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function FigureRow({ children }: { children: ReactNode }) {
  return <div className="help-figure-row">{children}</div>;
}

function PromptExample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="help-prompt-example">
      <p className="help-prompt-example-label">{label}</p>
      <div className="help-code">{children}</div>
    </div>
  );
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="help-flow">
      {steps.map((step, i) => (
        <>
          {i > 0 && <span className="help-flow-arrow" key={`arrow-${i}`}>→</span>}
          <span className="help-flow-step" key={step}>{step}</span>
        </>
      ))}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["M", "Move"],
  ["R", "Rotate"],
  ["S", "Scale"],
  ["P", "Pose"],
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z", "Redo"],
  ["Ctrl/Cmd + Y", "Redo"],
  ["Ctrl/Cmd + D", "Duplicate"],
  ["Delete / Backspace", "Delete"],
  ["Escape", "Clear selection"],
  ["Space", "Play / Pause (Motion mode)"],
  ["Arrow Keys", "Move playhead by one frame (Motion mode)"],
  ["Shift + Arrow Keys", "Move playhead by one second (Motion mode)"],
];

export function HelpPage() {
  // app.css (shared design tokens) pins html/body/#root to a fixed, non-scrolling
  // viewport for the composer's 3D canvas. The Help Center is a normal long-form
  // document, so it needs the opposite — this class (see HelpPage.css) restores
  // regular document scrolling for as long as this page is mounted.
  useEffect(() => {
    document.documentElement.classList.add("help-doc-root");
    return () => document.documentElement.classList.remove("help-doc-root");
  }, []);

  return (
    <div className="help-page">
      <header className="help-topbar">
        <span className="help-topbar-title">
          Shot Composer <span className="dim">— Help Center</span>
        </span>
        <nav className="help-topbar-links">
          <a href="/" className="help-topbar-link">Home</a>
          <a href="/library.html" className="help-topbar-link">Shot Library</a>
          <a href="/composer" className="help-topbar-cta">Open Shot Composer</a>
        </nav>
      </header>

      <div className="help-hero">
        <span className="help-hero-eyebrow">Help Center & Tutorial Guide</span>
        <h1>Design your shot before you generate it.</h1>
        <p>
          Everything below mirrors the Shot Composer Help Center document: interface tour, static and
          motion workflows, camera and composition guidance, saving and libraries, keyboard shortcuts,
          and how to turn a composed shot into an AI video prompt.
        </p>
      </div>

      <div className="help-body">
        <nav className="help-toc" aria-label="Help sections">
          {TOC.map((group) => (
            <div className="help-toc-group" key={group.label}>
              <p className="help-toc-group-label">{group.label}</p>
              {group.items.map((item) => (
                <a href={`#${item.id}`} className="help-toc-link" key={item.id}>
                  <span className="num">{item.num}</span>{item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <article className="help-article">
          <Section id="welcome" num={1} title="Welcome to Shot Composer">
            <p>
              Shot Composer is a free visual tool for planning cinematic shots before generating AI
              video. Instead of trying to describe every camera position, character pose, framing
              decision, and movement inside a text prompt, you can visually build the shot first.
            </p>
            <div className="help-card-grid">
              {[
                "Add characters and objects",
                "Position and transform objects",
                "Create and adjust character poses",
                "Choose shot sizes",
                "Control camera angles",
                "Adjust camera elevation",
                "Set composition",
                "Create Over-the-Shoulder (OTS) shots",
                "Add and control cameras",
                "Animate characters and cameras",
                "Add keyframes",
                "Preview motion",
                "Save complete scenes",
                "Save reusable poses",
                "Save motion/keyframe data",
                "Capture static shots",
                "Export motion shots",
                "Browse and reuse setups from the Shot Library",
              ].map((cap) => (
                <div className="help-card" key={cap}><p>{cap}</p></div>
              ))}
            </div>
            <Callout icon="🎬">
              <p>
                The goal is simple: <strong>Think visually. Compose the shot. Then use that visual
                direction for AI video generation.</strong>
              </p>
            </Callout>
            <Figure src="/help/overview.png" alt="Shot Composer full interface in Static mode" caption="The Shot Composer workspace — Scene panel, viewport, and contextual inspector." wide />
          </Section>

          <Section id="getting-started" num={2} title="Getting Started">
            <h3>Scene Panel — Left</h3>
            <p>
              The Scene panel contains your characters, primitives, and cameras. Add Male, Female, or
              Child characters; add Cube, Plane, Cylinder, Sphere, Capsule, Cone, or Torus primitives;
              and add cameras. Select objects from the scene list to manage them. For motion you can
              add cameras from here.
            </p>
            <FigureRow>
              <Figure src="/help/scene-panel-characters.png" alt="Scene panel showing Characters and Primitives" caption="Characters and Primitives" />
              <Figure src="/help/scene-panel-cameras.png" alt="Scene panel showing Cameras section" caption="Cameras" />
            </FigureRow>

            <h3>Viewport — Center</h3>
            <p>
              The viewport is where you visually compose your shot. Select, move, rotate, scale, pose
              characters, position cameras, and preview your scene.
            </p>
            <Figure src="/help/viewport.png" alt="Viewport with a mannequin and Select/Move/Rotate/Scale/Pose toolbar" caption="Viewport toolbar: Select, Move, Rotate, Scale, Pose (plus Keyframe in Motion mode)." wide />

            <h3>Inspector — Right</h3>
            <p>
              The contextual inspector provides controls for Shot, Object, Motion, Camera, Pose, and
              Composition. Collapse it when you want more viewport space.
            </p>
            <FigureRow>
              <Figure src="/help/inspector-shot.png" alt="Inspector Shot tab" caption="Shot tab — shot size, camera angle, elevation, composition." />
              <Figure src="/help/inspector-object.png" alt="Inspector Object tab" caption="Object tab — transform, pose, status." />
              <Figure src="/help/inspector-motion.png" alt="Inspector Motion tab" caption="Motion tab — pose &amp; motion presets." />
            </FigureRow>

            <h3>Timeline — Bottom</h3>
            <p>
              The timeline is primarily used in Motion mode for playback, scrubbing, duration, speed,
              and keyframes. In Static mode this area shows the Shot Strip instead.
            </p>
            <FigureRow>
              <Figure src="/help/timeline.png" alt="Timeline with keyframes, play/pause/stop, speed and duration" caption="Timeline (Motion mode)" />
              <Figure src="/help/shot-strip.png" alt="Shot Strip showing a captured shot" caption="Shot Strip (Static mode)" />
            </FigureRow>
          </Section>

          <Section id="static-vs-motion" num={3} title="Static vs Motion">
            <Figure src="/help/mode-toggle.png" alt="Static / Motion mode toggle" caption="Switch modes any time from the top bar." />
            <h3>Static</h3>
            <p>Use Static mode for a single cinematic frame.</p>
            <Flow steps={["Characters", "Pose", "Camera", "Shot Size", "Angle", "Elevation", "Composition", "Capture"]} />
            <h3>Motion</h3>
            <p>Switch to Motion when the shot needs movement. Your existing scene remains available.</p>
            <Flow steps={["Build the shot", "Switch to Motion", "Add keyframes", "Preview", "Export"]} />
          </Section>

          <Section id="first-shot" num={4} title="Creating Your First Shot">
            <ol className="help-steps">
              <li><strong>Add a character</strong> — from the Scene panel, add a Male, Female, or Child character.</li>
              <li><strong>Position the character</strong> — place them where you want them in the scene. Think about the subject's position before deciding where the camera should go.</li>
            </ol>
          </Section>

          <Section id="posing" num={5} title="Posing Characters">
            <p>
              Select a character and open Pose controls. Use the available pose library or adjust the
              character manually.
            </p>
            <Flow steps={["Character", "Pose", "Position", "Camera", "Composition"]} />
          </Section>

          <Section id="transform" num={6} title="Transforming and Duplicating Objects">
            <div className="help-card-grid">
              <div className="help-card"><h4>Move</h4><p>Changes the object's position.</p></div>
              <div className="help-card"><h4>Rotate</h4><p>Changes its orientation.</p></div>
              <div className="help-card"><h4>Scale</h4><p>Changes its size.</p></div>
              <div className="help-card">
                <h4>Duplicate</h4>
                <p>Creates an independent copy of the selected object, retaining its current transform and relevant state. Especially useful for multiple characters and repeated props.</p>
              </div>
            </div>
          </Section>

          <Section id="shot-size" num={7} title="Shot Size">
            <p>Shot Size controls how much of the subject is visible in the frame.</p>
            <div className="help-card-grid">
              {["Wide", "Full", "Medium", "MCU (Medium Close-Up)", "Close-Up"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
            <Callout>
              <p>Think: <strong>How much of my subject do I want the audience to see?</strong></p>
            </Callout>
          </Section>

          <Section id="camera-angle" num={8} title="Camera Angle">
            <p>Camera Angle controls the horizontal relationship between the camera and subject.</p>
            <div className="help-card-grid">
              {["Front", "3/4 Left", "3/4 Right", "Profile", "Back", "Over the Shoulder"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
          </Section>

          <Section id="ots" num={9} title="Over-the-Shoulder (OTS)">
            <p>
              OTS is a spatial camera relationship, not simply a composition preset. The camera is
              positioned behind and slightly to one side of the selected character, close to
              shoulder/head level, looking past them toward the scene or another character.
            </p>
            <Callout icon="🎥">
              <p>For a two-character conversation:</p>
              <Flow steps={["Camera", "Character A's shoulder", "Character B"]} />
            </Callout>
            <h3>Workflow</h3>
            <ol className="help-steps">
              <li>Select the foreground character.</li>
              <li>Choose Over the Shoulder.</li>
              <li>Adjust the camera if necessary.</li>
              <li>Refine Shot Size and Composition.</li>
            </ol>
          </Section>

          <Section id="elevation" num={10} title="Camera Elevation">
            <p>Elevation controls whether the camera is at eye level, above the subject, or below the subject.</p>
            <div className="help-card-grid">
              <div className="help-card"><h4>Eye Level</h4><p>Natural and neutral.</p></div>
              <div className="help-card"><h4>High</h4><p>Camera looks down toward the subject.</p></div>
              <div className="help-card"><h4>Low</h4><p>Camera looks upward.</p></div>
            </div>
          </Section>

          <Section id="composition" num={11} title="Composition">
            <p>Composition controls where the subject sits inside the frame.</p>
            <div className="help-card-grid">
              {["Center", "Left Third", "Right Third", "Upper Third", "Lower Third", "Negative Space"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
            <div className="help-formula">
              <div><strong>Camera Angle</strong> = where the camera is.</div>
              <div><strong>Composition</strong> = where the subject appears in the frame.</div>
              <div><strong>Shot Size</strong> = how much of the subject we see.</div>
              <div><strong>Elevation</strong> = how high or low the camera is.</div>
            </div>
          </Section>

          <Section id="complete-frame" num={12} title="Creating a Complete Cinematic Frame">
            <ol className="help-steps">
              <li>Build the scene — add characters and objects.</li>
              <li>Pose your characters.</li>
              <li>Choose Shot Size.</li>
              <li>Choose Camera Angle.</li>
              <li>Adjust Elevation.</li>
              <li>Adjust Composition.</li>
              <li>Refine the viewport.</li>
              <li>Capture the shot.</li>
            </ol>
          </Section>

          <Section id="motion-keyframes" num={13} title="Motion Mode and Keyframes">
            <p>
              When a static frame isn't enough, switch to Motion. Keyframes define how an object
              changes over time. For example: put a character at Point A, add a keyframe, move
              forward in time, move the character to Point B, and add another keyframe.
            </p>
            <div className="help-card-grid">
              {["Character movement", "Object movement", "Camera movement", "Rotations", "Other supported transforms"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
          </Section>

          <Section id="animation-example" num={14} title="Simple Animation Example">
            <ol className="help-steps">
              <li>Place the character at Point A.</li>
              <li>Add a keyframe.</li>
              <li>Move the playhead forward.</li>
              <li>Move the character to Point B.</li>
              <li>Add another keyframe.</li>
              <li>Play the timeline to preview the movement.</li>
            </ol>
          </Section>

          <Section id="camera-movement" num={15} title="Camera Movement">
            <p>
              Motion can combine character movement, camera movement, camera rotation, and timing. For
              example, a character can walk while the camera follows, or the camera can slowly move
              toward a subject.
            </p>
          </Section>

          <Section id="timeline-controls" num={16} title="Timeline Controls">
            <div className="help-card-grid">
              <div className="help-card"><h4>Play / Pause</h4><p>Start or pause playback.</p></div>
              <div className="help-card"><h4>Stop</h4><p>Return to the beginning.</p></div>
              <div className="help-card"><h4>Scrub</h4><p>Inspect a specific moment.</p></div>
              <div className="help-card"><h4>Speed</h4><p>Change preview playback speed.</p></div>
              <div className="help-card"><h4>Duration</h4><p>Set shot length.</p></div>
            </div>
          </Section>

          <Section id="saving" num={17} title="Saving Your Work">
            <div className="help-card-grid">
              <div className="help-card"><h4>Save Scene</h4><p>Saves the complete editable scene so you can continue editing the shot later.</p></div>
              <div className="help-card"><h4>Save Pose</h4><p>Saves a reusable character pose.</p></div>
              <div className="help-card"><h4>Save Motion</h4><p>Saves motion/keyframe information for reuse.</p></div>
            </div>
            <Callout>
              <p>Simple rule: <strong>Scene = everything. Pose = character posture. Motion = animation.</strong></p>
            </Callout>
          </Section>

          <Section id="shot-library" num={18} title="Shot Library">
            <p>The Shot Library lets you browse existing shot configurations and reusable setups.</p>
            <div className="help-card-grid">
              {["All", "Composition", "Camera Angle", "Pose Library", "Motion Library", "Community"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
            <p>Use the library as a starting point when you don't want to build every shot from scratch.</p>
            <p><a className="help-topbar-link" href="/library.html">Open the Shot Library →</a></p>
          </Section>

          <Section id="shortcuts" num={19} title="Keyboard Shortcuts">
            <div className="help-table-wrap">
              <table className="help-table">
                <thead><tr><th>Shortcut</th><th>Action</th></tr></thead>
                <tbody>
                  {SHORTCUTS.map(([key, action]) => (
                    <tr key={key}>
                      <td><kbd>{key}</kbd></td>
                      <td>{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout icon="⌨️">
              <p>Keyboard shortcuts do not interfere with typing inside text fields.</p>
            </Callout>
          </Section>

          <Section id="workflow" num={20} title="Simple Cinematic Workflow">
            <Flow steps={["Subject", "Pose", "Shot Size", "Camera Angle", "Elevation", "Composition", "Motion"]} />
            <ul>
              <li>Who or what is the subject?</li>
              <li>What are they doing?</li>
              <li>How much should we see?</li>
              <li>Where should the camera be?</li>
              <li>How high should the camera be?</li>
              <li>Where should the subject sit in the frame?</li>
              <li>Does the camera or subject move?</li>
            </ul>
          </Section>

          <Section id="prompt-guide" num={21} title="Prompt Guide for AI Video">
            <p>
              Shot Composer provides visual direction that complements your AI video prompt. A useful
              prompt describes: Subject + Action + Environment + Camera + Movement + Lighting + Style.
            </p>
            <h3>Basic template</h3>
            <div className="help-code">
              [Subject] + [action] in [environment]. [Camera framing and angle]. [Camera movement].{"\n"}
              [Character/object movement]. [Lighting/style].
            </div>
            <PromptExample label="Example — Static cinematic shot">
              A woman standing alone in an empty hallway at night. Medium shot, eye-level camera,
              three-quarter angle, subject positioned on the right third of the frame. Soft practical
              lighting, cinematic atmosphere, shallow depth of field.
            </PromptExample>
            <PromptExample label="Example — Over-the-shoulder dialogue">
              Over-the-shoulder shot from behind a man as he looks toward a woman standing across the
              room. Medium framing, eye-level camera, subtle warm interior lighting, cinematic dialogue
              scene.
            </PromptExample>
            <PromptExample label="Example — Tracking shot">
              A man walks toward a parked car on a city street. Medium-wide framing. The camera
              smoothly tracks backward while maintaining the man's position in frame. Natural evening
              light, cinematic realism.
            </PromptExample>
            <PromptExample label="Example — Dolly-in">
              A woman stands silently in a dark room. Medium shot at eye level. The camera slowly
              dollies toward her as she looks directly ahead. Subtle dramatic lighting, cinematic
              tension.
            </PromptExample>
          </Section>

          <Section id="prompting-best-practices" num={22} title="Prompting Best Practices">
            <Callout tone="blue" icon="⚠️">
              <p>Avoid vague prompts such as “Make it cinematic.” Describe the actual visual direction.</p>
            </Callout>
            <p>Use: <strong>Who + What + Where + Camera + Movement + Lighting.</strong></p>
            <div className="help-card-grid">
              {["Shot size", "Camera angle", "Camera movement", "Subject movement", "Relative positioning", "Environment", "Lighting"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
          </Section>

          <Section id="why-shot-composer" num={23} title="Why Use Shot Composer?">
            <p>
              AI video models are powerful, but complex visual direction can be difficult to describe
              entirely through text. Shot Composer lets you solve the visual problem first.
            </p>
            <p style={{ color: "var(--text-faint)", textDecoration: "line-through" }}>
              Imagine → Write prompt → Generate → Discover the framing is wrong → Rewrite → Generate again
            </p>
            <Flow steps={["Imagine", "Compose", "Capture", "Generate"]} />
          </Section>

          <Section id="recommended-workflow" num={24} title="Recommended Workflow for AI Creators">
            <h3>Before generation</h3>
            <div className="help-card-grid">
              {["Characters", "Poses", "Position", "Shot size", "Camera angle", "Elevation", "Composition", "Motion"].map((s) => (
                <div className="help-card" key={s}><p>{s}</p></div>
              ))}
            </div>
            <h3>During prompting</h3>
            <p>Use the resulting composition as a visual reference and translate the visual setup into your AI video prompt.</p>
            <h3>During generation</h3>
            <p>Use the reference and prompt with your preferred AI video model.</p>
            <h3>Iterate</h3>
            <p>If the generated result isn't right, return to the shot design and change the visual direction.</p>
          </Section>

          <Section id="quick-reference" num={25} title="Quick Reference">
            <div className="help-formula">
              <div><strong>Static:</strong> Character → Pose → Shot Size → Camera → Composition → Capture</div>
              <div><strong>Motion:</strong> Character → Pose → Shot → Camera → Keyframes → Timeline → Export</div>
              <div><strong>AI:</strong> Visual Shot → Reference → Prompt → AI Video</div>
            </div>
            <Callout>
              <p>Remember: <strong>Build → Pose → Frame → Compose → Animate → Capture → Generate</strong></p>
            </Callout>
          </Section>

          <Section id="help-support" num={26} title="Help & Support">
            <p>
              Click the ⓘ Help button inside Shot Composer any time for instructions, keyboard
              shortcuts, camera guidance, motion guidance, prompt examples, and video tutorials — it
              opens this page in a new tab.
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
}
