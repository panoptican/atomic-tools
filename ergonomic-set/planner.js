(function () {
  const MM_PER_IN = 25.4;
  const STORAGE_KEY = "ergonomic-set-units";
  const SOURCE = {
    oshaChair: "OSHA purchasing guide: chair seat height 15-22 in",
    oshaPosture: "OSHA neutral posture: elbows 90-120 deg, forearms roughly parallel, feet supported",
    deskHeight: "OSHA purchasing guide: keyboard height 22-30 in seated, 36-46.5 in standing",
    inputHeight: "HFES draft: seated input surface 21.8-29.1 in; standing 36.0-46.3 in",
    inputTilt: "HFES draft: seated input support tilt includes -15 to +20 deg",
    monitorDistance: "OSHA/HFES: display 20-40 in (500-1000 mm) from eyes",
    monitorAngle: "OSHA: monitor center 15-20 deg below eye; HFES multifocal 15-40 deg",
    monitorMulti: "OSHA/HFES: secondary displays within 35 deg side angle and equal eye distance",
    monitorTilt: "HFES draft: display tilt capability +10 to -35 deg; surface perpendicular to gaze",
    pointer: "OSHA pointer/mouse: keep close to keyboard and maintain neutral wrist",
    lighting: "OSHA lighting/glare: display at right angles to windows; task light not reflected on screen",
    clearance: "OSHA work space: monitor at least 20 in away; desk depth must support viewing angle"
  };

  const els = {};
  let currentUnit = localStorage.getItem(STORAGE_KEY) || "imperial";

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    setInitialUnits();
    bindEvents();
    syncDisplayInputs();
    update();
  });

  function cacheElements() {
    [
      "plannerForm", "inputPanel", "height", "vision", "viewingDistance", "pointingSide",
      "poplitealHeight", "seatedEyeHeight", "seatedElbowHeight", "standingElbowHeight", "forearmReach",
      "naturalLight", "wallClearance", "deskDepth", "deskType", "fixedDeskHeight", "keyboardTray",
      "chairAdjustable", "armrests", "lumbarAdjustable", "displaySetup", "externalCount",
      "externalCountField", "laptopSize", "keyboardType", "tentAngle", "keyboardWidth",
      "keyboardDepth", "pointerWidth", "pointerDepth", "sideDiagram", "planDiagram",
      "measurementsBody", "conflictsSection", "conflictsList", "lightingNote", "status"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    document.querySelectorAll("input, select").forEach((control) => {
      control.addEventListener("input", update);
      control.addEventListener("change", update);
    });

    document.querySelectorAll('input[name="units"]').forEach((radio) => {
      radio.addEventListener("change", (event) => {
        const nextUnit = event.target.value;
        if (nextUnit !== currentUnit) {
          convertLengthInputs(currentUnit, nextUnit);
          currentUnit = nextUnit;
          localStorage.setItem(STORAGE_KEY, currentUnit);
          updateUnitLabels();
          update();
        }
      });
    });

    els.plannerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      els.inputPanel.open = false;
      els.status.textContent = "Plan generated. Inputs remain live if reopened.";
      update();
    });

    els.displaySetup.addEventListener("change", () => {
      if (els.displaySetup.value === "ultrawide") {
        document.getElementById("monitor1Aspect").value = "21:9";
      }
      syncDisplayInputs();
      update();
    });
  }

  function setInitialUnits() {
    document.querySelector(`input[name="units"][value="${currentUnit}"]`).checked = true;
    if (currentUnit === "metric") {
      convertLengthInputs("imperial", "metric");
    }
    updateUnitLabels();
  }

  function convertLengthInputs(fromUnit, toUnit) {
    document.querySelectorAll("[data-length-input]").forEach((input) => {
      if (input.value === "") return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      const mm = fromUnit === "imperial" ? value * MM_PER_IN : value * 10;
      input.value = toUnit === "imperial" ? trimNumber(mm / MM_PER_IN, 2) : trimNumber(mm / 10, 1);
    });
  }

  function updateUnitLabels() {
    document.querySelectorAll("[data-unit-label]").forEach((label) => {
      label.textContent = currentUnit === "imperial" ? "in" : "cm";
    });
  }

  function syncDisplayInputs() {
    const mode = els.displaySetup.value;
    const count = externalCountForMode(mode);
    els.externalCountField.classList.toggle("is-hidden", mode !== "laptop-external");
    document.querySelectorAll("[data-monitor-card]").forEach((card, index) => {
      card.hidden = index >= count;
    });
  }

  function update() {
    if (!els.height) return;
    syncDisplayInputs();
    const state = collectState();
    const plan = calculatePlan(state);
    renderSideDiagram(plan);
    renderPlanDiagram(plan);
    renderMeasurements(plan.rows);
    renderConflicts(plan.conflicts);
    els.lightingNote.textContent = plan.lightingNote;
  }

  function collectState() {
    return {
      unit: currentUnit,
      height: readLength("height"),
      vision: els.vision.value,
      viewingDistance: readOptionalLength("viewingDistance"),
      pointingSide: els.pointingSide.value,
      poplitealHeight: readOptionalLength("poplitealHeight"),
      seatedEyeHeight: readOptionalLength("seatedEyeHeight"),
      seatedElbowHeight: readOptionalLength("seatedElbowHeight"),
      standingElbowHeight: readOptionalLength("standingElbowHeight"),
      forearmReach: readOptionalLength("forearmReach"),
      naturalLight: els.naturalLight.value,
      wallClearance: readLength("wallClearance"),
      deskDepth: readLength("deskDepth"),
      deskType: els.deskType.value,
      fixedDeskHeight: readLength("fixedDeskHeight"),
      keyboardTray: els.keyboardTray.checked,
      chairAdjustable: els.chairAdjustable.checked,
      armrests: els.armrests.value,
      lumbarAdjustable: els.lumbarAdjustable.checked,
      displaySetup: els.displaySetup.value,
      externalCount: Number(els.externalCount.value),
      laptopSize: readNumber("laptopSize", 14),
      keyboardType: els.keyboardType.value,
      tentAngle: readNumber("tentAngle", 10),
      keyboardWidth: readLength("keyboardWidth"),
      keyboardDepth: readLength("keyboardDepth"),
      pointerWidth: readLength("pointerWidth"),
      pointerDepth: readLength("pointerDepth"),
      pointingDevices: Array.from(document.querySelectorAll(".pointing-device:checked")).map((input) => input.value),
      monitors: [1, 2, 3].map((n) => ({
        size: readNumber(`monitor${n}Size`, 27),
        aspect: document.getElementById(`monitor${n}Aspect`).value,
        arm: document.getElementById(`monitor${n}Arm`).checked,
        standDepth: readLength(`monitor${n}StandDepth`)
      }))
    };
  }

  function calculatePlan(state) {
    const conflicts = [];
    const rows = [];
    const direct = makeBodyMeasurements(state);
    const displays = makeDisplays(state);
    const primary = displays.find((display) => display.primary) || displays[0];
    const sourceLabel = (code) => `<span class="source-chip">${code}</span>`;

    const seatHeight = direct.popliteal.value;
    const seatedDeskHeight = direct.seatedElbow.value;
    const standingDeskHeight = direct.standingElbow.value;
    const keyboardDistance = clamp(direct.forearmReach.value * 0.18, 50, 120);
    const keyboardTilt = recommendedKeyboardTilt(state);
    const keyboardPlane = seatedDeskHeight;
    const displayDistance = recommendedViewingDistance(state, primary, conflicts);
    const gazeAngle = recommendedGazeAngle(state, displays.length);
    const displayCenterHeight = direct.seatedEye.value - Math.tan(rad(gazeAngle)) * displayDistance;
    const displayTopRelative = displayCenterHeight + primary.height / 2 - direct.seatedEye.value;
    const displayTilt = clamp(-gazeAngle, -35, 10);
    const workSurfaceHeight = state.deskType === "fixed" ? state.fixedDeskHeight : keyboardPlane;
    const pointerOffset = pointerOffsetFor(state);
    const arc = monitorArc(displays, displayDistance);
    const depthCheck = availableViewingDepth(state, primary);
    const light = taskLightPlacement(state);

    addBodySourceConflicts(state, direct, conflicts);
    addDeskConflicts(state, seatedDeskHeight, standingDeskHeight, conflicts);
    addDisplayConflicts(state, primary, displays, displayCenterHeight, displayTopRelative, displayDistance, depthCheck, arc, workSurfaceHeight, conflicts);
    addPointerConflict(state, conflicts);

    rows.push(row(
      "Seat pan height",
      `${fmtLength(seatHeight)} ${sourceLabel("OSHA")}`,
      SOURCE.oshaChair,
      `${direct.popliteal.note}. Set so feet are supported and knees are slightly above the seat.`
    ));

    rows.push(row(
      "Desk / keyboard surface, seated",
      `${fmtLength(seatedDeskHeight)} ${sourceLabel("OSHA/HFES")}`,
      `${SOURCE.oshaPosture}; ${SOURCE.deskHeight}; ${SOURCE.inputHeight}`,
      `${direct.seatedElbow.note}. Target keeps keyboard near elbow height; use keyboard tray if the desk surface cannot move.`
    ));

    rows.push(row(
      "Standing desk height",
      `${fmtLength(standingDeskHeight)} ${sourceLabel("OSHA/HFES")}`,
      `${SOURCE.deskHeight}; ${SOURCE.inputHeight}`,
      `${direct.standingElbow.note}. Applies only if sit/stand hardware is listed.`
    ));

    rows.push(row(
      "Primary monitor distance",
      `${fmtLength(displayDistance)} ${sourceLabel("OSHA/HFES")}`,
      SOURCE.monitorDistance,
      state.viewingDistance
        ? "User override used; conflict listed if outside the source band."
        : "Heuristic: 1.15 x screen diagonal, clamped to the public distance band."
    ));

    rows.push(row(
      "Primary monitor height",
      `${relativeLength(displayTopRelative)} top of screen vs. seated eye ${sourceLabel("OSHA/HFES")}`,
      SOURCE.monitorAngle,
      `${gazeAngle.toFixed(0)} deg gaze decline to screen center. ${visionNote(state.vision)}`
    ));

    rows.push(row(
      "Primary monitor tilt",
      `${displayTilt.toFixed(0)} deg ${sourceLabel("HFES")}`,
      SOURCE.monitorTilt,
      "Negative means the upper half of the screen tilts away from the user; target is perpendicular to the gaze line."
    ));

    if (arc.secondaryCount > 0) {
      rows.push(row(
        "Secondary / tertiary monitor arc",
        `${arc.maxAngle.toFixed(0)} deg from primary ${sourceLabel("OSHA/HFES")}`,
        SOURCE.monitorMulti,
        "Displays stay on an equal-distance arc from the eye point; heights match by centerline when hardware can adjust."
      ));
    }

    rows.push(row(
      "Keyboard plane",
      `${fmtLength(keyboardPlane)} high, ${fmtLength(keyboardDistance)} from desk edge, ${keyboardTilt.toFixed(0)} deg tilt ${sourceLabel("OSHA/HFES")}`,
      `${SOURCE.oshaPosture}; ${SOURCE.inputTilt}`,
      `${direct.forearmReach.note}. Distance heuristic: 18% of forearm-hand reach, bounded to 2-4.7 in.`
    ));

    rows.push(row(
      "Pointing device offset",
      `${pointerOffset.label} ${sourceLabel("OSHA")}`,
      SOURCE.pointer,
      "Offset uses keyboard footprint plus pointing-device footprint so the device stays adjacent to the keyboard."
    ));

    rows.push(row(
      "Task light position",
      `${light.tableText} ${sourceLabel("OSHA")}`,
      SOURCE.lighting,
      "Computed from natural light direction and the selected pointing side; no unlisted lamp hardware is assumed."
    ));

    return {
      state,
      rows,
      conflicts,
      measurements: direct,
      displays,
      primary,
      seatHeight,
      seatedDeskHeight,
      standingDeskHeight,
      keyboardPlane,
      workSurfaceHeight,
      keyboardDistance,
      keyboardTilt,
      displayDistance,
      gazeAngle,
      displayCenterHeight,
      displayTopRelative,
      displayTilt,
      pointerOffset,
      arc,
      depthCheck,
      light,
      lightingNote: light.note
    };
  }

  function makeBodyMeasurements(state) {
    return {
      popliteal: bodyValue(state.poplitealHeight, state.height * 0.258, "Popliteal height entered", "Heuristic: 25.8% of height"),
      seatedEye: bodyValue(state.seatedEyeHeight, state.height * 0.715, "Seated eye height entered", "Heuristic: 71.5% of height"),
      seatedElbow: bodyValue(state.seatedElbowHeight, state.height * 0.37, "Seated elbow height entered", "Heuristic: 37% of height"),
      standingElbow: bodyValue(state.standingElbowHeight, state.height * 0.63, "Standing elbow height entered", "Heuristic: 63% of height"),
      forearmReach: bodyValue(state.forearmReach, state.height * 0.255, "Forearm-hand reach entered", "Heuristic: 25.5% of height")
    };
  }

  function bodyValue(value, fallback, directNote, heuristicNote) {
    return value ? { value, note: directNote, heuristic: false } : { value: fallback, note: heuristicNote, heuristic: true };
  }

  function makeDisplays(state) {
    const count = externalCountForMode(state.displaySetup);
    const externalDisplays = state.monitors.slice(0, count).map((monitor, index) => {
      const aspect = state.displaySetup === "ultrawide" && index === 0 ? "21:9" : monitor.aspect;
      const geometry = screenGeometry(monitor.size, aspect);
      return {
        type: "external",
        label: count === 1 ? "External display" : `External ${index + 1}`,
        primary: index === 0,
        adjustable: monitor.arm,
        standDepth: monitor.standDepth,
        diagonal: monitor.size * MM_PER_IN,
        ...geometry
      };
    });

    const laptop = {
      type: "laptop",
      label: "Laptop display",
      primary: externalDisplays.length === 0,
      adjustable: false,
      standDepth: 25,
      diagonal: state.laptopSize * MM_PER_IN,
      ...screenGeometry(state.laptopSize, "16:10")
    };

    if (state.displaySetup === "laptop") return [laptop];
    if (state.displaySetup === "laptop-external") return [externalDisplays[0], laptop, ...externalDisplays.slice(1)].filter(Boolean);
    return externalDisplays;
  }

  function screenGeometry(diagonalInches, aspect) {
    const [w, h] = aspect.split(":").map(Number);
    const diagonal = diagonalInches * MM_PER_IN;
    const ratio = Math.sqrt(w * w + h * h);
    return {
      width: diagonal * (w / ratio),
      height: diagonal * (h / ratio),
      aspect
    };
  }

  function externalCountForMode(mode) {
    if (mode === "laptop") return 0;
    if (mode === "laptop-external") return Number(els.externalCount?.value || 1);
    if (mode === "dual") return 2;
    if (mode === "triple") return 3;
    return 1;
  }

  function recommendedViewingDistance(state, primary, conflicts) {
    if (state.viewingDistance) {
      if (state.viewingDistance < 500 || state.viewingDistance > 1000) {
        const nearest = clamp(state.viewingDistance, 500, 1000);
        conflicts.push({
          title: "Viewing distance override outside source band",
          body: `The override is ${fmtLength(state.viewingDistance)}, which is ${fmtLength(Math.abs(state.viewingDistance - nearest))} outside the OSHA/HFES 20-40 in band. The diagram uses the override, but the table flags the source band.`
        });
      }
      return state.viewingDistance;
    }
    return clamp(primary.diagonal * 1.15, 500, 1000);
  }

  function recommendedGazeAngle(state, displayCount) {
    if (state.vision === "progressives" || state.vision === "bifocals") return 25;
    if (displayCount > 1) return 10;
    return 17;
  }

  function recommendedKeyboardTilt(state) {
    if (state.keyboardType === "split-tented") {
      return -clamp(Math.max(5, state.tentAngle / 2), 5, 15);
    }
    return -5;
  }

  function pointerOffsetFor(state) {
    if (state.pointingDevices.length === 0) {
      return { value: 0, side: "none", label: "No pointing device listed" };
    }
    if (state.pointingSide === "ambidextrous" || state.pointingDevices.includes("trackpad")) {
      return { value: 0, side: "center", label: "Centered with keyboard" };
    }
    const value = state.keyboardWidth / 2 + state.pointerWidth / 2 + 25;
    const side = state.pointingSide === "left" ? "left" : "right";
    return { value, side, label: `${fmtLength(value)} ${side} of keyboard centerline` };
  }

  function monitorArc(displays, distance) {
    if (displays.length <= 1) return { secondaryCount: 0, maxAngle: 0, placements: [{ angle: 0 }] };
    const primary = displays[0];
    const gap = 25;
    const placements = displays.map((display, index) => {
      if (index === 0) return { angle: 0 };
      const offset = primary.width / 2 + display.width / 2 + gap;
      const angle = deg(Math.atan(offset / distance));
      const signed = displays.length === 2 ? angle : index === 1 ? -angle : angle;
      return { angle: signed };
    });
    const maxAngle = Math.max(...placements.map((placement) => Math.abs(placement.angle)));
    return { secondaryCount: displays.length - 1, maxAngle, placements };
  }

  function availableViewingDepth(state, primary) {
    const eyeForwardAllowance = 150;
    const available = state.deskDepth + state.wallClearance + eyeForwardAllowance - primary.standDepth;
    return {
      available,
      note: "Heuristic: desk depth + wall clearance + 5.9 in seated eye-forward allowance - display stand depth."
    };
  }

  function taskLightPlacement(state) {
    const sideOppositePointer = state.pointingSide === "left" ? "right" : "left";
    const map = {
      left: "right side of desk",
      right: "left side of desk",
      front: `${sideOppositePointer} rear corner`,
      behind: `${sideOppositePointer} side, shielded from screen`,
      none: `${sideOppositePointer} side of desk`
    };
    const tableText = map[state.naturalLight] || map.none;
    const directionText = state.naturalLight === "none"
      ? "With no natural light source listed, use diffuse task light from the side and keep it out of the monitor reflection path."
      : `Natural light from the ${state.naturalLight} means the display face should stay at right angles to that light where possible.`;
    return {
      tableText,
      note: `${directionText} Place task light at the ${tableText} so it does not reflect on the screen. Use blinds, diffusion, or a shade if glare remains.`
    };
  }

  function addBodySourceConflicts(state, direct, conflicts) {
    if (direct.popliteal.value < 381 || direct.popliteal.value > 559) {
      const nearest = clamp(direct.popliteal.value, 381, 559);
      conflicts.push({
        title: "Seat target outside public chair range",
        body: `Body-derived seat height is ${fmtLength(direct.popliteal.value)}, ${fmtLength(Math.abs(direct.popliteal.value - nearest))} outside OSHA's 15-22 in purchasing band. Option: a different chair size or footrest, labeled here as not currently listed hardware.`
      });
    }

    if (!state.chairAdjustable) {
      conflicts.push({
        title: "Chair height is not adjustable",
        body: `The target seat height is ${fmtLength(direct.popliteal.value)}, but the listed chair is not height-adjustable. Option: use a footrest or alternate chair, not currently listed hardware.`
      });
    }
  }

  function addDeskConflicts(state, seatedDeskHeight, standingDeskHeight, conflicts) {
    if (state.deskType === "fixed") {
      const delta = state.fixedDeskHeight - seatedDeskHeight;
      if (Math.abs(delta) > 13) {
        const direction = delta > 0 ? "above" : "below";
        const remedy = delta > 0
          ? state.keyboardTray
            ? "Use the listed keyboard tray at elbow height; if feet no longer reach the floor, a footrest is an unlisted option."
            : "Option: add a keyboard tray or raise the chair with a footrest; both are not currently listed hardware."
          : "Option: stable desk risers are not currently listed hardware.";
        conflicts.push({
          title: "Fixed desk misses seated keyboard target",
          body: `Fixed surface is ${fmtLength(Math.abs(delta))} ${direction} the seated elbow target (${fmtLength(state.fixedDeskHeight)} vs ${fmtLength(seatedDeskHeight)}). ${remedy}`
        });
      }
    }

    if (state.deskType !== "sitstand") {
      conflicts.push({
        title: "Standing height requires unlisted adjustment",
        body: `Standing keyboard target is ${fmtLength(standingDeskHeight)}, but the listed desk is fixed-height. Option: sit/stand desk or desktop converter, not currently listed hardware.`
      });
    }
  }

  function addDisplayConflicts(state, primary, displays, displayCenterHeight, displayTopRelative, displayDistance, depthCheck, arc, workSurfaceHeight, conflicts) {
    if (displayDistance > depthCheck.available) {
      conflicts.push({
        title: "Desk depth cannot reach target viewing distance",
        body: `Target viewing distance is ${fmtLength(displayDistance)}, but estimated available depth is ${fmtLength(depthCheck.available)} (${depthCheck.note}). Gap: ${fmtLength(displayDistance - depthCheck.available)}. Option: pull the desk farther from the wall or use an adjustable arm, not assumed unless listed.`
      });
    }

    if (displayTopRelative > 13) {
      conflicts.push({
        title: "Monitor top sits above seated eye level",
        body: `Computed top-of-screen position is ${fmtLength(displayTopRelative)} above seated eye level. OSHA's monitor quick tip keeps the top line at or below eye level; option: lower the display, increase distance, or reduce display size without assuming new hardware.`
      });
    }

    if (primary.type === "laptop" && state.displaySetup === "laptop") {
      const laptopCenter = workSurfaceHeight + primary.height * 0.5;
      const delta = displayCenterHeight - laptopCenter;
      conflicts.push({
        title: "Laptop-only setup couples keyboard and screen",
        body: `The target screen center is ${fmtLength(displayCenterHeight)}, while a laptop on the work surface is estimated at ${fmtLength(laptopCenter)}; delta ${fmtLength(Math.abs(delta))}. Option: laptop riser plus external keyboard or an external display, not currently listed hardware.`
      });
    }

    displays.forEach((display) => {
      if (display.type === "external" && !display.adjustable) {
        const fixedCenter = workSurfaceHeight + 120 + display.height / 2;
        const delta = displayCenterHeight - fixedCenter;
        if (Math.abs(delta) > 50) {
          conflicts.push({
            title: `${display.label} height may be unreachable`,
            body: `No adjustable arm is listed. Estimated fixed center is ${fmtLength(fixedCenter)} vs target ${fmtLength(displayCenterHeight)}; delta ${fmtLength(Math.abs(delta))}. Option: monitor riser or adjustable arm, not currently listed hardware.`
          });
        }
      }
    });

    if (arc.maxAngle > 35) {
      conflicts.push({
        title: "Multi-monitor arc exceeds side-angle band",
        body: `Computed side angle is ${arc.maxAngle.toFixed(0)} deg, exceeding the OSHA/HFES 35 deg limit by ${(arc.maxAngle - 35).toFixed(0)} deg. Option: increase viewing distance, reduce display count, or use a tighter curved arm layout; do not assume new hardware.`
      });
    }
  }

  function addPointerConflict(state, conflicts) {
    if (state.pointingDevices.length === 0) {
      conflicts.push({
        title: "No pointing device selected",
        body: "The plan cannot place a pointer without listed hardware. Select at least one pointing device to compute lateral offset."
      });
    }
    if (state.armrests === "fixed") {
      conflicts.push({
        title: "Fixed armrests may block close keyboard placement",
        body: "Fixed armrests can prevent the chair from getting close enough to the keyboard plane. Option: remove armrests or use an adjustable tray if available; otherwise treat this as a fit check."
      });
    }
  }

  function renderMeasurements(rows) {
    els.measurementsBody.innerHTML = rows.map((item) => `
      <tr>
        <td>${item.item}</td>
        <td>${item.recommended}</td>
        <td>${item.source}</td>
        <td>${item.notes}</td>
      </tr>
    `).join("");
  }

  function renderConflicts(conflicts) {
    els.conflictsSection.hidden = conflicts.length === 0;
    els.conflictsList.innerHTML = conflicts.map((conflict) => `
      <article class="conflict-card">
        <h3>${conflict.title}</h3>
        <p>${conflict.body}</p>
      </article>
    `).join("");
  }

  function renderSideDiagram(plan) {
    const width = 600;
    const height = 360;
    const floorY = 320;
    const scale = 0.115;
    const y = (mm) => floorY - mm * scale;
    const eyeX = 160;
    const deskFrontX = 230;
    const deskBackX = 540;
    const deskY = y(plan.workSurfaceHeight);
    const seatY = y(plan.seatHeight);
    const eyeY = y(plan.measurements.seatedEye.value);
    const elbowY = y(plan.measurements.seatedElbow.value);
    const displayCenterX = eyeX + Math.cos(rad(plan.gazeAngle)) * plan.displayDistance * scale;
    const displayCenterY = y(plan.displayCenterHeight);
    const displayHeight = Math.max(40, plan.primary.height * scale);
    const displayWidth = Math.max(8, plan.primary.width * 0.018);
    const keyboardX = deskFrontX + plan.keyboardDistance * scale;
    const keyboardY = deskY - 5;
    const topLabel = relativeLength(plan.displayTopRelative);
    const deskLabel = fmtLength(plan.workSurfaceHeight);
    const seatLabel = fmtLength(plan.seatHeight);
    const monitorLabel = fmtLength(plan.displayDistance);

    els.sideDiagram.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="sideTitle sideDesc">
        <title id="sideTitle">Side elevation desk setup schematic</title>
        <desc id="sideDesc">A seated person, chair, desk, keyboard plane, monitor, gaze line, and labeled ergonomic angles.</desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f5f87"></path>
          </marker>
        </defs>
        <line x1="34" y1="${floorY}" x2="570" y2="${floorY}" stroke="#202829" stroke-width="2"/>
        <text x="38" y="${floorY - 8}" class="svg-label small">floor</text>

        <rect x="95" y="${seatY - 7}" width="100" height="14" fill="#dcefe5" stroke="#247450" stroke-width="2"/>
        <path d="M110 ${seatY - 8} L116 ${y(plan.measurements.seatedEye.value - 350)} L155 ${y(plan.measurements.seatedEye.value - 345)} L150 ${seatY - 8}" fill="none" stroke="#247450" stroke-width="3"/>
        <line x1="112" y1="${seatY + 7}" x2="96" y2="${floorY}" stroke="#247450" stroke-width="3"/>
        <line x1="182" y1="${seatY + 7}" x2="194" y2="${floorY}" stroke="#247450" stroke-width="3"/>
        <text x="82" y="${seatY - 16}" class="svg-label">seat ${seatLabel}</text>

        <circle cx="${eyeX - 3}" cy="${eyeY - 17}" r="17" fill="#fffdf7" stroke="#202829" stroke-width="2"/>
        <circle cx="${eyeX + 3}" cy="${eyeY - 20}" r="2" fill="#202829"/>
        <path d="M${eyeX - 12} ${eyeY} C${eyeX - 8} ${elbowY - 45}, ${eyeX + 8} ${elbowY - 30}, ${eyeX + 4} ${elbowY}" fill="none" stroke="#202829" stroke-width="4" stroke-linecap="round"/>
        <path d="M${eyeX + 4} ${elbowY} L${keyboardX + 8} ${keyboardY}" fill="none" stroke="#202829" stroke-width="4" stroke-linecap="round"/>
        <path d="M${eyeX - 2} ${y(plan.seatHeight + 260)} L${eyeX - 18} ${seatY}" fill="none" stroke="#202829" stroke-width="5" stroke-linecap="round"/>
        <path d="M${eyeX - 18} ${seatY} L${eyeX - 6} ${floorY}" fill="none" stroke="#202829" stroke-width="5" stroke-linecap="round"/>
        <path d="M${eyeX - 10} ${seatY + 4} L${eyeX + 62} ${floorY}" fill="none" stroke="#202829" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${eyeX + 3}" cy="${eyeY - 20}" r="3" fill="#0f5f87"/>
        <text x="${eyeX - 84}" y="${eyeY - 25}" class="svg-label">seated eye</text>

        <line x1="${deskFrontX}" y1="${deskY}" x2="${deskBackX}" y2="${deskY}" stroke="#202829" stroke-width="5"/>
        <line x1="${deskFrontX + 14}" y1="${deskY + 2}" x2="${deskFrontX + 14}" y2="${floorY}" stroke="#202829" stroke-width="3"/>
        <line x1="${deskBackX - 18}" y1="${deskY + 2}" x2="${deskBackX - 18}" y2="${floorY}" stroke="#202829" stroke-width="3"/>
        <text x="${deskFrontX}" y="${deskY - 14}" class="svg-label">desk / key plane ${deskLabel}</text>
        <rect x="${keyboardX}" y="${keyboardY - 6}" width="${Math.max(50, plan.state.keyboardWidth * scale)}" height="9" fill="#f6e5bd" stroke="#9a6500" stroke-width="2" transform="rotate(${plan.keyboardTilt} ${keyboardX} ${keyboardY})"/>
        <text x="${keyboardX}" y="${keyboardY - 18}" class="svg-label small">${fmtLength(plan.keyboardDistance)} from edge, ${plan.keyboardTilt.toFixed(0)} deg</text>

        <line x1="${eyeX + 3}" y1="${eyeY - 20}" x2="${displayCenterX}" y2="${displayCenterY}" stroke="#0f5f87" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arrow)"/>
        <text x="${eyeX + 72}" y="${eyeY - 36}" class="svg-label">${plan.gazeAngle.toFixed(0)} deg gaze decline</text>
        <text x="${eyeX + 70}" y="${eyeY - 17}" class="svg-label small">${monitorLabel} viewing distance</text>

        <g transform="rotate(${plan.displayTilt} ${displayCenterX} ${displayCenterY})">
          <rect x="${displayCenterX - displayWidth / 2}" y="${displayCenterY - displayHeight / 2}" width="${displayWidth}" height="${displayHeight}" fill="#d7edf6" stroke="#0f5f87" stroke-width="3"/>
        </g>
        <line x1="${displayCenterX}" y1="${displayCenterY + displayHeight / 2}" x2="${displayCenterX}" y2="${deskY}" stroke="#0f5f87" stroke-width="2"/>
        <text x="${displayCenterX + 18}" y="${displayCenterY - displayHeight / 2 - 8}" class="svg-label">top ${topLabel} eye</text>
        <text x="${displayCenterX + 18}" y="${displayCenterY + 6}" class="svg-label small">tilt ${plan.displayTilt.toFixed(0)} deg</text>

        <path d="M${keyboardX - 12} ${keyboardY - 25} A36 36 0 0 1 ${keyboardX + 30} ${keyboardY - 18}" fill="none" stroke="#9a6500" stroke-width="2"/>
        <text x="${keyboardX - 20}" y="${keyboardY - 36}" class="svg-label">100 deg elbow</text>
      </svg>
    `;
  }

  function renderPlanDiagram(plan) {
    const width = 600;
    const height = 360;
    const deskX = 55;
    const deskY = 48;
    const deskW = 490;
    const deskH = 240;
    const eyeX = 300;
    const eyeY = 320;
    const scale = Math.min(0.22, 210 / Math.max(plan.state.deskDepth + plan.state.wallClearance + 180, 1));
    const deskDepthPx = plan.state.deskDepth * scale;
    const keyboardW = Math.max(68, plan.state.keyboardWidth * scale);
    const keyboardD = Math.max(24, plan.state.keyboardDepth * scale);
    const keyboardY = deskY + deskDepthPx - plan.keyboardDistance * scale - keyboardD;
    const keyboardX = eyeX - keyboardW / 2;
    const pointerW = Math.max(22, plan.state.pointerWidth * scale);
    const pointerD = Math.max(28, plan.state.pointerDepth * scale);
    const pointerX = plan.pointerOffset.side === "left"
      ? eyeX - plan.pointerOffset.value * scale - pointerW / 2
      : plan.pointerOffset.side === "right"
        ? eyeX + plan.pointerOffset.value * scale - pointerW / 2
        : eyeX - pointerW / 2;
    const pointerY = keyboardY + keyboardD / 2 - pointerD / 2;
    const displayY = eyeY - plan.displayDistance * scale;
    const light = lightPoint(plan.state.naturalLight, plan.light.tableText, deskX, deskY, deskW, deskH);

    const displaySvg = plan.displays.map((display, index) => {
      const placement = plan.arc.placements[index] || { angle: 0 };
      const angle = placement.angle;
      const x = eyeX + Math.sin(rad(angle)) * plan.displayDistance * scale;
      const y = eyeY - Math.cos(rad(angle)) * plan.displayDistance * scale;
      const w = Math.max(44, display.width * scale);
      const d = 14;
      return `
        <g transform="rotate(${angle} ${x} ${y})">
          <rect x="${x - w / 2}" y="${y - d / 2}" width="${w}" height="${d}" fill="#d7edf6" stroke="#0f5f87" stroke-width="2"/>
          <text x="${x - w / 2}" y="${y - 13}" class="svg-label small">${display.label}</text>
        </g>
        <line x1="${eyeX}" y1="${eyeY}" x2="${x}" y2="${y}" stroke="#0f5f87" stroke-width="1.5" stroke-dasharray="5 5"/>
      `;
    }).join("");

    const keyboardSvg = plan.state.keyboardType.startsWith("split")
      ? splitKeyboardSvg(keyboardX, keyboardY, keyboardW, keyboardD, plan.state.keyboardType)
      : `<rect x="${keyboardX}" y="${keyboardY}" width="${keyboardW}" height="${keyboardD}" fill="#f6e5bd" stroke="#9a6500" stroke-width="2"/>`;

    els.planDiagram.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="planTitle planDesc">
        <title id="planTitle">Plan view desk setup schematic</title>
        <desc id="planDesc">Desk seen from above with keyboard, pointer, monitor arc, natural light, and task light placement.</desc>
        <defs>
          <marker id="planArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f5f87"></path>
          </marker>
        </defs>
        <rect x="${deskX}" y="${deskY}" width="${deskW}" height="${deskH}" fill="#fffdf7" stroke="#202829" stroke-width="2"/>
        <line x1="${deskX}" y1="${deskY + deskDepthPx}" x2="${deskX + deskW}" y2="${deskY + deskDepthPx}" stroke="#202829" stroke-width="2"/>
        <text x="${deskX + 10}" y="${deskY + deskDepthPx - 8}" class="svg-label small">desk front</text>

        <path d="M${eyeX - 25} ${eyeY + 12} Q${eyeX} ${eyeY - 20} ${eyeX + 25} ${eyeY + 12}" fill="#fffdf7" stroke="#202829" stroke-width="2"/>
        <circle cx="${eyeX}" cy="${eyeY}" r="4" fill="#0f5f87"/>
        <text x="${eyeX + 12}" y="${eyeY + 5}" class="svg-label small">eye point</text>

        ${keyboardSvg}
        <text x="${keyboardX}" y="${keyboardY - 8}" class="svg-label">keyboard</text>
        <rect x="${pointerX}" y="${pointerY}" width="${pointerW}" height="${pointerD}" rx="5" fill="#dcefe5" stroke="#247450" stroke-width="2"/>
        <text x="${pointerX}" y="${pointerY - 8}" class="svg-label small">pointer</text>

        <path d="M${eyeX - plan.displayDistance * scale * 0.55} ${displayY} A${plan.displayDistance * scale * 0.55} ${plan.displayDistance * scale * 0.55} 0 0 1 ${eyeX + plan.displayDistance * scale * 0.55} ${displayY}" fill="none" stroke="#0f5f87" stroke-width="1.5" stroke-dasharray="4 5"/>
        ${displaySvg}
        <text x="${eyeX + 94}" y="${displayY + 30}" class="svg-label small">equal-distance monitor arc</text>

        <line x1="${light.fromX}" y1="${light.fromY}" x2="${light.toX}" y2="${light.toY}" stroke="#9a6500" stroke-width="3" marker-end="url(#planArrow)"/>
        <circle cx="${light.toX}" cy="${light.toY}" r="9" fill="#f6e5bd" stroke="#9a6500" stroke-width="2"/>
        <text x="${light.toX + 12}" y="${light.toY + 5}" class="svg-label small">task light</text>
        <text x="${light.fromX - 20}" y="${light.fromY - 8}" class="svg-label small">natural light: ${plan.state.naturalLight}</text>

        <text x="${deskX + 10}" y="${deskY + deskH + 32}" class="svg-label">pointer offset: ${plan.pointerOffset.label}</text>
        <text x="${deskX + 10}" y="${deskY + deskH + 50}" class="svg-label small">monitor side angle max: ${plan.arc.maxAngle.toFixed(0)} deg</text>
      </svg>
    `;
  }

  function splitKeyboardSvg(x, y, w, d, type) {
    const gap = 18;
    const half = (w - gap) / 2;
    const rotate = type === "split-tented" ? 6 : 3;
    return `
      <rect x="${x}" y="${y}" width="${half}" height="${d}" fill="#f6e5bd" stroke="#9a6500" stroke-width="2" transform="rotate(${-rotate} ${x + half} ${y + d / 2})"/>
      <rect x="${x + half + gap}" y="${y}" width="${half}" height="${d}" fill="#f6e5bd" stroke="#9a6500" stroke-width="2" transform="rotate(${rotate} ${x + half + gap} ${y + d / 2})"/>
    `;
  }

  function lightPoint(direction, tableText, x, y, w, h) {
    const points = {
      left: { fromX: x - 35, fromY: y + h / 2, toX: x + w - 62, toY: y + h - 58 },
      right: { fromX: x + w + 35, fromY: y + h / 2, toX: x + 62, toY: y + h - 58 },
      front: { fromX: x + w / 2, fromY: y + h + 52, toX: tableText.startsWith("left") ? x + 70 : x + w - 70, toY: y + 58 },
      behind: { fromX: x + w / 2, fromY: y - 36, toX: tableText.startsWith("left") ? x + 70 : x + w - 70, toY: y + h - 58 },
      none: { fromX: x + w + 35, fromY: y + h - 42, toX: x + w - 70, toY: y + h - 58 }
    };
    return points[direction] || points.none;
  }

  function row(item, recommended, source, notes) {
    return { item, recommended, source, notes };
  }

  function readLength(id) {
    const value = readNumber(id, 0);
    return currentUnit === "imperial" ? value * MM_PER_IN : value * 10;
  }

  function readOptionalLength(id) {
    const input = document.getElementById(id);
    if (!input || input.value === "") return null;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) return null;
    return currentUnit === "imperial" ? value * MM_PER_IN : value * 10;
  }

  function readNumber(id, fallback) {
    const input = document.getElementById(id);
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function fmtLength(mm) {
    if (currentUnit === "imperial") {
      return `${trimNumber(mm / MM_PER_IN, 1)} in`;
    }
    return `${trimNumber(mm / 10, 1)} cm`;
  }

  function relativeLength(mm) {
    if (Math.abs(mm) < 2) return "level with";
    const direction = mm > 0 ? "above" : "below";
    return `${fmtLength(Math.abs(mm))} ${direction}`;
  }

  function trimNumber(value, decimals) {
    return Number(value.toFixed(decimals)).toString();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rad(degrees) {
    return degrees * Math.PI / 180;
  }

  function deg(radians) {
    return radians * 180 / Math.PI;
  }

  function visionNote(vision) {
    if (vision === "progressives") return "Progressive lens mode uses the lower multifocal gaze band.";
    if (vision === "bifocals") return "Bifocal mode uses the lower multifocal gaze band.";
    if (vision === "computer") return "Single-vision computer mode uses the standard monitor band.";
    return "No correction mode uses the standard monitor band.";
  }
})();
