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

    // Tempo, mit dem der Kreis bei Bewegung in den Hintergrund zurückschmilzt,
    // und die Ruhezeit, nach der er einfriert und wieder aufzutauchen beginnt.
    const RESYNC_RATE = 0.5;
    const STILL_MS = 400;
    // Restabstand zwischen shown und target, ab dem der Hintergrund als
    // ausgelaufen gilt. Muss über dem bleibenden Nachlauf liegen, den das
    // Lerp gegenüber der stetigen Drift behält (rund 0,3° bzw. 0,9°).
    const SETTLED_DEG = 2;

    const target = { hue: 200, saturation: 60, angle: 90 };
    const shown = { ...target };
    // Stand des Kreises. Bleibt im Stillstand stehen, während shown weiterdriftet —
    // erst dadurch wird er überhaupt sichtbar.
    const orbState = { ...target };
    // -Infinity: beim Laden liegt die letzte Bewegung unendlich lange zurück, der
    // Kreis ist also sofort eingefroren und taucht auch ohne Mausbewegung auf.
    let lastMove = -Infinity;
    let frozen = false;
    let inverted = false;
    let prevX = 0;
    let prevY = 0;

    const root = document.documentElement;
    const canvas = document.getElementById('dynamic-bg') || document.body;
    const orb = document.getElementById('orb');
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

    const gradientOf = s => {
        const c1 = `hsl(${s.hue}, ${s.saturation}%, ${LIGHTNESS}%)`;
        const c2 = `hsl(${(s.hue + HUE_SPREAD) % 360}, ${s.saturation}%, ${LIGHTNESS}%)`;
        return `linear-gradient(${s.angle}deg, ${c1}, ${c2})`;
    };

    // Ein einziger Schreibvorgang pro Frame — nicht einer pro geänderter Eigenschaft.
    const render = () => {
        canvas.style.background = gradientOf(shown);
        // Verhindert helle Ränder beim Überscrollen
        root.style.backgroundColor = `hsl(${shown.hue}, ${shown.saturation}%, ${LIGHTNESS}%)`;
        root.classList.toggle('inverted', inverted);

        if (orb) {
            orb.style.background = gradientOf(orbState);
        }

        if (themeMeta) {
            themeMeta.setAttribute('content', hslToHex(shown.hue, shown.saturation, LIGHTNESS));
        }
    };

    const lerp = (a, b, t) => (1 - t) * a + t * b;

    // Kürzester Weg von a nach b über den 0°/360°-Sprung, vorzeichenbehaftet.
    const angleDelta = (a, b) => ((b - a + 180) % 360 + 360) % 360 - 180;

    const lerpAngle = (a, b, t) => (a + angleDelta(a, b) * t + 360) % 360;

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
        lastMove = performance.now();
        frozen = false;
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
        const now = performance.now();

        target.hue = (target.hue + 0.05) % 360;
        target.saturation = 60 + Math.sin(now / 5000) * 10;
        target.angle = (target.angle + 0.1) % 360;

        shown.hue = lerpAngle(shown.hue, target.hue, 0.15);
        shown.saturation = lerp(shown.saturation, target.saturation, 0.15);
        shown.angle = lerpAngle(shown.angle, target.angle, 0.1);

        // Solange die Maus bewegt wird, schmilzt der Kreis in den Hintergrund
        // zurück und verschwindet. Nach STILL_MS Ruhe wird er exakt auf den
        // Hintergrund gesetzt und friert ein — ab da driftet nur noch der
        // Hintergrund, und der Kreis schält sich von null an wieder heraus.
        // Nicht nur die Maus muss stehen — der Hintergrund muss die letzte
        // Mausposition auch eingeholt haben. Friert der Kreis vorher ein, läuft
        // ihm der Hintergrund sofort davon und er springt sichtbar auf.
        const ausgelaufen = Math.abs(angleDelta(shown.hue, target.hue)) < SETTLED_DEG
            && Math.abs(angleDelta(shown.angle, target.angle)) < SETTLED_DEG;
        const stillstand = now - lastMove > STILL_MS && ausgelaufen;

        if (!stillstand) {
            orbState.hue = lerpAngle(orbState.hue, shown.hue, RESYNC_RATE);
            orbState.saturation = lerp(orbState.saturation, shown.saturation, RESYNC_RATE);
            orbState.angle = lerpAngle(orbState.angle, shown.angle, RESYNC_RATE);
        } else if (!frozen) {
            orbState.hue = shown.hue;
            orbState.saturation = shown.saturation;
            orbState.angle = shown.angle;
            frozen = true;
        }

        render();
        requestAnimationFrame(animate);
    };

    animate();
})();
