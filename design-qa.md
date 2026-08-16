# Design QA

**Evidence**

- Source visual truth: `docs/design/reference.png`
- Browser-rendered implementation: `qa/implementation-desktop.png`
- Source pixels: 1487 × 1058
- Implementation pixels: 1425 × 1013
- CSS viewport: 1440 × 1024
- Device scale factor: 1
- Density normalization: both images are single-density and have the same 1.406 aspect ratio to three decimals. The full page was compared proportionally; no browser chrome or device frame was included.
- State: desktop, dark-blue header, `停電` scenario selected, comparison tab, one completed trial, settings panel visible.

**Full-view comparison evidence**

The source and implementation were opened together in the same comparison input. The implementation preserves the source's navy masthead, pale scenario strip, broad result canvas, right-hand settings rail, compact bordered table, muted explanatory panels, and blue/amber/teal data encoding. The selected scenario, heading hierarchy, two-column proportions, border radii, shadows, and overall vertical density are visibly consistent. The additional comparison/report/sensitivity tabs are an intentional extension required by the multi-trial and report scope.

**Focused region comparison evidence**

No additional crop was needed. At the captured desktop size the scenario cards, chart labels, table, explanatory copy, numeric controls, and primary action are all legible in the full-view comparison, including the region that changed during iteration.

**Findings**

- No actionable P0, P1, or P2 mismatch remains.
- [P3] The source uses large circular media illustrations beside the three chart bars; the implementation uses semantic axis labels and the shared icon library instead. This reduces decorative fidelity but keeps the quantitative chart clearer and avoids fabricating source artwork.
- [P3] The report and sensitivity tabs add product depth beyond the static source. Their visual tokens intentionally reuse the selected design rather than introduce a second style.

**Required fidelity surfaces**

- Fonts and typography: Japanese system sans fallbacks, weight hierarchy, compact labels, line height, and wrapping visually match the source; no truncation was observed.
- Spacing and layout rhythm: frame proportions, section spacing, card padding, border radii, table density, and settings rail alignment match the source closely.
- Colors and visual tokens: navy, pale blue-gray, white, muted border, blue, amber, teal, and warning tones are consistently mapped.
- Image quality and asset fidelity: the retained source image is sharp. The application uses the Phosphor icon package and Recharts; it does not substitute visible source imagery with emoji, handcrafted SVG, CSS drawings, or placeholder assets. The omitted circular chart illustrations are recorded as P3.
- Copy and content: Japanese labels and explanatory hierarchy follow the selected design; the methodology disclaimer, model-v1 consequence, multi-trial report, and sensitivity copy are intentional requested additions.

**Primary interactions tested**

- Scenario selection and custom environment controls
- One-, ten-, and 1,000-trial execution through the Web Worker
- Progress and completed-result rendering
- Comparison, report, and sensitivity tabs
- Cumulative-average chart and report tables
- Mobile layout at 390 × 844 with no page-level horizontal overflow
- JSON/CSV generation is covered by unit tests; the in-app browser did not expose a download event for direct observation, so the operating-system save dialog remains a human-review item

**Console check**

- No browser console errors or warnings were present after desktop and mobile interactions.

**Comparison history**

1. Initial comparison found one P2 issue: the primary run action could fall below the desktop fold in the right settings rail.
2. Fix: made `.run-actions` sticky within the settings rail so execution and progress/cancel controls remain available without losing context.
3. Post-fix evidence: `qa/implementation-desktop.png` shows the run action visible at the bottom of the rail while the full result/table layout remains aligned. The revised source-plus-implementation comparison found no remaining P0/P1/P2 issue.

**Implementation checklist**

- [x] Preserve the selected visual hierarchy and palette.
- [x] Keep the core action visible on desktop and responsive layouts.
- [x] Verify the core simulator, report, and sensitivity interactions.
- [x] Verify browser console and responsive overflow.
- [ ] Human reviewer confirms the native JSON/CSV save flow in their browser before publication.

final result: passed
