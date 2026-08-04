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

    // Dauer, über die sich der Kreis bei Mausbewegung in den Hintergrund auflöst.
    const DISSOLVE_MS = 1200;
    // Ruhezeit, nach der er wieder einfriert und aufzutauchen beginnt.
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
    // Abstand des Kreises zum Hintergrund beim Start der Auflösung, plus deren
    // Fortschritt 0…1. Festgehalten wird bewusst der Abstand und nicht der
    // absolute Stand: sonst springt der Hintergrund bei einer Richtungsänderung
    // weg, der Kreis bleibt stehen — und blitzt kurz auf, statt zu verblassen.
    const orbOffset = { hue: 0, saturation: 0, angle: 0 };
    let dissolve = 1;
    let lastMove = -Infinity;
    // Beim Laden sind beide Stände gleich: sofort eingefroren, der Kreis taucht
    // also auch ohne jede Mausbewegung auf.
    let frozen = true;
    let lastFrame = performance.now();
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

        // Nur der Übergang vom Stillstand startet eine neue Auflösung. Bei
        // laufender Bewegung weiterlaufen lassen, sonst setzt jede Mausbewegung
        // den Fortschritt zurück und der Kreis löst sich nie ganz auf.
        if (frozen) {
            orbOffset.hue = angleDelta(shown.hue, orbState.hue);
            orbOffset.saturation = orbState.saturation - shown.saturation;
            orbOffset.angle = angleDelta(shown.angle, orbState.angle);
            dissolve = 0;
            frozen = false;
        }
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

    // Weich am Anfang und am Ende, damit das Auflösen weder ruckt noch abreißt.
    const smoothstep = t => t * t * (3 - 2 * t);

    const animate = () => {
        const now = performance.now();
        const dt = Math.min(now - lastFrame, 100);
        lastFrame = now;

        target.hue = (target.hue + 0.05) % 360;
        target.saturation = 60 + Math.sin(now / 5000) * 10;
        target.angle = (target.angle + 0.1) % 360;

        shown.hue = lerpAngle(shown.hue, target.hue, 0.15);
        shown.saturation = lerp(shown.saturation, target.saturation, 0.15);
        shown.angle = lerpAngle(shown.angle, target.angle, 0.1);

        if (!frozen) {
            // Der Kreis löst sich über DISSOLVE_MS in den Hintergrund auf. Bei
            // dissolve = 1 ist er deckungsgleich und bleibt daran kleben, solange
            // die Maus in Bewegung ist.
            dissolve = Math.min(1, dissolve + dt / DISSOLVE_MS);
            // Der Kreis hängt am Hintergrund und behält nur noch einen
            // schrumpfenden Rest des ursprünglichen Abstands. Springt der
            // Hintergrund, springt er mit — kein Aufblitzen.
            const rest = 1 - smoothstep(dissolve);
            orbState.hue = (shown.hue + orbOffset.hue * rest + 360) % 360;
            orbState.saturation = shown.saturation + orbOffset.saturation * rest;
            orbState.angle = (shown.angle + orbOffset.angle * rest + 360) % 360;

            // Einfrieren erst, wenn die Auflösung durch ist, die Maus steht UND
            // der Hintergrund die letzte Mausposition eingeholt hat. Friert er
            // vorher ein, läuft ihm der Hintergrund davon und er springt auf,
            // statt von null an aufzutauchen.
            const ausgelaufen = Math.abs(angleDelta(shown.hue, target.hue)) < SETTLED_DEG
                && Math.abs(angleDelta(shown.angle, target.angle)) < SETTLED_DEG;

            if (dissolve === 1 && now - lastMove > STILL_MS && ausgelaufen) {
                frozen = true;
            }
        }

        render();
        requestAnimationFrame(animate);
    };

    animate();
})();
