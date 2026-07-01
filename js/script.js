const API_KEY = "$2a$10$FC02j5gbHIHKA.wnoYQNqegrrC4EBf/gCyx1lR/oBRGi99Bj7aemC";
const BIN_VIDEOS = "6a4171f1da38895dfe0cb6b8";
const BIN_PLAYLIST = "6a41792df5f4af5e293e5e04";
const BIN_PENDING = "6a41792df5f4af5e293e5e04"; // Sincronizado dinámicamente

let videosIglesia = [];
let playlistDomingo = [];
let filtroActual = "";
let descargasPendientes = [];

function setEstado(msg, tipo) {
  const el = document.getElementById("estado-conexion");
  el.innerHTML = msg;

  el.className = "badge rounded-pill px-3 py-2 ";
  if (tipo === "ok")
    el.classList.add("bg-success", "bg-opacity-25", "text-success");
  else if (tipo === "error")
    el.classList.add("bg-danger", "bg-opacity-25", "text-danger");
  else el.classList.add("bg-info", "bg-opacity-25", "text-info");
}

async function fetchBin(binId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      signal: controller.signal,
      headers: { "X-Master-Key": API_KEY },
    });
    clearTimeout(timer);
    const text = await res.text();
    if (!res.ok)
      throw new Error(`HTTP ${res.status} — ${text.substring(0, 200)}`);
    return JSON.parse(text);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError")
      throw new Error("Timeout: JSONBin no respondió en 12 segundos.");
    throw err;
  }
}

function extraerVideos(record) {
  if (record && Array.isArray(record.videos)) return record.videos;
  if (Array.isArray(record)) return record;
  if (record && Array.isArray(record.data)) return record.data;
  return null;
}

async function cargarDatos() {
  setEstado("⏳ Leyendo videos...", "carga");
  const panelDisp = document.getElementById("lista-disponibles");
  panelDisp.innerHTML =
    '<li class="list-group-item text-center text-info">Conectando...</li>';

  try {
    const dataVideos = await fetchBin(BIN_VIDEOS);
    const todos = extraerVideos(dataVideos.record);

    if (!todos) {
      setEstado("⚠️ Error Estructura", "error");
      return;
    }

    videosIglesia = todos.filter(
      (v) =>
        v &&
        v.filename &&
        !v.isFolder &&
        /\.(mp4|mkv|avi|webm|mov)$/i.test(v.filename),
    );

    try {
      const dataPlay = await fetchBin(BIN_PLAYLIST);
      const raw = dataPlay.record;
      const arr = Array.isArray(raw?.playlist)
        ? raw.playlist
        : Array.isArray(raw)
          ? raw
          : [];
      playlistDomingo = arr.filter((x) => x && x !== "inicio");
    } catch (playErr) {
      playlistDomingo = [];
    }

    if (videosIglesia.length === 0) {
      setEstado(`⚠️ Carpeta vacía`, "error");
      return;
    }

    // LINEA MODIFICADA: Ahora pasa el HTML del icono correctamente
    setEstado(
      `<i class="bi bi-check-circle-fill"></i> ${videosIglesia.length} videos`,
      "ok",
    );
    renderizarListas();
  } catch (e) {
    setEstado("❌ Error Red", "error");
  }
}

function filtrar(val) {
  filtroActual = val.toLowerCase().trim();
  renderDisponibles();
}

function renderDisponibles() {
  const container = document.getElementById("lista-disponibles");
  const enLista = new Set(playlistDomingo);
  const lista = filtroActual
    ? videosIglesia.filter((v) => v.name.toLowerCase().includes(filtroActual))
    : videosIglesia;

  document.getElementById("badge-disponibles").textContent = lista.length;

  if (!lista.length) {
    container.innerHTML = `<div class="p-3 text-center text-muted small">Sin resultados</div>`;
    return;
  }
  container.innerHTML = "";
  lista.forEach((video) => {
    const yaEsta = enLista.has(video.filename);
    const li = document.createElement("li");
    li.className = `list-group-item d-flex justify-content-between align-items-center py-2 px-3 ${yaEsta ? "ya-en-lista" : ""}`;

    const fname = video.filename.replace(/'/g, "\\'");
    li.innerHTML = `
          <span class="text-truncate me-2" title="${video.name}">${video.name}</span>
          <button class="btn btn-sm btn-success px-2 py-0" onclick="agregar('${fname}')" ${yaEsta ? 'disabled style="opacity:0.2"' : ""}>＋</button>`;
    container.appendChild(li);
  });
}

function renderDomingo() {
  const container = document.getElementById("lista-domingo");
  document.getElementById("badge-domingo").textContent = playlistDomingo.length;
  if (!playlistDomingo.length) {
    container.innerHTML = `<div class="p-3 text-center text-muted small">Playlist vacía</div>`;
    return;
  }
  container.innerHTML = "";
  playlistDomingo.forEach((filename, i) => {
    const info = videosIglesia.find((v) => v.filename === filename);
    const nombre = info ? info.name : filename;
    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center py-2 px-3";
    li.innerHTML = `
          <span class="text-truncate me-2" title="${nombre}">${i + 1}. ${nombre}</span>
          <div class="d-flex gap-1 flex-shrink-0">
            <button class="btn btn-sm btn-secondary py-0 px-1" onclick="mover(${i},-1)" ${i === 0 ? 'disabled style="opacity:0.3"' : ""}>▲</button>
            <button class="btn btn-sm btn-secondary py-0 px-1" onclick="mover(${i},+1)" ${i === playlistDomingo.length - 1 ? 'disabled style="opacity:0.3"' : ""}>▼</button>
            <button class="btn btn-sm btn-danger py-0 px-2" onclick="quitar(${i})">✕</button>
          </div>`;
    container.appendChild(li);
  });
}

function renderizarListas() {
  renderDisponibles();
  renderDomingo();
}

function agregar(filename) {
  if (!playlistDomingo.includes(filename)) {
    playlistDomingo.push(filename);
    renderizarListas();
  }
}
function quitar(i) {
  playlistDomingo.splice(i, 1);
  renderizarListas();
}

function mover(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= playlistDomingo.length) return;
  [playlistDomingo[i], playlistDomingo[j]] = [
    playlistDomingo[j],
    playlistDomingo[i],
  ];
  renderDomingo();
}

async function guardarPlaylist() {
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_PLAYLIST}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify({
        playlist: playlistDomingo,
        savedAt: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      btn.className = "btn btn-success w-100 py-2 mt-3 fw-bold shadow-sm";
      btn.textContent = "✅ Guardado";
      setTimeout(() => {
        btn.className = "btn btn-primary w-100 py-2 mt-3 fw-bold shadow-sm";
        btn.textContent = "💾 Guardar Playlist";
        btn.disabled = false;
      }, 2500);
    } else {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Playlist";
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "💾 Guardar Playlist";
  }
}

window.onload = cargarDatos;
    // Inicializador al arrancar la vista
    window.addEventListener('DOMContentLoaded', () => {
      cargarDatos();
      cargarDescargasPendientes();
    });
