// Click-to-enlarge viewer for images in .astro-target pages.
// Wheel / pinch to zoom, drag to pan, double-click to toggle zoom,
// arrows to switch images, Esc to close.
(function () {
  "use strict";

  var images = Array.prototype.slice.call(
    document.querySelectorAll(".astro-target .post-content img")
  );
  if (!images.length) return;

  var MAX_ZOOM = 4; // relative to the image's natural pixel size

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    return e;
  }

  // --- DOM -----------------------------------------------------------------

  var box = el("div", "lb", { role: "dialog", "aria-modal": "true", "aria-label": "Image viewer", hidden: "" });
  var stage = el("div", "lb-stage");
  var view = el("img", "lb-img", { alt: "", draggable: "false" });
  var bar = el("div", "lb-bar");
  var caption = el("span", "lb-caption");
  var zoomLabel = el("span", "lb-zoom");
  var btnOut = el("button", "lb-btn", { type: "button", "aria-label": "Zoom out", title: "Zoom out (-)" });
  var btnFit = el("button", "lb-btn", { type: "button", "aria-label": "Fit to screen", title: "Fit to screen (0)" });
  var btnIn = el("button", "lb-btn", { type: "button", "aria-label": "Zoom in", title: "Zoom in (+)" });
  var btnClose = el("button", "lb-btn", { type: "button", "aria-label": "Close", title: "Close (Esc)" });
  var btnPrev = el("button", "lb-btn lb-nav lb-prev", { type: "button", "aria-label": "Previous image" });
  var btnNext = el("button", "lb-btn lb-nav lb-next", { type: "button", "aria-label": "Next image" });

  btnOut.textContent = "−";
  btnFit.textContent = "fit";
  btnIn.textContent = "+";
  btnClose.textContent = "×";
  btnPrev.textContent = "‹";
  btnNext.textContent = "›";

  var controls = el("div", "lb-controls");
  controls.append(btnOut, zoomLabel, btnIn, btnFit, btnClose);
  bar.append(caption, controls);
  stage.append(view);
  box.append(stage, bar);
  if (images.length > 1) box.append(btnPrev, btnNext);
  document.body.append(box);

  // --- State ---------------------------------------------------------------

  var index = 0;
  var nw = 0, nh = 0;      // natural size of the current image
  var scale = 1, fit = 1;  // current and fit-to-screen scale
  var tx = 0, ty = 0;      // translation of the image's top-left corner
  var lastFocus = null;

  function sw() { return stage.clientWidth; }
  function sh() { return stage.clientHeight; }
  function maxScale() { return Math.max(fit, MAX_ZOOM); }

  function render() {
    view.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    zoomLabel.textContent = Math.round(scale * 100) + "%";
    box.classList.toggle("is-zoomed", scale > fit * 1.001);
  }

  // Keep the image centred when smaller than the stage, otherwise keep
  // its edges from leaving gaps.
  function clamp() {
    var w = nw * scale, h = nh * scale;
    tx = w <= sw() ? (sw() - w) / 2 : Math.min(0, Math.max(sw() - w, tx));
    ty = h <= sh() ? (sh() - h) / 2 : Math.min(0, Math.max(sh() - h, ty));
  }

  function fitToScreen() {
    fit = Math.min(sw() / nw, sh() / nh, 1);
    scale = fit;
    clamp();
    render();
  }

  // Zoom by `factor`, keeping the stage point (cx, cy) fixed.
  function zoomAt(factor, cx, cy) {
    var next = Math.min(maxScale(), Math.max(fit, scale * factor));
    tx = cx - (cx - tx) * (next / scale);
    ty = cy - (cy - ty) * (next / scale);
    scale = next;
    clamp();
    render();
  }

  function zoomCentre(factor) { zoomAt(factor, sw() / 2, sh() / 2); }

  // --- Open / close / navigate ---------------------------------------------

  function show(i) {
    index = (i + images.length) % images.length;
    var src = images[index];
    caption.textContent = src.alt || "";
    view.alt = src.alt || "";
    nw = nh = 0;
    view.style.visibility = "hidden";
    // Runs once per image: a cached image is handled synchronously below,
    // and the later `load` event must not reset the user's zoom.
    view.onload = function () {
      if (nw) return;
      nw = view.naturalWidth;
      nh = view.naturalHeight;
      view.style.width = nw + "px";
      view.style.height = nh + "px";
      fitToScreen();
      view.style.visibility = "";
    };
    view.src = src.currentSrc || src.src;
    if (view.complete && view.naturalWidth) view.onload();
  }

  function open(i) {
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add("lb-open");
    show(i);
    btnClose.focus();
  }

  function close() {
    box.hidden = true;
    document.documentElement.classList.remove("lb-open");
    view.removeAttribute("src");
    if (lastFocus) lastFocus.focus();
  }

  images.forEach(function (img, i) {
    img.classList.add("lb-thumb");
    img.setAttribute("tabindex", "0");
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "Enlarge image" + (img.alt ? ": " + img.alt : ""));
    img.addEventListener("click", function () { open(i); });
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
    });
  });

  btnIn.addEventListener("click", function () { zoomCentre(1.5); });
  btnOut.addEventListener("click", function () { zoomCentre(1 / 1.5); });
  btnFit.addEventListener("click", fitToScreen);
  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", function () { show(index - 1); });
  btnNext.addEventListener("click", function () { show(index + 1); });

  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    switch (e.key) {
      case "Escape": close(); break;
      case "+": case "=": zoomCentre(1.5); break;
      case "-": case "_": zoomCentre(1 / 1.5); break;
      case "0": fitToScreen(); break;
      case "ArrowLeft": if (images.length > 1) show(index - 1); break;
      case "ArrowRight": if (images.length > 1) show(index + 1); break;
      case "Tab": trapFocus(e); return;
      default: return;
    }
    e.preventDefault();
  });

  function trapFocus(e) {
    var f = Array.prototype.filter.call(box.querySelectorAll("button"), function (b) {
      return b.offsetParent !== null;
    });
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  window.addEventListener("resize", function () {
    if (box.hidden || !nw) return;
    var wasFit = scale <= fit * 1.001;
    fit = Math.min(sw() / nw, sh() / nh, 1);
    if (wasFit) fitToScreen(); else { scale = Math.max(scale, fit); clamp(); render(); }
  });

  // --- Wheel zoom ----------------------------------------------------------

  function stagePoint(e) {
    var r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  stage.addEventListener("wheel", function (e) {
    if (!nw) return;
    e.preventDefault();
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines -> px
    var p = stagePoint(e);
    zoomAt(Math.exp(-dy * 0.0015), p.x, p.y);
  }, { passive: false });

  // --- Drag to pan, pinch to zoom ------------------------------------------

  var pointers = new Map();
  var pinchDist = 0, pinchMid = null;
  var moved = 0;

  function pinchState() {
    var p = Array.from(pointers.values());
    return {
      dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
      mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
    };
  }

  stage.addEventListener("pointerdown", function (e) {
    if (!nw) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, stagePoint(e));
    if (pointers.size === 1) moved = 0;
    if (pointers.size === 2) {
      var s = pinchState();
      pinchDist = s.dist;
      pinchMid = s.mid;
    }
    box.classList.add("is-dragging");
  });

  stage.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId)) return;
    var prev = pointers.get(e.pointerId);
    var cur = stagePoint(e);
    pointers.set(e.pointerId, cur);

    if (pointers.size === 1) {
      tx += cur.x - prev.x;
      ty += cur.y - prev.y;
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      clamp();
      render();
    } else if (pointers.size === 2) {
      var s = pinchState();
      tx += s.mid.x - pinchMid.x;
      ty += s.mid.y - pinchMid.y;
      zoomAt(s.dist / pinchDist, s.mid.x, s.mid.y);
      pinchDist = s.dist;
      pinchMid = s.mid;
      moved = Infinity;
    }
  });

  function release(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size === 1) {
      // Lifting one finger of a pinch: carry on panning with the other.
      moved = Infinity;
    }
    if (pointers.size === 0) box.classList.remove("is-dragging");
  }
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  // A click on the backdrop (not a drag, not on the image) closes.
  stage.addEventListener("click", function (e) {
    if (moved > 4) return;
    if (e.target === stage) close();
  });

  // Double-click / double-tap toggles between fit and 2x-ish zoom.
  stage.addEventListener("dblclick", function (e) {
    if (!nw) return;
    var p = stagePoint(e);
    if (scale > fit * 1.001) fitToScreen();
    else zoomAt(Math.min(maxScale(), Math.max(1, fit * 2.5)) / scale, p.x, p.y);
  });
})();
