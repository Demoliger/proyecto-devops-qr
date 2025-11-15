import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import * as QRCodeLib from "qrcode";
import { Html5QrcodeScanner } from "html5-qrcode";

// Componente para generar un QR sin usar librerías con hooks
function QRCode({ value }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) return;

    QRCodeLib.toDataURL(
      value,
      { width: 200, margin: 1 },
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
      style={{ width: 160, height: 160 }}
    />
  );
}

function App() {
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [recursos, setRecursos] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");

  const [qrEscaneado, setQrEscaneado] = useState("");
  const [mensajeValidacion, setMensajeValidacion] = useState("");

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

  // ============ CRUD ============
  const cargarRecursos = async () => {
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setRecursos(data);
  };

  const crearRecurso = async (e) => {
    e.preventDefault();
    if (!nuevoNombre) {
      alert("El nombre es obligatorio");
      return;
    }

    const { error } = await supabase.from("recursos").insert({
      nombre: nuevoNombre,
      descripcion: nuevaDescripcion,
    });

    if (error) {
      alert("Error al crear recurso: " + error.message);
    } else {
      setNuevoNombre("");
      setNuevaDescripcion("");
      cargarRecursos();
    }
  };

  const eliminarRecurso = async (id) => {
    if (!confirm("¿Eliminar este recurso?")) return;

    const { error } = await supabase.from("recursos").delete().eq("id", id);

    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      cargarRecursos();
    }
  };

  useEffect(() => {
    if (session) {
      cargarRecursos();
    }
  }, [session]);

  // ============ VALIDAR RECURSO POR QR ============
  const validarRecurso = async (idEscaneado) => {
    setMensajeValidacion("Buscando recurso...");
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .eq("id", idEscaneado)
      .single();

    if (error || !data) {
      setMensajeValidacion("QR no válido o recurso no encontrado.");
    } else {
      setMensajeValidacion(`Recurso válido: ${data.nombre}`);
    }
  };

  // ============ SCANNER (html5-qrcode) ============
  useEffect(() => {
    if (!session) return;

    let scanner;

    const onScanSuccess = (decodedText /*, decodedResult */) => {
      setQrEscaneado(decodedText);
      validarRecurso(decodedText);
    };

    const onScanError = (_errorMessage) => {
      // errores de lectura continua, los ignoramos
    };

    scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
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
      <div
        style={{
          maxWidth: 400,
          margin: "40px auto",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        <h2>Proyecto DevOps QR - Login</h2>
        <form onSubmit={handleLogin}>
          <div>
            <label>Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", marginBottom: 10 }}
            />
          </div>
          <div>
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", marginBottom: 10 }}
            />
          </div>
          <button type="submit">Iniciar sesión</button>
        </form>

        <hr style={{ margin: "20px 0" }} />

        <p>¿No tienes cuenta?</p>
        <button onClick={handleRegister}>Registrarme</button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "20px auto",
        fontFamily: "sans-serif",
        color: "white",
      }}
    >
      <h2>Proyecto DevOps QR</h2>
      <p>Usuario: {session.user?.email}</p>
      <button onClick={handleLogout}>Cerrar sesión</button>

      <hr />

      <h3>Crear nuevo recurso</h3>
      <form onSubmit={crearRecurso}>
        <div>
          <label>Nombre</label>
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
        </div>
        <div>
          <label>Descripción</label>
          <textarea
            value={nuevaDescripcion}
            onChange={(e) => setNuevaDescripcion(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
        </div>
        <button type="submit">Guardar recurso</button>
      </form>

      <hr />

      <h3>Listado de recursos (con QR)</h3>
      {recursos.length === 0 && <p>No hay recursos aún.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {recursos.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid #444",
              padding: 10,
              borderRadius: 8,
              background: "#111",
            }}
          >
            <h4>{r.nombre}</h4>
            <p>{r.descripcion}</p>
            <p style={{ fontSize: 12, wordBreak: "break-all" }}>{r.id}</p>

            <div style={{ textAlign: "center", margin: "10px 0" }}>
              <QRCode value={r.id} />
            </div>

            <button onClick={() => eliminarRecurso(r.id)}>Eliminar</button>
          </div>
        ))}
      </div>

      <hr />

      <h3>Escanear QR</h3>
      <p>Apunta la cámara al código QR de uno de los recursos.</p>

      <div id="reader" style={{ width: 320, maxWidth: "100%" }} />

      <p style={{ marginTop: 10 }}>QR escaneado: {qrEscaneado}</p>
      <p>
        <strong>{mensajeValidacion}</strong>
      </p>
    </div>
  );
}

export default App;
