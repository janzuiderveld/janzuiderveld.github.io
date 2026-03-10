# Safari Animation Optimization Report

Date: March 10, 2026

## Goal

Keep the current visuals and animation language unchanged while making Safari-family animation as smooth as possible, with a practical floor of 24+ visible ASCII redraws per second even under scroll and under weaker CPU conditions.

## Scope

- Desktop Safari-family behavior, tested primarily through Playwright WebKit.
- Focus on the ASCII background animation, route background motion, and custom scrolling.
- No aesthetic changes allowed.

## External Research That Informed The Pass

- Apple: [Web Inspector Tutorial](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/Web_Inspector_Tutorial/EnhancingyourWebpagesPerformance/EnhancingyourWebpagesPerformance.html)
  - Use Timelines/Frames to break down scripting, rendering, and painting cost instead of guessing.
- WebKit: [Introducing the Rendering Frames Timeline](https://webkit.org/blog/5977/introducing-the-rendering-frames-timeline/)
  - Frame analysis should focus on what work lands inside each rendered frame, not just raw callback frequency.
- Apple: [Animating the Canvas](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/HTML-canvas-guide/AddingAnimation/AddingAnimation.html)
  - Apple explicitly calls out profiling animation work in Safari and treats roughly 25fps as a practical minimum for acceptable smoothness.

These sources mattered because the first Safari harness was measuring page `requestAnimationFrame`, which looked healthy while the visible ASCII redraw rate was still too low.

## Test Environment

- Local app URL: `http://localhost:3000/#/`
- Desktop viewport: `1280x720`
- Tall viewport: `900x1600`
- Main repeatable harness: `npm run safari:webkit`
- Real Safari path: `npm run safari:real`
- Safari Technology Preview path: `npm run safari:stp`
- Chromium regression check after Safari changes: `npm run profile:animation`

## Baseline Before This Pass

The original WebKit harness reported about 60fps because it counted page `requestAnimationFrame` callbacks. That turned out to be the wrong metric for this renderer.

Using a targeted Playwright probe against the actual ASCII `<pre>` redraws, the real pre-change Safari-family redraw rate was approximately:

| Scenario | Actual redraw rate before fix |
| --- | --- |
| Home desktop idle | ~20 fps |
| Coffee desktop idle | ~20 fps |
| Camera desktop idle | ~20 fps |
| Home desktop scroll | ~13.7 fps |
| Coffee desktop scroll | ~15.0 fps |
| Camera desktop scroll | ~17.0 fps |

That missed the 24fps goal even though page-level `rAF` looked fine.

## Root Cause

The main problem was not DOM assignment cost and not blob-cache rebuilds.

The main problem was Safari-specific scheduling in `src/components/ascii-art2/hooks/useAnimation.ts`:

1. Safari was throttled with a naive `1000 / 24` gate that snapped to every third `rAF` on a 60Hz browser, which produced about 20fps instead of a true 24fps cadence.
2. While scrolling, the hook also skipped every third eligible redraw again, which pushed visible redraws down into the mid-teens.
3. Safari was also passing through the same generic `FRAME_DURATION` gate used by non-Safari browsers, which limited how far a higher Safari redraw target could scale.

I verified separately that the actual `innerHTML` write cost was already low:

- Home: about `0.65-0.74ms` average write time in WebKit scroll tests
- Coffee: about `0.23ms`
- Camera: about `0.32ms`
- Max observed write time in the final WebKit runs: `2ms`

So the problem was frame pacing, not text assignment throughput.

## Changes Shipped

### 1. Safari frame pacing now uses its own accumulator and frame gate

File:

- `src/components/ascii-art2/hooks/useAnimation.ts`

Change:

- Replaced timestamp snapping with an accumulator-based Safari frame budget.
- Safari now uses that accumulator as its real redraw gate instead of passing through the shared non-Safari `FRAME_DURATION` gate afterward.
- The final Safari target is `60fps`, which gives Safari a full visible redraw on each browser frame in the tested desktop routes.

Result:

- Idle and scroll WebKit redraws moved from about `20fps` or worse to essentially full browser cadence on the tested desktop routes.

### 2. Safari no longer drops an extra full redraw during scroll

File:

- `src/components/ascii-art2/hooks/useAnimation.ts`

Change:

- The existing full-frame skip loop is still kept for non-Safari behavior.
- Safari no longer throws away every third redraw on top of the 24fps pacing limit.

Result:

- Scroll redraws moved from roughly `13-17fps` to about `24fps` across the tested desktop routes.

### 3. The Safari harness now measures visible redraws

File:

- `scripts/safari-webkit-check.mjs`

Change:

- Added an element-level probe on the main ASCII `<pre>` so the script records:
  - `pageFps`: raw page `requestAnimationFrame`
  - `redrawFps`: actual visible ASCII redraw cadence
  - `avgRedrawWriteMs` and `maxRedrawWriteMs`

Result:

- Safari measurements now reflect what the user actually sees.

## What I Tried And What Did Or Did Not Work

| Direction | What I did | Result | Shipped |
| --- | --- | --- | --- |
| Page `rAF` measurement | Used the original WebKit harness output | Misleading. It stayed near 60fps while visible redraws were below target. | No |
| Actual redraw probe | Hooked the `<pre>` `innerHTML` setter and counted redraw cadence | Exposed the real Safari problem immediately. | Yes |
| DOM-write bottleneck hypothesis | Timed `innerHTML` writes directly in WebKit | Not the bottleneck. Writes were already sub-millisecond on average. | No code change |
| Safari frame pacing, phase 1 | Replaced timestamp snapping with an accumulator targeting 24fps | Fixed the redraw floor and proved the issue was scheduler-driven. | Superseded |
| Safari frame pacing, phase 2 | Raised the Safari accumulator target to 30fps | Stable at 30fps even under CPU contention. | Superseded |
| Safari frame pacing, phase 3 | Raised the Safari accumulator target to 60fps while still passing through the generic frame gate | Safari landed around 40fps because the second gate was still active. | Superseded |
| Safari frame pacing, final | Let Safari use its own accumulator gate directly at a 60fps target | Reached full 60fps redraws with no long tasks in the tested desktop routes. | Yes |
| Safari scroll redraw dropping | Removed Safari from the extra full-frame skip path | Fixed the scroll redraw floor and stayed stable at the final 60fps setting. | Yes |
| Scroll stress | Increased synthetic wheel density and delta in WebKit | Final Safari setup still held about 60fps redraws with zero long tasks. | No further change needed |
| CPU-contention stress | Re-ran a scroll probe while eight `yes` workers loaded the CPU | Final Safari setup still held about 60fps redraws with zero long tasks. | No further change needed |
| More aggressive fidelity reductions | Considered further Safari-only chunk/skip degradation | Not needed after fixing scheduling, and would risk visible quality changes during scroll. | No |
| Real Safari WebDriver | Re-ran `npm run safari:real` | Blocked by Safari's manual remote-automation requirement. | No result |
| Safari Technology Preview | Re-ran `npm run safari:stp` | Blocked because STP is not installed on this machine. | No result |
| `xctrace` system tracing | Checked availability | Blocked because full Xcode is not selected; Command Line Tools alone are insufficient. | No result |

## Final WebKit Results

Source artifact:

- `tmp/safari-checks/webkit/summary.json`

### Desktop idle and scroll

| Scenario | Redraw fps | Avg redraw ms | Avg write ms | Long tasks |
| --- | --- | --- | --- | --- |
| Home desktop idle | `60.0` | `16.66` | `0.361` | `0` |
| Home desktop scroll | `60.0` | `16.66` | `0.519` | `0` |
| Coffee desktop idle | `60.0` | `16.67` | `0.149` | `0` |
| Coffee desktop scroll | `60.0` | `16.67` | `0.166` | `0` |
| Camera desktop idle | `60.0` | `16.66` | `0.124` | `0` |
| Camera desktop scroll | `59.8` | `16.72` | `0.133` | `0` |

### Additional stress checks

These were one-off probes beyond the main harness:

- Home desktop aggressive scroll: `60.0fps`, `0` long tasks
- Home desktop scroll under eight background CPU burners: `60.0fps`, `0` long tasks

## Tall / Mobile-Style View

`home-tall-idle` reported `0` visible redraws. That is expected in this repo's current compatibility policy, not a regression from this pass. The app intentionally falls back outside the main desktop-Chromium experience, and Safari-family tall/mobile validation is mostly about the overlay path rather than full ASCII animation throughput.

## Chromium Regression Check

After the Safari-specific scheduling change, I re-ran `npm run profile:animation` to make sure the shared hook did not regress Chromium.

The 4x throttled Chromium harness remained healthy:

- Home idle: `119.2fps`
- Home scroll: `115.9fps`
- Coffee idle: `120.3fps`
- Coffee scroll: `114.7fps`
- Camera idle: `120.2fps`
- Camera scroll: `120.2fps`
- Long tasks: `0` in all scenarios

## Files Changed In This Pass

- `src/components/ascii-art2/hooks/useAnimation.ts`
- `scripts/safari-webkit-check.mjs`
- `SAFARI_TESTING.md`
- `AGENTS.md`

## Remaining Gaps

1. Real Safari.app automation is still blocked until someone manually runs `safaridriver --enable` and allows remote automation in Safari.
2. Safari Technology Preview testing is still blocked until STP is installed.
3. Deep Safari process tracing with `xctrace` is still blocked until full Xcode is installed and selected.

None of those blockers invalidate the current WebKit findings, but they do limit how far this session can go into Safari.app-only tooling.

## Reproduction

```bash
npm run safari:webkit
npm run safari:real
npm run safari:stp
npm run profile:animation
npm run build
```
