# Still design

The supplied brief fixes the visual direction: a quiet, Apple-inspired floating reading window. Use Segoe UI Variable/Segoe UI, a charcoal reading surface, warm white text and a restrained sage accent. Settings use a solid neutral surface so that reading opacity never makes controls illegible.

Reading is the Read surface; editing, navigation and preferences are Operate surfaces. The initial viewport is a compact 480 × 640 utility window, dominated by large script text with a fixed eye-line. The toolbar fades after pointer inactivity, and becomes fully visible on hover or keyboard focus. Moving between blocks remains deliberate and manual. No animation on opening paragraphs; smooth scrolling is the signature interaction, disabled when reduced motion is requested.

Use 12px window corners, 8px control corners, 4/8/12/16/24/32px spacing. Controls have visible focus, actionable errors and text labels or tooltips. SVG line icons share one style. Cues are clearly distinguished by size, style and optional visibility. Keep capture status available in settings and as a compact toolbar indicator, without claiming universal invisibility.

Panels occupy the same window to avoid extra focus changes and to apply the same capture protection. Reading background and text alpha are separate variables. A narrow window remains usable at 340px; forms scroll vertically, and reading controls remain reachable by keyboard.
