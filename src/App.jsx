import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import * as QRCodeLib from "qrcode";
import { Html5QrcodeScanner } from "html5-qrcode";

// Componente QR reutilizable
function QRCode({ value, onReady }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) return;

    QRCodeLib.toDataURL(
      value,
      { width: 260, margin: 1 },
      (err, url) => {
        if (err) {
          console.error("Error generando QR:", err);
        } else {
          setDataUrl(url);
          if (onReady) onReady(url);
        }
      }
    );
  }, [value, onReady]);

  if (!dataUrl) return <p>Generando QR...</p>;

  return (
    <img
      src={dataUrl}
      alt="Código QR"
      className="qr-image"
    />
  );
}

// Tarjeta de encuesta
function SurveyCard({ encuesta, onDelete }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  const handleCopy = async () => {
    const texto = encuesta.url || encuesta.id;
    try {
      await navigator.clipboard.writeText(texto);
      alert("Enlace copiado al portapapeles");
    } catch {
      alert("No se pudo copiar automáticamente. Copia manualmente: " + texto);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-encuesta-${encuesta.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Imprimir QR - ${encuesta.nombre}</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              text-align: center;
              padding: 24px;
            }
            h1 {
              font-size: 20px;
              margin-bottom: 12px;
            }
            img {
              width: 260px;
              height: 260px;
            }
            p {
              font-size: 14px;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <h1>${encuesta.nombre}</h1>
          <img src="${qrDataUrl}" alt="QR" />
          ${
            encuesta.url
              ? `<p>${encuesta.url}</p>`
              : `<p>ID: ${encuesta.id}</p>`
          }
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <article className="survey-card">
      <div className="survey-header">
        <h3>{encuesta.nombre}</h3>
        <button
          onClick={() => onDelete(encuesta.id)}
          className="btn btn-danger small"
        >
          Eliminar
        </button>
      </div>

      {encuesta.descripcion && (
        <p className="survey-description">{encuesta.descripcion}</p>
      )}

      {encuesta.url && (
        <p className="survey-url">
          <span>URL: </span>
          <a
            href={encuesta.url}
            target="_blank"
            rel="noreferrer"
          >
            {encuesta.url}
          </a>
        </p>
      )}

      <p className="survey-id">ID: {encuesta.id}</p>

      <div className="survey-qr">
        <QRCode
          value={encuesta.url || encuesta.id}
          onReady={setQrDataUrl}
        />
      </div>

      <div className="survey-actions">
        <button onClick={handleCopy} className="btn btn-outline small">
          Copiar enlace
        </button>
        <button
          onClick={handleDownload}
          className="btn btn-outline small"
          disabled={!qrDataUrl}
        >
          Descargar QR
        </button>
        <button
          onClick={handlePrint}
          className="btn btn-primary small"
          disabled={!qrDataUrl}
        >
          Imprimir QR
        </button>
      </div>
    </article>
  );
}

function App() {
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ENCUESTAS
  const [encuestas, setEncuestas] = useState([]);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevaUrl, setNuevaUrl] = useState("");

  // Búsqueda y paginación
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const ENCUESTAS_POR_PAGINA = 6;

  // Scanner
  const [qrEscaneado, setQrEscaneado] = useState("");
  const [mensajeValidacion, setMensajeValidacion] = useState("");
  const [encuestaActual, setEncuestaActual] = useState(null);

  // Tema (dark/light)
  const [theme, setTheme] = useState("dark");

  // ============ Tema inicial ============
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // ============ SESIÓN ============
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  const handleRegister = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Error al registrarse: " + error.message);
    } else {
      alert("Usuario registrado. Revisa tu correo para confirmar.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ============ CRUD ENCUESTAS ============
  const cargarEncuestas = async () => {
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setEncuestas(data);
  };

  const crearEncuesta = async (e) => {
    e.preventDefault();
    if (!nuevoTitulo) {
      alert("El título es obligatorio");
      return;
    }

    const { error } = await supabase.from("recursos").insert({
      nombre: nuevoTitulo,
      descripcion: nuevaDescripcion,
      url: nuevaUrl,
    });

    if (error) {
      alert("Error al crear la encuesta: " + error.message);
    } else {
      setNuevoTitulo("");
      setNuevaDescripcion("");
      setNuevaUrl("");
      cargarEncuestas();
    }
  };

  const eliminarEncuesta = async (id) => {
    if (!confirm("¿Eliminar esta encuesta?")) return;

    const { error } = await supabase.from("recursos").delete().eq("id", id);

    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      cargarEncuestas();
    }
  };

  useEffect(() => {
    if (session) {
      cargarEncuestas();
    }
  }, [session]);

  // ============ Búsqueda y paginación ============
  const encuestasFiltradas = encuestas.filter((e) => {
    const texto = (busqueda || "").toLowerCase();
    if (!texto) return true;
    return (
      (e.nombre || "").toLowerCase().includes(texto) ||
      (e.descripcion || "").toLowerCase().includes(texto) ||
      (e.url || "").toLowerCase().includes(texto)
    );
  });

  const totalPaginas = Math.max(
    1,
    Math.ceil(encuestasFiltradas.length / ENCUESTAS_POR_PAGINA)
  );

  useEffect(() => {
    setPagina(1);
  }, [busqueda, encuestas.length]);

  const inicio = (pagina - 1) * ENCUESTAS_POR_PAGINA;
  const encuestasPaginadas = encuestasFiltradas.slice(
    inicio,
    inicio + ENCUESTAS_POR_PAGINA
  );

  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    setPagina(nuevaPagina);
  };

  // ============ VALIDAR ENCUESTA (scanner) ============
  const validarEncuesta = async (textoQR) => {
    setMensajeValidacion("Buscando encuesta...");
    setEncuestaActual(null);

    // 1) Intentar por ID
    let { data, error } = await supabase
      .from("recursos")
      .select("*")
      .eq("id", textoQR)
      .single();

    // 2) Intentar por URL
    if (error || !data) {
      const { data: dataUrl, error: errorUrl } = await supabase
        .from("recursos")
        .select("*")
        .eq("url", textoQR)
        .single();

      if (errorUrl || !dataUrl) {
        setMensajeValidacion("QR no válido o encuesta no encontrada.");
        return;
      } else {
        data = dataUrl;
      }
    }

    setEncuestaActual(data);
    setMensajeValidacion(`Encuesta válida: ${data.nombre}`);
  };

  // ============ SCANNER ============
  useEffect(() => {
    if (!session) return;

    let scanner;

    const onScanSuccess = (decodedText) => {
      setQrEscaneado(decodedText);
      validarEncuesta(decodedText);
    };

    const onScanError = (_errorMessage) => {
      // errores de lectura continua, se ignoran
    };

    scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
      },
      false
    );

    scanner.render(onScanSuccess, onScanError);

    return () => {
      if (scanner) {
        scanner.clear().catch((err) =>
          console.error("Error al limpiar scanner", err)
        );
      }
    };
  }, [session]);

  // ============ VISTAS ============

  if (!session) {
    return (
      <div className="app">
        <div className="auth-card">
          <h1 className="app-title">Proyecto DevOps</h1>
          <h2 className="app-subtitle">Encuestas con Código QR</h2>
          <p className="login-caption">
            MR100518 · Mina Rodríguez, Brayan Rafael — Encuestas con QR
          </p>

          <form onSubmit={handleLogin} className="form">
            <label className="form-label">Correo institucional</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tucorreo@ejemplo.com"
            />

            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            <button type="submit" className="btn btn-primary">
              Iniciar sesión
            </button>
          </form>

          <div className="divider">
            <span>o</span>
          </div>

          <button onClick={handleRegister} className="btn btn-outline">
            Crear cuenta nueva
          </button>

          <p className="developer-tag">
            Estudiante asignado:{" "}
            <strong>Brayan Rafael Mina Rodríguez (MR100518)</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div>
          <h1 className="app-title">Proyecto DevOps - Encuestas con QR</h1>
          <p className="app-subtitle">
            MR100518 · Mina Rodríguez, Brayan Rafael — Encuestas con QR
          </p>
          <p className="app-quote">
            “Todos soñamos, pero pocos tienen metas. Uds pueden siempre con la
            mentalidad OUT OF THE BOX.”
          </p>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="btn btn-outline small theme-toggle"
            onClick={toggleTheme}
          >
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>

          <div className="header-user">
            <span className="user-email">{session.user?.email}</span>
            <button onClick={handleLogout} className="btn btn-outline small">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL */}
      <main className="layout">
        {/* COLUMNA IZQUIERDA */}
        <section className="column">
          {/* FORMULARIO */}
          <div className="card">
            <h2 className="card-title">Crear nueva encuesta</h2>
            <p className="card-description">
              Registra una encuesta y genera un código QR para que los
              participantes puedan responderla desde su dispositivo.
            </p>

            <form onSubmit={crearEncuesta} className="form">
              <label className="form-label">Título de la encuesta</label>
              <input
                type="text"
                className="input"
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                placeholder="Ej. Encuesta de satisfacción estudiantil"
              />

              <label className="form-label">Descripción</label>
              <textarea
                className="input textarea"
                value={nuevaDescripcion}
                onChange={(e) => setNuevaDescripcion(e.target.value)}
                placeholder="Breve explicación del objetivo de la encuesta"
              />

              <label className="form-label">
                URL de la encuesta (Google Forms, Microsoft Forms, etc.)
              </label>
              <input
                type="url"
                className="input"
                value={nuevaUrl}
                onChange={(e) => setNuevaUrl(e.target.value)}
                placeholder="https://forms.gle/..."
              />

              <p className="helper-text">
                Pega aquí el enlace del formulario que responderán los
                participantes.
              </p>

              <div className="providers-box">
                <p className="helper-text providers-title">
                  ¿Aún no tienes una encuesta? Crea una en:
                </p>
                <div className="providers-buttons">
                  <a
                    href="https://docs.google.com/forms/u/0/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline small provider-btn"
                  >
                    Google Forms
                  </a>
                  <a
                    href="https://forms.office.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline small provider-btn"
                  >
                    Microsoft Forms
                  </a>
                  <a
                    href="https://www.typeform.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline small provider-btn"
                  >
                    Typeform
                  </a>
                  <a
                    href="https://www.surveymonkey.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline small provider-btn"
                  >
                    SurveyMonkey
                  </a>
                </div>
              </div>

              <button type="submit" className="btn btn-primary">
                Guardar encuesta y generar QR
              </button>
            </form>
          </div>

          {/* LISTADO + BUSCADOR + PAGINACIÓN */}
          <div className="card">
            <div className="list-header">
              <div>
                <h2 className="card-title">Listado de encuestas</h2>
                <p className="card-description">
                  Busca por título, descripción o URL. Cada tarjeta tiene su QR,
                  acciones de copia, descarga e impresión.
                </p>
              </div>
              <div className="search-box">
                <input
                  type="search"
                  className="input search-input"
                  placeholder="Buscar encuesta..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            {encuestasFiltradas.length === 0 && (
              <p className="empty-text">
                No hay encuestas que coincidan con la búsqueda.
              </p>
            )}

            <div className="grid">
              {encuestasPaginadas.map((encuesta) => (
                <SurveyCard
                  key={encuesta.id}
                  encuesta={encuesta}
                  onDelete={eliminarEncuesta}
                />
              ))}
            </div>

            {encuestasFiltradas.length > ENCUESTAS_POR_PAGINA && (
              <div className="pagination">
                <button
                  className="btn btn-outline small"
                  onClick={() => cambiarPagina(pagina - 1)}
                  disabled={pagina === 1}
                >
                  « Anterior
                </button>
                <span className="pagination-info">
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  className="btn btn-outline small"
                  onClick={() => cambiarPagina(pagina + 1)}
                  disabled={pagina === totalPaginas}
                >
                  Siguiente »
                </button>
              </div>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA */}
        <section className="column column-narrow">
          {/* SCANNER */}
          <div className="card">
            <h2 className="card-title">Escanear código QR</h2>
            <p className="card-description">
              Usa la cámara para validar si el código corresponde a una
              encuesta registrada en el sistema.
            </p>

            <div id="reader" className="qr-reader" />

            <div className="scan-info">
              <p className="scan-text">
                <span>Texto escaneado:</span> {qrEscaneado || "—"}
              </p>
              <p className="scan-status">
                <strong>{mensajeValidacion}</strong>
              </p>
            </div>
          </div>

          {/* DETALLE DE ENCUESTA */}
          {encuestaActual && (
            <div className="card">
              <h2 className="card-title">Encuesta encontrada</h2>
              <p className="detail-item">
                <span>Título:</span> {encuestaActual.nombre}
              </p>
              <p className="detail-item">
                <span>Descripción:</span>{" "}
                {encuestaActual.descripcion || "Sin descripción"}
              </p>
              {encuestaActual.url && (
                <p className="detail-item">
                  <span>URL:</span>{" "}
                  <a
                    href={encuestaActual.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir encuesta
                  </a>
                </p>
              )}
            </div>
          )}

          {!encuestaActual && (
            <div className="card">
              <h2 className="card-title">¿Cómo funciona?</h2>
              <p className="card-description">
                Sigue estos pasos para usar el sistema de encuestas con QR.
              </p>
              <ol className="steps-list">
                <li>
                  <strong>1. Crea una encuesta</strong> con Google Forms,
                  Microsoft Forms u otra herramienta, y copia la URL.
                </li>
                <li>
                  <strong>2. Registra la encuesta</strong> pegando la URL en
                  este sistema para generar el código QR.
                </li>
                <li>
                  <strong>3. Descarga o imprime el QR</strong> y colócalo en el
                  lugar donde las personas lo puedan escanear.
                </li>
                <li>
                  <strong>4. Escanea el código</strong> para validar que el QR
                  pertenece a una encuesta registrada.
                </li>
              </ol>
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <span>
          Proyecto DevOps · Encuestas con QR · MR100518 — Mina Rodríguez, Brayan
          Rafael
        </span>
        <span>
          Estudiante: <strong>Brayan Rafael Mina Rodríguez</strong>
        </span>
      </footer>
    </div>
  );
}

export default App;
