/**
 * farbfilter — der Verlauf
 *
 * Zwei HSL-Töne (40° auseinander) als linearer Verlauf über die ganze Seite.
 * Der Farbton folgt der X-Position des Zeigers, der Winkel der Bewegungsrichtung.
 * Ohne Eingabe driftet beides langsam weiter, die Sättigung atmet über eine Sinuskurve.
 *
 * Klickverhalten steuert <body data-click="…">:
 *   "invert"   – Darstellung invertieren
 *   "<url>"    – dorthin navigieren
 */
(() => {
    'use strict';

    const LIGHTNESS = 50;
    const HUE_SPREAD = 40;

    const target = { hue: 200, saturation: 60, angle: 90 };
    const shown = { ...target };
    let inverted = false;
    let prevX = 0;
    let prevY = 0;

    const root = document.documentElement;
    const canvas = document.getElementById('dynamic-bg') || document.body;
    const themeMeta = document.getElementById('theme-meta');

    const hslToHex = (h, s, l) => {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    // Ein einziger Schreibvorgang pro Frame — nicht einer pro geänderter Eigenschaft.
    const render = () => {
        const h1 = shown.hue;
        const h2 = (shown.hue + HUE_SPREAD) % 360;
        const c1 = `hsl(${h1}, ${shown.saturation}%, ${LIGHTNESS}%)`;
        const c2 = `hsl(${h2}, ${shown.saturation}%, ${LIGHTNESS}%)`;

        canvas.style.background = `linear-gradient(${shown.angle}deg, ${c1}, ${c2})`;
        // Verhindert helle Ränder beim Überscrollen
        root.style.backgroundColor = c1;
        root.classList.toggle('inverted', inverted);

        if (themeMeta) {
            themeMeta.setAttribute('content', hslToHex(h1, shown.saturation, LIGHTNESS));
        }
    };

    const lerp = (a, b, t) => (1 - t) * a + t * b;

    // Nimmt immer den kürzeren Weg über den 0°/360°-Sprung.
    const lerpAngle = (a, b, t) => {
        const diff = ((b - a + 180) % 360 + 360) % 360 - 180;
        return (a + diff * t + 360) % 360;
    };

    const updateFromCoords = (x, y) => {
        const dx = x - prevX;
        const dy = y - prevY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            // +90, weil 0deg in CSS nach oben zeigt, atan2 aber nach rechts
            target.angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        }
        prevX = x;
        prevY = y;
        target.hue = (x / window.innerWidth) * 360;
    };

    window.addEventListener('mousemove', e => updateFromCoords(e.clientX, e.clientY));
    ['touchstart', 'touchmove'].forEach(type => {
        window.addEventListener(type, e => {
            if (e.touches && e.touches[0]) {
                updateFromCoords(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
    });

    const onClick = document.body.dataset.click;
    if (onClick) {
        document.addEventListener('click', e => {
            if (e.target.closest('a')) return;
            if (onClick === 'invert') {
                inverted = !inverted;
            } else {
                window.location.href = onClick;
            }
        });
    }

    const animate = () => {
        target.hue = (target.hue + 0.05) % 360;
        target.saturation = 60 + Math.sin(performance.now() / 5000) * 10;
        target.angle = (target.angle + 0.1) % 360;

        shown.hue = lerpAngle(shown.hue, target.hue, 0.15);
        shown.saturation = lerp(shown.saturation, target.saturation, 0.15);
        shown.angle = lerpAngle(shown.angle, target.angle, 0.1);

        render();
        requestAnimationFrame(animate);
    };

    animate();
})();
