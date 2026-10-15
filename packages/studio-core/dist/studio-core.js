"use strict";
var RGStudioCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/studio-core/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    C: () => C,
    DEFAULTS: () => DEFAULTS,
    FORMATS: () => FORMATS,
    NEW_SLIDE: () => NEW_SLIDE,
    PROJECT_FORMAT: () => PROJECT_FORMAT,
    PROJECT_FORMAT_VERSION: () => PROJECT_FORMAT_VERSION,
    SAMPLES: () => SAMPLES,
    SERIES_CONTENT: () => SERIES_CONTENT,
    SERIES_PACKS: () => SERIES_PACKS,
    V1_TO_V2_SLIDE_DEFAULTS: () => V1_TO_V2_SLIDE_DEFAULTS,
    clamp: () => clamp,
    configureRenderer: () => configureRenderer,
    frame: () => frame,
    getFormat: () => getFormat,
    migrateProjectV1ToV2: () => migrateProjectV1ToV2,
    palette: () => palette,
    restoreProject: () => restoreProject,
    uid: () => uid
  });

  // packages/studio-core/src/registry.ts
  var clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  var FORMATS = [
    { id: "portrait", label: "Instagram portrait \xB7 4:5", w: 1080, h: 1350 },
    { id: "square", label: "Instagram square \xB7 1:1", w: 1080, h: 1080 },
    { id: "story", label: "Stories / reels cover \xB7 9:16", w: 1080, h: 1920 },
    { id: "linkedin", label: "LinkedIn / OG card", w: 1200, h: 630 },
    { id: "landscape", label: "X / landscape \xB7 16:9", w: 1600, h: 900 },
    { id: "wide", label: "Wide cover \xB7 3:2", w: 1200, h: 800 },
    { id: "portrait3x4", label: "Portrait \xB7 3:4", w: 1080, h: 1440 },
    { id: "igLandscape", label: "Instagram landscape \xB7 1.91:1", w: 1080, h: 566 },
    { id: "linkedinSquare", label: "LinkedIn square \xB7 1:1", w: 1200, h: 1200 },
    { id: "linkedinPortrait", label: "LinkedIn portrait \xB7 4:5", w: 1200, h: 1500 },
    { id: "xSquare", label: "X / square \xB7 1:1", w: 1200, h: 1200 },
    { id: "youtube", label: "Video thumbnail \xB7 16:9", w: 1280, h: 720 },
    { id: "pinterest", label: "Pinterest \xB7 2:3", w: 1e3, h: 1500 },
    { id: "linkedinBanner", label: "LinkedIn banner \xB7 4:1", w: 1584, h: 396 },
    { id: "xHeader", label: "X header \xB7 3:1", w: 1500, h: 500 },
    { id: "custom", label: "Custom dimensions", w: 1080, h: 1350 }
  ];
  function getFormat(s) {
    if (s.format === "custom") return { id: "custom", label: "Custom size", w: clamp(Math.round(Number(s.customWidth) || 1080), 400, 4096), h: clamp(Math.round(Number(s.customHeight) || 1350), 300, 4096) };
    return FORMATS.find((f) => f.id === s.format) || FORMATS[0];
  }
  var SAMPLES = [
    { id: "cover", name: "Editorial Cover", category: "editorial", desc: "The signature story opener", kicker: "FIELD NOTES / 001", title: "Where ideas grow into systems.", subtitle: "An independent engineering lab exploring AI, software and infrastructure.", tag: "ENGINEERING NOTES", detail: "Build. Experiment. Share. Grow.", bullets: "Idea\nPrototype\nTest\nDocument", code: "", label: "THE ENGINEER\u2019S FIELD JOURNAL" },
    { id: "journal", name: "Journal Article", category: "editorial", desc: "Long-form technical thinking", kicker: "JOURNAL / ENGINEERING", title: "A more deliberate way to build software.", subtitle: "Research, prototype, validate, and document. Engineering notes from the field.", tag: "TECHNICAL JOURNAL", detail: "READ THE FIELD NOTE", bullets: "", code: "", label: "NOTES FROM THE FIELD" },
    { id: "lab", name: "Lab Experiment", category: "technical", desc: "Hypothesis \xB7 method \xB7 outcome", kicker: "LAB NOTE / EXPERIMENT", title: "Can we make this system simpler?", subtitle: "A reproducible experiment, with a clear hypothesis and an honest record of limitations.", tag: "EXPERIMENT", detail: "HYPOTHESIS \u2192 METHOD \u2192 OBSERVATION", bullets: "Hypothesis\nSetup & method\nObserved results\nLimitations", label: "THE LAB NOTEBOOK" },
    { id: "project", name: "Project Brief", category: "technical", desc: "Show a real build or prototype", kicker: "PROJECTS / BUILD LOG", title: "From a small idea to working software.", subtitle: "Document the problem, architecture, real constraints, and next iteration.", tag: "PROTOTYPE", detail: "STATUS / PROTOTYPE", bullets: "Problem\nApproach\nStack\nNext steps", label: "BUILT, TESTED, DOCUMENTED" },
    { id: "code", name: "Code Snippet", category: "technical", desc: "A readable terminal-focused card", kicker: "FIELD NOTE / CODE", title: "Small tools, fewer moving parts.", subtitle: "A short example from an engineering notebook.", tag: "CODE NOTE", detail: "EXAMPLE / NOT A DEPLOYMENT CLAIM", code: "docker compose config\ndocker compose up -d\ndocker compose ps", label: "TERMINAL / EXCERPT" },
    { id: "quote", name: "Editorial Quote", category: "editorial", desc: "Serif-led ideas worth saving", kicker: "THE GARDEN / PRINCIPLES", title: "Build real things. Test them. Document what works.", subtitle: "The smallest useful system is often the most interesting place to start.", tag: "A FIELD NOTE", detail: "WHERE IDEAS GROW INTO SYSTEMS", label: "THINKING OUT LOUD" },
    { id: "metrics", name: "Research Signals", category: "technical", desc: "Metric cards without fake data", kicker: "RESEARCH / MEASUREMENT", title: "Measure what actually matters.", subtitle: "Replace every placeholder with a verified number or explicitly describe it as an example.", tag: "EVALUATION", detail: "ILLUSTRATIVE FRAMEWORK \xB7 NOT TEST RESULTS", bullets: "01|Correctness\n02|Resource cost\n03|Maintainability", label: "MEASUREMENT FRAMEWORK" },
    { id: "comparison", name: "Trade-off Study", category: "technical", desc: "Compare two engineering choices", kicker: "DESIGN DECISIONS / TRADE-OFFS", title: "Two approaches. One decision.", subtitle: "Make the constraints visible before choosing the architecture.", tag: "ENGINEERING DECISION", detail: "COMPARE BEFORE YOU COMMIT", bullets: "Approach A|Fewer dependencies;Easy to operate;Limited customization\nApproach B|More flexibility;More components;Higher upkeep", label: "DECISION NOTES" },
    { id: "checklist", name: "Practical Checklist", category: "social", desc: "Saveable engineering checklist", kicker: "FIELD GUIDE / CHECKLIST", title: "Before you ship.", subtitle: "A quiet checklist for real-world software engineering.", tag: "CHECKLIST", detail: "SAVE FOR LATER", bullets: "Define acceptance criteria\nTest the failure path\nDocument the rollback\nCheck permissions & secrets\nRecord the limitations", label: "DO THE BORING THINGS WELL" },
    { id: "announcement", name: "Announcement", category: "social", desc: "A calm, clear update", kicker: "GARDEN UPDATE / NEWS", title: "Something new is taking shape.", subtitle: "A short update about an idea, a prototype, or a piece of writing in progress.", tag: "WORK IN PROGRESS", detail: "FOLLOW THE PROCESS", label: "BUILD IN PUBLIC" },
    { id: "changelog", name: "Build Log", category: "technical", desc: "A lightweight change summary", kicker: "BUILD LOG / ITERATION", title: "A week of small improvements.", subtitle: "What changed, what still needs work, and what comes next.", tag: "WORKING NOTES", detail: "NEXT / TEST THE ASSUMPTIONS", bullets: "Refined the scope\nSimplified the setup\nDocumented constraints\nQueued the next tests", label: "ITERATE, DOCUMENT, REPEAT" },
    { id: "architecture", name: "System Map", category: "technical", desc: "A simple node and edge diagram", kicker: "ARCHITECTURE / SYSTEM DESIGN", title: "A system you can reason about.", subtitle: "Separate responsibilities and make the flow visible.", tag: "SYSTEM DESIGN", detail: "INPUT \u2192 PROCESS \u2192 VERIFY \u2192 OUTPUT", bullets: "Input\nProcess\nVerify\nOutput", label: "SYSTEMS, NOT SPECTACLE" },
    { id: "community", name: "Community Invite", category: "social", desc: "A genuine community invitation", kicker: "COMMUNITY / RUNTIME GARDEN", title: "Build. Experiment. Share. Grow.", subtitle: "A place to exchange notes on AI, engineering, automation, and open source.", tag: "DEVELOPER COMMUNITY", detail: "JOIN THE CONVERSATION", bullets: "AI & agents\nSoftware engineering\nSelf-hosting & DevOps", label: "GROW THROUGH SHARING" },
    { id: "minimal", name: "Minimal Statement", category: "editorial", desc: "Ultra-clean typography", kicker: "RG / PRINCIPLES", title: "Less ceremony. More working systems.", subtitle: "Independent research, real builds, and notes from the process.", tag: "FIELD NOTE", detail: "RUNTIMEGARDEN.COM", label: "ENGINEERING IN PRACTICE" },
    { id: "numbered", name: "Step-by-Step", category: "social", desc: "Carousel teaching frame", kicker: "GUIDE / PART 01", title: "Turn an idea into a system.", subtitle: "One practical step at a time, with room for evidence and iteration.", tag: "HOW IT WORKS", detail: "01 / 04", bullets: "Start with the problem\nBuild a small prototype\nTest the assumptions\nWrite down the results", label: "THE WORKFLOW" },
    { id: "image", name: "Visual Case Study", category: "editorial", desc: "Real screenshot with context", kicker: "PROJECT / VISUAL NOTES", title: "The details behind the build.", subtitle: "Add an actual screenshot or diagram from your project, then explain what it shows.", tag: "CASE STUDY", detail: "ADD A REAL SCREENSHOT", label: "SHOW THE WORK" },
    { id: "chapter", name: "Chapter Divider", category: "editorial", desc: "Strong numbered transition", kicker: "CHAPTER / 01", title: "Start with the question.", subtitle: "A clean chapter marker for an ongoing series.", tag: "SERIES / CHAPTER", detail: "01 \u2014 THE QUESTION", bullets: "Question\nEvidence\nMethod", label: "PART OF A CONTINUING STORY" },
    { id: "thesis", name: "Core Thesis", category: "editorial", desc: "Large claim, small context", kicker: "FIELD NOTES / THESIS", title: "Simplicity is a design decision.", subtitle: "What we remove matters as much as what we build.", tag: "EDITORIAL / INSIGHT", detail: "ONE IDEA, CLEARLY STATED", bullets: "", label: "SOME IDEAS NEED SPACE" },
    { id: "stat", name: "Single Signal", category: "technical", desc: "One verified figure in focus", kicker: "RESEARCH / SIGNAL", title: "Start with a measurable signal.", subtitle: "Use a verified metric and add the environment, method and limits.", tag: "OBSERVATION", detail: "MEASURED / NOT ASSUMED", bullets: "42%|EXAMPLE ONLY", label: "EVIDENCE FIRST" },
    { id: "timeline", name: "Project Timeline", category: "technical", desc: "Three or four stages in sequence", kicker: "BUILD / TIMELINE", title: "From idea to iteration.", subtitle: "A series of observable steps \u2014 not a made-up launch timeline.", tag: "PROCESS", detail: "DISCOVER \u2192 BUILD \u2192 VERIFY", bullets: "Define the question\nPrototype the smallest thing\nRun tests\nDocument what changed", label: "PROGRESS IS DOCUMENTED" },
    { id: "layers", name: "Architecture Layers", category: "technical", desc: "Stacked system responsibilities", kicker: "SYSTEMS / LAYERS", title: "Every layer earns its place.", subtitle: "Separate the concerns without adding infrastructure for its own sake.", tag: "ARCHITECTURE", detail: "THIN LAYERS / CLEAR CONTRACTS", bullets: "Interface\nApplication logic\nPersistence\nObservability", label: "MINIMAL BY DESIGN" },
    { id: "spotlight", name: "Project Spotlight", category: "editorial", desc: "Split feature card", kicker: "PROJECT / SPOTLIGHT", title: "An experiment worth exploring.", subtitle: "The problem, the constraints and what comes next.", tag: "BUILD IN PROGRESS", detail: "PROTOTYPE / NOT RELEASED", bullets: "Problem\nConstraints\nNext experiment", label: "SHOW THE WORK" },
    { id: "beforeafter", name: "Before / After", category: "technical", desc: "Compare an honest iteration", kicker: "ENGINEERING / CHANGE", title: "What changed in the design?", subtitle: "Document the baseline and the alternative without exaggerated claims.", tag: "COMPARISON", detail: "BASELINE \u2192 ITERATION", bullets: "Before|Manual checks;Scattered logs;Hard to review\nAfter|Structured notes;Repeatable tests;Visible limitations", label: "ITERATION NOTES" },
    { id: "method", name: "Research Method", category: "technical", desc: "Step-by-step method", kicker: "LAB / METHOD", title: "How we tested the idea.", subtitle: "Show the setup and methodology so someone else can repeat it.", tag: "METHOD", detail: "REPRODUCIBLE WORK", bullets: "Hypothesis\nTest setup\nProcedure\nEvaluation", label: "METHOD BEFORE CLAIMS" },
    { id: "findings", name: "Lab Findings", category: "technical", desc: "Findings with caveat", kicker: "LAB / FINDINGS", title: "What did the test show?", subtitle: "Report observations, unknowns, and failures without hiding caveats.", tag: "OBSERVATIONS", detail: "DATA / CONTEXT / LIMITATIONS", bullets: "Observed\nNot observed\nUncertain", label: "RECORD THE LIMITS" },
    { id: "questions", name: "Open Questions", category: "editorial", desc: "An invitation to investigate", kicker: "LAB / OPEN QUESTIONS", title: "What still needs answering?", subtitle: "Good engineering records the questions we have not solved yet.", tag: "INVESTIGATE", detail: "NEXT HYPOTHESES", bullets: "Can we simplify further?\nWhere could it fail?\nWhat would prove success?", label: "CURIOSITY, TESTED" },
    { id: "tradeoffs", name: "Design Decision", category: "technical", desc: "Structured trade-off record", kicker: "DECISION / RECORD", title: "Choosing under constraints.", subtitle: "Explain why one approach fits the actual problem better.", tag: "ARCHITECTURE DECISION", detail: "CONTEXT / OPTIONS / CONSEQUENCES", bullets: "Constraints\nOptions\nDecision\nTrade-offs", label: "DESIGN DECISIONS ARE DOCUMENTS" },
    { id: "dosdonts", name: "Do / Avoid", category: "social", desc: "Two-column useful advice", kicker: "FIELD GUIDE / PATTERNS", title: "Patterns worth keeping.", subtitle: "Helpful guidance rooted in operational experience.", tag: "GUIDE", detail: "LESS THEATER. MORE SIGNAL.", bullets: "Do|Small verifiable changes;Explicit rollback;Minimal permissions\nAvoid|Undefined scope;Silent failures;Privilege by default", label: "BUILD WITH INTENTION" },
    { id: "faq", name: "Technical FAQ", category: "social", desc: "Readable Q&A", kicker: "NOTES / Q&A", title: "A practical question.", subtitle: "A concise explanation with the trade-off and context made explicit.", tag: "EXPLAINER", detail: "QUESTION \u2192 ANSWER", bullets: "Q|Why this approach?\nA|It solves the immediate problem with fewer moving parts.", label: "EXPLAIN THE REASONING" },
    { id: "terminal", name: "Terminal Notebook", category: "technical", desc: "Console-shaped feature", kicker: "DEVELOPER TOOLS / TERMINAL", title: "Small commands, clear intent.", subtitle: "Show a real command with a note about its context.", tag: "CODE / NOTES", detail: "SHELL / EXAMPLE", bullets: "", label: "IMPLEMENTATION NOTES", code: "docker compose config\ndocker compose ps" },
    { id: "resources", name: "Further Reading", category: "social", desc: "Curated references list", kicker: "FIELD GUIDE / REFERENCES", title: "Where to dig deeper.", subtitle: "List real resources and link to the original authors.", tag: "RESOURCE NOTES", detail: "REFERENCES, NOT ENDORSEMENTS", bullets: "Official documentation\nSource repository\nTechnical discussion\nExperiment notes", label: "KEEP LEARNING" },
    { id: "release", name: "Release Notes", category: "technical", desc: "Version-style changelog", kicker: "PROJECTS / RELEASE NOTES", title: "Changes, without the hype.", subtitle: "Be explicit about what shipped, what was tested and what remains.", tag: "RELEASE NOTES", detail: "STATUS / VERIFY BEFORE SHARING", bullets: "Added\nChanged\nFixed\nKnown limitations", label: "SHIPPED \u2260 VERIFIED" },
    { id: "roadmap", name: "Next Iteration", category: "technical", desc: "Next steps and status", kicker: "PROJECT / ROADMAP", title: "What comes next?", subtitle: "A transparent look at current work and planned experiments.", tag: "WORK IN PROGRESS", detail: "PLAN / NOT A PROMISE", bullets: "Test failure paths\nReduce dependencies\nWrite a reproducible guide", label: "PROGRESS WITHOUT PROMISES" },
    { id: "closing", name: "Closing Frame", category: "editorial", desc: "Consistent carousel outro", kicker: "SERIES / CONCLUSION", title: "Build. Experiment. Share. Grow.", subtitle: "The useful parts: what worked, what did not, and what we learned.", tag: "KEY TAKEAWAY", detail: "EXPLORE MORE / RUNTIMEGARDEN.COM", bullets: "What changed\nWhat we learned\nWhat comes next", label: "WHERE IDEAS GROW INTO SYSTEMS" },
    { id: "digest", name: "Weekly Digest", category: "social", desc: "Brief collection of updates", kicker: "GARDEN / DIGEST", title: "A handful of useful notes.", subtitle: "An honest overview of experiments, fixes and reading.", tag: "FIELD ROUNDUP", detail: "SMALL STEPS, DOCUMENTED", bullets: "Lab note\nJournal update\nProject progress\nCommunity question", label: "A WEEK IN THE GARDEN" },
    { id: "principle", name: "Engineering Principle", category: "editorial", desc: "Serif typography & rule", kicker: "MANIFESTO / PRINCIPLES", title: "Make the process visible.", subtitle: "Research, prototype, test, write it down, repeat.", tag: "PRINCIPLE", detail: "THE ENGINEERING PRACTICE", bullets: "", label: "SMALL SYSTEMS, BIG QUESTIONS" },
    { id: "diagram", name: "Sequence Diagram", category: "technical", desc: "Linear connected workflow", kicker: "ARCHITECTURE / FLOW", title: "A clearer path from input to output.", subtitle: "Name the steps, boundaries and checks that make a system understandable.", tag: "SYSTEM FLOW", detail: "BOUNDARIES MATTER", bullets: "Trigger\nValidate\nExecute\nObserve", label: "TRACE EVERY STEP" },
    { id: "myth", name: "Myth / Reality", category: "social", desc: "Contrast a claim with evidence", kicker: "FIELD GUIDE / CLARITY", title: "An assumption worth testing.", subtitle: "Explain what actually changes when you measure the system.", tag: "MYTH / REALITY", detail: "TEST THE ASSUMPTION", bullets: "Myth|More services always scale better\nReality|Simplicity often wins at small scale", label: "EVIDENCE OVER FASHION" },
    { id: "hero", name: "Visual Hero", category: "editorial", desc: "Oversized editorial visual moment", kicker: "JOURNAL / THE IDEA", title: "Where experiments take shape.", subtitle: "A restrained visual opener anchored in the real engineering story.", tag: "EDITORIAL / COVER", detail: "READ THE FULL JOURNAL NOTE", bullets: "", label: "RUNTIME GARDEN / JOURNAL" },
    { id: "insight", name: "Key Insight", category: "social", desc: "Notable concept & explanation", kicker: "LEARNING / INSIGHT", title: "What the experiment taught us.", subtitle: "A single takeaway, with context and no unsupported claims.", tag: "LEARNED LESSON", detail: "INSIGHT / 01", bullets: "Problem\nObservation\nNext test", label: "LEARNING IN PUBLIC" }
  ];
  var SERIES_PACKS = [
    { id: "field", name: "Field Notes", desc: "A thoughtful engineering narrative", theme: "light", pattern: "dots", slides: ["cover", "chapter", "method", "findings", "insight", "closing"] },
    { id: "labbook", name: "Lab Notebook", desc: "A documented experiment from hypothesis to limits", theme: "light", pattern: "grid", slides: ["hero", "questions", "method", "diagram", "findings", "closing"] },
    { id: "system", name: "System Anatomy", desc: "Take apart a system, one layer at a time", theme: "dark", pattern: "grid", slides: ["cover", "layers", "diagram", "tradeoffs", "checklist", "closing"] },
    { id: "open", name: "Open Source Dispatch", desc: "Show code, context and next steps", theme: "light", pattern: "dots", slides: ["hero", "spotlight", "terminal", "release", "roadmap", "closing"] },
    { id: "decision", name: "Decision Record", desc: "Make architectural trade-offs explicit", theme: "light", pattern: "none", slides: ["thesis", "questions", "comparison", "beforeafter", "tradeoffs", "closing"] },
    { id: "build", name: "Build in Public", desc: "Progress narrative without marketing claims", theme: "light", pattern: "grid", slides: ["cover", "timeline", "spotlight", "changelog", "roadmap", "closing"] },
    { id: "guide", name: "Practical Field Guide", desc: "Clear steps readers can save", theme: "light", pattern: "dots", slides: ["hero", "chapter", "numbered", "dosdonts", "faq", "resources", "closing"] },
    { id: "research", name: "Research Signals", desc: "Metrics, method and caution together", theme: "dark", pattern: "dots", slides: ["cover", "stat", "metrics", "method", "findings", "closing"] },
    { id: "community", name: "Community Dispatch", desc: "A calm, consistent community series", theme: "light", pattern: "none", slides: ["community", "questions", "digest", "principle", "resources", "closing"] },
    { id: "terminal", name: "Terminal Sessions", desc: "Developer notes for tools and automation", theme: "dark", pattern: "grid", slides: ["cover", "terminal", "code", "layers", "checklist", "closing"] },
    { id: "observatory", name: "Engineering Observatory", desc: "Observations and measurable patterns", theme: "light", pattern: "grid", slides: ["thesis", "stat", "insight", "timeline", "findings", "closing"] },
    { id: "manifesto", name: "Garden Principles", desc: "A typographic collection with shared rhythm", theme: "dark", pattern: "none", slides: ["cover", "principle", "thesis", "myth", "insight", "closing"] }
  ];
  var DEFAULTS = { chapterNumber: 1, customWidth: 1080, customHeight: 1350, series: "none", seriesLabel: "", seriesVariant: "regular", format: "portrait", theme: "light", scale: 1, align: "left", pattern: "dots", numbering: true, showLogo: true, showDomain: true, showTag: true, showSubtitle: true, showGuides: false, image: null, imageFit: "cover", imagePosition: 50, caption: "", hashtags: "#RuntimeGarden #SoftwareEngineering #BuildInPublic", sourceUrl: "", date: "", customFooter: "", backgroundMode: "default" };
  var NEW_SLIDE = (type) => ({ ...DEFAULTS, ...structuredClone(SAMPLES.find((t) => t.id === type) || SAMPLES[0]), uid: uid() });
  var SERIES_CONTENT = { "cover": ["A closer look at how systems grow.", "An engineering story in six connected frames."], "chapter": ["The question behind the work.", "Define the constraint before reaching for a framework."], "method": ["Make the process repeatable.", "Share the setup, procedure, and limits so others can retrace it."], "findings": ["What did we actually learn?", "Separate observations from assumptions and list the open questions."], "insight": ["The most useful lesson.", "State one takeaway without overstating the evidence."], "closing": ["Keep building. Keep learning.", "Explore the documented work at runtimegarden.com."], "hero": ["An idea worth exploring.", "A look inside a small, deliberate engineering experiment."], "questions": ["What problem are we solving?", "A good hypothesis starts with a question we can test."], "diagram": ["Follow the signal.", "Understand where information moves and which boundaries matter."], "layers": ["Only the layers we need.", "Complexity has a cost. Make each responsibility explicit."], "checklist": ["Before you publish the result.", "Check the evidence, limitations, security and recovery story."], "spotlight": ["Inside a working prototype.", "Explain what exists, what was tested and what is still planned."], "terminal": ["Small commands. Clear purpose.", "Real examples with enough context to reproduce safely."], "release": ["Changes worth documenting.", "Separate new work from verified results and known limitations."], "roadmap": ["What should we test next?", "Future work, with no invented delivery promises."], "thesis": ["Start with the constraints.", "The context shapes the engineering decision."], "comparison": ["Two options, real trade-offs.", "Compare reliability, maintainability and operational cost."], "beforeafter": ["What would the iteration change?", "Describe the baseline and the intended improvement."], "tradeoffs": ["Why choose this approach?", "Document the decision and its consequences."], "numbered": ["Build it one step at a time.", "Turn the design into a set of testable changes."], "dosdonts": ["Patterns worth remembering.", "Prefer repeatable practice over fashionable complexity."], "faq": ["One practical question.", "Answer with the context and limitations intact."], "resources": ["Keep exploring the sources.", "Useful references and original documentation."], "stat": ["Numbers need context.", "Replace illustrative figures with verified measurements."], "metrics": ["What would we measure?", "Define the evaluation criteria before running the test."], "community": ["Ideas grow through sharing.", "A place for experiments, implementation notes and discussion."], "digest": ["A collection of field notes.", "Recent observations, experiments and community questions."], "principle": ["Show the work.", "Build real things. Test them. Share what you learn."], "code": ["Keep the implementation legible.", "Commands and examples should be reproducible and safe."], "changelog": ["What changed and why?", "A short log of decisions and iterations."], "timeline": ["The path from question to test.", "Observe, prototype, verify, document."] };
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // packages/studio-core/src/render.ts
  var rendererAssets = { getLogo: () => null, getImage: () => null };
  function configureRenderer(next) {
    rendererAssets = {
      getLogo: next.getLogo ?? (() => null),
      getImage: next.getImage ?? (() => null)
    };
  }
  var C = {
    light: { bg: "#F6F8F3", surface: "#FFFFFF", soft: "#EDF2E9", ink: "#16271E", muted: "#506459", accent: "#286A47", accentSoft: "#DCEDE0", border: "#D8E1D6", warm: "#AD7742" },
    dark: { bg: "#0D1713", surface: "#15231B", soft: "#1B2C22", ink: "#EDF4ED", muted: "#AFBEB1", accent: "#8DD5A3", accentSoft: "#243E2C", border: "#304337", warm: "#D6AD77" }
  };
  function palette(s) {
    return C[s.theme] || C.light;
  }
  var fontSans = "Inter, Geist, system-ui, sans-serif";
  var fontMono = '"IBM Plex Mono", "JetBrains Mono", monospace';
  var fontSerif = "Newsreader, Georgia, serif";
  function font(ctx, weight, size, family = fontSans) {
    ctx.font = `${weight} ${size}px ${family}`;
  }
  function fill(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function line(ctx, color, x1, y1, x2, y2, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, r, bg, border) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, clamp(r, 0, Math.min(w, h) / 2));
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fill();
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  function text(ctx, s, x, y, size, color, weight = 500, family = fontSans, align = "left") {
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    font(ctx, weight, size, family);
    ctx.textAlign = align;
    ctx.fillText(String(s ?? ""), x, y);
  }
  function maxText(ctx, str, maxWidth, size, minSize, weight = 700, family = fontSans) {
    let n = size;
    while (n > minSize) {
      font(ctx, weight, n, family);
      if (ctx.measureText(str).width <= maxWidth) break;
      n -= 1;
    }
    return n;
  }
  function breakLines(ctx, s, maxWidth, size, weight = 500, family = fontSans, maxLines = 99) {
    font(ctx, weight, size, family);
    const lines = [];
    for (const para of String(s || "").split("\n")) {
      const words = para.trim().split(/\s+/).filter(Boolean);
      let current = "";
      if (!words.length) {
        lines.push("");
        continue;
      }
      for (const word of words) {
        const next = current ? current + " " + word : word;
        if (ctx.measureText(next).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else current = next;
      }
      if (current) lines.push(current);
    }
    if (lines.length > maxLines) {
      const visible = lines.slice(0, maxLines);
      let last = visible[maxLines - 1];
      while (last.length > 0 && ctx.measureText(last + "\u2026").width > maxWidth) last = last.slice(0, -1);
      visible[maxLines - 1] = last + "\u2026";
      return visible;
    }
    return lines;
  }
  function block(ctx, s, x, y, w, opt = {}) {
    const size = opt.size || 34, lh = opt.lh || 1.32, weight = opt.weight || 500, typ = opt.family || fontSans, col = opt.color || "#16271E", maxLines = opt.maxLines || 100;
    const lines = breakLines(ctx, s, w, size, weight, typ, maxLines);
    lines.forEach((l, i) => text(ctx, l, x, y + i * size * lh, size, col, weight, typ, opt.align || "left"));
    return y + lines.length * size * lh;
  }
  function headline(ctx, s, x, y, w, lim, theme, size = 88, typ = fontSans, weight = 700) {
    let fs = size;
    let lines = [];
    do {
      font(ctx, weight, fs, typ);
      lines = breakLines(ctx, s, w, fs, weight, typ, 9);
      if (lines.length * fs * 1.1 <= lim) break;
      fs -= 2;
    } while (fs > 36);
    lines.forEach((l, i) => text(ctx, l, x, y + i * fs * 1.11, fs, theme.ink, weight, typ));
    return y + lines.length * fs * 1.11;
  }
  function mono(ctx, s, x, y, size, color, weight = 500) {
    text(ctx, String(s).toUpperCase(), x, y, size, color, weight, fontMono);
  }
  function cropped(ctx, image, x, y, w, h, fit = "cover", position = 50) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const ir = image.width / image.height, rr = w / h;
    let dw, dh;
    if (fit === "contain") {
      if (ir > rr) {
        dw = w;
        dh = w / ir;
      } else {
        dh = h;
        dw = h * ir;
      }
    } else {
      if (ir > rr) {
        dh = h;
        dw = h * ir;
      } else {
        dw = w;
        dh = w / ir;
      }
    }
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) * (position / 100), dw, dh);
    ctx.restore();
  }
  function drawLogo(ctx, s, y, width = 280) {
    if (!s.showLogo) return;
    const key = s.theme === "dark" ? "dark" : "light", im = rendererAssets.getLogo(key);
    if (im) ctx.drawImage(im, 64, y, width, width * 144 / 710);
    else mono(ctx, "> runtime garden", 68, y + 14, 30, palette(s).ink);
  }
  function drawMark(ctx, s, x, y, size = 80) {
    const key = s.theme === "dark" ? "markDark" : "mark", im = rendererAssets.getLogo(key);
    if (im) ctx.drawImage(im, x, y, size, size);
  }
  function pattern(ctx, s, t, H) {
    if (s.pattern === "none") return;
    ctx.save();
    ctx.globalAlpha = s.pattern === "grid" ? 0.42 : 0.3;
    ctx.strokeStyle = t.border;
    ctx.fillStyle = t.border;
    if (s.pattern === "dots") {
      for (let x = 650; x < 1030; x += 27) for (let y = 230; y < Math.min(H - 170, 910); y += 27) {
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, 2 * Math.PI);
        ctx.fill();
      }
    } else {
      for (let x = 660; x < 1040; x += 56) line(ctx, t.border, x, 230, x, Math.min(H - 170, 920));
      for (let y = 230; y < Math.min(H - 170, 920); y += 56) line(ctx, t.border, 660, y, 1040, y);
    }
    ctx.restore();
  }
  function commonTop(ctx, s, i, total, H, t) {
    const base = s.theme === "dark" ? t.bg : t.bg;
    fill(ctx, base, 0, 0, 1080, H);
    if (s.id === "minimal") return;
    line(ctx, t.border, 64, 151, 1016, 151, 1.8);
    drawLogo(ctx, s, 66, 286);
    mono(ctx, s.kicker || "RUNTIME GARDEN", 64, 189, 17, t.accent, 600);
    if (s.numbering) text(ctx, `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 1016, 189, 16, t.muted, 500, fontMono, "right");
  }
  function commonBottom(ctx, s, H, t) {
    const y = H - 125;
    line(ctx, t.border, 64, y, 1016, y, 1.8);
    mono(ctx, s.customFooter || s.label || "WHERE IDEAS GROW INTO SYSTEMS", 64, y + 26, 14, t.muted, 500);
    if (s.showDomain) text(ctx, "RUNTIMEGARDEN.COM", 1016, y + 26, 14, t.accent, 600, fontMono, "right");
  }
  function pill(ctx, s, x, y, txt, t, opt = {}) {
    if (!txt || !s.showTag) return 0;
    const sz = opt.size || 16, padding = opt.padding || 16;
    font(ctx, 600, sz, fontMono);
    const w = clamp(ctx.measureText(String(txt).toUpperCase()).width + padding * 2, 90, 890);
    roundRect(ctx, x, y, w, sz + padding * 1.2, 8, opt.bg || t.accentSoft, opt.border || null);
    mono(ctx, String(txt).slice(0, 80), x + padding, y + padding * 0.55, sz, t.accent, 600);
    return w;
  }
  function drawLink(ctx, s, x, y, t) {
    if (s.detail) mono(ctx, String(s.detail).slice(0, 90), x, y, 17, t.accent, 600);
  }
  function drawList(ctx, items, x, y, w, t, { size = 30, numbered = false, limit = 6, space = 70 } = {}) {
    const arr = String(items || "").split("\n").filter(Boolean).slice(0, limit);
    arr.forEach((a, i) => {
      const yy = y + i * space;
      roundRect(ctx, x, yy - 5, numbered ? 44 : 22, numbered ? 44 : 22, numbered ? 9 : 11, t.accentSoft);
      if (numbered) mono(ctx, String(i + 1).padStart(2, "0"), x + 8, yy + 8, 16, t.accent, 600);
      else fill(ctx, t.accent, x + 8, yy + 3, 6, 6);
      block(ctx, a, x + (numbered ? 63 : 40), yy, w - (numbered ? 63 : 40), { size, color: t.ink, weight: 550, maxLines: 2 });
    });
    return arr.length * space;
  }
  var EXTRA_LAYOUT_IDS = /* @__PURE__ */ new Set(["chapter", "thesis", "stat", "timeline", "layers", "spotlight", "beforeafter", "method", "findings", "questions", "tradeoffs", "dosdonts", "faq", "terminal", "resources", "release", "roadmap", "closing", "digest", "principle", "diagram", "myth", "hero", "insight"]);
  function seriesMotif(ctx, s, index, total, H, t) {
    if (!s.series || s.series === "none") return;
    const family = SERIES_PACKS.find((p) => p.id === s.series);
    if (!family) return;
    ctx.save();
    fill(ctx, t.accent, 0, 0, 12, H);
    for (let i = 0; i < total; i++) {
      const x = 64 + i * (952 / Math.max(1, total));
      fill(ctx, i <= index ? t.accent : t.border, x, H - 12, Math.max(6, 952 / Math.max(1, total) - 7), 5);
    }
    mono(ctx, family.name + " / " + (index === 0 ? "OPENING" : index === total - 1 ? "CLOSING" : "FIELD " + String(index + 1).padStart(2, "0")), 64, 20, 12, t.accent, 600);
    if (["labbook", "system", "terminal", "research", "observatory"].includes(s.series)) {
      for (let j = 0; j < 4; j++) line(ctx, t.border, 1033, 280 + j * 35, 1050, 280 + j * 35, 2);
    }
    if (["manifesto", "field", "open", "guide", "community"].includes(s.series)) {
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(1035, 330, 31, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  function renderExtraLayout(ctx, s, t, { safeTop, lower, room, title, subtitle, cap, primary }) {
    const x = 64, w = 952, ty = safeTop + 14, items = String(s.bullets || "").split("\n").filter(Boolean);
    if (room < 760) {
      const y = headline(ctx, s.title, x, ty, 945, 250, t, clamp(67 * (s.scale || 1), 46, 70), ["principle", "thesis"].includes(s.id) ? fontSerif : fontSans, 650);
      if (s.showSubtitle) block(ctx, s.subtitle, x, y + 18, 925, { size: 23, color: t.muted, maxLines: 2, lh: 1.3 });
      const panelTop = Math.max(ty + 295, lower - 308);
      roundRect(ctx, x, panelTop, 952, 233, 13, t.surface, t.border);
      fill(ctx, t.accent, x, panelTop, 8, 233);
      if (s.id === "terminal") {
        String(s.code || "").split("\n").slice(0, 4).forEach((v, i) => block(ctx, "$ " + v, x + 27, panelTop + 20 + i * 51, 887, { size: 18, color: t.ink, family: fontMono, maxLines: 1 }));
      } else if (items.length) {
        items.slice(0, 3).forEach((v, i) => {
          mono(ctx, String(i + 1).padStart(2, "0"), x + 28, panelTop + 19 + i * 67, 19, t.accent);
          block(ctx, v.split("|").join(" / "), x + 90, panelTop + 18 + i * 67, 810, { size: 21, color: t.ink, maxLines: 2 });
        });
      } else {
        mono(ctx, s.tag || "RUNTIME GARDEN", x + 27, panelTop + 32, 22, t.accent);
        drawMark(ctx, s, 800, panelTop + 50, 105);
        block(ctx, s.detail || "", x + 29, panelTop + 105, 715, { size: 24, color: t.ink, maxLines: 2 });
      }
      return;
    }
    const normal = (max = 275, sz = 81) => {
      const y = title(x, ty, w, max, sz);
      subtitle(x, y + 20, 890, 3);
      return y;
    };
    const card = (cx, cy, cw, ch, strip = false) => {
      roundRect(ctx, cx, cy, cw, ch, 13, t.surface, t.border);
      if (strip) fill(ctx, t.accent, cx, cy, 6, ch);
    };
    const detail = () => mono(ctx, s.detail || "", x, lower - 42, 16, t.accent);
    if (["chapter", "thesis", "principle", "hero", "closing"].includes(s.id)) {
      if (s.id === "chapter") {
        mono(ctx, "\u2014  " + (s.detail || "A NEW CHAPTER"), x, ty + 24, 21, t.accent);
        text(ctx, String(s.chapterNumber || 1).padStart(2, "0"), 746, ty + 104, 205, t.accentSoft, 700, fontMono);
        line(ctx, t.accent, x, ty + 107, 310, ty + 107, 5);
        const y = title(x, ty + 174, 920, room * 0.57, 105);
        subtitle(x, y + 29, 840, 4);
      } else if (s.id === "closing") {
        drawMark(ctx, s, 766, ty + 10, 160);
        line(ctx, t.accent, x, ty + 155, 1016, ty + 155, 4);
        const y = title(x, ty + 195, 910, room * 0.53, 103);
        subtitle(x, y + 35, 830, 4);
      } else if (s.id === "hero") {
        card(x, ty + 10, w, clamp(room * 0.2, 95, 165));
        mono(ctx, "ENGINEERING / RESEARCH / SYSTEMS", x + 30, ty + 36, 21, t.accent);
        drawMark(ctx, s, 866, ty + 33, 86);
        const y = title(x, ty + 232, 910, room * 0.5, 100);
        subtitle(x, y + 25, 840, 3);
      } else {
        mono(ctx, s.id === "principle" ? "ENGINEERING PRINCIPLE" : "A FIELD NOTE", x, ty + 30, 20, t.accent);
        line(ctx, t.accent, x, ty + 92, 182, ty + 92, 5);
        const y = headline(ctx, s.title, x, ty + 145, 920, room * 0.58, t, primary(103), fontSerif, 500);
        subtitle(x, y + 50, 860, 4);
      }
      detail();
      return;
    }
    if (s.id === "stat") {
      normal(205, 70);
      const [figure, figLabel] = String(items[0] || "\u2014|REPLACE WITH VERIFIED DATA").split("|");
      mono(ctx, figure, x + 12, lower - 380, 148, t.accent, 600);
      line(ctx, t.border, x, lower - 170, 1016, lower - 170, 3);
      block(ctx, figLabel || "", x + 5, lower - 139, 830, { size: 28, color: t.ink, maxLines: 2 });
      detail();
      return;
    }
    if (s.id === "spotlight") {
      normal(235, 78);
      card(x, lower - 400, 585, 296, true);
      mono(ctx, "THE WORK", x + 30, lower - 364, 18, t.accent);
      drawList(ctx, items, x + 29, lower - 291, 520, t, { size: 23, limit: 3, space: 65 });
      card(675, lower - 400, 339, 296);
      drawMark(ctx, s, 763, lower - 333, 152);
      detail();
      return;
    }
    if (["timeline", "diagram", "layers"].includes(s.id)) {
      normal(220, 77);
      const arr = items.slice(0, 4);
      const y = lower - 340;
      if (s.id === "layers") arr.forEach((v, i) => {
        card(x + i * 13, y + i * 75, w - i * 26, 62, true);
        block(ctx, v, x + 38 + i * 13, y + 19 + i * 75, 760, { size: 23, color: t.ink, weight: 600, maxLines: 1 });
      });
      else arr.forEach((v, i) => {
        const colx = x + i * 242;
        card(colx, y, 224, 240);
        mono(ctx, String(i + 1).padStart(2, "0"), colx + 22, y + 21, 35, t.accent);
        block(ctx, v, colx + 22, y + 101, 180, { size: 22, color: t.ink, weight: 650, maxLines: 3 });
        if (i < arr.length - 1) line(ctx, t.accent, colx + 224, y + 111, colx + 241, y + 111, 3);
      });
      detail();
      return;
    }
    if (["beforeafter", "dosdonts", "myth"].includes(s.id)) {
      normal(235, 78);
      const parts = items.slice(0, 2);
      parts.forEach((entry, i) => {
        const [label, ...points] = entry.split("|"), bx = x + i * 486, y = lower - 425;
        card(bx, y, 466, 326, true);
        mono(ctx, label || `OPTION ${i + 1}`, bx + 26, y + 28, 24, t.accent, 600);
        line(ctx, t.border, bx + 25, y + 81, bx + 440, y + 81);
        points.slice(0, 3).forEach((v, j) => block(ctx, v, bx + 27, y + 105 + j * 66, 400, { size: 22, color: t.ink, maxLines: 2 }));
      });
      detail();
      return;
    }
    if (s.id === "terminal") {
      normal(218, 78);
      const y = lower - 445;
      card(x, y, w, 350);
      fill(ctx, t.soft, x, y, w, 58);
      mono(ctx, "\u25EF   \u25EF   \u25EF     TERMINAL / NOTES", x + 24, y + 17, 17, t.muted);
      String(s.code || "").split("\n").slice(0, 6).forEach((v, i) => block(ctx, "$ " + v, x + 33, y + 92 + i * 44, 876, { size: 23, family: fontMono, color: t.ink, maxLines: 1 }));
      detail();
      return;
    }
    if (s.id === "faq") {
      normal(255, 78);
      card(x, lower - 440, w, 343, true);
      const qa = items.map((v) => v.split("|"));
      qa.slice(0, 2).forEach((pair, i) => {
        mono(ctx, pair[0] || "Q", x + 32, lower - 407 + i * 155, 30, t.accent);
        block(ctx, pair[1] || "", x + 96, lower - 403 + i * 155, 815, { size: i ? 29 : 31, color: t.ink, maxLines: 3 });
        if (!i) line(ctx, t.border, x + 24, lower - 248, 1e3, lower - 248);
      });
      detail();
      return;
    }
    if (["method", "findings", "questions", "tradeoffs", "resources", "release", "roadmap", "digest", "insight"].includes(s.id)) {
      normal(260, 77);
      const arr = items.slice(0, s.id === "insight" ? 3 : 5);
      const ys = lower - (arr.length > 4 ? 437 : 390), space = clamp((lower - ys - 50) / Math.max(1, arr.length), 69, 110);
      arr.forEach((a, i) => {
        const yy = ys + i * space;
        roundRect(ctx, x, yy, 64, 54, 8, t.accentSoft);
        mono(ctx, String(i + 1).padStart(2, "0"), x + 15, yy + 13, 21, t.accent);
        block(ctx, a, x + 94, yy + 9, 820, { size: 26, color: t.ink, weight: 550, maxLines: 2 });
        line(ctx, t.border, x + 91, yy + space - 18, 1016, yy + space - 18);
      });
      detail();
      return;
    }
    normal(270, 79);
    drawList(ctx, items, x, lower - 360, 900, t, { size: 26, limit: 5, space: 70 });
    detail();
  }
  function frame(ctx, s, index, total, { guides = false } = {}) {
    const fmt = getFormat(s);
    const W = fmt.w, H = fmt.h, scale = W / 1080, virtualH = H / scale;
    ctx.canvas.width = W;
    ctx.canvas.height = H;
    ctx.save();
    ctx.scale(scale, scale);
    const t = { ...palette(s) };
    if (s.backgroundMode === "soft") t.bg = t.soft;
    else if (s.backgroundMode === "surface") t.bg = t.surface;
    const safeTop = 260, lower = virtualH - 150, room = Math.max(180, lower - safeTop);
    if (virtualH < 580) {
      fill(ctx, t.bg, 0, 0, 1080, virtualH);
      fill(ctx, t.accent, 0, 0, 13, virtualH);
      line(ctx, t.border, 55, 66, 1025, 66, 1.5);
      drawLogo(ctx, s, 20, 225);
      mono(ctx, s.kicker || "RUNTIME GARDEN", 56, 100, 15, t.accent);
      drawMark(ctx, s, 905, 115, 102);
      headline(ctx, s.title, 56, 140, 795, Math.max(90, virtualH - 210), t, clamp(72 * (s.scale || 1), 43, 75), fontSans, 700);
      line(ctx, t.border, 55, virtualH - 69, 1025, virtualH - 69, 1.5);
      mono(ctx, "WHERE IDEAS GROW INTO SYSTEMS", 56, virtualH - 48, 12, t.muted);
      if (s.showDomain) mono(ctx, "RUNTIMEGARDEN.COM", 819, virtualH - 48, 12, t.accent);
      seriesMotif(ctx, s, index, total, virtualH, t);
      ctx.restore();
      return;
    }
    commonTop(ctx, s, index, total, virtualH, t);
    if (virtualH < 850) {
      const left = 64, top = 240, bodyBottom = virtualH - 143, maxTitleHeight = clamp(virtualH - 380, 150, 360);
      roundRect(ctx, 806, 242, 210, Math.max(114, bodyBottom - 244), 10, t.soft, t.border);
      const visible = rendererAssets.getImage(s.image);
      if (s.id === "image" && visible) {
        cropped(ctx, 809, 245, 204, Math.max(104, bodyBottom - 250), s.imageFit, s.imagePosition);
      } else if (s.id === "code") {
        const lines = String(s.code || "").split("\n").slice(0, 5);
        lines.forEach((v, j) => block(ctx, `$ ${v}`, 822, 263 + j * 39, 175, { size: 13, color: t.ink, family: fontMono, maxLines: 2 }));
      } else if (["checklist", "numbered", "architecture", "lab", "project", "metrics", "changelog", "comparison"].includes(s.id)) {
        const items = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 4);
        items.forEach((v, j) => {
          mono(ctx, String(j + 1).padStart(2, "0"), 822, 261 + j * 48, 14, t.accent);
          block(ctx, v.split("|").join(" / "), 855, 261 + j * 48, 145, { size: 14, color: t.ink, weight: 600, maxLines: 2 });
        });
      } else {
        drawMark(ctx, s, 858, 267, 104);
        line(ctx, t.accent, 838, 390, 979, 390, 3);
        mono(ctx, "FIELD NOTES", 844, 406, 12, t.muted);
      }
      const wideEnd = headline(ctx, s.title, left, top, 705, maxTitleHeight, t, clamp(63 * (s.scale || 1), 42, 75), s.id === "quote" ? fontSerif : fontSans, s.id === "quote" ? 500 : 700);
      if (s.showSubtitle && s.subtitle && wideEnd + 36 < bodyBottom) block(ctx, s.subtitle, left, wideEnd + 13, 696, { size: 18, color: t.muted, lh: 1.3, maxLines: 2 });
      if (guides) {
        ctx.save();
        ctx.setLineDash([9, 8]);
        ctx.strokeStyle = t.warm;
        ctx.strokeRect(64, 65, 952, virtualH - 190);
        ctx.restore();
      }
      commonBottom(ctx, s, virtualH, t);
      seriesMotif(ctx, s, index, total, virtualH, t);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 224, 1080, Math.max(0, virtualH - 364));
    ctx.clip();
    pattern(ctx, s, t, virtualH);
    const primary = (size = 90) => size * (s.scale || 1), secondary = (size = 31) => size * (0.8 + 0.2 * (s.scale || 1));
    const subtitle = (x, y, w, max = 6) => {
      if (s.showSubtitle && s.subtitle) return block(ctx, s.subtitle, x, y, w, { size: secondary(28), color: t.muted, lh: 1.5, maxLines: max });
      return y;
    };
    const title = (x, y, w, limit = room * 0.45, size = 92, typ = fontSans, wt = 700) => headline(ctx, s.title, x, y, w, limit, t, primary(size), typ, wt);
    const cap = (x = 64, y = lower - 60) => pill(ctx, s, x, y, s.tag, t);
    if (EXTRA_LAYOUT_IDS.has(s.id)) {
      renderExtraLayout(ctx, s, t, { safeTop, lower, room, title, subtitle, cap, primary });
    } else if (s.id === "cover") {
      const ty = safeTop + Math.min(90, room * 0.12);
      pill(ctx, s, 64, ty, s.tag, t);
      const after = title(64, ty + 102, 930, Math.min(room * 0.54, 480), 98);
      const subY = Math.max(after + 35, lower - 220);
      subtitle(65, subY, 820, 4);
      drawLink(ctx, s, 66, lower - 34, t);
      line(ctx, t.accent, 64, ty + 77, 165, ty + 77, 5);
    } else if (s.id === "journal") {
      const ty = safeTop + 40;
      mono(ctx, "01 \u2014 DOCUMENT", 64, ty, 18, t.warm);
      const after = title(64, ty + 64, 910, Math.min(455, room * 0.55), 94);
      line(ctx, t.accent, 64, after + 18, 236, after + 18, 4);
      subtitle(64, after + 58, 850, 5);
      cap(64, lower - 66);
      drawLink(ctx, s, 64, lower - 15, t);
    } else if (s.id === "lab") {
      const ty = safeTop + 20;
      pill(ctx, s, 64, ty, s.tag, t);
      const after = title(64, ty + 90, 950, Math.min(280, room * 0.38), 78);
      subtitle(64, after + 22, 880, 3);
      const start = Math.max(after + 130, lower - 365);
      const list = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 4);
      const gap = 17, bw = (950 - gap * (list.length - 1)) / Math.max(1, list.length);
      list.forEach((b, j) => {
        const x = 64 + j * (bw + gap);
        roundRect(ctx, x, start, bw, 145, 12, t.surface, t.border);
        mono(ctx, `0${j + 1}`, x + 20, start + 20, 15, t.accent);
        block(ctx, b, x + 20, start + 64, bw - 30, { size: 20, color: t.ink, weight: 600, maxLines: 2 });
        if (j < list.length - 1) line(ctx, t.accent, x + bw, start + 72, x + bw + gap, start + 72, 2);
      });
      drawLink(ctx, s, 64, lower - 25, t);
    } else if (s.id === "project") {
      const ty = safeTop + 22;
      mono(ctx, "PROJECT / STATUS TRACKER", 64, ty, 16, t.muted);
      const after = title(64, ty + 49, 920, Math.min(290, room * 0.41), 82);
      subtitle(64, after + 26, 850, 3);
      const boxes = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 4);
      const start = Math.max(after + 134, lower - 325);
      boxes.forEach((b, i) => {
        const x = 64 + i % 2 * 484, y = start + Math.floor(i / 2) * 126;
        roundRect(ctx, x, y, 466, 107, 12, t.surface, t.border);
        mono(ctx, `0${i + 1}`, x + 20, y + 18, 16, t.accent);
        block(ctx, b, x + 70, y + 24, 375, { size: 27, color: t.ink, weight: 650, maxLines: 2 });
      });
      drawLink(ctx, s, 64, lower - 26, t);
    } else if (s.id === "code") {
      const ty = safeTop + 8;
      const after = title(64, ty, 950, Math.min(230, room * 0.3), 76);
      subtitle(64, after + 18, 920, 2);
      let y = Math.max(after + 110, lower - 400);
      let height = clamp(lower - y - 35, 220, 425);
      roundRect(ctx, 64, y, 952, height, 14, t.surface, t.border);
      roundRect(ctx, 65, y + 1, 950, 54, 12, t.soft);
      line(ctx, t.border, 65, y + 55, 1015, y + 55);
      [t.accent, t.warm, t.border].forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(90 + i * 24, y + 28, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      mono(ctx, "TERMINAL / SHELL", 720, y + 20, 13, t.muted);
      const codeLines = String(s.code || "").split("\n").slice(0, 9);
      codeLines.forEach((row, j) => {
        const yy = y + 83 + j * 43;
        const size = maxText(ctx, row, 880, 24, 13, 500, fontMono);
        text(ctx, row.startsWith("#") ? row : `$ ${row}`, 90, yy, size, row.startsWith("#") ? t.muted : t.ink, 500, fontMono);
      });
      drawLink(ctx, s, 64, lower - 20, t);
    } else if (s.id === "quote") {
      const ty = safeTop + 15;
      text(ctx, "\u201C", 64, ty - 45, 190, t.accent, 400, fontSerif);
      const after = title(64, ty + 125, 938, Math.min(550, room * 0.65), 94, fontSerif, 500);
      line(ctx, t.accent, 64, after + 25, 160, after + 25, 4);
      subtitle(64, after + 66, 840, 4);
      drawLink(ctx, s, 64, lower - 30, t);
    } else if (s.id === "metrics") {
      const ty = safeTop + 22;
      const after = title(64, ty, 950, Math.min(270, room * 0.36), 83);
      subtitle(64, after + 20, 900, 3);
      const vals = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 3), start = Math.max(after + 140, lower - 330);
      vals.forEach((l, i) => {
        const [value, label] = l.split("|"), x = 64 + i * 323;
        roundRect(ctx, x, start, 305, 210, 12, t.surface, t.border);
        mono(ctx, value || "\u2014", x + 20, start + 30, 62, t.accent, 600);
        line(ctx, t.border, x + 20, start + 114, x + 283, start + 114);
        block(ctx, label || "", x + 20, start + 135, 260, { size: 22, color: t.ink, maxLines: 2, weight: 600 });
      });
      drawLink(ctx, s, 64, lower - 24, t);
    } else if (s.id === "comparison") {
      const ty = safeTop + 15;
      const after = title(64, ty, 920, Math.min(260, room * 0.34), 80);
      subtitle(64, after + 12, 900, 3);
      const content = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 2), start = Math.max(after + 135, lower - 400);
      content.forEach((part, i) => {
        const [name, ...items] = part.split("|"), x = 64 + i * 484;
        roundRect(ctx, x, start, 464, Math.min(340, lower - start - 30), 12, t.surface, t.border);
        fill(ctx, i === 0 ? t.accent : t.ink, x, start, 464, 7);
        block(ctx, name || `Approach ${i + 1}`, x + 24, start + 29, 415, { size: 28, color: t.ink, weight: 700, maxLines: 2 });
        items.slice(0, 4).forEach((b, j) => {
          line(ctx, t.border, x + 22, start + 108 + j * 61, x + 441, start + 108 + j * 61);
          block(ctx, b, x + 24, start + 116 + j * 61, 410, { size: 19, color: t.muted, maxLines: 2 });
        });
      });
      drawLink(ctx, s, 64, lower - 27, t);
    } else if (s.id === "checklist") {
      const ty = safeTop + 10;
      const after = title(64, ty, 900, Math.min(265, room * 0.36), 86);
      subtitle(64, after + 23, 850, 3);
      let y = Math.max(after + 131, lower - 415);
      const items = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 6), spacing = Math.min(82, (lower - y - 25) / Math.max(items.length, 1));
      items.forEach((b, i) => {
        roundRect(ctx, 64, y + i * spacing, 43, 43, 8, t.accentSoft, t.border);
        line(ctx, t.accent, 75, y + i * spacing + 20, 85, y + i * spacing + 30, 3);
        line(ctx, t.accent, 85, y + i * spacing + 30, 97, y + i * spacing + 12, 3);
        block(ctx, b, 132, y + i * spacing + 7, 835, { size: 27, color: t.ink, weight: 550, maxLines: 1 });
        line(ctx, t.border, 132, y + (i + 1) * spacing - 16, 1016, y + (i + 1) * spacing - 16);
      });
      drawLink(ctx, s, 64, lower - 28, t);
    } else if (s.id === "announcement") {
      const ty = safeTop + 24;
      pill(ctx, s, 64, ty, s.tag, t);
      line(ctx, t.accent, 64, ty + 75, 1016, ty + 75, 4);
      const after = title(64, ty + 112, 930, Math.min(450, room * 0.57), 101);
      subtitle(64, after + 45, 860, 5);
      drawMark(ctx, s, 818, Math.min(lower - 240, after + 120), 154);
      drawLink(ctx, s, 64, lower - 28, t);
    } else if (s.id === "changelog") {
      const ty = safeTop + 14;
      const after = title(64, ty, 910, Math.min(255, room * 0.33), 82);
      subtitle(64, after + 15, 920, 3);
      const start = Math.max(after + 129, lower - 395), items = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 5);
      items.forEach((b, i) => {
        const y = start + i * 78;
        roundRect(ctx, 64, y, 90, 54, 8, t.accentSoft);
        mono(ctx, `+ 0${i + 1}`, 78, y + 19, 17, t.accent);
        block(ctx, b, 190, y + 7, 795, { size: 24, color: t.ink, weight: 550, maxLines: 2 });
        line(ctx, t.border, 190, y + 64, 1016, y + 64);
      });
      drawLink(ctx, s, 64, lower - 24, t);
    } else if (s.id === "architecture") {
      const ty = safeTop + 10;
      const after = title(64, ty, 930, Math.min(210, room * 0.3), 76);
      subtitle(64, after + 10, 920, 3);
      const arr = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 4), start = Math.max(after + 155, lower - 355);
      const bw = 205, gap = 40;
      arr.forEach((a, i) => {
        const x = 64 + i * (bw + gap);
        roundRect(ctx, x, start, bw, 183, 12, t.surface, t.border);
        mono(ctx, `0${i + 1} / NODE`, x + 19, start + 21, 13, t.accent);
        block(ctx, a, x + 19, start + 76, bw - 32, { size: 23, color: t.ink, weight: 650, maxLines: 2 });
        if (i < Math.min(3, arr.length - 1)) {
          line(ctx, t.accent, x + bw, start + 90, x + bw + gap - 8, start + 90, 3);
          line(ctx, t.accent, x + bw + gap - 20, start + 82, x + bw + gap - 8, start + 90, 3);
          line(ctx, t.accent, x + bw + gap - 20, start + 98, x + bw + gap - 8, start + 90, 3);
        }
      });
      mono(ctx, "SEPARATE RESPONSIBILITIES. MAKE THE FLOW VISIBLE.", 64, start + 230, 15, t.muted);
      drawLink(ctx, s, 64, lower - 24, t);
    } else if (s.id === "community") {
      const ty = safeTop + 40;
      mono(ctx, "COMMUNITY IS A PRACTICE", 64, ty, 17, t.warm);
      const after = title(64, ty + 64, 950, Math.min(410, room * 0.5), 99);
      subtitle(64, after + 32, 890, 4);
      const y = Math.max(after + 175, lower - 195), items = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 3);
      items.forEach((a, j) => {
        const x = 64 + j * 323;
        roundRect(ctx, x, y, 306, 88, 12, t.surface, t.border);
        block(ctx, a, x + 17, y + 28, 280, { size: 20, color: t.ink, weight: 650, maxLines: 2 });
      });
      drawLink(ctx, s, 64, lower - 25, t);
    } else if (s.id === "minimal") {
      fill(ctx, t.bg, 0, 0, 1080, virtualH);
      drawLogo(ctx, s, 70, 288);
      mono(ctx, s.kicker, 64, 198, 18, t.accent);
      line(ctx, t.accent, 64, 248, 195, 248, 4);
      const after = title(64, 295, 942, Math.min(600, room * 0.69), 104);
      subtitle(64, after + 56, 890, 4);
      line(ctx, t.border, 64, virtualH - 165, 1016, virtualH - 165);
      drawLink(ctx, s, 64, virtualH - 135, t);
    } else if (s.id === "numbered") {
      const ty = safeTop + 11;
      pill(ctx, s, 64, ty, s.tag, t);
      const after = title(64, ty + 85, 900, Math.min(270, room * 0.35), 84);
      subtitle(64, after + 13, 900, 3);
      const items = String(s.bullets || "").split("\n").filter(Boolean).slice(0, 5), start = Math.max(after + 125, lower - 415), spacing = Math.min(91, (lower - start - 20) / Math.max(1, items.length));
      items.forEach((b, i) => {
        const y = start + i * spacing;
        mono(ctx, String(i + 1).padStart(2, "0"), 64, y + 4, 36, t.accent, 600);
        block(ctx, b, 142, y + 7, 864, { size: 27, color: t.ink, weight: 550, maxLines: 1 });
        line(ctx, t.border, 142, y + spacing - 19, 1016, y + spacing - 19);
      });
      drawLink(ctx, s, 64, lower - 26, t);
    } else if (s.id === "image") {
      const ty = safeTop + 11;
      const after = title(64, ty, 940, Math.min(230, room * 0.28), 73);
      subtitle(64, after + 9, 930, 3);
      const y = Math.max(after + 100, lower - 430), h = Math.min(376, Math.max(180, lower - y - 26));
      roundRect(ctx, 64, y, 952, h, 12, t.soft, t.border);
      const im = rendererAssets.getImage(s.image);
      if (im) {
        cropped(ctx, im, 67, y + 3, 946, h - 6, s.imageFit, s.imagePosition);
      } else {
        ctx.save();
        ctx.setLineDash([9, 10]);
        roundRect(ctx, 100, y + 37, 880, h - 74, 10, null, t.border);
        ctx.restore();
        mono(ctx, "ADD REAL SCREENSHOT / SYSTEM DIAGRAM", 145, y + h / 2 - 14, 21, t.muted);
        drawMark(ctx, s, 870, y + h / 2 - 40, 75);
      }
      drawLink(ctx, s, 64, lower - 24, t);
    }
    ctx.restore();
    commonBottom(ctx, s, virtualH, t);
    seriesMotif(ctx, s, index, total, virtualH, t);
    if (guides) {
      ctx.save();
      ctx.setLineDash([13, 11]);
      ctx.strokeStyle = "#AD7742";
      ctx.lineWidth = 2;
      ctx.strokeRect(64, 65, 952, virtualH - 190);
      line(ctx, t.warm, 64, 220, 1016, 220, 1.5);
      ctx.restore();
    }
    ctx.restore();
  }

  // packages/studio-core/src/schema.ts
  var PROJECT_FORMAT = "runtime-garden-social-studio";
  var PROJECT_FORMAT_VERSION = 2;
  var V1_TO_V2_SLIDE_DEFAULTS = {
    series: DEFAULTS.series,
    seriesLabel: DEFAULTS.seriesLabel,
    seriesVariant: DEFAULTS.seriesVariant,
    chapterNumber: DEFAULTS.chapterNumber,
    customWidth: DEFAULTS.customWidth,
    customHeight: DEFAULTS.customHeight
  };
  function migrateProjectV1ToV2(project) {
    const migrated = { seriesPack: "none", ...project };
    if (Array.isArray(project.slides)) {
      migrated.slides = project.slides.map(
        (slide) => slide && typeof slide === "object" && !Array.isArray(slide) ? { ...V1_TO_V2_SLIDE_DEFAULTS, ...slide } : slide
      );
    }
    return migrated;
  }
  function readVersionMarker(parsed) {
    const version = parsed.version;
    if (version === void 0) return "legacy";
    if (version === 1) return 1;
    if (version === 2) return 2;
    throw Error(
      `Unsupported project version: ${String(version)}. Supported versions: 1, 2.`
    );
  }
  function assertFormatMarker(parsed) {
    const marker = parsed.format;
    if (marker === void 0 || marker === PROJECT_FORMAT) return;
    throw Error(
      `Not a Runtime Garden Social Studio project (format marker: "${String(marker).slice(0, 40)}").`
    );
  }
  function normalizeSlide(input) {
    if (!input || typeof input !== "object" || !SAMPLES.some((t) => t.id === input.id)) {
      throw Error("Unknown layout in imported project.");
    }
    const source = input;
    const clean = NEW_SLIDE(source.id);
    for (const k of Object.keys(clean)) {
      if (!Object.hasOwn(source, k)) continue;
      const v = source[k];
      if (typeof clean[k] === "string" && typeof v === "string") {
        clean[k] = v.slice(0, k === "image" ? 65e5 : 15e3);
      } else if (typeof clean[k] === "number" && typeof v === "number" && Number.isFinite(v)) {
        clean[k] = v;
      } else if (typeof clean[k] === "boolean" && typeof v === "boolean") {
        clean[k] = v;
      } else if (k === "image" && (v === null || typeof v === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length < 65e5)) {
        clean[k] = v;
      }
    }
    clean.uid = uid();
    clean.scale = clamp(clean.scale, 0.7, 1.25);
    clean.customWidth = clamp(Math.round(clean.customWidth), 400, 4096);
    clean.customHeight = clamp(Math.round(clean.customHeight), 300, 4096);
    if (!SERIES_PACKS.some((p) => p.id === clean.series)) clean.series = "none";
    clean.imagePosition = clamp(clean.imagePosition, 0, 100);
    return clean;
  }
  function restoreProject(text2) {
    const parsed = JSON.parse(text2);
    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length < 1 || parsed.slides.length > 100) {
      throw Error("Not a valid Social Studio project.");
    }
    assertFormatMarker(parsed);
    const version = readVersionMarker(parsed);
    const migrated = version === 1 ? migrateProjectV1ToV2(parsed) : parsed;
    const slides = migrated.slides.map(normalizeSlide);
    return {
      name: String(migrated.name || "Imported collection").slice(0, 100),
      seriesPack: SERIES_PACKS.some((p) => p.id === migrated.seriesPack) ? migrated.seriesPack : "none",
      selected: clamp(Number(migrated.selected) || 0, 0, slides.length - 1),
      slides
    };
  }
  return __toCommonJS(index_exports);
})();
