import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import * as QRCodeLib from "qrcode";
import { Html5QrcodeScanner } from "html5-qrcode";

// Componente para generar el QR
function QRCode({ value }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) return;

    QRCodeLib.toDataURL(
      value,
      { width: 240, margin: 1 },
      (err, url) => {
        if (err) {
          console.error("Error generando QR:", err);
        } else {
          setDataUrl(url);
        }
      }
    );
  }, [value]);

  if (!dataUrl) return <p>Generando QR...</p>;

  return (
    <img
      src={dataUrl}
      alt="Código QR"
      className="qr-image"
    />
  );
}

function App() {
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Encuestas
  const [encuestas, setEncuestas] = useState([]);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevaUrl, setNuevaUrl] = useState("");

  const [qrEscaneado, setQrEscaneado] = useState("");
  const [mensajeValidacion, setMensajeValidacion] = useState("");
  const [encuestaActual, setEncuestaActual] = useState(null);

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

  // ============ VALIDAR ENCUESTA ============
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
        </div>

        <div className="header-user">
          <span className="user-email">{session.user?.email}</span>
          <button onClick={handleLogout} className="btn btn-outline small">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL */}
      <main className="layout">
        {/* COLUMNA IZQUIERDA: FORM + LISTADO */}
        <section className="column">
          {/* FORMULARIO */}
          <div className="card">
            <h2 className="card-title">Crear nueva encuesta</h2>
            <p className="card-description">
              Registra una encuesta y genera un código QR para compartirla.
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

              <button type="submit" className="btn btn-primary">
                Guardar encuesta
              </button>
            </form>
          </div>

          {/* LISTADO */}
          <div className="card">
            <h2 className="card-title">Listado de encuestas</h2>
            <p className="card-description">
              Cada tarjeta incluye el QR listo para imprimir o compartir.
            </p>

            {encuestas.length === 0 && (
              <p className="empty-text">Todavía no hay encuestas registradas.</p>
            )}

            <div className="grid">
              {encuestas.map((encuesta) => (
                <article key={encuesta.id} className="survey-card">
                  <div className="survey-header">
                    <h3>{encuesta.nombre}</h3>
                    <button
                      onClick={() => eliminarEncuesta(encuesta.id)}
                      className="btn btn-danger small"
                    >
                      Eliminar
                    </button>
                  </div>

                  {encuesta.descripcion && (
                    <p className="survey-description">
                      {encuesta.descripcion}
                    </p>
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
                    <QRCode value={encuesta.url || encuesta.id} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* COLUMNA DERECHA: SCANNER + DETALLE */}
        <section className="column column-narrow">
          {/* SCANNER */}
          <div className="card">
            <h2 className="card-title">Escanear código QR</h2>
            <p className="card-description">
              Usa la cámara para validar si el código corresponde a una encuesta registrada.
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
        </section>
      </main>
    </div>
  );
}

export default App;
